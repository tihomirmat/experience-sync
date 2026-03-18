import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import StatusBadge from '../components/shared/StatusBadge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export default function FareHarborLog() {
  const [selected, setSelected] = useState(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['fareharbor-sync'],
    queryFn: () => base44.entities.FareHarborSync.list('-created_date', 200),
  });

  const columns = [
    { header: 'Čas', render: r => <span className="text-gray-600 text-xs">{r.created_date ? new Date(r.created_date).toLocaleString('sl-SI') : '—'}</span> },
    { header: 'Company', render: r => <span className="font-medium">{r.company_shortname || '—'}</span> },
    { header: 'Event type', render: r => <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{r.event_type || '—'}</span> },
    { header: 'Booking ID', render: r => <span className="font-mono text-xs">{r.booking_id_external || '—'}</span> },
    { header: 'Status', render: r => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader title="FareHarbor Sync Log" subtitle="Zgodovina webhook dogodkov iz FareHarbor" />
      <DataTable columns={columns} data={logs} isLoading={isLoading} onRowClick={setSelected} />

      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-[500px] overflow-y-auto">
          <SheetHeader><SheetTitle>Webhook payload</SheetTitle></SheetHeader>
          {selected && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Event type', selected.event_type], ['Company', selected.company_shortname],
                  ['Booking ID', selected.booking_id_external], ['Status', selected.status],
                  ['Čas', selected.created_date ? new Date(selected.created_date).toLocaleString('sl-SI') : '—'],
                ].map(([k, v]) => <div key={k}><p className="text-xs text-gray-400">{k}</p><p className="font-medium">{v || '—'}</p></div>)}
              </div>
              {selected.error && <div className="bg-red-50 p-3 rounded text-sm text-red-600"><strong>Napaka:</strong> {selected.error}</div>}
              {selected.payload_json && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Raw payload:</p>
                  <pre className="bg-gray-50 rounded p-3 text-xs overflow-auto max-h-96 whitespace-pre-wrap">
                    {JSON.stringify(JSON.parse(selected.payload_json), null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}