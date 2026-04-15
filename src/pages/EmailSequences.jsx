import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useTenant } from '../components/shared/TenantContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '../components/shared/PageHeader';
import EmailSequencesTab from '../components/email/EmailSequencesTab';
import EmailTemplatesTab from '../components/email/EmailTemplatesTab';
import SequenceEnrollmentsTab from '../components/email/SequenceEnrollmentsTab';
import QuickSequenceSetup from '../components/email/QuickSequenceSetup';
import { Zap } from 'lucide-react';

export default function EmailSequences() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const [activeTab, setActiveTab] = useState('sequences');

  const { data: sequences = [] } = useQuery({
    queryKey: ['email-sequences', tenantId],
    queryFn: () => base44.entities.EmailSequence.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });

  const showQuickSetup = sequences.length === 0;

  if (!tenantId) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      Izberi podjetje.
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Email sekvence"
        subtitle="Avtomatizirane e-poštne kampanje po rezervaciji in drugih dogodkih"
      />

      {/* Quick setup banner */}
      {showQuickSetup && activeTab !== 'setup' && (
        <div className="mb-6 p-4 bg-[#1a5c38]/5 border border-[#1a5c38]/20 rounded-xl flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-[#1a5c38]/10 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-[#1a5c38]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Ni nastavljenih sekvenc</p>
            <p className="text-xs text-gray-500">Uporabi hitro postavitev za ustvaritev standardnih sekvenc po rezervaciji.</p>
          </div>
          <button
            onClick={() => setActiveTab('setup')}
            className="text-sm font-medium text-[#1a5c38] hover:underline shrink-0">
            Hitra postavitev →
          </button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="sequences">Sekvence</TabsTrigger>
          <TabsTrigger value="templates">Predloge</TabsTrigger>
          <TabsTrigger value="enrollments">Vpisi strank</TabsTrigger>
          <TabsTrigger value="setup">⚡ Hitra postavitev</TabsTrigger>
        </TabsList>

        <TabsContent value="sequences">
          <EmailSequencesTab tenantId={tenantId} />
        </TabsContent>

        <TabsContent value="templates">
          <EmailTemplatesTab tenantId={tenantId} />
        </TabsContent>

        <TabsContent value="enrollments">
          <SequenceEnrollmentsTab tenantId={tenantId} />
        </TabsContent>

        <TabsContent value="setup">
          <QuickSequenceSetup
            tenantId={tenantId}
            existingSequences={sequences}
            onDone={() => setActiveTab('sequences')}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}