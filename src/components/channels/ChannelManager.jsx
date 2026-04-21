import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Wifi, RefreshCw, CheckCircle2 } from 'lucide-react';
import { CHANNEL_CATALOG, CATEGORIES } from './channelCatalog';
import ChannelCard from './ChannelCard';
import ChannelConnectPanel from './ChannelConnectPanel';
import { format } from 'date-fns';

const STATUS_FILTERS = ['All', 'Connected', 'Available', 'Coming Soon'];

export default function ChannelManager({ tenantId }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [panelChannel, setPanelChannel] = useState(null);
  const [panelConnection, setPanelConnection] = useState(null);

  const { data: hubConnections = [], isLoading } = useQuery({
    queryKey: ['hub-connections', tenantId],
    queryFn: () => base44.entities.HubConnection.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: ({ data, id }) => id
      ? base44.entities.HubConnection.update(id, data)
      : base44.entities.HubConnection.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hub-connections', tenantId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.HubConnection.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hub-connections', tenantId] }),
  });

  // Map hub_type → connection
  const connectionByHubType = useMemo(() => {
    const map = {};
    hubConnections.forEach(c => { map[c.hub_type] = c; });
    return map;
  }, [hubConnections]);

  const activeCount = hubConnections.filter(c => c.setup_status === 'active').length;
  const lastSync = hubConnections
    .filter(c => c.last_sync_at)
    .sort((a, b) => new Date(b.last_sync_at) - new Date(a.last_sync_at))[0]?.last_sync_at;

  const filtered = useMemo(() => {
    return CHANNEL_CATALOG.filter(ch => {
      const conn = connectionByHubType[ch.hub_type];
      const isConnected = conn?.setup_status === 'active';

      if (search && !ch.name.toLowerCase().includes(search.toLowerCase()) &&
          !ch.description.toLowerCase().includes(search.toLowerCase())) return false;

      if (categoryFilter !== 'All' && ch.category !== categoryFilter) return false;

      if (statusFilter === 'Connected' && !isConnected) return false;
      if (statusFilter === 'Available' && (isConnected || ch.status === 'coming_soon')) return false;
      if (statusFilter === 'Coming Soon' && ch.status !== 'coming_soon') return false;

      return true;
    });
  }, [search, categoryFilter, statusFilter, connectionByHubType]);

  const openConnect = (channel, connection) => {
    setPanelChannel(channel);
    setPanelConnection(connection || null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Channel Manager</h1>
          <p className="text-sm text-gray-500 mt-0.5">Connect your experiences to 140+ sales channels and OTAs</p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon={<CheckCircle2 className="w-4 h-4 text-green-600" />}
          label="Active Channels"
          value={activeCount}
          bg="bg-green-50"
        />
        <StatCard
          icon={<Wifi className="w-4 h-4 text-blue-600" />}
          label="Total Channels"
          value={CHANNEL_CATALOG.length}
          bg="bg-blue-50"
        />
        <StatCard
          icon={<RefreshCw className="w-4 h-4 text-purple-600" />}
          label="Last Sync"
          value={lastSync ? format(new Date(lastSync), 'MMM d, HH:mm') : '—'}
          bg="bg-purple-50"
        />
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Search channels…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Category filter */}
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-xs rounded-full border font-medium transition-colors
                ${categoryFilter === cat
                  ? 'bg-[#1A56DB] text-white border-[#1A56DB]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-full border font-medium transition-colors
                ${statusFilter === s
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-gray-400">
        Showing {filtered.length} of {CHANNEL_CATALOG.length} channels
        {activeCount > 0 && <span className="ml-2 text-green-600 font-medium">· {activeCount} connected</span>}
      </p>

      {/* Card grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(channel => {
            const conn = connectionByHubType[channel.hub_type];
            return (
              <ChannelCard
                key={channel.id}
                channel={channel}
                connection={conn}
                onConnect={openConnect}
                onManage={openConnect}
              />
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-3 py-16 text-center text-gray-400">
              <p className="text-3xl mb-2">🔌</p>
              <p className="text-sm">No channels match your filters</p>
            </div>
          )}
        </div>
      )}

      {/* Side panel */}
      {panelChannel && (
        <ChannelConnectPanel
          channel={panelChannel}
          connection={panelConnection}
          tenantId={tenantId}
          onSave={(data, id) => saveMutation.mutateAsync({ data, id })}
          onDelete={(id) => deleteMutation.mutateAsync(id)}
          onClose={() => { setPanelChannel(null); setPanelConnection(null); }}
        />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, bg }) {
  return (
    <div className={`${bg} rounded-xl p-4 flex items-center gap-3 border border-white`}>
      <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}