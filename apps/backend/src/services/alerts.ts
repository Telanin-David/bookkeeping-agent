// Alert detection (Deliverable 8). Low-stock alerts are raised by the stock service as
// stock moves; this file covers money:
//   overdue_receivable — a customer's debt is past its due date and not fully paid
//   bill_due           — a bill the shop owes is due within BILL_DUE_SOON_DAYS, or overdue
//   duplicate          — the same transaction entered twice within a couple of minutes
// Each alert has a source_key ('overdue:<transaction id>', …) so the same debt never has
// two open alerts. When the debt is paid, deleted or its due date moves, the alert is
// marked resolved, which frees the key in case it falls overdue again later.

import { db } from '../config';
import type { Queryable } from './db';
import type { Transaction } from '../types';
import { money, day } from './pdf/format';
import { addDays, todayIso } from '../utils/dates';

export const BILL_DUE_SOON_DAYS = 2;
const DUPLICATE_WINDOW_MINUTES = 2;

/** Balance still owed, from the payments view. */
const OWED = '(t.amount - t.amount_paid) > 0.005';

/**
 * Runs every detection pass. `transactionId` limits it to one debt, for use straight after
 * a payment or edit so its alert doesn't wait for the next scheduled run.
 */
export async function scanDebts(today: string, transactionId?: string, client: Queryable = db): Promise<{ raised: number; resolved: number }> {
  // $1 today, $2 one transaction or null for all, $3 the "due soon" cut-off for bills.
  const only = 'AND ($2::uuid IS NULL OR t.id = $2::uuid)';
  const soon = addDays(today, BILL_DUE_SOON_DAYS);
  const params = [today, transactionId ?? null];

  // Debt status follows the due date: past due and not paid is 'overdue'; a due date moved
  // later (or removed) puts it back to 'pending'. Paid debts are 'settled' and left alone.
  await client.query(
    `UPDATE transactions SET status = 'overdue', updated_at = NOW()
     WHERE id IN (SELECT t.id FROM transactions_with_payments t
                  WHERE t.type IN ('receivable', 'payable') AND t.status = 'pending'
                    AND t.due_date < $1 AND ${OWED} ${only})`,
    params,
  );
  await client.query(
    `UPDATE transactions SET status = 'pending', updated_at = NOW()
     WHERE id IN (SELECT t.id FROM transactions_with_payments t
                  WHERE t.type IN ('receivable', 'payable') AND t.status = 'overdue'
                    AND (t.due_date IS NULL OR t.due_date >= $1) AND ${OWED} ${only})`,
    params,
  );

  const resolved = await resolveStale(client, today, soon, transactionId);

  const { rows } = await client.query(
    `SELECT t.id, t.type, t.shop_id, t.user_id, t.amount, t.amount_paid, t.currency, t.description,
            t.counterparty, t.due_date
     FROM transactions_with_payments t
     WHERE ((t.type = 'receivable' AND t.due_date < $1) OR (t.type = 'payable' AND t.due_date <= $3))
       AND ${OWED} ${only}`,
    [...params, soon],
  );

  let raised = 0;
  for (const r of rows) {
    const owed = parseFloat(r['amount'] as string) - parseFloat(r['amount_paid'] as string);
    const amount = money(Math.round(owed * 100) / 100, r['currency'] as string);
    const who = (r['counterparty'] as string | null)?.trim();
    const what = (r['description'] as string | null)?.trim();
    const due = r['due_date'] as string;
    const isCustomer = r['type'] === 'receivable';
    const message = isCustomer
      ? `${who || 'A customer'} owes you ${amount}${what ? ` for ${what}` : ''}. It was due on ${day(due)}.`
      : `You owe ${who || 'a supplier'} ${amount}${what ? ` for ${what}` : ''}. ${due < today ? `It was due on ${day(due)}.` : due === today ? 'It is due today.' : `It is due on ${day(due)}.`}`;
    const type = isCustomer ? 'overdue_receivable' : 'bill_due';
    const { rowCount } = await client.query(
      `INSERT INTO alerts (user_id, shop_id, type, message, metadata, source_key)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (source_key) WHERE source_key IS NOT NULL AND status <> 'resolved' DO NOTHING`,
      [r['user_id'], r['shop_id'], type, message,
       JSON.stringify({ transactionId: r['id'], amountOwed: Math.round(owed * 100) / 100, dueDate: due, counterparty: who ?? null }),
       `${isCustomer ? 'overdue' : 'bill_due'}:${r['id']}`],
    );
    raised += rowCount ?? 0;
  }
  return { raised, resolved };
}

