import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '../components/shared/TenantContext';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Settings, Building2, Link2, Mail, FileText, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import ProviderConnectionCard from '../components/invoicing/ProviderConnectionCard';

export default function IntegrationSettings() {
  const { currentTenant, tenants, refreshTenants } = useTenant();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();
  const [showTenantForm, setShowTenantForm] = useState(false);
  const [tenantForm, setTenantForm] = useState({});

  const { data: hubConnections = [] } = useQuery({
    queryKey: ['hub-connections', tenantId],
    queryFn: () => base44.entities.HubConnection.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });

  const [hubForm, setHubForm] = useState({ hub_type: 'bokun', status: 'active' });
  const [invoiceSettings, setInvoiceSettings] = useState({});
  const [defaultProvider, setDefaultProvider] = useState(null);

  const { data: invoicingConnections = [], refetch: refetchConnections } = useQuery({
    queryKey: ['invoicing-connections', tenantId],
    queryFn: () => base44.entities.InvoicingConnection.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
    onSuccess: (data) => {
      const def = data.find(c => c.is_default);
      if (def) setDefaultProvider(def.provider_id);
    },
  });

  const handleSetDefault = async (providerId) => {
    setDefaultProvider(providerId);
    for (const conn of invoicingConnections) {
      await base44.entities.InvoicingConnection.update(conn.id, { is_default: conn.provider_id === providerId });
    }
    refetchConnections();
    toast.success(`${providerId === 'quibi' ? 'Quibi' : 'Čebelca'} set as default provider`);
  };

  useEffect(() => {
    if (currentTenant) {
      setInvoiceSettings({
        invoice_prefix: currentTenant.invoice_prefix || '',
        default_vat_rate: currentTenant.default_vat_rate || 0.095,
        vat_mode: currentTenant.vat_mode || 'included',
        default_currency: currentTenant.default_currency || 'EUR',
        timezone: currentTenant.timezone || 'Europe/Ljubljana',
      });
    }
  }, [currentTenant]);

  const createTenantMutation = useMutation({
    mutationFn: async (data) => {
      const tenant = await base44.entities.Tenant.create(data);
      const user = await base44.auth.me();
      await base44.entities.UserTenantRole.create({
        tenant_id: tenant.id, user_id: user.id, user_email: user.email, user_name: user.full_name, role: 'owner'
      });
      return tenant;
    },
    onSuccess: () => {
      refreshTenants();
      setShowTenantForm(false);
      toast.success('Company created');
    },
  });

  const updateTenantMutation = useMutation({
    mutationFn: (data) => base44.entities.Tenant.update(tenantId, data),
    onSuccess: () => { refreshTenants(); toast.success('Settings saved'); },
  });

  const saveHubMutation = useMutation({
    mutationFn: (data) => {
      const existing = hubConnections.find(h => h.hub_type === data.hub_type);
      if (existing) return base44.entities.HubConnection.update(existing.id, data);
      return base44.entities.HubConnection.create({ ...data, tenant_id: tenantId });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hub-connections'] }); toast.success('Hub connection saved'); },
  });

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage company, integrations, and invoicing" />

      {/* No Company State */}
      {!currentTenant && (
        <Card className="border-0 shadow-sm max-w-lg mx-auto mt-12">
          <CardContent className="p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-7 h-7 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Create Your First Company</h3>
            <p className="text-sm text-gray-500 mb-6">Set up your tour operator company to get started.</p>
            <Button onClick={() => { setTenantForm({ status: 'active', default_currency: 'EUR', timezone: 'Europe/Ljubljana', vat_mode: 'included', default_vat_rate: 0.095, languages_enabled: ['sl', 'en', 'de', 'hr'] }); setShowTenantForm(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Create Company
            </Button>
          </CardContent>
        </Card>
      )}

      {currentTenant && (
        <Tabs defaultValue="company">
          <TabsList className="bg-gray-100/70 mb-6">
            <TabsTrigger value="company">Company</TabsTrigger>
            <TabsTrigger value="hub">Hub Connection</TabsTrigger>
            <TabsTrigger value="invoicing">Invoicing</TabsTrigger>
            <TabsTrigger value="providers">Invoicing Providers</TabsTrigger>
          </TabsList>

          {/* Company Settings */}
          <TabsContent value="company">
            <Card className="border-0 shadow-sm max-w-2xl">
              <CardHeader>
                <CardTitle className="text-base">Company Details</CardTitle>
                <CardDescription>Your tour operator company information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>Company Name</Label>
                    <Input value={currentTenant.name || ''} disabled /></div>
                  <div className="space-y-1.5"><Label>Country</Label>
                    <Input value={currentTenant.country_code || ''} disabled /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>VAT ID</Label>
                    <Input value={currentTenant.vat_id || ''} disabled /></div>
                  <div className="space-y-1.5"><Label>Timezone</Label>
                    <Input value={currentTenant.timezone || 'Europe/Ljubljana'} disabled /></div>
                </div>
                <p className="text-xs text-gray-400">Contact support to update core company fields.</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Hub Connection */}
          <TabsContent value="hub">
            <Card className="border-0 shadow-sm max-w-2xl">
              <CardHeader>
                <CardTitle className="text-base">Distribution Hub</CardTitle>
                <CardDescription>Connect to Bókun or FareHarbor for booking and availability sync</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {hubConnections.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    {hubConnections.map(h => (
                      <div key={h.id} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium capitalize">{h.hub_type}</p>
                          <p className="text-xs text-gray-400">Last sync: {h.last_sync_at || 'Never'}</p>
                        </div>
                        <StatusBadge status={h.status} />
                      </div>
                    ))}
                  </div>
                )}
                <div className="space-y-1.5"><Label>Hub Type</Label>
                  <Select value={hubForm.hub_type} onValueChange={v => setHubForm({...hubForm, hub_type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bokun">Bókun</SelectItem>
                      <SelectItem value="fareharbor">FareHarbor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>API Key</Label>
                  <Input type="password" value={hubForm.api_key_enc || ''} onChange={e => setHubForm({...hubForm, api_key_enc: e.target.value})} placeholder="Enter API key" /></div>
                <div className="space-y-1.5"><Label>API Secret (if applicable)</Label>
                  <Input type="password" value={hubForm.api_secret_enc || ''} onChange={e => setHubForm({...hubForm, api_secret_enc: e.target.value})} placeholder="Enter API secret" /></div>
                <div className="space-y-1.5"><Label>Base URL</Label>
                  <Input value={hubForm.base_url || ''} onChange={e => setHubForm({...hubForm, base_url: e.target.value})} placeholder="https://api.bokun.io" /></div>
                <Button onClick={() => saveHubMutation.mutate(hubForm)} disabled={saveHubMutation.isPending} className="gap-2">
                  <Save className="w-4 h-4" /> Save Connection
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invoicing */}
          <TabsContent value="invoicing">
            <Card className="border-0 shadow-sm max-w-2xl">
              <CardHeader>
                <CardTitle className="text-base">Invoice Settings</CardTitle>
                <CardDescription>Configure invoice numbering, VAT, and defaults</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>Invoice Prefix</Label>
                    <Input value={invoiceSettings.invoice_prefix || ''} onChange={e => setInvoiceSettings({...invoiceSettings, invoice_prefix: e.target.value})} placeholder="e.g. JA-2026-" /></div>
                  <div className="space-y-1.5"><Label>Default VAT Rate (%)</Label>
                    <Input type="number" step="0.1" value={((invoiceSettings.default_vat_rate || 0) * 100).toFixed(1)} onChange={e => setInvoiceSettings({...invoiceSettings, default_vat_rate: (parseFloat(e.target.value) || 0) / 100})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label>VAT Mode</Label>
                    <Select value={invoiceSettings.vat_mode || 'included'} onValueChange={v => setInvoiceSettings({...invoiceSettings, vat_mode: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="included">Prices include VAT</SelectItem>
                        <SelectItem value="excluded">Prices exclude VAT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Currency</Label>
                    <Select value={invoiceSettings.default_currency || 'EUR'} onValueChange={v => setInvoiceSettings({...invoiceSettings, default_currency: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={() => updateTenantMutation.mutate(invoiceSettings)} disabled={updateTenantMutation.isPending} className="gap-2">
                  <Save className="w-4 h-4" /> Save Invoice Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Create Tenant Dialog */}
      <Dialog open={showTenantForm} onOpenChange={setShowTenantForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Company</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Company Name</Label>
              <Input value={tenantForm.name || ''} onChange={e => setTenantForm({...tenantForm, name: e.target.value})} placeholder="e.g. Julijske Alpe Adventures" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Country Code</Label>
                <Input value={tenantForm.country_code || ''} onChange={e => setTenantForm({...tenantForm, country_code: e.target.value})} placeholder="SI" /></div>
              <div className="space-y-1.5"><Label>VAT ID</Label>
                <Input value={tenantForm.vat_id || ''} onChange={e => setTenantForm({...tenantForm, vat_id: e.target.value})} placeholder="SI12345678" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Invoice Prefix</Label>
                <Input value={tenantForm.invoice_prefix || ''} onChange={e => setTenantForm({...tenantForm, invoice_prefix: e.target.value})} placeholder="JA-2026-" /></div>
              <div className="space-y-1.5"><Label>Default VAT Rate (%)</Label>
                <Input type="number" step="0.1" value={((tenantForm.default_vat_rate || 0) * 100).toFixed(1)} onChange={e => setTenantForm({...tenantForm, default_vat_rate: (parseFloat(e.target.value) || 0) / 100})} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTenantForm(false)}>Cancel</Button>
            <Button onClick={() => createTenantMutation.mutate(tenantForm)} disabled={createTenantMutation.isPending}>Create Company</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}