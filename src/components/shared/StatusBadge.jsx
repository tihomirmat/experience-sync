import { cn } from '@/lib/utils';

const STYLES = {
  // booking status
  confirmed: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-red-100 text-red-800',
  completed: 'bg-blue-100 text-blue-800',
  no_show: 'bg-gray-100 text-gray-600',
  // experience/departure
  active: 'bg-green-100 text-green-800',
  draft: 'bg-gray-100 text-gray-600',
  archived: 'bg-red-100 text-red-700',
  open: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-600',
  blocked: 'bg-yellow-100 text-yellow-800',
  // inquiry/offer
  new: 'bg-blue-100 text-blue-800',
  in_negotiation: 'bg-yellow-100 text-yellow-800',
  offer_sent: 'bg-purple-100 text-purple-800',
  accepted: 'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-700',
  expired: 'bg-red-100 text-red-700',
  sent: 'bg-yellow-100 text-yellow-800',
  // sync
  received: 'bg-blue-100 text-blue-800',
  processed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-700',
  error: 'bg-red-100 text-red-700',
  // comm
  scheduled: 'bg-blue-100 text-blue-800',
  // quibi
  unconfigured: 'bg-gray-100 text-gray-600',
};

const LABELS = {
  confirmed: 'Potrjeno', pending: 'V čakanju', cancelled: 'Odpovedano',
  completed: 'Zaključeno', no_show: 'Ni prišel', active: 'Aktivno',
  draft: 'Osnutek', archived: 'Arhivirano', open: 'Odprto', closed: 'Zaprto',
  blocked: 'Blokirano', new: 'Novo', in_negotiation: 'V pogajanju',
  offer_sent: 'Ponudba poslana', accepted: 'Sprejeto', declined: 'Zavrnjeno',
  expired: 'Poteklo', sent: 'Poslano', received: 'Prejeto', processed: 'Obdelano',
  failed: 'Napaka', error: 'Napaka', scheduled: 'Načrtovano', unconfigured: 'Ni nastavljeno',
};

export default function StatusBadge({ status, className }) {
  if (!status) return null;
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      STYLES[status] || 'bg-gray-100 text-gray-600',
      className
    )}>
      {LABELS[status] || status}
    </span>
  );
}