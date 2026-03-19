import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { Square } from 'lucide-react';

const STATUS_STYLES = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
  stopped: 'bg-gray-50 text-gray-600 border-gray-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
};

export default function CustomerSequencesTab({ customer, tenantId }) {
  const queryClient = useQueryClient();
  const [selectedSeqId, setSelectedSeqId] = useState('');

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ['customer-enrollments', customer.id],
    queryFn: () => base44.entities.EmailSequenceEnrollment.filter({ tenant_id: tenantId, customer_id: customer.id }, '-created_date'),
    enabled: !!customer.id,
  });

  const { data: sequences = [] } = useQuery({
    queryKey: ['email-sequences', tenantId],
    queryFn: () => base44.entities.EmailSequence.filter({ tenant_id: tenantId, status: 'active' }),
    enabled: !!tenantId,
  });

  const enrollMutation = useMutation({
    mutationFn: (seqId) => base44.entities.EmailSequenceEnrollment.create({
      tenant_id: tenantId,
      sequence_id: seqId,
      customer_id: customer.id,
      customer_email: customer.email,
      status: 'active',
      current_step: 1,
      started_at: new Date().toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-enrollments', customer.id] });
      setSelectedSeqId('');
    },
  });

  const stopMutation = useMutation({
    mutationFn: (id) => base44.entities.EmailSequenceEnrollment.update(id, { status: 'stopped', stopped_reason: 'Ročno ustavil operator' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customer-enrollments', customer.id] }),
  });

  const enrolledSeqIds = enrollments.filter(e => e.status === 'active').map(e => e.sequence_id);
  const availableSeqs = sequences.filter(s => !enrolledSeqIds.includes(s.id));

  const getSeqName = (id) => sequences.find(s => s.id === id)?.name || id;

  return (
    <div className="space-y-4">
      {/* Enroll */}
      {availableSeqs.length > 0 && (
        <div className="flex gap-2">
          <Select value={selectedSeqId} onValueChange={setSelectedSeqId}>
            <SelectTrigger className="h-8 text-sm flex-1">
              <SelectValue placeholder="Dodaj v sekvenco..." />
            </SelectTrigger>
            <SelectContent>
              {availableSeqs.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" className="bg-[#1a5c38] h-8"
            onClick={() => selectedSeqId && enrollMutation.mutate(selectedSeqId)}
            disabled={!selectedSeqId || enrollMutation.isPending}>
            Dodaj
          </Button>
        </div>
      )}

      {isLoading && <div className="text-center py-6 text-gray-400 text-sm">Nalagam...</div>}
      {!isLoading && enrollments.length === 0 && (
        <div className="text-center py-6 text-gray-400 text-sm">Stranka ni vpisana v nobeno sekvenco.</div>
      )}

      <div className="space-y-2">
        {enrollments.map(enr => (
          <div key={enr.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{getSeqName(enr.sequence_id)}</p>
              <p className="text-xs text-gray-400">
                Korak {enr.current_step}
                {enr.next_send_at && ` · Naslednji: ${format(new Date(enr.next_send_at), 'd. M. HH:mm')}`}
                {enr.started_at && ` · Začetek: ${format(new Date(enr.started_at), 'd. M.')}`}
              </p>
            </div>
            <Badge variant="outline" className={`text-xs border ${STATUS_STYLES[enr.status] || ''}`}>
              {enr.status === 'active' ? 'Aktivna' : enr.status === 'completed' ? 'Zaključena' : enr.status === 'stopped' ? 'Ustavljena' : 'Napaka'}
            </Badge>
            {enr.status === 'active' && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400" title="Ustavi sekvenco"
                onClick={() => stopMutation.mutate(enr.id)}>
                <Square className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}