import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '../components/shared/TenantContext';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import StatusBadge from '../components/shared/StatusBadge';
import EmptyState from '../components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Handshake, Copy, Key, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function Partners() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [form, setForm] = useState({});
  const [generatedKey, setGeneratedKey] = useState(null);

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ['partners', tenantId],
    queryFn: () => base44.entities.Partner.filter({ tenant_id: tenantId }, '-created_date'),
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (!editing) {
        // Generate API key on create
        const key = 'pk_' + crypto.randomUUID().replace(/-/g, '');
        const slug = data.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '') || 'partner';
        const result = await base44.entities.Partner.create({ ...data, api_key: key, api_key_hash: key, slug });
        setGeneratedKey(key);
        return result;
      }
      return base44.entities.Partner.update(editing.id, data);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['partners'] }); if (editing) { setShowForm(false); setEditing(null); } },
  });

  const openCreate = () => {
    setForm({ tenant_id: tenantId, partner_type: 'dmo', status: 'active', pricing_mode: 'gross', payment_terms_days: 0 });
    setEditing(null); setGeneratedKey(null); setShowForm(true);
  };

  const openEdit = (p) => { setForm({...p}); setEditing(p); setGeneratedKey(null); setShowForm(true); };

  const filtered = partners.filter(p => {
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || p.partner_type === typeFilter;
    return matchSearch && matchType;
  });

  const TYPE_COLORS = { dmo: 'bg-blue-50 text-blue-700 border-blue-200', hotel: 'bg-purple-50 text-purple-700 border-purple-200', agency: 'bg-amber-50 text-amber-700 border-amber-200', reseller: 'bg-gray-50 text-gray-600 border-gray-200' };

  const columns = [
    { header: 'Partner', render: r => (
      <div>
        <p className="font-medium">{r.name}</p>
        <p className="text-xs text-gray-400">{r.slug}</p>
      </div>
    )},
    { header: 'Tip', render: r => <Badge variant="outline" className={`capitalize text-xs border ${TYPE_COLORS[r.partner_type] || ''}`}>{r.partner_type}</Badge> },
    { header: 'Pricing', render: r => <span className="capitalize text-sm">{r.pricing_mode || 'gross'}</span> },
    { header: 'Commission', render: r => <span className="text-sm">{r.commission_rate ? `${(r.commission_rate * 100).toFixed(0)}%` : '—'}</span> },
    { header: 'Status', render: r => <StatusBadge status={r.status} /> },
    { header: '', render: r => r.partner_type === 'agency' ? (
      <Link to={`/Groups?company=${encodeURIComponent(r.name)}`} onClick={e => e.stopPropagation()}
        className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
        <ExternalLink className="w-3 h-3" /> Poizvedbe
      </Link>
    ) : null },
  ];

  if (!tenantId) return null;

  return (
    <div>
      <PageHeader title="Partners & DMO" subtitle="Manage distribution partners and API access">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-56" />
        </div>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Add Partner
        </Button>
      </PageHeader>

      {partners.length === 0 && !isLoading ? (
        <EmptyState icon={Handshake} title="No partners" description="Add DMOs, hotels, and agencies for distribution and pricing." actionLabel="Add Partner" onAction={openCreate} />
      ) : (
        <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={openEdit} />
      )}

      <Dialog open={showForm} onOpenChange={(v) => { if (!v) { setGeneratedKey(null); } setShowForm(v); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Partner' : 'New Partner'}</DialogTitle></DialogHeader>

          {generatedKey ? (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="w-4 h-4 text-emerald-600" />
                  <p className="text-sm font-medium text-emerald-700">API Key Generated</p>
                </div>
                <p className="text-xs text-emerald-600 mb-3">Save this key now — it won't be shown again.</p>
                <div className="flex items-center gap-2 bg-white rounded-md border p-2">
                  <code className="text-xs flex-1 break-all">{generatedKey}</code>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { navigator.clipboard.writeText(generatedKey); toast.success('Copied!'); }}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => { setShowForm(false); setGeneratedKey(null); }}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>Name</Label>
                    <Input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} /></div>
                  <div className="space-y-1.5"><Label>Type</Label>
                    <Select value={form.partner_type || 'dmo'} onValueChange={v => setForm({...form, partner_type: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dmo">DMO</SelectItem>
                        <SelectItem value="hotel">Hotel</SelectItem>
                        <SelectItem value="agency">Agency</SelectItem>
                        <SelectItem value="reseller">Reseller</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>Pricing Mode</Label>
                    <Select value={form.pricing_mode || 'gross'} onValueChange={v => setForm({...form, pricing_mode: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gross">Gross</SelectItem>
                        <SelectItem value="net">Net</SelectItem>
                        <SelectItem value="discount">Discount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Commission Rate (%)</Label>
                    <Input type="number" step="1" value={form.commission_rate ? (form.commission_rate * 100).toFixed(0) : ''} onChange={e => setForm({...form, commission_rate: (parseFloat(e.target.value) || 0) / 100})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>Contact Email</Label>
                    <Input value={form.contact_email || ''} onChange={e => setForm({...form, contact_email: e.target.value})} /></div>
                  <div className="space-y-1.5"><Label>Contact Name</Label>
                    <Input value={form.contact_name || ''} onChange={e => setForm({...form, contact_name: e.target.value})} /></div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
                  {editing ? 'Update' : 'Create Partner'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}