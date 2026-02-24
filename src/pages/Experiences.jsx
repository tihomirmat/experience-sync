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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Map, Search, Clock, MapPin, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export default function Experiences() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

  const { data: experiences = [], isLoading } = useQuery({
    queryKey: ['experiences', tenantId],
    queryFn: () => base44.entities.Experience.filter({ tenant_id: tenantId }, '-created_date'),
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Experience.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['experiences'] }); setShowForm(false); setEditing(null); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Experience.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['experiences'] }); setShowForm(false); setEditing(null); },
  });

  const [form, setForm] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Experience.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['experiences'] }); setDeleteTarget(null); },
  });

  const openCreate = () => {
    setForm({ tenant_id: tenantId, status: 'active', currency: 'EUR' });
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (exp) => {
    setForm({ ...exp });
    setEditing(exp);
    setShowForm(true);
  };

  const handleSave = () => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const filtered = experiences.filter(e => 
    !search || e.title_en?.toLowerCase().includes(search.toLowerCase()) || e.title_sl?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { header: 'Experience', render: (row) => (
      <div>
        <p className="font-medium text-gray-900">{row.title_en || row.title_sl}</p>
        {row.title_sl && row.title_en && <p className="text-xs text-gray-400">{row.title_sl}</p>}
      </div>
    )},
    { header: 'Duration', render: (row) => (
      <div className="flex items-center gap-1.5 text-gray-500">
        <Clock className="w-3.5 h-3.5" />
        <span>{row.duration_minutes || '—'}min</span>
      </div>
    )},
    { header: 'Price From', render: (row) => (
      <span className="font-medium">€{(row.base_price_from || 0).toFixed(2)}</span>
    )},
    { header: 'Location', render: (row) => (
      <div className="flex items-center gap-1.5 text-gray-500">
        <MapPin className="w-3.5 h-3.5" />
        <span className="truncate max-w-[150px]">{row.meeting_point_name || '—'}</span>
      </div>
    )},
    { header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { header: '', render: (row) => (
      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
        onClick={e => { e.stopPropagation(); setDeleteTarget(row); }}>
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    )},
  ];

  if (!tenantId) return null;

  return (
    <div>
      <PageHeader title="Experiences" subtitle={`${experiences.length} experiences`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-56" />
        </div>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Add Experience
        </Button>
      </PageHeader>

      {experiences.length === 0 && !isLoading ? (
        <EmptyState icon={Map} title="No experiences yet" description="Add your first experience or sync from your distribution hub." actionLabel="Add Experience" onAction={openCreate} />
      ) : (
        <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={openEdit} />
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Experience' : 'New Experience'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {/* Titles */}
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <Label>Title (EN) *</Label>
              <Input value={form.title_en || ''} onChange={e => setForm({...form, title_en: e.target.value})} />
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <Label>Title (SL)</Label>
              <Input value={form.title_sl || ''} onChange={e => setForm({...form, title_sl: e.target.value})} />
            </div>

            {/* Short Descriptions */}
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <Label>Short Description (EN)</Label>
              <Textarea value={form.short_description_en || ''} onChange={e => setForm({...form, short_description_en: e.target.value})} rows={2} />
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <Label>Short Description (SL)</Label>
              <Textarea value={form.short_description_sl || ''} onChange={e => setForm({...form, short_description_sl: e.target.value})} rows={2} />
            </div>

            {/* Full Descriptions */}
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <Label>Full Description (EN)</Label>
              <Textarea value={form.full_description_en || ''} onChange={e => setForm({...form, full_description_en: e.target.value})} rows={3} />
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <Label>Full Description (SL)</Label>
              <Textarea value={form.full_description_sl || ''} onChange={e => setForm({...form, full_description_sl: e.target.value})} rows={3} />
            </div>

            {/* Core fields */}
            <div className="space-y-1.5">
              <Label>Duration (min)</Label>
              <Input type="number" value={form.duration_minutes || ''} onChange={e => setForm({...form, duration_minutes: parseInt(e.target.value) || 0})} />
            </div>
            <div className="space-y-1.5">
              <Label>Base Price (€)</Label>
              <Input type="number" step="0.01" value={form.base_price_from || ''} onChange={e => setForm({...form, base_price_from: parseFloat(e.target.value) || 0})} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status || 'active'} onValueChange={v => setForm({...form, status: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Input value={form.currency || 'EUR'} onChange={e => setForm({...form, currency: e.target.value})} />
            </div>

            {/* Meeting Point */}
            <div className="space-y-1.5">
              <Label>Meeting Point Name</Label>
              <Input value={form.meeting_point_name || ''} onChange={e => setForm({...form, meeting_point_name: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label>Meeting Point Address</Label>
              <Input value={form.meeting_point_address || ''} onChange={e => setForm({...form, meeting_point_address: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label>Latitude</Label>
              <Input type="number" step="any" value={form.meeting_point_lat || ''} onChange={e => setForm({...form, meeting_point_lat: parseFloat(e.target.value) || null})} />
            </div>
            <div className="space-y-1.5">
              <Label>Longitude</Label>
              <Input type="number" step="any" value={form.meeting_point_lng || ''} onChange={e => setForm({...form, meeting_point_lng: parseFloat(e.target.value) || null})} />
            </div>

            {/* Booking URL */}
            <div className="col-span-2 space-y-1.5">
              <Label>Booking URL (direct)</Label>
              <Input value={form.booking_url_direct || ''} onChange={e => setForm({...form, booking_url_direct: e.target.value})} placeholder="https://..." />
            </div>

            {/* Includes / Excludes */}
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <Label>Includes (EN)</Label>
              <Textarea value={form.includes_en || ''} onChange={e => setForm({...form, includes_en: e.target.value})} rows={2} />
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <Label>Includes (SL)</Label>
              <Textarea value={form.includes_sl || ''} onChange={e => setForm({...form, includes_sl: e.target.value})} rows={2} />
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <Label>Excludes (EN)</Label>
              <Textarea value={form.excludes_en || ''} onChange={e => setForm({...form, excludes_en: e.target.value})} rows={2} />
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <Label>Excludes (SL)</Label>
              <Textarea value={form.excludes_sl || ''} onChange={e => setForm({...form, excludes_sl: e.target.value})} rows={2} />
            </div>

            {/* Cancellation Policy */}
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <Label>Cancellation Policy (EN)</Label>
              <Textarea value={form.cancellation_policy_en || ''} onChange={e => setForm({...form, cancellation_policy_en: e.target.value})} rows={2} />
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <Label>Cancellation Policy (SL)</Label>
              <Textarea value={form.cancellation_policy_sl || ''} onChange={e => setForm({...form, cancellation_policy_sl: e.target.value})} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Izbriši Experience</AlertDialogTitle>
            <AlertDialogDescription>
              Ali ste prepričani, da želite izbrisati "{deleteTarget?.title_en || deleteTarget?.title_sl}"? To dejanje je nepopravljivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Prekliči</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteMutation.mutate(deleteTarget.id)}>
              Izbriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}