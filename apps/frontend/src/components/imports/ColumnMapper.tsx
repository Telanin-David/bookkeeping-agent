'use client';
import { useState } from 'react';
import Button from '@/components/ui/Button';

const FIELDS = ['date', 'amount', 'description', 'type', 'counterparty', 'category'] as const;

interface ColumnMapperProps {
  detectedColumns: string[];
  onSubmit: (mapping: Record<string, string>) => Promise<void>;
}

export default function ColumnMapper({ detectedColumns, onSubmit }: ColumnMapperProps) {
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    try { await onSubmit(mapping); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-white/50">Map your file columns to the required fields:</p>
      <div className="space-y-3">
        {FIELDS.map((field) => (
          <div key={field} className="flex items-center gap-4">
            <span className="w-28 text-xs font-medium uppercase tracking-wide text-white/40 capitalize">{field}</span>
            <select
              value={mapping[field] ?? ''}
              onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}
              className="glass-input flex-1 rounded-xl px-3.5 py-2 text-sm bg-transparent"
            >
              <option value="" className="bg-ink-900">— skip —</option>
              {detectedColumns.map((col) => (
                <option key={col} value={col} className="bg-ink-900">{col}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <Button onClick={handleSubmit} loading={loading}>Validate Mapping</Button>
    </div>
  );
}
