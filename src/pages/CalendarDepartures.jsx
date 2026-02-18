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
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';

export default function CalendarDepartures() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

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

  const getDeparturesForDay = (day) => {
    return departures.filter(d => {
      const depDate = d.start_at ? new Date(d.start_at) : null;
      return depDate && isSameDay(depDate, day);
    });
  };

  const handleCreate = () => {
    createMutation.mutate({ ...form, tenant_id: tenantId });
  };

  if (!tenantId) return null;

  return (
    <div>
      <PageHeader title="Calendar & Departures" subtitle="Manage timeslots and capacity">
        <Button onClick={() => { setForm({ tenant_id: tenantId, status: 'open', currency: 'EUR' }); setShowForm(true); }} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Add Departure
        </Button>
      </PageHeader>

      {/* Week Navigation */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={() => setCurrentDate(addDays(currentDate, -7))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h3 className="text-sm font-medium text-gray-700">
          {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
        </h3>
        <Button variant="outline" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 7))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-7 gap-3">
        {days.map(day => {
          const dayDeps = getDeparturesForDay(day);
          const isToday = isSameDay(day, new Date());
          return (
            <div key={day.toISOString()} className="min-h-[200px]">
              <div className={`text-center mb-2 py-1.5 rounded-lg text-xs font-medium ${isToday ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600'}`}>
                <div>{format(day, 'EEE')}</div>
                <div className="text-lg font-bold">{format(day, 'd')}</div>
              </div>
              <div className="space-y-1.5">
                {dayDeps.map(dep => (
                  <Card key={dep.id} className="border-0 shadow-sm hover:shadow transition-shadow cursor-pointer">
                    <CardContent className="p-2.5">
                      <p className="text-xs font-medium truncate">{dep.experience_title || 'Experience'}</p>
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
              </div>
            </div>
          );
        })}
      </div>

      {departures.length === 0 && !isLoading && (
        <EmptyState icon={Calendar} title="No departures" description="Create timeslots or sync from your distribution hub." />
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Departure</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Experience</Label>
              <Select value={form.experience_id || ''} onValueChange={v => {
                const exp = experiences.find(e => e.id === v);
                setForm({...form, experience_id: v, experience_title: exp?.title_en || exp?.title_sl || ''});
              }}>
                <SelectTrigger><SelectValue placeholder="Select experience" /></SelectTrigger>
                <SelectContent>
                  {experiences.map(e => <SelectItem key={e.id} value={e.id}>{e.title_en || e.title_sl}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Start</Label>
                <Input type="datetime-local" value={form.start_at || ''} onChange={e => setForm({...form, start_at: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label>End</Label>
                <Input type="datetime-local" value={form.end_at || ''} onChange={e => setForm({...form, end_at: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Total Capacity</Label>
                <Input type="number" value={form.capacity_total || ''} onChange={e => setForm({...form, capacity_total: parseInt(e.target.value) || 0, capacity_remaining: parseInt(e.target.value) || 0})} />
              </div>
              <div className="space-y-1.5">
                <Label>Price (€)</Label>
                <Input type="number" step="0.01" value={form.price_cached || ''} onChange={e => setForm({...form, price_cached: parseFloat(e.target.value) || 0})} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}