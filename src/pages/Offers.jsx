import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import StatusBadge from '../components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, FileDown } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function Offers() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [generating, setGenerating] = useState(null);

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ['offers'],
    queryFn: () => base44.entities.PrivateGroupOffer.list('-created_date', 200),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PrivateGroupOffer.create({
      ...data,
      total_price: (parseFloat(data.price_per_person) || 0) * (parseInt(data.group_size) || 1),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['offers'] }); setShowForm(false); setForm({}); },
  });

  const generatePdf = async (offer) => {
    setGenerating(offer.id);
    const res = await base44.functions.invoke('generatePrivateGroupOfferPdf', { offer_id: offer.id });
    setGenerating(null);
    if (res.data?.html) {
      const w = window.open('', '_blank');
      w.document.write(res.data.html);
      w.document.close();
    } else {
      toast({ title: 'Napaka pri generiranju PDF', variant: 'destructive' });
    }
  };

  const columns = [
    { header: 'Številka', render: r => <span className="font-mono font-medium">{r.offer_number || '—'}</span> },
    { header: 'Stranka', render: r => <div><p className="font-medium">{r.contact_name}</p><p className="text-xs text-gray-400">{r.contact_email}</p></div> },
    { header: 'Doživetje', render: r => <span>{r.experience_title || '—'}</span> },
    { header: 'Datum', render: r => <span>{r.event_date || '—'}</span> },
    { header: 'Skupaj', render: r => <span className="font-medium">€{(r.total_price || 0).toFixed(2)}</span> },
    { header: 'Veljavnost', render: r => <span className="text-gray-500">{r.valid_until || '—'}</span> },
    { header: 'Status', render: r => <StatusBadge status={r.status} /> },
    { header: '', render: r => (
      <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); generatePdf(r); }}
        disabled={generating === r.id} className="gap-1 text-xs h-7">
        <FileDown className="w-3 h-3" /> PDF
      </Button>
    )},
  ];

  return (
    <div>
      <PageHeader title="Ponudbe za zasebne skupine" subtitle={`${offers.length} ponudb`}>
        <Button onClick={() => { setForm({ status: 'draft', currency: 'EUR' }); setShowForm(true); }} size="sm" className="bg-[#1a5c38] hover:bg-[#134a2c] gap-2">
          <Plus className="w-4 h-4" /> Nova ponudba
        </Button>
      </PageHeader>

      <DataTable columns={columns} data={offers} isLoading={isLoading} />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova ponudba</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {[['offer_number', 'Številka ponudbe'], ['contact_name', 'Ime stranke *'], ['contact_email', 'Email stranke'], ['experience_title', 'Doživetje *']].map(([k, l]) => (
              <div key={k} className="space-y-1.5"><Label>{l}</Label><Input value={form[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })} /></div>
            ))}
            <div className="space-y-1.5"><Label>Datum eventi</Label><Input type="date" value={form.event_date || ''} onChange={e => setForm({ ...form, event_date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Veljavnost do</Label><Input type="date" value={form.valid_until || ''} onChange={e => setForm({ ...form, valid_until: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Število oseb</Label><Input type="number" value={form.group_size || ''} onChange={e => setForm({ ...form, group_size: parseInt(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label>Cena / oseba (€)</Label><Input type="number" step="0.01" value={form.price_per_person || ''} onChange={e => setForm({ ...form, price_per_person: parseFloat(e.target.value) })} /></div>
            <div className="col-span-2 space-y-1.5"><Label>Vključeno</Label><Textarea rows={2} value={form.includes || ''} onChange={e => setForm({ ...form, includes: e.target.value })} /></div>
            <div className="col-span-2 space-y-1.5"><Label>Ni vključeno</Label><Textarea rows={2} value={form.excludes || ''} onChange={e => setForm({ ...form, excludes: e.target.value })} /></div>
            <div className="col-span-2 space-y-1.5"><Label>Plačilni pogoji</Label><Textarea rows={2} value={form.payment_terms || ''} onChange={e => setForm({ ...form, payment_terms: e.target.value })} /></div>
            <div className="col-span-2 space-y-1.5"><Label>Opomba</Label><Textarea rows={2} value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Prekliči</Button>
            <Button className="bg-[#1a5c38] hover:bg-[#134a2c]" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>Ustvari</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}