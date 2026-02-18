import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusStyles = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  open: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  sent: 'bg-blue-50 text-blue-700 border-blue-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  draft: 'bg-gray-50 text-gray-600 border-gray-200',
  queued: 'bg-gray-50 text-gray-600 border-gray-200',
  received: 'bg-blue-50 text-blue-700 border-blue-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  void: 'bg-red-50 text-red-700 border-red-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  no_show: 'bg-orange-50 text-orange-700 border-orange-200',
  paused: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  closed: 'bg-gray-50 text-gray-600 border-gray-200',
  archived: 'bg-gray-50 text-gray-600 border-gray-200',
  disabled: 'bg-gray-50 text-gray-600 border-gray-200',
  suspended: 'bg-red-50 text-red-700 border-red-200',
  processed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
};

export default function StatusBadge({ status, className }) {
  const style = statusStyles[status] || 'bg-gray-50 text-gray-600 border-gray-200';
  return (
    <Badge variant="outline" className={cn('text-xs font-medium capitalize border', style, className)}>
      {status?.replace(/_/g, ' ')}
    </Badge>
  );
}