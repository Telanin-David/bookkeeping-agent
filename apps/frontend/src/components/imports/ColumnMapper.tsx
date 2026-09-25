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
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Map your file columns to the required fields:</p>
      <div className="space-y-3">
        {FIELDS.map((field) => (
          <div key={field} className="flex items-center gap-4">
            <span className="w-28 text-sm font-medium text-gray-700 capitalize">{field}</span>
            <select
              value={mapping[field] ?? ''}
              onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value }))}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">— skip —</option>
              {detectedColumns.map((col) => <option key={col} value={col}>{col}</option>)}
            </select>
          </div>
        ))}
      </div>
      <Button onClick={handleSubmit} loading={loading}>Validate Mapping</Button>
    </div>
  );
}
