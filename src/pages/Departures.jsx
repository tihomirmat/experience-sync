import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import StatusBadge from '../components/shared/StatusBadge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Departures() {
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState('');

  const { data: departures = [], isLoading } = useQuery({
    queryKey: ['departures'],
    queryFn: () => base44.entities.Departure.list('-start_at', 300),
  });

  const filtered = departures.filter(d => {
    if (filterStatus !== 'all' && d.status !== filterStatus) return false;
    if (filterDate) {
      const dDate = d.start_at?.split('T')[0];
      if (dDate !== filterDate) return false;
    }
    return true;
  });

  const columns = [
    { header: 'Doživetje', render: r => <span className="font-medium">{r.experience_title || r.experience_id}</span> },
    { header: 'Datum & Čas', render: r => <span>{r.start_at ? new Date(r.start_at).toLocaleString('sl-SI') : '—'}</span> },
    { header: 'Kapaciteta', render: r => {
      const total = r.capacity_total || 0;
      const remaining = r.capacity_remaining || 0;
      const used = total - remaining;
      const pct = total > 0 ? (used / total) * 100 : 0;
      return (
        <div className="w-32">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{used}/{total}</span>
            <span>{pct.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[#1a5c38] transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      );
    }},
    { header: 'Cena', render: r => <span>€{(r.price_cached || 0).toFixed(2)}</span> },
    { header: 'Status', render: r => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader title="Termini" subtitle={`${filtered.length} terminov`}>
        <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="w-40" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vsi statusi</SelectItem>
            <SelectItem value="open">Odprti</SelectItem>
            <SelectItem value="closed">Zaprti</SelectItem>
            <SelectItem value="cancelled">Odpovedani</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>
      <DataTable columns={columns} data={filtered} isLoading={isLoading} />
    </div>
  );
}