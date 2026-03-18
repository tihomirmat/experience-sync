import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '../components/shared/TenantContext';
import PageHeader from '../components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, Copy } from 'lucide-react';
import { toast } from 'sonner';
import HubConnectionCard from '../components/integrations/HubConnectionCard';
import HubConnectionForm from '../components/integrations/HubConnectionForm';
import InvoicingConnectionCard from '../components/integrations/InvoicingConnectionCard';
import InvoicingConnectionForm from '../components/integrations/InvoicingConnectionForm';

export default function Integrations() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const [hubFormOpen, setHubFormOpen] = useState(false);
  const [editingHub, setEditingHub] = useState(null);
  const [invFormOpen, setInvFormOpen] = useState(false);
  const [editingInv, setEditingInv] = useState(null);
  const [testingId, setTestingId] = useState(null);

  const webhookUrl = `https://experience-sync-pro.base44.app/api/webhook/${tenantId}`;

  const { data: hubConnections = [], isLoading: hubLoading } = useQuery({
    queryKey: ['hub-connections', tenantId],
    queryFn: () => base44.entities.HubConnection.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });

  const { data: invConnections = [], isLoading: invLoading } = useQuery({
    queryKey: ['inv-connections', tenantId],
    queryFn: () => base44.entities.InvoicingConnection.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });

  const saveHubMutation = useMutation({
    mutationFn: ({ data, id }) => id
      ? base44.entities.HubConnection.update(id, data)
      : base44.entities.HubConnection.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hub-connections', tenantId] });
      toast.success('Booking kanal shranjen');
    },
  });

  const saveInvMutation = useMutation({
    mutationFn: ({ data, id }) => id
      ? base44.entities.InvoicingConnection.update(id, data)
      : base44.entities.InvoicingConnection.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inv-connections', tenantId] });
      toast.success('Računovodski sistem shranjen');
    },
  });

  const handleTestHub = async (conn) => {
    setTestingId(conn.id);
    try {
      const res = await base44.functions.invoke('testHubConnection', { connection_id: conn.id, connection_type: 'hub' });
      const d = res.data;
      queryClient.invalidateQueries({ queryKey: ['hub-connections', tenantId] });
      d.ok ? toast.success(d.message) : toast.error(d.message);
    } catch (e) {
      toast.error('Test ni uspel: ' + e.message);
    }
    setTestingId(null);
  };

  const handleTestInv = async (conn) => {
    setTestingId(conn.id);
    try {
      const res = await base44.functions.invoke('testHubConnection', { connection_id: conn.id, connection_type: 'invoicing' });
      const d = res.data;
      queryClient.invalidateQueries({ queryKey: ['inv-connections', tenantId] });
      d.ok ? toast.success(d.message) : toast.error(d.message);
    } catch (e) {
      toast.error('Test ni uspel: ' + e.message);
    }
    setTestingId(null);
  };

  const copyWebhook = () => { navigator.clipboard.writeText(webhookUrl); toast.success('URL kopiran'); };

  if (!currentTenant) {
    return <div className="flex items-center justify-center py-24 text-gray-400">Izberite podjetje.</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Integracije" subtitle="Upravljajte booking kanale in računovodske sisteme" />

      <Tabs defaultValue="booking">
        <TabsList>
          <TabsTrigger value="booking">🔗 Booking kanali</TabsTrigger>
          <TabsTrigger value="invoicing">🧾 Računovodstvo</TabsTrigger>
        </TabsList>

        {/* ─── Booking Channels ─── */}
        <TabsContent value="booking" className="space-y-6 mt-6">
          {/* Webhook URL box */}
          <div className="bg-[#1a5c38]/5 border border-[#1a5c38]/20 rounded-xl p-4">
            <p className="text-sm font-semibold text-[#1a5c38] mb-2">📎 Vaš universalni webhook URL za vse booking sisteme:</p>
            <div className="flex items-center gap-3 flex-wrap">
              <code className="text-sm bg-white border border-[#1a5c38]/20 rounded-lg px-3 py-2 flex-1 min-w-0 truncate text-gray-700">
                {webhookUrl}
              </code>
              <Button variant="outline" size="sm" onClick={copyWebhook} className="gap-1 shrink-0">
                <Copy className="w-3.5 h-3.5" /> Kopiraj
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">Ta URL registrirajte pri vašem booking sistemu za samodejno prejemanje rezervacij.</p>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => { setEditingHub(null); setHubFormOpen(true); }}
              className="bg-[#1a5c38] hover:bg-[#1a5c38]/90 text-white gap-2">
              <Plus className="w-4 h-4" /> Dodaj booking kanal
            </Button>
          </div>

          {hubLoading ? (
            <div className="space-y-3">{Array(2).fill(0).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : hubConnections.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">🔌</p>
              <p className="font-medium">Ni booking kanalov</p>
              <p className="text-sm mt-1">Dodajte prvi booking sistem za sinhronizacijo rezervacij.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {hubConnections.map(conn => (
                <HubConnectionCard
                  key={conn.id}
                  conn={conn}
                  onEdit={c => { setEditingHub(c); setHubFormOpen(true); }}
                  onTest={handleTestHub}
                  testing={testingId === conn.id}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Invoicing ─── */}
        <TabsContent value="invoicing" className="space-y-6 mt-6">
          <div className="flex justify-end">
            <Button onClick={() => { setEditingInv(null); setInvFormOpen(true); }}
              className="bg-[#1a5c38] hover:bg-[#1a5c38]/90 text-white gap-2">
              <Plus className="w-4 h-4" /> Dodaj računovodski sistem
            </Button>
          </div>

          {invLoading ? (
            <div className="space-y-3">{Array(2).fill(0).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : invConnections.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">🧾</p>
              <p className="font-medium">Ni računovodskih sistemov</p>
              <p className="text-sm mt-1">Povežite sistem za samodejno izdajanje računov.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invConnections.map(conn => (
                <InvoicingConnectionCard
                  key={conn.id}
                  conn={conn}
                  onEdit={c => { setEditingInv(c); setInvFormOpen(true); }}
                  onTest={handleTestInv}
                  testing={testingId === conn.id}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Forms */}
      <HubConnectionForm
        open={hubFormOpen}
        onClose={() => { setHubFormOpen(false); setEditingHub(null); }}
        connection={editingHub}
        tenantId={tenantId}
        onSave={(data, id) => saveHubMutation.mutateAsync({ data, id })}
      />
      <InvoicingConnectionForm
        open={invFormOpen}
        onClose={() => { setInvFormOpen(false); setEditingInv(null); }}
        connection={editingInv}
        tenantId={tenantId}
        onSave={(data, id) => saveInvMutation.mutateAsync({ data, id })}
      />
    </div>
  );
}