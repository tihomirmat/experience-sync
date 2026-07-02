/**
 * createBooking (admin)
 * Creates a booking server-side with:
 *  - RBAC check (owner/admin/staff)
 *  - optional departure link + capacity check
 *  - find-or-create Customer by e-mail and customer_id link
 *  - customer aggregate update (total_bookings / total_revenue)
 *
 * Input:  { tenant_id, booking: { experience_id, departure_id?, customer_name,
 *           customer_email?, customer_phone?, adults, children, status?,
 *           channel?, gross_total?, commission_total?, notes?, ... } }
 * Output: { booking, customer_id } or { error }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ALLOWED_ROLES = ['owner', 'admin', 'staff'];
const VALID_LANGUAGES = ['sl', 'en', 'de', 'it', 'fr', 'hr', 'other'];

export async function findOrCreateCustomer(base44, tenant_id, { name, email, phone, country, language }) {
  let customer = null;
  const cleanEmail = (email || '').trim().toLowerCase();

  if (cleanEmail) {
    const found = await base44.asServiceRole.entities.Customer.filter({ tenant_id, email: cleanEmail });
    customer = found?.[0] || null;
  }

  if (!customer) {
    const payload = {
      tenant_id,
      name: (name || '').trim() || cleanEmail || 'Gost',
      source: 'direct',
    };
    if (cleanEmail) payload.email = cleanEmail;
    if (phone) payload.phone = String(phone).trim();
    if (country) payload.country = String(country).trim();
    if (language && VALID_LANGUAGES.includes(language)) payload.language = language;
    customer = await base44.asServiceRole.entities.Customer.create(payload);
  }

  return customer;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch { /* ignore */ }
    const { tenant_id, booking } = body;
    if (!tenant_id || !booking?.experience_id) {
      return Response.json({ error: 'tenant_id and booking.experience_id required' }, { status: 400 });
    }

    const roles = await base44.asServiceRole.entities.UserTenantRole.filter({ tenant_id, user_id: user.id });
    const role = roles?.[0]?.role;
    if (!ALLOWED_ROLES.includes(role || '')) {
      return Response.json({ error: 'Forbidden: your role cannot create bookings' }, { status: 403 });
    }

    const adults = Math.max(parseInt(booking.adults) || 0, 0);
    const children = Math.max(parseInt(booking.children) || 0, 0);
    const totalPax = Math.max(adults + children, 1);
    const status = booking.status || 'pending';

    // Validate experience belongs to tenant
    let experience = null;
    try { experience = await base44.asServiceRole.entities.Experience.get(booking.experience_id); } catch { /* ignore */ }
    if (!experience || experience.tenant_id !== tenant_id) {
      return Response.json({ error: 'Experience not found for this tenant' }, { status: 400 });
    }

    // Optional departure link + capacity check
    let departure = null;
    if (booking.departure_id) {
      try { departure = await base44.asServiceRole.entities.Departure.get(booking.departure_id); } catch { /* ignore */ }
      if (!departure || departure.tenant_id !== tenant_id || departure.experience_id !== experience.id) {
        return Response.json({ error: 'Departure not found for this experience' }, { status: 400 });
      }
      if (departure.status !== 'open') {
        return Response.json({ error: 'Departure is not open for booking' }, { status: 409 });
      }
      if (status === 'confirmed') {
        const remaining = departure.capacity_remaining ?? departure.capacity_total ?? 0;
        if (remaining < totalPax) {
          return Response.json({ error: `Not enough capacity: ${remaining} places remaining, ${totalPax} requested`, remaining }, { status: 409 });
        }
      }
    }

    // Find or create the customer so CRM stays consistent
    const customer = await findOrCreateCustomer(base44, tenant_id, {
      name: booking.customer_name,
      email: booking.customer_email,
      phone: booking.customer_phone,
      country: booking.customer_country,
      language: booking.customer_language,
    });

    const created = await base44.asServiceRole.entities.Booking.create({
      ...booking,
      tenant_id,
      status,
      adults,
      children,
      total_pax: totalPax,
      customer_id: customer.id,
      customer_name: customer.name,
      customer_email: customer.email || booking.customer_email || '',
      experience_title: booking.experience_title || experience.title_sl || experience.title_en || '',
      ...(departure ? {
        departure_date: (departure.start_at || '').slice(0, 10),
        departure_time: (departure.start_at || '').slice(11, 16),
      } : {}),
      booking_source_date: new Date().toISOString(),
    });

    // Update customer aggregates (best effort)
    try {
      await base44.asServiceRole.entities.Customer.update(customer.id, {
        total_bookings: (customer.total_bookings || 0) + 1,
        total_revenue: (customer.total_revenue || 0) + (Number(booking.gross_total) || 0),
      });
    } catch (e) {
      console.warn(`[createBooking] Could not update customer aggregates: ${e.message}`);
    }

    console.log(`[createBooking] Booking ${created.id} created by ${user.email} (customer ${customer.id}, pax ${totalPax})`);
    return Response.json({ booking: created, customer_id: customer.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
