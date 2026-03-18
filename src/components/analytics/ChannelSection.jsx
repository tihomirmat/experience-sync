import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const CHANNEL_COLORS = {
  airbnb: '#FF5A5F',
  bookingcom: '#003580',
  gyg: '#FF5A00',
  viator: '#8FBC00',
  dmo: '#1a5c38',
  direct: '#6c757d',
  hub_other: '#9b59b6',
};

const CHANNEL_LABELS = {
  airbnb: 'Airbnb',
  bookingcom: 'Booking.com',
  gyg: 'GetYourGuide',
  viator: 'Viator',
  dmo: 'DMO',
  direct: 'Direktno',
  hub_other: 'Ostalo',
};

export default function ChannelSection({ bookings }) {
  const active = bookings.filter(b => b.status !== 'cancelled');
  const totalNet = active.reduce((s, b) => s + (b.net_total || 0), 0);

  const channelMap = {};
  active.forEach(b => {
    const ch = b.channel || 'direct';
    if (!channelMap[ch]) channelMap[ch] = { bookings: 0, gross: 0, commission: 0, net: 0 };
    channelMap[ch].bookings += 1;
    channelMap[ch].gross += b.gross_total || 0;
    channelMap[ch].commission += b.commission_total || 0;
    channelMap[ch].net += b.net_total || 0;
  });

  const channelData = Object.entries(channelMap)
    .map(([ch, d]) => ({
      channel: ch,
      label: CHANNEL_LABELS[ch] || ch,
      color: CHANNEL_COLORS[ch] || '#888',
      ...d,
      share: totalNet > 0 ? ((d.net / totalNet) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.net - a.net);

  const totalBookings = active.length;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Prihodek po kanalih</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Horizontal Bar Chart */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Neto prihodek po kanalu</CardTitle>
          </CardHeader>
          <CardContent>
            {channelData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={channelData} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `€${v.toLocaleString('de-DE')}`} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} width={90} />
                  <Tooltip formatter={v => [`€${v.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`, 'Neto']} />
                  <Bar dataKey="net" radius={[0, 4, 4, 0]}>
                    {channelData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-60 text-gray-400 text-sm">Ni podatkov</div>
            )}
          </CardContent>
        </Card>

        {/* Donut Chart */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Porazdelitev rezervacij</CardTitle>
          </CardHeader>
          <CardContent>
            {channelData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={channelData} dataKey="bookings" nameKey="label" cx="50%" cy="45%" innerRadius={55} outerRadius={85}>
                    {channelData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend formatter={(v) => <span className="text-xs">{v}</span>} />
                  <Tooltip formatter={v => [v, 'Rezervacij']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-60 text-gray-400 text-sm">Ni podatkov</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50/50">
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">Kanal</th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">Rezervacije</th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">Bruto</th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">Provizija</th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">Neto</th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-400">Delež %</th>
                </tr>
              </thead>
              <tbody>
                {channelData.map((row, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: row.color }} />
                        {row.label}
                      </div>
                    </td>
                    <td className="text-right px-4 py-3 text-gray-600">{row.bookings}</td>
                    <td className="text-right px-4 py-3 text-gray-600">€{row.gross.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                    <td className="text-right px-4 py-3 text-gray-600">€{row.commission.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                    <td className="text-right px-4 py-3 font-medium">€{row.net.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                    <td className="text-right px-4 py-3 text-gray-600">{row.share}%</td>
                  </tr>
                ))}
                {channelData.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">Ni podatkov</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}