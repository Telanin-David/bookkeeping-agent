'use client';
import { useState } from 'react';
import { reportsApi } from '@/lib/api';
import { useShopsStore } from '@/store/shops';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import type { ReportType } from '@/types';

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: 'receipt',  label: 'Receipt Report' },
  { value: 'credit',   label: 'Credit Report' },
  { value: 'stock',    label: 'Stock Report' },
  { value: 'pl',       label: 'Profit & Loss' },
];

export default function ReportForm() {
  const activeShop = useShopsStore((s) => s.activeShop());
  const [type, setType]         = useState<ReportType>('pl');
  const [from, setFrom]         = useState('');
  const [to, setTo]             = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function generate() {
    if (!activeShop) { setError('Select a shop first'); return; }
    setLoading(true);
    setError('');
    try {
      const { data } = await reportsApi.generate(type, { shopId: activeShop.id, from, to });
      const url = URL.createObjectURL(data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to generate report. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Report type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ReportType)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          {REPORT_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input id="from" label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input id="to"   label="To"   type="date" value={to}   onChange={(e) => setTo(e.target.value)}   />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button onClick={generate} loading={loading} disabled={!from || !to}>
        Generate & Download PDF
      </Button>
    </div>
  );
}
