import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { booking_id, invoice_type = 'invoice' } = await req.json();

  const booking = await base44.entities.Booking.filter({ id: booking_id });
  if (!booking.length) return Response.json({ error: 'Booking not found' }, { status: 404 });
  const b = booking[0];

  const connections = await base44.entities.QuibiConnection.filter({ tenant_id: b.tenant_id, status: 'active' });
  if (!connections.length) return Response.json({ error: 'No active Quibi connection for this tenant' }, { status: 400 });
  const conn = connections[0];

  const settings = JSON.parse(conn.settings_json || '{}');
  const authHeader = 'Basic ' + btoa(`${conn.username}:${conn.password}`);
  const baseUrl = conn.base_url || 'https://si.quibi.net';

  // Create or find customer in Quibi
  const customerRes = await fetch(`${baseUrl}/api2/stranka/form`, {
    method: 'POST',
    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      naziv: b.company_name || b.customer_name,
      email: b.customer_email,
      telefon: b.customer_phone,
      davcna: b.company_vat_id || '',
    }),
  });
  const customer = await customerRes.json();

  // Build invoice lines
  const lines = [{
    naziv: b.experience_title || 'Turistično doživetje',
    kolicina: b.total_pax || 1,
    cena: b.gross_total / (b.total_pax || 1),
    ddv_id: settings.default_ddv_id || conn.default_ddv_id,
  }];

  // Add commission line for OTA channels
  const commissionRates = { airbnb: 0.20, bookingcom: 0.15, viator: 0.20, gyg: 0.20 };
  if (commissionRates[b.channel]) {
    lines.push({
      naziv: `Provizija kanala (${b.channel}) ${(commissionRates[b.channel] * 100).toFixed(0)}%`,
      kolicina: 1,
      cena: -b.commission_total,
      ddv_id: settings.default_ddv_id || conn.default_ddv_id,
    });
  }

  const docPayload = {
    stranka_id: customer.id,
    stevilcenje_id: settings.stevilcenje_id || conn.default_stevilcenje_id,
    datum: new Date().toISOString().split('T')[0],
    tip: invoice_type === 'proforma' ? 'predracun' : 'racun',
    space_id: settings.space_id || conn.space_id || null,
    postavke: lines,
  };

  const docRes = await fetch(`${baseUrl}/api2/glavadokumenta/form`, {
    method: 'POST',
    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify(docPayload),
  });
  const doc = await docRes.json();
  if (!docRes.ok) return Response.json({ error: doc.message || 'Quibi error' }, { status: 500 });

  const invoiceNumber = doc.stevilka || doc.id;
  const fiscalStatus = conn.space_id ? 'fiscalized' : 'none';

  const invoice = await base44.entities.Invoice.create({
    tenant_id: b.tenant_id,
    invoice_number: invoiceNumber,
    invoice_type,
    status: 'sent',
    booking_id: b.id,
    customer_id: b.customer_id,
    customer_name: b.customer_name,
    company_name: b.company_name,
    company_vat_id: b.company_vat_id,
    issue_date: new Date().toISOString().split('T')[0],
    currency: 'EUR',
    net_total: b.net_total,
    vat_total: b.vat_total,
    gross_total: b.gross_total,
  });

  await base44.entities.ExternalDocument.create({
    tenant_id: b.tenant_id,
    invoice_id: invoice.id,
    provider_id: 'quibi',
    provider_document_id: String(doc.id),
    provider_document_number: invoiceNumber,
    fiscal_status: fiscalStatus,
    eor: doc.eor || '',
    zoi: doc.zoi || '',
    raw_response_json: JSON.stringify(doc),
    status: 'created',
  });

  await base44.entities.Booking.update(b.id, { invoice_id: invoice.id });

  return Response.json({ ok: true, invoice_id: invoice.id, invoice_number: invoiceNumber });
});