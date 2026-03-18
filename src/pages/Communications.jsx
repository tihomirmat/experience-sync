import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import StatusBadge from '../components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const TYPE_LABELS = { confirmation: 'Potrditev', reminder_24h: 'Opomnik 24h', arrival_info: 'Prihod', cancellation: 'Odpoved' };

export default function Communications() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState('all');
  const [sending, setSending] = useState(null);

  const { data: comms = [], isLoading } = useQuery({
    queryKey: ['communications'],
    queryFn: () => base44.entities.GuestCommunication.list('-created_date', 300),
  });

  const sendMutation = useMutation({
    mutationFn: (id) => base44.functions.invoke('sendGuestCommunication', { communication_id: id }),
    onSuccess: () => { toast({ title: 'Email poslan' }); qc.invalidateQueries({ queryKey: ['communications'] }); setSending(null); },
    onError: (e) => { toast({ title: 'Napaka', description: e.message, variant: 'destructive' }); setSending(null); },
  });

  const filtered = comms.filter(c => filterStatus === 'all' || c.status === filterStatus);

  const columns = [
    { header: 'Gost', render: r => <div><p className="font-medium">{r.guest_name || '—'}</p><p className="text-xs text-gray-400">{r.guest_email}</p></div> },
    { header: 'Tip', render: r => <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{TYPE_LABELS[r.type] || r.type}</span> },
    { header: 'Status', render: r => <StatusBadge status={r.status} /> },
    { header: 'Načrtovano', render: r => <span className="text-gray-500 text-xs">{r.scheduled_at ? new Date(r.scheduled_at).toLocaleString('sl-SI') : '—'}</span> },
    { header: 'Poslano', render: r => <span className="text-gray-500 text-xs">{r.sent_at ? new Date(r.sent_at).toLocaleString('sl-SI') : '—'}</span> },
    { header: '', render: r => (
      (r.status === 'scheduled' || r.status === 'failed') && (
        <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setSending(r.id); sendMutation.mutate(r.id); }}
          disabled={sending === r.id} className="gap-1 text-xs h-7">
          <Send className="w-3 h-3" /> Pošlji
        </Button>
      )
    )},
  ];

  return (
    <div>
      <PageHeader title="Gostinska komunikacija" subtitle={`${filtered.length} sporočil`}>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vsi statusi</SelectItem>
            {['scheduled', 'sent', 'failed', 'cancelled'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </PageHeader>
      <DataTable columns={columns} data={filtered} isLoading={isLoading} />
    </div>
  );
}