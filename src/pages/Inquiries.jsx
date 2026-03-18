import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import StatusBadge from '../components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Plus } from 'lucide-react';

const STATUSES = ['new', 'in_negotiation', 'offer_sent', 'confirmed', 'declined'];

export default function Inquiries() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});

  const { data: inquiries = [], isLoading } = useQuery({
    queryKey: ['inquiries'],
    queryFn: () => base44.entities.PrivateGroupInquiry.list('-created_date', 200),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PrivateGroupInquiry.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inquiries'] }); setShowForm(false); setForm({}); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PrivateGroupInquiry.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inquiries'] }); setSelected(s => ({ ...s, ...form })); },
  });

  const filtered = inquiries.filter(i => filterStatus === 'all' || i.status === filterStatus);

  const columns = [
    { header: 'Kontakt', render: r => <div><p className="font-medium text-gray-900">{r.contact_name}</p><p className="text-xs text-gray-400">{r.contact_email}</p></div> },
    { header: 'Doživetje', render: r => <span>{r.experience_title || '—'}</span> },
    { header: 'Datum', render: r => <span>{r.requested_date || '—'}</span> },
    { header: 'Skupina', render: r => <span>{r.group_size || '—'} os.</span> },
    { header: 'Status', render: r => <StatusBadge status={r.status} /> },
    { header: 'Vir', render: r => <span className="text-gray-500 text-xs">{r.source || '—'}</span> },
  ];

  return (
    <div>
      <PageHeader title="Zasebne poizvedbe" subtitle={`${filtered.length} poizvedb`}>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vsi statusi</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => { setForm({}); setShowForm(true); }} size="sm" className="bg-[#1a5c38] hover:bg-[#134a2c] gap-2">
          <Plus className="w-4 h-4" /> Nova poizvedba
        </Button>
      </PageHeader>

      <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={r => { setSelected(r); setForm({ ...r }); }} />

      {/* Create dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova zasebna poizvedba</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {[['contact_name', 'Ime in priimek *'], ['contact_email', 'Email *'], ['contact_phone', 'Telefon'], ['experience_title', 'Doživetje']].map(([k, l]) => (
              <div key={k} className="space-y-1.5">
                <Label>{l}</Label>
                <Input value={form[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })} />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label>Datum</Label>
              <Input type="date" value={form.requested_date || ''} onChange={e => setForm({ ...form, requested_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Število oseb</Label>
              <Input type="number" value={form.group_size || ''} onChange={e => setForm({ ...form, group_size: parseInt(e.target.value) })} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Opombe</Label>
              <Input value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Prekliči</Button>
            <Button className="bg-[#1a5c38] hover:bg-[#134a2c]" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>Shrani</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail sheet */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-[400px] overflow-y-auto">
          <SheetHeader><SheetTitle>Poizvedba</SheetTitle></SheetHeader>
          {selected && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Ime', selected.contact_name], ['Email', selected.contact_email],
                  ['Tel', selected.contact_phone], ['Doživetje', selected.experience_title],
                  ['Datum', selected.requested_date], ['Skupina', selected.group_size ? `${selected.group_size} os.` : '—'],
                  ['Vir', selected.source],
                ].map(([k, v]) => (
                  <div key={k}><p className="text-xs text-gray-400">{k}</p><p className="font-medium">{v || '—'}</p></div>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status || selected.status} onValueChange={v => {
                  setForm({ ...form, status: v });
                  updateMutation.mutate({ id: selected.id, data: { status: v } });
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {selected.notes && <div><p className="text-xs text-gray-400">Opomba</p><p className="text-sm">{selected.notes}</p></div>}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}