import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, CheckCircle2, ExternalLink, Copy, Trash2, Pause } from 'lucide-react';
import { SYNC_DIRECTION_LABELS } from './channelCatalog';
import { toast } from 'sonner';

const SETUP_STEPS = {
  OTA: [
    'Create a supplier / operator account on the channel platform',
    'List your experiences on the channel',
    'Generate an API key in your channel dashboard',
    'Enter credentials below and activate',
  ],
  'Booking Hub': [
    'Log in to your booking hub account',
    'Navigate to Channel Manager / API settings',
    'Create a new API key with read+write permissions',
    'Copy your webhook URL below and register it in the hub',
    'Enter credentials below and activate',
  ],
  'Local Partner': [
    'Agree on commission rate with the partner',
    'Set up API access if available',
    'Enter partner details below and activate',
  ],
  Website: [
    'Install the plugin or embed the widget on your site',
    'Copy the API key below',
    'Configure on your website and activate',
  ],
  Payment: [
    'Create an account on the payment provider',
    'Get your API keys from the developer dashboard',
    'Enter credentials below and activate',
  ],
};

export default function ChannelConnectPanel({ channel, connection, tenantId, onSave, onDelete, onClose }) {
  const isConnected = !!connection && connection.setup_status === 'active';
  const webhookUrl = `https://experience-ops.base44.app/api/webhook/${tenantId}`;

  const [form, setForm] = useState({
    api_key_enc: '',
    api_secret_enc: '',
    commission_rate: channel?.default_commission || 0,
    sync_direction: channel?.sync_direction || 'two_way',
    channel_label: channel?.name || '',
    base_url: '',
  });

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (connection) {
      setForm({
        api_key_enc: connection.api_key_enc || '',
        api_secret_enc: connection.api_secret_enc || '',
        commission_rate: connection.commission_rate || 0,
        sync_direction: connection.sync_direction || channel?.sync_direction || 'two_way',
        channel_label: connection.channel_label || channel?.name || '',
        base_url: connection.base_url || '',
      });
    }
  }, [connection]);

  const steps = SETUP_STEPS[channel?.category] || SETUP_STEPS['OTA'];

  const handleSave = async () => {
    setSaving(true);
    const data = {
      tenant_id: tenantId,
      hub_type: channel.hub_type,
      channel_category: categoryToEntityEnum(channel.category),
      channel_label: form.channel_label,
      api_key_enc: form.api_key_enc,
      api_secret_enc: form.api_secret_enc,
      commission_rate: parseFloat(form.commission_rate) || 0,
      sync_direction: form.sync_direction,
      base_url: form.base_url,
      setup_status: 'active',
      status: 'active',
    };
    await onSave(data, connection?.id);
    setSaving(false);
    onClose();
    toast.success(`${channel.name} ${connection ? 'updated' : 'connected'}!`);
  };

  const handlePause = async () => {
    if (!connection) return;
    setSaving(true);
    await onSave({ ...connection, status: connection.status === 'paused' ? 'active' : 'paused' }, connection.id);
    setSaving(false);
    toast.success(connection.status === 'paused' ? 'Channel resumed' : 'Channel paused');
    onClose();
  };

  const handleDelete = async () => {
    if (!connection) return;
    setDeleting(true);
    await onDelete(connection.id);
    setDeleting(false);
    onClose();
    toast.success(`${channel.name} disconnected`);
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('Webhook URL copied');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-[480px] h-full bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-5 border-b border-gray-100 shrink-0">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-base shadow"
            style={{ backgroundColor: channel?.color }}
          >
            {channel?.initials}
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900">{channel?.name}</h2>
            <p className="text-xs text-gray-500">{channel?.description}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Setup steps */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Setup Steps</h3>
            <ol className="space-y-2">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#1A56DB] text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-600">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Webhook URL */}
          <div>
            <Label className="text-xs text-gray-500 uppercase tracking-wide">Webhook URL (copy to channel platform)</Label>
            <div className="flex gap-2 mt-1.5">
              <code className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 truncate">
                {webhookUrl}
              </code>
              <Button variant="outline" size="icon" className="shrink-0 h-9 w-9" onClick={copyWebhook}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Form fields */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Connection Details</h3>

            <div>
              <Label className="text-xs">Channel Label</Label>
              <Input className="mt-1" value={form.channel_label} onChange={e => setForm(f => ({ ...f, channel_label: e.target.value }))} placeholder={channel?.name} />
            </div>

            <div>
              <Label className="text-xs">API Key</Label>
              <Input className="mt-1 font-mono text-xs" value={form.api_key_enc} onChange={e => setForm(f => ({ ...f, api_key_enc: e.target.value }))} placeholder="Paste your API key" />
            </div>

            <div>
              <Label className="text-xs">API Secret</Label>
              <Input className="mt-1 font-mono text-xs" type="password" value={form.api_secret_enc} onChange={e => setForm(f => ({ ...f, api_secret_enc: e.target.value }))} placeholder="Paste your API secret" />
            </div>

            {(channel?.category === 'Booking Hub' || channel?.category === 'Local Partner') && (
              <div>
                <Label className="text-xs">Base URL (optional)</Label>
                <Input className="mt-1 text-xs" value={form.base_url} onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))} placeholder="https://..." />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Commission Rate (%)</Label>
                <Input
                  className="mt-1"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={Math.round((parseFloat(form.commission_rate) || 0) * 100)}
                  onChange={e => setForm(f => ({ ...f, commission_rate: (parseInt(e.target.value) || 0) / 100 }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="text-xs">Sync Direction</Label>
                <Select value={form.sync_direction} onValueChange={v => setForm(f => ({ ...f, sync_direction: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="two_way">Two-way</SelectItem>
                    <SelectItem value="inbound_only">Inbound only</SelectItem>
                    <SelectItem value="outbound_only">Outbound only</SelectItem>
                    <SelectItem value="webhook_only">Webhook only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-gray-100 shrink-0 space-y-3">
          <Button
            className="w-full bg-[#1A56DB] hover:bg-[#1A56DB]/90 text-white h-10"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : isConnected ? 'Save Changes' : 'Activate Connection'}
          </Button>

          {isConnected && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs gap-1.5"
                onClick={handlePause}
                disabled={saving}
              >
                <Pause className="w-3.5 h-3.5" />
                {connection?.status === 'paused' ? 'Resume' : 'Pause'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs text-red-600 border-red-200 hover:bg-red-50 gap-1.5"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Disconnect
              </Button>
            </div>
          )}

          <p className="text-center text-xs text-gray-400">
            Need help?{' '}
            <a href="#" className="text-[#1A56DB] hover:underline">View setup guide</a>
          </p>
        </div>
      </div>
    </div>
  );
}

function categoryToEntityEnum(cat) {
  if (cat === 'OTA') return 'ota_platform';
  if (cat === 'Booking Hub') return 'booking_hub';
  if (cat === 'Local Partner') return 'local_partner';
  return 'custom';
}