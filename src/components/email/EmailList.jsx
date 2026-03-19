import React, { useState } from 'react';
import { format } from 'date-fns';
import { Search, Paperclip } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function EmailList({ emails = [], isLoading, onSelect, selectedId, onCompose }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = emails.filter(e => {
    const matchSearch = !search ||
      e.subject?.toLowerCase().includes(search.toLowerCase()) ||
      e.from_name?.toLowerCase().includes(search.toLowerCase()) ||
      e.to_name?.toLowerCase().includes(search.toLowerCase()) ||
      e.body_text?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all'
      || (filter === 'unread' && e.status === 'received')
      || (filter === 'attachments' && e.attachments?.length > 0);
    return matchSearch && matchFilter;
  });

  const formatDate = (d) => {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return format(date, 'HH:mm');
    return format(date, 'd. M.');
  };

  const senderLabel = (e) => e.direction === 'inbound' ? (e.from_name || e.from_email) : (e.to_name || e.to_email);

  return (
    <div className="flex flex-col h-full border-r border-gray-100">
      {/* Top bar */}
      <div className="p-3 border-b border-gray-100 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              placeholder="Išči..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Button size="sm" className="h-8 bg-[#1a5c38] hover:bg-[#154d2f] gap-1 text-xs" onClick={onCompose}>
            ✏️ Sestavi
          </Button>
        </div>
        <div className="flex gap-1">
          {[['all', 'Vsi'], ['unread', 'Neprebrani'], ['attachments', 'S prilogami']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`px-2 py-0.5 text-xs rounded-full transition-colors
                ${filter === v ? 'bg-[#1a5c38] text-white' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && [...Array(6)].map((_, i) => (
          <div key={i} className="px-3 py-3 border-b border-gray-50 animate-pulse">
            <div className="h-3 bg-gray-100 rounded w-3/4 mb-2" />
            <div className="h-2 bg-gray-50 rounded w-1/2" />
          </div>
        ))}
        {!isLoading && filtered.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-12">Ni emailov</div>
        )}
        {!isLoading && filtered.map(email => {
          const isUnread = email.status === 'received';
          const isSelected = selectedId === email.id;
          return (
            <button
              key={email.id}
              onClick={() => onSelect(email)}
              className={`w-full text-left px-3 py-2.5 border-b border-gray-50 transition-colors
                ${isSelected ? 'bg-[#1a5c38]/5' : 'hover:bg-gray-50'}`}
            >
              <div className="flex items-start justify-between gap-2 mb-0.5">
                <span className={`text-sm truncate ${isUnread ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                  {senderLabel(email) || '—'}
                </span>
                <span className="text-xs text-gray-400 shrink-0">{formatDate(email.sent_at || email.created_date)}</span>
              </div>
              <div className="flex items-center gap-1">
                <p className={`text-xs truncate flex-1 ${isUnread ? 'font-medium text-gray-800' : 'text-gray-500'}`}>
                  {email.direction === 'outbound' && <span className="text-gray-400">→ </span>}
                  {email.subject || '(brez zadeve)'}
                </p>
                {email.attachments?.length > 0 && <Paperclip className="w-3 h-3 text-gray-400 shrink-0" />}
                {isUnread && <span className="w-2 h-2 rounded-full bg-[#1a5c38] shrink-0" />}
              </div>
              {email.body_text && (
                <p className="text-xs text-gray-400 truncate mt-0.5">{email.body_text.substring(0, 80)}</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}