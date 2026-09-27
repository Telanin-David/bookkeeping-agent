// Reading a shop's own spreadsheet (Deliverable 9): .xlsx or .csv, whatever the column
// names, day-first dates, "₦5,000" and "5k" amounts. Pure functions, no database, so
// they are unit-tested directly.

import ExcelJS from 'exceljs';
import type { TransactionType } from '../types';

export const MAX_ROWS = 5000;
export type Cell = string | number | Date | null;

export interface Sheet {
  headers: string[];
  /** Data rows only (no header), with their spreadsheet row numbers for error messages. */
  rows: { rowNumber: number; cells: Cell[] }[];
  /** More than MAX_ROWS data rows: the rest were not read. */
  truncated: boolean;
}

// ── Reading files ────────────────────────────────────────────

export type FileKind = 'xlsx' | 'csv';

/** Decided from the file's bytes, not its name or the browser's claim. Old .xls isn't supported. */
export function detectKind(buffer: Buffer): FileKind | 'xls' | null {
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) return 'xlsx';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) return 'xls';
  // Text: no NUL bytes in the first few KB.
  const head = buffer.subarray(0, 4096);
  if (head.length > 0 && !head.includes(0)) return 'csv';
  return null;
}

function cellValue(v: ExcelJS.CellValue): Cell {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'string') return typeof v === 'string' ? v.trim() || null : v;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if ('result' in v) return cellValue((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    if ('richText' in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join('').trim() || null;
    if ('text' in v) return String((v as ExcelJS.CellHyperlinkValue).text).trim() || null;
    if ('error' in v) return null;
  }
  return String(v);
}

async function readXlsx(buffer: Buffer): Promise<Cell[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  // The first sheet that has anything on it.
  const ws = wb.worksheets.find((w) => w.actualRowCount > 0);
  if (!ws) return [];
  const out: Cell[][] = [];
  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (rowNumber > MAX_ROWS + 20) return;
    const cells: Cell[] = [];
    for (let c = 1; c <= Math.min(row.cellCount, 50); c++) cells.push(cellValue(row.getCell(c).value));
    out[rowNumber - 1] = cells;
  });
  return Array.from(out, (r) => r ?? []);
}

/** RFC 4180 CSV: quoted fields, "" escapes, CRLF or LF. Excel in some regions saves with ';'. */
export function parseCsv(text: string): Cell[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: Cell[][] = [];
  let row: Cell[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === delim) { row.push(field.trim() || null); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field.trim() || null); rows.push(row); row = []; field = '';
      if (rows.length > MAX_ROWS + 20) return rows;
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field.trim() || null); rows.push(row); }
  return rows;
}

const isBlank = (r: Cell[]) => r.every((c) => c === null || c === '');

/**
 * The header is the first of the top 10 rows with at least two text cells (sheets often
 * start with a title like "SALES BOOK 2026"). Everything below it is data; blank rows are skipped.
 */
export function toSheet(grid: Cell[][]): Sheet {
  const headerIndex = grid.slice(0, 10).findIndex((r) => r.filter((c) => typeof c === 'string' && /[a-z]/i.test(c)).length >= 2);
  if (headerIndex === -1) return { headers: [], rows: [], truncated: false };
  const raw = grid[headerIndex]!;
  let width = raw.length;
  while (width > 0 && (raw[width - 1] === null || raw[width - 1] === '')) width--;
  const seen = new Map<string, number>();
  const headers = raw.slice(0, width).map((h, i) => {
    let name = h === null ? `Column ${i + 1}` : String(h instanceof Date ? h.toISOString().slice(0, 10) : h).trim();
    const n = (seen.get(name.toLowerCase()) ?? 0) + 1;
    seen.set(name.toLowerCase(), n);
    if (n > 1) name = `${name} (${n})`;
    return name;
  });
  const rows: Sheet['rows'] = [];
  let truncated = false;
  for (let i = headerIndex + 1; i < grid.length; i++) {
    const cells = (grid[i] ?? []).slice(0, width);
    if (isBlank(cells)) continue;
    if (rows.length === MAX_ROWS) { truncated = true; break; }
    while (cells.length < width) cells.push(null);
    rows.push({ rowNumber: i + 1, cells });
  }
  return { headers, rows, truncated };
}

