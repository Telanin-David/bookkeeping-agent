'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { importsApi, downloadName } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { isDemoShop } from '@/lib/demo';
import { shareOrDownload } from '@/lib/share';
import { useShopsStore } from '@/store/shops';
import PageWrapper from '@/components/layout/PageWrapper';
import FileUpload from '@/components/imports/FileUpload';
import ColumnMapper from '@/components/imports/ColumnMapper';
import ValidationSummary from '@/components/imports/ValidationSummary';
import Button from '@/components/ui/Button';
import { formatDateTime } from '@/lib/utils';
import type { ImportCheck, ImportMapping, ImportPreview, ImportResult } from '@/types';

type Step = 'upload' | 'map' | 'check' | 'done';
const STEPS: [Step, string][] = [['upload', 'Upload'], ['map', 'Match columns'], ['check', 'Check'], ['done', 'Done']];

export default function ImportsPage() {
  const shop = useShopsStore((s) => s.activeShop());
  const shopId = shop?.id ?? '';
  const demo = isDemoShop(shopId);
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('upload');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [check, setCheck] = useState<ImportCheck | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const { data: history = [] } = useQuery({
    queryKey: ['imports', shopId], queryFn: () => importsApi.list(shopId), enabled: !!shopId && !demo,
  });

  function reset() {
    setStep('upload'); setPreview(null); setCheck(null); setResult(null); setError('');
  }

  async function run(fn: () => Promise<void>, fallback: string) {
    setBusy(true); setError('');
    try { await fn(); } catch (err) { setError(errorMessage(err, fallback)); } finally { setBusy(false); }
  }

  const onUploaded = (p: ImportPreview) => { setPreview(p); setMapping(p.suggestedMapping); setStep('map'); setNote(''); };

  const onMapped = (m: ImportMapping) => run(async () => {
    setMapping(m);
    setCheck(await importsApi.validate(preview!.importId, m));
    setStep('check');
  }, "Couldn't check the rows. Try again.");

  const onConfirm = (includeDuplicates: boolean) => run(async () => {
    setResult(await importsApi.confirm(preview!.importId, includeDuplicates));
    setStep('done');
    // Everything that shows transactions, stock-free totals and alerts is now out of date.
    qc.invalidateQueries({ queryKey: ['transactions', shopId] });
    qc.invalidateQueries({ queryKey: ['profit', shopId] });
    qc.invalidateQueries({ queryKey: ['staff', shopId] });
    qc.invalidateQueries({ queryKey: ['alerts'] });
    qc.invalidateQueries({ queryKey: ['imports', shopId] });
  }, "Couldn't import. Nothing was saved; try again.");

  async function undo(importId: string, filename: string) {
    if (!window.confirm(`Remove everything imported from "${filename}"? Payments you recorded against those debts are removed too.`)) return;
    await run(async () => {
      const { removed } = await importsApi.undo(importId);
      setNote(`Removed ${removed} ${removed === 1 ? 'transaction' : 'transactions'} imported from ${filename}.`);
      if (result?.importId === importId) reset();
      qc.invalidateQueries({ queryKey: ['transactions', shopId] });
      qc.invalidateQueries({ queryKey: ['profit', shopId] });
      qc.invalidateQueries({ queryKey: ['staff', shopId] });
      qc.invalidateQueries({ queryKey: ['alerts'] });
      qc.invalidateQueries({ queryKey: ['imports', shopId] });
    }, "Couldn't undo the import. Try again.");
  }

  async function downloadTemplate() {
    await run(async () => {
      const res = await importsApi.template();
      await shareOrDownload(res.data, downloadName(res.headers, 'bookkeeping-import-template.xlsx'), 'Import template');
    }, "Couldn't download the template.");
  }

  return (
    <PageWrapper title="Import from a spreadsheet">
      <div className="max-w-2xl space-y-6">
        {/* Phones: where you are, and a bar for how far along. */}
        <div className="sm:hidden">
          <p className="text-[13px] text-white/45">
            Step {STEPS.findIndex(([s]) => s === step) + 1} of {STEPS.length} · <span className="font-medium text-white/85">{STEPS.find(([s]) => s === step)?.[1]}</span>
          </p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.08]">
            <div className="h-full rounded-full bg-white/60 transition-all duration-300" style={{ width: `${((STEPS.findIndex(([s]) => s === step) + 1) / STEPS.length) * 100}%` }} />
          </div>
        </div>
        <ol className="hidden flex-wrap items-center gap-2 text-[13px] sm:flex">
          {STEPS.map(([s, label], i) => (
            <li key={s} className="flex items-center gap-2">
              {i > 0 && <span className="text-white/20">›</span>}
              <span className={step === s ? 'font-semibold text-white/85' : 'text-white/35'}>{label}</span>
            </li>
          ))}
        </ol>

        {demo ? (
          <div className="glass-card rounded-2xl p-5 text-[14px] text-white/55">Importing adds real records, so it isn&apos;t available in demo mode.</div>
        ) : (
          <>
            {step === 'upload' && (
              <div className="space-y-3">
                <FileUpload onUploaded={onUploaded} />
                <p className="text-[13px] text-white/45">
                  Already keep your sales in Excel or Google Sheets? Upload it as it is: we&apos;ll match the columns.
                  Starting fresh?{' '}
                  <button type="button" onClick={downloadTemplate} className="text-white/75 underline underline-offset-2">Download a template</button>.
                </p>
              </div>
            )}
            {step === 'map' && preview && (
              <ColumnMapper preview={preview} initial={mapping} loading={busy} error={error} onSubmit={onMapped} onCancel={reset} />
            )}
            {step === 'check' && check && (
              <ValidationSummary result={check} loading={busy} error={error} onConfirm={onConfirm} onBack={() => { setError(''); setStep('map'); }} />
            )}
            {step === 'done' && result && (
              <div className="glass-card space-y-3 rounded-2xl p-6">
                <p className="text-lg font-semibold text-white/90">Imported {result.imported} {result.imported === 1 ? 'transaction' : 'transactions'}</p>
                {result.skipped > 0 && <p className="text-[14px] text-white/55">{result.skipped} {result.skipped === 1 ? 'row was' : 'rows were'} left out.</p>}
                <p className="text-[13px] text-white/45">Credit sales past their due date now show as overdue, with an alert.</p>
                <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap">
                  <Link href="/transactions" className="flex"><Button size="lg" className="flex-1">See transactions</Button></Link>
                  <Button size="lg" variant="secondary" onClick={reset}>Import another file</Button>
                  <Button size="lg" variant="ghost" onClick={() => undo(result.importId, preview?.filename ?? 'this file')} loading={busy}>Undo this import</Button>
                </div>
              </div>
            )}
            {note && <p className="text-[13px] text-white/60" role="status">{note}</p>}
            {step !== 'map' && step !== 'check' && error && <p className="text-[13px] text-white/70" role="alert">{error}</p>}

            {history.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/40">Past imports</p>
                <ul className="glass-card divide-y divide-white/[0.05] rounded-2xl">
                  {history.map((h) => (
                    <li key={h.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] text-white/85">{h.filename}</p>
                        <p className="text-[12px] text-white/40">
                          {formatDateTime(h.createdAt)} · {h.status === 'undone' ? `undone (${h.importedRows ?? 0} removed)` : `${h.importedRows ?? 0} imported`}
                        </p>
                      </div>
                      {h.status === 'confirmed' && (h.importedRows ?? 0) > 0 && (
                        <button type="button" onClick={() => undo(h.id, h.filename)} disabled={busy} className="text-[13px] text-white/50 underline-offset-2 hover:text-white/85 hover:underline disabled:opacity-40">
                          Undo
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </PageWrapper>
  );
}
