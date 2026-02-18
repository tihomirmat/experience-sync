import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '../components/shared/TenantContext';
import PageHeader from '../components/shared/PageHeader';
import StatCard from '../components/shared/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Users, FileText, Percent, TrendingUp, ShoppingBag } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const COLORS = ['#2563EB', '#059669', '#D97706', '#DC2626', '#8B5CF6', '#EC4899'];

export default function Reports() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const [period, setPeriod] = useState('all');

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings-report', tenantId],
    queryFn: () => base44.entities.Booking.filter({ tenant_id: tenantId }, '-created_date', 500),
    enabled: !!tenantId,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices-report', tenantId],
    queryFn: () => base44.entities.Invoice.filter({ tenant_id: tenantId }, '-created_date', 500),
    enabled: !!tenantId,
  });

  const confirmedBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed');
  const totalRevenue = confirmedBookings.reduce((sum, b) => sum + (b.gross_total || 0), 0);
  const totalVat = confirmedBookings.reduce((sum, b) => sum + (b.vat_total || 0), 0);
  const totalCommission = confirmedBookings.reduce((sum, b) => sum + (b.commission_total || 0), 0);
  const totalPax = confirmedBookings.reduce((sum, b) => sum + (b.total_pax || b.adults || 0), 0);
  const avgBookingValue = confirmedBookings.length > 0 ? totalRevenue / confirmedBookings.length : 0;

  // Channel mix
  const channelMix = useMemo(() => {
    const mix = {};
    confirmedBookings.forEach(b => {
      const ch = b.channel || 'direct';
      mix[ch] = (mix[ch] || 0) + (b.gross_total || 0);
    });
    return Object.entries(mix).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }));
  }, [confirmedBookings]);

  // Monthly revenue
  const monthlyRevenue = useMemo(() => {
    const months = {};
    confirmedBookings.forEach(b => {
      const month = b.departure_date?.slice(0, 7) || b.created_date?.slice(0, 7) || 'unknown';
      months[month] = (months[month] || 0) + (b.gross_total || 0);
    });
    return Object.entries(months).sort().map(([month, revenue]) => ({ month, revenue: parseFloat(revenue.toFixed(2)) }));
  }, [confirmedBookings]);

  // Invoice status
  const invoiceStatus = useMemo(() => {
    const statuses = {};
    invoices.forEach(i => {
      statuses[i.status] = (statuses[i.status] || 0) + (i.gross_total || 0);
    });
    return Object.entries(statuses).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }));
  }, [invoices]);

  if (!tenantId) return null;

  return (
    <div>
      <PageHeader title="Reports" subtitle="Revenue, channels, and financial overview">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Revenue" value={`€${totalRevenue.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`} icon={DollarSign} color="green" />
        <StatCard title="Total Pax" value={totalPax.toLocaleString()} icon={Users} color="blue" />
        <StatCard title="Avg Booking" value={`€${avgBookingValue.toFixed(2)}`} icon={ShoppingBag} color="purple" />
        <StatCard title="VAT Collected" value={`€${totalVat.toFixed(2)}`} icon={Percent} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Revenue Over Time */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base font-medium">Revenue Over Time</CardTitle></CardHeader>
          <CardContent>
            {monthlyRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `€${v}`} />
                  <Line type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2} dot={{ fill: '#2563EB', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-gray-400 text-center py-16">No data yet</p>}
          </CardContent>
        </Card>

        {/* Channel Mix */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base font-medium">Channel Revenue Mix</CardTitle></CardHeader>
          <CardContent>
            {channelMix.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={channelMix} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {channelMix.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `€${v}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-gray-400 text-center py-16">No data yet</p>}
          </CardContent>
        </Card>
      </div>

      {/* Invoice Summary */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-base font-medium">Invoice Status Breakdown</CardTitle></CardHeader>
        <CardContent>
          {invoiceStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={invoiceStatus}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => `€${v}`} />
                <Bar dataKey="value" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center py-16">No invoices yet</p>}
        </CardContent>
      </Card>
    </div>
  );
}