export async function readSheet(buffer: Buffer): Promise<Sheet> {
  const kind = detectKind(buffer);
  if (kind === 'xlsx') return toSheet(await readXlsx(buffer));
  if (kind === 'csv') return toSheet(parseCsv(buffer.toString('utf8')));
  throw new Error(kind === 'xls'
    ? 'This is an old Excel file (.xls). Open it in Excel or Google Sheets and save it as .xlsx or .csv, then upload that.'
    : 'This file isn’t a spreadsheet. Upload an Excel (.xlsx) or CSV file.');
}

// ── Matching columns ─────────────────────────────────────────

export type Field = 'date' | 'amount' | 'moneyIn' | 'moneyOut' | 'description' | 'type' | 'counterparty' | 'category' | 'dueDate' | 'paid';

/** Header words that usually mean each field, most specific first. */
const SYNONYMS: Record<Field, RegExp> = {
  dueDate: /^(due|due\s*date|pay\s*by|payment\s*due|deadline)$/i,
  date: /^(date|day|trans(action)?\s*date|txn\s*date|sales?\s*date|entry\s*date|value\s*date)$/i,
  moneyIn: /^(money\s*in|in|inflow|received|receipts?|cash\s*in|income|deposit)$/i,
  moneyOut: /^(money\s*out|out|outflow|spent|paid\s*out|cash\s*out|expenses?|withdrawal)$/i,
  amount: /^(amount|amt|total|value|price|sum|cost|naira|ngn|₦|amount\s*\(?(₦|ngn|naira)\)?|total\s*amount)$/i,
  description: /^(description|desc|item|items|details?|narration|particulars|product|goods|note|notes|memo|what)$/i,
  type: /^(type|kind|transaction\s*type|txn\s*type|sale\s*or\s*expense|in\s*\/\s*out)$/i,
  counterparty: /^(customer|client|buyer|name|supplier|vendor|party|customer\s*name|sold\s*to|paid\s*to|from|to|who)$/i,
  category: /^(category|group|class|account)$/i,
  paid: /^(paid\??|payment\s*status|settled\??|amount\s*paid|paid\s*amount|paid\s*so\s*far)$/i,
};

export type Mapping = Partial<Record<Field, string>> & {
  /** How to tell sales from expenses when there's no Type column or Money in/out columns. */
  defaultType?: TransactionType | 'sign';
};

/** Best guess from the header names; the owner can change it before importing. */
export function guessMapping(headers: string[]): Mapping {
  const mapping: Mapping = {};
  const used = new Set<string>();
  for (const field of Object.keys(SYNONYMS) as Field[]) {
    const hit = headers.find((h) => !used.has(h) && SYNONYMS[field].test(h.replace(/[:*]+$/, '').trim()));
    if (hit) { mapping[field] = hit; used.add(hit); }
  }
  if (mapping.moneyIn || mapping.moneyOut) delete mapping.amount; // in/out columns carry the amounts
  if (!mapping.type && !mapping.moneyIn && !mapping.moneyOut) mapping.defaultType = 'sale';
  return mapping;
}

// ── Reading values ───────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};
/** 'Sept', 'sep', 'September' → 9. */
const monthOf = (name: string): number | undefined => {
  const n = name.toLowerCase();
  return MONTHS[n.slice(0, 4)] ?? MONTHS[n.slice(0, 3)];
};
const iso = (y: number, m: number, d: number): string | null => {
  if (y < 100) y += 2000;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
    ? dt.toISOString().slice(0, 10) : null;
};

