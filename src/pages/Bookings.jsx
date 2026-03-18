import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import StatusBadge from '../components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { FileText, Mail, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const CHANNEL_COLORS = {
  airbnb: '#ff5a5f', bookingcom: '#003580', viator: '#1a7fc1',
  gyg: '#ff8000', direct: '#1a5c38', hub_other: '#888'
};

export default function Bookings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [filterChannel, setFilterChannel] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState('');

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => base44.entities.Booking.list('-departure_date', 500),
  });

  const invoiceMutation = useMutation({
    mutationFn: (booking_id) => base44.functions.invoke('quibiCreateInvoice', { booking_id, invoice_type: 'invoice' }),
    onSuccess: () => { toast({ title: 'Račun ustvarjen' }); qc.invalidateQueries({ queryKey: ['bookings'] }); },
    onError: (e) => toast({ title: 'Napaka', description: e.message, variant: 'destructive' }),
  });

  const emailMutation = useMutation({
    mutationFn: async (booking) => {
      const comms = await base44.entities.GuestCommunication.filter({ booking_id: booking.id });
      if (comms.length > 0) {
        return base44.functions.invoke('sendGuestCommunication', { communication_id: comms[0].id });
      }
      const comm = await base44.entities.GuestCommunication.create({
        tenant_id: booking.tenant_id, booking_id: booking.id,
        guest_email: booking.customer_email, guest_name: booking.customer_name,
        type: 'confirmation', status: 'scheduled',
      });
      return base44.functions.invoke('sendGuestCommunication', { communication_id: comm.id });
    },
    onSuccess: () => toast({ title: 'Email poslan' }),
    onError: (e) => toast({ title: 'Napaka', description: e.message, variant: 'destructive' }),
  });

  const filtered = bookings.filter(b => {
    if (filterChannel !== 'all' && b.channel !== filterChannel) return false;
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    if (filterDate && b.departure_date !== filterDate) return false;
    return true;
  });

  const columns = [
    { header: 'Gost', render: r => <div><p className="font-medium text-gray-900">{r.customer_name || '—'}</p><p className="text-xs text-gray-400">{r.customer_email}</p></div> },
    { header: 'Doživetje', render: r => <span className="text-gray-700 truncate block max-w-[180px]">{r.experience_title || '—'}</span> },
    { header: 'Datum', render: r => <span className="text-gray-600">{r.departure_date || '—'} {r.departure_time || ''}</span> },
    { header: 'Kanal', render: r => <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: (CHANNEL_COLORS[r.channel] || '#888') + '20', color: CHANNEL_COLORS[r.channel] || '#888' }}>{r.channel || '—'}</span> },
    { header: 'Bruto', render: r => <span className="font-medium">€{(r.gross_total || 0).toFixed(2)}</span> },
    { header: 'Neto', render: r => <span className="font-medium text-[#1a5c38]">€{(r.net_total || 0).toFixed(2)}</span> },
    { header: 'Status', render: r => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader title="Rezervacije" subtitle={`${filtered.length} rezervacij`}>
        <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="w-40" />
        <Select value={filterChannel} onValueChange={setFilterChannel}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Kanal" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vsi kanali</SelectItem>
            {['airbnb', 'bookingcom', 'viator', 'gyg', 'direct'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vsi statusi</SelectItem>
            {['pending', 'confirmed', 'completed', 'cancelled', 'no_show'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </PageHeader>

      <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={setSelected} />

      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-[420px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Rezervacija</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="mt-4 space-y-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Gost', selected.customer_name], ['Email', selected.customer_email],
                  ['Tel', selected.customer_phone], ['Odrasli', selected.adults],
                  ['Skupaj oseb', selected.total_pax], ['Kanal', selected.channel],
                  ['Datum', selected.departure_date], ['Čas', selected.departure_time],
                  ['Bruto', `€${(selected.gross_total || 0).toFixed(2)}`],
                  ['Neto', `€${(selected.net_total || 0).toFixed(2)}`],
                  ['DDV', `€${(selected.vat_total || 0).toFixed(2)}`],
                  ['Provizija', `€${(selected.commission_total || 0).toFixed(2)}`],
                ].map(([k, v]) => (
                  <div key={k}><p className="text-xs text-gray-400">{k}</p><p className="font-medium">{v || '—'}</p></div>
                ))}
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <Button onClick={() => invoiceMutation.mutate(selected.id)} disabled={invoiceMutation.isPending}
                  className="w-full bg-[#1a5c38] hover:bg-[#134a2c] gap-2">
                  <FileText className="w-4 h-4" /> Ustvari račun
                </Button>
                <Button variant="outline" onClick={() => emailMutation.mutate(selected)} disabled={emailMutation.isPending}
                  className="w-full gap-2">
                  <Mail className="w-4 h-4" /> Pošlji email
                </Button>
              </div>
              {selected.notes && <div className="text-sm text-gray-600 border-t pt-3"><p className="text-xs text-gray-400 mb-1">Opomba</p><p>{selected.notes}</p></div>}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}