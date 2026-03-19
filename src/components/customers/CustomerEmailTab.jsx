import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import EmailCompose from '../email/EmailCompose';

export default function CustomerEmailTab({ customer, tenantId }) {
  const [composing, setComposing] = useState(false);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['customer-emails', customer.id],
    queryFn: () => base44.entities.EmailMessage.filter({ tenant_id: tenantId, customer_id: customer.id }, '-created_date', 50),
    enabled: !!customer.id,
  });

  if (composing) {
    return (
      <div className="border rounded-lg overflow-hidden" style={{ height: 500 }}>
        <EmailCompose
          tenantId={tenantId}
          initialTo={customer.email || ''}
          initialSubject=""
          contextData={{ customer_id: customer.id, customer_name: customer.name, customer_email: customer.email }}
          onClose={() => setComposing(false)}
          onSent={() => setComposing(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{messages.length} emailov</p>
        <Button size="sm" className="bg-[#1a5c38] gap-1 h-7 text-xs" onClick={() => setComposing(true)}>
          ✏️ Pošlji email tej stranki
        </Button>
      </div>

      {isLoading && <div className="text-center py-8 text-gray-400 text-sm">Nalagam...</div>}

      {!isLoading && messages.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">Ni email komunikacije s to stranko.</div>
      )}

      <div className="space-y-1">
        {messages.map(msg => (
          <div key={msg.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 border border-gray-100 transition-colors">
            <div className="mt-0.5">
              {msg.direction === 'inbound'
                ? <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">← Prejeto</span>
                : <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">→ Poslano</span>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{msg.subject || '(brez zadeve)'}</p>
              {msg.body_text && (
                <p className="text-xs text-gray-400 truncate mt-0.5">{msg.body_text.substring(0, 100)}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-400">
                {msg.sent_at ? format(new Date(msg.sent_at), 'd. M. HH:mm') : msg.created_date ? format(new Date(msg.created_date), 'd. M.') : ''}
              </p>
              <Badge variant="outline" className="text-xs mt-0.5 capitalize">{msg.status}</Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}