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
import { Plus, Search, FileText, Send, Download, Trash2, ChevronRight } from 'lucide-react';
import { format, addDays } from 'date-fns';
import InvoiceProviderActions from '../components/invoicing/InvoiceProviderActions';

export default function Invoices() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [lines, setLines] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

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

  const bookingMap = bookings.reduce((m, b) => { m[b.id] = b; return m; }, {});

  // Summary totals for filtered invoices
  const summaryTotals = filtered.reduce((acc, i) => ({
    net: acc.net + (i.net_total || 0),
    vat: acc.vat + (i.vat_total || 0),
    gross: acc.gross + (i.gross_total || 0),
    paid: acc.paid + (i.status === 'paid' ? (i.gross_total || 0) : 0),
    unpaid: acc.unpaid + ((i.status === 'sent' || i.status === 'draft') ? (i.gross_total || 0) : 0),
    commission: acc.commission + ((bookingMap[i.booking_id]?.commission_total) || 0),
  }), { net: 0, vat: 0, gross: 0, paid: 0, unpaid: 0, commission: 0 });

  const columns = [
    { header: 'Številka', render: r => <span className="font-mono text-sm font-medium">{r.invoice_number}</span> },
    { header: 'Stranka', render: r => (
      <div>
        <p className="text-sm font-medium">{r.company_name || r.customer_name || '—'}</p>
        {r.company_vat_id && <p className="text-xs text-gray-400">{r.company_vat_id}</p>}
      </div>
    )},
    { header: 'Rezervacija', render: r => {
      const b = bookingMap[r.booking_id];
      return b ? <span className="text-xs text-gray-600 truncate max-w-[120px] block">{b.experience_title || '—'}</span> : <span className="text-gray-300">—</span>;
    }},
    { header: 'Kanal', render: r => {
      const b = bookingMap[r.booking_id];
      return b?.channel ? <span className="text-xs capitalize bg-gray-100 rounded px-2 py-0.5">{b.channel}</span> : <span className="text-gray-300">—</span>;
    }},
    { header: 'Provizija', render: r => {
      const c = bookingMap[r.booking_id]?.commission_total;
      return c ? <span className="text-xs text-red-600">€{c.toFixed(2)}</span> : <span className="text-gray-300">—</span>;
    }},
    { header: 'Datum', render: r => <span className="text-sm">{r.issue_date || '—'}</span> },
    { header: 'Skupaj', render: r => <span className="font-medium">€{(r.gross_total || 0).toFixed(2)}</span> },
    { header: 'Status', render: r => <StatusBadge status={r.status} /> },
    { header: '', render: r => (
      <div className="flex gap-1 items-center">
        {(r.status === 'draft' || r.status === 'sent') && (
          <Button variant="ghost" size="sm" className="h-7 text-xs text-[#1a5c38]"
            onClick={(e) => { e.stopPropagation(); updateMutation.mutate({ id: r.id, data: { status: 'paid', notes: `Plačano: ${format(new Date(), 'dd.MM.yyyy')}` }}); }}>
            ✓ Plačano
          </Button>
        )}
        {r.status === 'draft' && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); updateMutation.mutate({ id: r.id, data: { status: 'sent' }}); }}>
            <Send className="w-3.5 h-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setSelectedInvoice(r); }}>
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
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

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="bg-gray-100/70">
            <TabsTrigger value="all">Vsi</TabsTrigger>
            <TabsTrigger value="draft">Osnutek</TabsTrigger>
            <TabsTrigger value="sent">Poslano</TabsTrigger>
            <TabsTrigger value="paid">Plačano</TabsTrigger>
            <TabsTrigger value="void">Storno</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Kanal" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vsi kanali</SelectItem>
            <SelectItem value="direct">Direct</SelectItem>
            <SelectItem value="airbnb">Airbnb</SelectItem>
            <SelectItem value="gyg">GetYourGuide</SelectItem>
            <SelectItem value="bookingcom">Booking.com</SelectItem>
            <SelectItem value="dmo">DMO</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {invoices.length === 0 && !isLoading ? (
        <EmptyState icon={FileText} title="No invoices" description="Create invoices from bookings or manually." actionLabel="New Invoice" onAction={openCreate} />
      ) : (
        <>
          <DataTable columns={columns} data={filtered} isLoading={isLoading} />
          {/* Summary row */}
          {!isLoading && filtered.length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100 grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
              <div><p className="text-xs text-gray-400">Skupaj neto</p><p className="font-semibold">€{summaryTotals.net.toFixed(2)}</p></div>
              <div><p className="text-xs text-gray-400">Skupaj DDV</p><p className="font-semibold">€{summaryTotals.vat.toFixed(2)}</p></div>
              <div><p className="text-xs text-gray-400">Skupaj bruto</p><p className="font-semibold">€{summaryTotals.gross.toFixed(2)}</p></div>
              <div><p className="text-xs text-gray-400">Plačano</p><p className="font-semibold text-[#1a5c38]">€{summaryTotals.paid.toFixed(2)}</p></div>
              <div><p className="text-xs text-gray-400">Neporavnano</p><p className="font-semibold text-amber-600">€{summaryTotals.unpaid.toFixed(2)}</p></div>
            </div>
          )}
        </>
      )}

      {/* Invoice Provider Actions Panel */}
      <Dialog open={!!selectedInvoice} onOpenChange={v => !v && setSelectedInvoice(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {selectedInvoice?.invoice_number}
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><p className="text-xs text-gray-400">Customer</p><p className="font-medium">{selectedInvoice.company_name || selectedInvoice.customer_name || '—'}</p></div>
                <div><p className="text-xs text-gray-400">Total</p><p className="font-medium">€{(selectedInvoice.gross_total || 0).toFixed(2)}</p></div>
                <div><p className="text-xs text-gray-400">Issue Date</p><p>{selectedInvoice.issue_date || '—'}</p></div>
                <div><p className="text-xs text-gray-400">Status</p><p className="capitalize">{selectedInvoice.status}</p></div>
              </div>
              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Provider Actions</p>
                <InvoiceProviderActions invoice={selectedInvoice} tenantId={tenantId} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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