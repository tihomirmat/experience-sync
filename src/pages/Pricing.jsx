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
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';

const TYPES = ['seasonal', 'early_bird', 'last_minute', 'group_discount', 'promo_code'];

export default function Pricing() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['pricing'],
    queryFn: () => base44.entities.PricingRule.list('-created_date', 200),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PricingRule.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pricing'] }); setShowForm(false); setForm({}); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }) => base44.entities.PricingRule.update(id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricing'] }),
  });

  const TYPE_LABELS = { seasonal: 'Sezonsko', early_bird: 'Zgodnja rezervacija', last_minute: 'Last minute', group_discount: 'Skupinski', promo_code: 'Promo koda' };

  const columns = [
    { header: 'Naziv', render: r => <span className="font-medium">{r.name}</span> },
    { header: 'Tip', render: r => <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{TYPE_LABELS[r.type] || r.type}</span> },
    { header: 'Popust', render: r => <span className="font-medium">{r.discount_value}{r.discount_type === 'percent' ? '%' : '€'}</span> },
    { header: 'Promo koda', render: r => <span className="font-mono text-xs">{r.promo_code || '—'}</span> },
    { header: 'Veljavnost', render: r => <span className="text-gray-500 text-xs">{r.valid_from} – {r.valid_to}</span> },
    { header: 'Aktivno', render: r => (
      <Switch checked={r.active !== false} onCheckedChange={v => toggleMutation.mutate({ id: r.id, active: v })}
        onClick={e => e.stopPropagation()} />
    )},
  ];

  return (
    <div>
      <PageHeader title="Cenovni pravilnik" subtitle={`${rules.length} pravil`}>
        <Button onClick={() => { setForm({ active: true, discount_type: 'percent', type: 'seasonal' }); setShowForm(true); }} size="sm" className="bg-[#1a5c38] hover:bg-[#134a2c] gap-2">
          <Plus className="w-4 h-4" /> Novo pravilo
        </Button>
      </PageHeader>

      <DataTable columns={columns} data={rules} isLoading={isLoading} />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo cenovno pravilo</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5"><Label>Naziv *</Label><Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Tip</Label>
              <Select value={form.type || 'seasonal'} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tip popusta</Label>
              <Select value={form.discount_type || 'percent'} onValueChange={v => setForm({ ...form, discount_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="percent">Odstotek (%)</SelectItem><SelectItem value="fixed">Fiksni (€)</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Vrednost popusta</Label><Input type="number" value={form.discount_value || ''} onChange={e => setForm({ ...form, discount_value: parseFloat(e.target.value) })} /></div>
            {form.type === 'promo_code' && <div className="space-y-1.5"><Label>Promo koda</Label><Input value={form.promo_code || ''} onChange={e => setForm({ ...form, promo_code: e.target.value })} /></div>}
            <div className="space-y-1.5"><Label>Min. oseb</Label><Input type="number" value={form.min_pax || ''} onChange={e => setForm({ ...form, min_pax: parseInt(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label>Veljavnost od</Label><Input type="date" value={form.valid_from || ''} onChange={e => setForm({ ...form, valid_from: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Veljavnost do</Label><Input type="date" value={form.valid_to || ''} onChange={e => setForm({ ...form, valid_to: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Prekliči</Button>
            <Button className="bg-[#1a5c38] hover:bg-[#134a2c]" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>Shrani</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}