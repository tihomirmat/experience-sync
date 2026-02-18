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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, Building2 } from 'lucide-react';

export default function Companies() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({});

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies', tenantId],
    queryFn: () => base44.entities.Company.filter({ tenant_id: tenantId }, '-created_date'),
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing 
      ? base44.entities.Company.update(editing.id, data)
      : base44.entities.Company.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['companies'] }); setShowForm(false); setEditing(null); },
  });

  const openCreate = () => { setForm({ tenant_id: tenantId, payment_terms_days: 0 }); setEditing(null); setShowForm(true); };
  const openEdit = (c) => { setForm({...c}); setEditing(c); setShowForm(true); };

  const filtered = companies.filter(c =>
    !search || c.company_name?.toLowerCase().includes(search.toLowerCase()) || c.vat_id?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { header: 'Company', render: r => <span className="font-medium">{r.company_name}</span> },
    { header: 'VAT ID', key: 'vat_id' },
    { header: 'City', key: 'city' },
    { header: 'Contact', key: 'contact_email' },
    { header: 'Payment Terms', render: r => <span>{r.payment_terms_days || 0} days</span> },
  ];

  if (!tenantId) return null;

  return (
    <div>
      <PageHeader title="Companies" subtitle={`${companies.length} companies`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-56" />
        </div>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Add Company
        </Button>
      </PageHeader>

      {companies.length === 0 && !isLoading ? (
        <EmptyState icon={Building2} title="No companies" description="Add B2B companies for invoicing and partner management." actionLabel="Add Company" onAction={openCreate} />
      ) : (
        <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={openEdit} />
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Company' : 'New Company'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Company Name</Label>
                <Input value={form.company_name || ''} onChange={e => setForm({...form, company_name: e.target.value})} /></div>
              <div className="space-y-1.5"><Label>VAT ID</Label>
                <Input value={form.vat_id || ''} onChange={e => setForm({...form, vat_id: e.target.value})} placeholder="SI12345678" /></div>
            </div>
            <div className="space-y-1.5"><Label>Address</Label>
              <Input value={form.address_line1 || ''} onChange={e => setForm({...form, address_line1: e.target.value})} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label>City</Label>
                <Input value={form.city || ''} onChange={e => setForm({...form, city: e.target.value})} /></div>
              <div className="space-y-1.5"><Label>ZIP</Label>
                <Input value={form.zip || ''} onChange={e => setForm({...form, zip: e.target.value})} /></div>
              <div className="space-y-1.5"><Label>Country</Label>
                <Input value={form.country_code || ''} onChange={e => setForm({...form, country_code: e.target.value})} placeholder="SI" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Contact Email</Label>
                <Input value={form.contact_email || ''} onChange={e => setForm({...form, contact_email: e.target.value})} /></div>
              <div className="space-y-1.5"><Label>Payment Terms (days)</Label>
                <Input type="number" value={form.payment_terms_days || ''} onChange={e => setForm({...form, payment_terms_days: parseInt(e.target.value) || 0})} /></div>
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