import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '../components/shared/TenantContext';
import PageHeader from '../components/shared/PageHeader';
import DateRangeFilter, { getDateRange, getPrevRange } from '../components/analytics/DateRangeFilter';
import KpiCards from '../components/analytics/KpiCards';
import ChannelSection from '../components/analytics/ChannelSection';
import SeasonalitySection from '../components/analytics/SeasonalitySection';
import ExperienceTable from '../components/analytics/ExperienceTable';
import DemographicsSection from '../components/analytics/DemographicsSection';
import InvoiceFinanceSection from '../components/analytics/InvoiceFinanceSection';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

function isInRange(booking, start, end) {
  const d = booking.departure_date;
  if (!d) return false;
  const date = new Date(d);
  return date >= start && date <= end;
}

export default function Analytics() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  const [preset, setPreset] = useState('this_month');
  const [customStart, setCustomStart] = useState(format(new Date(), 'yyyy-MM-01'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: allBookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['analytics-bookings', tenantId],
    queryFn: () => base44.entities.Booking.filter({ tenant_id: tenantId }, '-departure_date', 2000),
    enabled: !!tenantId,
  });

  const { data: groupInquiries = [] } = useQuery({
    queryKey: ['analytics-inquiries', tenantId],
    queryFn: () => base44.entities.GroupInquiry.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['analytics-customers', tenantId],
    queryFn: () => base44.entities.Customer.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });

  const { data: allInvoices = [] } = useQuery({
    queryKey: ['analytics-invoices', tenantId],
    queryFn: () => base44.entities.Invoice.filter({ tenant_id: tenantId }, '-created_date', 2000),
    enabled: !!tenantId,
  });

  const { start, end } = getDateRange(preset, customStart, customEnd);
  const { start: prevStart, end: prevEnd } = getPrevRange(preset, customStart, customEnd);

  const filteredBookings = allBookings.filter(b => isInRange(b, start, end));
  const prevBookings = allBookings.filter(b => isInRange(b, prevStart, prevEnd));
  const filteredInquiries = groupInquiries.filter(i => {
    if (!i.created_date) return false;
    const d = new Date(i.created_date);
    return d >= start && d <= end;
  });

  if (!currentTenant) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        Izberite podjetje za prikaz analitike.
      </div>
    );
  }

  if (bookingsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-80" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader title="Analitika" subtitle={currentTenant.name} />
        <DateRangeFilter
          preset={preset}
          onPresetChange={setPreset}
          customStart={customStart}
          customEnd={customEnd}
          onCustomChange={(field, val) => {
            if (field === 'start') setCustomStart(val);
            else setCustomEnd(val);
          }}
        />
      </div>

      {/* Section 1 – KPIs */}
      <KpiCards
        bookings={filteredBookings}
        prevBookings={prevBookings}
        groupInquiries={filteredInquiries}
        prevGroupInquiries={[]}
      />

      {/* Divider */}
      <div className="border-t border-gray-100" />

      {/* Section 1b – Invoice Finance */}
      <InvoiceFinanceSection invoices={allInvoices} bookings={allBookings} tenantId={tenantId} />

      {/* Divider */}
      <div className="border-t border-gray-100" />

      {/* Section 2 – Channels */}
      <ChannelSection bookings={filteredBookings} />

      <div className="border-t border-gray-100" />

      {/* Section 3 – Seasonality (uses all bookings for year comparison) */}
      <SeasonalitySection allBookings={allBookings} />

      <div className="border-t border-gray-100" />

      {/* Section 4 – By experience */}
      <ExperienceTable bookings={filteredBookings} />

      <div className="border-t border-gray-100" />

      {/* Section 5 – Demographics */}
      <DemographicsSection bookings={filteredBookings} customers={customers} />
    </div>
  );
}