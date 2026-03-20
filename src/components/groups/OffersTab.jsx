import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, FileText, Mail, Printer, Plus } from 'lucide-react';
import EmailCompose from '@/components/email/EmailCompose';
import { format } from 'date-fns';

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  sent: 'bg-blue-100 text-blue-700 border-blue-200',
  accepted: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  declined: 'bg-red-100 text-red-700 border-red-200',
  expired: 'bg-orange-100 text-orange-700 border-orange-200',
};

const STATUS_LABELS = {
  draft: 'Osnutek', sent: 'Poslano', accepted: 'Sprejeto', declined: 'Zavrnjeno', expired: 'Poteklo',
};

export default function OffersTab({ tenantId }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [showEmailCompose, setShowEmailCompose] = useState(false);

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ['group-offers', tenantId],
    queryFn: () => base44.entities.GroupOffer.filter({ tenant_id: tenantId }, '-created_date'),
    enabled: !!tenantId,
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => base44.entities.Tenant.list(),
  });
  const tenant = tenants.find(t => t.id === tenantId);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.GroupOffer.update(id, data),
    onSuccess: (updated) => { queryClient.invalidateQueries({ queryKey: ['group-offers'] }); setSelected(updated); setEditForm(null); },
  });

  const acceptMutation = useMutation({
    mutationFn: async (offer) => {
      // 1. Create booking
      const booking = await base44.entities.Booking.create({
        tenant_id: tenantId,
        experience_id: offer.experience_id,
        experience_title: offer.experience_title,
        departure_date: offer.proposed_date,
        departure_time: offer.proposed_time,
        status: 'confirmed',
        customer_name: offer.contact_name,
        customer_email: offer.contact_email,
        company_name: offer.company_name,
        company_vat_id: offer.company_vat_id,
        adults: offer.group_size,
        total_pax: offer.group_size,
        gross_total: offer.total_price,
        net_total: offer.total_price,
        currency: offer.currency || 'EUR',
        channel: 'direct',
      });

      // 2. Create proforma invoice
      const allTenants = await base44.entities.Tenant.list();
      const t = allTenants.find(t => t.id === tenantId);
      const seq = (t?.invoice_seq_current || 0) + 1;
      const invNumber = `${t?.invoice_prefix || 'PRF-'}${String(seq).padStart(6, '0')}`;
      await base44.entities.Tenant.update(tenantId, { invoice_seq_current: seq });

      const today = new Date().toISOString().split('T')[0];
      const invoice = await base44.entities.Invoice.create({
        tenant_id: tenantId,
        invoice_number: invNumber,
        invoice_type: 'proforma',
        status: 'draft',
        language: 'sl',
        booking_id: booking.id,
        customer_name: offer.contact_name,
        company_name: offer.company_name,
        company_vat_id: offer.company_vat_id,
        issue_date: today,
        currency: offer.currency || 'EUR',
        gross_total: offer.total_price || 0,
        net_total: offer.total_price || 0,
        vat_total: 0,
        lines: [{
          description: `${offer.experience_title} – ${offer.proposed_date || ''} (${offer.group_size} oseb)`,
          qty: offer.group_size,
          unit_price_net: (offer.price_per_person || 0),
          vat_rate: 0,
          vat_amount: 0,
          line_total_gross: offer.total_price || 0,
        }],
      });

      // 3. Link booking → invoice
      await base44.entities.Booking.update(booking.id, { invoice_id: invoice.id });

      // 4. Update offer with all links
      return base44.entities.GroupOffer.update(offer.id, {
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        booking_id: booking.id,
        invoice_id: invoice.id,
      });
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['group-offers'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setSelected(updated);
    },
  });

  const openPdf = (offer) => {
    const html = generateOfferHtml(offer, tenant);
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  };

  const filtered = offers.filter(o => {
    const matchSearch = !search ||
      o.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.offer_number?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Išči ponudbo, agencijo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vsi statusi</SelectItem>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Številka</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Agencija</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Doživetje</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Datum</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Skupina</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Skupna cena</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Veljavna do</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && [...Array(4)].map((_, i) => (
              <tr key={i} className="border-b border-gray-50">
                {[...Array(8)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}
              </tr>
            ))}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">Ni ponudb</td></tr>
            )}
            {!isLoading && filtered.map(offer => (
              <tr key={offer.id} onClick={() => { setSelected(offer); setEditForm({ ...offer }); setShowEmailCompose(false); }} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors">
                <td className="px-4 py-3 font-mono text-xs font-medium text-[#1a5c38]">{offer.offer_number}</td>
                <td className="px-4 py-3 text-gray-700">{offer.company_name || offer.contact_name}</td>
                <td className="px-4 py-3 text-gray-700 max-w-[140px] truncate">{offer.experience_title || '—'}</td>
                <td className="px-4 py-3 text-gray-700">{offer.proposed_date || '—'}</td>
                <td className="px-4 py-3 text-gray-700">{offer.group_size}</td>
                <td className="px-4 py-3 font-medium">{offer.total_price ? `${offer.total_price.toFixed(2)} ${offer.currency || 'EUR'}` : '—'}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={`text-xs border ${STATUS_COLORS[offer.status] || ''}`}>
                    {STATUS_LABELS[offer.status] || offer.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{offer.valid_until || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Sheet */}
      {selected && editForm && (
        <Sheet open={!!selected} onOpenChange={() => { setSelected(null); setEditForm(null); }}>
          <SheetContent className="w-[560px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#1a5c38]" />
                {selected.offer_number}
                <Badge variant="outline" className={`text-xs border ml-2 ${STATUS_COLORS[selected.status] || ''}`}>
                  {STATUS_LABELS[selected.status]}
                </Badge>
              </SheetTitle>
            </SheetHeader>

            <div className="mt-6 space-y-5">
              {/* Editable fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-xs">Cena/osebo (€)</Label>
                  <Input type="number" step="0.01" value={editForm.price_per_person || ''} onChange={e => {
                    const ppp = parseFloat(e.target.value) || 0;
                    setEditForm({ ...editForm, price_per_person: ppp, total_price: ppp * (editForm.group_size || 0) });
                  }} />
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Skupna cena (€)</Label>
                  <Input type="number" step="0.01" value={editForm.total_price || ''} onChange={e => setEditForm({ ...editForm, total_price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Predlagani datum</Label>
                  <Input type="date" value={editForm.proposed_date || ''} onChange={e => setEditForm({ ...editForm, proposed_date: e.target.value })} />
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Ura</Label>
                  <Input type="time" value={editForm.proposed_time || ''} onChange={e => setEditForm({ ...editForm, proposed_time: e.target.value })} />
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Veljavna do</Label>
                  <Input type="date" value={editForm.valid_until || ''} onChange={e => setEditForm({ ...editForm, valid_until: e.target.value })} />
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Status</Label>
                  <Select value={editForm.status || 'draft'} onValueChange={v => setEditForm({ ...editForm, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5"><Label className="text-xs">Vključeno (vsaka vrstica = storitev)</Label>
                  <Textarea value={editForm.includes || ''} onChange={e => setEditForm({ ...editForm, includes: e.target.value })} rows={3} placeholder="Vodnik&#10;Vstopnine&#10;Pijača ob prihodu" />
                </div>
                <div className="col-span-2 space-y-1.5"><Label className="text-xs">Ni vključeno</Label>
                  <Textarea value={editForm.excludes || ''} onChange={e => setEditForm({ ...editForm, excludes: e.target.value })} rows={2} />
                </div>
                <div className="col-span-2 space-y-1.5"><Label className="text-xs">Plačilni pogoji</Label>
                  <Input value={editForm.payment_terms || ''} onChange={e => setEditForm({ ...editForm, payment_terms: e.target.value })} placeholder="30% ob potrditvi, 70% dan pred" />
                </div>
                <div className="col-span-2 space-y-1.5"><Label className="text-xs">Posebni pogoji</Label>
                  <Textarea value={editForm.special_conditions || ''} onChange={e => setEditForm({ ...editForm, special_conditions: e.target.value })} rows={2} />
                </div>
              </div>

              <Button className="w-full bg-[#1a5c38] hover:bg-[#154d2f]" size="sm"
                onClick={() => updateMutation.mutate({ id: selected.id, data: editForm })} disabled={updateMutation.isPending}>
                Shrani spremembe
              </Button>

              {/* Actions */}
              <div className="border-t pt-4 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Akcije</p>
                <Button className="w-full gap-2" size="sm" variant="outline" onClick={() => openPdf(editForm)}>
                  <Printer className="w-4 h-4" /> Generiraj PDF
                </Button>
                <Button className="w-full gap-2" size="sm" variant="outline"
                  onClick={() => setShowEmailCompose(v => !v)}>
                  <Mail className="w-4 h-4" /> {showEmailCompose ? 'Zapri email' : 'Pošlji po emailu'}
                </Button>
                {showEmailCompose && (
                  <div className="border rounded-lg overflow-hidden">
                    <EmailCompose
                      tenantId={tenantId}
                      initialTo={editForm.contact_email}
                      initialSubject={`Ponudba za zasebno skupino ${editForm.offer_number}`}
                      initialBody={`Spoštovani ${editForm.contact_name},\n\nv prilogi vam pošiljamo ponudbo ${editForm.offer_number} za zasebno skupino.\n\nDoživetje: ${editForm.experience_title}\nDatum: ${editForm.proposed_date || '—'}\nŠtevilo oseb: ${editForm.group_size}\nSkupna cena: ${editForm.total_price} ${editForm.currency || 'EUR'}\n\nLep pozdrav`}
                      contextData={{
                        customer_name: editForm.contact_name,
                        customer_email: editForm.contact_email,
                        experience_title: editForm.experience_title,
                        offer_number: editForm.offer_number,
                        company_name: editForm.company_name,
                      }}
                      onClose={() => {
                        setShowEmailCompose(false);
                        updateMutation.mutate({ id: selected.id, data: { status: 'sent', sent_at: new Date().toISOString() } });
                      }}
                      onSent={() => setShowEmailCompose(false)}
                    />
                  </div>
                )}
                {selected.status !== 'accepted' && (
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700" size="sm"
                    onClick={() => acceptMutation.mutate(selected)} disabled={acceptMutation.isPending}>
                    {acceptMutation.isPending ? 'Ustvarjam...' : '✅ Označi kot sprejeto → ustvari rezervacijo + račun'}
                  </Button>
                )}
                {selected.status === 'accepted' && selected.booking_id && (
                  <div className="space-y-2">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-700">
                      ✅ Rezervacija ustvarjena
                    </div>
                    {selected.invoice_id && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-700">
                        🧾 Račun ustvarjen
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Preview */}
              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Predogled ponudbe</p>
                <OfferPreview offer={editForm} tenant={tenant} />
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

function OfferPreview({ offer, tenant }) {
  return (
    <div className="border rounded-lg p-4 bg-white text-xs space-y-3 text-gray-700">
      <div className="flex justify-between items-start border-b pb-3">
        <div>
          {tenant?.logo_url && <img src={tenant.logo_url} className="h-8 mb-1" alt="logo" />}
          <p className="font-bold text-sm text-[#1a5c38]">{tenant?.name || 'Naziv podjetja'}</p>
          <p className="text-gray-400">{tenant?.address_line1}</p>
        </div>
        <div className="text-right">
          <p className="text-base font-bold text-[#1a5c38]">PONUDBA</p>
          <p className="font-mono">{offer.offer_number}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><p className="text-gray-400">Stranka</p><p className="font-medium">{offer.contact_name}</p><p>{offer.company_name}</p></div>
        <div><p className="text-gray-400">Doživetje</p><p className="font-medium">{offer.experience_title}</p><p>{offer.proposed_date} {offer.proposed_time}</p></div>
      </div>
      <table className="w-full border-collapse">
        <thead><tr className="bg-[#1a5c38] text-white"><th className="p-1 text-left">Storitev</th><th className="p-1 text-center">Oseb</th><th className="p-1 text-right">Cena/osebo</th><th className="p-1 text-right">Skupaj</th></tr></thead>
        <tbody><tr className="border-b"><td className="p-1">{offer.experience_title}</td><td className="p-1 text-center">{offer.group_size}</td><td className="p-1 text-right">{offer.price_per_person} €</td><td className="p-1 text-right font-bold">{offer.total_price} €</td></tr></tbody>
      </table>
      {offer.payment_terms && <div><p className="text-gray-400">Plačilni pogoji:</p><p>{offer.payment_terms}</p></div>}
    </div>
  );
}

function generateOfferHtml(offer, tenant) {
  const includes = (offer.includes || '').split('\n').filter(Boolean);
  const excludes = (offer.excludes || '').split('\n').filter(Boolean);
  return `<!DOCTYPE html>
<html lang="sl">
<head>
<meta charset="UTF-8">
<title>Ponudba ${offer.offer_number}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; font-size: 13px; padding: 40px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 3px solid #1a5c38; padding-bottom: 20px; margin-bottom: 24px; }
  .brand { }
  .brand h1 { color: #1a5c38; font-size: 18px; }
  .brand p { color: #666; font-size: 11px; }
  .offer-title { text-align:right; }
  .offer-title h2 { font-size: 22px; color: #1a5c38; letter-spacing: 2px; }
  .offer-title p { color: #666; font-size: 11px; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 8px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .meta-block p.label { font-size:10px; color:#888; }
  .meta-block p.value { font-weight: 600; }
  table { width:100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #1a5c38; color:white; padding: 8px 10px; text-align:left; font-size:11px; }
  td { padding: 8px 10px; border-bottom: 1px solid #eee; }
  .total-row td { font-weight: bold; background: #f0f7f3; }
  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  ul { padding-left: 16px; }
  li { margin-bottom: 4px; }
  .signature-box { border: 2px dashed #ccc; border-radius: 8px; padding: 20px 16px; margin-top: 24px; min-height: 80px; }
  .signature-box p { color: #888; font-size:11px; }
  .footer { margin-top: 32px; border-top: 1px solid #eee; padding-top: 12px; font-size: 10px; color: #aaa; text-align: center; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
<div class="header">
  <div class="brand">
    ${tenant?.logo_url ? `<img src="${tenant.logo_url}" style="height:40px;margin-bottom:6px;" />` : ''}
    <h1>${tenant?.name || 'Ponudnik doživetij'}</h1>
    <p>${tenant?.address_line1 || ''}</p>
    ${tenant?.vat_id ? `<p>DDV: ${tenant.vat_id}</p>` : ''}
  </div>
  <div class="offer-title">
    <h2>PONUDBA ZA ZASEBNO SKUPINO</h2>
    <p>Številka: <strong>${offer.offer_number}</strong></p>
    <p>Datum: ${new Date().toLocaleDateString('sl-SI')}</p>
    <p>Veljavna do: ${offer.valid_until || '—'}</p>
    <p>Skupina: <strong>${offer.group_size} oseb</strong></p>
  </div>
</div>

<div class="section meta-grid">
  <div>
    <p class="section-title">Naročnik</p>
    <div class="meta-block"><p class="label">Ime</p><p class="value">${offer.contact_name || '—'}</p></div>
    <div class="meta-block"><p class="label">Agencija</p><p class="value">${offer.company_name || '—'}</p></div>
    <div class="meta-block"><p class="label">E-pošta</p><p class="value">${offer.contact_email || '—'}</p></div>
    ${offer.company_vat_id ? `<div class="meta-block"><p class="label">DDV številka</p><p class="value">${offer.company_vat_id}</p></div>` : ''}
  </div>
  <div>
    <p class="section-title">Doživetje</p>
    <div class="meta-block"><p class="label">Naziv</p><p class="value">${offer.experience_title || '—'}</p></div>
    <div class="meta-block"><p class="label">Datum</p><p class="value">${offer.proposed_date || '—'}</p></div>
    <div class="meta-block"><p class="label">Ura</p><p class="value">${offer.proposed_time || '—'}</p></div>
  </div>
</div>

<div class="section">
  <p class="section-title">Cenovna tabela</p>
  <table>
    <thead><tr><th>Storitev</th><th>Število oseb</th><th>Cena / osebo</th><th>Skupaj</th></tr></thead>
    <tbody>
      <tr><td>${offer.experience_title || 'Doživetje'}</td><td style="text-align:center">${offer.group_size}</td><td style="text-align:right">${(offer.price_per_person || 0).toFixed(2)} ${offer.currency || 'EUR'}</td><td style="text-align:right">${(offer.total_price || 0).toFixed(2)} ${offer.currency || 'EUR'}</td></tr>
    </tbody>
    <tfoot><tr class="total-row"><td colspan="3"><strong>SKUPAJ</strong></td><td style="text-align:right"><strong>${(offer.total_price || 0).toFixed(2)} ${offer.currency || 'EUR'}</strong></td></tr></tfoot>
  </table>
</div>

${(includes.length || excludes.length) ? `
<div class="section two-col">
  <div>
    <p class="section-title">Vključeno</p>
    <ul>${includes.map(i => `<li>${i}</li>`).join('')}</ul>
  </div>
  <div>
    <p class="section-title">Ni vključeno</p>
    <ul>${excludes.map(e => `<li>${e}</li>`).join('')}</ul>
  </div>
</div>` : ''}

${offer.payment_terms ? `<div class="section"><p class="section-title">Plačilni pogoji</p><p>${offer.payment_terms}</p></div>` : ''}
${offer.special_conditions ? `<div class="section"><p class="section-title">Posebni pogoji</p><p>${offer.special_conditions}</p></div>` : ''}

<div class="signature-box">
  <p>Datum in podpis naročnika:</p>
  <br/><br/>
  <p>_________________________ &nbsp;&nbsp;&nbsp; _________________________</p>
  <p>Datum &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Podpis</p>
</div>

<div class="footer">
  ${tenant?.name || ''} • ${tenant?.address_line1 || ''} • ${tenant?.vat_id ? `DDV: ${tenant.vat_id}` : ''}
</div>
<script>window.onload = () => window.print();</script>
</body>
</html>`;
}