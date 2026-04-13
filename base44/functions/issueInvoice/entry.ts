import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

async function issueViaQuibi(invoice, connection, settings, creds) {
  const baseUrl = creds.base_url || 'https://si.quibi.net';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' + btoa(`${creds.username}:${creds.password}`),
  };

  // Build Quibi document payload
  const lines = (invoice.lines || []).map((l, i) => ({
    Sifra: `LINE-${i + 1}`,
    Naziv: l.description,
    Kolicina: l.qty,
    Cena: l.unit_price_net,
    DdvStopnja: Math.round((l.vat_rate || 0) * 100),
    Popust: 0,
  }));

  const body = {
    VrstaDokumenta: 1, // Invoice
    StevilcenjeId: settings.stevilcenje_id || null,
    VrstaProdaje: settings.vrstaprodaje || 1,
    Jezik: settings.language || 'sl',
    SpaceId: settings.space_id || null,
    Stranka: {
      Naziv: invoice.company_name || invoice.customer_name || 'Kupec',
      Email: invoice.customer_email || null,
      DavcnaStevilka: invoice.company_vat_id || null,
    },
    DatumIzdaje: invoice.issue_date,
    DatumValute: invoice.due_date,
    Opomba: invoice.notes || '',
    Postavkedokumenta: lines,
  };

  const res = await fetch(`${baseUrl}/api2/glavadokumenta/form`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) throw new Error(`Quibi error ${res.status}: ${text.slice(0, 200)}`);

  return {
    provider_document_id: String(data.ID_DOKUMENTA || data.Id || data.id || ''),
    provider_document_number: String(data.StevilkaDokumenta || data.Stevilka || ''),
    fiscal_status: data.EOR ? 'fiscalized' : 'none',
    eor: data.EOR || null,
    zoi: data.ZOI || null,
    raw_response_json: JSON.stringify(data),
  };
}

async function issueViaCebelca(invoice, connection, settings, creds) {
  const token = creds.api_token;
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

  // 1) Assure partner
  const partnerParams = new URLSearchParams({
    token,
    title: invoice.company_name || invoice.customer_name || 'Kupec',
    email: invoice.customer_email || '',
    vat_id: invoice.company_vat_id || '',
    address: invoice.company_address || '',
  });

  const partnerRes = await fetch('https://www.cebelca.biz/API?_r=partner&_m=assure', {
    method: 'POST', headers, body: partnerParams.toString(),
  });
  const partnerData = await partnerRes.json();
  const partnerId = partnerData?.id || partnerData?.[0]?.id;

  // 2) Create invoice head
  const headParams = new URLSearchParams({
    token,
    date_sent: invoice.issue_date,
    date_due: invoice.due_date || invoice.issue_date,
    title: invoice.invoice_number || '',
    note: invoice.notes || '',
    id_partner: partnerId || '',
    currency_code: invoice.currency || 'EUR',
    lang: invoice.language || 'sl',
  });

  const headRes = await fetch('https://www.cebelca.biz/API?_r=invoice-sent&_m=insert-into', {
    method: 'POST', headers, body: headParams.toString(),
  });
  const headData = await headRes.json();
  const invoiceId = headData?.id || headData?.[0]?.id;
  if (!invoiceId) throw new Error('Čebelca: failed to create invoice head. Response: ' + JSON.stringify(headData).slice(0, 200));

  // 3) Add lines
  for (const line of (invoice.lines || [])) {
    const lineParams = new URLSearchParams({
      token,
      id_invoice_sent: invoiceId,
      title: line.description,
      qty: line.qty,
      price: line.unit_price_net,
      tax: Math.round((line.vat_rate || 0) * 100),
      discount: 0,
      um: 'kos',
    });
    await fetch('https://www.cebelca.biz/API?_r=invoice-sent-item&_m=insert-into', {
      method: 'POST', headers, body: lineParams.toString(),
    });
  }

  // 4) Fiscalization — best-effort or mark as manual
  let fiscal_status = 'none';
  if (settings.always_fiscalize) {
    fiscal_status = 'manual_required';
    // Hook for future fiscalize endpoint:
    // await fetch('https://www.cebelca.biz/API?_r=invoice-sent&_m=fiscalize', ...)
  }

  return {
    provider_document_id: String(invoiceId),
    provider_document_number: invoice.invoice_number || String(invoiceId),
    fiscal_status,
    eor: null,
    zoi: null,
    raw_response_json: JSON.stringify({ partner: partnerData, head: headData }),
  };
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { invoice_id, provider_id } = await req.json();
  if (!invoice_id || !provider_id) return Response.json({ error: 'invoice_id and provider_id required' }, { status: 400 });

  // Idempotency: return existing if already issued
  const existing = await base44.entities.ExternalDocument.filter({ invoice_id, provider_id });
  if (existing?.length > 0) return Response.json({ external_document: existing[0], already_exists: true });

  const invoice = await base44.entities.Invoice.get(invoice_id);
  if (!invoice) return Response.json({ error: 'Invoice not found' }, { status: 404 });

  const connections = await base44.entities.InvoicingConnection.filter({ tenant_id: invoice.tenant_id, provider_id });
  const connection = connections?.[0];
  if (!connection) return Response.json({ error: `No ${provider_id} connection configured` }, { status: 400 });

  let creds = {};
  let settings = {};
  try { creds = JSON.parse(connection.credentials_enc || '{}'); } catch {}
  try { settings = JSON.parse(connection.settings_json || '{}'); } catch {}

  let result;
  if (provider_id === 'quibi') {
    result = await issueViaQuibi(invoice, connection, settings, creds);
  } else if (provider_id === 'cebelca') {
    result = await issueViaCebelca(invoice, connection, settings, creds);
  } else {
    return Response.json({ error: 'Unknown provider' }, { status: 400 });
  }

  const extDoc = await base44.entities.ExternalDocument.create({
    tenant_id: invoice.tenant_id,
    invoice_id,
    provider_id,
    status: 'created',
    ...result,
  });

  await base44.entities.ProviderEvent.create({
    tenant_id: invoice.tenant_id,
    invoice_id,
    external_document_id: extDoc.id,
    provider_id,
    action: 'issue',
    success: true,
    response_summary: `doc_id=${result.provider_document_id}`,
  });

  return Response.json({ external_document: extDoc });
});