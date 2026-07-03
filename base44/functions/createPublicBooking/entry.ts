/**
 * createPublicBooking (public, no auth)
 * Creates a PENDING booking from the public booking page, sends a
 * confirmation e-mail to the guest + a notification to the farm, and — when
 * Stripe is configured — returns a Checkout URL for the deposit payment.
 *
 * SECURITY measures for an unauthenticated endpoint:
 *  - experience looked up by slug, must be active
 *  - departure must belong to the experience, be open and in the future
 *  - capacity check against confirmed bookings + a soft cap on pax
 *  - honeypot field ("website") silently discards bots
 *  - input length limits; only whitelisted fields are written
 *
 * Stripe (optional): set the STRIPE_SECRET_KEY secret and tenant.deposit_percent > 0.
 *
 * Input:  { slug, departure_id, adults, children, name, email, phone?,
 *           language?, country?, notes?, gdpr_consent, website? }
 * Output: { ok, booking_reference, status, checkout_url? } or { error }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const VALID_LANGUAGES = ['sl', 'en', 'de', 'it', 'fr', 'hr', 'other'];
const MAX_PAX = 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

// ── e-mail helpers ──────────────────────────────────────────────────────────

async function sendViaResend(conn, { to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${conn.resend_api_key_enc}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${conn.from_name || 'Experience Sync'} <${conn.from_email}>`,
      to: [to],
      subject,
      html,
      text: html.replace(/<[^>]+>/g, ''),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data).slice(0, 200));
  return data.id;
}

function guestEmail(lang, { name, expTitle, date, time, pax, reference, tenantName, estimate, currency }) {
  const sl = lang === 'sl';
  const subject = sl
    ? `Vaša rezervacija je prejeta — ${expTitle}`
    : `Your booking request has been received — ${expTitle}`;
  const rows = [
    [sl ? 'Doživetje' : 'Experience', expTitle],
    [sl ? 'Datum' : 'Date', `${date}${time ? ` ob ${time}` : ''}`],
    [sl ? 'Število oseb' : 'Guests', String(pax)],
    ...(estimate != null ? [[sl ? 'Znesek (ocena)' : 'Amount (estimate)', `${estimate.toFixed(2)} ${currency}`]] : []),
    [sl ? 'Referenca' : 'Reference', reference],
  ].map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#78716c">${k}</td><td style="padding:4px 0;font-weight:600">${v}</td></tr>`).join('');
  const html = `
  <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1c1917">
    <h2 style="color:#166534">${sl ? 'Hvala za vašo rezervacijo!' : 'Thank you for your booking!'}</h2>
    <p>${sl ? `Pozdravljeni, ${name}!` : `Hello, ${name}!`}</p>
    <p>${sl
      ? 'Vašo rezervacijo smo prejeli in čaka na potrditev. Ko jo potrdimo, boste prejeli še eno sporočilo.'
      : 'We have received your booking request and it is awaiting confirmation. You will receive another message once it is confirmed.'}</p>
    <table style="border-collapse:collapse;margin:16px 0">${rows}</table>
    <p style="color:#78716c;font-size:13px">${tenantName}</p>
  </div>`;
  return { subject, html };
}

function ownerEmail({ name, email, phone, expTitle, date, time, pax, reference, notes }) {
  const subject = `Nova rezervacija: ${expTitle} — ${date} (${pax} os.)`;
  const html = `
  <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1c1917">
    <h2>Nova rezervacija čaka na potrditev</h2>
    <table style="border-collapse:collapse">
      <tr><td style="padding:4px 12px 4px 0;color:#78716c">Gost</td><td style="font-weight:600">${name} (${email}${phone ? `, ${phone}` : ''})</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#78716c">Doživetje</td><td style="font-weight:600">${expTitle}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#78716c">Datum</td><td style="font-weight:600">${date}${time ? ` ob ${time}` : ''}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#78716c">Osebe</td><td style="font-weight:600">${pax}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#78716c">Referenca</td><td style="font-weight:600">${reference}</td></tr>
      ${notes ? `<tr><td style="padding:4px 12px 4px 0;color:#78716c">Sporočilo</td><td>${notes}</td></tr>` : ''}
    </table>
    <p>Potrdi jo v aplikaciji pod Rezervacije.</p>
  </div>`;
  return { subject, html };
}

// ── Stripe helper ───────────────────────────────────────────────────────────

async function createStripeCheckout(secretKey, { amountCents, currency, productName, customerEmail, bookingId, tenantId, successUrl, cancelUrl }) {
  const params = new URLSearchParams({
    mode: 'payment',
    'line_items[0][price_data][currency]': currency.toLowerCase(),
    'line_items[0][price_data][product_data][name]': productName,
    'line_items[0][price_data][unit_amount]': String(amountCents),
    'line_items[0][quantity]': '1',
    customer_email: customerEmail,
    success_url: successUrl,
    cancel_url: cancelUrl,
    'metadata[booking_id]': bookingId,
    'metadata[tenant_id]': tenantId,
    'payment_intent_data[metadata][booking_id]': bookingId,
  });
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Stripe HTTP ${res.status}`);
  return data.url;
}

// ── main ────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let body = {};
    try { body = await req.json(); } catch { /* ignore */ }

    // Honeypot: bots fill every field — pretend success, write nothing.
    if (clip(body.website, 50)) {
      return Response.json({ ok: true, booking_reference: 'OK', status: 'pending' });
    }

    const slug = clip(body.slug, 100);
    const departureId = clip(body.departure_id, 60);
    const name = clip(body.name, 120);
    const email = clip(body.email, 160).toLowerCase();
    const phone = clip(body.phone, 40);
    const notes = clip(body.notes, 1000);
    const country = clip(body.country, 60);
    const language = VALID_LANGUAGES.includes(body.language) ? body.language : 'en';

    const adults = Math.max(parseInt(body.adults) || 0, 0);
    const children = Math.max(parseInt(body.children) || 0, 0);
    const totalPax = adults + children;

    if (!slug || !departureId) return Response.json({ error: 'Missing slug or departure' }, { status: 400 });
    if (!name || !EMAIL_RE.test(email)) return Response.json({ error: 'Valid name and e-mail required' }, { status: 400 });
    if (totalPax < 1 || totalPax > MAX_PAX) return Response.json({ error: `Group size must be 1–${MAX_PAX}` }, { status: 400 });
    if (body.gdpr_consent !== true) return Response.json({ error: 'GDPR consent required' }, { status: 400 });

    // Load and validate experience + departure
    const exps = await base44.asServiceRole.entities.Experience.filter({ booking_slug: slug, status: 'active' });
    const exp = exps?.[0];
    if (!exp) return Response.json({ error: 'Experience not found' }, { status: 404 });

    let departure = null;
    try { departure = await base44.asServiceRole.entities.Departure.get(departureId); } catch { /* ignore */ }
    if (!departure || departure.experience_id !== exp.id || departure.tenant_id !== exp.tenant_id) {
      return Response.json({ error: 'Departure not found' }, { status: 404 });
    }
    if (departure.status !== 'open' || !departure.start_at || departure.start_at < new Date().toISOString()) {
      return Response.json({ error: 'This departure is no longer available' }, { status: 409 });
    }

    const remaining = departure.capacity_remaining ?? departure.capacity_total ?? 0;
    if (remaining < totalPax) {
      return Response.json({ error: `Only ${remaining} places remaining for this departure`, remaining }, { status: 409 });
    }

    // Find or create the customer
    let customer = null;
    const found = await base44.asServiceRole.entities.Customer.filter({ tenant_id: exp.tenant_id, email });
    customer = found?.[0] || null;
    if (!customer) {
      customer = await base44.asServiceRole.entities.Customer.create({
        tenant_id: exp.tenant_id,
        name,
        email,
        ...(phone ? { phone } : {}),
        ...(country ? { country } : {}),
        language,
        source: 'direct',
        marketing_opt_in: false,
      });
    }

    // Price estimate (per person) if known — the farm finalises on confirm
    const currency = departure.currency || exp.currency || 'EUR';
    const pricePerPerson = departure.price_cached ?? exp.base_price_from ?? null;
    const grossTotal = pricePerPerson != null ? Math.round(pricePerPerson * totalPax * 100) / 100 : undefined;

    const expTitle = exp.title_sl || exp.title_en || '';
    const depDate = (departure.start_at || '').slice(0, 10);
    const depTime = (departure.start_at || '').slice(11, 16);

    const created = await base44.asServiceRole.entities.Booking.create({
      tenant_id: exp.tenant_id,
      status: 'pending',
      channel: 'direct',
      hub_type: 'direct',
      experience_id: exp.id,
      experience_title: expTitle,
      departure_id: departure.id,
      departure_date: depDate,
      departure_time: depTime,
      customer_id: customer.id,
      customer_name: customer.name,
      customer_email: customer.email,
      ...(phone ? { customer_phone: phone } : {}),
      ...(country ? { customer_country: country } : {}),
      customer_language: language,
      adults,
      children,
      total_pax: totalPax,
      currency,
      ...(grossTotal !== undefined ? { gross_total: grossTotal } : {}),
      ...(notes ? { notes } : {}),
      booking_source_date: new Date().toISOString(),
    });

    const reference = created.id.slice(-6).toUpperCase();
    console.log(`[createPublicBooking] Pending booking ${created.id} for ${email} (${slug}, pax ${totalPax})`);

    const tenant = await base44.asServiceRole.entities.Tenant.get(exp.tenant_id).catch(() => null);

    // ── Confirmation e-mails (best effort — never fail the booking) ────────
    try {
      const conns = await base44.asServiceRole.entities.EmailConnection.filter({ tenant_id: exp.tenant_id, status: 'active' });
      const conn = conns?.find(c => c.provider === 'resend' && c.resend_api_key_enc);
      if (conn) {
        const emailLang = language === 'sl' ? 'sl' : 'en';
        const guest = guestEmail(emailLang, { name, expTitle, date: depDate, time: depTime, pax: totalPax, reference, tenantName: tenant?.name || '', estimate: grossTotal ?? null, currency });
        const guestId = await sendViaResend(conn, { to: email, subject: guest.subject, html: guest.html });
        await base44.asServiceRole.entities.EmailMessage.create({
          tenant_id: exp.tenant_id, direction: 'outbound', folder: 'sent', status: 'sent',
          from_email: conn.from_email || '', from_name: conn.from_name || '',
          to_email: email, to_name: name,
          subject: guest.subject, body_html: guest.html,
          customer_id: customer.id, booking_id: created.id,
          external_message_id: guestId, sent_at: new Date().toISOString(),
        });

        // Notify farm owners/admins
        const roles = await base44.asServiceRole.entities.UserTenantRole.filter({ tenant_id: exp.tenant_id });
        const ownerEmails = [...new Set((roles || []).filter(r => ['owner', 'admin'].includes(r.role)).map(r => r.user_email).filter(Boolean))];
        const notif = ownerEmail({ name, email, phone, expTitle, date: depDate, time: depTime, pax: totalPax, reference, notes });
        for (const to of ownerEmails.slice(0, 5)) {
          try { await sendViaResend(conn, { to, subject: notif.subject, html: notif.html }); } catch (e) { console.warn(`[createPublicBooking] owner notify failed: ${e.message}`); }
        }
      } else {
        console.log('[createPublicBooking] No active Resend connection — skipping confirmation e-mails');
      }
    } catch (e) {
      console.warn(`[createPublicBooking] E-mail sending failed: ${e.message}`);
    }

    // ── Stripe deposit (optional) ───────────────────────────────────────────
    let checkoutUrl = null;
    try {
      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
      const depositPercent = Number(tenant?.deposit_percent) || 0;
      if (stripeKey && depositPercent > 0 && grossTotal) {
        const depositAmount = Math.round(grossTotal * depositPercent) / 100; // percent → EUR
        const amountCents = Math.max(Math.round(depositAmount * 100), 50); // Stripe min 0.50 €
        const origin = req.headers.get('origin') || 'https://experience-sync-pro.base44.app';
        const label = depositPercent >= 100 ? '' : ` — ${depositPercent}% ${language === 'sl' ? 'predplačilo' : 'deposit'}`;
        checkoutUrl = await createStripeCheckout(stripeKey, {
          amountCents,
          currency,
          productName: `${expTitle} (${depDate})${label}`,
          customerEmail: email,
          bookingId: created.id,
          tenantId: exp.tenant_id,
          successUrl: `${origin}/Book?exp=${encodeURIComponent(slug)}&lang=${language === 'sl' ? 'sl' : 'en'}&paid=1&ref=${reference}`,
          cancelUrl: `${origin}/Book?exp=${encodeURIComponent(slug)}&lang=${language === 'sl' ? 'sl' : 'en'}&cancelled=1&ref=${reference}`,
        });
      }
    } catch (e) {
      console.warn(`[createPublicBooking] Stripe checkout failed: ${e.message}`);
    }

    return Response.json({ ok: true, booking_reference: reference, status: 'pending', ...(checkoutUrl ? { checkout_url: checkoutUrl } : {}) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
