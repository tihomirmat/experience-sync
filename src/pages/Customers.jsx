import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '../components/shared/TenantContext';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import EmptyState from '../components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, Users, Mail, Phone } from 'lucide-react';

export default function Customers() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({});

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers', tenantId],
    queryFn: () => base44.entities.Customer.filter({ tenant_id: tenantId }, '-created_date'),
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing 
      ? base44.entities.Customer.update(editing.id, data)
      : base44.entities.Customer.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); setShowForm(false); setEditing(null); },
  });

  const openCreate = () => { setForm({ tenant_id: tenantId }); setEditing(null); setShowForm(true); };
  const openEdit = (c) => { setForm({...c}); setEditing(c); setShowForm(true); };

  const filtered = customers.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { header: 'Name', render: r => <span className="font-medium">{r.name}</span> },
    { header: 'Email', render: r => (
      <div className="flex items-center gap-1.5 text-gray-500">
        {r.email && <Mail className="w-3.5 h-3.5" />}
        <span className="text-sm">{r.email || '—'}</span>
      </div>
    )},
    { header: 'Phone', render: r => (
      <div className="flex items-center gap-1.5 text-gray-500">
        {r.phone && <Phone className="w-3.5 h-3.5" />}
        <span className="text-sm">{r.phone || '—'}</span>
      </div>
    )},
    { header: 'Bookings', render: r => <span className="text-sm">{r.total_bookings || 0}</span> },
    { header: 'Revenue', render: r => <span className="font-medium">€{(r.total_revenue || 0).toFixed(2)}</span> },
  ];

  if (!tenantId) return null;

  return (
    <div>
      <PageHeader title="Customers" subtitle={`${customers.length} customers`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-56" />
        </div>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Add Customer
        </Button>
      </PageHeader>

      {customers.length === 0 && !isLoading ? (
        <EmptyState icon={Users} title="No customers" description="Customers are created from bookings or added manually." actionLabel="Add Customer" onAction={openCreate} />
      ) : (
        <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={openEdit} />
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Customer' : 'New Customer'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Name</Label>
              <Input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Email</Label>
                <Input value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} /></div>
              <div className="space-y-1.5"><Label>Phone</Label>
                <Input value={form.phone || ''} onChange={e => setForm({...form, phone: e.target.value})} /></div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.marketing_opt_in || false} onCheckedChange={v => setForm({...form, marketing_opt_in: v})} />
              <Label>Marketing opt-in</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}