import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { useTenant } from '../shared/TenantContext';
import { CheckCircle2, Circle, ArrowRight, Sprout, X } from 'lucide-react';

/**
 * OnboardingChecklist
 * A gentle, data-driven "getting started" card for the Dashboard.
 * Steps tick themselves off automatically from real data (no manual marking),
 * so the farmer always sees exactly what's left. Hides itself once the three
 * core steps are done, or if dismissed.
 */
export default function OnboardingChecklist() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const storageKey = `os_onboarding_dismissed_${tenantId}`;
  const [dismissed, setDismissed] = React.useState(() => {
    try { return localStorage.getItem(storageKey) === '1'; } catch { return false; }
  });

  const countOpts = (entity, key) => ({
    queryKey: [key, tenantId],
    queryFn: () => base44.entities[entity].filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
    select: (d) => d.length,
    staleTime: 30000,
  });

  const { data: expCount = 0 } = useQuery(countOpts('Experience', 'ob-exp'));
  const { data: bookCount = 0 } = useQuery(countOpts('Booking', 'ob-book'));
  const { data: invConnCount = 0 } = useQuery(countOpts('InvoicingConnection', 'ob-inv'));
  const { data: hubCount = 0 } = useQuery(countOpts('HubConnection', 'ob-hub'));

  if (!tenantId || dismissed) return null;

  const steps = [
    {
      done: expCount > 0,
      title: 'Dodajte prvo doživetje',
      desc: 'Degustacija, delavnica ali nastanitev za najem.',
      cta: 'Dodaj doživetje',
      to: createPageUrl('Experiences') + '?new=1',
    },
    {
      done: bookCount > 0,
      title: 'Zabeležite prvo rezervacijo',
      desc: 'Ročno v nekaj sekundah — ali samodejno prek povezanega kanala.',
      cta: 'Nova rezervacija',
      to: createPageUrl('Bookings') + '?new=1',
    },
    {
      done: invConnCount > 0,
      title: 'Povežite izdajanje računov',
      desc: 'Quibi ali Čebelca — računi se izdajo samodejno ob potrjeni rezervaciji.',
      cta: 'Poveži račune',
      to: createPageUrl('Integrations'),
    },
    {
      done: hubCount > 0,
      optional: true,
      title: 'Povežite prodajni kanal',
      desc: 'FareHarbor, Bokun, Viator … rezervacije se uvozijo same. (neobvezno)',
      cta: 'Poveži kanal',
      to: createPageUrl('Integrations'),
    },
  ];

  const coreSteps = steps.filter(s => !s.optional);
  const coreDone = coreSteps.filter(s => s.done).length;
  // Hide entirely once the three core steps are complete.
  if (coreDone === coreSteps.length) return null;

  const pct = Math.round((coreDone / coreSteps.length) * 100);
  const firstOpen = steps.find(s => !s.done);

  const dismiss = () => {
    try { localStorage.setItem(storageKey, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
          <Sprout className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-gray-900">Začnimo 🌱</h2>
          <p className="text-sm text-gray-500">Še {coreSteps.length - coreDone} {coreSteps.length - coreDone === 1 ? 'korak' : 'koraki'} do prve prodaje. Vzame le nekaj minut.</p>
        </div>
        <button onClick={dismiss} className="text-gray-300 hover:text-gray-500 shrink-0" title="Skrij">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress */}
      <div className="mt-4 mb-1 flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-emerald-100 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-medium text-emerald-700">{coreDone}/{coreSteps.length}</span>
      </div>

      {/* Steps */}
      <div className="mt-4 space-y-1">
        {steps.map((s, i) => {
          const isNext = firstOpen === s;
          return (
            <div key={i} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${isNext ? 'bg-white border border-emerald-200 shadow-sm' : ''}`}>
              {s.done
                ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                : <Circle className={`w-5 h-5 shrink-0 ${isNext ? 'text-emerald-400' : 'text-gray-300'}`} />}
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${s.done ? 'text-gray-400 line-through' : 'text-gray-900 font-medium'}`}>{s.title}</p>
                {!s.done && isNext && <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>}
              </div>
              {!s.done && isNext && (
                <Link to={s.to} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors shrink-0">
                  {s.cta} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
