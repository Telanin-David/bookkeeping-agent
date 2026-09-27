// Staff and salaries (migration 011). Entirely optional: a shop with no staff never sees
// any of it, and nothing here runs for it.
//
// Pay-day reminders: a staff member with a pay day gets one 'salary_due' alert per pay
// date, raised the day before, unless a salary payment for them was recorded from a week
// before the pay date onwards (people pay a little early or late). The alert closes once
// that payment is recorded, when the next pay date comes round, or when they leave.
// A payment more than three weeks late can be taken for the next month's; that costs one
// reminder, which is the safer mistake.

import { config, db } from '../config';
import { AppError } from '../middleware/errorHandler';
import { createTransaction, findTransactionById, type Queryable } from './db';
import { day } from './pdf/format';
import { amount } from '../utils/money';
import { addDays, todayIso } from '../utils/dates';
import type { StaffMember, Transaction } from '../types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A salary paid this many days before the pay date counts for it. */
export const PAID_EARLY_DAYS = 7;
/** Remind this many days before the pay date. */
export const REMIND_DAYS_BEFORE = 1;
export const SALARY_CATEGORY = 'Salaries';

const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : parseFloat(v as string));

async function inTransaction<T>(fn: (client: Queryable) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Pay dates ────────────────────────────────────────────────

/** The pay day in a given month; 29–31 fall back to the month's last day. */
export function payDateIn(year: number, month: number, payDay: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate(); // month is 1-based here
  const d = Math.min(payDay, last);
  return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * The pay date that matters today: this month's once its reminder day has come,
 * otherwise last month's (which may still be unpaid).
 */
export function currentPayDate(payDay: number, today: string): string {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  // Pay day 1: its reminder falls on the last day of the month before.
  const nextMonth = m === 12 ? payDateIn(y + 1, 1, payDay) : payDateIn(y, m + 1, payDay);
  if (today >= addDays(nextMonth, -REMIND_DAYS_BEFORE)) return nextMonth;
  const thisMonth = payDateIn(y, m, payDay);
  if (today >= addDays(thisMonth, -REMIND_DAYS_BEFORE)) return thisMonth;
  return m === 1 ? payDateIn(y - 1, 12, payDay) : payDateIn(y, m - 1, payDay);
}

/** Salary payments from this date on count for `payDate`. */
export const paidFrom = (payDate: string) => addDays(payDate, -PAID_EARLY_DAYS);

// ── Staff list ───────────────────────────────────────────────

export interface StaffWithPay extends StaffMember {
  /** The pay date that matters now (see currentPayDate), or their first one if they joined since; null without a pay day. */
  payDate: string | null;
  /** A salary payment covering payDate has been recorded. */
  paid: boolean;
  /** payDate is today, tomorrow or past, and not paid. */
  due: boolean;
  lastPaidOn: string | null;
}

const STAFF_SELECT = `
  SELECT s.*, (s.created_at AT TIME ZONE $TZ)::date::text AS added_on,
         (SELECT MAX(t.date)::text FROM transactions t WHERE t.staff_id = s.id) AS last_paid_on
  FROM staff s`;

function staffSelect(tzParam: number): string {
  return STAFF_SELECT.replace('$TZ', `$${tzParam}`);
}

export async function listStaff(shopId: string, userId: string, today = todayIso()): Promise<StaffWithPay[]> {
  const { rows } = await db.query(
    `${staffSelect(3)} WHERE s.shop_id = $1 AND s.user_id = $2 AND s.archived_at IS NULL ORDER BY lower(s.name)`,
    [shopId, userId, config.businessTimeZone],
  );
  const paidDates = await salaryDates(rows.map((r) => r['id'] as string));
  return rows.map((r) => withPay(r, paidDates, today));
}

export async function findStaff(id: string, shopId: string, userId: string, client: Queryable = db): Promise<StaffMember | null> {
  if (!UUID_RE.test(id)) return null;
  const { rows } = await client.query(
    'SELECT * FROM staff WHERE id = $1 AND shop_id = $2 AND user_id = $3 AND archived_at IS NULL',
    [id, shopId, userId],
  );
  return rows[0] ? mapStaff(rows[0]) : null;
}

export interface StaffFields {
  name?: string;
  role?: string | null;
  monthlyPay?: number | null;
  payDay?: number | null;
}

export async function createStaff(shopId: string, userId: string, fields: StaffFields & { name: string }): Promise<StaffMember> {
  const { rows } = await db.query(
    `INSERT INTO staff (shop_id, user_id, name, role, monthly_pay, pay_day) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [shopId, userId, fields.name.trim(), fields.role?.trim() || null, fields.monthlyPay ?? null, fields.payDay ?? null],
  );
  await refreshSalaryAlerts(shopId);
  return mapStaff(rows[0]);
}

export async function updateStaff(id: string, shopId: string, userId: string, fields: StaffFields): Promise<StaffMember | null> {
  if (!UUID_RE.test(id)) return null;
  const sets: string[] = [];
  const values: unknown[] = [];
  const set = (column: string, value: unknown) => { values.push(value); sets.push(`${column} = $${values.length}`); };
  if (fields.name !== undefined)       set('name', fields.name.trim());
  if (fields.role !== undefined)       set('role', fields.role?.trim() || null);
  if (fields.monthlyPay !== undefined) set('monthly_pay', fields.monthlyPay);
  if (fields.payDay !== undefined)     set('pay_day', fields.payDay);
  if (sets.length === 0) return findStaff(id, shopId, userId);
  values.push(id, shopId, userId);
  const n = values.length;
  const { rows } = await db.query(
    `UPDATE staff SET ${sets.join(', ')} WHERE id = $${n - 2} AND shop_id = $${n - 1} AND user_id = $${n} AND archived_at IS NULL RETURNING *`,
    values,
  );
  if (!rows[0]) return null;
  await refreshSalaryAlerts(shopId); // the pay day or pay may have changed
  return mapStaff(rows[0]);
}

/** Someone who has left. Their past salary payments stay in the records. */
export async function archiveStaff(id: string, shopId: string, userId: string): Promise<boolean> {
  if (!UUID_RE.test(id)) return false;
  const { rowCount } = await db.query(
    'UPDATE staff SET archived_at = NOW() WHERE id = $1 AND shop_id = $2 AND user_id = $3 AND archived_at IS NULL',
    [id, shopId, userId],
  );
  if (!rowCount) return false;
  await refreshSalaryAlerts(shopId);
  return true;
}

/** Every date a salary was recorded for each of these staff, oldest first. */
async function salaryDates(staffIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (staffIds.length === 0) return map;
  const { rows } = await db.query(
    `SELECT staff_id, date::text AS date FROM transactions WHERE staff_id = ANY($1::uuid[]) ORDER BY date`,
    [staffIds],
  );
  for (const r of rows) map.set(r['staff_id'] as string, [...(map.get(r['staff_id'] as string) ?? []), r['date'] as string]);
  return map;
}

/** The first pay date on or after a day. */
function nextPayDate(payDay: number, from: string): string {
  const [y, m] = [Number(from.slice(0, 4)), Number(from.slice(5, 7))];
  const thisMonth = payDateIn(y, m, payDay);
  if (thisMonth >= from) return thisMonth;
  return m === 12 ? payDateIn(y + 1, 1, payDay) : payDateIn(y, m + 1, payDay);
}

function withPay(row: Record<string, unknown>, paidDates: Map<string, string[]>, today: string): StaffWithPay {
  const staff = mapStaff(row);
  let payDate = staff.payDay ? currentPayDate(staff.payDay, today) : null;
  // Someone who joined after that pay date isn't owed for it: their first pay date is next.
  const addedOn = row['added_on'] as string;
  if (staff.payDay && payDate && addedOn > payDate) payDate = nextPayDate(staff.payDay, addedOn);
  const dates = paidDates.get(staff.id) ?? [];
  const paid = payDate !== null && dates.some((d) => d >= paidFrom(payDate));
  return {
    ...staff,
    payDate,
    paid,
    due: payDate !== null && !paid && today >= addDays(payDate, -REMIND_DAYS_BEFORE),
    lastPaidOn: (row['last_paid_on'] as string | null) ?? null,
  };
}

// ── Paying salaries ──────────────────────────────────────────

/**
 * Records one salary expense per person (a running cost, category Salaries), all or none.
 * Amounts are what the owner confirmed, which may differ from the usual monthly pay.
 */
export async function paySalaries(shopId: string, userId: string, input: {
  date: string; today: string; payments: { staffId: string; amount: number }[];
}): Promise<Transaction[]> {
  if (input.date > input.today) throw new AppError(422, 'UNPROCESSABLE_ENTITY', 'The date can’t be in the future.');
  const ids = input.payments.map((p) => p.staffId);
  if (new Set(ids).size !== ids.length) throw new AppError(400, 'BAD_REQUEST', 'Each person can only be paid once at a time.');
  const created = await inTransaction(async (c) => {
    const { rows: shopRows } = await c.query('SELECT currency FROM shops WHERE id = $1', [shopId]);
    const currency = (shopRows[0]?.['currency'] as string | undefined) ?? 'NGN';
    const txIds: string[] = [];
    for (const p of input.payments) {
      const person = await findStaff(p.staffId, shopId, userId, c);
      if (!person) throw new AppError(404, 'NOT_FOUND', 'Staff member not found');
      const tx = await createTransaction({
        shopId, userId, type: 'expense', amount: p.amount, currency, costKind: 'running', staffId: person.id,
        category: SALARY_CATEGORY, description: `Salary: ${person.name}`, counterparty: person.name, date: input.date,
      }, c);
      txIds.push(tx.id);
    }
    return txIds;
  });
  await refreshSalaryAlerts(shopId);
  return Promise.all(created.map(async (id) => (await findTransactionById(id, shopId, userId))!));
}

/** What the shop's staff with a set monthly pay are still owed for this month's pay dates. */
export async function salariesStillDue(shopId: string, userId: string, month: string, today: string): Promise<{
  total: number; people: { name: string; amount: number; payDate: string }[];
}> {
  const list = await listStaff(shopId, userId, today);
  const [y, m] = [Number(month.slice(0, 4)), Number(month.slice(5, 7))];
  const paidDates = await salaryDates(list.map((s) => s.id));
  const people: { name: string; amount: number; payDate: string }[] = [];
  for (const s of list) {
    if (!s.monthlyPay) continue;
    // Without a pay day: owed until something is paid to them in the month.
    const payDate = payDateIn(y, m, s.payDay ?? 31);
    if (todayIso(s.createdAt) > payDate) continue; // joined after this month's pay day
    const from = s.payDay ? paidFrom(payDate) : `${month}-01`;
    const paid = (paidDates.get(s.id) ?? []).some((d) => d >= from);
    if (!paid) people.push({ name: s.name, amount: s.monthlyPay, payDate });
  }
  return { total: Math.round(people.reduce((sum, p) => sum + p.amount, 0) * 100) / 100, people };
}

// ── Pay-day reminders ────────────────────────────────────────

/**
 * Raises and closes 'salary_due' alerts, for one shop or (from the alert worker) all of them.
 * Staff without a pay day never get one.
 */
export async function scanSalaries(today: string, shopId?: string): Promise<{ raised: number; resolved: number }> {
  const { rows } = await db.query(
    `${staffSelect(2)} WHERE s.archived_at IS NULL AND s.pay_day IS NOT NULL AND ($1::uuid IS NULL OR s.shop_id = $1::uuid)`,
    [shopId ?? null, config.businessTimeZone],
  );
  const paidDates = await salaryDates(rows.map((r) => r['id'] as string));
  const currencies = new Map<string, string>();
  if (rows.length) {
    const { rows: shops } = await db.query('SELECT id, currency FROM shops WHERE id = ANY($1::uuid[])', [[...new Set(rows.map((r) => r['shop_id']))]]);
    for (const s of shops) currencies.set(s['id'] as string, s['currency'] as string);
  }

  // The reminders that should be open right now, by source key.
  const due = new Map<string, { row: Record<string, unknown>; payDate: string }>();
  for (const r of rows) {
    const s = withPay(r, paidDates, today);
    if (!s.payDate || !s.due) continue;
    due.set(`salary:${s.id}:${s.payDate}`, { row: r, payDate: s.payDate });
  }

  const { rows: open } = await db.query(
    `SELECT id, source_key FROM alerts WHERE type = 'salary_due' AND status <> 'resolved' AND ($1::uuid IS NULL OR shop_id = $1::uuid)`,
    [shopId ?? null],
  );
  const stale = open.filter((a) => !due.has(a['source_key'] as string)).map((a) => a['id'] as string);
  let resolved = 0;
  if (stale.length) {
    const { rowCount } = await db.query(`UPDATE alerts SET status = 'resolved' WHERE id = ANY($1::uuid[])`, [stale]);
    resolved = rowCount ?? 0;
  }

  let raised = 0;
  for (const [key, { row, payDate }] of due) {
    const name = row['name'] as string;
    const pay = numOrNull(row['monthly_pay']);
    const currency = currencies.get(row['shop_id'] as string) ?? 'NGN';
    const message = `Pay day for ${name}: ${pay ? `${amount(pay, currency)} salary` : 'salary'} due on ${day(payDate)}. Record it in Profit when you’ve paid.`;
    const { rowCount } = await db.query(
      `INSERT INTO alerts (user_id, shop_id, type, message, metadata, source_key)
       VALUES ($1, $2, 'salary_due', $3, $4, $5)
       ON CONFLICT (source_key) WHERE source_key IS NOT NULL AND status <> 'resolved' DO NOTHING`,
      [row['user_id'], row['shop_id'], message,
       JSON.stringify({ staffId: row['id'], staffName: name, amount: pay, payDate }), key],
    );
    raised += rowCount ?? 0;
  }
  return { raised, resolved };
}

/** Straight after a staff or salary change. Never fails the request that called it. */
export async function refreshSalaryAlerts(shopId: string): Promise<void> {
  try {
    await scanSalaries(todayIso(), shopId);
  } catch (err) {
    console.error('[staff] salary reminder refresh failed:', err instanceof Error ? err.message : err);
  }
}

function mapStaff(row: Record<string, unknown>): StaffMember {
  return {
    id: row['id'] as string,
    shopId: row['shop_id'] as string,
    name: row['name'] as string,
    role: (row['role'] as string | null) ?? null,
    monthlyPay: numOrNull(row['monthly_pay']),
    payDay: row['pay_day'] === null || row['pay_day'] === undefined ? null : Number(row['pay_day']),
    archived: row['archived_at'] !== null && row['archived_at'] !== undefined,
    createdAt: row['created_at'] as Date,
    updatedAt: row['updated_at'] as Date,
  };
}
