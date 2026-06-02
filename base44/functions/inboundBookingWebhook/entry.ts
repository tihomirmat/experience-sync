/**
 * inboundBookingWebhook
 * -------------------------------------------------------------------------
 * PUBLIC webhook receiver for inbound bookings from booking hubs / OTAs.
 * This is the endpoint the UI advertises as ".../api/webhook/{tenantId}".
 *
 * It is intentionally UNAUTHENTICATED (no base44.auth.me()) because it is
 * called by external systems (FareHarbor, Bokun, ...). It is instead
 * validated with a shared webhook secret stored on the HubConnection.
 *
 * WIRING (do this in Base44, see base44/functions/SYNC_WIRING.md):
 *   1. Deploy this function and copy its public URL.
 *   2. In each provider's dashboard, register the webhook as:
 *        <function-url>?tenant_id=<TENANT_ID>&source=<fareharbor|bokun|custom>&secret=<SECRET>
 *      where <SECRET> matches HubConnection.webhook_secret_enc for that hub.
 *
 * Behaviour:
 *   - Resolves the local Experience via Experience.hub_experience_id.
 *   - De-duplicates on (tenant_id + hub_booking_id): updates if seen, else creates.
 *   - If the experience is not mapped yet, it does NOT create a malformed
 *     booking — it records a WebhookEvent + Alert so the farm can map it first.
 *   - Always returns 200 quickly so providers don't retry-storm; problems are
 *     surfaced via WebhookEvent / Alert, not HTTP errors.
 * -------------------------------------------------------------------------
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.28';

/** Map a FareHarbor webhook payload to our canonical booking shape. */
function normalizeFareharbor(body) {
  const b = body?.booking || body || {};
  const avail = b.availability || {};
  const item = avail.item || {};
  const contact = b.contact || {};
  const startAt = avail.start_at || b.start_at || null;
  const statusMap = { booked: 'confirmed', cancelled: 'cancelled', 'no-show': 'no_show' };
  return {
    hub_booking_id: String(b.uuid || b.pk || b.display_id || ''),
    hub_experience_id: String(item.pk || avail.item_pk || ''),
    experience_title_fallback: item.name || '',
    status: statusMap[(b.status || '').toLowerCase()] || 'confirmed',
    customer_name: contact.name || [contact.first_name, contact.last_name].filter(Boolean).join(' ') || '',
    customer_email: contact.email || '',
    customer_phone: contact.phone || contact.normalized_phone || '',
    total_pax: (Array.isArray(b.customers) ? b.customers.length : 0) || b.customer_count || 1,
    start_at: startAt,
    gross_total: Number(b.receipt_total ?? b.amount_paid ?? 0) || 0,
    currency: b.currency || 'EUR',
  };
}

/** Map a Bokun webhook payload to our canonical booking shape. */
function normalizeBokun(body) {
  const b = body || {};
  const pb = Array.isArray(b.productBookings) ? b.productBookings[0] : (b.productBooking || {});
  const product = pb.product || {};
  const customer = b.customer || {};
  const statusMap = { CONFIRMED: 'confirmed', CANCELLED: 'cancelled', NO_SHOW: 'no_show', ARRIVED: 'completed' };
  return {
    hub_booking_id: String(b.bookingId || b.confirmationCode || b.id || ''),
    hub_experience_id: String(product.id || pb.productId || ''),
    experience_title_fallback: product.title || pb.title || '',
    status: statusMap[(b.status || pb.status || '').toUpperCase()] || 'confirmed',
    customer_name: [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.name || '',
    customer_email: customer.email || '',
    customer_phone: customer.phoneNumber || customer.phone || '',
    total_pax: pb.totalParticipants || pb.participants || 1,
    start_at: pb.startDateTime || pb.startDate || b.startDateTime || null,
    gross_total: Number(pb.pricePaid ?? b.totalPrice ?? 0) || 0,
    currency: b.currency || pb.currency || 'EUR',
  };
}

function splitDateTime(startAt) {
  if (!startAt) return { date: null, time: null };
  const d = new Date(startAt);
  if (isNaN(d.getTime())) return { date: String(startAt).slice(0, 10), time: null };
  return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) };
}

async function logEvent(base44, tenantId, fields) {
  // Best-effort — never let logging failures break ingestion.
  try {
    await base44.asServiceRole.entities.WebhookEvent.create({
      tenant_id: tenantId,
      received_at: new Date().toISOString(),
      ...fields,
    });
  } catch (e) {
    console.error(`[inboundBookingWebhook] WebhookEvent log failed: ${e.message}`);
  }
}

