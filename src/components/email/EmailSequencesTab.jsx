import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Play, Pause } from 'lucide-react';

const TRIGGERS = {
  customer_added: 'Nova stranka',
  booking_confirmed: 'Potrjena rezervacija',
  booking_completed: 'Zaključena rezervacija',
  offer_sent: 'Ponudba poslana',
  offer_accepted: 'Ponudba sprejeta',
  inquiry_received: 'Nova poizvedba',
  birthday: 'Rojstni dan',
  manual: 'Ročno',
};

const STATUS_STYLES = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  paused: 'bg-amber-50 text-amber-700 border-amber-200',
  draft: 'bg-gray-50 text-gray-600 border-gray-200',
};

export default function EmailSequencesTab({ tenantId }) {
  const queryClient = useQueryClient();
  const [selectedSeq, setSelectedSeq] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [stepForm, setStepForm] = useState({});
  const [showStepForm, setShowStepForm] = useState(false);

  const { data: sequences = [], isLoading } = useQuery({
    queryKey: ['email-sequences', tenantId],
    queryFn: () => base44.entities.EmailSequence.filter({ tenant_id: tenantId }, 'created_date'),
    enabled: !!tenantId,
  });

  const { data: steps = [] } = useQuery({
    queryKey: ['email-sequence-steps', tenantId, selectedSeq?.id],
    queryFn: () => base44.entities.EmailSequenceStep.filter({ tenant_id: tenantId, sequence_id: selectedSeq.id }, 'step_number'),
    enabled: !!selectedSeq?.id,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['email-templates', tenantId],
    queryFn: () => base44.entities.EmailTemplate.filter({ tenant_id: tenantId, is_active: true }),
    enabled: !!tenantId,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['email-enrollments', tenantId, selectedSeq?.id],
    queryFn: () => base44.entities.EmailSequenceEnrollment.filter({ tenant_id: tenantId, sequence_id: selectedSeq.id }),
    enabled: !!selectedSeq?.id,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.EmailSequence.create({ ...data, tenant_id: tenantId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['email-sequences'] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.EmailSequence.update(id, data),
    onSuccess: (updated) => { queryClient.invalidateQueries({ queryKey: ['email-sequences'] }); setSelectedSeq(updated); },
  });

  const saveStepMutation = useMutation({
    mutationFn: (data) => base44.entities.EmailSequenceStep.create({ ...data, tenant_id: tenantId, sequence_id: selectedSeq.id }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['email-sequence-steps'] }); setShowStepForm(false); },
  });

  const deleteStepMutation = useMutation({
    mutationFn: (id) => base44.entities.EmailSequenceStep.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-sequence-steps'] }),
  });

  const activeCount = enrollments.filter(e => e.status === 'active').length;
  const completedCount = enrollments.filter(e => e.status === 'completed').length;

  return (
    <div className="flex gap-6 max-w-5xl">
      {/* Left: sequences list */}
      <div className="w-72 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium">{sequences.length} sekvenc</p>
          <Button size="sm" className="bg-[#1a5c38] gap-1 h-7 text-xs" onClick={() => {
            setForm({ status: 'draft', trigger: 'manual', stop_on_reply: true });
            setShowForm(true);
          }}>
            <Plus className="w-3 h-3" /> Nova
          </Button>
        </div>
        <div className="space-y-1.5">
          {isLoading && [...Array(3)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
          ))}
          {sequences.map(seq => (
            <button
              key={seq.id}
              onClick={() => setSelectedSeq(seq)}
              className={`w-full text-left p-3 rounded-lg border transition-colors
                ${selectedSeq?.id === seq.id ? 'border-[#1a5c38]/40 bg-[#1a5c38]/5' : 'border-gray-100 bg-white hover:bg-gray-50'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-gray-800 truncate">{seq.name}</p>
                <Badge variant="outline" className={`text-xs border shrink-0 ${STATUS_STYLES[seq.status] || ''}`}>
                  {seq.status === 'active' ? 'Aktivna' : seq.status === 'paused' ? 'Pauzirana' : 'Osnutek'}
                </Badge>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{TRIGGERS[seq.trigger] || seq.trigger}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Right: detail */}
      {selectedSeq && (
        <div className="flex-1 bg-white rounded-xl border border-gray-100 p-5 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">{selectedSeq.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{TRIGGERS[selectedSeq.trigger]} · {selectedSeq.stop_on_reply ? 'Ustavi ob odgovoru' : ''}</p>
            </div>
            <div className="flex gap-2">
              {selectedSeq.status !== 'active' && (
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-emerald-600 border-emerald-200"
                  onClick={() => updateMutation.mutate({ id: selectedSeq.id, data: { status: 'active' } })}>
                  <Play className="w-3 h-3" /> Aktiviraj
                </Button>
              )}
              {selectedSeq.status === 'active' && (
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-amber-600 border-amber-200"
                  onClick={() => updateMutation.mutate({ id: selectedSeq.id, data: { status: 'paused' } })}>
                  <Pause className="w-3 h-3" /> Pauziraj
                </Button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-lg font-semibold">{activeCount}</p>
              <p className="text-xs text-gray-400">Aktivnih</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-lg font-semibold">{completedCount}</p>
              <p className="text-xs text-gray-400">Zaključenih</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-lg font-semibold">{steps.length}</p>
              <p className="text-xs text-gray-400">Korakov</p>
            </div>
          </div>

          {/* Steps timeline */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Koraki</p>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => {
                setStepForm({ step_number: steps.length + 1, delay_days: 0, delay_hours: 0 });
                setShowStepForm(true);
              }}>
                <Plus className="w-3 h-3" /> Dodaj korak
              </Button>
            </div>
            <div className="space-y-2">
              {steps.length === 0 && <p className="text-xs text-gray-400 py-3">Ni korakov. Dodaj prvega.</p>}
              {steps.map((step, idx) => {
                const tpl = templates.find(t => t.id === step.template_id);
                return (
                  <div key={step.id} className="flex items-center gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 rounded-full bg-[#1a5c38] text-white text-xs flex items-center justify-center font-medium">
                        {step.step_number}
                      </div>
                      {idx < steps.length - 1 && <div className="w-px h-4 bg-gray-200 mt-1" />}
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{tpl?.name || 'Ni predloge'}</p>
                        <p className="text-xs text-gray-400">
                          Dan {step.delay_days}{step.delay_hours ? ` + ${step.delay_hours}h` : ''}
                          {step.condition ? ` · ${step.condition}` : ''}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400"
                        onClick={() => deleteStepMutation.mutate(step.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Create sequence dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova email sekvenca</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Naziv</Label>
              <Input value={form.name || ''} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Npr. Dobrodošlica" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sprožilec (trigger)</Label>
              <Select value={form.trigger || 'manual'} onValueChange={v => setForm(f => ({...f, trigger: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TRIGGERS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Opis</Label>
              <Textarea value={form.description || ''} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Prekliči</Button>
            <Button className="bg-[#1a5c38]" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>Ustvari</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add step dialog */}
      <Dialog open={showStepForm} onOpenChange={setShowStepForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dodaj korak sekvence</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Zamik (dni)</Label>
                <Input type="number" value={stepForm.delay_days || 0} onChange={e => setStepForm(f => ({...f, delay_days: parseInt(e.target.value) || 0}))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Zamik (ure)</Label>
                <Input type="number" value={stepForm.delay_hours || 0} onChange={e => setStepForm(f => ({...f, delay_hours: parseInt(e.target.value) || 0}))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email predloga</Label>
              <Select value={stepForm.template_id || ''} onValueChange={v => setStepForm(f => ({...f, template_id: v}))}>
                <SelectTrigger><SelectValue placeholder="Izberi predlogo..." /></SelectTrigger>
                <SelectContent>
                  {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Pogoj (neobvezno)</Label>
              <Input value={stepForm.condition || ''} onChange={e => setStepForm(f => ({...f, condition: e.target.value}))} placeholder="only_if_not_opened" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStepForm(false)}>Prekliči</Button>
            <Button className="bg-[#1a5c38]" onClick={() => saveStepMutation.mutate(stepForm)} disabled={saveStepMutation.isPending}>Dodaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}