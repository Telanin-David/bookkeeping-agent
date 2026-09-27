// Spreadsheet import (Deliverable 9): upload → preview with guessed columns → check every
// row → import in one go → undo if it was a mistake. Parsing rules live in importParse.ts.

import crypto from 'crypto';
import ExcelJS from 'exceljs';
import { db } from '../config';
import { AppError } from '../middleware/errorHandler';
import { readFile, deleteFile } from './storage';
import { scanDebts } from './alerts';
import {
  readSheet, checkRows, guessMapping, mappingProblem, type Cell, type Mapping, type ParsedRow, type RowProblem, type Sheet,
} from './importParse';
import { todayIso } from '../utils/dates';
import type { ExcelImport, TransactionType } from '../types';

const SAMPLE_ROWS = 5;
const MAX_PROBLEMS_SHOWN = 100;

/** Preview text. Excel date cells are shown day first, like dates typed into the sheet. */
const show = (c: Cell): string => {
  if (c === null) return '';
  if (c instanceof Date) { const [y, m, d] = c.toISOString().slice(0, 10).split('-'); return `${d}/${m}/${y}`; }
  return String(c);
};

export interface Preview {
  importId: string;
  filename: string;
  headers: string[];
  sampleRows: string[][];
  totalRows: number;
  truncated: boolean;
  suggestedMapping: Mapping;
}

export function previewOf(job: ExcelImport, sheet: Sheet): Preview {
  return {
    importId: job.id,
    filename: job.filename,
    headers: sheet.headers,
    sampleRows: sheet.rows.slice(0, SAMPLE_ROWS).map((r) => r.cells.map(show)),
    totalRows: sheet.rows.length,
    truncated: sheet.truncated,
    suggestedMapping: (job.columnMapping as Mapping | undefined) ?? guessMapping(sheet.headers),
  };
}

export async function loadSheet(job: ExcelImport): Promise<Sheet> {
  if (!job.filePath) throw new AppError(410, 'GONE', 'The uploaded file is no longer available. Upload it again.');
  const buffer = await readFile(job.filePath).catch(() => { throw new AppError(410, 'GONE', 'The uploaded file is no longer available. Upload it again.'); });
  return readSheet(buffer);
}

export interface CheckSummary {
  importId: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  /** Rows that match a transaction already in the records (same date, amount, type and description). */
  duplicateRows: number;
  /** Lines with no amount (titles, subtotals, notes) — skipped without complaint. */
  emptyRows: number;
  /** Share of rows with an amount that can be imported, 0–1. */
  qualityScore: number;
  problems: RowProblem[];
  duplicates: { row: number; date: string; amount: number; description?: string }[];
  counts: Record<TransactionType, number>;
  moneyIn: number;
  moneyOut: number;
  dateRange: { from: string; to: string } | null;
  truncated: boolean;
}

interface Checked { summary: CheckSummary; rows: ParsedRow[]; duplicateRowNumbers: Set<number> }

/** Rows already in the shop's records: re-uploading the same sheet shouldn't count sales twice. */
async function findDuplicates(shopId: string, rows: ParsedRow[]): Promise<Set<number>> {
  if (rows.length === 0) return new Set();
  const { rows: hits } = await db.query(
    `SELECT r.n FROM unnest($2::date[], $3::numeric[], $4::text[], $5::text[], $6::int[]) AS r(d, a, t, descr, n)
     WHERE EXISTS (
       SELECT 1 FROM transactions x
       WHERE x.shop_id = $1 AND x.date = r.d AND x.amount = r.a AND x.type = r.t
         AND lower(coalesce(trim(x.description), '')) = lower(coalesce(trim(r.descr), '')))`,
    [shopId, rows.map((r) => r.date), rows.map((r) => r.amount), rows.map((r) => r.type),
     rows.map((r) => r.description ?? ''), rows.map((r) => r.rowNumber)],
  );
  return new Set(hits.map((h) => h['n'] as number));
}

