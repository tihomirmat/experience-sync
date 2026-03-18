import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { startOfMonth, endOfMonth, subDays, startOfYear, endOfYear, subMonths, startOfDay, endOfDay, format } from 'date-fns';

const PRESETS = [
  { label: 'Ta mesec', key: 'this_month' },
  { label: 'Zadnjih 30 dni', key: 'last_30' },
  { label: 'Zadnjih 90 dni', key: 'last_90' },
  { label: 'Letos', key: 'this_year' },
  { label: 'Prilagojeno', key: 'custom' },
];

export function getDateRange(preset, customStart, customEnd) {
  const now = new Date();
  switch (preset) {
    case 'this_month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'last_30':
      return { start: subDays(now, 30), end: now };
    case 'last_90':
      return { start: subDays(now, 90), end: now };
    case 'this_year':
      return { start: startOfYear(now), end: endOfYear(now) };
    case 'custom':
      return { start: customStart ? new Date(customStart) : subDays(now, 30), end: customEnd ? new Date(customEnd) : now };
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

export function getPrevRange(preset, customStart, customEnd) {
  const now = new Date();
  switch (preset) {
    case 'this_month': {
      const prev = subMonths(now, 1);
      return { start: startOfMonth(prev), end: endOfMonth(prev) };
    }
    case 'last_30':
      return { start: subDays(now, 60), end: subDays(now, 30) };
    case 'last_90':
      return { start: subDays(now, 180), end: subDays(now, 90) };
    case 'this_year': {
      const prevYear = new Date(now.getFullYear() - 1, 0, 1);
      return { start: startOfYear(prevYear), end: endOfYear(prevYear) };
    }
    default:
      return { start: subDays(now, 60), end: subDays(now, 30) };
  }
}

export default function DateRangeFilter({ preset, onPresetChange, customStart, customEnd, onCustomChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map(p => (
        <Button
          key={p.key}
          variant={preset === p.key ? 'default' : 'outline'}
          size="sm"
          className={preset === p.key ? 'bg-[#1a5c38] hover:bg-[#1a5c38]/90 text-white' : ''}
          onClick={() => onPresetChange(p.key)}
        >
          {p.label}
        </Button>
      ))}
      {preset === 'custom' && (
        <div className="flex items-center gap-2 ml-2">
          <Input type="date" value={customStart} onChange={e => onCustomChange('start', e.target.value)} className="w-36 h-8 text-sm" />
          <span className="text-gray-400 text-sm">–</span>
          <Input type="date" value={customEnd} onChange={e => onCustomChange('end', e.target.value)} className="w-36 h-8 text-sm" />
        </div>
      )}
    </div>
  );
}