/**
 * Nigeria writes dates day first (25/09/2026). A file from a US-set computer writes them
 * month first; if any date in the column only makes sense month first (09/25/2026), the
 * whole column is read that way.
 */
export function detectMonthFirst(values: Cell[]): boolean {
  let dayFirstOnly = false;
  let monthFirstOnly = false;
  for (const v of values) {
    const m = typeof v === 'string' ? v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/) : null;
    if (!m) continue;
    const a = Number(m[1]); const b = Number(m[2]);
    if (a > 12 && b <= 12) dayFirstOnly = true;
    if (b > 12 && a <= 12) monthFirstOnly = true;
  }
  return monthFirstOnly && !dayFirstOnly;
}

/** 'YYYY-MM-DD', or null if it can't be read as a date. */
export function parseDate(v: Cell, monthFirst = false): string | null {
  if (v === null) return null;
  if (v instanceof Date) {
    // exceljs gives calendar dates as UTC midnight.
    return isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  }
  if (typeof v === 'number') {
    // An Excel date serial in a cell not formatted as a date (days since 1899-12-30).
    if (v < 30000 || v > 80000) return null;
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000).toISOString().slice(0, 10);
  }
  const s = v.trim().replace(/(\d)(st|nd|rd|th)\b/gi, '$1').replace(/,/g, ' ').replace(/\s+/g, ' ');
  let m = s.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})(?:[ T].*)?$/);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) {
    const [a, b, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return monthFirst ? iso(y, a, b) : iso(y, b, a);
  }
  m = s.match(/^(\d{1,2})[ -]([a-z]{3,9})\.?[ -](\d{2}|\d{4})$/i); // 25 Sept 2026, 25-Sep-26
  if (m) {
    const month = monthOf(m[2]!);
    return month ? iso(Number(m[3]), month, Number(m[1])) : null;
  }
  m = s.match(/^([a-z]{3,9})\.? (\d{1,2}) (\d{4})$/i); // Sep 25 2026
  if (m) {
    const month = monthOf(m[1]!);
    return month ? iso(Number(m[3]), month, Number(m[2])) : null;
  }
  return null;
}

/** 5000, "5,000", "₦5,000.50", "NGN 5000", "5k", "(1,000)" → numbers; null if unreadable. */
export function parseAmount(v: Cell): number | null {
  if (v === null || v instanceof Date) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  let s = v.trim().replace(/\s+/g, '');
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  if (s.startsWith('-')) { negative = true; s = s.slice(1); }
  s = s.replace(/^(₦|ngn|n(?=\d)|naira)/i, '').replace(/(naira|ngn)$/i, '');
  if (s.startsWith('-')) { negative = true; s = s.slice(1); }
  let multiplier = 1;
  if (/k$/i.test(s)) { multiplier = 1000; s = s.slice(0, -1); }
  else if (/m$/i.test(s)) { multiplier = 1_000_000; s = s.slice(0, -1); }
  if (!/^\d{1,3}(,\d{3})*(\.\d+)?$|^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s.replace(/,/g, '')) * multiplier;
  return Math.round((negative ? -n : n) * 100) / 100;
}

const PAID_WORDS = /^(yes|y|paid|paid\s*in\s*full|full|true|settled|done|cleared|complete|✓|✔)$/i;
const UNPAID_WORDS = /^(no|n|unpaid|not\s*paid|false|owing|pending|outstanding|open)$/i;

/**
 * How much of a credit sale or bill was already paid: "yes" → all of it, "no" or empty → none,
 * an amount → that much. Null when unreadable or more than the amount.
 */
export function parsePaid(v: Cell, amount: number): number | null {
  if (v === null) return 0;
  if (typeof v === 'string' && PAID_WORDS.test(v.trim())) return amount;
  if (typeof v === 'string' && UNPAID_WORDS.test(v.trim())) return 0;
  const n = parseAmount(v);
  if (n === null || n < 0 || n > amount + 0.001) return null;
  return n;
}

