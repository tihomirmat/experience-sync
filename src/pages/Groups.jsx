import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '../components/shared/TenantContext';
import PageHeader from '../components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InquiriesTab from '../components/groups/InquiriesTab';
import OffersTab from '../components/groups/OffersTab';
import { Users } from 'lucide-react';

export default function Groups() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  if (!tenantId) return null;

  return (
    <div>
      <PageHeader
        title="Agencije & Skupine"
        subtitle="Upravljanje poizvedb in ponudb za zasebne skupine"
      />
      <Tabs defaultValue="inquiries">
        <TabsList className="mb-6">
          <TabsTrigger value="inquiries">Poizvedbe</TabsTrigger>
          <TabsTrigger value="offers">Ponudbe</TabsTrigger>
        </TabsList>
        <TabsContent value="inquiries">
          <InquiriesTab tenantId={tenantId} />
        </TabsContent>
        <TabsContent value="offers">
          <OffersTab tenantId={tenantId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}