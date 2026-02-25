import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Save, Zap, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const PROVIDERS = {
  quibi: {
    name: 'Quibi',
    logo: '🟦',
    description: 'Slovenian invoicing & fiscalization via si.quibi.net',
    credFields: [
      { key: 'base_url', label: 'Base URL', placeholder: 'https://si.quibi.net', type: 'text' },
      { key: 'username', label: 'Username', placeholder: 'your@email.com', type: 'text' },
      { key: 'password', label: 'Password', placeholder: '••••••••', type: 'password' },
    ],
    settingsFields: [
      { key: 'stevilcenje_id', label: 'Numbering Scheme ID', placeholder: 'e.g. 1', type: 'number' },
      { key: 'vrstaprodaje', label: 'Vrsta Prodaje', placeholder: '1', type: 'number' },
      { key: 'language', label: 'Default Language', placeholder: 'sl', type: 'text' },
      { key: 'space_id', label: 'Space ID (optional)', placeholder: 'for tax cash register', type: 'text' },
    ],
  },
  cebelca: {
    name: 'Čebelca / InvoiceFox',
    logo: '🐝',
    description: 'Čebelca BIZ / InvoiceFox – Slovenian cloud invoicing',
    credFields: [
      { key: 'api_token', label: 'API Token', placeholder: 'your cebelca api token', type: 'password' },
    ],
    settingsFields: [],
  },
};

export default function ProviderConnectionCard({ providerId, tenantId, connection, isDefault, onSetDefault }) {
  const provider = PROVIDERS[providerId];
  const queryClient = useQueryClient();

  const [creds, setCreds] = useState(() => {
    try { return connection ? JSON.parse(connection.credentials_enc || '{}') : {}; } catch { return {}; }
  });
  const [settings, setSettings] = useState(() => {
    try { return connection ? JSON.parse(connection.settings_json || '{}') : {}; } catch { return {}; }
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      tenant_id: tenantId,
      provider_id: providerId,
      credentials_enc: JSON.stringify(creds),
      settings_json: JSON.stringify(settings),
      is_default: isDefault,
    };
    if (connection) {
      await base44.entities.InvoicingConnection.update(connection.id, payload);
    } else {
      await base44.entities.InvoicingConnection.create({ ...payload, status: 'unconfigured' });
    }
    queryClient.invalidateQueries({ queryKey: ['invoicing-connections', tenantId] });
    setSaving(false);
    toast.success(`${provider.name} connection saved`);
  };

  const handleTest = async () => {
    if (!connection) { toast.error('Save first, then test.'); return; }
    setTesting(true);
    const { data } = await base44.functions.invoke('healthcheckProvider', { connection_id: connection.id });
    setTesting(false);
    queryClient.invalidateQueries({ queryKey: ['invoicing-connections', tenantId] });
    if (data?.ok) toast.success(data.message);
    else toast.error(data?.message || 'Connection failed');
  };

  const statusColor = {
    active: 'bg-emerald-50 text-emerald-700',
    error: 'bg-red-50 text-red-700',
    unconfigured: 'bg-gray-100 text-gray-500',
  }[connection?.status || 'unconfigured'];

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{provider.logo}</span>
            <div>
              <CardTitle className="text-base">{provider.name}</CardTitle>
              <CardDescription className="text-xs">{provider.description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {connection && (
              <Badge className={statusColor + ' text-xs'}>
                {connection.status === 'active' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                {connection.status === 'error' && <AlertCircle className="w-3 h-3 mr-1" />}
                {connection.status}
              </Badge>
            )}
            <div className="flex items-center gap-1.5">
              <Switch checked={isDefault} onCheckedChange={v => v && onSetDefault(providerId)} />
              <span className="text-xs text-gray-500">Default</span>
            </div>
          </div>
        </div>
        {connection?.last_error && (
          <p className="text-xs text-red-600 mt-2 bg-red-50 px-2 py-1.5 rounded">⚠ {connection.last_error}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Credentials</p>
          {provider.credFields.map(f => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-xs">{f.label}</Label>
              <Input
                type={f.type}
                placeholder={f.placeholder}
                value={creds[f.key] || ''}
                onChange={e => setCreds({ ...creds, [f.key]: e.target.value })}
                className="h-8 text-sm"
              />
            </div>
          ))}
        </div>

        {provider.settingsFields.length > 0 && (
          <div className="space-y-3 pt-2 border-t">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Settings</p>
            <div className="grid grid-cols-2 gap-3">
              {provider.settingsFields.map(f => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-xs">{f.label}</Label>
                  <Input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={settings[f.key] || ''}
                    onChange={e => setSettings({ ...settings, [f.key]: e.target.value })}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch
                checked={!!settings.always_fiscalize}
                onCheckedChange={v => setSettings({ ...settings, always_fiscalize: v })}
              />
              <Label className="text-xs">Always fiscalize after issue</Label>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleTest} disabled={testing}>
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Test Connection
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}