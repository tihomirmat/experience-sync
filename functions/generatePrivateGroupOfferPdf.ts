import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { offer_id } = await req.json();

  const offers = await base44.entities.PrivateGroupOffer.filter({ id: offer_id });
  if (!offers.length) return Response.json({ error: 'Offer not found' }, { status: 404 });
  const offer = offers[0];

  const tenants = await base44.asServiceRole.entities.Tenant.filter({ id: offer.tenant_id });
  const tenant = tenants[0] || { name: 'Experience Operator' };

  const totalPrice = offer.total_price || (offer.price_per_person * offer.group_size) || 0;

  const html = `<!DOCTYPE html>
<html lang="sl">
<head>
  <meta charset="UTF-8"/>
  <title>Ponudba ${offer.offer_number || ''}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; margin: 0; padding: 0; }
    .header { background: #1a5c38; color: white; padding: 32px 40px; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 4px 0 0; opacity: 0.8; }
    .content { padding: 32px 40px; }
    .section { margin-bottom: 28px; }
    .section h2 { color: #1a5c38; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #1a5c38; padding-bottom: 6px; margin-bottom: 12px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
    .meta-item label { font-size: 11px; color: #666; text-transform: uppercase; }
    .meta-item span { display: block; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f5f5f5; padding: 8px 12px; text-align: left; font-size: 12px; color: #555; }
    td { padding: 10px 12px; border-bottom: 1px solid #eee; }
    .total-row td { font-weight: 700; font-size: 16px; background: #f9fdf9; color: #1a5c38; }
    .badge { display: inline-block; background: #ffc107; color: #000; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .signature { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
    .sig-box { border-top: 1px solid #ccc; padding-top: 8px; font-size: 12px; color: #666; }
    .footer { background: #f5f5f5; padding: 16px 40px; font-size: 11px; color: #888; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${tenant.name}</h1>
    <p>Ponudba za zasebno skupino • ${offer.offer_number || 'OSNUTEK'}</p>
  </div>
  <div class="content">
    <div class="section">
      <h2>Podatki ponudbe</h2>
      <div class="meta-grid">
        <div class="meta-item"><label>Številka ponudbe</label><span>${offer.offer_number || '—'}</span></div>
        <div class="meta-item"><label>Datum ponudbe</label><span>${new Date().toLocaleDateString('sl-SI')}</span></div>
        <div class="meta-item"><label>Veljavnost ponudbe</label><span>${offer.valid_until || '—'}</span></div>
        <div class="meta-item"><label>Status</label><span class="badge">${offer.status?.toUpperCase()}</span></div>
      </div>
    </div>
    <div class="section">
      <h2>Stranka</h2>
      <div class="meta-grid">
        <div class="meta-item"><label>Ime in priimek</label><span>${offer.contact_name}</span></div>
        <div class="meta-item"><label>E-pošta</label><span>${offer.contact_email || '—'}</span></div>
      </div>
    </div>
    <div class="section">
      <h2>Doživetje</h2>
      <div class="meta-grid">
        <div class="meta-item"><label>Naziv doživetja</label><span>${offer.experience_title}</span></div>
        <div class="meta-item"><label>Datum eventi</label><span>${offer.event_date || '—'}</span></div>
        <div class="meta-item"><label>Število oseb</label><span>${offer.group_size || '—'}</span></div>
      </div>
    </div>
    <div class="section">
      <h2>Cenovna tabela</h2>
      <table>
        <tr><th>Opis</th><th>Cena/os</th><th>Število</th><th>Skupaj</th></tr>
        <tr>
          <td>${offer.experience_title}</td>
          <td>€${(offer.price_per_person || 0).toFixed(2)}</td>
          <td>${offer.group_size || 1}</td>
          <td>€${totalPrice.toFixed(2)}</td>
        </tr>
        <tr class="total-row">
          <td colspan="3">SKUPAJ</td>
          <td>€${totalPrice.toFixed(2)}</td>
        </tr>
      </table>
    </div>
    ${offer.includes ? `<div class="section"><h2>Vključeno</h2><p>${offer.includes}</p></div>` : ''}
    ${offer.excludes ? `<div class="section"><h2>Ni vključeno</h2><p>${offer.excludes}</p></div>` : ''}
    ${offer.payment_terms ? `<div class="section"><h2>Plačilni pogoji</h2><p>${offer.payment_terms}</p></div>` : ''}
    ${offer.notes ? `<div class="section"><h2>Opombe</h2><p>${offer.notes}</p></div>` : ''}
    <div class="signature">
      <div class="sig-box">Podpis stranke: ___________________________</div>
      <div class="sig-box">Podpis ponudnika: ___________________________</div>
    </div>
  </div>
  <div class="footer">${tenant.name} • Ponudba generirana ${new Date().toLocaleDateString('sl-SI')}</div>
</body>
</html>`;

  return Response.json({ ok: true, html, offer_number: offer.offer_number });
});