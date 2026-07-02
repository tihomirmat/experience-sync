/**
 * getPublicAvailability (public, no auth)
 * Returns whitelisted experience info + upcoming open departures for the
 * public booking page (/Book?exp=<slug>).
 *
 * SECURITY: intentionally unauthenticated, therefore:
 *  - only active experiences with a booking_slug are exposed
 *  - only a whitelist of public fields is returned (no internal notes/ids)
 *
 * Input:  { slug }
 * Output: { experience, departures } or { error }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let body = {};
    try { body = await req.json(); } catch { /* ignore */ }
    const slug = (body.slug || '').trim();
    if (!slug) return Response.json({ error: 'slug required' }, { status: 400 });

    const exps = await base44.asServiceRole.entities.Experience.filter({ booking_slug: slug, status: 'active' });
    const exp = exps?.[0];
    if (!exp) return Response.json({ error: 'Experience not found' }, { status: 404 });

    const nowIso = new Date().toISOString();
    const allDeps = await base44.asServiceRole.entities.Departure.filter({
      tenant_id: exp.tenant_id,
      experience_id: exp.id,
      status: 'open',
    });

    const departures = (allDeps || [])
      .filter(d => d.start_at && d.start_at >= nowIso && (d.capacity_remaining ?? d.capacity_total ?? 0) > 0)
      .sort((a, b) => (a.start_at || '').localeCompare(b.start_at || ''))
      .slice(0, 90)
      .map(d => ({
        id: d.id,
        start_at: d.start_at,
        end_at: d.end_at || null,
        capacity_remaining: d.capacity_remaining ?? d.capacity_total ?? 0,
        price: d.price_cached ?? exp.base_price_from ?? null,
        currency: d.currency || exp.currency || 'EUR',
      }));

    // Whitelist of public experience fields
    const experience = {
      id: exp.id,
      booking_slug: exp.booking_slug,
      title_sl: exp.title_sl || '', title_en: exp.title_en || '',
      title_de: exp.title_de || '', title_hr: exp.title_hr || '',
      short_description_sl: exp.short_description_sl || '', short_description_en: exp.short_description_en || '',
      short_description_de: exp.short_description_de || '', short_description_hr: exp.short_description_hr || '',
      full_description_sl: exp.full_description_sl || '', full_description_en: exp.full_description_en || '',
      full_description_de: exp.full_description_de || '', full_description_hr: exp.full_description_hr || '',
      includes_sl: exp.includes_sl || '', includes_en: exp.includes_en || '',
      excludes_sl: exp.excludes_sl || '', excludes_en: exp.excludes_en || '',
      cancellation_policy_sl: exp.cancellation_policy_sl || '', cancellation_policy_en: exp.cancellation_policy_en || '',
      duration_minutes: exp.duration_minutes || null,
      meeting_point_name: exp.meeting_point_name || '',
      meeting_point_address: exp.meeting_point_address || '',
      base_price_from: exp.base_price_from ?? null,
      currency: exp.currency || 'EUR',
      images: (exp.images || []).map(i => ({ url: i.url, alt: i.alt || '' })),
    };

    return Response.json({ experience, departures });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
