import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { username, password, base_url, tenant_id } = await req.json();
  const baseUrl = base_url || 'https://si.quibi.net';
  const authHeader = 'Basic ' + btoa(`${username}:${password}`);

  try {
    const [ddvRes, stevilcenjaRes, spacesRes, plačilaRes] = await Promise.all([
      fetch(`${baseUrl}/api2/ddv`, { headers: { 'Authorization': authHeader } }),
      fetch(`${baseUrl}/api2/stevilcenje`, { headers: { 'Authorization': authHeader } }),
      fetch(`${baseUrl}/api2/spaces`, { headers: { 'Authorization': authHeader } }),
      fetch(`${baseUrl}/api2/glavadokumenta/placila`, { headers: { 'Authorization': authHeader } }),
    ]);

    if (!ddvRes.ok) throw new Error(`Quibi auth failed: ${ddvRes.status}`);

    const ddv_codes = await ddvRes.json();
    const stevilcenja = await stevilcenjaRes.json();
    const spaces = await spacesRes.json().catch(() => []);
    const payment_methods = await plačilaRes.json().catch(() => []);

    // Update connection record if found
    const connections = await base44.asServiceRole.entities.QuibiConnection.filter({ tenant_id });
    if (connections.length > 0) {
      await base44.asServiceRole.entities.QuibiConnection.update(connections[0].id, {
        username,
        password,
        base_url: baseUrl,
        status: 'active',
        available_ddv: JSON.stringify(ddv_codes),
        available_stevilcenja: JSON.stringify(stevilcenja),
        available_spaces: JSON.stringify(spaces),
        available_payment_methods: JSON.stringify(payment_methods),
        last_tested_at: new Date().toISOString(),
        last_error: null,
      });
    } else {
      await base44.asServiceRole.entities.QuibiConnection.create({
        tenant_id,
        username,
        password,
        base_url: baseUrl,
        status: 'active',
        available_ddv: JSON.stringify(ddv_codes),
        available_stevilcenja: JSON.stringify(stevilcenja),
        available_spaces: JSON.stringify(spaces),
        available_payment_methods: JSON.stringify(payment_methods),
        last_tested_at: new Date().toISOString(),
      });
    }

    return Response.json({ ok: true, ddv_codes, stevilcenja, spaces, payment_methods });
  } catch (error) {
    const connections = await base44.asServiceRole.entities.QuibiConnection.filter({ tenant_id });
    if (connections.length > 0) {
      await base44.asServiceRole.entities.QuibiConnection.update(connections[0].id, {
        status: 'error',
        last_error: error.message,
        last_tested_at: new Date().toISOString(),
      });
    }
    return Response.json({ error: error.message }, { status: 400 });
  }
});