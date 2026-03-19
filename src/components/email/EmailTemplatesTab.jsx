import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil } from 'lucide-react';

const CATEGORIES = {
  booking_confirmation: 'Potrditev rezervacije',
  booking_reminder: 'Opomnik rezervacije',
  offer_sent: 'Ponudba poslana',
  offer_accepted: 'Ponudba sprejeta',
  invoice: 'Račun',
  birthday: 'Rojstni dan',
  seasonal: 'Sezonski',
  welcome: 'Dobrodošlica',
  custom: 'Po meri',
};

const VARS_HINT = '{{customer_name}}, {{customer_email}}, {{experience_title}}, {{date}}, {{booking_id}}, {{offer_number}}, {{company_name}}, {{tenant_name}}';

export default function EmailTemplatesTab({ tenantId }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [previewMode, setPreviewMode] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['email-templates', tenantId],
    queryFn: () => base44.entities.EmailTemplate.filter({ tenant_id: tenantId }, '-created_date'),
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.EmailTemplate.update(editing.id, data)
      : base44.entities.EmailTemplate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      setShowForm(false);
      setEditing(null);
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ tenant_id: tenantId, is_active: true, language: 'sl', category: 'custom' });
    setShowForm(true);
  };

  const openEdit = (t) => {
    setEditing(t);
    setForm({ ...t });
    setShowForm(true);
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{templates.length} predlog</p>
        <Button size="sm" className="bg-[#1a5c38] gap-1" onClick={openCreate}>
          <Plus className="w-3.5 h-3.5" /> Nova predloga
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Naziv</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Kategorija</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Jezik</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && [...Array(3)].map((_, i) => (
              <tr key={i} className="border-b border-gray-50">
                {[...Array(5)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}
              </tr>
            ))}
            {!isLoading && templates.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">Ni predlog. Ustvari prvo.</td></tr>
            )}
            {!isLoading && templates.map(t => (
              <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => openEdit(t)}>
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3 text-gray-500">{CATEGORIES[t.category] || t.category}</td>
                <td className="px-4 py-3 uppercase text-xs">{t.language}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={t.is_active ? 'text-emerald-600 border-emerald-200' : 'text-gray-400 border-gray-200'}>
                    {t.is_active ? 'Aktivna' : 'Neaktivna'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); openEdit(t); }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Uredi predlogo' : 'Nova email predloga'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Naziv</Label>
                <Input value={form.name || ''} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Npr. Dobrodošlica novo stranko" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Kategorija</Label>
                <Select value={form.category || 'custom'} onValueChange={v => setForm(f => ({...f, category: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIES).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Jezik</Label>
                <Select value={form.language || 'sl'} onValueChange={v => setForm(f => ({...f, language: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sl">Slovenščina</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="both">Oboje</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={form.is_active !== false} onCheckedChange={v => setForm(f => ({...f, is_active: v}))} />
                <Label className="text-xs">Aktivna</Label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Zadeva emaila</Label>
              <Input value={form.subject || ''} onChange={e => setForm(f => ({...f, subject: e.target.value}))} placeholder="Npr. Vaša rezervacija: {{experience_title}}" />
              <p className="text-xs text-gray-400">Spremenljivke: {VARS_HINT}</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Vsebina (HTML ali navadni tekst)</Label>
                <button onClick={() => setPreviewMode(!previewMode)} className="text-xs text-blue-600 hover:underline">
                  {previewMode ? 'Uredi' : 'Predogled'}
                </button>
              </div>
              {previewMode ? (
                <div className="border rounded-lg p-4 min-h-[200px] text-sm" dangerouslySetInnerHTML={{ __html: form.body_html || '<em>Prazno</em>' }} />
              ) : (
                <Textarea
                  value={form.body_html || ''}
                  onChange={e => setForm(f => ({...f, body_html: e.target.value}))}
                  placeholder="<p>Spoštovani {{customer_name}},</p>"
                  rows={10}
                  className="font-mono text-xs"
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Prekliči</Button>
            <Button className="bg-[#1a5c38]" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
              {editing ? 'Shrani' : 'Ustvari'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}