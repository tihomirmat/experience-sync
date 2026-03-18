import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronRight } from 'lucide-react';

const CHANNEL_COLORS = {
  airbnb: '#FF5A5F', bookingcom: '#003580', gyg: '#FF5A00',
  viator: '#8FBC00', dmo: '#1a5c38', direct: '#6c757d', hub_other: '#9b59b6',
};
const CHANNEL_LABELS = {
  airbnb: 'Airbnb', bookingcom: 'Booking.com', gyg: 'GetYourGuide',
  viator: 'Viator', dmo: 'DMO', direct: 'Direktno', hub_other: 'Ostalo',
};

export default function ExperienceTable({ bookings }) {
  const [expanded, setExpanded] = useState(null);

  const active = bookings.filter(b => b.status !== 'cancelled');

  const expMap = {};
  active.forEach(b => {
    const key = b.experience_title || b.experience_id || 'Neznano';
    if (!expMap[key]) expMap[key] = { title: key, bookings: 0, pax: 0, gross: 0, net: 0, channels: {} };
    expMap[key].bookings += 1;
    expMap[key].pax += b.total_pax || 0;
    expMap[key].gross += b.gross_total || 0;
    expMap[key].net += b.net_total || 0;
    const ch = b.channel || 'direct';
    if (!expMap[key].channels[ch]) expMap[key].channels[ch] = { bookings: 0, net: 0 };
    expMap[key].channels[ch].bookings += 1;
    expMap[key].channels[ch].net += b.net_total || 0;
  });

  const rows = Object.values(expMap).sort((a, b) => b.net - a.net);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Po doživetju</h2>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50/50">
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400 w-8"></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">Doživetje</th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">Rez.</th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">Gostov</th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">Bruto</th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">Neto</th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">Povpr. €/gost</th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">Avg. skupina</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-400">Ni podatkov</td></tr>
                )}
                {rows.map((row, i) => (
                  <React.Fragment key={i}>
                    <tr
                      className="border-b hover:bg-gray-50/50 cursor-pointer"
                      onClick={() => setExpanded(expanded === i ? null : i)}
                    >
                      <td className="px-4 py-3 text-gray-400">
                        {expanded === i ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="px-4 py-3 font-medium">{row.title}</td>
                      <td className="text-right px-4 py-3">{row.bookings}</td>
                      <td className="text-right px-4 py-3">{row.pax}</td>
                      <td className="text-right px-4 py-3">€{row.gross.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                      <td className="text-right px-4 py-3 font-medium">€{row.net.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                      <td className="text-right px-4 py-3 text-gray-600">
                        {row.pax > 0 ? `€${(row.net / row.pax).toFixed(2)}` : '—'}
                      </td>
                      <td className="text-right px-4 py-3 text-gray-600">
                        {row.bookings > 0 ? (row.pax / row.bookings).toFixed(1) : '—'}
                      </td>
                    </tr>
                    {expanded === i && (
                      <tr className="bg-gray-50/30 border-b">
                        <td colSpan={8} className="px-10 py-3">
                          <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Razčlenitev po kanalih</p>
                          <div className="flex flex-wrap gap-3">
                            {Object.entries(row.channels).map(([ch, d]) => (
                              <div key={ch} className="flex items-center gap-2 text-xs bg-white border rounded-lg px-3 py-2">
                                <div className="w-2 h-2 rounded-full" style={{ background: CHANNEL_COLORS[ch] || '#888' }} />
                                <span className="font-medium">{CHANNEL_LABELS[ch] || ch}</span>
                                <span className="text-gray-400">{d.bookings} rez.</span>
                                <span className="text-gray-600">€{d.net.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}