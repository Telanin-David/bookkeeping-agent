'use client';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { ImportCheck } from '@/types';

interface ValidationSummaryProps {
  result: ImportCheck;
  loading: boolean;
  error: string;
  onConfirm: (includeDuplicates: boolean) => void;
  onBack: () => void;
}

const KIND_LABELS: [keyof ImportCheck['counts'], string, string][] = [
  ['sale', 'sale', 'sales'], ['expense', 'expense', 'expenses'],
  ['receivable', 'credit sale', 'credit sales'], ['payable', 'bill', 'bills'],
];

export default function ValidationSummary({ result, loading, error, onConfirm, onBack }: ValidationSummaryProps) {
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const toImport = result.validRows + (includeDuplicates ? result.duplicateRows : 0);
  const kinds = KIND_LABELS.filter(([k]) => result.counts[k] > 0).map(([k, one, many]) => `${result.counts[k]} ${result.counts[k] === 1 ? one : many}`);

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-5">
        <p className="text-[22px] font-semibold text-white/90">{result.validRows} {result.validRows === 1 ? 'row is' : 'rows are'} ready</p>
        {kinds.length > 0 && <p className="mt-1 text-[14px] text-white/60">{kinds.join(', ')}</p>}
        {result.validRows > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
            <div className="rounded-xl bg-white/[0.04] px-3 py-2"><p className="text-white/40">Money in</p><p className="tabular-nums text-white/85">{formatCurrency(result.moneyIn)}</p></div>
            <div className="rounded-xl bg-white/[0.04] px-3 py-2"><p className="text-white/40">Money out</p><p className="tabular-nums text-white/85">{formatCurrency(result.moneyOut)}</p></div>
          </div>
        )}
        {result.dateRange && (
          <p className="mt-2 text-[13px] text-white/45">From {formatDate(result.dateRange.from)} to {formatDate(result.dateRange.to)}</p>
        )}
        {result.emptyRows > 0 && (
          <p className="mt-1 text-[12px] text-white/35">{result.emptyRows} {result.emptyRows === 1 ? 'line has' : 'lines have'} no amount (titles, subtotals or notes) and will be left out.</p>
        )}
      </div>

      {result.duplicateRows > 0 && (
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[14px] text-white/80">
            {result.duplicateRows} {result.duplicateRows === 1 ? 'row is' : 'rows are'} already in your records (same date, amount and description), so {result.duplicateRows === 1 ? 'it' : 'they'} will be left out.
          </p>
          <ul className="mt-2 space-y-0.5 text-[12px] text-white/45">
            {result.duplicates.slice(0, 5).map((dup) => (
              <li key={dup.row}>Row {dup.row}: {formatDate(dup.date)} · {formatCurrency(dup.amount)}{dup.description ? ` · ${dup.description}` : ''}</li>
            ))}
          </ul>
          <label className="mt-3 flex items-center gap-2 text-[13px] text-white/70">
            <input type="checkbox" checked={includeDuplicates} onChange={(e) => setIncludeDuplicates(e.target.checked)} className="h-4 w-4 accent-white" />
            They&apos;re different sales that happen to match. Import them anyway.
          </label>
        </div>
      )}

      {result.errorRows > 0 && (
        <div className="glass-card rounded-2xl p-4">
          <p className="text-[14px] text-white/80">
            {result.errorRows} {result.errorRows === 1 ? 'row needs' : 'rows need'} fixing and will be left out. Fix {result.errorRows === 1 ? 'it' : 'them'} in your spreadsheet and import it again later; the rows already imported will be skipped.
          </p>
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-[13px]">
            {result.problems.map((p, i) => (
              <li key={i} className="text-white/55"><span className="text-white/80">Row {p.row}:</span> {p.message}</li>
            ))}
          </ul>
          {result.errorRows > result.problems.length && <p className="mt-1 text-[12px] text-white/35">…and {result.errorRows - result.problems.length} more.</p>}
        </div>
      )}

      {error && <p className="text-[13px] text-white/70" role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onBack}>Change columns</Button>
        <Button onClick={() => onConfirm(includeDuplicates)} loading={loading} disabled={toImport === 0}>
          {toImport === 0 ? 'Nothing to import' : `Import ${toImport} ${toImport === 1 ? 'row' : 'rows'}`}
        </Button>
      </div>
    </div>
  );
}
