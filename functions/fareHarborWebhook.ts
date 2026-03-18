import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const COMMISSION_RATES = {
  airbnb: 0.20,
  bookingcom: 0.15,
  viator: 0.20,
  gyg: 0.20,
  fareharbor: 0.06,
  direct: 0,
};

const VAT_RATE = 0.095;

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const payload = await req.json();
  const eventType = payload.type || payload.event_type || 'unknown';

  // Log the event
  const syncRecord = await base44.asServiceRole.entities.FareHarborSync.create({
    tenant_id: payload.company?.shortname || 'unknown',
    company_shortname: payload.company?.shortname || '',
    event_type: eventType,
    booking_id_external: String(payload.booking?.pk || ''),
    payload_json: JSON.stringify(payload),
    status: 'received',
  });

  try {
    const booking = payload.booking;
    if (!booking) {
      await base44.asServiceRole.entities.FareHarborSync.update(syncRecord.id, { status: 'processed', processed_at: new Date().toISOString() });
      return Response.json({ ok: true, note: 'no booking in payload' });
    }

    const channel = detectChannel(booking);
    const commissionRate = COMMISSION_RATES[channel] || 0;
    const grossTotal = booking.invoice_price / 100 || 0;
    const commissionTotal = grossTotal * commissionRate;
    const netTotal = grossTotal - commissionTotal;
    const vatTotal = netTotal * VAT_RATE;

    const customerEmail = booking.contact?.email || '';
    let customerId = null;

    if (customerEmail) {
      const existing = await base44.asServiceRole.entities.Customer.filter({ email: customerEmail });
      if (existing.length > 0) {
        customerId = existing[0].id;
        await base44.asServiceRole.entities.Customer.update(customerId, {
          total_bookings: (existing[0].total_bookings || 0) + 1,
          total_revenue: (existing[0].total_revenue || 0) + netTotal,
        });
      } else {
        const newCustomer = await base44.asServiceRole.entities.Customer.create({
          tenant_id: payload.company?.shortname || '',
          name: `${booking.contact?.name || ''} ${booking.contact?.surname || ''}`.trim(),
          email: customerEmail,
          phone: booking.contact?.phone_country?.code + booking.contact?.phone || '',
          total_bookings: 1,
          total_revenue: netTotal,
        });
        customerId = newCustomer.id;
      }
    }

    const bookingData = {
      tenant_id: payload.company?.shortname || '',
      hub_booking_id: String(booking.pk),
      hub_type: 'fareharbor',
      channel,
      customer_id: customerId,
      customer_name: `${booking.contact?.name || ''} ${booking.contact?.surname || ''}`.trim(),
      customer_email: customerEmail,
      customer_phone: booking.contact?.phone || '',
      adults: booking.customers?.length || 1,
      total_pax: booking.customers?.length || 1,
      gross_total: grossTotal,
      net_total: netTotal,
      vat_total: vatTotal,
      commission_total: commissionTotal,
      currency: 'EUR',
    };

    if (eventType === 'booking.created' || eventType === 'booking.rebooked') {
      const item = booking.availability?.item;
      const availSlot = booking.availability;
      const newBooking = await base44.asServiceRole.entities.Booking.create({
        ...bookingData,
        experience_title: item?.name || '',
        departure_date: availSlot?.start_at?.split('T')[0] || '',
        departure_time: availSlot?.start_at?.split('T')[1]?.substring(0, 5) || '',
        status: 'confirmed',
        booking_source_date: new Date().toISOString(),
      });

      // Schedule reminder
      await base44.asServiceRole.entities.GuestCommunication.create({
        tenant_id: payload.company?.shortname || '',
        booking_id: newBooking.id,
        guest_email: customerEmail,
        guest_name: bookingData.customer_name,
        type: 'reminder_24h',
        status: 'scheduled',
        scheduled_at: new Date(Date.now() + 86400000).toISOString(),
      });

    } else if (eventType === 'booking.updated') {
      const existingBookings = await base44.asServiceRole.entities.Booking.filter({ hub_booking_id: String(booking.pk) });
      if (existingBookings.length > 0) {
        await base44.asServiceRole.entities.Booking.update(existingBookings[0].id, bookingData);
      }

    } else if (eventType === 'booking.cancelled') {
      const existingBookings = await base44.asServiceRole.entities.Booking.filter({ hub_booking_id: String(booking.pk) });
      if (existingBookings.length > 0) {
        await base44.asServiceRole.entities.Booking.update(existingBookings[0].id, { status: 'cancelled' });
        const comms = await base44.asServiceRole.entities.GuestCommunication.filter({ booking_id: existingBookings[0].id, status: 'scheduled' });
        for (const comm of comms) {
          await base44.asServiceRole.entities.GuestCommunication.update(comm.id, { status: 'cancelled' });
        }
      }

    } else if (eventType === 'availability.updated') {
      const avail = payload.availability;
      if (avail) {
        const departures = await base44.asServiceRole.entities.Departure.filter({ hub_departure_id: String(avail.pk) });
        if (departures.length > 0) {
          await base44.asServiceRole.entities.Departure.update(departures[0].id, {
            capacity_remaining: avail.capacity_remaining || 0,
            status: avail.capacity_remaining === 0 ? 'closed' : 'open',
          });
        }
      }
    }

    await base44.asServiceRole.entities.FareHarborSync.update(syncRecord.id, { status: 'processed', processed_at: new Date().toISOString() });
    return Response.json({ ok: true });
  } catch (error) {
    await base44.asServiceRole.entities.FareHarborSync.update(syncRecord.id, { status: 'failed', error: error.message });
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function detectChannel(booking) {
  const affiliate = booking.affiliate?.shortname?.toLowerCase() || '';
  if (affiliate.includes('airbnb')) return 'airbnb';
  if (affiliate.includes('booking')) return 'bookingcom';
  if (affiliate.includes('viator')) return 'viator';
  if (affiliate.includes('gyg') || affiliate.includes('getyourguide')) return 'gyg';
  return 'direct';
}