import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function QuibiSettings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ base_url: 'https://si.quibi.net' });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const { data: connections = [] } = useQuery({
    queryKey: ['quibi-connections'],
    queryFn: () => base44.entities.QuibiConnection.list(),
  });

  const conn = connections[0];

  useEffect(() => {
    if (conn) {
      setForm({ username: conn.username, base_url: conn.base_url || 'https://si.quibi.net' });
      if (conn.status === 'active') {
        setTestResult({
          ok: true,
          stevilcenja: JSON.parse(conn.available_stevilcenja || '[]'),
          ddv_codes: JSON.parse(conn.available_ddv || '[]'),
          spaces: JSON.parse(conn.available_spaces || '[]'),
        });
      }
    }
  }, [connections.length]);

  const handleTest = async () => {
    setTesting(true);
    const res = await base44.functions.invoke('quibiTestConnection', {
      username: form.username,
      password: form.password,
      base_url: form.base_url,
      tenant_id: conn?.tenant_id || 'default',
    });
    setTesting(false);
    if (res.data?.ok) {
      setTestResult(res.data);
      toast({ title: 'Povezava uspešna!' });
      qc.invalidateQueries({ queryKey: ['quibi-connections'] });
    } else {
      setTestResult({ error: res.data?.error || 'Napaka' });
      toast({ title: 'Napaka pri povezavi', description: res.data?.error, variant: 'destructive' });
    }
  };

  const handleSaveDefaults = async () => {
    if (conn) {
      await base44.entities.QuibiConnection.update(conn.id, {
        default_stevilcenje_id: form.default_stevilcenje_id,
        default_ddv_id: form.default_ddv_id,
        space_id: form.space_id,
      });
      toast({ title: 'Privzete vrednosti shranjene' });
      qc.invalidateQueries({ queryKey: ['quibi-connections'] });
    }
  };

  const statusIcon = conn?.status === 'active'
    ? <span className="flex items-center gap-1.5 text-green-600"><CheckCircle2 className="w-4 h-4" /> Aktivno</span>
    : conn?.status === 'error'
    ? <span className="flex items-center gap-1.5 text-red-600"><XCircle className="w-4 h-4" /> Napaka</span>
    : <span className="text-gray-400">Ni nastavljeno</span>;

  return (
    <div>
      <PageHeader title="Quibi nastavitve" subtitle="Konfiguracija povezave z Quibi računovodskim sistemom" />
      <div className="p-6 max-w-2xl space-y-6">
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Prijavni podatki</h2>
              <div className="text-sm">{statusIcon}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Uporabniško ime</Label><Input value={form.username || ''} onChange={e => setForm({ ...form, username: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Geslo</Label><Input type="password" value={form.password || ''} placeholder="••••••••" onChange={e => setForm({ ...form, password: e.target.value })} /></div>
              <div className="col-span-2 space-y-1.5"><Label>Base URL</Label><Input value={form.base_url || ''} onChange={e => setForm({ ...form, base_url: e.target.value })} /></div>
            </div>
            <Button onClick={handleTest} disabled={testing} className="bg-[#1a5c38] hover:bg-[#134a2c] gap-2">
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Preizkusi povezavo
            </Button>
            {testResult?.error && <p className="text-sm text-red-500">{testResult.error}</p>}
          </CardContent>
        </Card>

        {testResult?.ok && (
          <Card>
            <CardContent className="p-5 space-y-4">
              <h2 className="font-semibold">Privzete nastavitve</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Privzeto številčenje</Label>
                  <Select value={form.default_stevilcenje_id || conn?.default_stevilcenje_id || ''} onValueChange={v => setForm({ ...form, default_stevilcenje_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Izberi..." /></SelectTrigger>
                    <SelectContent>{(testResult.stevilcenja || []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.naziv || s.id}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Privzeta stopnja DDV</Label>
                  <Select value={form.default_ddv_id || conn?.default_ddv_id || ''} onValueChange={v => setForm({ ...form, default_ddv_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Izberi..." /></SelectTrigger>
                    <SelectContent>{(testResult.ddv_codes || []).map(d => <SelectItem key={d.id} value={String(d.id)}>{d.naziv || d.stopnja || d.id}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Space ID (za davčno potrditev)</Label>
                  <Select value={form.space_id || conn?.space_id || ''} onValueChange={v => setForm({ ...form, space_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Izberi (neobvezno)..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Brez</SelectItem>
                      {(testResult.spaces || []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.naziv || s.id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleSaveDefaults} className="bg-[#1a5c38] hover:bg-[#134a2c]">Shrani privzeto</Button>
            </CardContent>
          </Card>
        )}

        {conn?.last_error && (
          <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{conn.last_error}</p>
        )}
      </div>
    </div>
  );
}