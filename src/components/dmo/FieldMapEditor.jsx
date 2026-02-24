import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, AlertCircle } from 'lucide-react';

// Available source fields from our Experience entity
const OUR_FIELDS = [
  'title_en', 'title_sl', 'short_description_en', 'short_description_sl',
  'full_description_en', 'full_description_sl', 'duration_minutes',
  'meeting_point_name', 'meeting_point_address', 'meeting_point_lat', 'meeting_point_lng',
  'category_tags', 'base_price_from', 'currency', 'booking_url_direct',
  'images', 'includes_en', 'excludes_en', 'cancellation_policy_en', 'status',
];

export default function FieldMapEditor({ value, onChange }) {
  const [rows, setRows] = useState([]);
  const [jsonError, setJsonError] = useState(null);

  // Parse incoming JSON string → rows
  useEffect(() => {
    if (!value) { setRows([]); setJsonError(null); return; }
    try {
      const parsed = JSON.parse(value);
      const r = Object.entries(parsed).map(([our, their]) => ({ our, their }));
      setRows(r);
      setJsonError(null);
    } catch {
      setJsonError('Invalid JSON');
    }
  }, []);

  const sync = (newRows) => {
    setRows(newRows);
    const obj = {};
    newRows.forEach(({ our, their }) => { if (our && their) obj[our] = their; });
    onChange(Object.keys(obj).length ? JSON.stringify(obj, null, 2) : '');
  };

  const addRow = () => sync([...rows, { our: '', their: '' }]);
  const removeRow = (i) => sync(rows.filter((_, idx) => idx !== i));
  const updateRow = (i, field, val) => {
    const updated = rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r);
    sync(updated);
  };

  return (
    <div className="space-y-2">
      {jsonError && (
        <div className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5" /> {jsonError} — edit JSON directly in the field below
        </div>
      )}
      {rows.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_32px] bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-500 border-b">
            <span>Our field</span><span>Their field</span><span />
          </div>
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_32px] gap-1 px-2 py-1.5 border-b last:border-0 items-center">
              <select
                className="text-xs border rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={row.our}
                onChange={e => updateRow(i, 'our', e.target.value)}
              >
                <option value="">Select field…</option>
                {OUR_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <Input
                className="h-7 text-xs"
                placeholder="their_field_name"
                value={row.their}
                onChange={e => updateRow(i, 'their', e.target.value)}
              />
              <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-red-500" onClick={() => removeRow(i)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={addRow}>
        <Plus className="w-3 h-3" /> Add mapping
      </Button>
    </div>
  );
}