/**
 * sendEmail
 * Actually sends an e-mail through the tenant's active EmailConnection
 * (currently Resend) and logs it as an EmailMessage.
 *
 * Previously the compose UI only created an EmailMessage record with
 * status "sent" — nothing was ever delivered. All admin sending should go
 * through this function.
 *
 * Input:  { tenant_id, to_email, to_name?, subject, body_html, body_text?,
 *           cc?, bcc?, customer_id?, booking_id?, invoice_id?, inquiry_id? }
 * Output: { ok, message_id, email_message } or { error }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function sendViaResend(conn, { to_email, subject, body_html, body_text, cc, bcc }) {
  const key = conn.resend_api_key_enc;
  if (!key) throw new Error('Resend API ključ ni nastavljen');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${conn.from_name || 'Experience Sync'} <${conn.from_email}>`,
      to: [to_email],
      ...(cc ? { cc: [cc] } : {}),
      ...(bcc ? { bcc: [bcc] } : {}),
      subject,
      html: body_html,
      text: body_text || body_html?.replace(/<[^>]+>/g, '') || '',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Resend: ${JSON.stringify(data).slice(0, 300)}`);
  return { external_id: data.id };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch { /* ignore */ }
    const { tenant_id, to_email, subject, body_html } = body;
    if (!tenant_id || !to_email || !subject || !body_html) {
      return Response.json({ error: 'tenant_id, to_email, subject and body_html required' }, { status: 400 });
    }
    if (!EMAIL_RE.test(to_email)) return Response.json({ error: 'Invalid to_email' }, { status: 400 });

    // Must be a member of the tenant
    const roles = await base44.asServiceRole.entities.UserTenantRole.filter({ tenant_id, user_id: user.id });
    if (!roles?.length) return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Active e-mail connection
    const conns = await base44.asServiceRole.entities.EmailConnection.filter({ tenant_id, status: 'active' });
    const conn = conns?.find(c => c.provider === 'resend') || null;
    if (!conn) {
      return Response.json({ error: 'Ni aktivne Resend e-mail povezave. Nastavi jo v Email → Nastavitve.' }, { status: 400 });
    }

    let status = 'sent';
    let external_id = null;
    let error = null;
    try {
      const r = await sendViaResend(conn, body);
      external_id = r.external_id;
    } catch (e) {
      status = 'failed';
      error = e.message;
    }

    const emailMessage = await base44.asServiceRole.entities.EmailMessage.create({
      tenant_id,
      direction: 'outbound',
      folder: 'sent',
      status,
      from_email: conn.from_email || '',
      from_name: conn.from_name || '',
      to_email,
      to_name: body.to_name || '',
      subject,
      body_html,
      body_text: body.body_text || body_html.replace(/<[^>]+>/g, ''),
      ...(body.cc ? { cc: body.cc } : {}),
      ...(body.bcc ? { bcc: body.bcc } : {}),
      ...(body.customer_id ? { customer_id: body.customer_id } : {}),
      ...(body.booking_id ? { booking_id: body.booking_id } : {}),
      ...(body.invoice_id ? { invoice_id: body.invoice_id } : {}),
      ...(body.inquiry_id ? { inquiry_id: body.inquiry_id } : {}),
      ...(external_id ? { external_message_id: external_id } : {}),
      ...(error ? { error } : {}),
      sent_at: status === 'sent' ? new Date().toISOString() : undefined,
    });

    if (status === 'failed') {
      return Response.json({ error: `Pošiljanje ni uspelo: ${error}`, email_message: emailMessage }, { status: 502 });
    }
    return Response.json({ ok: true, message_id: external_id, email_message: emailMessage });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