/**
 * Straight after a payment, edit or deletion, so the debt's alert (and its overdue label)
 * doesn't wait for the next scheduled run. Never fails the request that called it.
 */
export async function refreshDebtAlerts(transactionId: string): Promise<void> {
  try {
    await scanDebts(todayIso(), transactionId);
  } catch (err) {
    console.error('[alerts] refresh failed:', err instanceof Error ? err.message : err);
  }
}

/** Same rule for new transactions: a failed duplicate check never fails the save. */
export async function checkDuplicateSafely(tx: Transaction): Promise<void> {
  try {
    await checkDuplicate(tx);
  } catch (err) {
    console.error('[alerts] duplicate check failed:', err instanceof Error ? err.message : err);
  }
}

/** Closes debt alerts whose debt is paid, deleted, or no longer due. */
async function resolveStale(client: Queryable, today: string, soon: string, transactionId?: string): Promise<number> {
  const { rowCount } = await client.query(
    `UPDATE alerts a SET status = 'resolved'
     WHERE a.type IN ('overdue_receivable', 'bill_due') AND a.status <> 'resolved' AND a.source_key IS NOT NULL
       AND ($3::text IS NULL OR a.metadata->>'transactionId' = $3::text)
       AND NOT EXISTS (
         SELECT 1 FROM transactions_with_payments t
         WHERE t.id::text = a.metadata->>'transactionId' AND ${OWED}
           AND ((a.type = 'overdue_receivable' AND t.type = 'receivable' AND t.due_date < $1)
             OR (a.type = 'bill_due' AND t.type = 'payable' AND t.due_date <= $2))
       )`,
    [today, soon, transactionId ?? null],
  );
  return rowCount ?? 0;
}

/**
 * Flags a transaction that looks like one just entered: same shop, type, amount, date,
 * description and customer, entered within a couple of minutes. Typical causes are a form
 * sent twice or the assistant recording the same sale twice. Shown in the app only.
 */
export async function checkDuplicate(tx: Transaction): Promise<boolean> {
  const { rows } = await db.query(
    `SELECT id FROM transactions
     WHERE shop_id = $1 AND user_id = $2 AND id <> $3 AND type = $4 AND amount = $5 AND date = $6
       AND lower(coalesce(trim(description), '')) = lower(coalesce(trim($7), ''))
       AND lower(coalesce(trim(counterparty), '')) = lower(coalesce(trim($8), ''))
       AND created_at > NOW() - make_interval(mins => $9)
     ORDER BY created_at DESC LIMIT 1`,
    [tx.shopId, tx.userId, tx.id, tx.type, tx.amount, tx.date, tx.description ?? '', tx.counterparty ?? '', DUPLICATE_WINDOW_MINUTES],
  );
  if (!rows[0]) return false;
  const kind = tx.type === 'sale' ? 'sales' : tx.type === 'receivable' ? 'credit sales' : tx.type === 'payable' ? 'bills' : 'expenses';
  const label = tx.description?.trim() ? ` for "${tx.description.trim()}"` : '';
  await db.query(
    `INSERT INTO alerts (user_id, shop_id, type, message, metadata, source_key)
     VALUES ($1, $2, 'duplicate', $3, $4, $5)
     ON CONFLICT (source_key) WHERE source_key IS NOT NULL AND status <> 'resolved' DO NOTHING`,
    [tx.userId, tx.shopId,
     `Recorded twice? Two ${kind} of ${money(tx.amount, tx.currency)}${label} were entered within ${DUPLICATE_WINDOW_MINUTES} minutes. If they're the same one, delete one in Transactions.`,
     JSON.stringify({ transactionId: tx.id, matchesTransactionId: rows[0]['id'] }), `duplicate:${tx.id}`],
  );
  return true;
}
