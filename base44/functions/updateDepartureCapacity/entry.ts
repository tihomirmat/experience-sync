/**
 * updateDepartureCapacity
 * Called by entity automation on Booking create/update.
 *
 * SECURITY: This endpoint can be invoked without authentication (entity
 * automations call it), so it must NEVER trust the request payload.
 * The payload is used only as a hint for WHICH departure to recompute —
 * the capacity itself is always recomputed from the database (sum of
 * confirmed bookings). This makes the function idempotent and forge-proof:
 * the worst an attacker can do is trigger a recomputation to correct values.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let payload = {};
  try { payload = await req.json(); } catch { /* ignore */ }
  const { data, old_data } = payload || {};

  // Collect departure ids mentioned in the event (new and old, in case the
  // booking was moved between departures).
  const departureIds = new Set();
  if (typeof data?.departure_id === 'string' && data.departure_id) departureIds.add(data.departure_id);
  if (typeof old_data?.departure_id === 'string' && old_data.departure_id) departureIds.add(old_data.departure_id);

  if (departureIds.size === 0) {
    return Response.json({ ok: true, skipped: 'no_departure_id' });
  }

  const results = [];

  for (const departureId of departureIds) {
    let departure = null;
    try { departure = await base44.asServiceRole.entities.Departure.get(departureId); } catch { /* ignore */ }
    if (!departure) {
      results.push({ departure_id: departureId, skipped: 'departure_not_found' });
      continue;
    }

    // Recompute used capacity from the database — the single source of truth.
    const confirmed = await base44.asServiceRole.entities.Booking.filter({
      departure_id: departureId,
      status: 'confirmed',
    });
    const used = confirmed.reduce((sum, b) => {
      const pax = b.total_pax || ((b.adults || 0) + (b.children || 0)) || 1;
      return sum + pax;
    }, 0);

    const total = departure.capacity_total ?? 0;
    const remaining = Math.max(total - used, 0);

    if (departure.capacity_remaining !== remaining) {
      await base44.asServiceRole.entities.Departure.update(departureId, {
        capacity_remaining: remaining,
      });
    }

    console.log(`[updateDepartureCapacity] Departure ${departureId}: total ${total}, used ${used} → remaining ${remaining}`);
    results.push({ departure_id: departureId, capacity_total: total, used, capacity_remaining: remaining });
  }

  return Response.json({ ok: true, results });
});
