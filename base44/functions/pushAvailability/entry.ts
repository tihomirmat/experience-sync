/**
 * pushAvailability
 * -------------------------------------------------------------------------
 * Outbound availability sync — the fix for cross-channel overbooking.
 *
 * Given a departure_id, it pushes that departure's remaining capacity to every
 * outbound-capable channel (sync_direction two_way / outbound_only) where the
 * parent Experience is mapped to the hub (Experience.hub_experience_id set).
 *
 * Invoke it two ways (see SYNC_WIRING.md):
 *   - Entity automation on Departure update (capacity_remaining changed), OR
 *   - Chained from updateDepartureCapacity after a booking changes capacity.
 * Call with JSON body: { "departure_id": "..." }.
 *
 * FareHarbor's availability headcount can be updated via the External API.
 * Bokun availability updates are scaffolded but provider-specific; both paths
 * are clearly marked and MUST be verified against a live account. Hubs without
 * a push implementation are recorded as "manual" rather than silently ignored.
 * -------------------------------------------------------------------------
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.28';

async function pushFareharbor(connection, experience, departure, remaining) {
  const appKey = connection.api_key_enc || '';
  const userKey = connection.api_secret_enc || '';
  const shortname = connection.base_url || '';
  // FareHarbor identifies an availability slot by its pk. We expect it stored on
  // the departure as hub_availability_id (add this field in Base44 if missing).
  const availabilityId = departure.hub_availability_id;
  if (!shortname || !availabilityId) {
    return { ok: false, manual: true, reason: 'missing shortname or departure.hub_availability_id' };
  }
  const url = `https://fareharbor.com/api/external/v1/companies/${encodeURIComponent(shortname)}/availabilities/${encodeURIComponent(availabilityId)}/`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'X-FareHarbor-API-App': appKey, 'X-FareHarbor-API-User': userKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ capacity: Math.max(remaining, 0) }),
  });
  if (!res.ok) return { ok: false, reason: `FareHarbor ${res.status}: ${(await res.text()).slice(0, 140)}` };
  return { ok: true };
}

async function pushBokun(connection, experience, departure, remaining) {
  // Bokun availability is managed per-product/date via signed requests.
  // Scaffolded only — wire and verify against a live Bokun account.
  return { ok: false, manual: true, reason: 'Bokun availability push not yet verified — configure in Bokun or extend here' };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let body;
  try { body = await req.json(); } catch { body = {}; }
  // Support both direct calls ({departure_id}) and Departure entity automations ({data}).
  const departureId = body.departure_id || body?.data?.id;
  if (!departureId) return Response.json({ ok: true, skipped: 'no_departure_id' });

  const departure = await base44.asServiceRole.entities.Departure.get(departureId);
  if (!departure) return Response.json({ ok: true, skipped: 'departure_not_found' });

  const experience = await base44.asServiceRole.entities.Experience.get(departure.experience_id);
  if (!experience) return Response.json({ ok: true, skipped: 'experience_not_found' });

  // Only push for experiences that are mapped to at least one hub.
  if (!experience.hub_experience_id) return Response.json({ ok: true, skipped: 'experience_not_mapped' });

  const remaining = departure.capacity_remaining ?? departure.capacity_total ?? 0;

  const connections = await base44.asServiceRole.entities.HubConnection.filter({ tenant_id: departure.tenant_id, status: 'active' });
  const outbound = connections.filter(c => ['two_way', 'outbound_only'].includes(c.sync_direction || 'two_way'));

  const results = [];
  for (const c of outbound) {
    const hub = (c.hub_type || '').toLowerCase();
    let r;
    try {
      if (hub === 'fareharbor') r = await pushFareharbor(c, experience, departure, remaining);
      else if (hub === 'bokun') r = await pushBokun(c, experience, departure, remaining);
      else r = { ok: false, manual: true, reason: `no push implementation for ${hub}` };
    } catch (e) {
      r = { ok: false, reason: e.message };
    }
    const statusMsg = r.ok ? `availability ${remaining} pushed` : r.manual ? `manual: ${r.reason}` : `push error: ${r.reason}`;
    try {
      await base44.asServiceRole.entities.HubConnection.update(c.id, { last_sync_at: new Date().toISOString(), last_sync_status: statusMsg.slice(0, 200) });
    } catch { /* non-fatal */ }
    results.push({ connection: c.id, hub, ...r });
    console.log(`[pushAvailability] dep ${departureId} → ${hub}: ${statusMsg}`);
  }

  return Response.json({ ok: true, departure_id: departureId, remaining, pushed_to: results });
});
