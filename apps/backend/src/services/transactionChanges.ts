import { AppError } from '../middleware/errorHandler';
import * as db from './db';
import * as stock from './stock';
import * as staff from './staff';
import { refreshDebtAlerts } from './alerts';
import { todayIso } from '../utils/dates';
import { CostKind, Transaction, TransactionStatus, TransactionType } from '../types';

// Editing and deleting a transaction, shared by the transactions API and the chat agent so
// both keep stock, debt payments and alerts in step the same way.

export interface TransactionChanges {
  type?: TransactionType;
  amount?: number;
  description?: string;
  category?: string;
  counterparty?: string;
  date?: string;
  dueDate?: string;
  costKind?: CostKind;
}

const isDebt = (type: string) => type === 'receivable' || type === 'payable';
const amountText = (n: number) => n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Applies `changes` (and, for the API, a status) to a transaction. Throws AppError for a change that isn't allowed. */
export async function editTransaction(
  txId: string, shopId: string, userId: string, changes: TransactionChanges, status?: TransactionStatus,
): Promise<{ before: Transaction; after: Transaction }> {
  const current = await db.findTransactionById(txId, shopId, userId);
  if (!current) throw new AppError(404, 'NOT_FOUND', 'Transaction not found');

  if (isDebt(current.type) && current.amountPaid > 0) {
    if (changes.type && !isDebt(changes.type)) {
      throw new AppError(400, 'BAD_REQUEST', 'This debt has payments recorded, so it can’t be changed to a cash sale or expense. Remove the payments first.');
    }
    if (changes.amount !== undefined && changes.amount < current.amountPaid) {
      throw new AppError(400, 'BAD_REQUEST', `The amount can’t be less than what has already been paid (${amountText(current.amountPaid)}).`);
    }
  }

  if (changes.type && await stock.wouldFlipStock(txId, current.type, changes.type)) {
    throw new AppError(400, 'BAD_REQUEST', 'This transaction moved stock, so it can’t be switched between a sale and a purchase. Delete it and record it again.');
  }

  if (changes.costKind === 'running' && await stock.hasItems(txId)) {
    throw new AppError(400, 'BAD_REQUEST', 'This put products on your shelf, so it’s stock to resell. To change that, delete it and record it again.');
  }

  let tx = await db.updateTransaction(txId, shopId, userId, isDebt(current.type) ? changes : { ...changes, status });
  if (!tx) throw new AppError(404, 'NOT_FOUND', 'Transaction not found');
  // Changing what the assistant filled in counts against its accuracy; marking paid doesn't.
  const fixed = (Object.keys(changes) as (keyof TransactionChanges)[])
    .some((k) => changes[k] !== undefined && changes[k] !== current[k]);
  if (fixed) await db.noteAiCorrection(txId, shopId, userId, 'edited');
  if (changes.date && changes.date !== current.date) await stock.moveTransactionItems(txId, changes.date);

  // A debt's status follows its payments. "Settled" pays off what's left today;
  // "pending" reopens it by removing its payments.
  if (isDebt(tx.type)) {
    if (status === 'settled' && tx.balance > 0) {
      const paid = await db.recordDebtPayment(txId, shopId, userId, { paidOn: todayIso(), today: todayIso() });
      if (paid.ok) tx = paid.transaction;
    } else if (status === 'pending' && tx.amountPaid > 0) {
      tx = (await db.removeDebtPayments(txId, shopId, userId))!.transaction;
    } else if (status === 'overdue' && tx.balance > 0) {
      tx = (await db.updateTransaction(txId, shopId, userId, { status: 'overdue' }))!;
    } else if (changes.amount !== undefined) {
      await db.resyncDebtStatus(txId);
      tx = (await db.findTransactionById(txId, shopId, userId))!;
    }
    await refreshDebtAlerts(txId);
    tx = (await db.findTransactionById(txId, shopId, userId))!;
  }
  if (current.staffId) await staff.refreshSalaryAlerts(shopId); // its date or type may have changed
  return { before: current, after: tx };
}

/** Deletes a transaction, putting back any stock it moved. Returns what was deleted, or null if it didn't exist. */
export async function removeTransaction(txId: string, shopId: string, userId: string): Promise<Transaction | null> {
  const current = await db.findTransactionById(txId, shopId, userId);
  if (!current) return null;
  // Counted before the row goes, while its source is still known.
  await db.noteAiCorrection(txId, shopId, userId, 'deleted');
  // Any stock the transaction moved goes back with it.
  const deleted = await stock.deleteTransactionWithStock(txId, shopId, userId);
  if (!deleted) return null;
  await refreshDebtAlerts(txId); // closes any alert about it
  await staff.refreshSalaryAlerts(shopId); // a deleted salary payment is owed again
  return current;
}
