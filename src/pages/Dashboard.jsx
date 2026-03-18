import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '../components/shared/TenantContext';
import PageHeader from '../components/shared/PageHeader';
import StatCard from '../components/shared/StatCard';
import StatusBadge from '../components/shared/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  Inbox, FileText, Users, Calendar, TrendingUp, ArrowRight,
  DollarSign, ShoppingBag, Globe, AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const { currentTenant, loading: tenantLoading } = useTenant();
  const tenantId = currentTenant?.id;

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['bookings', tenantId],
    queryFn: () => base44.entities.Booking.filter({ tenant_id: tenantId }, '-created_date', 50),
    enabled: !!tenantId,
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices', tenantId],
    queryFn: () => base44.entities.Invoice.filter({ tenant_id: tenantId }, '-created_date', 20),
    enabled: !!tenantId,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['alerts', tenantId],
    queryFn: () => base44.entities.Alert.filter({ tenant_id: tenantId, resolved: false }, '-created_date', 10),
    enabled: !!tenantId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-count', tenantId],
    queryFn: () => base44.entities.Customer.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });

  if (tenantLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  if (!currentTenant) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
          <ShoppingBag className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Welcome to Experience Ops</h2>
        <p className="text-gray-500 mb-6 text-center max-w-md">
          Create your first tenant to get started with managing experiences, bookings, and invoicing.
        </p>
        <Link 
          to={createPageUrl('IntegrationSettings')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Get Started <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  const totalRevenue = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed')
    .reduce((sum, b) => sum + (b.gross_total || 0), 0);
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
  const pendingInvoices = invoices.filter(i => i.status === 'draft' || i.status === 'sent').length;

  // Simple channel chart data
  const channelData = bookings.reduce((acc, b) => {
    const ch = b.channel || 'direct';
    acc[ch] = (acc[ch] || 0) + 1;
    return acc;
  }, {});
  const chartData = Object.entries(channelData).map(([name, count]) => ({ name, count }));

  const recentBookings = bookings.slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader 
        title={`Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}`}
        subtitle={`${currentTenant.name} · ${format(new Date(), 'EEEE, MMM d, yyyy')}`}
      />

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">{alerts.length} active alert{alerts.length > 1 ? 's' : ''}</p>
            <p className="text-xs text-amber-600 mt-0.5">{alerts[0]?.message}</p>
          </div>
          <Link to={createPageUrl('Monitoring')} className="ml-auto text-xs text-amber-700 hover:underline shrink-0">
            View all
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Revenue" value={`€${totalRevenue.toLocaleString('de-DE', { minimumFractionDigits: 2 })}`} icon={DollarSign} color="green" />
        <StatCard title="Bookings" value={confirmedBookings} icon={Inbox} color="blue" />
        <StatCard title="Customers" value={customers.length} icon={Users} color="purple" />
        <StatCard title="Open Invoices" value={pendingInvoices} icon={FileText} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Channel Mix */}
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Booking Channels</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-60 text-gray-400 text-sm">
                No booking data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Bookings */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium">Recent Bookings</CardTitle>
            <Link to={createPageUrl('Bookings')} className="text-xs text-blue-600 hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            {bookingsLoading ? (
              <div className="space-y-3">
                {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : recentBookings.length > 0 ? (
              <div className="space-y-3">
                {recentBookings.map(b => (
                  <div key={b.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{b.customer_name || 'Guest'}</p>
                      <p className="text-xs text-gray-400 truncate">{b.experience_title}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <StatusBadge status={b.status} />
                      <p className="text-xs text-gray-400 mt-1">€{(b.gross_total || 0).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No bookings yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}