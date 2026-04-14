import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { subDays, parseISO, isAfter } from 'date-fns';

const CHANNEL_LABELS = {
  direct: 'Direct',
  airbnb: 'Airbnb',
  gyg: 'GetYourGuide',
  bookingcom: 'Booking.com',
  dmo: 'DMO',
  hub_other: 'Other Hub',
  viator: 'Viator',
  tripadvisor: 'TripAdvisor',
  klook: 'Klook',
};

export default function ChannelPerformanceTable({ tenantId }) {
  const cutoff = subDays(new Date(), 30);

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['channel-perf-bookings', tenantId],
    queryFn: () => base44.entities.Booking.filter({ tenant_id: tenantId }, '-created_date', 500),
    enabled: !!tenantId,
  });

  const stats = useMemo(() => {
    const recent = bookings.filter(b => {
      const d = b.created_date ? parseISO(b.created_date) : null;
      return d && isAfter(d, cutoff);
    });

    const map = {};
    recent.forEach(b => {
      const ch = b.channel || 'direct';
      if (!map[ch]) map[ch] = { bookings: 0, revenue: 0, commission: 0 };
      map[ch].bookings += 1;
      map[ch].revenue += b.gross_total || 0;
      map[ch].commission += b.commission_total || ((b.gross_total || 0) * 0);
    });

    return Object.entries(map)
      .map(([channel, d]) => ({
        channel,
        label: CHANNEL_LABELS[channel] || channel,
        bookings: d.bookings,
        revenue: d.revenue,
        commission: d.commission,
        avg: d.bookings > 0 ? d.revenue / d.bookings : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [bookings]);

  if (isLoading) return <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />;

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60">
        <h3 className="text-sm font-semibold text-gray-700">Channel Performance — last 30 days</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-50">
            {['Channel', 'Bookings', 'Revenue', 'Commission Paid', 'Avg Value'].map(h => (
              <th key={h} className="text-left px-5 py-3 text-xs font-medium text-gray-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stats.length === 0 && (
            <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400 text-xs">No bookings in last 30 days</td></tr>
          )}
          {stats.map(row => (
            <tr key={row.channel} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="px-5 py-3 font-medium text-gray-800">{row.label}</td>
              <td className="px-5 py-3 text-gray-600">{row.bookings}</td>
              <td className="px-5 py-3 font-medium text-[#1a5c38]">€{row.revenue.toFixed(2)}</td>
              <td className="px-5 py-3 text-red-500">{row.commission > 0 ? `€${row.commission.toFixed(2)}` : '—'}</td>
              <td className="px-5 py-3 text-gray-600">€{row.avg.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}