async function check(job: ExcelImport, mapping: Mapping): Promise<Checked> {
  const sheet = await loadSheet(job);
  const problem = mappingProblem(mapping, sheet.headers);
  if (problem) throw new AppError(400, 'BAD_REQUEST', problem);
  const { valid, problems, skippedEmpty } = checkRows(sheet, mapping, todayIso());
  const duplicateRowNumbers = await findDuplicates(job.shopId, valid);
  const fresh = valid.filter((r) => !duplicateRowNumbers.has(r.rowNumber));
  const counts: Record<TransactionType, number> = { sale: 0, expense: 0, receivable: 0, payable: 0 };
  let moneyIn = 0; let moneyOut = 0;
  for (const r of fresh) {
    counts[r.type] += 1;
    if (r.type === 'sale' || r.type === 'receivable') moneyIn += r.amount; else moneyOut += r.amount;
  }
  const dates = fresh.map((r) => r.date).sort();
  const withAmount = valid.length + problems.length;
  return {
    rows: valid,
    duplicateRowNumbers,
    summary: {
      importId: job.id,
      totalRows: sheet.rows.length,
      validRows: fresh.length,
      errorRows: problems.length,
      duplicateRows: duplicateRowNumbers.size,
      emptyRows: skippedEmpty,
      qualityScore: withAmount ? Math.round((valid.length / withAmount) * 1000) / 1000 : 0,
      problems: problems.slice(0, MAX_PROBLEMS_SHOWN),
      duplicates: valid.filter((r) => duplicateRowNumbers.has(r.rowNumber)).slice(0, 50)
        .map((r) => ({ row: r.rowNumber, date: r.date, amount: r.amount, description: r.description })),
      counts,
      moneyIn: Math.round(moneyIn * 100) / 100,
      moneyOut: Math.round(moneyOut * 100) / 100,
      dateRange: dates.length ? { from: dates[0]!, to: dates[dates.length - 1]! } : null,
      truncated: sheet.truncated,
    },
  };
}

/** Checks every row with the owner's column choices and remembers them for the import. */
export async function validateImport(job: ExcelImport, mapping: Mapping): Promise<CheckSummary> {
  if (job.status === 'confirmed' || job.status === 'undone') throw new AppError(409, 'CONFLICT', 'This file has already been imported.');
  const { summary } = await check(job, mapping);
  await db.query(
    `UPDATE excel_imports SET status = 'validated', column_mapping = $2, row_count = $3, valid_rows = $4,
       error_rows = $5, quality_score = $6, error_log = $7 WHERE id = $1`,
    [job.id, JSON.stringify(mapping), summary.totalRows, summary.validRows, summary.errorRows, summary.qualityScore,
     JSON.stringify(summary.problems)],
  );
  return summary;
}

export interface ImportResult { importId: string; imported: number; skipped: number; counts: Record<TransactionType, number> }

/**
 * Imports the checked rows, all or nothing. Rows with problems are left out; rows already in
 * the records are left out unless the owner asks to include them.
 */
