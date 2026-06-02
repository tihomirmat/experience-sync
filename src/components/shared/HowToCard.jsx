import React from 'react';
import { Lightbulb, ChevronDown, X } from 'lucide-react';

/**
 * HowToCard
 * A compact, dismissible "how-to" snippet for the top of a page. Plain-language
 * steps for users with little time and little app knowledge. Collapsible, and
 * remembers if the user dismissed it (per storageKey).
 *
 * Usage:
 *   <HowToCard
 *     storageKey="howto-bookings"
 *     title="Kako deluje stran Rezervacije"
 *     steps={['Kliknite Nova rezervacija', 'Izberite doživetje in stranko', 'Shranite — račun lahko ustvarite z enim klikom']}
 *   />
 */
export default function HowToCard({ storageKey, title = 'Kako to deluje', steps = [], intro }) {
  const key = storageKey ? `os_howto_${storageKey}` : null;
  const [dismissed, setDismissed] = React.useState(() => {
    if (!key) return false;
    try { return localStorage.getItem(key) === '1'; } catch { return false; }
  });
  const [open, setOpen] = React.useState(true);

  if (dismissed) return null;

  const dismiss = () => {
    if (key) { try { localStorage.setItem(key, '1'); } catch { /* ignore */ } }
    setDismissed(true);
  };

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 mb-5">
      <div className="flex items-center gap-2.5">
        <Lightbulb className="w-4 h-4 text-blue-500 shrink-0" />
        <button onClick={() => setOpen(o => !o)} className="flex-1 flex items-center gap-2 text-left min-w-0">
          <span className="text-sm font-medium text-blue-900 truncate">{title}</span>
          <ChevronDown className={`w-4 h-4 text-blue-400 transition-transform shrink-0 ${open ? '' : '-rotate-90'}`} />
        </button>
        <button onClick={dismiss} className="text-blue-300 hover:text-blue-500 shrink-0" title="Skrij">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {open && (
        <div className="mt-2.5 pl-7">
          {intro && <p className="text-xs text-blue-800/80 mb-2">{intro}</p>}
          <ol className="space-y-1.5">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-2 text-xs text-blue-900/90">
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-200 text-blue-800 text-[10px] font-semibold shrink-0 mt-0.5">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
