import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Pre-defined transform rule templates
const RULE_TEMPLATES = [
  { key: 'lang', label: 'Language', type: 'select', options: ['en', 'sl', 'de', 'hr'], description: 'Primary language for text fields' },
  { key: 'currency', label: 'Currency', type: 'select', options: ['EUR', 'USD', 'GBP', 'CHF'], description: 'Currency for pricing' },
  { key: 'price_rounding', label: 'Price rounding', type: 'select', options: ['none', 'integer', '2dp'], description: 'How to round prices' },
  { key: 'include_inactive', label: 'Include inactive', type: 'boolean', description: 'Include draft/archived experiences' },
  { key: 'images_limit', label: 'Max images per item', type: 'number', description: 'Limit number of images returned' },
  { key: 'category_map', label: 'Category mapping', type: 'json', description: 'Map your categories to partner categories' },
];

export default function TransformRulesEditor({ value, onChange }) {
  const [rules, setRules] = useState({});

  useEffect(() => {
    if (!value) { setRules({}); return; }
    try { setRules(JSON.parse(value)); } catch { setRules({}); }
  }, []);

  const update = (key, val) => {
    const updated = { ...rules };
    if (val === '' || val === null || val === undefined) {
      delete updated[key];
    } else {
      updated[key] = val;
    }
    setRules(updated);
    onChange(Object.keys(updated).length ? JSON.stringify(updated, null, 2) : '');
  };

  return (
    <div className="space-y-3">
      {RULE_TEMPLATES.map(rule => (
        <div key={rule.key} className="grid grid-cols-[160px_1fr] items-center gap-3">
          <div>
            <p className="text-xs font-medium text-gray-700">{rule.label}</p>
            <p className="text-xs text-gray-400">{rule.description}</p>
          </div>
          <div>
            {rule.type === 'select' && (
              <Select value={rules[rule.key] || ''} onValueChange={v => update(rule.key, v || null)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Default" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Default</SelectItem>
                  {rule.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {rule.type === 'boolean' && (
              <Switch
                checked={!!rules[rule.key]}
                onCheckedChange={v => update(rule.key, v || null)}
              />
            )}
            {rule.type === 'number' && (
              <Input
                type="number"
                className="h-8 text-xs w-24"
                placeholder="No limit"
                value={rules[rule.key] || ''}
                onChange={e => update(rule.key, e.target.value ? parseInt(e.target.value) : null)}
              />
            )}
            {rule.type === 'json' && (
              <Input
                className="h-8 text-xs font-mono"
                placeholder='{"adventure": "outdoor"}'
                value={typeof rules[rule.key] === 'object' ? JSON.stringify(rules[rule.key]) : (rules[rule.key] || '')}
                onChange={e => {
                  try { update(rule.key, e.target.value ? JSON.parse(e.target.value) : null); }
                  catch { update(rule.key, e.target.value || null); }
                }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}