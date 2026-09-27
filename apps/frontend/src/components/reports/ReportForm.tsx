'use client';
import { useState } from 'react';
import { DownloadSimple } from '@phosphor-icons/react';
import { reportsApi, downloadName, blobErrorMessage } from '@/lib/api';
import { isDemoShop } from '@/lib/demo';
import { shareOrDownload } from '@/lib/share';
import { useShopsStore } from '@/store/shops';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import type { ReportType } from '@/types';

// Receipts are per-transaction, so they live in the Receipts tab.
type DateRangeReport = Exclude<ReportType, 'receipt'>;
const REPORT_TYPES: { value: DateRangeReport; label: string; hint: string }[] = [
  { value: 'pl',     label: 'Profit & Loss', hint: 'What you earned, what you spent, and your profit for the period.' },
  { value: 'credit', label: 'Credit Report', hint: 'Who owes you, how much and how late — plus bills you still owe.' },
  { value: 'stock',  label: 'Stock Report',  hint: 'What is on your shelves, what is running low, and anything found missing at a count.' },
];

const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function ReportForm() {
  const activeShop = useShopsStore((s) => s.activeShop());
  const today = new Date();
  const [type, setType]       = useState<DateRangeReport>('pl');
  // Default to this month so one tap produces something useful.
  const [from, setFrom]       = useState(isoDay(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo]           = useState(isoDay(today));
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const demo = isDemoShop(activeShop?.id);

  async function generate() {
    if (!activeShop) { setError('Select a shop first.'); return; }
    if (from > to) { setError('The start date must be on or before the end date.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await reportsApi.generate(type, { shopId: activeShop.id, dateFrom: from, dateTo: to });
      await shareOrDownload(res.data, downloadName(res.headers, `${type}-report.pdf`), `${activeShop.name} report`);
    } catch (err) {
      setError(await blobErrorMessage(err, "Couldn't make the report. Check your connection and try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-card max-w-md space-y-5 rounded-2xl p-5 sm:p-6">
      <Select
        id="report-type"
        label="Report type"
        value={type}
        onChange={(e) => setType(e.target.value as DateRangeReport)}
        hint={REPORT_TYPES.find((r) => r.value === type)?.hint}
      >
        {REPORT_TYPES.map((r) => (
          <option key={r.value} value={r.value} className="bg-ink-900">{r.label}</option>
        ))}
      </Select>

      <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
        <Input id="from" label="From" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        <Input id="to"   label="To"   type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
      </div>

      {demo && <p className="text-xs text-white/45">PDF reports are made from your real records, so they aren&apos;t available in demo mode.</p>}
      {error && <p className="text-xs text-white/60">{error}</p>}

      <Button size="lg" onClick={generate} loading={loading} disabled={!from || !to || demo} className="w-full gap-2 sm:w-auto">
        <DownloadSimple size={15} />
        Get PDF
      </Button>
    </div>
  );
}
