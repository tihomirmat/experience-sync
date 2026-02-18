import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '../components/shared/TenantContext';
import PageHeader from '../components/shared/PageHeader';
import DataTable from '../components/shared/DataTable';
import StatusBadge from '../components/shared/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, AlertTriangle, Webhook, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

export default function Monitoring() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ['alerts', tenantId],
    queryFn: () => base44.entities.Alert.filter({ tenant_id: tenantId }, '-created_date', 50),
    enabled: !!tenantId,
  });

  const { data: webhooks = [], isLoading: webhooksLoading } = useQuery({
    queryKey: ['webhooks', tenantId],
    queryFn: () => base44.entities.WebhookEvent.filter({ tenant_id: tenantId }, '-created_date', 50),
    enabled: !!tenantId,
  });

  const { data: auditLogs = [], isLoading: auditLoading } = useQuery({
    queryKey: ['audit', tenantId],
    queryFn: () => base44.entities.AuditLog.filter({ tenant_id: tenantId }, '-created_date', 50),
    enabled: !!tenantId,
  });

  const resolveMutation = useMutation({
    mutationFn: (id) => base44.entities.Alert.update(id, { resolved: true, resolved_at: new Date().toISOString() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const openAlerts = alerts.filter(a => !a.resolved);
  const resolvedAlerts = alerts.filter(a => a.resolved);

  const alertColumns = [
    { header: 'Severity', render: r => <StatusBadge status={r.severity} /> },
    { header: 'Message', render: r => (
      <div>
        <p className="text-sm font-medium">{r.title || r.message}</p>
        {r.title && <p className="text-xs text-gray-400">{r.message}</p>}
      </div>
    )},
    { header: 'Time', render: r => <span className="text-sm text-gray-500">{r.created_date ? format(new Date(r.created_date), 'MMM d, HH:mm') : '—'}</span> },
    { header: '', render: r => !r.resolved && (
      <Button variant="ghost" size="sm" onClick={() => resolveMutation.mutate(r.id)} className="gap-1">
        <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
      </Button>
    )},
  ];

  const webhookColumns = [
    { header: 'Source', render: r => <Badge variant="outline" className="capitalize">{r.source}</Badge> },
    { header: 'Status', render: r => <StatusBadge status={r.status} /> },
    { header: 'Idempotency Key', render: r => <code className="text-xs font-mono text-gray-500">{r.idempotency_key || '—'}</code> },
    { header: 'Time', render: r => <span className="text-sm text-gray-500">{r.created_date ? format(new Date(r.created_date), 'MMM d, HH:mm') : '—'}</span> },
    { header: 'Error', render: r => r.error ? <span className="text-xs text-red-500 truncate max-w-[200px] block">{r.error}</span> : '—' },
  ];

  const auditColumns = [
    { header: 'Entity', render: r => <Badge variant="outline" className="capitalize text-xs">{r.entity_type}</Badge> },
    { header: 'Action', render: r => <StatusBadge status={r.action} /> },
    { header: 'Entity ID', render: r => <code className="text-xs font-mono text-gray-500">{r.entity_id?.slice(0, 8)}...</code> },
    { header: 'By', render: r => <span className="text-sm">{r.performed_by_name || r.performed_by || '—'}</span> },
    { header: 'Time', render: r => <span className="text-sm text-gray-500">{r.created_date ? format(new Date(r.created_date), 'MMM d, HH:mm') : '—'}</span> },
  ];

  if (!tenantId) return null;

  return (
    <div>
      <PageHeader title="Monitoring" subtitle="Alerts, webhooks, and audit trail" />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${openAlerts.length > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
              <AlertTriangle className={`w-5 h-5 ${openAlerts.length > 0 ? 'text-red-500' : 'text-emerald-500'}`} />
            </div>
            <div>
              <p className="text-2xl font-bold">{openAlerts.length}</p>
              <p className="text-xs text-gray-400">Open Alerts</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Webhook className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{webhooks.length}</p>
              <p className="text-xs text-gray-400">Webhook Events</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <Activity className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{auditLogs.length}</p>
              <p className="text-xs text-gray-400">Audit Entries</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="alerts">
        <TabsList className="bg-gray-100/70 mb-6">
          <TabsTrigger value="alerts">Alerts ({openAlerts.length})</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts">
          <DataTable columns={alertColumns} data={[...openAlerts, ...resolvedAlerts]} isLoading={alertsLoading} emptyMessage="All clear — no alerts" />
        </TabsContent>

        <TabsContent value="webhooks">
          <DataTable columns={webhookColumns} data={webhooks} isLoading={webhooksLoading} emptyMessage="No webhook events yet" />
        </TabsContent>

        <TabsContent value="audit">
          <DataTable columns={auditColumns} data={auditLogs} isLoading={auditLoading} emptyMessage="No audit entries yet" />
        </TabsContent>
      </Tabs>
    </div>
  );
}