import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '../components/shared/TenantContext';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import StatusBadge from '../components/shared/StatusBadge';
import EmptyState from '../components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Inbox, FileText, Users, ExternalLink } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { toast } from 'sonner';

export default function Bookings() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [form, setForm] = useState({});
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({});

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['bookings', tenantId],
    queryFn: () => base44.entities.Booking.filter({ tenant_id: tenantId }, '-created_date', 200),
    enabled: !!tenantId,
  });

  const { data: experiences = [] } = useQuery({
    queryKey: ['experiences', tenantId],
    queryFn: () => base44.entities.Experience.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Booking.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bookings'] }); setShowForm(false); },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['bookings-invoices', tenantId],
    queryFn: () => base44.entities.Invoice.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Booking.update(id, data),
    onSuccess: (updated) => { queryClient.invalidateQueries({ queryKey: ['bookings'] }); setSelectedBooking(prev => prev ? { ...prev, ...updated } : null); },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async ({ booking, formData }) => {
      const tenant = currentTenant;
      const seq = (tenant.invoice_seq_current || 0) + 1;
      const invNumber = `${tenant.invoice_prefix || 'INV-'}${String(seq).padStart(6, '0')}`;
      await base44.entities.Tenant.update(tenant.id, { invoice_seq_current: seq });
      const inv = await base44.entities.Invoice.create({
        ...formData,
        invoice_number: invNumber,
        tenant_id: tenantId,
        booking_id: booking.id,
      });
      await base44.entities.Booking.update(booking.id, { invoice_id: inv.id });
      return inv;
    },
    onSuccess: (inv) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['bookings-invoices'] });
      setShowInvoiceForm(false);
      setSelectedBooking(prev => prev ? { ...prev, invoice_id: inv.id } : null);
      toast.success('Račun ustvarjen');
    },
  });

  const filtered = bookings.filter(b => {
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    const matchSearch = !search || 
      b.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      b.experience_title?.toLowerCase().includes(search.toLowerCase()) ||
      b.hub_booking_id?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const columns = [
    { header: 'Customer', render: (row) => (
      <div>
        <p className="font-medium text-gray-900">{row.customer_name || 'Guest'}</p>
        <p className="text-xs text-gray-400">{row.customer_email || ''}</p>
      </div>
    )},
    { header: 'Experience', render: (row) => (
      <span className="text-sm">{row.experience_title || '—'}</span>
    )},
    { header: 'Date', render: (row) => (
      <span className="text-sm text-gray-600">
        {row.departure_date ? format(new Date(row.departure_date), 'MMM d, yyyy') : '—'}
        {row.departure_time ? ` · ${row.departure_time}` : ''}
      </span>
    )},
    { header: 'Pax', render: (row) => (
      <div className="flex items-center gap-1 text-sm">
        <Users className="w-3.5 h-3.5 text-gray-400" />
        <span>{row.total_pax || ((row.adults || 0) + (row.children || 0))}</span>
      </div>
    )},
    { header: 'Channel', render: (row) => (
      <Badge variant="outline" className="text-xs capitalize">{row.channel || 'direct'}</Badge>
    )},
    { header: 'Total', render: (row) => (
      <span className="font-medium">€{(row.gross_total || 0).toFixed(2)}</span>
    )},
    { header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];

  if (!tenantId) return null;

  return (
    <div>
      <PageHeader title="Bookings" subtitle={`${bookings.length} total bookings`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-56" />
        </div>
        <Button onClick={() => {
          setForm({ tenant_id: tenantId, status: 'pending', channel: 'direct', currency: 'EUR', adults: 1, children: 0 });
          setShowForm(true);
        }} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> New Booking
        </Button>
      </PageHeader>

      <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mb-6">
        <TabsList className="bg-gray-100/70">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>
      </Tabs>

      {bookings.length === 0 && !isLoading ? (
        <EmptyState icon={Inbox} title="No bookings yet" description="Bookings will appear here when synced from your hub or created manually." />
      ) : (
        <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={setSelectedBooking} />
      )}

      {/* Create Booking Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Booking</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Experience</Label>
              <Select value={form.experience_id || ''} onValueChange={v => {
                const exp = experiences.find(e => e.id === v);
                setForm({...form, experience_id: v, experience_title: exp?.title_en || exp?.title_sl || ''});
              }}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {experiences.map(e => <SelectItem key={e.id} value={e.id}>{e.title_en || e.title_sl}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Customer Name</Label>
                <Input value={form.customer_name || ''} onChange={e => setForm({...form, customer_name: e.target.value})} /></div>
              <div className="space-y-1.5"><Label>Email</Label>
                <Input value={form.customer_email || ''} onChange={e => setForm({...form, customer_email: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label>Date</Label>
                <Input type="date" value={form.departure_date || ''} onChange={e => setForm({...form, departure_date: e.target.value})} /></div>
              <div className="space-y-1.5"><Label>Adults</Label>
                <Input type="number" value={form.adults || ''} onChange={e => setForm({...form, adults: parseInt(e.target.value) || 0, total_pax: (parseInt(e.target.value) || 0) + (form.children || 0)})} /></div>
              <div className="space-y-1.5"><Label>Children</Label>
                <Input type="number" value={form.children || ''} onChange={e => setForm({...form, children: parseInt(e.target.value) || 0, total_pax: (form.adults || 0) + (parseInt(e.target.value) || 0)})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Gross Total (€)</Label>
                <Input type="number" step="0.01" value={form.gross_total || ''} onChange={e => setForm({...form, gross_total: parseFloat(e.target.value) || 0})} /></div>
              <div className="space-y-1.5"><Label>Channel</Label>
                <Select value={form.channel || 'direct'} onValueChange={v => setForm({...form, channel: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">Direct</SelectItem>
                    <SelectItem value="airbnb">Airbnb</SelectItem>
                    <SelectItem value="gyg">GetYourGuide</SelectItem>
                    <SelectItem value="bookingcom">Booking.com</SelectItem>
                    <SelectItem value="dmo">DMO</SelectItem>
                    <SelectItem value="hub_other">Hub Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Booking Detail Dialog */}
      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Booking Details</DialogTitle></DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-gray-400">Customer</p><p className="font-medium">{selectedBooking.customer_name || 'Guest'}</p></div>
                <div><p className="text-xs text-gray-400">Email</p><p className="text-sm">{selectedBooking.customer_email || '—'}</p></div>
                <div><p className="text-xs text-gray-400">Experience</p><p className="text-sm">{selectedBooking.experience_title}</p></div>
                <div><p className="text-xs text-gray-400">Date</p><p className="text-sm">{selectedBooking.departure_date || '—'}</p></div>
                <div><p className="text-xs text-gray-400">Pax</p><p className="text-sm">{selectedBooking.adults} adults, {selectedBooking.children} children</p></div>
                <div><p className="text-xs text-gray-400">Channel</p><Badge variant="outline" className="capitalize">{selectedBooking.channel}</Badge></div>
                <div><p className="text-xs text-gray-400">Total</p><p className="font-medium">€{(selectedBooking.gross_total || 0).toFixed(2)}</p></div>
                <div><p className="text-xs text-gray-400">Status</p><StatusBadge status={selectedBooking.status} /></div>
              </div>
              <div className="flex gap-2 pt-2">
                <Select defaultValue={selectedBooking.status} onValueChange={v => updateMutation.mutate({ id: selectedBooking.id, data: { status: v }})}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="no_show">No Show</SelectItem>
                  </SelectContent>
                </Select>
                <Link to={createPageUrl(`Invoices?bookingId=${selectedBooking.id}`)}>
                  <Button variant="outline" size="sm" className="gap-2">
                    <FileText className="w-3.5 h-3.5" /> Create Invoice
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}