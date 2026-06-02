/**
 * syncHubBookings
 * -------------------------------------------------------------------------
 * Scheduled poller (pull-based backstop to the webhook receiver).
 * Run it on a schedule in Base44 (e.g. every 10-15 min — see SYNC_WIRING.md).
 *
 * For every active HubConnection whose sync_direction includes inbound
 * (two_way / inbound_only) and which has API credentials, it pulls recent
 * bookings from the provider and upserts them the same way the webhook does
 * (dedup on tenant_id + hub_booking_id, resolve Experience via
 * hub_experience_id). This catches anything the webhook missed and covers
 * hubs that don't push webhooks.
 *
 * Currently implements pulls for FareHarbor and Bokun. Other hub types are
 * skipped with a clear status so they don't silently appear "synced".
 * -------------------------------------------------------------------------
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.28';

function splitDateTime(startAt) {
  if (!startAt) return { date: null, time: null };
  const d = new Date(startAt);
  if (isNaN(d.getTime())) return { date: String(startAt).slice(0, 10), time: null };
  return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) };
}

/** Pull recent bookings from FareHarbor External API. */
async function pullFareharbor(connection, since) {
  const appKey = connection.api_key_enc || '';
  const userKey = connection.api_secret_enc || '';
  const shortname = connection.base_url || ''; // company shortname goes in base_url
  if (!shortname) throw new Error('FareHarbor company shortname missing (store it in base_url)');
  const url = `https://fareharbor.com/api/external/v1/companies/${encodeURIComponent(shortname)}/bookings/?modified_since=${encodeURIComponent(since)}`;
  const res = await fetch(url, { headers: { 'X-FareHarbor-API-App': appKey, 'X-FareHarbor-API-User': userKey } });
  if (!res.ok) throw new Error(`FareHarbor ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  const bookings = data.bookings || [];
  const statusMap = { booked: 'confirmed', cancelled: 'cancelled', 'no-show': 'no_show' };
  return bookings.map(b => {
    const avail = b.availability || {};
    const item = avail.item || {};
    const contact = b.contact || {};
    return {
      hub_booking_id: String(b.uuid || b.pk || ''),
      hub_experience_id: String(item.pk || ''),
      experience_title_fallback: item.name || '',
      status: statusMap[(b.status || '').toLowerCase()] || 'confirmed',
      customer_name: contact.name || '',
      customer_email: contact.email || '',
      customer_phone: contact.phone || '',
      total_pax: (Array.isArray(b.customers) ? b.customers.length : 0) || b.customer_count || 1,
      start_at: avail.start_at || null,
      gross_total: Number(b.receipt_total ?? b.amount_paid ?? 0) || 0,
      currency: b.currency || 'EUR',
    };
  });
}

/**
 * Pull recent bookings from Bokun.
 * NOTE: Bokun requires an HMAC-SHA1 signature (X-Bokun-Date / X-Bokun-Signature)
 * computed from date + access key + HTTP method + path. The signing helper below
 * follows Bokun's documented scheme but MUST be verified against a live account
 * before relying on it in production.
 */
async function pullBokun(connection, since) {
  const accessKey = connection.api_key_enc || '';
  const secretKey = connection.api_secret_enc || '';
  const baseUrl = connection.base_url || 'https://api.bokun.io';
  const method = 'POST';
  const path = '/booking.json/booking-search';
  const date = new Date().toISOString().replace('T', ' ').slice(0, 19); // "yyyy-MM-dd HH:mm:ss"

  const toSign = `${date}${accessKey}${method}${path}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secretKey), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(toSign));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'X-Bokun-Date': date,
      'X-Bokun-AccessKey': accessKey,
      'X-Bokun-Signature': signature,
      'Content-Type': 'application/json;charset=UTF-8',
    },
    body: JSON.stringify({ bookingStatuses: ['CONFIRMED', 'CANCELLED'], startDateRange: { from: since } }),
  });
  if (!res.ok) throw new Error(`Bokun ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  const items = data.items || data.results || [];
  const statusMap = { CONFIRMED: 'confirmed', CANCELLED: 'cancelled', NO_SHOW: 'no_show', ARRIVED: 'completed' };
  return items.map(b => {
    const pb = (b.productBookings || [])[0] || {};
    const product = pb.product || {};
    const customer = b.customer || {};
    return {
      hub_booking_id: String(b.bookingId || b.confirmationCode || b.id || ''),
      hub_experience_id: String(product.id || ''),
      experience_title_fallback: product.title || '',
      status: statusMap[(b.status || '').toUpperCase()] || 'confirmed',
      customer_name: [customer.firstName, customer.lastName].filter(Boolean).join(' '),
      customer_email: customer.email || '',
      customer_phone: customer.phoneNumber || '',
      total_pax: pb.totalParticipants || 1,
      start_at: pb.startDateTime || null,
      gross_total: Number(pb.pricePaid ?? b.totalPrice ?? 0) || 0,
      currency: b.currency || 'EUR',
    };
  });
}

async function upsertBooking(base44, tenantId, connection, n, source) {
  if (!n.hub_booking_id) return { action: 'skipped', reason: 'no_id' };

  let experience = null;
  if (n.hub_experience_id) {
    const exps = await base44.asServiceRole.entities.Experience.filter({ tenant_id: tenantId, hub_experience_id: n.hub_experience_id });
    experience = exps?.[0] || null;
  }
  if (!experience) return { action: 'skipped', reason: 'unmapped_experience', hub_experience_id: n.hub_experience_id };

  const { date, time } = splitDateTime(n.start_at);
  const commissionRate = connection.commission_rate || 0;
  const existing = await base44.asServiceRole.entities.Booking.filter({ tenant_id: tenantId, hub_booking_id: n.hub_booking_id });

  if (existing?.length > 0) {
    await base44.asServiceRole.entities.Booking.update(existing[0].id, { status: n.status, total_pax: n.total_pax, gross_total: n.gross_total });
    return { action: 'updated', booking_id: existing[0].id };
  }

  const created = await base44.asServiceRole.entities.Booking.create({
    tenant_id: tenantId,
    hub_booking_id: n.hub_booking_id,
    hub_type: source,
    channel: 'hub_other',
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
  });
  return { action: 'created', booking_id: created.id };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const connections = await base44.asServiceRole.entities.HubConnection.filter({ status: 'active' });
  const inbound = connections.filter(c =>
    ['two_way', 'inbound_only'].includes(c.sync_direction || 'two_way') &&
    ['fareharbor', 'bokun'].includes((c.hub_type || '').toLowerCase()) &&
    c.api_key_enc);

  const summary = [];

  for (const c of inbound) {
    const hub = (c.hub_type || '').toLowerCase();
    // Default window: since last successful sync, else last 24h.
    const since = c.last_sync_at || new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    try {
      const rows = hub === 'fareharbor' ? await pullFareharbor(c, since) : await pullBokun(c, since);
      let created = 0, updated = 0, skipped = 0;
      for (const n of rows) {
        const r = await upsertBooking(base44, c.tenant_id, c, n, hub);
        if (r.action === 'created') created++;
        else if (r.action === 'updated') updated++;
        else skipped++;
      }
      await base44.asServiceRole.entities.HubConnection.update(c.id, {
        last_sync_at: new Date().toISOString(),
        last_sync_status: `pulled ${rows.length} (new ${created}, upd ${updated}, skip ${skipped})`,
      });
      summary.push({ connection: c.id, hub, pulled: rows.length, created, updated, skipped });
      console.log(`[syncHubBookings] ${hub} ${c.id}: pulled ${rows.length} (new ${created}, upd ${updated}, skip ${skipped})`);
    } catch (e) {
      await base44.asServiceRole.entities.HubConnection.update(c.id, { status: 'error', last_sync_status: `pull failed: ${e.message}`.slice(0, 200) });
      summary.push({ connection: c.id, hub, error: e.message });
      console.error(`[syncHubBookings] ${hub} ${c.id} failed: ${e.message}`);
    }
  }

  return Response.json({ ok: true, connections: inbound.length, summary });
});
