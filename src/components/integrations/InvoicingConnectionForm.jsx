import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const PROVIDERS = [
  { value: 'quibi', label: '🇸🇮 Quibi' },
  { value: 'cebelca', label: '🐝 Čebelca' },
  { value: 'minimax', label: '📊 Minimax' },
  { value: 'vasco', label: '📋 Vasco' },
  { value: 'pantheon', label: '🏛️ Pantheon' },
  { value: 'generic_api', label: '🔌 Splošni API' },
];

const HINTS = {
  quibi: 'Prijavne podatke najdete na si.quibi.net → Nastavitve → Podatki podjetja.',
  cebelca: 'API ključ najdete v Čebelca → Nastavitve → API dostop.',
  minimax: 'API ključ najdete v Minimax → Nastavitve → API dostop.',
  vasco: 'Za Vasco poverilnice kontaktirajte Vasco podporo.',
  pantheon: 'API dostop nastavite v Pantheon → Administracija → API.',
  generic_api: 'Vnesite poverilnice v JSON formatu.',
};

export default function InvoicingConnectionForm({ open, onClose, connection, tenantId, onSave }) {
  const [provider, setProvider] = useState('');
  const [creds, setCreds] = useState({ username: '', password: '', api_key: '', company_id: '', base_url: '' });
  const [settings, setSettings] = useState({ vat_rate: 9.5, currency: 'EUR', language: 'sl', auto_invoice: false, auto_send: false });
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (connection) {
      setProvider(connection.provider_id || '');
      try { setCreds(JSON.parse(connection.credentials_enc || '{}')); } catch { setCreds({}); }
      try { setSettings({ vat_rate: 9.5, currency: 'EUR', language: 'sl', auto_invoice: false, auto_send: false, ...JSON.parse(connection.settings_json || '{}') }); } catch {}
    } else {
      setProvider('');
      setCreds({ username: '', password: '', api_key: '', company_id: '', base_url: '' });
      setSettings({ vat_rate: 9.5, currency: 'EUR', language: 'sl', auto_invoice: false, auto_send: false });
    }
  }, [connection, open]);

  const handleSave = async () => {
    if (!provider) { toast.error('Izberite sistem'); return; }
    setSaving(true);
    const credsFiltered = Object.fromEntries(Object.entries(creds).filter(([, v]) => v));
    await onSave({
      tenant_id: tenantId,
      provider_id: provider,
      credentials_enc: JSON.stringify(credsFiltered),
      settings_json: JSON.stringify(settings),
      status: 'unconfigured',
    }, connection?.id);
    setSaving(false);
    onClose();
  };

  const renderFields = () => {
    if (provider === 'quibi') return (
      <>
        <div><Label>Email (uporabniško ime)</Label>
          <Input className="mt-1" type="email" value={creds.username || ''} onChange={e => setCreds(c => ({ ...c, username: e.target.value }))} /></div>
        <div><Label>Geslo</Label>
          <div className="relative mt-1">
            <Input type={showPass ? 'text' : 'password'} value={creds.password || ''} onChange={e => setCreds(c => ({ ...c, password: e.target.value }))} />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowPass(!showPass)}>
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div></div>
        <div><Label>Base URL</Label>
          <Input className="mt-1" value={creds.base_url || 'https://si.quibi.net'} onChange={e => setCreds(c => ({ ...c, base_url: e.target.value }))} /></div>
      </>
    );
    if (provider === 'minimax') return (
      <>
        <div><Label>API ključ</Label>
          <div className="relative mt-1">
            <Input type={showPass ? 'text' : 'password'} value={creds.api_key || ''} onChange={e => setCreds(c => ({ ...c, api_key: e.target.value }))} />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowPass(!showPass)}>
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div></div>
        <div><Label>Company ID</Label>
          <Input className="mt-1" value={creds.company_id || ''} onChange={e => setCreds(c => ({ ...c, company_id: e.target.value }))} /></div>
      </>
    );
    return (
      <div><Label>Poverilnice (JSON)</Label>
        <textarea className="mt-1 w-full border rounded-md px-3 py-2 text-sm font-mono h-32 focus:outline-none focus:ring-1 focus:ring-ring"
          value={JSON.stringify(creds, null, 2)} onChange={e => { try { setCreds(JSON.parse(e.target.value)); } catch {} }} /></div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{connection ? 'Uredi računovodski sistem' : 'Dodaj računovodski sistem'}</SheetTitle>
        </SheetHeader>
        <div className="space-y-5 mt-6">
          <div>
            <Label>Sistem *</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Izberite..." /></SelectTrigger>
              <SelectContent>
                {PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {provider && HINTS[provider] && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              💡 {HINTS[provider]}
            </div>
          )}

          {provider && renderFields()}

          {/* Settings */}
          <div className="border-t pt-4 space-y-4">
            <p className="text-sm font-semibold text-gray-700">Nastavitve računov</p>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Privzeta DDV stopnja (%)</Label>
                <Input className="mt-1" type="number" step="0.5" value={settings.vat_rate}
                  onChange={e => setSettings(s => ({ ...s, vat_rate: parseFloat(e.target.value) || 9.5 }))} /></div>
              <div><Label>Valuta</Label>
                <Input className="mt-1" value={settings.currency}
                  onChange={e => setSettings(s => ({ ...s, currency: e.target.value }))} /></div>
            </div>
            <div><Label>Jezik računov</Label>
              <Select value={settings.language} onValueChange={v => setSettings(s => ({ ...s, language: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sl">Slovenščina</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                </SelectContent>
              </Select></div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Samodejni račun ob potrditvi</p>
                <p className="text-xs text-gray-400">Ustvari račun ko je rezervacija potrjena</p>
              </div>
              <Switch checked={settings.auto_invoice} onCheckedChange={v => setSettings(s => ({ ...s, auto_invoice: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Samodejno pošlji račun gostu</p>
                <p className="text-xs text-gray-400">Pošlje PDF po emailu po izdaji</p>
              </div>
              <Switch checked={settings.auto_send} onCheckedChange={v => setSettings(s => ({ ...s, auto_send: v }))} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={onClose}>Prekliči</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#1a5c38] hover:bg-[#1a5c38]/90 text-white">
              {saving ? 'Shranjujem...' : 'Preizkusi in shrani'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}