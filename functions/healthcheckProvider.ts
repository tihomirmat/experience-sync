import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { connection_id } = await req.json();
  if (!connection_id) return Response.json({ error: 'connection_id required' }, { status: 400 });

  const connection = await base44.entities.InvoicingConnection.get(connection_id);
  if (!connection) return Response.json({ error: 'Connection not found' }, { status: 404 });

  let creds = {};
  try { creds = JSON.parse(connection.credentials_enc || '{}'); } catch {}

  let ok = false;
  let message = '';

  if (connection.provider_id === 'quibi') {
    const baseUrl = creds.base_url || 'https://si.quibi.net';
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + btoa(`${creds.username}:${creds.password}`),
    };
    const res = await fetch(`${baseUrl}/api2/stevilcenje`, { headers });
    ok = res.ok;
    message = ok ? 'Connected to Quibi successfully' : `Quibi returned ${res.status}`;
    if (ok) {
      const data = await res.json();
      message = `Connected. Found ${Array.isArray(data) ? data.length : '?'} numbering schemes.`;
    }
  } else if (connection.provider_id === 'cebelca') {
    const token = creds.api_token;
    const params = new URLSearchParams({ token, limit: '1' });
    const res = await fetch(`https://www.cebelca.biz/API?_r=invoice-sent&_m=get-all&${params.toString()}`);
    ok = res.ok;
    message = ok ? 'Connected to Čebelca successfully' : `Čebelca returned ${res.status}`;
  }

  await base44.entities.InvoicingConnection.update(connection_id, {
    status: ok ? 'active' : 'error',
    last_healthcheck_at: new Date().toISOString(),
    last_error: ok ? null : message,
  });

  await base44.entities.ProviderEvent.create({
    tenant_id: connection.tenant_id,
    provider_id: connection.provider_id,
    action: 'healthcheck',
    success: ok,
    response_summary: message,
  });

  return Response.json({ ok, message });
});