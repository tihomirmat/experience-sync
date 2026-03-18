import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Inbox, Globe, Users } from 'lucide-react';

function KpiCard({ title, value, subtitle, trend, icon: Icon, iconColor }) {
  const trendPositive = trend > 0;
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconColor}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
        <div className="flex items-center gap-1.5">
          {trend !== undefined && trend !== null && (
            <span className={`flex items-center gap-0.5 text-xs font-medium ${trendPositive ? 'text-emerald-600' : 'text-red-500'}`}>
              {trendPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trendPositive ? '+' : ''}{trend.toFixed(1)}%
            </span>
          )}
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function KpiCards({ bookings, prevBookings, groupInquiries, prevGroupInquiries }) {
  const active = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed');
  const prevActive = prevBookings.filter(b => b.status === 'confirmed' || b.status === 'completed');

  const revenue = active.reduce((s, b) => s + (b.net_total || 0), 0);
  const prevRevenue = prevActive.reduce((s, b) => s + (b.net_total || 0), 0);
  const revenueTrend = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null;

  const bookingCount = bookings.filter(b => b.status !== 'cancelled').length;
  const totalPax = bookings.reduce((s, b) => s + (b.total_pax || 0), 0);
  const avgPax = bookingCount > 0 ? (totalPax / bookingCount).toFixed(1) : 0;

  const commission = active.reduce((s, b) => s + (b.commission_total || 0), 0);
  const grossTotal = active.reduce((s, b) => s + (b.gross_total || 0), 0);
  const commPct = grossTotal > 0 ? ((commission / grossTotal) * 100).toFixed(1) : 0;

  const confirmed = groupInquiries.filter(i => i.status === 'confirmed').length;
  const declined = groupInquiries.filter(i => i.status === 'declined').length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        title="Skupni neto prihodek"
        value={`€${revenue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        trend={revenueTrend}
        subtitle="vs. prejšnje obdobje"
        icon={TrendingUp}
        iconColor="bg-emerald-50 text-emerald-600"
      />
      <KpiCard
        title="Število rezervacij"
        value={bookingCount}
        subtitle={`Ø ${avgPax} gostov/rez.`}
        icon={Inbox}
        iconColor="bg-blue-50 text-blue-600"
      />
      <KpiCard
        title="Provizije OTA"
        value={`€${commission.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        subtitle={`${commPct}% od bruto prihodka`}
        icon={Globe}
        iconColor="bg-amber-50 text-amber-600"
      />
      <KpiCard
        title="Nove skupinske poizvedbe"
        value={groupInquiries.length}
        subtitle={`${confirmed} potrj. · ${declined} zavrn.`}
        icon={Users}
        iconColor="bg-purple-50 text-purple-600"
      />
    </div>
  );
}