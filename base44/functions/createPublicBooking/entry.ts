/**
 * createPublicBooking (public, no auth)
 * Creates a PENDING booking from the public booking page. The farm confirms
 * it in the admin (confirmation is what consumes capacity).
 *
 * SECURITY measures for an unauthenticated endpoint:
 *  - experience looked up by slug, must be active
 *  - departure must belong to the experience, be open and in the future
 *  - capacity check against confirmed bookings + a soft cap on pax
 *  - honeypot field ("website") silently discards bots
 *  - input length limits; only whitelisted fields are written
 *
 * Input:  { slug, departure_id, adults, children, name, email, phone?,
 *           language?, country?, notes?, gdpr_consent, website? }
 * Output: { ok, booking_reference, status } or { error }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const VALID_LANGUAGES = ['sl', 'en', 'de', 'it', 'fr', 'hr', 'other'];
const MAX_PAX = 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

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
    const pricePerPerson = departure.price_cached ?? exp.base_price_from ?? null;
    const grossTotal = pricePerPerson != null ? Math.round(pricePerPerson * totalPax * 100) / 100 : undefined;

    const created = await base44.asServiceRole.entities.Booking.create({
      tenant_id: exp.tenant_id,
      status: 'pending',
      channel: 'direct',
      hub_type: 'direct',
      experience_id: exp.id,
      experience_title: exp.title_sl || exp.title_en || '',
      departure_id: departure.id,
      departure_date: (departure.start_at || '').slice(0, 10),
      departure_time: (departure.start_at || '').slice(11, 16),
      customer_id: customer.id,
      customer_name: customer.name,
      customer_email: customer.email,
      ...(phone ? { customer_phone: phone } : {}),
      ...(country ? { customer_country: country } : {}),
      customer_language: language,
      adults,
      children,
      total_pax: totalPax,
      currency: departure.currency || exp.currency || 'EUR',
      ...(grossTotal !== undefined ? { gross_total: grossTotal } : {}),
      ...(notes ? { notes } : {}),
      booking_source_date: new Date().toISOString(),
    });

    console.log(`[createPublicBooking] Pending booking ${created.id} for ${email} (${slug}, pax ${totalPax})`);

    const reference = created.id.slice(-6).toUpperCase();
    return Response.json({ ok: true, booking_reference: reference, status: 'pending' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
