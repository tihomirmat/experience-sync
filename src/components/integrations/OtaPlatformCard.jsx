import React from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, Settings } from 'lucide-react';

const PLATFORM_EMOJIS = {
  viator:               '🌍',
  getyourguide:         '🟡',
  booking_experiences:  '💙',
  airbnb_experiences:   '🏠',
  tripadvisor:          '🦉',
  expedia_experiences:  '✈️',
  klook:                '🟢',
  musement:             '🎭',
};

const STATUS_DOT = {
  active:      'bg-emerald-500',
  in_progress: 'bg-blue-400',
  error:       'bg-red-500',
  paused:      'bg-amber-400',
  not_started: 'bg-gray-300',
};

export default function OtaPlatformCard({ conn, onConfigure }) {
  const dot = STATUS_DOT[conn.setup_status] || 'bg-gray-300';
  const commPct = conn.commission_rate ? `${(conn.commission_rate * 100).toFixed(0)}%` : null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{PLATFORM_EMOJIS[conn.hub_type] || '🔗'}</span>
          <div>
            <p className="font-medium text-sm text-gray-900">{conn.channel_label || conn.hub_type}</p>
            {commPct && <p className="text-xs text-gray-400">Commission: {commPct}</p>}
          </div>
        </div>
        <span className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${dot}`} title={conn.setup_status} />
      </div>

      {/* Listing URL */}
      {conn.listing_url ? (
        <a href={conn.listing_url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-600 hover:underline truncate">
          <ExternalLink className="w-3 h-3 shrink-0" />
          <span className="truncate">{conn.listing_url}</span>
        </a>
      ) : (
        <p className="text-xs text-gray-400 italic">No listing URL set</p>
      )}

      {/* Webhook status */}
      <p className="text-xs text-gray-500">
        {conn.setup_status === 'active' ? '✅ Webhook active' : conn.setup_status === 'in_progress' ? '🔄 Setup in progress' : '⚪ Not connected'}
      </p>

      <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs mt-auto" onClick={() => onConfigure(conn)}>
        <Settings className="w-3 h-3" /> {conn.setup_status === 'not_started' ? 'Connect' : 'Configure'}
      </Button>
    </div>
  );
}