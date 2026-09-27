import type { Shop, Transaction } from '../../types';
import type { CategoryLine, DebtAsOf, PaymentLine } from '../db';
import type { ProfitFigures } from '../profit';
import { Report, type Cell } from './report';
import { MUTED } from './layout';
import { money, day, shortDay, period, dateTime } from './format';
import { daysBetween } from '../../utils/dates';

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ── Profit & Loss ──────────────────────────────────────────────

export interface ProfitAndLossInput {
  shop: Shop;
  logo: Buffer | null;
  from: string;
  to: string;
  lines: CategoryLine[];
  /** The same figures the Profit page shows, so the two always agree. */
  profit: ProfitFigures;
}

/** Merges sale + receivable (or expense + payable) lines that share a category. */
function byCategory(lines: CategoryLine[]): { category: string; count: number; total: number }[] {
  const map = new Map<string, { category: string; count: number; total: number }>();
  for (const l of lines) {
    const key = l.category.toLowerCase();
    const row = map.get(key) ?? { category: l.category, count: 0, total: 0 };
    row.count += l.count;
    row.total += l.total;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

const CATEGORY_COLUMNS = [{ label: 'Category', width: 5 }, { label: 'Entries', width: 1.4, align: 'right' as const }, { label: 'Amount', width: 2.2, align: 'right' as const }];

export async function renderProfitAndLoss({ shop, logo, from, to, lines, profit }: ProfitAndLossInput): Promise<Buffer> {
  const c = shop.currency;
  const report = new Report(shop, 'Profit & Loss', period(from, to), logo);

  const sales = lines.filter((l) => l.type === 'sale');
  const creditSales = lines.filter((l) => l.type === 'receivable');
  const costs = lines.filter((l) => l.type === 'expense' || l.type === 'payable');
  const running = costs.filter((l) => l.costKind !== 'stock');
  const stockLines = costs.filter((l) => l.costKind === 'stock');

  const income = sum([...sales, ...creditSales].map((l) => l.total));
  const unpaidCredit = sum(creditSales.map((l) => l.unpaid));
  const unpaidBills = sum(costs.filter((l) => l.type === 'payable').map((l) => l.unpaid));
  const bySold = profit.method === 'sold';
  const goodsCost = bySold ? profit.costOfGoodsSold ?? 0 : profit.stockBought;
  const net = profit.profit;

  report.summary([
    { label: 'Sales', value: money(income, c), note: unpaidCredit > 0 ? `${money(unpaidCredit, c)} unpaid on ${day(to)}` : undefined },
    { label: 'Costs', value: money(goodsCost + profit.runningCosts, c), note: unpaidBills > 0 ? `${money(unpaidBills, c)} unpaid on ${day(to)}` : undefined },
    { label: net >= 0 ? 'Profit' : 'Loss', value: money(Math.abs(net), c) },
  ]);

  if (lines.length === 0) {
    report.empty('No sales or expenses were recorded in this period.');
  } else {
    const incomeRows = byCategory([...sales, ...creditSales]);
    report.heading('Sales', 'Including sales on credit');
    if (incomeRows.length) {
      report.table(
        CATEGORY_COLUMNS,
        incomeRows.map((r) => [r.category, String(r.count), money(r.total, c)]),
        { totalRow: ['Total sales', String(sum(incomeRows.map((r) => r.count))), money(income, c)] },
      );
      report.keyLine('Cash sales', money(sum(sales.map((l) => l.total)), c), { size: 9, indent: 0 });
      report.keyLine('Sales on credit', money(sum(creditSales.map((l) => l.total)), c), { size: 9 });
      if (unpaidCredit > 0) report.keyLine(`…of which customers still owed you on ${day(to)}`, money(unpaidCredit, c), { size: 9, color: MUTED, indent: 12 });
      report.y += 10;
    } else {
      report.empty('No sales in this period.');
    }

    const runningRows = byCategory(running);
    report.heading('Running costs', 'What it cost to run the business: salaries, rent, power, fuel…');
    if (runningRows.length) {
      report.table(
        CATEGORY_COLUMNS,
        runningRows.map((r) => [r.category, String(r.count), money(r.total, c)]),
        { totalRow: ['Total running costs', String(sum(runningRows.map((r) => r.count))), money(profit.runningCosts, c)] },
      );
      report.y += 10;
    } else {
      report.empty('No running costs were recorded in this period.');
    }

    const stockRows = byCategory(stockLines);
    if (stockRows.length) {
      report.heading('Stock bought', 'Goods bought to resell');
      report.table(
        CATEGORY_COLUMNS,
        stockRows.map((r) => [r.category, String(r.count), money(r.total, c)]),
        { totalRow: ['Total stock bought', String(sum(stockRows.map((r) => r.count))), money(profit.stockBought, c)] },
      );
      report.y += 10;
    }

    report.rule();
    report.keyLine('Total sales', money(income, c));
    if (bySold) report.keyLine('Cost of the goods sold', `− ${money(goodsCost, c)}`);
    else if (profit.stockBought > 0) report.keyLine('Stock bought', `− ${money(goodsCost, c)}`);
    report.keyLine('Running costs', `− ${money(profit.runningCosts, c)}`);
    report.keyLine(net >= 0 ? 'Profit' : 'Loss', money(Math.abs(net), c), { size: 13, weight: 'bold' });
    report.y += 8;
  }

  const method = bySold
    ? 'Profit is counted on what was sold: sales, less what the goods sold cost (from your products\' cost prices), less running costs. ' +
      'Stock bought is listed but is not a cost until it is sold. ' +
      (profit.coverage !== null && profit.coverage < 1 ? `${Math.round((1 - profit.coverage) * 100)}% of sales had no cost price; their cost is estimated from the rest. ` : '')
    : profit.stockBought > 0
      ? 'Profit here is sales less all spending, so stock still on your shelf counts as a cost. Add cost prices to your products and record sales with their products to count profit on just what was sold. '
      : '';
  report.paragraph(
    method +
    'A sale counts on the day it was made, even if the customer pays later, and a bill counts as a cost on the day you received it. ' +
    'Money still owed at the end of the period is shown above and listed in the Credit Report. When a customer pays an old debt, ' +
    'record the payment on that debt — not as a new sale, or it would be counted twice.',
  );
  return report.finish();
}

// ── Credit report ──────────────────────────────────────────────

export interface CreditReportInput {
  shop: Shop;
  logo: Buffer | null;
  from: string;
  to: string;
  /** Balances are worked out at the end of this day (the report's end date, or today if earlier). */
  asOf: string;
  receivables: DebtAsOf[];
  payables: DebtAsOf[];
  collected: PaymentLine[];
  paidOut: PaymentLine[];
  /** Owed today across all dates, for context when `asOf` is in the past. */
  receivableTotalToday: number;
  payableTotalToday: number;
}

function dueStatus(tx: Transaction, asOf: string): { text: string; lateDays: number } {
  if (!tx.dueDate) return { text: 'No due date', lateDays: 0 };
  const diff = daysBetween(tx.dueDate, asOf);
  if (diff > 0) return { text: `${plural(diff, 'day')} late`, lateDays: diff };
  if (diff === 0) return { text: 'Due today', lateDays: 0 };
  return { text: `Due in ${plural(-diff, 'day')}`, lateDays: 0 };
}

const nameOf = (tx: { counterparty?: string }, fallback: string) => tx.counterparty?.trim() || fallback;

function debtRows(debts: DebtAsOf[], asOf: string, c: string, fallbackName: string): Cell[][] {
  return debts.map((tx) => {
    const status = dueStatus(tx, asOf);
    return [
      nameOf(tx, fallbackName),
      tx.description?.trim() || '—',
      shortDay(tx.date, asOf),
      tx.dueDate ? shortDay(tx.dueDate, asOf) : '—',
      status.lateDays > 0 ? { text: status.text, weight: 'semibold' } : { text: status.text, color: MUTED },
      tx.paidAsOf > 0 ? money(tx.paidAsOf, c) : { text: '—', color: MUTED },
      money(tx.balanceAsOf, c),
    ];
  });
}

const DEBT_COLUMNS = [
  { label: 'Name', width: 2.6 }, { label: 'Item', width: 2.6 }, { label: 'Recorded', width: 1.4 },
  { label: 'Due', width: 1.4 }, { label: 'Status', width: 2 },
  { label: 'Paid', width: 1.8, align: 'right' as const }, { label: 'Still owed', width: 2, align: 'right' as const },
];

export async function renderCreditReport(input: CreditReportInput): Promise<Buffer> {
  const { shop, logo, from, to, asOf, receivables, payables, collected, paidOut } = input;
  const c = shop.currency;
  const report = new Report(shop, 'Credit Report', `As of ${day(asOf)}`, logo);

  const owed = sum(receivables.map((t) => t.balanceAsOf));
  const overdue = receivables.filter((t) => dueStatus(t, asOf).lateDays > 0);
  const collectedTotal = sum(collected.map((p) => p.amount));
  const customers = new Map<string, { debts: number; total: number; oldestDue: string | null; late: number }>();
  for (const tx of receivables) {
    const key = nameOf(tx, 'Unnamed customer');
    const row = customers.get(key) ?? { debts: 0, total: 0, oldestDue: null, late: 0 };
    row.debts += 1;
    row.total += tx.balanceAsOf;
    if (tx.dueDate && (!row.oldestDue || tx.dueDate < row.oldestDue)) row.oldestDue = tx.dueDate;
    row.late = Math.max(row.late, dueStatus(tx, asOf).lateDays);
    customers.set(key, row);
  }

  report.summary([
    { label: 'Owed to you', value: money(owed, c), note: `${plural(customers.size, 'customer')}, ${plural(receivables.length, 'unpaid sale')}` },
    { label: 'Overdue', value: money(sum(overdue.map((t) => t.balanceAsOf)), c), note: `${plural(overdue.length, 'debt')} past the due date` },
    { label: 'Collected', value: money(collectedTotal, c), note: `${plural(collected.length, 'payment')} in this period` },
  ]);

  report.heading('Who owes you', `On ${day(asOf)}`);
  if (receivables.length === 0) {
    report.empty('Nobody owed you money on this date.');
  } else {
    const rows = [...customers.entries()].sort((a, b) => b[1].late - a[1].late || b[1].total - a[1].total);
    report.table(
      [
        { label: 'Customer', width: 4 }, { label: 'Unpaid sales', width: 1.7, align: 'right' },
        { label: 'Earliest due', width: 2.2, align: 'right' }, { label: 'Most late', width: 1.9, align: 'right' },
        { label: 'Still owed', width: 2.4, align: 'right' },
      ],
      rows.map(([name, r]) => [
        name, String(r.debts), r.oldestDue ? day(r.oldestDue) : '—',
        r.late > 0 ? { text: plural(r.late, 'day'), weight: 'semibold' } : { text: '—', color: MUTED },
        money(r.total, c),
      ]),
      { totalRow: ['Total', String(receivables.length), '', '', money(owed, c)] },
    );

    report.heading('Unpaid and part-paid sales', 'Soonest due first');
    report.table(DEBT_COLUMNS, debtRows(receivables, asOf, c, 'Unnamed customer'), {
      totalRow: ['Total', '', '', '', '', money(sum(receivables.map((t) => t.paidAsOf)), c), money(owed, c)],
    });
  }
  if (asOf !== to || Math.abs(input.receivableTotalToday - owed) >= 0.01) {
    report.paragraph(`Today, customers owe you ${money(input.receivableTotalToday, c)} in total.`, { size: 9 });
  }

  report.heading('Payments received', period(from, to));
  if (collected.length === 0) {
    report.empty('No customer paid a debt in this period.');
  } else {
    report.table(
      [{ label: 'Date', width: 1.8 }, { label: 'Customer', width: 3 }, { label: 'For', width: 3.8 }, { label: 'Amount', width: 2.2, align: 'right' }],
      collected.map((p) => [day(p.paidOn), nameOf(p, 'Unnamed customer'), p.description?.trim() || '—', money(p.amount, c)]),
      { totalRow: ['Total', '', '', money(collectedTotal, c)] },
    );
  }

  const due = sum(payables.map((t) => t.balanceAsOf));
  report.heading('What you owe', `Unpaid bills on ${day(asOf)}`);
  if (payables.length === 0) {
    report.empty('You owed no supplier money on this date.');
  } else {
    report.table(DEBT_COLUMNS.map((col, i) => (i === 0 ? { ...col, label: 'Supplier' } : col)),
      debtRows(payables, asOf, c, 'Unnamed supplier'),
      { totalRow: ['Total', '', '', '', '', money(sum(payables.map((t) => t.paidAsOf)), c), money(due, c)] });
  }
  const paidOutTotal = sum(paidOut.map((p) => p.amount));
  if (paidOutTotal > 0) report.keyLine(`Paid to suppliers, ${period(from, to)}`, money(paidOutTotal, c), { size: 9 });
  if (asOf !== to || Math.abs(input.payableTotalToday - due) >= 0.01) {
    report.paragraph(`Today, you owe suppliers ${money(input.payableTotalToday, c)} in total.`, { size: 9 });
  }

  report.paragraph(
    `Balances are what was still owed at the end of ${day(asOf)}: payments are counted on the day they were made, ` +
    'so a payment made after that date is not included. Record every payment — full or part — on the debt itself ' +
    '(in Transactions, or tell the assistant, for example "Mrs Adebayo paid ₦5,000 today"), never as a new sale.',
  );
  return report.finish();
}