async function raiseAlert(base44, tenantId, title, detail) {
  try {
    await base44.asServiceRole.entities.Alert.create({
      tenant_id: tenantId,
      status: 'open',
      severity: 'warning',
      title,
      message: detail,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error(`[inboundBookingWebhook] Alert create failed: ${e.message}`);
  }
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const url = new URL(req.url);
  const tenantId = url.searchParams.get('tenant_id');
  const source = (url.searchParams.get('source') || 'custom').toLowerCase();
  const providedSecret = url.searchParams.get('secret') || req.headers.get('x-webhook-secret') || '';

  if (!tenantId) return Response.json({ error: 'tenant_id query param required' }, { status: 400 });

  let body;
  try { body = await req.json(); } catch { body = {}; }

  // Find the matching hub connection (by source/hub_type) to validate the secret.
  let connection = null;
  try {
    const conns = await base44.asServiceRole.entities.HubConnection.filter({ tenant_id: tenantId });
    connection = conns.find(c => (c.hub_type || '').toLowerCase() === source) || conns.find(c => c.webhook_secret_enc);
  } catch (e) {
    console.error(`[inboundBookingWebhook] HubConnection lookup failed: ${e.message}`);
  }

  // Secret check: if a secret is configured on the connection it MUST match.
  const expectedSecret = connection?.webhook_secret_enc || '';
  if (expectedSecret && providedSecret !== expectedSecret) {
    await logEvent(base44, tenantId, { source, status: 'rejected', error: 'bad_secret' });
    return Response.json({ error: 'invalid secret' }, { status: 401 });
  }

  // Normalize per source.
  let n;
  if (source === 'fareharbor') n = normalizeFareharbor(body);
  else if (source === 'bokun') n = normalizeBokun(body);
  else n = normalizeFareharbor(body); // generic JSON falls back to the FareHarbor shape

  if (!n.hub_booking_id) {
    await logEvent(base44, tenantId, { source, status: 'error', error: 'missing_hub_booking_id', payload_summary: JSON.stringify(body).slice(0, 300) });
    return Response.json({ ok: true, skipped: 'missing_hub_booking_id' });
  }

  // Resolve local experience by external listing id.
  let experience = null;
  if (n.hub_experience_id) {
    try {
      const exps = await base44.asServiceRole.entities.Experience.filter({ tenant_id: tenantId, hub_experience_id: n.hub_experience_id });
      experience = exps?.[0] || null;
    } catch (e) {
      console.error(`[inboundBookingWebhook] Experience lookup failed: ${e.message}`);
    }
  }

  if (!experience) {
    await logEvent(base44, tenantId, { source, status: 'needs_mapping', hub_booking_id: n.hub_booking_id, error: `unmapped experience ${n.hub_experience_id}`, payload_summary: n.experience_title_fallback });
    await raiseAlert(base44, tenantId, 'Inbound booking needs experience mapping',
      `Booking ${n.hub_booking_id} from ${source} references listing "${n.experience_title_fallback}" (id ${n.hub_experience_id}) which is not linked to any Experience. Set that Experience's hub_experience_id to import bookings automatically.`);
    return Response.json({ ok: true, skipped: 'experience_not_mapped', hub_experience_id: n.hub_experience_id });
  }

  const { date, time } = splitDateTime(n.start_at);
  const channel = source === 'fareharbor' || source === 'bokun' ? 'hub_other' : 'hub_other';
  const commissionRate = connection?.commission_rate || 0;

  const bookingFields = {
    tenant_id: tenantId,
    hub_booking_id: n.hub_booking_id,
    hub_type: source === 'fareharbor' ? 'fareharbor' : source === 'bokun' ? 'bokun' : 'direct',
    channel,
    experience_id: experience.id,
    experience_title: experience.title_en || experience.title_sl || n.experience_title_fallback,
    departure_date: date,
    departure_time: time,
    status: n.status,
    customer_name: n.customer_name,
    customer_email: n.customer_email,
    customer_phone: n.customer_phone,
    adults: n.total_pax,
    total_pax: n.total_pax,
    currency: n.currency,
    gross_total: n.gross_total,
    commission_total: Math.round(n.gross_total * commissionRate * 100) / 100,
    booking_source_date: new Date().toISOString(),
  };

  // De-duplicate on (tenant_id + hub_booking_id).
  let result;
  try {
    const existing = await base44.asServiceRole.entities.Booking.filter({ tenant_id: tenantId, hub_booking_id: n.hub_booking_id });
    if (existing?.length > 0) {
      await base44.asServiceRole.entities.Booking.update(existing[0].id, { status: bookingFields.status, total_pax: bookingFields.total_pax, gross_total: bookingFields.gross_total });
      result = { action: 'updated', booking_id: existing[0].id };
    } else {
      const created = await base44.asServiceRole.entities.Booking.create(bookingFields);
      result = { action: 'created', booking_id: created.id };
    }
  } catch (e) {
    await logEvent(base44, tenantId, { source, status: 'error', hub_booking_id: n.hub_booking_id, error: e.message });
    return Response.json({ ok: false, error: e.message }, { status: 200 });
  }

  // Touch the connection's last-sync marker.
  try {
    if (connection) await base44.asServiceRole.entities.HubConnection.update(connection.id, { last_sync_at: new Date().toISOString(), last_sync_status: `inbound ${result.action} ${n.hub_booking_id}` });
  } catch { /* non-fatal */ }

  await logEvent(base44, tenantId, { source, status: 'processed', hub_booking_id: n.hub_booking_id, error: null, payload_summary: `${result.action} booking ${result.booking_id}` });
  console.log(`[inboundBookingWebhook] ${source} → ${result.action} booking ${result.booking_id} (${n.hub_booking_id})`);

  return Response.json({ ok: true, ...result });
});
