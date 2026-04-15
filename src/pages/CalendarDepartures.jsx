import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTenant } from '../components/shared/TenantContext';
import PageHeader from '../components/shared/PageHeader';
import StatusBadge from '../components/shared/StatusBadge';
import EmptyState from '../components/shared/EmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Plus, Calendar, Users as UsersIcon } from 'lucide-react';
import {
  format, addDays, addWeeks, addMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameDay, isSameMonth, parseISO,
  setHours, startOfDay, endOfDay
} from 'date-fns';

const VIEWS = ['month', 'week', 'day'];

function DepartureChip({ dep }) {
  return (
    <div className="bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 text-[10px] leading-tight hover:bg-blue-100 cursor-pointer truncate">
      <span className="font-medium text-blue-700">
        {dep.start_at ? format(new Date(dep.start_at), 'HH:mm') : '?'}{' '}
      </span>
      <span className="text-gray-600 truncate">{dep.experience_title || 'Odhod'}</span>
    </div>
  );
}

// ── Month View ────────────────────────────────────────────────────────────────
function MonthView({ currentDate, departures, onDayClick }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const today = new Date();

  const getDeps = (day) => departures.filter(d => d.start_at && isSameDay(new Date(d.start_at), day));

  return (
    <div>
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {['Pon', 'Tor', 'Sre', 'Čet', 'Pet', 'Sob', 'Ned'].map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 border-l border-t border-gray-100">
        {days.map(day => {
          const deps = getDeps(day);
          const isToday = isSameDay(day, today);
          const inMonth = isSameMonth(day, currentDate);
          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={`min-h-[100px] border-r border-b border-gray-100 p-1.5 cursor-pointer hover:bg-gray-50 transition-colors
                ${!inMonth ? 'bg-gray-50/50' : ''}`}
            >
              <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1
                ${isToday ? 'bg-blue-600 text-white' : inMonth ? 'text-gray-700' : 'text-gray-300'}`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {deps.slice(0, 3).map(dep => <DepartureChip key={dep.id} dep={dep} />)}
                {deps.length > 3 && (
                  <div className="text-[10px] text-gray-400 pl-1">+{deps.length - 3} več</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Week View ─────────────────────────────────────────────────────────────────
function WeekView({ currentDate, departures }) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  const getDeps = (day) => departures.filter(d => d.start_at && isSameDay(new Date(d.start_at), day));

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map(day => {
        const deps = getDeps(day);
        const isToday = isSameDay(day, today);
        return (
          <div key={day.toISOString()} className="min-h-[300px]">
            <div className={`text-center mb-2 py-1.5 rounded-lg text-xs font-medium
              ${isToday ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600'}`}>
              <div>{format(day, 'EEE')}</div>
              <div className="text-lg font-bold">{format(day, 'd')}</div>
            </div>
            <div className="space-y-1.5">
              {deps.map(dep => (
                <Card key={dep.id} className="border-0 shadow-sm hover:shadow transition-shadow cursor-pointer">
                  <CardContent className="p-2.5">
                    <p className="text-xs font-medium truncate">{dep.experience_title || 'Odhod'}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {dep.start_at ? format(new Date(dep.start_at), 'HH:mm') : '—'}
                    </p>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center gap-1 text-[10px] text-gray-500">
                        <UsersIcon className="w-3 h-3" />
                        <span>{dep.capacity_remaining ?? '—'}/{dep.capacity_total ?? '—'}</span>
                      </div>
                      <StatusBadge status={dep.status} className="text-[9px] px-1.5 py-0" />
                    </div>
                  </CardContent>
                </Card>
              ))}
              {deps.length === 0 && (
                <div className="text-center text-[10px] text-gray-300 pt-4">—</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Day View ──────────────────────────────────────────────────────────────────
function DayView({ currentDate, departures }) {
  const dayDeps = departures.filter(d => d.start_at && isSameDay(new Date(d.start_at), currentDate));
  const hours = Array.from({ length: 16 }, (_, i) => i + 6); // 06:00 – 21:00

  const getDepHour = (dep) => dep.start_at ? new Date(dep.start_at).getHours() : null;

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <div className="bg-blue-600 text-white text-center py-2 text-sm font-medium">
        {format(currentDate, 'EEEE, d. MMMM yyyy')}
      </div>
      <div className="divide-y divide-gray-100">
        {hours.map(hour => {
          const hourDeps = dayDeps.filter(d => getDepHour(d) === hour);
          return (
            <div key={hour} className="flex min-h-[56px]">
              <div className="w-16 shrink-0 text-xs text-gray-400 py-2 px-3 border-r border-gray-100 font-mono">
                {String(hour).padStart(2, '0')}:00
              </div>
              <div className="flex-1 p-1.5 flex flex-wrap gap-1.5">
                {hourDeps.map(dep => (
                  <Card key={dep.id} className="border-0 shadow-sm hover:shadow cursor-pointer">
                    <CardContent className="p-2.5 min-w-[180px]">
                      <p className="text-xs font-medium">{dep.experience_title || 'Odhod'}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {format(new Date(dep.start_at), 'HH:mm')}
                        {dep.end_at ? ` – ${format(new Date(dep.end_at), 'HH:mm')}` : ''}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1 text-[10px] text-gray-500">
                          <UsersIcon className="w-3 h-3" />
                          <span>{dep.capacity_remaining ?? '—'}/{dep.capacity_total ?? '—'}</span>
                        </div>
                        <StatusBadge status={dep.status} className="text-[9px] px-1.5 py-0" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CalendarDepartures() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});

  const { data: departures = [], isLoading } = useQuery({
    queryKey: ['departures', tenantId],
    queryFn: () => base44.entities.Departure.filter({ tenant_id: tenantId }, 'start_at', 200),
    enabled: !!tenantId,
  });

  const { data: experiences = [] } = useQuery({
    queryKey: ['experiences', tenantId],
    queryFn: () => base44.entities.Experience.filter({ tenant_id: tenantId }),
    enabled: !!tenantId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Departure.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['departures'] }); setShowForm(false); },
  });

  const handleCreate = () => createMutation.mutate({ ...form, tenant_id: tenantId });

  const navigate = (dir) => {
    if (view === 'month') setCurrentDate(d => addMonths(d, dir));
    else if (view === 'week') setCurrentDate(d => addWeeks(d, dir));
    else setCurrentDate(d => addDays(d, dir));
  };

  const getTitle = () => {
    if (view === 'month') return format(currentDate, 'MMMM yyyy');
    if (view === 'week') {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
      const we = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(ws, 'MMM d')} – ${format(we, 'MMM d, yyyy')}`;
    }
    return format(currentDate, 'd. MMMM yyyy');
  };

  if (!tenantId) return null;

  return (
    <div>
      <PageHeader title="Koledar & Odhodi" subtitle="Upravljaj termine in kapaciteto">
        <Button onClick={() => { setForm({ tenant_id: tenantId, status: 'open', currency: 'EUR' }); setShowForm(true); }} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Dodaj odhod
        </Button>
      </PageHeader>

      {/* Nav bar */}
      <div className="flex items-center justify-between mb-6">
        {/* Left: prev / today / next */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Danes</Button>
          <Button variant="outline" size="icon" onClick={() => navigate(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Center: title */}
        <h3 className="text-sm font-semibold text-gray-700">{getTitle()}</h3>

        {/* Right: view switcher */}
        <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm">
          {[{ key: 'month', label: 'Mesec' }, { key: 'week', label: 'Teden' }, { key: 'day', label: 'Dan' }].map(v => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`px-3 py-1.5 transition-colors ${view === v.key ? 'bg-blue-600 text-white font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Views */}
      {view === 'month' && (
        <MonthView
          currentDate={currentDate}
          departures={departures}
          onDayClick={(day) => { setCurrentDate(day); setView('day'); }}
        />
      )}
      {view === 'week' && <WeekView currentDate={currentDate} departures={departures} />}
      {view === 'day' && <DayView currentDate={currentDate} departures={departures} />}

      {departures.length === 0 && !isLoading && (
        <EmptyState icon={Calendar} title="Ni odhodov" description="Ustvari termine ali sinhroniziraj iz booking huba." />
      )}

      {/* Create Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nov odhod</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Izkušnja</Label>
              <Select value={form.experience_id || ''} onValueChange={v => {
                const exp = experiences.find(e => e.id === v);
                setForm({ ...form, experience_id: v, experience_title: exp?.title_en || exp?.title_sl || '' });
              }}>
                <SelectTrigger><SelectValue placeholder="Izberi izkušnjo" /></SelectTrigger>
                <SelectContent>
                  {experiences.map(e => <SelectItem key={e.id} value={e.id}>{e.title_en || e.title_sl}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Začetek</Label>
                <Input type="datetime-local" value={form.start_at || ''} onChange={e => setForm({ ...form, start_at: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Konec</Label>
                <Input type="datetime-local" value={form.end_at || ''} onChange={e => setForm({ ...form, end_at: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Kapaciteta</Label>
                <Input type="number" value={form.capacity_total || ''} onChange={e => setForm({ ...form, capacity_total: parseInt(e.target.value) || 0, capacity_remaining: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label>Cena (€)</Label>
                <Input type="number" step="0.01" value={form.price_cached || ''} onChange={e => setForm({ ...form, price_cached: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Prekliči</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>Ustvari</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}