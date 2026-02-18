import React, { useState, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, FileText, Send, Download, Trash2 } from 'lucide-react';
import { format, addDays } from 'date-fns';

export default function Invoices() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [lines, setLines] = useState([]);

  const urlParams = new URLSearchParams(window.location.search);
  const preBookingId = urlParams.get('bookingId');

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices', tenantId],
    queryFn: () => base44.entities.Invoice.filter({ tenant_id: tenantId }, '-created_date'),
    enabled: !!tenantId,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies', tenantId],
    queryFn: () => base44.entities.Company.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings', tenantId],
    queryFn: () => base44.entities.Booking.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Allocate invoice number
      const tenant = currentTenant;
      const seq = (tenant.invoice_seq_current || 0) + 1;
      const invNumber = `${tenant.invoice_prefix || 'INV-'}${String(seq).padStart(6, '0')}`;
      await base44.entities.Tenant.update(tenant.id, { invoice_seq_current: seq });
      return base44.entities.Invoice.create({ ...data, invoice_number: invNumber });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['invoices'] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Invoice.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });

  useEffect(() => {
    if (preBookingId && bookings.length > 0) {
      const booking = bookings.find(b => b.id === preBookingId);
      if (booking) {
        openCreateFromBooking(booking);
      }
    }
  }, [preBookingId, bookings.length]);

  const openCreateFromBooking = (booking) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const due = format(addDays(new Date(), 15), 'yyyy-MM-dd');
    setForm({
      tenant_id: tenantId,
      invoice_type: 'invoice',
      status: 'draft',
      language: 'sl',
      booking_id: booking.id,
      customer_name: booking.customer_name,
      customer_id: booking.customer_id,
      company_id: booking.company_id,
      company_name: booking.company_name,
      issue_date: today,
      due_date: due,
      currency: 'EUR',
      reverse_charge: false,
    });
    setLines([{
      description: `${booking.experience_title} – ${booking.departure_date || ''} (${booking.total_pax || booking.adults} pax)`,
      qty: booking.total_pax || booking.adults || 1,
      unit_price_net: (booking.net_total || booking.gross_total || 0) / Math.max(booking.total_pax || booking.adults || 1, 1),
      vat_rate: currentTenant?.default_vat_rate || 0.095,
      vat_amount: 0,
      line_total_gross: booking.gross_total || 0,
    }]);
    setShowForm(true);
  };

  const openCreate = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const due = format(addDays(new Date(), 15), 'yyyy-MM-dd');
    setForm({
      tenant_id: tenantId, invoice_type: 'invoice', status: 'draft', language: 'sl',
      issue_date: today, due_date: due, currency: 'EUR', reverse_charge: false,
    });
    setLines([{ description: '', qty: 1, unit_price_net: 0, vat_rate: currentTenant?.default_vat_rate || 0.095, vat_amount: 0, line_total_gross: 0 }]);
    setShowForm(true);
  };

  const recalcLine = (line) => {
    const net = line.qty * line.unit_price_net;
    const vat = line.reverse_charge ? 0 : net * line.vat_rate;
    return { ...line, vat_amount: vat, line_total_gross: net + vat };
  };

  const updateLine = (index, field, value) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    updated[index] = recalcLine({ ...updated[index], reverse_charge: form.reverse_charge });
    setLines(updated);
  };

  const addLine = () => setLines([...lines, { description: '', qty: 1, unit_price_net: 0, vat_rate: currentTenant?.default_vat_rate || 0.095, vat_amount: 0, line_total_gross: 0 }]);
  const removeLine = (i) => setLines(lines.filter((_, idx) => idx !== i));

  const totals = lines.reduce((acc, l) => ({
    net: acc.net + (l.qty * l.unit_price_net),
    vat: acc.vat + (l.vat_amount || 0),
    gross: acc.gross + (l.line_total_gross || 0),
  }), { net: 0, vat: 0, gross: 0 });

  const handleSave = () => {
    const companyData = form.company_id ? companies.find(c => c.id === form.company_id) : null;
    createMutation.mutate({
      ...form,
      company_name: companyData?.company_name || form.company_name,
      company_vat_id: companyData?.vat_id || form.company_vat_id,
      company_address: companyData ? `${companyData.address_line1 || ''}, ${companyData.zip || ''} ${companyData.city || ''}` : form.company_address,
      lines,
      net_total: totals.net,
      vat_total: totals.vat,
      gross_total: totals.gross,
    });
  };

  const filtered = invoices.filter(i => {
    const matchStatus = statusFilter === 'all' || i.status === statusFilter;
    const matchSearch = !search || i.invoice_number?.toLowerCase().includes(search.toLowerCase()) || i.customer_name?.toLowerCase().includes(search.toLowerCase()) || i.company_name?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const columns = [
    { header: 'Number', render: r => <span className="font-mono text-sm font-medium">{r.invoice_number}</span> },
    { header: 'Type', render: r => <span className="text-sm capitalize">{r.invoice_type?.replace('_', ' ')}</span> },
    { header: 'Customer / Company', render: r => (
      <div>
        <p className="text-sm font-medium">{r.company_name || r.customer_name || '—'}</p>
        {r.company_vat_id && <p className="text-xs text-gray-400">{r.company_vat_id}</p>}
      </div>
    )},
    { header: 'Date', render: r => <span className="text-sm">{r.issue_date || '—'}</span> },
    { header: 'Total', render: r => <span className="font-medium">€{(r.gross_total || 0).toFixed(2)}</span> },
    { header: 'Status', render: r => <StatusBadge status={r.status} /> },
    { header: '', render: r => (
      <div className="flex gap-1">
        {r.status === 'draft' && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); updateMutation.mutate({ id: r.id, data: { status: 'sent' }}); }}>
            <Send className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    )},
  ];

  if (!tenantId) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <p>Select a company to view invoices.</p>
    </div>
  );

  return (
    <div>
      <PageHeader title="Invoices" subtitle={`${invoices.length} invoices`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-56" />
        </div>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> New Invoice
        </Button>
      </PageHeader>

      <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mb-6">
        <TabsList className="bg-gray-100/70">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="void">Void</TabsTrigger>
        </TabsList>
      </Tabs>

      {invoices.length === 0 && !isLoading ? (
        <EmptyState icon={FileText} title="No invoices" description="Create invoices from bookings or manually." actionLabel="New Invoice" onAction={openCreate} />
      ) : (
        <DataTable columns={columns} data={filtered} isLoading={isLoading} />
      )}

      {/* Invoice Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Invoice</DialogTitle></DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1.5"><Label>Type</Label>
                <Select value={form.invoice_type || 'invoice'} onValueChange={v => setForm({...form, invoice_type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice">Invoice</SelectItem>
                    <SelectItem value="proforma">Proforma</SelectItem>
                    <SelectItem value="credit_note">Credit Note</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Language</Label>
                <Select value={form.language || 'sl'} onValueChange={v => setForm({...form, language: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sl">Slovenščina</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="hr">Hrvatski</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Issue Date</Label>
                <Input type="date" value={form.issue_date || ''} onChange={e => setForm({...form, issue_date: e.target.value})} /></div>
              <div className="space-y-1.5"><Label>Due Date</Label>
                <Input type="date" value={form.due_date || ''} onChange={e => setForm({...form, due_date: e.target.value})} /></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Company</Label>
                <Select value={form.company_id || ''} onValueChange={v => {
                  const comp = companies.find(c => c.id === v);
                  setForm({...form, company_id: v, company_name: comp?.company_name, company_vat_id: comp?.vat_id});
                }}>
                  <SelectTrigger><SelectValue placeholder="Select company..." /></SelectTrigger>
                  <SelectContent>
                    {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Customer Name</Label>
                <Input value={form.customer_name || ''} onChange={e => setForm({...form, customer_name: e.target.value})} /></div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.reverse_charge || false} onCheckedChange={v => {
                setForm({...form, reverse_charge: v});
                setLines(lines.map(l => recalcLine({...l, reverse_charge: v})));
              }} />
              <Label>Reverse charge (EU B2B)</Label>
            </div>

            {/* Lines */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium">Invoice Lines</Label>
                <Button variant="outline" size="sm" onClick={addLine} className="gap-1"><Plus className="w-3 h-3" /> Add Line</Button>
              </div>
              <div className="space-y-3">
                {lines.map((line, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 bg-gray-50 rounded-lg">
                    <div className="col-span-5 space-y-1"><Label className="text-xs">Description</Label>
                      <Input value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} /></div>
                    <div className="col-span-1 space-y-1"><Label className="text-xs">Qty</Label>
                      <Input type="number" value={line.qty} onChange={e => updateLine(i, 'qty', parseFloat(e.target.value) || 0)} /></div>
                    <div className="col-span-2 space-y-1"><Label className="text-xs">Unit Net (€)</Label>
                      <Input type="number" step="0.01" value={line.unit_price_net} onChange={e => updateLine(i, 'unit_price_net', parseFloat(e.target.value) || 0)} /></div>
                    <div className="col-span-1 space-y-1"><Label className="text-xs">VAT %</Label>
                      <Input type="number" step="0.01" value={(line.vat_rate * 100).toFixed(1)} onChange={e => updateLine(i, 'vat_rate', (parseFloat(e.target.value) || 0) / 100)} /></div>
                    <div className="col-span-2 space-y-1"><Label className="text-xs">Total</Label>
                      <p className="text-sm font-medium py-2">€{(line.line_total_gross || 0).toFixed(2)}</p></div>
                    <div className="col-span-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeLine(i)}>
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Net</span><span>€{totals.net.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">VAT</span><span>€{totals.vat.toFixed(2)}</span></div>
                <div className="flex justify-between border-t pt-2 font-semibold"><span>Total</span><span>€{totals.gross.toFixed(2)}</span></div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending}>Create Invoice</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}