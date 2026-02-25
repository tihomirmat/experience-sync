import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Send, RefreshCw, Download, CheckCircle2, AlertCircle, Clock, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const PROVIDER_NAMES = { quibi: 'Quibi', cebelca: 'Čebelca' };

export default function InvoiceProviderActions({ invoice, tenantId }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(null); // 'issue' | 'refresh' | 'pdf'
  const [showDetails, setShowDetails] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('');

  const { data: connections = [] } = useQuery({
    queryKey: ['invoicing-connections', tenantId],
    queryFn: () => base44.entities.InvoicingConnection.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });

  const { data: extDocs = [], refetch: refetchDocs } = useQuery({
    queryKey: ['ext-docs', invoice.id],
    queryFn: () => base44.entities.ExternalDocument.filter({ invoice_id: invoice.id }),
    enabled: !!invoice.id,
  });

  const activeConnections = connections.filter(c => c.status === 'active' || c.credentials_enc);
  const defaultConnection = connections.find(c => c.is_default) || activeConnections[0];
  const providerId = selectedProvider || defaultConnection?.provider_id;

  const existingDoc = extDocs.find(d => d.provider_id === providerId);

  const handleIssue = async () => {
    if (!providerId) { toast.error('No provider configured. Go to Settings → Invoicing.'); return; }
    setLoading('issue');
    const { data } = await base44.functions.invoke('issueInvoice', { invoice_id: invoice.id, provider_id: providerId });
    setLoading(null);
    if (data?.error) { toast.error(data.error); return; }
    if (data?.already_exists) toast.info('Already issued via this provider.');
    else toast.success(`Invoice issued via ${PROVIDER_NAMES[providerId]}!`);
    refetchDocs();
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
  };

  const handleRefresh = async () => {
    if (!existingDoc) return;
    setLoading('refresh');
    const { data } = await base44.functions.invoke('refreshExternalDoc', { external_document_id: existingDoc.id });
    setLoading(null);
    if (data?.error) toast.error(data.error);
    else toast.success('Status refreshed');
    refetchDocs();
  };

  const handlePdf = async () => {
    if (!existingDoc) return;
    setLoading('pdf');
    const { data } = await base44.functions.invoke('downloadProviderPdf', { external_document_id: existingDoc.id });
    setLoading(null);
    if (data?.pdf_url) {
      window.open(data.pdf_url, '_blank');
      refetchDocs();
    } else {
      toast.error(data?.error || 'PDF download failed');
    }
  };

  const fiscalBadge = existingDoc?.fiscal_status;
  const fiscalColor = {
    fiscalized: 'bg-emerald-50 text-emerald-700',
    manual_required: 'bg-amber-50 text-amber-700',
    pending: 'bg-blue-50 text-blue-700',
    error: 'bg-red-50 text-red-700',
    none: 'bg-gray-100 text-gray-500',
  }[fiscalBadge || 'none'];

  return (
    <div className="space-y-3">
      {/* Provider selector */}
      {activeConnections.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Provider:</span>
          <Select value={selectedProvider} onValueChange={setSelectedProvider}>
            <SelectTrigger className="h-7 text-xs w-36"><SelectValue placeholder="Default" /></SelectTrigger>
            <SelectContent>
              {activeConnections.map(c => (
                <SelectItem key={c.id} value={c.provider_id}>{PROVIDER_NAMES[c.provider_id]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* External doc status */}
      {existingDoc && (
        <div className="bg-gray-50 rounded-lg px-3 py-2 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="text-xs font-medium">{PROVIDER_NAMES[existingDoc.provider_id]}</span>
            {existingDoc.provider_document_number && (
              <span className="text-xs text-gray-500">#{existingDoc.provider_document_number}</span>
            )}
            {fiscalBadge && fiscalBadge !== 'none' && (
              <Badge className={fiscalColor + ' text-xs'}>{fiscalBadge}</Badge>
            )}
          </div>
          {existingDoc.eor && <p className="text-xs text-gray-400">EOR: <code>{existingDoc.eor}</code></p>}
          {existingDoc.fiscal_status === 'manual_required' && (
            <p className="text-xs text-amber-600">⚠ Fiscalization required manually in Čebelca UI.</p>
          )}
          <button className="text-xs text-blue-500 underline" onClick={() => setShowDetails(true)}>View details</button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        {!existingDoc && (
          <Button size="sm" className="gap-1.5 text-xs h-8" onClick={handleIssue} disabled={!!loading}>
            {loading === 'issue' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Issue via {providerId ? PROVIDER_NAMES[providerId] : 'Provider'}
          </Button>
        )}
        {existingDoc && (
          <>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={handleRefresh} disabled={!!loading}>
              {loading === 'refresh' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Refresh Status
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={handlePdf} disabled={!!loading}>
              {loading === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Download PDF
            </Button>
            {existingDoc.pdf_url && (
              <Button size="sm" variant="ghost" className="gap-1 text-xs h-8" asChild>
                <a href={existingDoc.pdf_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3 h-3" /> Open PDF
                </a>
              </Button>
            )}
          </>
        )}
      </div>

      {/* Details dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>External Document Details</DialogTitle></DialogHeader>
          {existingDoc && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Provider', PROVIDER_NAMES[existingDoc.provider_id]],
                  ['Doc ID', existingDoc.provider_document_id],
                  ['Doc Number', existingDoc.provider_document_number],
                  ['Fiscal Status', existingDoc.fiscal_status],
                  ['EOR', existingDoc.eor || '—'],
                  ['ZOI', existingDoc.zoi || '—'],
                  ['Status', existingDoc.status],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-xs text-gray-400">{k}</p>
                    <p className="font-mono text-xs break-all">{v || '—'}</p>
                  </div>
                ))}
              </div>
              {existingDoc.raw_response_json && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-500">Raw response</summary>
                  <pre className="bg-gray-50 p-2 rounded mt-1 overflow-auto max-h-40 text-xs">{JSON.stringify(JSON.parse(existingDoc.raw_response_json || '{}'), null, 2)}</pre>
                </details>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}