const TYPE_WORDS: [RegExp, TransactionType][] = [
  [/^(credit\s*sales?|sold\s*on\s*credit|on\s*credit|owed|owes|owing|debt|debtor|receivable|iou|credit)$/i, 'receivable'],
  [/^(bill|bills|payable|creditor|owe\s*supplier|bought\s*on\s*credit|credit\s*purchase|supplier\s*credit)$/i, 'payable'],
  [/^(sale|sales|sold|income|revenue|cash\s*sale|in|money\s*in|received)$/i, 'sale'],
  [/^(expense|expenses|purchase|purchases|bought|buy|spent|cost|out|money\s*out|paid|payment)$/i, 'expense'],
];

export function parseType(v: Cell): TransactionType | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return TYPE_WORDS.find(([re]) => re.test(s))?.[1] ?? null;
}

// ── Checking rows ────────────────────────────────────────────

export interface ParsedRow {
  rowNumber: number;
  type: TransactionType;
  amount: number;
  date: string;
  description?: string;
  counterparty?: string;
  category?: string;
  dueDate?: string;
  /** Already paid towards a credit sale or bill (0 = unpaid). */
  paid?: number;
}

export interface RowProblem { row: number; field: string; message: string }

export interface CheckResult {
  valid: ParsedRow[];
  problems: RowProblem[];
  /** Rows with no amount at all (e.g. subtotal or note lines) are skipped quietly. */
  skippedEmpty: number;
}

/** Checks the mapping itself before any row is read. Null when it's usable. */
export function mappingProblem(mapping: Mapping, headers: string[]): string | null {
  const cols = (['date', 'amount', 'moneyIn', 'moneyOut', 'description', 'type', 'counterparty', 'category', 'dueDate', 'paid'] as Field[])
    .map((f) => mapping[f]).filter(Boolean) as string[];
  const unknown = cols.find((c) => !headers.includes(c));
  if (unknown) return `There's no column called "${unknown}" in this file.`;
  if (new Set(cols).size !== cols.length) return 'The same column is chosen for two different things.';
  if (!mapping.date) return 'Choose the column that has the date.';
  if (!mapping.amount && !mapping.moneyIn && !mapping.moneyOut) return 'Choose the column that has the amount (or Money in / Money out columns).';
  if (mapping.amount && (mapping.moneyIn || mapping.moneyOut)) return 'Use either one Amount column or Money in / Money out columns, not both.';
  if (!mapping.type && !mapping.moneyIn && !mapping.moneyOut && !mapping.defaultType) return 'Say what the rows are: sales, expenses, or read it from a column.';
  return null;
}

