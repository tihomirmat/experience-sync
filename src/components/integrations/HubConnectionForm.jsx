import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff, Copy } from 'lucide-react';
import { toast } from 'sonner';

const HUB_TYPES = [
  { value: 'fareharbor', label: '🎡 FareHarbor' },
  { value: 'bokun', label: '📦 Bokun' },
  { value: 'trekksoft', label: '🗺️ TrekkSoft' },
  { value: 'rezdy', label: '📅 Rezdy' },
  { value: 'gyg_direct', label: '🟠 GetYourGuide Direct' },
  { value: 'custom_webhook', label: '🔗 Custom Webhook' },
];

const HINTS = {
  fareharbor: 'Vaš FareHarbor API ključ najdete v FareHarbor → Settings → API. Za webhook registracijo pošljite webhook URL na support@fareharbor.com.',
  bokun: 'API ključ najdete v Bokun → Settings → API Access. Ustvarite nov API par.',
  trekksoft: 'API ključ najdete v TrekkSoft → Settings → Integrations → API.',
  rezdy: 'API ključ najdete v Rezdy → Account → API Keys.',
  gyg_direct: 'Za GetYourGuide Direct partnerstvo kontaktirajte vašega GYG account managerja.',
  custom_webhook: 'Vpišite URL vašega sistema, ki bo sprejemal webhook obvestila.',
};

export default function HubConnectionForm({ open, onClose, connection, tenantId, onSave }) {
  const [form, setForm] = useState({ hub_type: '', api_key_enc: '', api_secret_enc: '', base_url: '', sync_interval_minutes: 60 });
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);

  const webhookUrl = `https://experience-sync-pro.base44.app/api/webhook/${tenantId}`;

  useEffect(() => {
    if (connection) {
      setForm({
        hub_type: connection.hub_type || '',
        api_key_enc: connection.api_key_enc || '',
        api_secret_enc: connection.api_secret_enc || '',
        base_url: connection.base_url || '',
        sync_interval_minutes: connection.sync_interval_minutes || 60,
      });
    } else {
      setForm({ hub_type: '', api_key_enc: '', api_secret_enc: '', base_url: '', sync_interval_minutes: 60 });
    }
  }, [connection, open]);

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('URL kopiran');
  };

  const handleSave = async () => {
    if (!form.hub_type) { toast.error('Izberite tip'); return; }
    setSaving(true);
    await onSave({ ...form, tenant_id: tenantId, status: 'active' }, connection?.id);
    setSaving(false);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{connection ? 'Uredi booking kanal' : 'Dodaj booking kanal'}</SheetTitle>
        </SheetHeader>
        <div className="space-y-5 mt-6">
          {/* Webhook URL Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-700 mb-2">📎 Vaš universalni webhook URL:</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-white border rounded px-2 py-1 flex-1 truncate text-blue-800">{webhookUrl}</code>
              <Button size="sm" variant="outline" onClick={copyWebhook} className="shrink-0 h-7 text-xs gap-1">
                <Copy className="w-3 h-3" /> Kopiraj
              </Button>
            </div>
          </div>

          <div>
            <Label>Tip booking sistema *</Label>
            <Select value={form.hub_type} onValueChange={v => setForm(f => ({ ...f, hub_type: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Izberite..." /></SelectTrigger>
              <SelectContent>
                {HUB_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {form.hub_type && HINTS[form.hub_type] && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              💡 {HINTS[form.hub_type]}
            </div>
          )}

          <div>
            <Label>API ključ</Label>
            <div className="relative mt-1">
              <Input type={showKey ? 'text' : 'password'} value={form.api_key_enc}
                onChange={e => setForm(f => ({ ...f, api_key_enc: e.target.value }))} placeholder="Vnesite API ključ" />
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowKey(!showKey)}>
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label>API secret (neobvezno)</Label>
            <div className="relative mt-1">
              <Input type={showSecret ? 'text' : 'password'} value={form.api_secret_enc}
                onChange={e => setForm(f => ({ ...f, api_secret_enc: e.target.value }))} placeholder="Vnesite API secret" />
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowSecret(!showSecret)}>
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label>Base URL (neobvezno)</Label>
            <Input className="mt-1" value={form.base_url}
              onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))} placeholder="https://..." />
          </div>

          <div>
            <Label>Interval sinhronizacije (min)</Label>
            <Input className="mt-1" type="number" value={form.sync_interval_minutes}
              onChange={e => setForm(f => ({ ...f, sync_interval_minutes: parseInt(e.target.value) || 60 }))} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose}>Prekliči</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#1a5c38] hover:bg-[#1a5c38]/90 text-white">
              {saving ? 'Shranjujem...' : 'Shrani'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}