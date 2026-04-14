/**
 * updateDepartureCapacity
 * Called by entity automation on Booking create/update.
 * - On confirmed: decrement departure capacity_remaining by total_pax
 * - On cancelled: increment capacity_remaining back by total_pax
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const payload = await req.json();
  const { event, data, old_data } = payload;

  if (!data?.departure_id) {
    return Response.json({ ok: true, skipped: 'no_departure_id' });
  }

  const newStatus = data.status;
  const oldStatus = old_data?.status;

  // Only act on status transitions
  const becameConfirmed = newStatus === 'confirmed' && oldStatus !== 'confirmed';
  const becameCancelled = newStatus === 'cancelled' && oldStatus !== 'cancelled';
  const wasConfirmedNowCancelled = becameCancelled && oldStatus === 'confirmed';

  // On create with confirmed status
  const isNewConfirmed = event?.type === 'create' && newStatus === 'confirmed';

  if (!becameConfirmed && !wasConfirmedNowCancelled && !isNewConfirmed) {
    return Response.json({ ok: true, skipped: 'no_relevant_status_change' });
  }

  const pax = data.total_pax || data.adults || 1;

  const departure = await base44.asServiceRole.entities.Departure.get(data.departure_id);
  if (!departure) {
    return Response.json({ ok: true, skipped: 'departure_not_found' });
  }

  const current = departure.capacity_remaining ?? departure.capacity_total ?? 0;
  let newCapacity;

  if (becameConfirmed || isNewConfirmed) {
    newCapacity = current - pax;
  } else if (wasConfirmedNowCancelled) {
    newCapacity = current + pax;
  } else {
    return Response.json({ ok: true, skipped: 'no_action_needed' });
  }

  await base44.asServiceRole.entities.Departure.update(data.departure_id, {
    capacity_remaining: newCapacity,
  });

  console.log(`[updateDepartureCapacity] Departure ${data.departure_id}: ${current} → ${newCapacity} (booking ${data.id}, pax ${pax}, action ${becameConfirmed || isNewConfirmed ? 'decrement' : 'increment'})`);

  return Response.json({ ok: true, departure_id: data.departure_id, old_capacity: current, new_capacity: newCapacity });
});