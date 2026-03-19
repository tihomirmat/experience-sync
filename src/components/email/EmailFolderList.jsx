import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

const SYSTEM_FOLDERS = [
  { slug: 'inbox', icon: '📥', label: 'Prejeto' },
  { slug: 'sent', icon: '📤', label: 'Poslano' },
  { slug: 'drafts', icon: '📝', label: 'Osnutki' },
  { slug: 'archive', icon: '🗄️', label: 'Arhiv' },
  { slug: 'trash', icon: '🗑️', label: 'Koš' },
];

export default function EmailFolderList({ tenantId, activeFolder, onFolderChange, emailConnection, unreadCount = 0 }) {
  const queryClient = useQueryClient();
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);

  const { data: customFolders = [] } = useQuery({
    queryKey: ['email-folders', tenantId],
    queryFn: () => base44.entities.EmailFolder.filter({ tenant_id: tenantId }, 'sort_order'),
    enabled: !!tenantId,
  });

  const createFolderMutation = useMutation({
    mutationFn: (name) => base44.entities.EmailFolder.create({
      tenant_id: tenantId,
      name,
      slug: name.toLowerCase().replace(/\s+/g, '_'),
      is_system: false,
      sort_order: customFolders.length + 10,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-folders'] });
      setNewFolderName('');
      setShowNewFolder(false);
    },
  });

  const statusIndicator = emailConnection
    ? emailConnection.status === 'active'
      ? <span className="text-xs text-emerald-600">✅ {emailConnection.provider === 'gmail' ? 'Gmail' : emailConnection.provider === 'resend' ? 'Resend' : 'SMTP'}: Povezano</span>
      : <span className="text-xs text-red-500">⚠️ Napaka</span>
    : <span className="text-xs text-gray-400">Ni nastavljeno</span>;

  return (
    <div className="flex flex-col h-full p-3">
      <div className="space-y-0.5 mb-4">
        {SYSTEM_FOLDERS.map(f => (
          <button
            key={f.slug}
            onClick={() => onFolderChange(f.slug)}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-colors text-left
              ${activeFolder === f.slug ? 'bg-[#1a5c38]/10 text-[#1a5c38] font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <span>{f.icon} {f.label}</span>
            {f.slug === 'inbox' && unreadCount > 0 && (
              <span className="text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {customFolders.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide px-2 mb-1">Mape</p>
          {customFolders.map(f => (
            <button
              key={f.slug}
              onClick={() => onFolderChange(f.slug)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors text-left
                ${activeFolder === f.slug ? 'bg-[#1a5c38]/10 text-[#1a5c38] font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <span>{f.icon || '📁'}</span>
              <span>{f.name}</span>
            </button>
          ))}
        </div>
      )}

      {showNewFolder ? (
        <div className="flex gap-1 mb-3">
          <Input
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="Ime mape"
            className="h-7 text-xs"
            onKeyDown={e => { if (e.key === 'Enter' && newFolderName) createFolderMutation.mutate(newFolderName); }}
            autoFocus
          />
          <Button size="sm" className="h-7 px-2 text-xs bg-[#1a5c38]" onClick={() => newFolderName && createFolderMutation.mutate(newFolderName)}>
            +
          </Button>
        </div>
      ) : (
        <button
          onClick={() => setShowNewFolder(true)}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <Plus className="w-3 h-3" /> Nova mapa
        </button>
      )}

      <div className="mt-auto pt-3 border-t">
        {statusIndicator}
        <Link to="/IntegrationSettings">
          <button className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors">
            <Settings className="w-3 h-3" /> Nastavitve emaila
          </button>
        </Link>
      </div>
    </div>
  );
}