// Profit: what the business actually made, and short plain-language feedback on how it is
// going. Everything is worked out from the records with SQL; no AI is involved, so it costs
// nothing to show.
//
// Two ways to count, and the page says which it used:
//
//   'sold'  — Profit on what you sold: sales − what the goods sold cost − running costs.
//             Needs sales recorded with their products and cost prices on those products.
//             Used when that covers at least COVERAGE_NEEDED of the sales value; the rest
//             is estimated at the same cost-to-price ratio. Cost prices are the products'
//             current ones (the app keeps no price history).
//   'spent' — Sales − all spending: sales − stock bought − running costs. Right for a
//             business that doesn't resell goods; for one that does, stock still on the
//             shelf is counted as a cost too, and the page says so.
//
// Sales are counted on the day they were made (credit sales included) and costs on the day
// they were incurred (bills on credit included), like the Profit & Loss report.

import { db } from '../config';
import { addDays } from '../utils/dates';
import { salariesStillDue } from './staff';
import { amount } from '../utils/money';

export { amount };

export const COVERAGE_NEEDED = 0.9;

export type ProfitMethod = 'sold' | 'spent';

export interface CostLine { category: string; total: number; count: number }

export interface ProfitFigures {
  from: string;
  to: string;
  sales: number;
  salesCount: number;
  /** Share of sales value recorded with products that all have a cost price (null: no sales). */
  coverage: number | null;
  /** What the goods sold cost; estimated for the part of sales without cost prices. Null when it can't be worked out. */
  costOfGoodsSold: number | null;
  stockBought: number;
  runningCosts: number;
  running: CostLine[];
  method: ProfitMethod;
  profit: number;
  /** Profit by each method, so two periods can be compared the same way. */
  profitSold: number | null;
  profitSpent: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => (v === null || v === undefined ? 0 : parseFloat(v as string));

export async function getProfitFigures(shopId: string, userId: string, from: string, to: string): Promise<ProfitFigures> {
  const [salesRes, costsRes] = await Promise.all([
    // Per sale: its products, how many of them have a cost price, and what they cost.
    db.query(
      `WITH s AS (
         SELECT t.id, t.amount,
                COUNT(m.id) AS lines,
                COUNT(m.id) FILTER (WHERE p.cost_price IS NOT NULL) AS priced,
                COALESCE(SUM(-m.change * p.cost_price), 0) AS cogs
           FROM transactions t
           LEFT JOIN stock_movements m ON m.transaction_id = t.id AND m.kind = 'sale'
           LEFT JOIN products p ON p.id = m.product_id
          WHERE t.shop_id = $1 AND t.user_id = $2 AND t.type IN ('sale', 'receivable') AND t.date BETWEEN $3 AND $4
          GROUP BY t.id, t.amount
       )
       SELECT COALESCE(SUM(amount), 0) AS sales, COUNT(*) AS n,
              COALESCE(SUM(amount) FILTER (WHERE lines > 0 AND lines = priced), 0) AS covered,
              COALESCE(SUM(cogs) FILTER (WHERE lines > 0 AND lines = priced), 0) AS cogs
         FROM s`,
      [shopId, userId, from, to],
    ),
    // Spending by kind and category; "fuel" and "Fuel" are one line, shown as most often written.
    db.query(
      `SELECT cost_kind,
              MODE() WITHIN GROUP (ORDER BY COALESCE(NULLIF(TRIM(category), ''), 'Other')) AS category,
              SUM(amount) AS total, COUNT(*) AS count
         FROM transactions
        WHERE shop_id = $1 AND user_id = $2 AND type IN ('expense', 'payable') AND date BETWEEN $3 AND $4
        GROUP BY cost_kind, lower(COALESCE(NULLIF(TRIM(category), ''), 'Other'))
        ORDER BY SUM(amount) DESC`,
      [shopId, userId, from, to],
    ),
  ]);

  const s = salesRes.rows[0]!;
  const sales = num(s['sales']);
  const covered = num(s['covered']);
  const coveredCogs = num(s['cogs']);
  const coverage = sales > 0 ? covered / sales : null;

  let stockBought = 0;
  const running: CostLine[] = [];
  for (const r of costsRes.rows) {
    if (r['cost_kind'] === 'stock') stockBought += num(r['total']);
    else running.push({ category: r['category'] as string, total: round2(num(r['total'])), count: Number(r['count']) });
  }
  const runningCosts = round2(running.reduce((t, l) => t + l.total, 0));

  // The part of sales without cost prices is costed at the same ratio as the rest.
  const costOfGoodsSold = covered > 0 ? round2(coveredCogs + (sales - covered) * (coveredCogs / covered)) : null;
  const profitSold = costOfGoodsSold === null ? null : round2(sales - costOfGoodsSold - runningCosts);
  const profitSpent = round2(sales - stockBought - runningCosts);
  const method: ProfitMethod = coverage !== null && coverage >= COVERAGE_NEEDED && profitSold !== null ? 'sold' : 'spent';

  return {
    from, to,
    sales: round2(sales),
    salesCount: Number(s['n']),
    coverage,
    costOfGoodsSold,
    stockBought: round2(stockBought),
    runningCosts,
    running,
    method,
    profit: method === 'sold' ? profitSold! : profitSpent,
    profitSold,
    profitSpent,
  };
}

/** Profit by a chosen method, falling back to 'spent' when 'sold' can't be worked out. */
export const profitBy = (f: ProfitFigures, method: ProfitMethod): number =>
  method === 'sold' && f.profitSold !== null ? f.profitSold : f.profitSpent;

// ── A month, with feedback ───────────────────────────────────

export type InsightTone = 'good' | 'bad' | 'neutral';
export interface Insight { kind: string; tone: InsightTone; text: string }

export interface MonthlyProfit extends ProfitFigures {
  month: string;
  /** The month isn't over: figures run to today. */
  inProgress: boolean;
  previous: { month: string; from: string; to: string; profit: number; sales: number; runningCosts: number } | null;
  salariesDue: { total: number; people: { name: string; amount: number; payDate: string }[] } | null;
  insights: Insight[];
  /** Said once under the figures when the rough method was used for a business with stock. */
  methodNote: string | null;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const isMonth = (m: string) => MONTH_RE.test(m);

function monthBounds(month: string): { from: string; end: string; days: number } {
  const [y, m] = [Number(month.slice(0, 4)), Number(month.slice(5, 7))];
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, end: `${month}-${String(days).padStart(2, '0')}`, days };
}

export function previousMonth(month: string): string {
  const [y, m] = [Number(month.slice(0, 4)), Number(month.slice(5, 7))];
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthName = (month: string) => MONTH_NAMES[Number(month.slice(5, 7)) - 1]!;

export async function getMonthlyProfit(shopId: string, userId: string, month: string, today: string, currency: string): Promise<MonthlyProfit> {
  const { from, end } = monthBounds(month);
  const inProgress = today >= from && today <= end;
  const to = inProgress ? today : end;

  // Last month up to the same day, while this one is still going; otherwise all of it.
  const prev = previousMonth(month);
  const pb = monthBounds(prev);
  const dayOfMonth = Number(to.slice(8, 10));
  const prevTo = inProgress ? (dayOfMonth >= pb.days ? pb.end : addDays(pb.from, dayOfMonth - 1)) : pb.end;

  const [current, before, salaries] = await Promise.all([
    getProfitFigures(shopId, userId, from, to),
    getProfitFigures(shopId, userId, pb.from, prevTo),
    inProgress ? salariesStillDue(shopId, userId, month, today) : Promise.resolve(null),
  ]);

  const hasPrevious = before.sales > 0 || before.stockBought > 0 || before.runningCosts > 0;
  const previous = hasPrevious
    ? { month: prev, from: pb.from, to: prevTo, profit: profitBy(before, current.method), sales: before.sales, runningCosts: before.runningCosts }
    : null;
  const salariesDue = salaries && salaries.people.length ? salaries : null;

  return {
    ...current,
    month,
    inProgress,
    previous,
    salariesDue,
    insights: buildInsights({ current, before: hasPrevious ? before : null, month, inProgress, salariesDue, currency }),
    methodNote: current.method === 'spent' && current.stockBought > 0
      ? 'This counts all the stock you bought as a cost, even what is still on your shelf. To see profit on just what you sold, add cost prices to your products and record sales with their products.'
      : null,
  };
}

/**
 * Short sentences on how the month is going. Only lines that have something to say: a
 * business with no staff hears nothing about salaries, one with no running costs is told
 * how to add them, once.
 */
export function buildInsights(input: {
  current: ProfitFigures;
  before: ProfitFigures | null;
  month: string;
  inProgress: boolean;
  salariesDue: { total: number; people: { name: string }[] } | null;
  currency: string;
}): Insight[] {
  const { current: c, before: b, month, inProgress, salariesDue, currency } = input;
  const money = (n: number) => amount(n, currency);
  const out: Insight[] = [];

  if (c.sales === 0 && c.stockBought === 0 && c.runningCosts === 0) {
    return [{ kind: 'empty', tone: 'neutral', text: inProgress ? 'Nothing recorded for this month yet.' : `Nothing was recorded in ${monthName(month)}.` }];
  }

  // Against last month, counted the same way.
  if (b) {
    const diff = round2(c.profit - profitBy(b, c.method));
    const when = inProgress ? 'at this point last month' : `in ${monthName(previousMonth(month))}`;
    if (Math.abs(diff) < 1) out.push({ kind: 'vs_last_month', tone: 'neutral', text: `About the same as ${when}.` });
    else if (diff > 0) out.push({ kind: 'vs_last_month', tone: 'good', text: `${money(diff)} better than ${when}.` });
    else out.push({ kind: 'vs_last_month', tone: 'bad', text: `${money(-diff)} worse than ${when}.` });
  }

  // What's kept from each ₦1,000 of sales.
  if (c.sales > 0 && c.profit > 0) {
    const kept = Math.round((c.profit / c.sales) * 1000 / 10) * 10;
    if (kept > 0) out.push({ kind: 'margin', tone: 'neutral', text: `Out of every ${money(1000)} you sell, you keep about ${money(kept)}.` });
  }

  // The biggest running cost, when there's more than one kind.
  if (c.running.length >= 2) {
    const top = c.running[0]!;
    const share = Math.round((top.total / c.runningCosts) * 100);
    out.push({ kind: 'biggest_cost', tone: 'neutral', text: `Your biggest running cost is ${top.category}: ${money(top.total)} (${share}% of running costs).` });
  }

  // A running cost well up on last month (only ones that existed then, so a once-a-month bill paid on a different day isn't flagged).
  if (b) {
    const before = new Map(b.running.map((l) => [l.category.toLowerCase(), l.total]));
    const rising = c.running
      .map((l) => ({ ...l, was: before.get(l.category.toLowerCase()) ?? 0 }))
      .filter((l) => l.was > 0 && l.total >= l.was * 1.5 && l.total - l.was >= c.runningCosts * 0.1)
      .sort((x, y) => (y.total - y.was) - (x.total - x.was))[0];
    if (rising) {
      const when = inProgress ? 'at this point last month' : `in ${monthName(previousMonth(month))}`;
      out.push({ kind: 'rising_cost', tone: 'bad', text: `${rising.category} is up: ${money(rising.total)}, from ${money(rising.was)} ${when}.` });
    }
  }

  // Stock bought but not yet sold isn't lost money.
  if (c.method === 'sold' && c.costOfGoodsSold !== null && c.stockBought - c.costOfGoodsSold >= Math.max(1, c.sales * 0.05)) {
    out.push({
      kind: 'stock_on_shelf', tone: 'neutral',
      text: `You bought ${money(c.stockBought)} of stock and sold goods that cost ${money(c.costOfGoodsSold)}. The rest is on your shelf, so it isn't counted as a cost yet.`,
    });
  }

  // Salaries still to pay this month, only for owners who listed staff with their pay.
  if (salariesDue && salariesDue.total > 0) {
    const after = round2(c.profit - salariesDue.total);
    out.push({
      kind: 'salaries_due', tone: after < 0 ? 'bad' : 'neutral',
      text: `Salaries still to pay this month: ${money(salariesDue.total)}. After paying them, ${after >= 0 ? `profit would be about ${money(after)}` : `you'd be ${money(-after)} short`}.`,
    });
  }

  // Sales but no running costs at all: most likely they aren't being recorded.
  if (c.sales > 0 && c.runningCosts === 0) {
    out.push({
      kind: 'no_running_costs', tone: 'neutral',
      text: 'No running costs recorded. If you paid rent, fuel, electricity or salaries, record them as expenses to see your real profit.',
    });
  }
  return out;
}
