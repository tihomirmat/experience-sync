import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '../components/shared/TenantContext';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, Code2, Clock, Plus, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

const emptyForm = { profile_name: '', format: 'canonical_json', field_map_json: '', transform_rules_json: '', notes: '', active: true, partner_id: '' };

export default function DmoFeeds() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const { data: partners = [] } = useQuery({
    queryKey: ['partners', tenantId],
    queryFn: () => base44.entities.Partner.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['dmo-logs', tenantId],
    queryFn: () => base44.entities.DmoSyncLog.filter({ tenant_id: tenantId }, '-created_date', 50),
    enabled: !!tenantId,
  });

  const { data: feedProfiles = [], isLoading: feedsLoading } = useQuery({
    queryKey: ['feed-profiles', tenantId],
    queryFn: () => base44.entities.PartnerFeedProfile.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editingId
      ? base44.entities.PartnerFeedProfile.update(editingId, data)
      : base44.entities.PartnerFeedProfile.create({ ...data, tenant_id: tenantId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed-profiles', tenantId] });
      setShowModal(false);
      setForm(emptyForm);
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PartnerFeedProfile.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feed-profiles', tenantId] }),
  });

  const openNew = () => { setForm(emptyForm); setEditingId(null); setShowModal(true); };
  const openEdit = (fp) => { setForm({ ...fp }); setEditingId(fp.id); setShowModal(true); };

  const activePartners = partners.filter(p => p.status === 'active');
  const baseUrl = window.location.origin;

  const logColumns = [
    { header: 'Partner', render: r => {
      const partner = partners.find(p => p.id === r.partner_id);
      return <span className="font-medium">{partner?.name || r.partner_id}</span>;
    }},
    { header: 'Endpoint', render: r => <Badge variant="outline" className="font-mono text-xs">{r.endpoint}</Badge> },
    { header: 'Status', render: r => (
      <Badge variant="outline" className={r.response_code < 400 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}>
        {r.response_code}
      </Badge>
    )},
    { header: 'Records', render: r => <span className="text-sm">{r.records_returned || 0}</span> },
    { header: 'Duration', render: r => <span className="text-sm text-gray-500">{r.duration_ms || 0}ms</span> },
    { header: 'Time', render: r => <span className="text-sm text-gray-500">{r.created_date ? format(new Date(r.created_date), 'MMM d, HH:mm') : '—'}</span> },
  ];

  if (!tenantId) return null;

  return (
    <div>
      <PageHeader
        title="DMO Feeds"
        subtitle="Public API endpoints for partner integration"
        actions={<Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> New Feed Profile</Button>}
      />

      {/* Endpoints Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {['listings', 'availability', 'pricing'].map(endpoint => (
          <Card key={endpoint} className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                  {endpoint === 'listings' ? <Globe className="w-4 h-4 text-blue-600" /> :
                   endpoint === 'availability' ? <Clock className="w-4 h-4 text-blue-600" /> :
                   <Code2 className="w-4 h-4 text-blue-600" />}
                </div>
                <div>
                  <p className="font-medium capitalize">{endpoint}</p>
                  <p className="text-xs text-gray-400">GET</p>
                </div>
              </div>
              <code className="text-xs bg-gray-50 rounded-md p-2 block break-all text-gray-600">
                /api/partners/{'{slug}'}/{endpoint}
              </code>
              <p className="text-xs text-gray-400 mt-2">
                Auth: <code className="text-gray-500">X-Partner-Key: {'<api_key>'}</code>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Partners */}
      <Card className="border-0 shadow-sm mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Active Partners ({activePartners.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {activePartners.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No active partners with API access</p>
          ) : (
            <div className="space-y-2">
              {activePartners.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-gray-400">Slug: {p.slug} · Type: {p.partner_type}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">{p.pricing_mode || 'gross'}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feed Profiles */}
      <Card className="border-0 shadow-sm mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Feed Profiles ({feedProfiles.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {feedProfiles.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No feed profiles yet. Click "New Feed Profile" to create one.</p>
          ) : (
            <div className="space-y-2">
              {feedProfiles.map(fp => {
                const partner = partners.find(p => p.id === fp.partner_id);
                return (
                  <div key={fp.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50">
                    <div>
                      <p className="text-sm font-medium">{fp.profile_name}</p>
                      <p className="text-xs text-gray-400">{partner?.name || fp.partner_id} · {fp.format}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={fp.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}>
                        {fp.active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(fp)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => deleteMutation.mutate(fp.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Access Logs */}
      <h3 className="text-base font-medium mb-4">Access Logs</h3>
      <DataTable columns={logColumns} data={logs} isLoading={logsLoading} emptyMessage="No API access logs yet" />

      {/* Create / Edit Modal */}
      <Dialog open={showModal} onOpenChange={v => { setShowModal(v); if (!v) { setForm(emptyForm); setEditingId(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Feed Profile' : 'New Feed Profile'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Profile Name *</Label>
              <Input value={form.profile_name} onChange={e => setForm({...form, profile_name: e.target.value})} placeholder="e.g. canonical-json" />
            </div>
            <div className="space-y-1.5">
              <Label>Partner *</Label>
              <Select value={form.partner_id} onValueChange={v => setForm({...form, partner_id: v})}>
                <SelectTrigger><SelectValue placeholder="Select partner" /></SelectTrigger>
                <SelectContent>
                  {partners.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Format</Label>
              <Select value={form.format} onValueChange={v => setForm({...form, format: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="canonical_json">Canonical JSON</SelectItem>
                  <SelectItem value="jabook_json">Jabook JSON</SelectItem>
                  <SelectItem value="jabook_xml">Jabook XML</SelectItem>
                  <SelectItem value="custom_json">Custom JSON</SelectItem>
                  <SelectItem value="custom_csv">Custom CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Field Map (JSON)</Label>
              <Textarea value={form.field_map_json} onChange={e => setForm({...form, field_map_json: e.target.value})} rows={3} placeholder='{"our_field": "their_field"}' className="font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label>Transform Rules (JSON)</Label>
              <Textarea value={form.transform_rules_json} onChange={e => setForm({...form, transform_rules_json: e.target.value})} rows={2} placeholder='{"lang": "en"}' className="font-mono text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.active} onCheckedChange={v => setForm({...form, active: v})} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.profile_name || !form.partner_id}>
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}