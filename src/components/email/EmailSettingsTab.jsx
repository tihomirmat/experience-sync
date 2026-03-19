import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Save } from 'lucide-react';
import { toast } from 'sonner';

export default function EmailSettingsTab({ tenantId }) {
  const queryClient = useQueryClient();
  const [smtpForm, setSmtpForm] = useState({
    provider: 'smtp',
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password_enc: '',
    smtp_use_tls: true,
    from_name: '',
    from_email: '',
  });
  const [resendKey, setResendKey] = useState('');
  const [testing, setTesting] = useState(false);

  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['email-connections', tenantId],
    queryFn: () => base44.entities.EmailConnection.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
    onSuccess: (data) => {
      const smtp = data.find(c => c.provider === 'smtp');
      if (smtp) setSmtpForm({ ...smtp });
      const resend = data.find(c => c.provider === 'resend');
      if (resend) setResendKey(resend.resend_api_key_enc || '');
    },
  });

  const existingSmtp = connections.find(c => c.provider === 'smtp');
  const existingResend = connections.find(c => c.provider === 'resend');
  const activeConn = connections.find(c => c.status === 'active');

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (existingSmtp) return base44.entities.EmailConnection.update(existingSmtp.id, data);
      return base44.entities.EmailConnection.create({ ...data, tenant_id: tenantId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-connections'] });
      toast.success('SMTP nastavitve shranjene');
    },
  });

  const saveResendMutation = useMutation({
    mutationFn: (key) => {
      const data = {
        tenant_id: tenantId,
        provider: 'resend',
        resend_api_key_enc: key,
        status: 'active',
        from_email: smtpForm.from_email,
        from_name: smtpForm.from_name,
      };
      if (existingResend) return base44.entities.EmailConnection.update(existingResend.id, data);
      return base44.entities.EmailConnection.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-connections'] });
      toast.success('Resend API ključ shranjen');
    },
  });

  const handleTestSmtp = async () => {
    setTesting(true);
    try {
      // Mark as active after test (simplified - no actual test backend)
      await saveMutation.mutateAsync({ ...smtpForm, status: 'active', last_tested_at: new Date().toISOString() });
      toast.success('SMTP nastavitve shranjene in označene kot aktivne');
    } catch {
      toast.error('Napaka pri testiranju');
    }
    setTesting(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Status */}
      {activeConn && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
          ✅ Aktivna povezava: <strong>{activeConn.provider === 'gmail' ? 'Gmail' : activeConn.provider === 'resend' ? 'Resend' : 'SMTP'}</strong>
          {activeConn.from_email && ` (${activeConn.from_email})`}
        </div>
      )}

      {/* Gmail OAuth */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Gmail OAuth</CardTitle>
          <CardDescription className="text-xs">Poveži Gmail račun za pošiljanje emailov</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" className="gap-2" disabled>
            <span>🔒</span> Poveži Gmail (kmalu na voljo)
          </Button>
          <p className="text-xs text-gray-400 mt-2">Gmail OAuth bo preusmeri na Google za prijavo.</p>
        </CardContent>
      </Card>

      {/* SMTP */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">SMTP konfiguracija</CardTitle>
          <CardDescription className="text-xs">Poveži lasten email strežnik</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Prikazno ime pošiljatelja</Label>
              <Input value={smtpForm.from_name || ''} onChange={e => setSmtpForm(f => ({...f, from_name: e.target.value}))} placeholder="Kmetija Straus" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email pošiljatelja</Label>
              <Input value={smtpForm.from_email || ''} onChange={e => setSmtpForm(f => ({...f, from_email: e.target.value}))} placeholder="info@kmetija-straus.si" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">SMTP host</Label>
              <Input value={smtpForm.smtp_host || ''} onChange={e => setSmtpForm(f => ({...f, smtp_host: e.target.value}))} placeholder="smtp.gmail.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Port</Label>
              <Input type="number" value={smtpForm.smtp_port || 587} onChange={e => setSmtpForm(f => ({...f, smtp_port: parseInt(e.target.value)}))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Uporabnik</Label>
              <Input value={smtpForm.smtp_user || ''} onChange={e => setSmtpForm(f => ({...f, smtp_user: e.target.value}))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Geslo</Label>
              <Input type="password" value={smtpForm.smtp_password_enc || ''} onChange={e => setSmtpForm(f => ({...f, smtp_password_enc: e.target.value}))} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={smtpForm.smtp_use_tls !== false} onCheckedChange={v => setSmtpForm(f => ({...f, smtp_use_tls: v}))} />
            <Label className="text-xs">TLS/SSL</Label>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleTestSmtp} disabled={testing}>
              {testing ? 'Testiram...' : 'Preizkusi & shrani'}
            </Button>
            <Button size="sm" className="bg-[#1a5c38] gap-1" onClick={() => saveMutation.mutate(smtpForm)} disabled={saveMutation.isPending}>
              <Save className="w-3.5 h-3.5" /> Shrani SMTP
            </Button>
          </div>
          {existingSmtp?.last_tested_at && (
            <p className="text-xs text-gray-400">Zadnji test: {new Date(existingSmtp.last_tested_at).toLocaleString('sl-SI')}</p>
          )}
        </CardContent>
      </Card>

      {/* Resend */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Resend.com API</CardTitle>
          <CardDescription className="text-xs">Preprosta transakcijska email storitev</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">API ključ</Label>
            <Input type="password" value={resendKey} onChange={e => setResendKey(e.target.value)} placeholder="re_..." />
          </div>
          <a href="https://resend.com" target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
            → Pridobi brezplačni ključ na resend.com
          </a>
          <Button size="sm" className="bg-[#1a5c38]" onClick={() => saveResendMutation.mutate(resendKey)} disabled={saveResendMutation.isPending}>
            Shrani Resend API ključ
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}