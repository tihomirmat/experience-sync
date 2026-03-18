import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { getMonth, getYear, getDay, getHours, parseISO } from 'date-fns';

const MONTHS_SL = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];
const DAYS_SL = ['Ned', 'Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob'];

export default function SeasonalitySection({ allBookings }) {
  const currentYear = new Date().getFullYear();
  const prevYear = currentYear - 1;

  // Monthly revenue
  const monthlyData = MONTHS_SL.map((month, i) => {
    const curr = allBookings
      .filter(b => {
        if (!b.departure_date) return false;
        const d = new Date(b.departure_date);
        return getYear(d) === currentYear && getMonth(d) === i && (b.status === 'confirmed' || b.status === 'completed');
      })
      .reduce((s, b) => s + (b.net_total || 0), 0);
    const prev = allBookings
      .filter(b => {
        if (!b.departure_date) return false;
        const d = new Date(b.departure_date);
        return getYear(d) === prevYear && getMonth(d) === i && (b.status === 'confirmed' || b.status === 'completed');
      })
      .reduce((s, b) => s + (b.net_total || 0), 0);
    return { month, curr, prev };
  });

  // Day of week
  const dayData = DAYS_SL.map((day, i) => {
    const count = allBookings.filter(b => {
      if (!b.departure_date) return false;
      return getDay(new Date(b.departure_date)) === i;
    }).length;
    return { day, count };
  });

  // Hour of day
  const hourData = Array.from({ length: 13 }, (_, i) => {
    const hour = i + 8;
    const count = allBookings.filter(b => {
      const time = b.departure_time;
      if (!time) return false;
      const h = parseInt(time.split(':')[0], 10);
      return h === hour;
    }).length;
    return { hour: `${String(hour).padStart(2, '0')}:00`, count };
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Sezonskost &amp; trendi</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue Line Chart */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Neto prihodek po mesecih ({currentYear} vs. {prevYear})</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={v => [`€${v.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`, '']} />
                <Legend formatter={v => v === 'curr' ? `${currentYear}` : `${prevYear}`} />
                <Line type="monotone" dataKey="curr" stroke="#1a5c38" strokeWidth={2.5} dot={{ r: 3 }} name="curr" />
                <Line type="monotone" dataKey="prev" stroke="#9CA3AF" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 2 }} name="prev" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Day of Week */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Rezervacije po dnevu v tednu</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={v => [v, 'Rezervacij']} />
                <Bar dataKey="count" fill="#1a5c38" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Hour of Day */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Rezervacije po uri odhoda</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={hourData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={1} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={v => [v, 'Rezervacij']} />
                <Bar dataKey="count" fill="#1a5c38" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}