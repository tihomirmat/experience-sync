import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { connection_id, connection_type } = await req.json();
    if (!connection_id || !connection_type) {
      return Response.json({ error: 'Missing connection_id or connection_type' }, { status: 400 });
    }

    let connection, hubType, providerId, credentials;

    if (connection_type === 'hub') {
      const conns = await base44.entities.HubConnection.filter({ id: connection_id });
      connection = conns[0];
      if (!connection) return Response.json({ error: 'Connection not found' }, { status: 404 });
      hubType = connection.hub_type;
      credentials = { api_key: connection.api_key_enc, api_secret: connection.api_secret_enc, base_url: connection.base_url };
    } else {
      const conns = await base44.entities.InvoicingConnection.filter({ id: connection_id });
      connection = conns[0];
      if (!connection) return Response.json({ error: 'Connection not found' }, { status: 404 });
      providerId = connection.provider_id;
      try { credentials = JSON.parse(connection.credentials_enc || '{}'); } catch { credentials = {}; }
    }

    let ok = false;
    let message = '';
    let details = {};

    if (connection_type === 'hub') {
      if (hubType === 'bokun') {
        try {
          const baseUrl = credentials.base_url || 'https://api.bokun.io';
          const resp = await fetch(`${baseUrl}/activity.json/list`, {
            headers: { 'X-Bokun-AccessKey': credentials.api_key || '', 'X-Bokun-SecretKey': credentials.api_secret || '' }
          });
          ok = resp.status === 200 || resp.status === 401; // 401 means we reached the API
          message = resp.status === 200 ? 'Bokun API dostopen' : resp.status === 401 ? 'Napačne poverilnice' : `HTTP ${resp.status}`;
          details = { status: resp.status };
        } catch (e) {
          ok = false; message = `Napaka povezave: ${e.message}`; details = {};
        }
      } else if (hubType === 'fareharbor') {
        try {
          const resp = await fetch('https://fareharbor.com/api/external/v1/companies/', {
            headers: { 'X-FareHarbor-API-App': credentials.api_key || '', 'X-FareHarbor-API-User': credentials.api_secret || '' }
          });
          ok = resp.status === 200;
          message = resp.status === 200 ? 'FareHarbor API dostopen' : `HTTP ${resp.status}`;
          details = { status: resp.status };
        } catch (e) {
          ok = false; message = `Napaka povezave: ${e.message}`; details = {};
        }
      } else {
        ok = true;
        message = 'Ročni test zahtevan — prosim preverite v vašem booking sistemu.';
        details = { manual_test_required: true };
      }

      await base44.entities.HubConnection.update(connection_id, {
        status: ok ? 'active' : 'error',
        last_sync_status: message,
        last_sync_at: new Date().toISOString(),
      });
    } else {
      if (providerId === 'quibi') {
        const baseUrl = credentials.base_url || 'https://si.quibi.net';
        const authStr = btoa(`${credentials.username || ''}:${credentials.password || ''}`);
        try {
          const resp = await fetch(`${baseUrl}/api2/ddv`, {
            headers: { 'Authorization': `Basic ${authStr}`, 'Accept': 'application/json' }
          });
          ok = resp.status === 200;
          message = resp.status === 200 ? 'Quibi API dostopen' : `HTTP ${resp.status} — preverite poverilnice`;
          details = { status: resp.status };
        } catch (e) {
          ok = false; message = `Napaka povezave: ${e.message}`; details = {};
        }
      } else {
        ok = true;
        message = 'Ročni test zahtevan za tega ponudnika.';
        details = { manual_test_required: true };
      }

      await base44.entities.InvoicingConnection.update(connection_id, {
        status: ok ? 'active' : 'error',
        last_healthcheck_at: new Date().toISOString(),
        last_error: ok ? null : message,
      });
    }

    return Response.json({ ok, message, details });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});