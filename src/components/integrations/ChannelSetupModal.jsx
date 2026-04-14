import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

const SETUP_INSTRUCTIONS = {
  bokun: 'In Bokun, go to Settings → API. Create a new API key pair and paste below. Set the webhook URL in Bokun → Settings → Channels.',
  fareharbor: 'In FareHarbor dashboard, go to Settings → API Access. Request API credentials from your account manager and paste below.',
  viator: 'Viator uses the Product API. Go to your Viator Supplier portal → Tools → API to get your API key. Set the webhook to receive booking notifications.',
  getyourguide: 'In your GYG Supplier Center, go to Settings → API & Connectivity. Get your API key and configure the webhook endpoint.',
  booking_experiences: 'In Booking.com Extranet, go to Account → Connectivity. Use the provided webhook URL to receive booking events.',
  airbnb_experiences: 'Airbnb Experiences uses iCal/webhook sync. Use the webhook URL below in your Airbnb Host dashboard under Calendar → Export.',
  tripadvisor: 'In TripAdvisor Management Center, go to Connectivity → API. Paste your Tripadvisor Product Key below.',
  klook: 'In Klook Merchant portal, go to Settings → API Integration. Get your API key and paste below.',
  musement: 'In Musement Partner Hub, go to Developer → API keys. Generate a key and configure the webhook URL.',
  default: 'Enter your API credentials below to connect this channel.',
};

const STATUS_COLORS = {
  not_started: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  active: 'bg-emerald-100 text-emerald-700',
  error: 'bg-red-100 text-red-700',
  paused: 'bg-amber-100 text-amber-700',
};

export default function ChannelSetupModal({ open, onClose, connection, tenantId, onSave, onTest, testing }) {
  const [form, setForm] = useState({});

  useEffect(() => {
    if (connection) setForm({ ...connection });
    else setForm({});
  }, [connection]);

  const isBookingHub = connection?.channel_category === 'booking_hub';
  const instructions = SETUP_INSTRUCTIONS[connection?.hub_type] || SETUP_INSTRUCTIONS.default;
  const webhookUrl = `https://experience-sync-pro.base44.app/api/webhook/${tenantId}/${connection?.hub_type || ''}`;

  const handleSave = async () => {
    await onSave(form, connection?.id);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <span>{connection?.channel_label || 'Channel'}</span>
            {connection?.setup_status && (
              <Badge className={`text-xs ${STATUS_COLORS[connection.setup_status]}`}>
                {connection.setup_status.replace('_', ' ')}
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
            ℹ️ {instructions}
          </div>

          {/* Setup Status */}
          <div className="space-y-1.5">
            <Label className="text-xs">Setup Status</Label>
            <Select value={form.setup_status || 'not_started'} onValueChange={v => setForm(f => ({ ...f, setup_status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="not_started">Not Started</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* API Credentials - for hubs with two-way sync */}
          {(isBookingHub || connection?.sync_direction === 'two_way') && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">API Credentials</p>
              <div className="space-y-1.5">
                <Label className="text-xs">API Key</Label>
                <Input value={form.api_key_enc || ''} onChange={e => setForm(f => ({ ...f, api_key_enc: e.target.value }))} placeholder="Paste API key..." type="password" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">API Secret</Label>
                <Input value={form.api_secret_enc || ''} onChange={e => setForm(f => ({ ...f, api_secret_enc: e.target.value }))} placeholder="Paste API secret..." type="password" />
              </div>
              {isBookingHub && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Base URL (optional override)</Label>
                  <Input value={form.base_url || ''} onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))} placeholder="https://api.bokun.io" />
                </div>
              )}
            </div>
          )}

          {/* For OTA platforms - simpler setup */}
          {connection?.channel_category === 'ota_platform' && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Platform Details</p>
              <div className="space-y-1.5">
                <Label className="text-xs">Your Listing URL</Label>
                <Input value={form.listing_url || ''} onChange={e => setForm(f => ({ ...f, listing_url: e.target.value }))} placeholder="https://www.viator.com/tours/..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">API Key (if available)</Label>
                <Input value={form.api_key_enc || ''} onChange={e => setForm(f => ({ ...f, api_key_enc: e.target.value }))} type="password" placeholder="Your API key..." />
              </div>
            </div>
          )}

          {/* Webhook URL box */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Webhook URL</p>
            <div className="bg-gray-50 rounded-lg border p-3">
              <p className="text-xs text-gray-500 mb-1">Register this URL in the platform's settings:</p>
              <code className="text-xs text-gray-700 break-all">{webhookUrl}</code>
            </div>
          </div>

          {/* Commission */}
          <div className="space-y-1.5">
            <Label className="text-xs">Commission Rate (%)</Label>
            <Input type="number" step="0.1" min="0" max="100"
              value={form.commission_rate != null ? (form.commission_rate * 100).toFixed(1) : ''}
              onChange={e => setForm(f => ({ ...f, commission_rate: (parseFloat(e.target.value) || 0) / 100 }))} />
          </div>

          {/* Sync interval for hubs */}
          {isBookingHub && (
            <div className="space-y-1.5">
              <Label className="text-xs">Sync Interval (minutes)</Label>
              <Select value={String(form.sync_interval_minutes || 10)} onValueChange={v => setForm(f => ({ ...f, sync_interval_minutes: parseInt(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">Every 5 min</SelectItem>
                  <SelectItem value="10">Every 10 min</SelectItem>
                  <SelectItem value="30">Every 30 min</SelectItem>
                  <SelectItem value="60">Every hour</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs">Notes / Setup Log</Label>
            <Textarea value={form.setup_notes || ''} onChange={e => setForm(f => ({ ...f, setup_notes: e.target.value }))} rows={3} placeholder="Any notes about this connection..." />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {isBookingHub && (
              <Button variant="outline" size="sm" onClick={() => onTest && onTest(form)} disabled={testing}>
                {testing ? 'Testing...' : '🔌 Test Connection'}
              </Button>
            )}
            <Button className="ml-auto bg-[#1a5c38] hover:bg-[#154d2f]" size="sm" onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}