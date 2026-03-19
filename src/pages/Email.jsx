import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '../components/shared/TenantContext';
import EmailFolderList from '../components/email/EmailFolderList';
import EmailList from '../components/email/EmailList';
import EmailDetail from '../components/email/EmailDetail';
import EmailCompose from '../components/email/EmailCompose';

const FOLDER_MAP = {
  inbox: ['received', 'read'],
  sent: ['sent', 'delivered'],
  drafts: ['draft'],
  archive: ['archive'],
  trash: ['trash'],
};

export default function Email() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const [activeFolder, setActiveFolder] = useState('inbox');
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [composing, setComposing] = useState(false);
  const [replyTo, setReplyTo] = useState(null);

  const { data: allMessages = [], isLoading } = useQuery({
    queryKey: ['email-messages', tenantId],
    queryFn: () => base44.entities.EmailMessage.filter({ tenant_id: tenantId }, '-created_date', 500),
    enabled: !!tenantId,
  });

  const { data: connections = [] } = useQuery({
    queryKey: ['email-connections', tenantId],
    queryFn: () => base44.entities.EmailConnection.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });
  const activeConnection = connections.find(c => c.status === 'active');

  const folderEmails = allMessages.filter(e => {
    if (activeFolder === 'inbox') return e.folder === 'inbox' || (!e.folder && e.direction === 'inbound');
    if (activeFolder === 'sent') return e.folder === 'sent' || (!e.folder && e.direction === 'outbound' && e.status !== 'draft');
    if (activeFolder === 'drafts') return e.folder === 'drafts' || e.status === 'draft';
    if (activeFolder === 'archive') return e.folder === 'archive';
    if (activeFolder === 'trash') return e.folder === 'trash';
    return e.folder === activeFolder;
  });

  const unreadCount = allMessages.filter(e => e.status === 'received').length;

  const handleReply = (email) => {
    setReplyTo(email);
    setComposing(true);
  };

  const handleCompose = () => {
    setReplyTo(null);
    setComposing(true);
  };

  if (!tenantId) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      Izberi podjetje za ogled emailov.
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-56px)] -m-4 lg:-m-8 overflow-hidden">
      {/* Left: Folders */}
      <div className="w-[200px] shrink-0 border-r border-gray-100 bg-white overflow-y-auto">
        <EmailFolderList
          tenantId={tenantId}
          activeFolder={activeFolder}
          onFolderChange={(f) => { setActiveFolder(f); setSelectedEmail(null); }}
          emailConnection={activeConnection}
          unreadCount={unreadCount}
        />
      </div>

      {/* Middle: Email list */}
      <div className="w-[340px] shrink-0 bg-white overflow-hidden">
        <EmailList
          emails={folderEmails}
          isLoading={isLoading}
          onSelect={(e) => { setSelectedEmail(e); setComposing(false); }}
          selectedId={selectedEmail?.id}
          onCompose={handleCompose}
        />
      </div>

      {/* Right: Detail or Compose */}
      <div className="flex-1 bg-white overflow-hidden">
        {composing ? (
          <EmailCompose
            tenantId={tenantId}
            initialTo={replyTo ? replyTo.from_email : ''}
            initialSubject={replyTo ? `Re: ${replyTo.subject}` : ''}
            initialBody={replyTo ? `\n\n---\n${replyTo.body_text || ''}` : ''}
            onClose={() => { setComposing(false); setReplyTo(null); }}
          />
        ) : selectedEmail ? (
          <EmailDetail
            email={selectedEmail}
            allEmails={allMessages}
            onReply={handleReply}
            onClose={() => setSelectedEmail(null)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="text-5xl mb-3">📧</div>
            <p className="text-sm">Izberi email za ogled ali sestavi novega</p>
          </div>
        )}
      </div>
    </div>
  );
}