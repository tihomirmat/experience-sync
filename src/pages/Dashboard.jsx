import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Calendar, Users, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import StatusBadge from '../components/shared/StatusBadge';

const CHANNEL_COLORS = {
  airbnb: '#ff5a5f', bookingcom: '#003580', viator: '#1a7fc1',
  gyg: '#ff8000', direct: '#1a5c38', hub_other: '#888'
};

export default function Dashboard() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const { data: bookings = [] } = useQuery({
    queryKey: ['dashboard-bookings'],
    queryFn: () => base44.entities.Booking.list('-departure_date', 200),
  });

  const { data: inquiries = [] } = useQuery({
    queryKey: ['dashboard-inquiries'],
    queryFn: () => base44.entities.PrivateGroupInquiry.filter({ status: 'new' }),
  });

  const { data: failedComms = [] } = useQuery({
    queryKey: ['dashboard-comms-failed'],
    queryFn: () => base44.entities.GuestCommunication.filter({ status: 'failed' }),
  });

  const thisMonthBookings = bookings.filter(b =>
    b.departure_date >= monthStart && b.departure_date <= monthEnd && b.status !== 'cancelled'
  );
  const monthRevenue = thisMonthBookings.reduce((s, b) => s + (b.net_total || 0), 0);

  // Channel revenue for last 30 days
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const recent = bookings.filter(b => b.departure_date >= since30 && b.status !== 'cancelled');
  const channelData = ['airbnb', 'bookingcom', 'viator', 'gyg', 'direct'].map(ch => ({
    channel: ch,
    prihodek: recent.filter(b => b.channel === ch).reduce((s, b) => s + (b.net_total || 0), 0),
  })).filter(d => d.prihodek > 0);

  const last5 = [...bookings].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 5);

  const stats = [
    { label: 'Prihodek ta mesec', value: `€${monthRevenue.toFixed(0)}`, icon: TrendingUp, color: 'text-green-600 bg-green-50' },
    { label: 'Rezervacije ta mesec', value: thisMonthBookings.length, icon: Calendar, color: 'text-blue-600 bg-blue-50' },
    { label: 'Nove poizvedbe', value: inquiries.length, icon: Users, color: 'text-yellow-600 bg-yellow-50', link: '/inquiries' },
    { label: 'Napake v komunikacijah', value: failedComms.length, icon: AlertCircle, color: 'text-red-600 bg-red-50', link: '/communications' },
  ];

  return (
    <div>
      <div className="px-6 py-5 border-b bg-white">
        <h1 className="text-xl font-bold text-gray-900">Nadzorna plošča</h1>
        <p className="text-sm text-gray-500">Dobrodošli v Experience Sync</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => {
            const Icon = s.icon;
            const card = (
              <Card key={i} className={s.link ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}>
                <CardContent className="p-5 flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${s.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            );
            return s.link ? <Link key={i} to={s.link}>{card}</Link> : card;
          })}
        </div>

        {/* Chart */}
        {channelData.length > 0 && (
          <Card>
            <CardContent className="p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Prihodek po kanalih (zadnjih 30 dni)</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={channelData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="channel" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => `€${v.toFixed(2)}`} />
                  <Bar dataKey="prihodek" fill="#1a5c38" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Last 5 bookings */}
        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Zadnje rezervacije</h2>
              <Link to="/bookings" className="text-sm text-[#1a5c38] hover:underline">Vse →</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs text-gray-500 uppercase">
                    <th className="px-4 py-2.5 text-left">Gost</th>
                    <th className="px-4 py-2.5 text-left">Doživetje</th>
                    <th className="px-4 py-2.5 text-left">Datum</th>
                    <th className="px-4 py-2.5 text-left">Kanal</th>
                    <th className="px-4 py-2.5 text-left">Status</th>
                    <th className="px-4 py-2.5 text-right">Neto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {last5.map(b => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{b.customer_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{b.experience_title || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{b.departure_date || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
                          background: (CHANNEL_COLORS[b.channel] || '#888') + '20',
                          color: CHANNEL_COLORS[b.channel] || '#888'
                        }}>{b.channel}</span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                      <td className="px-4 py-3 text-right font-medium">€{(b.net_total || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                  {last5.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Ni rezervacij</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}