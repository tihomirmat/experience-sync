import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { X, Send, ChevronDown, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { format, addMinutes } from 'date-fns';

function applyVariables(text, ctx) {
  if (!text || !ctx) return text;
  return text
    .replace(/\{\{customer_name\}\}/g, ctx.customer_name || '')
    .replace(/\{\{customer_email\}\}/g, ctx.customer_email || '')
    .replace(/\{\{experience_title\}\}/g, ctx.experience_title || '')
    .replace(/\{\{date\}\}/g, ctx.date || '')
    .replace(/\{\{booking_id\}\}/g, ctx.booking_id || '')
    .replace(/\{\{offer_number\}\}/g, ctx.offer_number || '')
    .replace(/\{\{company_name\}\}/g, ctx.company_name || '')
    .replace(/\{\{tenant_name\}\}/g, ctx.tenant_name || '');
}

export default function EmailCompose({ tenantId, initialTo = '', initialSubject = '', initialBody = '', contextData = {}, onClose, onSent }) {
  const queryClient = useQueryClient();
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [form, setForm] = useState({
    to: initialTo,
    cc: '',
    bcc: '',
    subject: initialSubject,
    body: initialBody,
    scheduled_at: '',
  });
  const [sending, setSending] = useState(false);

  const { data: templates = [] } = useQuery({
    queryKey: ['email-templates', tenantId],
    queryFn: () => base44.entities.EmailTemplate.filter({ tenant_id: tenantId, is_active: true }),
    enabled: !!tenantId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-autocomplete', tenantId],
    queryFn: () => base44.entities.Customer.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });

  const { data: connections = [] } = useQuery({
    queryKey: ['email-connections', tenantId],
    queryFn: () => base44.entities.EmailConnection.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });

  const activeConnection = connections.find(c => c.status === 'active');

  useEffect(() => {
    setForm(f => ({ ...f, to: initialTo, subject: initialSubject, body: initialBody }));
  }, [initialTo, initialSubject, initialBody]);

  const applyTemplate = (templateId) => {
    const tpl = templates.find(t => t.id === templateId);
    if (!tpl) return;
    const ctx = { ...contextData, tenant_name: '' };
    setForm(f => ({
      ...f,
      subject: applyVariables(tpl.subject, ctx),
      body: applyVariables(tpl.body_html || '', ctx),
    }));
  };

  const handleSend = async (scheduled = false) => {
    if (!form.to || !form.subject) {
      toast.error('Izpolni prejemnika in zadevo');
      return;
    }
    setSending(true);
    const matchedCustomer = customers.find(c => c.email === form.to);
    const messageData = {
      tenant_id: tenantId,
      direction: 'outbound',
      folder: 'sent',
      status: scheduled ? 'queued' : 'sent',
      from_email: activeConnection?.from_email || '',
      from_name: activeConnection?.from_name || '',
      to_email: form.to,
      subject: form.subject,
      body_html: form.body,
      body_text: form.body.replace(/<[^>]+>/g, ''),
      cc: form.cc || undefined,
      bcc: form.bcc || undefined,
      customer_id: contextData.customer_id || matchedCustomer?.id,
      booking_id: contextData.booking_id,
      invoice_id: contextData.invoice_id,
      inquiry_id: contextData.inquiry_id,
      sent_at: scheduled ? undefined : new Date().toISOString(),
      scheduled_at: scheduled && form.scheduled_at ? form.scheduled_at : undefined,
    };
    await base44.entities.EmailMessage.create(messageData);
    queryClient.invalidateQueries({ queryKey: ['email-messages'] });
    toast.success(scheduled ? 'Email zaplaniran' : 'Email shranjen');
    setSending(false);
    onSent?.();
    onClose();
  };

  const handleDraft = async () => {
    await base44.entities.EmailMessage.create({
      tenant_id: tenantId,
      direction: 'outbound',
      folder: 'drafts',
      status: 'draft',
      to_email: form.to,
      subject: form.subject,
      body_html: form.body,
      customer_id: contextData.customer_id,
    });
    queryClient.invalidateQueries({ queryKey: ['email-messages'] });
    toast.success('Osnutek shranjen');
    onClose();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="font-medium text-gray-900">Nov email</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Template picker */}
        {templates.length > 0 && (
          <div>
            <Select onValueChange={applyTemplate}>
              <SelectTrigger className="h-8 text-xs">
                <div className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /><SelectValue placeholder="Vstavi predlogo..." /></div>
              </SelectTrigger>
              <SelectContent>
                {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* To */}
        <div>
          <div className="flex items-center gap-2">
            <Label className="text-xs w-10 shrink-0 text-gray-500">Za:</Label>
            <Input
              value={form.to}
              onChange={e => setForm(f => ({...f, to: e.target.value}))}
              placeholder="email@primer.si"
              className="h-8 text-sm flex-1"
              list="customer-emails"
            />
            <datalist id="customer-emails">
              {customers.map(c => c.email && <option key={c.id} value={c.email} label={c.name} />)}
            </datalist>
            <button onClick={() => setShowCc(!showCc)} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">CC</button>
            <button onClick={() => setShowBcc(!showBcc)} className="text-xs text-gray-400 hover:text-gray-600 shrink-0">BCC</button>
          </div>
        </div>

        {showCc && (
          <div className="flex items-center gap-2">
            <Label className="text-xs w-10 shrink-0 text-gray-500">CC:</Label>
            <Input value={form.cc} onChange={e => setForm(f => ({...f, cc: e.target.value}))} placeholder="cc@primer.si" className="h-8 text-sm" />
          </div>
        )}
        {showBcc && (
          <div className="flex items-center gap-2">
            <Label className="text-xs w-10 shrink-0 text-gray-500">BCC:</Label>
            <Input value={form.bcc} onChange={e => setForm(f => ({...f, bcc: e.target.value}))} placeholder="bcc@primer.si" className="h-8 text-sm" />
          </div>
        )}

        {/* Subject */}
        <div className="flex items-center gap-2">
          <Label className="text-xs w-10 shrink-0 text-gray-500">Zadeva:</Label>
          <Input
            value={form.subject}
            onChange={e => setForm(f => ({...f, subject: e.target.value}))}
            placeholder="Zadeva"
            className="h-8 text-sm"
          />
        </div>

        {/* Body */}
        <div>
          <Textarea
            value={form.body}
            onChange={e => setForm(f => ({...f, body: e.target.value}))}
            placeholder="Vsebina emaila..."
            className="text-sm min-h-[200px] resize-none"
            rows={10}
          />
        </div>

        {/* Schedule */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-gray-500 shrink-0">Zaplanuj:</Label>
          <Input
            type="datetime-local"
            value={form.scheduled_at}
            onChange={e => setForm(f => ({...f, scheduled_at: e.target.value}))}
            className="h-8 text-sm flex-1"
          />
        </div>

        {!activeConnection && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
            ⚠️ Ni nastavljena email povezava. Emaili bodo shranjeni kot poslani brez dejanskega pošiljanja.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-100 flex gap-2">
        <Button variant="outline" size="sm" onClick={handleDraft} disabled={sending}>
          Shrani osnutek
        </Button>
        {form.scheduled_at && (
          <Button variant="outline" size="sm" onClick={() => handleSend(true)} disabled={sending}>
            Zaplanuj
          </Button>
        )}
        <Button size="sm" className="bg-[#1a5c38] hover:bg-[#154d2f] gap-1.5 ml-auto" onClick={() => handleSend(false)} disabled={sending}>
          <Send className="w-3.5 h-3.5" /> {sending ? 'Pošiljam...' : 'Pošlji'}
        </Button>
      </div>
    </div>
  );
}