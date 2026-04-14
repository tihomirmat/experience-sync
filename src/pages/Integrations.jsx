import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '../components/shared/TenantContext';
import PageHeader from '../components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import InvoicingConnectionCard from '../components/integrations/InvoicingConnectionCard';
import InvoicingConnectionForm from '../components/integrations/InvoicingConnectionForm';
import BookingHubCard from '../components/integrations/BookingHubCard';
import OtaPlatformCard from '../components/integrations/OtaPlatformCard';
import ChannelSetupModal from '../components/integrations/ChannelSetupModal';
import LocalPartnersTable from '../components/integrations/LocalPartnersTable';
import ChannelPerformanceTable from '../components/integrations/ChannelPerformanceTable';

export default function Integrations() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const [invFormOpen, setInvFormOpen] = useState(false);
  const [editingInv, setEditingInv] = useState(null);
  const [testingId, setTestingId] = useState(null);
  const [setupConn, setSetupConn] = useState(null);
  const [setupOpen, setSetupOpen] = useState(false);

  const webhookUrl = `https://experience-sync-pro.base44.app/api/webhook/${tenantId}`;

  const { data: hubConnections = [], isLoading: hubLoading } = useQuery({
    queryKey: ['hub-connections', tenantId],
    queryFn: () => base44.entities.HubConnection.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings-for-channels', tenantId],
    queryFn: () => base44.entities.Booking.filter({ tenant_id: tenantId }, '-created_date', 500),
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
      toast.success('Channel saved');
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
      toast.error('Test failed: ' + e.message);
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
      toast.error('Test failed: ' + e.message);
    }
    setTestingId(null);
  };

  const openSetup = (conn) => { setSetupConn(conn); setSetupOpen(true); };
  const copyWebhook = () => { navigator.clipboard.writeText(webhookUrl); toast.success('URL kopiran'); };

  const seedChannels = async () => {
    const SEED = [
      { channel_label: "Bokun", hub_type: "bokun", channel_category: "booking_hub", sync_direction: "two_way", setup_status: "not_started", commission_rate: 0 },
      { channel_label: "FareHarbor", hub_type: "fareharbor", channel_category: "booking_hub", sync_direction: "two_way", setup_status: "not_started", commission_rate: 0 },
      { channel_label: "Viator", hub_type: "viator", channel_category: "ota_platform", sync_direction: "webhook_only", setup_status: "not_started", commission_rate: 0.20 },
      { channel_label: "GetYourGuide", hub_type: "getyourguide", channel_category: "ota_platform", sync_direction: "webhook_only", setup_status: "not_started", commission_rate: 0.20 },
      { channel_label: "Booking.com Experiences", hub_type: "booking_experiences", channel_category: "ota_platform", sync_direction: "webhook_only", setup_status: "not_started", commission_rate: 0.15 },
      { channel_label: "Airbnb Experiences", hub_type: "airbnb_experiences", channel_category: "ota_platform", sync_direction: "inbound_only", setup_status: "not_started", commission_rate: 0.20 },
      { channel_label: "TripAdvisor Experiences", hub_type: "tripadvisor", channel_category: "ota_platform", sync_direction: "webhook_only", setup_status: "not_started", commission_rate: 0.15 },
      { channel_label: "Klook", hub_type: "klook", channel_category: "ota_platform", sync_direction: "webhook_only", setup_status: "not_started", commission_rate: 0.20 },
    ];
    const existing = hubConnections.map(c => c.hub_type);
    const toCreate = SEED.filter(s => !existing.includes(s.hub_type));
    if (toCreate.length === 0) { toast.info('All channels already exist'); return; }
    for (const s of toCreate) {
      await base44.entities.HubConnection.create({ ...s, tenant_id: tenantId });
    }
    queryClient.invalidateQueries({ queryKey: ['hub-connections', tenantId] });
    toast.success(`${toCreate.length} channels added`);
  };

  // Split connections by category
  const bookingHubs = hubConnections.filter(c => c.channel_category === 'booking_hub');
  const otaPlatforms = hubConnections.filter(c => c.channel_category === 'ota_platform');

  // Booking counts per hub_type (matching channel field)
  const bookingCountByChannel = bookings.reduce((acc, b) => {
    if (b.channel) acc[b.channel] = (acc[b.channel] || 0) + 1;
    return acc;
  }, {});

  if (!currentTenant) {
    return <div className="flex items-center justify-center py-24 text-gray-400">Izberite podjetje.</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Channels & Connections" subtitle="Upravljajte vse prodajne kanale in integracije" />

      <Tabs defaultValue="channels">
        <TabsList>
          <TabsTrigger value="channels">🌐 Sales Channels</TabsTrigger>
          <TabsTrigger value="partners">🤝 Local Partners</TabsTrigger>
          <TabsTrigger value="performance">📊 Performance</TabsTrigger>
          <TabsTrigger value="invoicing">🧾 Računovodstvo</TabsTrigger>
        </TabsList>

        {/* ─── Sales Channels ─── */}
        <TabsContent value="channels" className="space-y-8 mt-6">

          {/* Seed button */}
          {!hubLoading && hubConnections.length < 4 && (
            <div className="flex justify-end">
              <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={seedChannels}>
                ✨ Add all default channels
              </Button>
            </div>
          )}

          {/* Section A: Booking Hubs */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-sm">🔷</div>
              <div>
                <h2 className="font-semibold text-gray-900">Booking Hubs</h2>
                <p className="text-xs text-gray-500">Two-way sync — Bokun, FareHarbor</p>
              </div>
            </div>

            {/* Webhook URL */}
            <div className="bg-[#1a5c38]/5 border border-[#1a5c38]/20 rounded-xl p-4 mb-4">
              <p className="text-sm font-semibold text-[#1a5c38] mb-2">📎 Universal webhook URL:</p>
              <div className="flex items-center gap-3 flex-wrap">
                <code className="text-sm bg-white border border-[#1a5c38]/20 rounded-lg px-3 py-2 flex-1 min-w-0 truncate text-gray-700">{webhookUrl}</code>
                <Button variant="outline" size="sm" onClick={copyWebhook} className="gap-1 shrink-0">
                  <Copy className="w-3.5 h-3.5" /> Copy
                </Button>
              </div>
            </div>

            {hubLoading ? (
              <div className="space-y-3">{[0,1].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>
            ) : bookingHubs.length === 0 ? (
              <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-400">
                <p className="text-2xl mb-2">🔌</p><p className="text-sm mb-3">No booking hubs configured</p>
                <Button size="sm" variant="outline" onClick={seedChannels}>+ Add default channels</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {bookingHubs.map(conn => (
                  <BookingHubCard key={conn.id} conn={conn}
                    onConfigure={openSetup}
                    onTest={handleTestHub}
                    testing={testingId === conn.id}
                    bookingCount={bookingCountByChannel[conn.hub_type] || 0}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Section B: OTA Platforms */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-sm">🌍</div>
              <div>
                <h2 className="font-semibold text-gray-900">OTA Platforms</h2>
                <p className="text-xs text-gray-500">Viator, GetYourGuide, Booking.com, Airbnb, TripAdvisor, Klook & more</p>
              </div>
            </div>

            {hubLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[0,1,2,3,4,5,6,7].map(i => <div key={i} className="h-36 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : otaPlatforms.length === 0 ? (
              <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-400">
                <p className="text-2xl mb-2">🌍</p><p className="text-sm">No OTA platforms configured</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {otaPlatforms.map(conn => (
                  <OtaPlatformCard key={conn.id} conn={conn} onConfigure={openSetup} />
                ))}
              </div>
            )}
          </div>
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

      {/* Channel Setup Modal */}
      <ChannelSetupModal
        open={setupOpen}
        onClose={() => { setSetupOpen(false); setSetupConn(null); }}
        connection={setupConn}
        tenantId={tenantId}
        onSave={(data, id) => saveHubMutation.mutateAsync({ data, id })}
        onTest={handleTestHub}
        testing={testingId === setupConn?.id}
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