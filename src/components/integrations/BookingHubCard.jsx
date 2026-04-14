import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Settings, RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_CONFIG = {
  active:       { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle, dot: 'bg-emerald-500' },
  error:        { color: 'bg-red-100 text-red-700 border-red-200',             icon: AlertCircle, dot: 'bg-red-500' },
  paused:       { color: 'bg-amber-100 text-amber-700 border-amber-200',       icon: Clock,       dot: 'bg-amber-400' },
  not_started:  { color: 'bg-gray-100 text-gray-500 border-gray-200',          icon: Clock,       dot: 'bg-gray-300' },
  in_progress:  { color: 'bg-blue-100 text-blue-700 border-blue-200',          icon: RefreshCw,   dot: 'bg-blue-400' },
};

const HUB_ICONS = {
  bokun:       '🔷',
  fareharbor:  '⛵',
};

export default function BookingHubCard({ conn, onConfigure, testing, onTest, bookingCount = 0, experienceCount = 0 }) {
  const cfg = STATUS_CONFIG[conn.setup_status] || STATUS_CONFIG.not_started;
  const Icon = cfg.icon;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Logo area */}
      <div className="w-14 h-14 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-2xl shrink-0">
        {conn.channel_logo_url
          ? <img src={conn.channel_logo_url} alt={conn.channel_label} className="w-10 h-10 object-contain" />
          : <span>{HUB_ICONS[conn.hub_type] || '🔗'}</span>
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-gray-900">{conn.channel_label || conn.hub_type}</h3>
          <Badge variant="outline" className={`text-xs border ${cfg.color}`}>
            <Icon className="w-3 h-3 mr-1" />
            {conn.setup_status?.replace('_', ' ') || 'Not configured'}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
          <span>🔄 {conn.sync_direction?.replace('_', ' ') || 'two way'}</span>
          <span>⏱ Every {conn.sync_interval_minutes || 10} min</span>
          {conn.last_sync_at && <span>Last sync: {format(new Date(conn.last_sync_at), 'MMM d HH:mm')}</span>}
          {bookingCount > 0 && <span>📅 {bookingCount} bookings</span>}
          {experienceCount > 0 && <span>🗺 {experienceCount} experiences</span>}
        </div>
        {conn.setup_notes && (
          <p className="mt-1.5 text-xs text-red-600 truncate max-w-sm">{conn.setup_notes}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 shrink-0">
        {conn.setup_status === 'active' && (
          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => onTest && onTest(conn)} disabled={testing}>
            <RefreshCw className={`w-3 h-3 ${testing ? 'animate-spin' : ''}`} /> Test
          </Button>
        )}
        <Button size="sm" className="gap-1 bg-[#1a5c38] hover:bg-[#154d2f] text-xs" onClick={() => onConfigure(conn)}>
          <Settings className="w-3 h-3" /> Configure
        </Button>
      </div>
    </div>
  );
}