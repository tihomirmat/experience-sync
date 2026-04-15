import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StopCircle, RefreshCw } from 'lucide-react';

const STATUS_STYLES = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
  stopped: 'bg-amber-50 text-amber-700 border-amber-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
};
const STATUS_LABELS = { active: 'Aktivna', completed: 'Zaključena', stopped: 'Ustavljena', failed: 'Napaka' };

export default function SequenceEnrollmentsTab({ tenantId }) {
  const queryClient = useQueryClient();
  const [filterSeq, setFilterSeq] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const { data: sequences = [] } = useQuery({
    queryKey: ['email-sequences', tenantId],
    queryFn: () => base44.entities.EmailSequence.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ['email-enrollments-all', tenantId],
    queryFn: () => base44.entities.EmailSequenceEnrollment.filter({ tenant_id: tenantId }, '-created_date', 200),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const stopMutation = useMutation({
    mutationFn: (id) => base44.entities.EmailSequenceEnrollment.update(id, { status: 'stopped', stopped_reason: 'Ročno ustavljeno' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-enrollments-all'] }),
  });

  const filtered = enrollments.filter(e => {
    if (filterSeq !== 'all' && e.sequence_id !== filterSeq) return false;
    if (filterStatus !== 'all' && e.status !== filterStatus) return false;
    return true;
  });

  const counts = { active: 0, completed: 0, stopped: 0, failed: 0 };
  enrollments.forEach(e => { if (counts[e.status] !== undefined) counts[e.status]++; });

  return (
    <div className="max-w-4xl space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {Object.entries(counts).map(([status, count]) => (
          <button key={status}
            onClick={() => setFilterStatus(filterStatus === status ? 'all' : status)}
            className={`rounded-xl border p-3 text-center transition-all ${filterStatus === status ? 'ring-2 ring-offset-1 ring-[#1a5c38]' : 'hover:bg-gray-50'}`}
          >
            <p className="text-xl font-bold text-gray-800">{count}</p>
            <p className="text-xs text-gray-400 mt-0.5">{STATUS_LABELS[status]}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={filterSeq} onValueChange={setFilterSeq}>
          <SelectTrigger className="w-52 h-8 text-xs"><SelectValue placeholder="Vse sekvence" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vse sekvence</SelectItem>
            {sequences.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Vsi statusi" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vsi statusi</SelectItem>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs ml-auto"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['email-enrollments-all'] })}>
          <RefreshCw className="w-3 h-3" /> Osveži
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Email</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Sekvenca</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Korak</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Naslednji email</th>
              <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Status</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {isLoading && [...Array(5)].map((_, i) => (
              <tr key={i} className="border-b border-gray-50">
                {[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}
              </tr>
            ))}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">Ni vnosov za izbrane filtre.</td></tr>
            )}
            {!isLoading && filtered.map(enr => {
              const seq = sequences.find(s => s.id === enr.sequence_id);
              const nextDate = enr.next_send_at ? new Date(enr.next_send_at) : null;
              const isPast = nextDate && nextDate < new Date();
              return (
                <tr key={enr.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{enr.customer_email}</td>
                  <td className="px-4 py-3 text-gray-500">{seq?.name || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">Korak {enr.current_step}</td>
                  <td className="px-4 py-3 text-xs">
                    {nextDate ? (
                      <span className={isPast && enr.status === 'active' ? 'text-amber-600 font-medium' : 'text-gray-500'}>
                        {nextDate.toLocaleDateString('sl-SI')} {nextDate.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}
                        {isPast && enr.status === 'active' && ' ⏰'}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={`text-xs border ${STATUS_STYLES[enr.status] || ''}`}>
                      {STATUS_LABELS[enr.status] || enr.status}
                    </Badge>
                    {enr.stopped_reason && <p className="text-xs text-gray-400 mt-0.5">{enr.stopped_reason}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {enr.status === 'active' && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400"
                        onClick={() => stopMutation.mutate(enr.id)}
                        title="Ustavi">
                        <StopCircle className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}