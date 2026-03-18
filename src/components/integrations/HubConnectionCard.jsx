import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import StatusBadge from '../shared/StatusBadge';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

const HUB_META = {
  fareharbor:     { name: 'FareHarbor', emoji: '🎡' },
  bokun:          { name: 'Bokun', emoji: '📦' },
  trekksoft:      { name: 'TrekkSoft', emoji: '🗺️' },
  rezdy:          { name: 'Rezdy', emoji: '📅' },
  gyg_direct:     { name: 'GetYourGuide Direct', emoji: '🟠' },
  custom_webhook: { name: 'Custom Webhook', emoji: '🔗' },
};

export default function HubConnectionCard({ conn, onEdit, onTest, testing }) {
  const meta = HUB_META[conn.hub_type] || { name: conn.hub_type, emoji: '🔌' };

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gray-50 border flex items-center justify-center text-2xl">
              {meta.emoji}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{meta.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={conn.status || 'active'} />
                {conn.last_sync_at && (
                  <span className="text-xs text-gray-400">
                    Zadnja sync: {format(new Date(conn.last_sync_at), 'dd.MM.yyyy HH:mm')}
                  </span>
                )}
              </div>
              {conn.last_sync_status && (
                <p className="text-xs text-gray-400 mt-0.5">{conn.last_sync_status}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => onTest(conn)} disabled={testing}>
              {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Preizkusi'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => onEdit(conn)}>Uredi</Button>
          </div>
        </div>
        {conn.base_url && (
          <p className="text-xs text-gray-400 mt-3 border-t pt-3">URL: {conn.base_url}</p>
        )}
      </CardContent>
    </Card>
  );
}