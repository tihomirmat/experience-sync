import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Plus, Search, Users, Mail, FileText } from 'lucide-react';
import { format } from 'date-fns';
import EmailCompose from '@/components/email/EmailCompose';

const STATUS_COLORS = {
  new: 'bg-blue-100 text-blue-700 border-blue-200',
  in_negotiation: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  offer_sent: 'bg-orange-100 text-orange-700 border-orange-200',
  confirmed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  declined: 'bg-red-100 text-red-700 border-red-200',
  expired: 'bg-gray-100 text-gray-600 border-gray-200',
};

const STATUS_LABELS = {
  new: 'Nova', in_negotiation: 'V pogajanju', offer_sent: 'Ponudba poslana',
  confirmed: 'Potrjeno', declined: 'Zavrnjeno', expired: 'Poteklo',
};

const SOURCE_LABELS = {
  email: 'E-pošta', phone: 'Telefon', web_form: 'Spletni obrazec',
  walk_in: 'Osebno', agency_portal: 'Agencijski portal',
};

const EMPTY_FORM = {
  source: 'email', status: 'new', flexible_dates: false, gdpr_consent: false,
};

export default function InquiriesTab({ tenantId }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [internalNote, setInternalNote] = useState('');

  const { data: inquiries = [], isLoading } = useQuery({
    queryKey: ['group-inquiries', tenantId],
    queryFn: () => base44.entities.GroupInquiry.filter({ tenant_id: tenantId }, '-created_date'),
    enabled: !!tenantId,
  });

  const { data: experiences = [] } = useQuery({
    queryKey: ['experiences', tenantId],
    queryFn: () => base44.entities.Experience.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.GroupInquiry.create({ ...data, tenant_id: tenantId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['group-inquiries'] }); setShowNew(false); setForm({ ...EMPTY_FORM }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.GroupInquiry.update(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['group-inquiries'] });
      setSelected(updated);
    },
  });

  const createOfferMutation = useMutation({
    mutationFn: async (inquiry) => {
      const offerNumber = `PG-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      const offer = await base44.entities.GroupOffer.create({
        tenant_id: tenantId,
        inquiry_id: inquiry.id,
        offer_number: offerNumber,
        status: 'draft',
        contact_name: inquiry.contact_name,
        contact_email: inquiry.contact_email,
        company_name: inquiry.company_name,
        company_vat_id: inquiry.company_vat_id,
        experience_id: inquiry.experience_id,
        experience_title: inquiry.experience_title,
        proposed_date: inquiry.requested_date,
        proposed_time: inquiry.requested_time,
        group_size: inquiry.group_size,
        currency: 'EUR',
      });
      await base44.entities.GroupInquiry.update(inquiry.id, { status: 'offer_sent', offer_id: offer.id });
      return offer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-inquiries'] });
      queryClient.invalidateQueries({ queryKey: ['group-offers'] });
      setSelected(null);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (inquiry) => base44.entities.GroupInquiry.update(inquiry.id, { status: 'confirmed' }),
    onSuccess: (updated) => { queryClient.invalidateQueries({ queryKey: ['group-inquiries'] }); setSelected(updated); },
  });

  const filtered = inquiries.filter(i => {
    const matchSearch = !search || i.contact_name?.toLowerCase().includes(search.toLowerCase()) || i.company_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || i.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Išči kontakt, agencija..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vsi statusi</SelectItem>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => { setForm({ ...EMPTY_FORM }); setShowNew(true); }} size="sm" className="gap-2 bg-[#1a5c38] hover:bg-[#154d2f]">
          <Plus className="w-4 h-4" /> Nova poizvedba
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Datum</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Kontakt</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Agencija</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Doživetje</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Skupina</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Zahtevani datum</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Zadolžen</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && [...Array(4)].map((_, i) => (
              <tr key={i} className="border-b border-gray-50">
                {[...Array(8)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}
              </tr>
            ))}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">Ni poizvedb</td></tr>
            )}
            {!isLoading && filtered.map(inq => (
              <tr key={inq.id} onClick={() => setSelected(inq)} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors">
                <td className="px-4 py-3 text-gray-500 text-xs">{inq.created_date ? format(new Date(inq.created_date), 'dd.MM.yyyy') : '—'}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{inq.contact_name}</p>
                  <p className="text-xs text-gray-400">{inq.contact_email}</p>
                </td>
                <td className="px-4 py-3 text-gray-700">{inq.company_name || '—'}</td>
                <td className="px-4 py-3 text-gray-700 max-w-[140px] truncate">{inq.experience_title || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-gray-700">
                    <Users className="w-3.5 h-3.5 text-gray-400" />
                    {inq.group_size}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700">{inq.requested_date || '—'}{inq.requested_time ? ` ${inq.requested_time}` : ''}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={`text-xs border ${STATUS_COLORS[inq.status] || ''}`}>
                    {STATUS_LABELS[inq.status] || inq.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{inq.assigned_to || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Inquiry Sheet */}
      <Sheet open={showNew} onOpenChange={setShowNew}>
        <SheetContent className="w-[480px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Nova poizvedba</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Ime kontakta *</Label>
                <Input value={form.contact_name || ''} onChange={e => setForm({ ...form, contact_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>E-pošta *</Label>
                <Input value={form.contact_email || ''} onChange={e => setForm({ ...form, contact_email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefon</Label>
                <Input value={form.contact_phone || ''} onChange={e => setForm({ ...form, contact_phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Naziv agencije/podjetja</Label>
                <Input value={form.company_name || ''} onChange={e => setForm({ ...form, company_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>DDV številka</Label>
                <Input value={form.company_vat_id || ''} onChange={e => setForm({ ...form, company_vat_id: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Vir</Label>
                <Select value={form.source || 'email'} onValueChange={v => setForm({ ...form, source: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SOURCE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Doživetje</Label>
                <Select value={form.experience_id || ''} onValueChange={v => {
                  const exp = experiences.find(e => e.id === v);
                  setForm({ ...form, experience_id: v, experience_title: exp?.title_en || exp?.title_sl || '' });
                }}>
                  <SelectTrigger><SelectValue placeholder="Izberi doživetje..." /></SelectTrigger>
                  <SelectContent>
                    {experiences.map(e => <SelectItem key={e.id} value={e.id}>{e.title_en || e.title_sl}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Zahtevani datum</Label>
                <Input type="date" value={form.requested_date || ''} onChange={e => setForm({ ...form, requested_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Ura</Label>
                <Input type="time" value={form.requested_time || ''} onChange={e => setForm({ ...form, requested_time: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Število oseb *</Label>
                <Input type="number" value={form.group_size || ''} onChange={e => setForm({ ...form, group_size: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label>Zadolžen</Label>
                <Input value={form.assigned_to || ''} onChange={e => setForm({ ...form, assigned_to: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Posebne zahteve</Label>
                <Textarea value={form.special_requests || ''} onChange={e => setForm({ ...form, special_requests: e.target.value })} rows={2} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Alergije / prehranske omejitve</Label>
                <Textarea value={form.allergies || ''} onChange={e => setForm({ ...form, allergies: e.target.value })} rows={2} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Interne opombe</Label>
                <Textarea value={form.internal_notes || ''} onChange={e => setForm({ ...form, internal_notes: e.target.value })} rows={2} />
              </div>
            </div>
            <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending || !form.contact_name || !form.contact_email || !form.group_size}
              className="w-full bg-[#1a5c38] hover:bg-[#154d2f]">
              Shrani poizvedbo
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Detail Panel */}
      {selected && (
        <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
          <SheetContent className="w-[520px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <span>{selected.contact_name}</span>
                <Badge variant="outline" className={`text-xs border ml-2 ${STATUS_COLORS[selected.status] || ''}`}>
                  {STATUS_LABELS[selected.status]}
                </Badge>
              </SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-5">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div><span className="text-gray-400">E-pošta:</span><p className="font-medium">{selected.contact_email}</p></div>
                <div><span className="text-gray-400">Telefon:</span><p className="font-medium">{selected.contact_phone || '—'}</p></div>
                <div><span className="text-gray-400">Agencija:</span><p className="font-medium">{selected.company_name || '—'}</p></div>
                <div><span className="text-gray-400">DDV:</span><p className="font-medium">{selected.company_vat_id || '—'}</p></div>
                <div><span className="text-gray-400">Doživetje:</span><p className="font-medium">{selected.experience_title || '—'}</p></div>
                <div><span className="text-gray-400">Skupina:</span><p className="font-medium">{selected.group_size} oseb</p></div>
                <div><span className="text-gray-400">Zahtevani datum:</span><p className="font-medium">{selected.requested_date || '—'} {selected.requested_time || ''}</p></div>
                <div><span className="text-gray-400">Fleksibilni datumi:</span><p className="font-medium">{selected.flexible_dates ? 'Da' : 'Ne'}</p></div>
                <div><span className="text-gray-400">Vir:</span><p className="font-medium">{SOURCE_LABELS[selected.source] || selected.source}</p></div>
                <div><span className="text-gray-400">Zadolžen:</span><p className="font-medium">{selected.assigned_to || '—'}</p></div>
                {selected.special_requests && <div className="col-span-2"><span className="text-gray-400">Posebne zahteve:</span><p className="font-medium">{selected.special_requests}</p></div>}
                {selected.allergies && <div className="col-span-2"><span className="text-gray-400">Alergije:</span><p className="font-medium">{selected.allergies}</p></div>}
              </div>

              {/* Timeline */}
              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Zgodovina</p>
                <div className="space-y-1 text-xs text-gray-500">
                  <div>📥 Prejeto: {selected.created_date ? format(new Date(selected.created_date), 'dd.MM.yyyy HH:mm') : '—'}</div>
                  <div>🔄 Zadnja posodobitev: {selected.updated_date ? format(new Date(selected.updated_date), 'dd.MM.yyyy HH:mm') : '—'}</div>
                </div>
              </div>

              {/* Internal note */}
              <div className="border-t pt-4 space-y-2">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Interna opomba</Label>
                <Textarea value={internalNote || selected.internal_notes || ''} onChange={e => setInternalNote(e.target.value)} rows={2} placeholder="Dodaj interno opombo..." />
                <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: selected.id, data: { internal_notes: internalNote || selected.internal_notes } })}>
                  Shrani opombo
                </Button>
              </div>

              {/* Actions */}
              <div className="border-t pt-4 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Akcije</p>
                {!['confirmed', 'declined'].includes(selected.status) && (
                  <Button className="w-full bg-[#1a5c38] hover:bg-[#154d2f]" size="sm"
                    onClick={() => createOfferMutation.mutate(selected)} disabled={createOfferMutation.isPending}>
                    📄 Ustvari ponudbo
                  </Button>
                )}
                {!['confirmed', 'declined'].includes(selected.status) && (
                  <Button className="w-full" size="sm" variant="default"
                    onClick={() => confirmMutation.mutate(selected)} disabled={confirmMutation.isPending}>
                    ✅ Označi kot potrjeno
                  </Button>
                )}
                <Button size="sm" variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => updateMutation.mutate({ id: selected.id, data: { status: 'declined' } })}>
                  ✗ Zavrni
                </Button>
              </div>

              {/* Status change */}
              <div className="border-t pt-4 space-y-1.5">
                <Label className="text-xs">Ročna sprememba statusa</Label>
                <Select value={selected.status} onValueChange={v => updateMutation.mutate({ id: selected.id, data: { status: v } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}