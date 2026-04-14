import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Plus, Key, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const TYPE_LABELS = { dmo: 'DMO', hotel: 'Hotel', agency: 'Agency', reseller: 'Reseller' };
const TYPE_COLORS = { dmo: 'bg-purple-100 text-purple-700', hotel: 'bg-blue-100 text-blue-700', agency: 'bg-amber-100 text-amber-700', reseller: 'bg-gray-100 text-gray-600' };

export default function LocalPartnersTable({ tenantId }) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [newApiKey, setNewApiKey] = useState(null);
  const [form, setForm] = useState({ tenant_id: tenantId, partner_type: 'hotel', status: 'active', pricing_mode: 'gross', payment_terms_days: 30, commission_rate: 0 });

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ['partners', tenantId],
    queryFn: () => base44.entities.Partner.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });

  const { data: experiences = [] } = useQuery({
    queryKey: ['experiences', tenantId],
    queryFn: () => base44.entities.Experience.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Partner.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['partners'] }); setAddOpen(false); toast.success('Partner added'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Partner.update(id, data),
    onSuccess: (updated) => { queryClient.invalidateQueries({ queryKey: ['partners'] }); setSelectedPartner(updated); toast.success('Saved'); },
  });

  const generateApiKey = async (partner) => {
    const raw = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const key = `pk_${raw.slice(0, 32)}`;
    await base44.entities.Partner.update(partner.id, { api_key: key });
    queryClient.invalidateQueries({ queryKey: ['partners'] });
    setNewApiKey(key);
    toast.success('API key generated — copy it now, it won\'t be shown again');
  };

  const feedUrl = (p) => `https://experience-sync-pro.base44.app/api/partner-feed/${p.slug || p.id}`;

  const toggleExperience = (expId) => {
    const current = selectedPartner.allowed_experience_ids || [];
    const updated = current.includes(expId) ? current.filter(id => id !== expId) : [...current, expId];
    setSelectedPartner(p => ({ ...p, allowed_experience_ids: updated }));
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" className="gap-2 bg-[#1a5c38] hover:bg-[#154d2f]" onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4" /> Add Partner
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              {['Name', 'Type', 'Status', 'Commission', 'API Key', 'Feed URL', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && [...Array(3)].map((_, i) => (
              <tr key={i} className="border-b border-gray-50">
                {[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}
              </tr>
            ))}
            {!isLoading && partners.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No local partners yet</td></tr>
            )}
            {!isLoading && partners.map(p => (
              <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => { setSelectedPartner(p); setNewApiKey(null); setProfileOpen(true); }}>
                <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={`text-xs ${TYPE_COLORS[p.partner_type] || ''}`}>{TYPE_LABELS[p.partner_type] || p.partner_type}</Badge>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${p.status === 'active' ? 'text-emerald-600' : 'text-gray-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'active' ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{p.commission_rate ? `${(p.commission_rate * 100).toFixed(0)}%` : '—'}</td>
                <td className="px-4 py-3">
                  {p.api_key
                    ? <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">✓ Generated</Badge>
                    : <Badge variant="outline" className="text-xs bg-gray-50 text-gray-400">Not set</Badge>
                  }
                </td>
                <td className="px-4 py-3">
                  {p.slug && (
                    <a href={feedUrl(p)} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <ExternalLink className="w-3 h-3" /> Feed
                    </a>
                  )}
                </td>
                <td className="px-4 py-3">
                  {!p.api_key && (
                    <Button size="sm" variant="outline" className="text-xs gap-1 h-7"
                      onClick={(e) => { e.stopPropagation(); generateApiKey(p); }}>
                      <Key className="w-3 h-3" /> Generate Key
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New API key display */}
      {newApiKey && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs font-semibold text-amber-700 mb-1">⚠️ Copy this key now — it won't be shown again</p>
            <code className="text-xs text-gray-800 break-all">{newApiKey}</code>
          </div>
          <Button size="sm" variant="outline" className="shrink-0 gap-1 text-xs" onClick={() => { navigator.clipboard.writeText(newApiKey); toast.success('Copied'); }}>
            <Copy className="w-3 h-3" /> Copy
          </Button>
        </div>
      )}

      {/* Add Partner Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Local Partner</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5"><Label>Name</Label>
                <Input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Hotel Triglav" /></div>
              <div className="space-y-1.5"><Label>Type</Label>
                <Select value={form.partner_type} onValueChange={v => setForm(f => ({ ...f, partner_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hotel">Hotel</SelectItem>
                    <SelectItem value="agency">Agency</SelectItem>
                    <SelectItem value="dmo">DMO</SelectItem>
                    <SelectItem value="reseller">Reseller</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Commission (%)</Label>
                <Input type="number" step="0.5" value={form.commission_rate != null ? (form.commission_rate * 100).toFixed(0) : ''} onChange={e => setForm(f => ({ ...f, commission_rate: (parseFloat(e.target.value) || 0) / 100 }))} /></div>
              <div className="space-y-1.5"><Label>Contact Name</Label>
                <Input value={form.contact_name || ''} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Contact Email</Label>
                <Input value={form.contact_email || ''} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Pricing Mode</Label>
                <Select value={form.pricing_mode} onValueChange={v => setForm(f => ({ ...f, pricing_mode: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gross">Gross</SelectItem>
                    <SelectItem value="net">Net</SelectItem>
                    <SelectItem value="discount">Discount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Payment Terms (days)</Label>
                <Input type="number" value={form.payment_terms_days || 30} onChange={e => setForm(f => ({ ...f, payment_terms_days: parseInt(e.target.value) || 0 }))} /></div>
              <div className="col-span-2 space-y-1.5"><Label>Slug (URL identifier)</Label>
                <Input value={form.slug || ''} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))} placeholder="hotel-triglav" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button className="bg-[#1a5c38] hover:bg-[#154d2f]" onClick={() => createMutation.mutate({ ...form, tenant_id: tenantId })} disabled={!form.name || createMutation.isPending}>
              Add Partner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Partner Profile Sheet */}
      {selectedPartner && (
        <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
          <SheetContent className="w-[520px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{selectedPartner.name}</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-5">
              {/* Contact */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-xs">Contact Name</Label>
                  <Input value={selectedPartner.contact_name || ''} onChange={e => setSelectedPartner(p => ({ ...p, contact_name: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Contact Email</Label>
                  <Input value={selectedPartner.contact_email || ''} onChange={e => setSelectedPartner(p => ({ ...p, contact_email: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Commission (%)</Label>
                  <Input type="number" value={selectedPartner.commission_rate != null ? (selectedPartner.commission_rate * 100).toFixed(0) : ''} onChange={e => setSelectedPartner(p => ({ ...p, commission_rate: (parseFloat(e.target.value) || 0) / 100 }))} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Pricing Mode</Label>
                  <Select value={selectedPartner.pricing_mode || 'gross'} onValueChange={v => setSelectedPartner(p => ({ ...p, pricing_mode: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gross">Gross</SelectItem>
                      <SelectItem value="net">Net</SelectItem>
                      <SelectItem value="discount">Discount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label className="text-xs">Payment Terms (days)</Label>
                  <Input type="number" value={selectedPartner.payment_terms_days || 0} onChange={e => setSelectedPartner(p => ({ ...p, payment_terms_days: parseInt(e.target.value) || 0 }))} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Status</Label>
                  <Select value={selectedPartner.status || 'active'} onValueChange={v => setSelectedPartner(p => ({ ...p, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="disabled">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Allowed Experiences */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Allowed Experiences</Label>
                <div className="border rounded-lg divide-y divide-gray-50 max-h-48 overflow-y-auto">
                  {experiences.length === 0 && <p className="px-3 py-2 text-xs text-gray-400">No experiences found</p>}
                  {experiences.map(exp => {
                    const allowed = (selectedPartner.allowed_experience_ids || []).includes(exp.id);
                    return (
                      <label key={exp.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                        <input type="checkbox" checked={allowed} onChange={() => toggleExperience(exp.id)} className="rounded" />
                        <span className="text-sm text-gray-700">{exp.title_en || exp.title_sl}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Feed URL */}
              {selectedPartner.slug && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Custom Feed URL</Label>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg border p-2">
                    <code className="text-xs text-gray-700 flex-1 truncate">{feedUrl(selectedPartner)}</code>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { navigator.clipboard.writeText(feedUrl(selectedPartner)); toast.success('Copied'); }}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}

              {/* API Key */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">API Access</Label>
                {selectedPartner.api_key
                  ? <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-700">✅ API key is set (hidden for security)</div>
                  : <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => generateApiKey(selectedPartner)}>
                      <Key className="w-3 h-3" /> Generate API Key
                    </Button>
                }
              </div>

              <Button className="w-full bg-[#1a5c38] hover:bg-[#154d2f]" size="sm"
                onClick={() => updateMutation.mutate({ id: selectedPartner.id, data: selectedPartner })}
                disabled={updateMutation.isPending}>
                Save Changes
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}