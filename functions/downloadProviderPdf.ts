import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { external_document_id, lang } = await req.json();
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
  let settings = {};
  try { creds = JSON.parse(connection.credentials_enc || '{}'); } catch {}
  try { settings = JSON.parse(connection.settings_json || '{}'); } catch {}

  let pdfBuffer;

  if (extDoc.provider_id === 'quibi') {
    const baseUrl = creds.base_url || 'https://si.quibi.net';
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + btoa(`${creds.username}:${creds.password}`),
    };
    const body = {
      ID_DOKUMENTA: extDoc.provider_document_id,
      natisni: 3,
      jezik: lang || settings.language || 'sl',
    };
    const res = await fetch(`${baseUrl}/api2/glavadokumenta/pdf`, {
      method: 'POST', headers, body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Quibi PDF error ${res.status}`);
    pdfBuffer = await res.arrayBuffer();
  } else if (extDoc.provider_id === 'cebelca') {
    const token = creds.api_token;
    const pdfUrl = `https://www.cebelca.biz/API-pdf?id=${extDoc.provider_document_id}&res=invoice-sent&token=${token}`;
    const res = await fetch(pdfUrl);
    if (!res.ok) throw new Error(`Čebelca PDF error ${res.status}`);
    pdfBuffer = await res.arrayBuffer();
  } else {
    return Response.json({ error: 'Unknown provider' }, { status: 400 });
  }

  // Upload to Base44 storage and return URL
  const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
  const formData = new FormData();
  formData.append('file', blob, `invoice-${extDoc.provider_document_number || extDoc.provider_document_id}.pdf`);

  const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file: blob });
  const pdfUrl = uploadRes?.file_url;

  if (pdfUrl) {
    await base44.entities.ExternalDocument.update(external_document_id, { pdf_url: pdfUrl });
  }

  await base44.entities.ProviderEvent.create({
    tenant_id: extDoc.tenant_id,
    invoice_id: extDoc.invoice_id,
    external_document_id: extDoc.id,
    provider_id: extDoc.provider_id,
    action: 'pdf',
    success: !!pdfUrl,
  });

  return Response.json({ pdf_url: pdfUrl });
});