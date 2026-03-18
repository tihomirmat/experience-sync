import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { communication_id } = await req.json();

  const comms = await base44.entities.GuestCommunication.filter({ id: communication_id });
  if (!comms.length) return Response.json({ error: 'Communication not found' }, { status: 404 });
  const comm = comms[0];

  const bookings = await base44.entities.Booking.filter({ id: comm.booking_id });
  const booking = bookings[0] || {};

  const experiences = booking.experience_id
    ? await base44.asServiceRole.entities.Experience.filter({ id: booking.experience_id })
    : [];
  const experience = experiences[0] || {};

  const tenants = booking.tenant_id
    ? await base44.asServiceRole.entities.Tenant.filter({ id: booking.tenant_id })
    : [];
  const tenant = tenants[0] || { name: 'Experience Operator' };

  const dateStr = booking.departure_date || '';
  const timeStr = booking.departure_time || '';
  const pax = booking.total_pax || booking.adults || 1;
  const amount = `€${(booking.gross_total || 0).toFixed(2)}`;
  const meetingPoint = experience.meeting_point_name || '';
  const meetingAddress = experience.meeting_point_address || '';

  let subject = '';
  let body = '';

  if (comm.type === 'confirmation') {
    subject = `Potrditev rezervacije – ${booking.experience_title || 'Doživetje'}`;
    body = `<h2>Vaša rezervacija je potrjena!</h2>
<p>Spoštovani ${comm.guest_name || ''},</p>
<p>Veseli nas, da ste rezervirali <strong>${booking.experience_title || 'doživetje'}</strong>.</p>
<ul>
  <li>📅 Datum: <strong>${dateStr}</strong></li>
  <li>🕐 Ura: <strong>${timeStr}</strong></li>
  <li>👥 Število oseb: <strong>${pax}</strong></li>
  <li>💶 Znesek: <strong>${amount}</strong></li>
  ${meetingPoint ? `<li>📍 Zbirno mesto: <strong>${meetingPoint}</strong></li>` : ''}
</ul>
<p>Za vsa vprašanja smo vam na voljo.</p>
<p>Lep pozdrav,<br/>${tenant.name}</p>`;

  } else if (comm.type === 'reminder_24h') {
    subject = `Opomnik: Jutri vas čaka ${booking.experience_title || 'doživetje'}!`;
    body = `<h2>Jutri je vaše doživetje!</h2>
<p>Spoštovani ${comm.guest_name || ''},</p>
<p>Jutri, <strong>${dateStr} ob ${timeStr}</strong>, vas čaka <strong>${booking.experience_title || 'doživetje'}</strong>.</p>
${meetingPoint ? `<h3>📍 Zbirno mesto</h3><p>${meetingPoint}<br/>${meetingAddress}</p>` : ''}
<p>Prosimo, bodite na zbirnem mestu vsaj 10 minut pred začetkom.</p>
<p>Veselimo se srečanja z vami!<br/>${tenant.name}</p>`;

  } else if (comm.type === 'arrival_info') {
    subject = `Navodila za prihod – ${booking.experience_title || 'Doživetje'}`;
    body = `<h2>Navodila za prihod</h2>
<p>Spoštovani ${comm.guest_name || ''},</p>
${meetingPoint ? `<h3>📍 Zbirno mesto</h3><p><strong>${meetingPoint}</strong><br/>${meetingAddress}</p>` : ''}
<p>Datum: <strong>${dateStr}</strong> ob <strong>${timeStr}</strong>.</p>
<p>Lep pozdrav,<br/>${tenant.name}</p>`;

  } else if (comm.type === 'cancellation') {
    subject = `Odpoved rezervacije – ${booking.experience_title || 'Doživetje'}`;
    body = `<h2>Vaša rezervacija je bila odpovedana</h2>
<p>Spoštovani ${comm.guest_name || ''},</p>
<p>Žal vas moramo obvestiti, da je bila vaša rezervacija za <strong>${booking.experience_title || 'doživetje'}</strong> dne <strong>${dateStr}</strong> odpovedana.</p>
<p>Za vse informacije o povračilu nas kontaktirajte.</p>
<p>Opravičujemo se za morebitne nevšečnosti.<br/>${tenant.name}</p>`;
  }

  await base44.asServiceRole.entities.EmailOutbox.create({
    tenant_id: booking.tenant_id || '',
    to_email: comm.guest_email,
    subject,
    body_html: body,
    template_key: comm.type,
    status: 'queued',
  });

  await base44.entities.GuestCommunication.update(comm.id, {
    status: 'sent',
    sent_at: new Date().toISOString(),
    subject,
  });

  // Use built-in email
  await base44.asServiceRole.integrations.Core.SendEmail({
    to: comm.guest_email,
    subject,
    body: body,
  });

  return Response.json({ ok: true });
});