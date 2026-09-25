'use client';
import { useState } from 'react';
import { Download } from 'lucide-react';
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
  const [type, setType]       = useState<ReportType>('pl');
  const [from, setFrom]       = useState('');
  const [to, setTo]           = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

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
    <div className="glass-card rounded-2xl p-6 space-y-5 max-w-md">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-white/40">Report type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ReportType)}
          className="glass-input w-full rounded-xl px-3.5 py-2.5 text-sm bg-transparent"
        >
          {REPORT_TYPES.map((r) => (
            <option key={r.value} value={r.value} className="bg-ink-900">{r.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input id="from" label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input id="to"   label="To"   type="date" value={to}   onChange={(e) => setTo(e.target.value)}   />
      </div>

      {error && <p className="text-xs text-white/45">{error}</p>}

      <Button onClick={generate} loading={loading} disabled={!from || !to} className="gap-2">
        <Download size={14} />
        Generate &amp; Download PDF
      </Button>
    </div>
  );
}
