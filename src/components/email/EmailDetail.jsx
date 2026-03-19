import React from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Reply, Forward, Archive, Trash2, Paperclip } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function EmailDetail({ email, allEmails = [], onReply, onClose }) {
  const queryClient = useQueryClient();

  const archiveMutation = useMutation({
    mutationFn: () => base44.entities.EmailMessage.update(email.id, { folder: 'archive' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-messages'] });
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.EmailMessage.update(email.id, { folder: 'trash' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-messages'] });
      onClose();
    },
  });

  // Thread: emails with same thread_id, sorted chronologically
  const thread = email.thread_id
    ? allEmails.filter(e => e.thread_id === email.thread_id).sort((a, b) => new Date(a.created_date) - new Date(b.created_date))
    : [email];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900 mb-2">{email.subject || '(brez zadeve)'}</h2>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 text-xs text-gray-500">
            <p><span className="text-gray-400">Od:</span> {email.from_name || ''} &lt;{email.from_email}&gt;</p>
            <p><span className="text-gray-400">Za:</span> {email.to_name || ''} &lt;{email.to_email}&gt;</p>
            {email.cc && <p><span className="text-gray-400">CC:</span> {email.cc}</p>}
            <p><span className="text-gray-400">Datum:</span> {email.sent_at ? format(new Date(email.sent_at), 'd. M. yyyy HH:mm') : '—'}</p>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Odgovori" onClick={() => onReply(email)}>
              <Reply className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Arhiviraj" onClick={() => archiveMutation.mutate()}>
              <Archive className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" title="Izbriši" onClick={() => deleteMutation.mutate()}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {thread.map((msg, idx) => (
          <div key={msg.id} className={`rounded-lg border ${msg.id === email.id ? 'border-[#1a5c38]/30 bg-white' : 'border-gray-100 bg-gray-50/50'}`}>
            {thread.length > 1 && (
              <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  <span className="font-medium">{msg.direction === 'inbound' ? msg.from_name || msg.from_email : 'Vi'}</span>
                  {' · '}
                  {msg.sent_at ? format(new Date(msg.sent_at), 'd. M. HH:mm') : ''}
                </div>
                <span className="text-xs text-gray-400">{idx + 1}/{thread.length}</span>
              </div>
            )}
            <div className="p-4">
              {msg.body_html ? (
                <div
                  className="text-sm prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: msg.body_html }}
                />
              ) : (
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{msg.body_text || '(prazno)'}</pre>
              )}

              {msg.attachments?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-2 flex items-center gap-1"><Paperclip className="w-3 h-3" /> Priponke</p>
                  <div className="flex flex-wrap gap-2">
                    {msg.attachments.map((att, i) => (
                      <a key={i} href={att.url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors">
                        <Paperclip className="w-3 h-3" />
                        {att.name}
                        {att.size && <span className="text-gray-400">({Math.round(att.size / 1024)}KB)</span>}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Linked context */}
      {(email.customer_id || email.booking_id || email.invoice_id) && (
        <div className="p-3 border-t border-gray-100 bg-gray-50/50">
          <p className="text-xs text-gray-400 mb-1.5">Povezano</p>
          <div className="flex flex-wrap gap-2">
            {email.customer_id && (
              <span className="text-xs bg-white border border-gray-200 rounded px-2 py-0.5">👤 Stranka</span>
            )}
            {email.booking_id && (
              <span className="text-xs bg-white border border-gray-200 rounded px-2 py-0.5">📅 Rezervacija</span>
            )}
            {email.invoice_id && (
              <span className="text-xs bg-white border border-gray-200 rounded px-2 py-0.5">🧾 Račun</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}