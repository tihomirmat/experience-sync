import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, ArrowLeftRight, ArrowDownToLine, ArrowUpFromLine, Settings } from 'lucide-react';
import { SYNC_DIRECTION_LABELS } from './channelCatalog';
import { format } from 'date-fns';

const CATEGORY_COLORS = {
  'OTA': 'bg-orange-50 text-orange-700 border-orange-200',
  'Booking Hub': 'bg-blue-50 text-blue-700 border-blue-200',
  'Local Partner': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Website': 'bg-purple-50 text-purple-700 border-purple-200',
  'Payment': 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

function SyncIcon({ direction }) {
  if (direction === 'two_way' || direction === 'webhook_only') return <ArrowLeftRight className="w-3 h-3" />;
  if (direction === 'inbound_only') return <ArrowDownToLine className="w-3 h-3" />;
  return <ArrowUpFromLine className="w-3 h-3" />;
}

export default function ChannelCard({ channel, connection, onConnect, onManage }) {
  const isConnected = !!connection && connection.setup_status === 'active';
  const isPending = !!connection && connection.setup_status !== 'active' && connection.setup_status !== 'not_started';
  const isComingSoon = channel.status === 'coming_soon' && !connection;

  return (
    <div className={`bg-white rounded-xl border p-5 flex flex-col gap-3 hover:shadow-md transition-all duration-200
      ${isConnected ? 'border-green-200 ring-1 ring-green-100' : 'border-gray-200'}
      ${isComingSoon ? 'opacity-70' : ''}`}>

      {/* Top row: avatar + name + category */}
      <div className="flex items-start gap-3">
        {/* Colored avatar */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm"
          style={{ backgroundColor: channel.color }}
        >
          {channel.initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm truncate">{channel.name}</span>
            {isConnected && (
              <span className="flex items-center gap-1 text-[10px] text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 font-medium">
                <CheckCircle2 className="w-2.5 h-2.5" /> Connected
              </span>
            )}
            {isPending && (
              <span className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 font-medium">
                <Clock className="w-2.5 h-2.5" /> In Progress
              </span>
            )}
          </div>
          <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded border mt-1 ${CATEGORY_COLORS[channel.category] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
            {channel.category}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-500 leading-relaxed line-clamp-1">{channel.description}</p>

      {/* Sync direction + commission */}
      <div className="flex items-center gap-3 text-[11px] text-gray-500">
        <span className="flex items-center gap-1">
          <SyncIcon direction={channel.sync_direction} />
          {SYNC_DIRECTION_LABELS[channel.sync_direction] || channel.sync_direction}
        </span>
        {(isConnected && connection.commission_rate > 0) && (
          <span className="text-gray-400">·</span>
        )}
        {(isConnected && connection.commission_rate > 0) && (
          <span className="font-medium text-gray-600">{Math.round(connection.commission_rate * 100)}% commission</span>
        )}
        {(!isConnected && channel.default_commission > 0) && (
          <>
            <span className="text-gray-400">·</span>
            <span>~{Math.round(channel.default_commission * 100)}% commission</span>
          </>
        )}
      </div>

      {/* Last sync */}
      {isConnected && connection.last_sync_at && (
        <p className="text-[10px] text-gray-400">
          Last sync: {format(new Date(connection.last_sync_at), 'MMM d, HH:mm')}
        </p>
      )}

      {/* Action button */}
      <div className="mt-auto pt-1">
        {isComingSoon ? (
          <Button variant="outline" size="sm" disabled className="w-full text-xs text-gray-400">
            Coming Soon
          </Button>
        ) : isConnected ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs gap-1.5 border-gray-200"
            onClick={() => onManage(channel, connection)}
          >
            <Settings className="w-3.5 h-3.5" /> Manage
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full text-xs bg-[#1A56DB] hover:bg-[#1A56DB]/90 text-white"
            onClick={() => onConnect(channel, connection)}
          >
            Connect
          </Button>
        )}
      </div>
    </div>
  );
}