export async function confirmImport(job: ExcelImport, opts: { includeDuplicates: boolean }): Promise<ImportResult> {
  if (job.status !== 'validated' || !job.columnMapping) throw new AppError(400, 'BAD_REQUEST', 'Check the rows before importing.');
  const { rows, duplicateRowNumbers, summary } = await check(job, job.columnMapping as Mapping);
  const toImport = opts.includeDuplicates ? rows : rows.filter((r) => !duplicateRowNumbers.has(r.rowNumber));

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Claims the job first, so a double-tapped "Import" can't import twice.
    const { rows: claimed } = await client.query(
      `UPDATE excel_imports SET status = 'confirmed' WHERE id = $1 AND status = 'validated' RETURNING id`, [job.id],
    );
    if (!claimed[0]) throw new AppError(409, 'CONFLICT', 'This file has already been imported.');
    const { rows: shopRows } = await client.query('SELECT currency FROM shops WHERE id = $1', [job.shopId]);
    const currency = (shopRows[0]?.['currency'] as string | undefined) ?? 'NGN';

    const ids = toImport.map(() => crypto.randomUUID());
    const isDebt = (t: TransactionType) => t === 'receivable' || t === 'payable';
    const status = (r: ParsedRow) => (!isDebt(r.type) || (r.paid ?? 0) >= r.amount ? 'settled' : 'pending');
    await client.query(
      `INSERT INTO transactions (id, shop_id, user_id, type, amount, currency, description, category, counterparty,
                                 date, due_date, status, ai_categorized, import_id)
       SELECT r.id, $1, $2, r.type, r.amount, $3, NULLIF(r.descr, ''), NULLIF(r.cat, ''), NULLIF(r.cp, ''),
              r.d, r.due, r.status, false, $4
       FROM unnest($5::uuid[], $6::text[], $7::numeric[], $8::text[], $9::text[], $10::text[], $11::date[], $12::date[], $13::text[])
         AS r(id, type, amount, descr, cat, cp, d, due, status)`,
      [job.shopId, job.userId, currency, job.id, ids, toImport.map((r) => r.type), toImport.map((r) => r.amount),
       toImport.map((r) => r.description ?? ''), toImport.map((r) => r.category ?? ''), toImport.map((r) => r.counterparty ?? ''),
       toImport.map((r) => r.date), toImport.map((r) => r.dueDate ?? null), toImport.map(status)],
    );
    // What was already paid on a debt becomes a payment. The sheet doesn't say when, so it's
    // dated the day of the sale.
    const paidIdx = toImport.map((r, i) => (isDebt(r.type) && (r.paid ?? 0) > 0 ? i : -1)).filter((i) => i >= 0);
    if (paidIdx.length) {
      await client.query(
        `INSERT INTO debt_payments (transaction_id, shop_id, user_id, amount, paid_on)
         SELECT r.id, $1, $2, r.amount, r.d FROM unnest($3::uuid[], $4::numeric[], $5::date[]) AS r(id, amount, d)`,
        [job.shopId, job.userId, paidIdx.map((i) => ids[i]), paidIdx.map((i) => Math.min(toImport[i]!.paid!, toImport[i]!.amount)),
         paidIdx.map((i) => toImport[i]!.date)],
      );
    }
    await client.query('UPDATE excel_imports SET imported_rows = $2, skipped_rows = $3 WHERE id = $1',
      [job.id, toImport.length, summary.errorRows + (rows.length - toImport.length)]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // The file isn't needed any more: the records are in the database.
  if (job.filePath) await deleteFile(job.filePath);
  await db.query('UPDATE excel_imports SET file_path = NULL WHERE id = $1', [job.id]);
  // Imported debts already past due are marked overdue and raise their alerts now.
  await scanDebts(todayIso()).catch((err) => console.error('[import] alert scan failed:', err));

  const counts: Record<TransactionType, number> = { sale: 0, expense: 0, receivable: 0, payable: 0 };
  for (const r of toImport) counts[r.type] += 1;
  return { importId: job.id, imported: toImport.length, skipped: summary.errorRows + (rows.length - toImport.length), counts };
}

/** Deletes everything an import created (payments recorded against its debts go too). */
export async function undoImport(job: ExcelImport): Promise<{ removed: number }> {
  const client = await db.connect();
  let removed = 0;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE excel_imports SET status = 'undone' WHERE id = $1 AND status = 'confirmed' RETURNING id`, [job.id],
    );
    if (!rows[0]) throw new AppError(409, 'CONFLICT', 'Only a finished import can be undone.');
    const res = await client.query('DELETE FROM transactions WHERE import_id = $1 AND shop_id = $2 AND user_id = $3',
      [job.id, job.shopId, job.userId]);
    removed = res.rowCount ?? 0;
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  await scanDebts(todayIso()).catch((err) => console.error('[import] alert scan failed:', err)); // closes their alerts
  return { removed };
}

export async function listImports(shopId: string, userId: string): Promise<ExcelImport[]> {
  const { rows } = await db.query(
    `SELECT * FROM excel_imports WHERE shop_id = $1 AND user_id = $2 AND status IN ('confirmed', 'undone')
     ORDER BY created_at DESC LIMIT 20`,
    [shopId, userId],
  );
  return rows.map((r) => ({
    id: r['id'], userId: r['user_id'], shopId: r['shop_id'], filename: r['filename'], status: r['status'],
    rowCount: r['row_count'] ?? undefined, validRows: r['valid_rows'] ?? undefined, errorRows: r['error_rows'] ?? undefined,
    importedRows: r['imported_rows'] ?? undefined, skippedRows: r['skipped_rows'] ?? undefined,
    createdAt: r['created_at'], updatedAt: r['updated_at'],
  } as ExcelImport));
}

/** A ready-made sheet with the columns the import understands and a few example rows. */
export async function buildTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Transactions');
  ws.columns = [
    { header: 'Date', key: 'date', width: 13 },
    { header: 'Item', key: 'item', width: 28 },
    { header: 'Amount', key: 'amount', width: 12 },
    { header: 'Type', key: 'type', width: 13 },
    { header: 'Customer', key: 'customer', width: 20 },
    { header: 'Due date', key: 'due', width: 13 },
    { header: 'Paid?', key: 'paid', width: 9 },
  ];
  ws.getRow(1).font = { bold: true };
  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  ws.addRows([
    { date: d('2026-09-01'), item: '3 bags of rice', amount: 204000, type: 'sale', customer: 'Mrs Adebayo' },
    { date: d('2026-09-02'), item: 'Generator diesel', amount: 7800, type: 'expense' },
    { date: d('2026-09-03'), item: '2 bags of beans', amount: 120000, type: 'credit sale', customer: 'Mama Nkechi', due: d('2026-09-17'), paid: 'no' },
    { date: d('2026-09-04'), item: 'Drinks supply', amount: 40000, type: 'bill', customer: 'Coca-Cola distributor', due: d('2026-09-30'), paid: 10000 },
  ]);
  ws.getColumn('date').numFmt = 'dd/mm/yyyy';
  ws.getColumn('due').numFmt = 'dd/mm/yyyy';
  ws.getColumn('amount').numFmt = '#,##0.00';
  const notes = wb.addWorksheet('How to fill it in');
  notes.getColumn(1).width = 100;
  [
    'Type: sale, expense, credit sale (a customer owes you) or bill (you owe a supplier).',
    'Due date and Paid? are only for credit sales and bills. Paid? can be yes, no, or the amount paid so far.',
    'Dates are day first: 25/09/2026. Amounts can be written 5000, 5,000, ₦5,000 or 5k.',
    'Only the first sheet is imported. Delete the example rows before adding your own.',
  ].forEach((line) => notes.addRow([line]));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
