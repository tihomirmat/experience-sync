/**
 * QuickSequenceSetup
 * Guides the user through creating the 3 standard post-booking sequences:
 *  1. Potrditev rezervacije (booking_confirmed) — step 0: immediately
 *  2. Povpraševanje po mnenju (booking_completed) — step 0: immediately
 *  3. Zahvalno sporočilo (booking_completed) — step 3 days after
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Zap, Star, Heart } from 'lucide-react';

const PRESETS = [
  {
    key: 'booking_confirmation',
    icon: CheckCircle2,
    color: 'text-emerald-600 bg-emerald-50',
    title: 'Potrditev rezervacije',
    description: 'Pošlje potrditev takoj, ko je rezervacija potrjena.',
    trigger: 'booking_confirmed',
    steps: [
      { step_number: 1, delay_days: 0, delay_hours: 0, templateName: 'Potrditev rezervacije' }
    ],
    templateDefaults: {
      name: 'Potrditev rezervacije',
      category: 'booking_confirmation',
      subject: 'Vaša rezervacija je potrjena ✓ – {{experience_title}}',
      body_html: `<p>Spoštovani/a {{customer_name}},</p>
<p>z veseljem vam potrjujemo rezervacijo za <strong>{{experience_title}}</strong>.</p>
<p><strong>Datum:</strong> {{departure_date}}</p>
<p>V primeru vprašanj smo vam na voljo. Se vidimo kmalu!</p>
<p>Lep pozdrav,<br>Ekipa</p>`,
      language: 'sl',
      is_active: true,
    }
  },
  {
    key: 'review_request',
    icon: Star,
    color: 'text-amber-600 bg-amber-50',
    title: 'Povpraševanje po mnenju',
    description: 'Pošlje prošnjo za oceno 1 dan po zaključeni rezervaciji.',
    trigger: 'booking_completed',
    steps: [
      { step_number: 1, delay_days: 1, delay_hours: 0, templateName: 'Povpraševanje po mnenju' }
    ],
    templateDefaults: {
      name: 'Povpraševanje po mnenju',
      category: 'custom',
      subject: 'Kako vam je bilo? Delite svojo izkušnjo 🌟',
      body_html: `<p>Spoštovani/a {{customer_name}},</p>
<p>upamo, da ste uživali pri <strong>{{experience_title}}</strong>.</p>
<p>Vaše mnenje nam je izjemno pomembno. Prosimo, da nam zaupate svojo izkušnjo in nas ocenite.</p>
<p>Hvala za zaupanje!</p>
<p>Lep pozdrav,<br>Ekipa</p>`,
      language: 'sl',
      is_active: true,
    }
  },
  {
    key: 'thank_you',
    icon: Heart,
    color: 'text-rose-600 bg-rose-50',
    title: 'Zahvalno sporočilo',
    description: 'Pošlje zahvalo 3 dni po zaključeni rezervaciji.',
    trigger: 'booking_completed',
    steps: [
      { step_number: 1, delay_days: 3, delay_hours: 0, templateName: 'Zahvalno sporočilo' }
    ],
    templateDefaults: {
      name: 'Zahvalno sporočilo',
      category: 'custom',
      subject: 'Hvala, {{customer_name}}! Pridite spet 🙏',
      body_html: `<p>Spoštovani/a {{customer_name}},</p>
<p>iskreno se vam zahvaljujemo, da ste izbrali nas za <strong>{{experience_title}}</strong>.</p>
<p>Upamo, da se kmalu spet vidimo. Sledite nam za posebne ponudbe in novosti.</p>
<p>Topel pozdrav,<br>Ekipa</p>`,
      language: 'sl',
      is_active: true,
    }
  },
];

export default function QuickSequenceSetup({ tenantId, existingSequences = [], onDone }) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(null);
  const [done, setDone] = useState([]);

  const alreadyExists = (preset) =>
    existingSequences.some(s => s.trigger === preset.trigger && s.name.toLowerCase().includes(preset.title.toLowerCase().split(' ')[0].toLowerCase()));

  const createPreset = async (preset) => {
    setCreating(preset.key);
    try {
      // 1. Create template
      const tpl = await base44.entities.EmailTemplate.create({
        ...preset.templateDefaults,
        tenant_id: tenantId,
      });
      // 2. Create sequence
      const seq = await base44.entities.EmailSequence.create({
        tenant_id: tenantId,
        name: preset.title,
        trigger: preset.trigger,
        status: 'active',
        stop_on_reply: true,
        description: preset.description,
      });
      // 3. Create steps
      for (const step of preset.steps) {
        await base44.entities.EmailSequenceStep.create({
          tenant_id: tenantId,
          sequence_id: seq.id,
          step_number: step.step_number,
          delay_days: step.delay_days,
          delay_hours: step.delay_hours,
          template_id: tpl.id,
        });
      }
      setDone(d => [...d, preset.key]);
      queryClient.invalidateQueries({ queryKey: ['email-sequences'] });
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(null);
    }
  };

  const allDone = PRESETS.every(p => done.includes(p.key) || alreadyExists(p));

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-[#1a5c38]/10 flex items-center justify-center">
          <Zap className="w-4 h-4 text-[#1a5c38]" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Hitra postavitev sekvenc po rezervaciji</h3>
          <p className="text-xs text-gray-500">Ustvari standardne sekvence z enim klikom — predloge so pripravljene.</p>
        </div>
      </div>

      <div className="space-y-3">
        {PRESETS.map(preset => {
          const Icon = preset.icon;
          const isDone = done.includes(preset.key) || alreadyExists(preset);
          const isCreating = creating === preset.key;
          return (
            <div key={preset.key} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${isDone ? 'border-emerald-200 bg-emerald-50/40' : 'border-gray-100 bg-white'}`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${preset.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{preset.title}</p>
                <p className="text-xs text-gray-400">{preset.description}</p>
              </div>
              {isDone ? (
                <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium shrink-0">
                  <CheckCircle2 className="w-4 h-4" /> Ustvarjeno
                </div>
              ) : (
                <Button size="sm" className="bg-[#1a5c38] shrink-0 h-8 text-xs"
                  disabled={isCreating}
                  onClick={() => createPreset(preset)}>
                  {isCreating ? 'Ustvarjam...' : 'Ustvari'}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {allDone && (
        <div className="mt-6 p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
          <p className="text-sm font-medium text-emerald-800">✓ Vse standardne sekvence so aktivne!</p>
          <p className="text-xs text-emerald-600 mt-1">Emaili se bodo samodejno pošiljali ob rezervacijah.</p>
          {onDone && <Button size="sm" variant="outline" className="mt-3 border-emerald-300 text-emerald-700" onClick={onDone}>Poglej sekvence →</Button>}
        </div>
      )}
    </div>
  );
}