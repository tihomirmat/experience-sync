/**
 * autoInvoiceOnBooking
 * -------------------------------------------------------------------------
 * Entity automation: bind to Booking create + update in Base44.
 * When a booking transitions to `confirmed` AND the tenant has opted in, it
 * creates a draft Invoice from the booking and links it back — the manual
 * "Ustvari račun" flow from Bookings.jsx, automated.
 *
 * Opt-in / gating (per tenant, via any InvoicingConnection.settings_json):
 *   { "auto_invoice": true }              → auto-create the draft invoice
 *   { "auto_invoice": true,
 *     "auto_issue": true }                → also push it to the fiscal provider
 *
 * Default is draft-only on purpose: in fiscalized markets (SI: Quibi/Čebelca)
 * issuing is legally binding, so a human should normally review first.
 *
 * NOTE on auto_issue: it calls the existing issueInvoice function so provider
 * logic stays in one place. issueInvoice currently requires an authenticated
 * user (base44.auth.me); enabling unattended auto_issue may require allowing
 * service-role invocation there — see SYNC_WIRING.md. Failures are logged and
 * never block invoice creation.
 * -------------------------------------------------------------------------
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.28';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let payload;
  try { payload = await req.json(); } catch { return Response.json({ ok: true, skipped: 'no_payload' }); }
  const { event, data, old_data } = payload;
  if (!data || event?.entity_name !== 'Booking') return Response.json({ ok: true, skipped: 'not_booking' });

  const becameConfirmed =
    (event.type === 'create' && data.status === 'confirmed') ||
    (event.type === 'update' && old_data?.status !== 'confirmed' && data.status === 'confirmed');
  if (!becameConfirmed) return Response.json({ ok: true, skipped: 'not_confirmed_transition' });

  // Idempotency — never invoice a booking twice.
  if (data.invoice_id) return Response.json({ ok: true, skipped: 'already_invoiced' });

  const tenantId = data.tenant_id;
  if (!tenantId) return Response.json({ ok: true, skipped: 'no_tenant' });

  // Gate on tenant opt-in.
  const connections = await base44.asServiceRole.entities.InvoicingConnection.filter({ tenant_id: tenantId });
  let autoInvoice = false, autoIssue = false, providerId = null;
  for (const c of connections) {
    let s = {};
    try { s = JSON.parse(c.settings_json || '{}'); } catch { /* ignore */ }
    if (s.auto_invoice) { autoInvoice = true; autoIssue = !!s.auto_issue; providerId = c.provider_id; break; }
  }
  if (!autoInvoice) return Response.json({ ok: true, skipped: 'auto_invoice_disabled' });

  // Build the invoice from the booking — mirrors Bookings.jsx createInvoiceMutation.
  const tenant = await base44.asServiceRole.entities.Tenant.get(tenantId);
  const seq = (tenant?.invoice_seq_current || 0) + 1;
  const invNumber = `${tenant?.invoice_prefix || 'INV-'}${String(seq).padStart(6, '0')}`;
  const vatRate = tenant?.default_vat_rate ?? 0.095;
  const pax = data.total_pax || data.adults || 1;
  const gross = data.gross_total || 0;
  const net = data.net_total || gross;
  const today = new Date().toISOString().slice(0, 10);
  const due = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);

  // Reserve the invoice number first (matches the manual flow's ordering).
  await base44.asServiceRole.entities.Tenant.update(tenantId, { invoice_seq_current: seq });

  const invoice = await base44.asServiceRole.entities.Invoice.create({
    tenant_id: tenantId,
    booking_id: data.id,
    invoice_number: invNumber,
    invoice_type: 'invoice',
    status: 'draft',
    language: data.customer_language || 'sl',
    customer_name: data.customer_name,
    customer_id: data.customer_id,
    customer_email: data.customer_email,
    company_name: data.company_name,
    company_vat_id: data.company_vat_id,
    issue_date: today,
    due_date: due,
    currency: data.currency || 'EUR',
    net_total: net,
    vat_total: data.vat_total || 0,
    gross_total: gross,
    lines: [{
      description: `${data.experience_title || 'Experience'} – ${data.departure_date || ''} (${pax} pax)`,
      qty: pax,
      unit_price_net: net / Math.max(pax, 1),
      vat_rate: vatRate,
      vat_amount: data.vat_total || 0,
      line_total_gross: gross,
    }],
  });

  await base44.asServiceRole.entities.Booking.update(data.id, { invoice_id: invoice.id });
  console.log(`[autoInvoiceOnBooking] Booking ${data.id} → draft Invoice ${invNumber} (${invoice.id})`);

  let issued = false;
  if (autoIssue && providerId) {
    try {
      await base44.functions.invoke('issueInvoice', { invoice_id: invoice.id, provider_id: providerId });
      issued = true;
      console.log(`[autoInvoiceOnBooking] Auto-issued ${invNumber} via ${providerId}`);
    } catch (e) {
      console.error(`[autoInvoiceOnBooking] Auto-issue failed for ${invNumber}: ${e.message}`);
    }
  }

  return Response.json({ ok: true, invoice_id: invoice.id, invoice_number: invNumber, auto_issued: issued });
});