export function checkRows(sheet: Sheet, mapping: Mapping, today: string): CheckResult {
  const col = (f: Field) => (mapping[f] ? sheet.headers.indexOf(mapping[f]!) : -1);
  const idx = Object.fromEntries((['date', 'amount', 'moneyIn', 'moneyOut', 'description', 'type', 'counterparty', 'category', 'dueDate', 'paid'] as Field[]).map((f) => [f, col(f)])) as Record<Field, number>;
  const at = (cells: Cell[], f: Field): Cell => (idx[f] >= 0 ? cells[idx[f]] ?? null : null);
  const text = (cells: Cell[], f: Field, max: number): string | undefined => {
    const v = at(cells, f);
    if (v === null) return undefined;
    const s = (v instanceof Date ? v.toISOString().slice(0, 10) : String(v)).trim();
    return s ? s.slice(0, max) : undefined;
  };
  const monthFirst = detectMonthFirst(sheet.rows.map((r) => at(r.cells, 'date')));
  const dueMonthFirst = detectMonthFirst(sheet.rows.map((r) => at(r.cells, 'dueDate')));

  const valid: ParsedRow[] = [];
  const problems: RowProblem[] = [];
  let skippedEmpty = 0;

  for (const { rowNumber, cells } of sheet.rows) {
    const fail = (field: string, message: string) => problems.push({ row: rowNumber, field, message });

    // Amount and type.
    let amount: number | null;
    let type: TransactionType | null = null;
    if (idx.moneyIn >= 0 || idx.moneyOut >= 0) {
      const inV = at(cells, 'moneyIn'); const outV = at(cells, 'moneyOut');
      const inAmt = inV === null ? null : parseAmount(inV);
      const outAmt = outV === null ? null : parseAmount(outV);
      if (inV === null && outV === null) { skippedEmpty++; continue; }
      if ((inV !== null && inAmt === null) || (outV !== null && outAmt === null)) { fail('amount', `"${inV ?? outV}" isn't an amount.`); continue; }
      if (inAmt && outAmt) { fail('amount', 'Has both money in and money out. Put them on separate rows.'); continue; }
      amount = inAmt || outAmt;
      type = inAmt ? 'sale' : 'expense';
    } else {
      const raw = at(cells, 'amount');
      if (raw === null) { skippedEmpty++; continue; }
      amount = parseAmount(raw);
      if (amount === null) { fail('amount', `"${raw}" isn't an amount.`); continue; }
    }
    if (amount === 0 || amount === null) { skippedEmpty++; continue; }

    if (idx.type >= 0) {
      const raw = at(cells, 'type');
      type = parseType(raw);
      if (!type) {
        fail('type', raw === null
          ? 'The type is empty. Use sale, expense, credit sale or bill.'
          : `"${raw}" isn't a type we know. Use sale, expense, credit sale or bill.`);
        continue;
      }
      if (amount < 0) { fail('amount', 'The amount is negative, but the type is given. Write it as a positive number.'); continue; }
    } else if (!type) {
      if (mapping.defaultType === 'sign') type = amount < 0 ? 'expense' : 'sale';
      else if (mapping.defaultType) {
        if (amount < 0) { fail('amount', 'The amount is negative. Write it as a positive number, or choose "positive is money in, negative is money out".'); continue; }
        type = mapping.defaultType;
      }
    }
    if (!type) { fail('type', 'Can’t tell if this is a sale or an expense.'); continue; }
    amount = Math.abs(amount);
    if (amount > 1_000_000_000) { fail('amount', 'The amount is too large. Check for a typing mistake.'); continue; }

    // Date.
    const rawDate = at(cells, 'date');
    const date = parseDate(rawDate, monthFirst);
    if (!date) { fail('date', rawDate === null ? 'The date is empty.' : `"${rawDate instanceof Date ? 'invalid date' : rawDate}" isn't a date we can read. Use a format like 25/09/2026.`); continue; }
    if (date > today) { fail('date', `The date (${date}) is in the future.`); continue; }
    if (date < '2000-01-01') { fail('date', `The date (${date}) looks wrong.`); continue; }

    let dueDate: string | undefined;
    let paid: number | undefined;
    if (type === 'receivable' || type === 'payable') {
      const rawPaid = at(cells, 'paid');
      const p = parsePaid(rawPaid, amount);
      if (p === null) { fail('paid', `"${rawPaid}" isn't clear. Use yes, no, or the amount paid (up to ${amount}).`); continue; }
      paid = p;
      const rawDue = at(cells, 'dueDate');
      if (rawDue !== null) {
        const d = parseDate(rawDue, dueMonthFirst);
        if (!d) { fail('dueDate', `"${rawDue instanceof Date ? 'invalid date' : rawDue}" isn't a date we can read.`); continue; }
        if (d < date) { fail('dueDate', 'The due date is before the date of the sale.'); continue; }
        dueDate = d;
      }
    }

    valid.push({
      rowNumber, type, amount, date, dueDate, paid,
      description: text(cells, 'description', 500),
      counterparty: text(cells, 'counterparty', 255),
      category: text(cells, 'category', 100),
    });
  }
  return { valid, problems, skippedEmpty };
}
