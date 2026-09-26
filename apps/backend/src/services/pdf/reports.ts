import type { Shop, Transaction } from '../../types';
import type { CategoryLine } from '../db';
import { Report, type Cell } from './report';
import { MUTED } from './layout';
import { money, day, period, dateTime } from './format';
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
}

/** Merges sale + receivable (or expense + payable) lines that share a category. */
function byCategory(lines: CategoryLine[]): { category: string; count: number; total: number }[] {
  const map = new Map<string, { category: string; count: number; total: number }>();
  for (const l of lines) {
    const row = map.get(l.category) ?? { category: l.category, count: 0, total: 0 };
    row.count += l.count;
    row.total += l.total;
    map.set(l.category, row);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export async function renderProfitAndLoss({ shop, logo, from, to, lines }: ProfitAndLossInput): Promise<Buffer> {
  const c = shop.currency;
  const report = new Report(shop, 'Profit & Loss', period(from, to), logo);

  const sales = lines.filter((l) => l.type === 'sale');
  const creditSales = lines.filter((l) => l.type === 'receivable');
  const expenses = lines.filter((l) => l.type === 'expense');
  const bills = lines.filter((l) => l.type === 'payable');

  const income = sum([...sales, ...creditSales].map((l) => l.total));
  const costs = sum([...expenses, ...bills].map((l) => l.total));
  const net = income - costs;
  const unpaidCredit = sum(creditSales.map((l) => l.unpaid));
  const unpaidBills = sum(bills.map((l) => l.unpaid));

  report.summary([
    { label: 'Income', value: money(income, c), note: unpaidCredit > 0 ? `${money(unpaidCredit, c)} not yet paid to you` : undefined },
    { label: 'Costs', value: money(costs, c), note: unpaidBills > 0 ? `${money(unpaidBills, c)} you haven't paid yet` : undefined },
    { label: net >= 0 ? 'Net profit' : 'Net loss', value: money(Math.abs(net), c) },
  ]);

  if (lines.length === 0) {
    report.empty('No sales or expenses were recorded in this period.');
  } else {
    const incomeRows = byCategory([...sales, ...creditSales]);
    report.heading('Income', 'Sales, including sales on credit');
    if (incomeRows.length) {
      report.table(
        [{ label: 'Category', width: 5 }, { label: 'Entries', width: 1.4, align: 'right' }, { label: 'Amount', width: 2.2, align: 'right' }],
        incomeRows.map((r) => [r.category, String(r.count), money(r.total, c)]),
        { totalRow: ['Total income', String(sum(incomeRows.map((r) => r.count))), money(income, c)] },
      );
      report.keyLine('Cash sales', money(sum(sales.map((l) => l.total)), c), { size: 9, indent: 0 });
      report.keyLine('Sales on credit', money(sum(creditSales.map((l) => l.total)), c), { size: 9 });
      if (unpaidCredit > 0) report.keyLine('…of which customers still owe you', money(unpaidCredit, c), { size: 9, color: MUTED, indent: 12 });
      report.y += 10;
    } else {
      report.empty('No sales in this period.');
    }

    const costRows = byCategory([...expenses, ...bills]);
    report.heading('Costs', 'Expenses, including bills on credit');
    if (costRows.length) {
      report.table(
        [{ label: 'Category', width: 5 }, { label: 'Entries', width: 1.4, align: 'right' }, { label: 'Amount', width: 2.2, align: 'right' }],
        costRows.map((r) => [r.category, String(r.count), money(r.total, c)]),
        { totalRow: ['Total costs', String(sum(costRows.map((r) => r.count))), money(costs, c)] },
      );
      report.keyLine('Paid expenses', money(sum(expenses.map((l) => l.total)), c), { size: 9 });
      report.keyLine('Bills on credit', money(sum(bills.map((l) => l.total)), c), { size: 9 });
      if (unpaidBills > 0) report.keyLine("…of which you haven't paid yet", money(unpaidBills, c), { size: 9, color: MUTED, indent: 12 });
      report.y += 10;
    } else {
      report.empty('No expenses in this period.');
    }

    report.rule();
    report.keyLine('Total income', money(income, c));
    report.keyLine('Total costs', `− ${money(costs, c)}`);
    report.keyLine(net >= 0 ? 'Net profit' : 'Net loss', money(Math.abs(net), c), { size: 13, weight: 'bold' });
    report.y += 8;
  }

  report.paragraph(
    'How this is counted: a sale counts as income on the day it was made, even if the customer pays later, and a bill ' +
    'counts as a cost on the day you received it. Money still owed is shown above and listed in the Credit Report. ' +
    'When a customer pays an old debt, mark that debt as paid — do not record the payment as a new sale, or it would be counted twice.',
  );
  return report.finish();
}

// ── Credit report ──────────────────────────────────────────────

export interface CreditReportInput {
  shop: Shop;
  logo: Buffer | null;
  from: string;
  to: string;
  today: string;
  receivables: Transaction[];
  payables: Transaction[];
  receivableTotalAllTime: number;
  payableTotalAllTime: number;
}

function dueStatus(tx: Transaction, today: string): { text: string; lateDays: number } {
  if (!tx.dueDate) return { text: 'No due date', lateDays: 0 };
  const diff = daysBetween(tx.dueDate, today);
  if (diff > 0) return { text: `${plural(diff, 'day')} late`, lateDays: diff };
  if (diff === 0) return { text: 'Due today', lateDays: 0 };
  return { text: `Due in ${plural(-diff, 'day')}`, lateDays: 0 };
}

const nameOf = (tx: Transaction, fallback: string) => tx.counterparty?.trim() || fallback;

function debtRows(debts: Transaction[], today: string, c: string, fallbackName: string): Cell[][] {
  return debts.map((tx) => {
    const status = dueStatus(tx, today);
    return [
      nameOf(tx, fallbackName),
      tx.description?.trim() || '—',
      day(tx.date),
      tx.dueDate ? day(tx.dueDate) : '—',
      status.lateDays > 0 ? { text: status.text, weight: 'semibold' } : { text: status.text, color: MUTED },
      money(tx.amount, c),
    ];
  });
}

const DEBT_COLUMNS = [
  { label: 'Name', width: 2.6 }, { label: 'Item', width: 3 }, { label: 'Recorded', width: 1.9 },
  { label: 'Due', width: 1.9 }, { label: 'Status', width: 1.9 }, { label: 'Amount', width: 2.2, align: 'right' as const },
];

export async function renderCreditReport(input: CreditReportInput): Promise<Buffer> {
  const { shop, logo, from, to, today, receivables, payables } = input;
  const c = shop.currency;
  const report = new Report(shop, 'Credit Report', period(from, to), logo);

  const owed = sum(receivables.map((t) => t.amount));
  const overdue = receivables.filter((t) => dueStatus(t, today).lateDays > 0);
  const customers = new Map<string, { debts: number; total: number; oldestDue: string | null; late: number }>();
  for (const tx of receivables) {
    const key = nameOf(tx, 'Unnamed customer');
    const row = customers.get(key) ?? { debts: 0, total: 0, oldestDue: null, late: 0 };
    row.debts += 1;
    row.total += tx.amount;
    if (tx.dueDate && (!row.oldestDue || tx.dueDate < row.oldestDue)) row.oldestDue = tx.dueDate;
    row.late = Math.max(row.late, dueStatus(tx, today).lateDays);
    customers.set(key, row);
  }

  report.summary([
    { label: 'Owed to you', value: money(owed, c), note: `${plural(receivables.length, 'unpaid sale')} in this period` },
    { label: 'Overdue', value: money(sum(overdue.map((t) => t.amount)), c), note: `${plural(overdue.length, 'debt')} past the due date` },
    { label: 'Customers owing', value: String(customers.size) },
  ]);

  report.heading('Who owes you', `Payment status as of ${day(today)}`);
  if (receivables.length === 0) {
    report.empty('Nobody owes you for sales recorded in this period.');
  } else {
    const rows = [...customers.entries()].sort((a, b) => b[1].late - a[1].late || b[1].total - a[1].total);
    report.table(
      [
        { label: 'Customer', width: 4 }, { label: 'Unpaid sales', width: 1.7, align: 'right' },
        { label: 'Earliest due', width: 2.2, align: 'right' }, { label: 'Most late', width: 1.9, align: 'right' },
        { label: 'Amount owed', width: 2.4, align: 'right' },
      ],
      rows.map(([name, r]) => [
        name, String(r.debts), r.oldestDue ? day(r.oldestDue) : '—',
        r.late > 0 ? { text: plural(r.late, 'day'), weight: 'semibold' } : { text: '—', color: MUTED },
        money(r.total, c),
      ]),
      { totalRow: ['Total', String(receivables.length), '', '', money(owed, c)] },
    );

    report.heading('Unpaid sales', 'Soonest due first');
    report.table(DEBT_COLUMNS, debtRows(receivables, today, c, 'Unnamed customer'), { totalRow: ['Total', '', '', '', '', money(owed, c)] });
  }
  if (input.receivableTotalAllTime > owed) {
    report.paragraph(`Across all dates, customers owe you ${money(input.receivableTotalAllTime, c)} in total.`, { size: 9 });
  }

  report.heading('What you owe', 'Unpaid bills from suppliers');
  if (payables.length === 0) {
    report.empty('You have no unpaid bills recorded in this period.');
  } else {
    const due = sum(payables.map((t) => t.amount));
    report.table(DEBT_COLUMNS.map((col, i) => (i === 0 ? { ...col, label: 'Supplier' } : col)),
      debtRows(payables, today, c, 'Unnamed supplier'), { totalRow: ['Total', '', '', '', '', money(due, c)] });
  }
  if (input.payableTotalAllTime > sum(payables.map((t) => t.amount))) {
    report.paragraph(`Across all dates, you owe suppliers ${money(input.payableTotalAllTime, c)} in total.`, { size: 9 });
  }

  report.paragraph(
    `This report lists debts recorded between ${day(from)} and ${day(to)} that were still unpaid when it was generated ` +
    `(${dateTime(new Date())}). Paid debts are left out. When a customer pays you, mark that debt as paid in ` +
    'Transactions, or tell the assistant (for example "Mrs Adebayo has paid").',
  );
  return report.finish();
}
