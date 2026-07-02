/**
 * createInvoice
 * Backend allocation of sequential invoice numbers (fiscal compliance).
 *
 * Previously the frontend read tenant.invoice_seq_current, incremented it and
 * created the invoice — two users (or a double-click) could produce duplicate
 * invoice numbers or gaps. This function does the allocation server-side with
 * a duplicate guard and retry.
 *
 * Input:  { tenant_id, invoice: {...invoice fields, no invoice_number}, booking_id? }
 * Output: { invoice } or { error }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ALLOWED_ROLES = ['owner', 'admin', 'accountant'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body = {};
    try { body = await req.json(); } catch { /* ignore */ }
    const { tenant_id, invoice, booking_id } = body;
    if (!tenant_id || !invoice || typeof invoice !== 'object') {
      return Response.json({ error: 'tenant_id and invoice required' }, { status: 400 });
    }

    // RBAC: only owner/admin/accountant may create invoices
    const roles = await base44.asServiceRole.entities.UserTenantRole.filter({ tenant_id, user_id: user.id });
    const role = roles?.[0]?.role;
    if (!ALLOWED_ROLES.includes(role || '')) {
      return Response.json({ error: 'Forbidden: your role cannot create invoices' }, { status: 403 });
    }

    // Never trust client-provided numbering/tenant fields
    const { invoice_number: _ignore1, tenant_id: _ignore2, ...invoiceData } = invoice;

    let created = null;
    let lastNumber = null;

    for (let attempt = 0; attempt < 3 && !created; attempt++) {
      const tenant = await base44.asServiceRole.entities.Tenant.get(tenant_id);
      if (!tenant) return Response.json({ error: 'Tenant not found' }, { status: 404 });

      const seq = (tenant.invoice_seq_current || 0) + 1;
      const invoiceNumber = `${tenant.invoice_prefix || 'INV-'}${String(seq).padStart(6, '0')}`;
      lastNumber = invoiceNumber;

      // Reserve the number first (so a concurrent call gets the next one)
      await base44.asServiceRole.entities.Tenant.update(tenant_id, { invoice_seq_current: seq });

      // Duplicate guard: if the number is already taken, retry with the next
      const dup = await base44.asServiceRole.entities.Invoice.filter({ tenant_id, invoice_number: invoiceNumber });
      if (dup?.length > 0) {
        console.warn(`[createInvoice] Number ${invoiceNumber} already taken, retrying`);
        continue;
      }

      created = await base44.asServiceRole.entities.Invoice.create({
        ...invoiceData,
        tenant_id,
        invoice_number: invoiceNumber,
        ...(booking_id ? { booking_id } : {}),
      });
    }

    if (!created) {
      return Response.json({ error: `Could not allocate a unique invoice number (last tried ${lastNumber}). Try again.` }, { status: 409 });
    }

    if (booking_id) {
      try {
        await base44.asServiceRole.entities.Booking.update(booking_id, { invoice_id: created.id });
      } catch (e) {
        console.warn(`[createInvoice] Could not link booking ${booking_id}: ${e.message}`);
      }
    }

    console.log(`[createInvoice] ${created.invoice_number} created by ${user.email} (tenant ${tenant_id})`);
    return Response.json({ invoice: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
