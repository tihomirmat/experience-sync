import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import StatusBadge from '../shared/StatusBadge';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

const PROVIDER_META = {
  quibi:       { name: 'Quibi', emoji: '🇸🇮' },
  cebelca:     { name: 'Čebelca', emoji: '🐝' },
  minimax:     { name: 'Minimax', emoji: '📊' },
  vasco:       { name: 'Vasco', emoji: '📋' },
  pantheon:    { name: 'Pantheon', emoji: '🏛️' },
  generic_api: { name: 'Splošni API', emoji: '🔌' },
};

export default function InvoicingConnectionCard({ conn, onEdit, onTest, testing }) {
  const meta = PROVIDER_META[conn.provider_id] || { name: conn.provider_id, emoji: '🔌' };

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gray-50 border flex items-center justify-center text-2xl">
              {meta.emoji}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900">{meta.name}</p>
                {conn.is_default && (
                  <span className="text-xs bg-[#1a5c38]/10 text-[#1a5c38] px-2 py-0.5 rounded-full font-medium">Privzeto</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={conn.status || 'unconfigured'} />
                {conn.last_healthcheck_at && (
                  <span className="text-xs text-gray-400">
                    Zadnji test: {format(new Date(conn.last_healthcheck_at), 'dd.MM.yyyy HH:mm')}
                  </span>
                )}
              </div>
              {conn.last_error && (
                <p className="text-xs text-red-500 mt-0.5">{conn.last_error}</p>
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
      </CardContent>
    </Card>
  );
}