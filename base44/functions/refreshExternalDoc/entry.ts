import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { external_document_id } = await req.json();
  if (!external_document_id) return Response.json({ error: 'external_document_id required' }, { status: 400 });

  const extDoc = await base44.entities.ExternalDocument.get(external_document_id);
  if (!extDoc) return Response.json({ error: 'External document not found' }, { status: 404 });

  const connections = await base44.entities.InvoicingConnection.filter({
    tenant_id: extDoc.tenant_id,
    provider_id: extDoc.provider_id,
  });
  const connection = connections?.[0];
  if (!connection) return Response.json({ error: 'Provider connection not found' }, { status: 400 });

  let creds = {};
  try { creds = JSON.parse(connection.credentials_enc || '{}'); } catch {}

  let updates = {};

  if (extDoc.provider_id === 'quibi') {
    const baseUrl = creds.base_url || 'https://si.quibi.net';
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + btoa(`${creds.username}:${creds.password}`),
    };
    const res = await fetch(`${baseUrl}/api2/glavadokumenta/view/${extDoc.provider_document_id}`, { headers });
    if (!res.ok) throw new Error(`Quibi view error ${res.status}`);
    const data = await res.json();
    updates = {
      provider_document_number: String(data.StevilkaDokumenta || extDoc.provider_document_number || ''),
      fiscal_status: data.EOR ? 'fiscalized' : extDoc.fiscal_status,
      eor: data.EOR || extDoc.eor,
      zoi: data.ZOI || extDoc.zoi,
      raw_response_json: JSON.stringify(data),
      status: 'synced',
    };
  } else if (extDoc.provider_id === 'cebelca') {
    // Čebelca: re-fetch PDF URL to confirm doc still exists; no dedicated view endpoint documented
    const token = creds.api_token;
    const pdfUrl = `https://www.cebelca.biz/API-pdf?id=${extDoc.provider_document_id}&res=invoice-sent&token=${token}`;
    const headRes = await fetch(pdfUrl, { method: 'HEAD' });
    updates = {
      status: headRes.ok ? 'synced' : 'error',
      error_message: headRes.ok ? null : `PDF HEAD check failed: ${headRes.status}`,
    };
  }

  const updated = await base44.entities.ExternalDocument.update(external_document_id, updates);

  await base44.entities.ProviderEvent.create({
    tenant_id: extDoc.tenant_id,
    invoice_id: extDoc.invoice_id,
    external_document_id: extDoc.id,
    provider_id: extDoc.provider_id,
    action: 'refresh',
    success: true,
  });

  return Response.json({ external_document: updated });
});