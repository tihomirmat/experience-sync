import React from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

function StatCard({ label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs text-gray-400 font-medium mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color || 'text-gray-900'}`}>€{value.toFixed(2)}</p>
    </div>
  );
}

export default function InvoiceFinanceSection({ invoices, bookings, tenantId }) {
  const queryClient = useQueryClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const thisMonthInvoices = invoices.filter(i => i.issue_date && new Date(i.issue_date) >= monthStart);
  const thisMonthBookings = bookings.filter(b => b.departure_date && new Date(b.departure_date) >= monthStart);

  const fakturirano = thisMonthInvoices.filter(i => i.status !== 'cancelled').reduce((s, i) => s + (i.gross_total || 0), 0);
  const placano = thisMonthInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.gross_total || 0), 0);
  const neporavnano = invoices.filter(i => i.status === 'sent' || i.status === 'draft').reduce((s, i) => s + (i.gross_total || 0), 0);
  const provizije = thisMonthBookings.reduce((s, b) => s + (b.commission_total || 0), 0);

  const unpaid = invoices
    .filter(i => i.status === 'sent' || i.status === 'draft')
    .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));

  const markPaidMutation = useMutation({
    mutationFn: ({ id }) => base44.entities.Invoice.update(id, {
      status: 'paid',
      notes: `Plačano: ${format(new Date(), 'dd.MM.yyyy')}`,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Račun označen kot plačan');
    },
  });

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold text-gray-700">Finančni status računov</h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Fakturirano (ta mesec)" value={fakturirano} color="text-blue-700" />
        <StatCard label="Plačano (ta mesec)" value={placano} color="text-[#1a5c38]" />
        <StatCard label="Neporavnano" value={neporavnano} color="text-amber-600" />
        <StatCard label="Provizije OTA (ta mesec)" value={provizije} color="text-red-600" />
      </div>

      {unpaid.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60">
            <p className="text-sm font-semibold text-gray-700">Neplačani računi</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400">Številka</th>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400">Stranka</th>
                <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-400">Znesek</th>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400">Rok plačila</th>
                <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400">Zamuda</th>
                <th className="px-5 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {unpaid.map(inv => {
                const overdue = inv.due_date ? differenceInDays(new Date(), new Date(inv.due_date)) : 0;
                return (
                  <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-5 py-3 font-mono text-xs font-medium text-[#1a5c38]">{inv.invoice_number}</td>
                    <td className="px-5 py-3 text-gray-700">{inv.company_name || inv.customer_name || '—'}</td>
                    <td className="px-5 py-3 text-right font-semibold">€{(inv.gross_total || 0).toFixed(2)}</td>
                    <td className="px-5 py-3 text-gray-500">{inv.due_date || '—'}</td>
                    <td className="px-5 py-3">
                      {overdue > 0
                        ? <span className="text-red-600 font-medium">{overdue} dni</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                        onClick={() => markPaidMutation.mutate({ id: inv.id })}
                        disabled={markPaidMutation.isPending}>
                        <CheckCircle className="w-3 h-3" /> Plačano
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}