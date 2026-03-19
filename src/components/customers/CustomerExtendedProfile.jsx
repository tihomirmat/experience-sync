import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Save, X, Plus } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORY_COLORS = {
  vip: 'bg-amber-100 text-amber-700 border-amber-200',
  regular: 'bg-blue-50 text-blue-700 border-blue-200',
  agency: 'bg-purple-50 text-purple-700 border-purple-200',
  one_time: 'bg-gray-100 text-gray-600 border-gray-200',
};

export default function CustomerExtendedProfile({ customer, tenantId }) {
  const queryClient = useQueryClient();
  const [tagInput, setTagInput] = useState('');
  const [form, setForm] = useState(null);

  const { data: extended, isLoading } = useQuery({
    queryKey: ['customer-extended', customer.id],
    queryFn: async () => {
      const results = await base44.entities.CustomerExtended.filter({ tenant_id: tenantId, customer_id: customer.id });
      return results[0] || null;
    },
    enabled: !!customer.id,
    onSuccess: (data) => {
      if (data) setForm({ ...data });
      else setForm({ tenant_id: tenantId, customer_id: customer.id, tags: [], language: 'sl', source: 'direct', category: 'regular' });
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data) => extended
      ? base44.entities.CustomerExtended.update(extended.id, data)
      : base44.entities.CustomerExtended.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-extended', customer.id] });
      toast.success('Profil shranjen');
    },
  });

  if (isLoading || !form) return <div className="text-sm text-gray-400 py-4">Nalagam...</div>;

  const addTag = () => {
    if (!tagInput.trim()) return;
    setForm(f => ({ ...f, tags: [...(f.tags || []), tagInput.trim()] }));
    setTagInput('');
  };

  const removeTag = (tag) => setForm(f => ({ ...f, tags: (f.tags || []).filter(t => t !== tag) }));

  return (
    <div className="space-y-5">
      {/* Category badge */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={`border ${CATEGORY_COLORS[form.category] || ''}`}>
          {form.category === 'vip' ? '⭐ VIP' : form.category === 'agency' ? '🤝 Agencija' : form.category === 'one_time' ? 'Enkratna stranka' : '👤 Redna stranka'}
        </Badge>
        {form.next_followup_date && (
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            📅 Naslednji kontakt: {form.next_followup_date}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Kategorija stranke</Label>
          <Select value={form.category || 'regular'} onValueChange={v => setForm(f => ({...f, category: v}))}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="regular">Redna stranka</SelectItem>
              <SelectItem value="vip">VIP</SelectItem>
              <SelectItem value="agency">Agencija</SelectItem>
              <SelectItem value="one_time">Enkratna stranka</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Rojstni dan</Label>
          <Input type="date" className="h-8" value={form.birthdate || ''} onChange={e => setForm(f => ({...f, birthdate: e.target.value}))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Država (ISO)</Label>
          <Input className="h-8" value={form.country || ''} onChange={e => setForm(f => ({...f, country: e.target.value}))} placeholder="SI, DE, AT..." />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Jezik</Label>
          <Select value={form.language || 'sl'} onValueChange={v => setForm(f => ({...f, language: v}))}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sl">Slovenščina</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="de">Deutsch</SelectItem>
              <SelectItem value="it">Italiano</SelectItem>
              <SelectItem value="fr">Français</SelectItem>
              <SelectItem value="other">Drugo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Vir pridobitve</Label>
          <Select value={form.source || 'direct'} onValueChange={v => setForm(f => ({...f, source: v}))}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="direct">Direktno</SelectItem>
              <SelectItem value="airbnb">Airbnb</SelectItem>
              <SelectItem value="gyg">GetYourGuide</SelectItem>
              <SelectItem value="booking">Booking.com</SelectItem>
              <SelectItem value="referral">Priporočilo</SelectItem>
              <SelectItem value="walk_in">Osebno</SelectItem>
              <SelectItem value="other">Drugo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Naslednji kontakt</Label>
          <Input type="date" className="h-8" value={form.next_followup_date || ''} onChange={e => setForm(f => ({...f, next_followup_date: e.target.value}))} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Alergije / posebne zahteve</Label>
        <Input value={form.allergies || ''} onChange={e => setForm(f => ({...f, allergies: e.target.value}))} placeholder="Npr. gluten, laktoza" className="h-8" />
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label className="text-xs">Oznake (tags)</Label>
        <div className="flex flex-wrap gap-1.5">
          {(form.tags || []).map(tag => (
            <span key={tag} className="flex items-center gap-1 text-xs bg-[#1a5c38]/10 text-[#1a5c38] rounded-full px-2 py-0.5">
              {tag}
              <button onClick={() => removeTag(tag)} className="hover:text-red-500 transition-colors">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          <Input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            placeholder="Dodaj oznako..."
            className="h-7 text-xs"
            onKeyDown={e => e.key === 'Enter' && addTag()}
          />
          <Button size="sm" variant="outline" className="h-7 px-2" onClick={addTag}>
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <Button size="sm" className="bg-[#1a5c38] gap-1.5 w-full"
        onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
        <Save className="w-3.5 h-3.5" /> Shrani razširjeni profil
      </Button>
    </div>
  );
}