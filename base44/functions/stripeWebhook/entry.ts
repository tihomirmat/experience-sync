/**
 * stripeWebhook (public endpoint, signature-verified)
 * Handles checkout.session.completed:
 *   - creates a Payment record (status succeeded)
 *   - confirms the Booking (which also triggers capacity + sequences)
 *   - logs a WebhookEvent for auditing/idempotency
 *
 * Setup:
 *   1. Set the STRIPE_WEBHOOK_SECRET secret (whsec_...) in Base44.
 *   2. In the Stripe dashboard add a webhook endpoint pointing to this
 *      function's URL with the event "checkout.session.completed".
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function verifyStripeSignature(payload, sigHeader, secret) {
  if (!sigHeader || !secret) return false;
  const parts = Object.fromEntries(sigHeader.split(',').map(p => p.split('=')));
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;

  // Reject stale events (>10 min) to prevent replay
  const age = Math.abs(Date.now() / 1000 - Number(t));
  if (!Number.isFinite(age) || age > 600) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${payload}`));
  const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');

  // Constant-time compare
  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret) return Response.json({ error: 'STRIPE_WEBHOOK_SECRET not configured' }, { status: 500 });

  const payload = await req.text();
  const sigHeader = req.headers.get('stripe-signature');

  const valid = await verifyStripeSignature(payload, sigHeader, secret);
  if (!valid) return Response.json({ error: 'Invalid signature' }, { status: 400 });

  let event;
  try { event = JSON.parse(payload); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (event.type !== 'checkout.session.completed') {
    return Response.json({ ok: true, ignored: event.type });
  }

  const session = event.data?.object || {};
  const bookingId = session.metadata?.booking_id;
  const tenantId = session.metadata?.tenant_id;
  if (!bookingId || !tenantId) {
    return Response.json({ ok: true, ignored: 'no_booking_metadata' });
  }

  // Idempotency: skip if this Stripe event was already processed
  const existing = await base44.asServiceRole.entities.WebhookEvent.filter({ tenant_id: tenantId, source: 'stripe', idempotency_key: event.id });
  if (existing?.length > 0) {
    return Response.json({ ok: true, already_processed: true });
  }

  const booking = await base44.asServiceRole.entities.Booking.get(bookingId).catch(() => null);
  if (!booking || booking.tenant_id !== tenantId) {
    await base44.asServiceRole.entities.WebhookEvent.create({
      tenant_id: tenantId, source: 'stripe', idempotency_key: event.id,
      payload_json: JSON.stringify({ id: event.id, type: event.type, session_id: session.id }),
      status: 'failed', error: 'Booking not found', processed_at: new Date().toISOString(),
    });
    return Response.json({ ok: true, warning: 'booking_not_found' });
  }

  const amount = (session.amount_total ?? 0) / 100;
  const currency = (session.currency || 'eur').toUpperCase();

  await base44.asServiceRole.entities.Payment.create({
    tenant_id: tenantId,
    booking_id: bookingId,
    provider: 'stripe',
    provider_payment_id: session.payment_intent || session.id,
    amount,
    currency,
    status: 'succeeded',
    payment_date: new Date().toISOString().slice(0, 10),
    metadata_json: JSON.stringify({ checkout_session: session.id, customer_email: session.customer_email || session.customer_details?.email || '' }),
  });

  // Deposit received → confirm the booking (triggers capacity + sequences automations)
  if (booking.status === 'pending') {
    await base44.asServiceRole.entities.Booking.update(bookingId, { status: 'confirmed' });
  }

  await base44.asServiceRole.entities.WebhookEvent.create({
    tenant_id: tenantId, source: 'stripe', idempotency_key: event.id,
    payload_json: JSON.stringify({ id: event.id, type: event.type, session_id: session.id, amount, currency }),
    status: 'processed', processed_at: new Date().toISOString(),
  });

  console.log(`[stripeWebhook] Payment ${amount} ${currency} for booking ${bookingId} — confirmed`);
  return Response.json({ ok: true });
});
