import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '../components/shared/TenantContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import InvoicingConnectionCard from '../components/integrations/InvoicingConnectionCard';
import InvoicingConnectionForm from '../components/integrations/InvoicingConnectionForm';
import LocalPartnersTable from '../components/integrations/LocalPartnersTable';
import ChannelPerformanceTable from '../components/integrations/ChannelPerformanceTable';
import ChannelManager from '../components/channels/ChannelManager';

export default function Integrations() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const [invFormOpen, setInvFormOpen] = useState(false);
  const [editingInv, setEditingInv] = useState(null);
  const [testingId, setTestingId] = useState(null);

  const { data: invConnections = [], isLoading: invLoading } = useQuery({
    queryKey: ['inv-connections', tenantId],
    queryFn: () => base44.entities.InvoicingConnection.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
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

  const handleTestInv = async (conn) => {
    setTestingId(conn.id);
    try {
      const res = await base44.functions.invoke('testHubConnection', { connection_id: conn.id, connection_type: 'invoicing' });
      const d = res.data;
      queryClient.invalidateQueries({ queryKey: ['inv-connections', tenantId] });
      d.ok ? toast.success(d.message) : toast.error(d.message);
    } catch (e) {
      toast.error('Test failed: ' + e.message);
    }
    setTestingId(null);
  };

  if (!currentTenant) {
    return <div className="flex items-center justify-center py-24 text-gray-400">Izberite podjetje.</div>;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="channels">
        <TabsList>
          <TabsTrigger value="channels">🌐 Channel Manager</TabsTrigger>
          <TabsTrigger value="partners">🤝 Local Partners</TabsTrigger>
          <TabsTrigger value="performance">📊 Performance</TabsTrigger>
          <TabsTrigger value="invoicing">🧾 Računovodstvo</TabsTrigger>
        </TabsList>

        {/* ─── Channel Manager ─── */}
        <TabsContent value="channels" className="mt-6">
          <ChannelManager tenantId={tenantId} />
        </TabsContent>

        {/* ─── Local Partners ─── */}
        <TabsContent value="partners" className="mt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-sm">🤝</div>
            <div>
              <h2 className="font-semibold text-gray-900">Local Partners & Agencies</h2>
              <p className="text-xs text-gray-500">Hotels, tour agencies, DMOs and resellers with API feed access</p>
            </div>
          </div>
          <LocalPartnersTable tenantId={tenantId} />
        </TabsContent>

        {/* ─── Channel Performance ─── */}
        <TabsContent value="performance" className="mt-6">
          <ChannelPerformanceTable tenantId={tenantId} />
        </TabsContent>

        {/* ─── Invoicing ─── */}
        <TabsContent value="invoicing" className="space-y-6 mt-6">
          <div className="flex justify-end">
            <Button onClick={() => { setEditingInv(null); setInvFormOpen(true); }}
              className="bg-[#1a5c38] hover:bg-[#1a5c38]/90 text-white gap-2">
              + Dodaj računovodski sistem
            </Button>
          </div>

          {invLoading ? (
            <div className="space-y-3">{[0,1].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : invConnections.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">🧾</p>
              <p className="font-medium">Ni računovodskih sistemov</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invConnections.map(conn => (
                <InvoicingConnectionCard key={conn.id} conn={conn}
                  onEdit={c => { setEditingInv(c); setInvFormOpen(true); }}
                  onTest={handleTestInv}
                  testing={testingId === conn.id}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

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