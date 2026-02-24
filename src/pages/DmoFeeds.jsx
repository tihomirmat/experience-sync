import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '../components/shared/TenantContext';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, Code2, Clock, Plus, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

export default function DmoFeeds() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;

  const { data: partners = [] } = useQuery({
    queryKey: ['partners', tenantId],
    queryFn: () => base44.entities.Partner.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['dmo-logs', tenantId],
    queryFn: () => base44.entities.DmoSyncLog.filter({ tenant_id: tenantId }, '-created_date', 50),
    enabled: !!tenantId,
  });

  const activePartners = partners.filter(p => p.status === 'active');
  const baseUrl = window.location.origin;

  const logColumns = [
    { header: 'Partner', render: r => {
      const partner = partners.find(p => p.id === r.partner_id);
      return <span className="font-medium">{partner?.name || r.partner_id}</span>;
    }},
    { header: 'Endpoint', render: r => <Badge variant="outline" className="font-mono text-xs">{r.endpoint}</Badge> },
    { header: 'Status', render: r => (
      <Badge variant="outline" className={r.response_code < 400 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}>
        {r.response_code}
      </Badge>
    )},
    { header: 'Records', render: r => <span className="text-sm">{r.records_returned || 0}</span> },
    { header: 'Duration', render: r => <span className="text-sm text-gray-500">{r.duration_ms || 0}ms</span> },
    { header: 'Time', render: r => <span className="text-sm text-gray-500">{r.created_date ? format(new Date(r.created_date), 'MMM d, HH:mm') : '—'}</span> },
  ];

  if (!tenantId) return null;

  return (
    <div>
      <PageHeader title="DMO Feeds" subtitle="Public API endpoints for partner integration" />

      {/* Endpoints Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {['listings', 'availability', 'pricing'].map(endpoint => (
          <Card key={endpoint} className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                  {endpoint === 'listings' ? <Globe className="w-4 h-4 text-blue-600" /> :
                   endpoint === 'availability' ? <Clock className="w-4 h-4 text-blue-600" /> :
                   <Code2 className="w-4 h-4 text-blue-600" />}
                </div>
                <div>
                  <p className="font-medium capitalize">{endpoint}</p>
                  <p className="text-xs text-gray-400">GET</p>
                </div>
              </div>
              <code className="text-xs bg-gray-50 rounded-md p-2 block break-all text-gray-600">
                /api/partners/{'{slug}'}/{endpoint}
              </code>
              <p className="text-xs text-gray-400 mt-2">
                Auth: <code className="text-gray-500">X-Partner-Key: {'<api_key>'}</code>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Partners */}
      <Card className="border-0 shadow-sm mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Active Partners ({activePartners.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {activePartners.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No active partners with API access</p>
          ) : (
            <div className="space-y-2">
              {activePartners.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-gray-400">Slug: {p.slug} · Type: {p.partner_type}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">{p.pricing_mode || 'gross'}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Access Logs */}
      <h3 className="text-base font-medium mb-4">Access Logs</h3>
      <DataTable columns={logColumns} data={logs} isLoading={isLoading} emptyMessage="No API access logs yet" />
    </div>
  );
}