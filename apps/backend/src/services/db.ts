import { db } from '../config';
import {
  User, Shop, Transaction, ChatSession, ChatMessage,
  Alert, AlertHistory, ExcelImport, PaginatedResponse,
  TransactionType, TransactionStatus, AlertStatus, ImportStatus, BrandingKind, DebtPayment,
} from '../types';

// ── Users ─────────────────────────────────────────────────────
export async function findUserByEmail(email: string): Promise<(User & { passwordHash: string; loginAttempts: number; lockoutUntil: Date | null }) | null> {
  const { rows } = await db.query(
    `SELECT id, name, email, phone, password_hash, email_verified, is_admin,
            alert_email, alert_sms, alert_whatsapp,
            alert_quiet_start, alert_quiet_end,
            threshold_low_cash, threshold_high_payable, threshold_overdue_days,
            login_attempts, lockout_until, created_at, updated_at
     FROM users WHERE LOWER(email) = LOWER($1)`,
    [email],
  );
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function findUserById(id: string): Promise<User | null> {
  const { rows } = await db.query(
    `SELECT id, name, email, phone, email_verified, is_admin,
            alert_email, alert_sms, alert_whatsapp,
            alert_quiet_start, alert_quiet_end,
            threshold_low_cash, threshold_high_payable, threshold_overdue_days,
            created_at, updated_at
     FROM users WHERE id = $1`,
    [id],
  );
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function createUser(data: {
  name: string; email: string; phone?: string; passwordHash: string;
}): Promise<User> {
  const { rows } = await db.query(
    `INSERT INTO users (name, email, phone, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, phone, email_verified, is_admin,
               alert_email, alert_sms, alert_whatsapp,
               alert_quiet_start, alert_quiet_end,
               threshold_low_cash, threshold_high_payable, threshold_overdue_days,
               created_at, updated_at`,
    [data.name, data.email, data.phone ?? null, data.passwordHash],
  );
  return mapUser(rows[0]);
}

// ── Refresh tokens (one row per issued token; see migration 003) ──
export async function createRefreshToken(data: {
  userId: string; familyId: string; tokenHash: string; expiresAt: Date;
}): Promise<void> {
  await db.query(
    'INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
    [data.userId, data.familyId, data.tokenHash, data.expiresAt],
  );
}

export type RefreshRotation =
  | { status: 'rotated'; userId: string; familyId: string }
  // Unknown, expired, or revoked moments ago by a parallel refresh (e.g. two tabs
  // reloading at once) — reject this request but leave the session alone.
  | { status: 'invalid' }
  // A token revoked a while ago was presented again: it was stolen or replayed.
  // The whole family has been revoked, signing that device out.
  | { status: 'reused' };

/**
 * Atomically swaps the refresh token with hash `oldHash` for a new one in the same
 * family. The row lock serialises concurrent refreshes of the same token.
 */
export async function rotateRefreshToken(
  oldHash: string, newHash: string, newExpiresAt: Date, reuseGraceMs: number,
): Promise<RefreshRotation> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT user_id, family_id, expires_at, revoked_at
       FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE`,
      [oldHash],
    );
    const row = rows[0] as { user_id: string; family_id: string; expires_at: Date; revoked_at: Date | null } | undefined;

    let result: RefreshRotation;
    if (!row) {
      result = { status: 'invalid' };
    } else if (row.revoked_at) {
      if (Date.now() - row.revoked_at.getTime() < reuseGraceMs) {
        result = { status: 'invalid' };
      } else {
        await client.query(
          'UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_id = $1 AND revoked_at IS NULL',
          [row.family_id],
        );
        result = { status: 'reused' };
      }
    } else if (row.expires_at.getTime() <= Date.now()) {
      result = { status: 'invalid' };
    } else {
      await client.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1', [oldHash]);
      await client.query(
        'INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
        [row.user_id, row.family_id, newHash, newExpiresAt],
      );
      result = { status: 'rotated', userId: row.user_id, familyId: row.family_id };
    }

    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** True while the device session (token family) is signed in: not revoked, not expired. */
export async function isSessionActive(familyId: string, userId: string): Promise<boolean> {
  const { rows } = await db.query(
    `SELECT 1 FROM refresh_tokens
     WHERE family_id = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [familyId, userId],
  );
  return rows.length > 0;
}

/** Signs out the one device that holds this token (its whole family). */
export async function revokeRefreshTokenFamily(tokenHash: string): Promise<void> {
  await db.query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE revoked_at IS NULL
       AND family_id = (SELECT family_id FROM refresh_tokens WHERE token_hash = $1)`,
    [tokenHash],
  );
}

export async function incrementLoginAttempts(email: string): Promise<void> {
  await db.query(
    `UPDATE users SET login_attempts = login_attempts + 1,
     lockout_until = CASE WHEN login_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes' ELSE lockout_until END
     WHERE email = $1`,
    [email],
  );
}

export async function resetLoginAttempts(email: string): Promise<void> {
  await db.query(
    'UPDATE users SET login_attempts = 0, lockout_until = NULL WHERE email = $1',
    [email],
  );
}

// ── Shops ─────────────────────────────────────────────────────
export async function listShops(ownerId: string): Promise<Shop[]> {
  const { rows } = await db.query(
    'SELECT * FROM shops WHERE owner_id = $1 ORDER BY created_at DESC',
    [ownerId],
  );
  return rows.map(mapShop);
}

export async function findShopById(id: string, ownerId: string): Promise<Shop | null> {
  const { rows } = await db.query(
    'SELECT * FROM shops WHERE id = $1 AND owner_id = $2',
    [id, ownerId],
  );
  return rows[0] ? mapShop(rows[0]) : null;
}

export async function createShop(data: {
  ownerId: string; name: string; type: string; location?: string; currency?: string;
}): Promise<Shop> {
  const { rows } = await db.query(
    `INSERT INTO shops (owner_id, name, type, location, currency)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [data.ownerId, data.name, data.type, data.location ?? null, data.currency ?? 'NGN'],
  );
  return mapShop(rows[0]);
}

export async function updateShop(id: string, ownerId: string, data: Partial<Pick<Shop, 'name' | 'type' | 'location' | 'currency'>>): Promise<Shop | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (data.name !== undefined)     { sets.push(`name = $${i++}`);     values.push(data.name); }
  if (data.type !== undefined)     { sets.push(`type = $${i++}`);     values.push(data.type); }
  if (data.location !== undefined) { sets.push(`location = $${i++}`); values.push(data.location); }
  if (data.currency !== undefined) { sets.push(`currency = $${i++}`); values.push(data.currency); }
  if (sets.length === 0) return findShopById(id, ownerId);
  values.push(id, ownerId);
  const { rows } = await db.query(
    `UPDATE shops SET ${sets.join(', ')} WHERE id = $${i++} AND owner_id = $${i} RETURNING *`,
    values,
  );
  return rows[0] ? mapShop(rows[0]) : null;
}

/**
 * Sets (or clears, with null) a shop's logo or signature key. Returns the updated shop and
 * the key it replaced, so the caller can delete the old file. Null if the shop isn't the
 * owner's.
 */
export async function setShopBranding(
  shopId: string, ownerId: string, kind: BrandingKind, key: string | null,
): Promise<{ shop: Shop; previousKey: string | null } | null> {
  const column = kind === 'logo' ? 'logo_key' : 'signature_key'; // whitelisted, never user text
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    // Lock the row first so two uploads at once can't both see the same "previous" key
    // (which would leave one file orphaned on disk).
    const current = await client.query(
      `SELECT ${column} AS key FROM shops WHERE id = $1 AND owner_id = $2 FOR UPDATE`,
      [shopId, ownerId],
    );
    if (!current.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    const { rows } = await client.query(
      `UPDATE shops SET ${column} = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [key, shopId],
    );
    await client.query('COMMIT');
    return { shop: mapShop(rows[0]), previousKey: (current.rows[0].key as string | null) ?? null };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Transactions ──────────────────────────────────────────────
export async function listTransactions(shopId: string, userId: string, opts: {
  type?: TransactionType; status?: TransactionStatus; category?: string;
  dateFrom?: string; dateTo?: string;
  page: number; limit: number;
}): Promise<PaginatedResponse<Transaction>> {
  const conditions = ['shop_id = $1', 'user_id = $2'];
  const values: unknown[] = [shopId, userId];
  let i = 3;
  if (opts.type)     { conditions.push(`type = $${i++}`);                    values.push(opts.type); }
  if (opts.status)   { conditions.push(`status = $${i++}`);                  values.push(opts.status); }
  if (opts.category) { conditions.push(`category ILIKE $${i++}`);            values.push(`%${opts.category}%`); }
  if (opts.dateFrom) { conditions.push(`date >= $${i++}`);                   values.push(opts.dateFrom); }
  if (opts.dateTo)   { conditions.push(`date <= $${i++}`);                   values.push(opts.dateTo); }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const offset = (opts.page - 1) * opts.limit;
  const [{ rows }, { rows: countRows }] = await Promise.all([
    db.query(`SELECT * FROM transactions_with_payments ${where} ORDER BY date DESC, created_at DESC LIMIT $${i} OFFSET $${i + 1}`, [...values, opts.limit, offset]),
    db.query(`SELECT COUNT(*) FROM transactions ${where}`, values),
  ]);
  return { data: rows.map(mapTransaction), total: parseInt(countRows[0].count), page: opts.page, limit: opts.limit };
}

export async function findTransactionById(id: string, shopId: string, userId: string): Promise<Transaction | null> {
  const { rows } = await db.query(
    'SELECT * FROM transactions_with_payments WHERE id = $1 AND shop_id = $2 AND user_id = $3',
    [id, shopId, userId],
  );
  return rows[0] ? mapTransaction(rows[0]) : null;
}

/** db itself, or a client inside a BEGIN … COMMIT. */
export type Queryable = { query: typeof db.query };

export type NewTransaction = {
  shopId: string; userId: string; type: TransactionType; amount: number;
  currency?: string; description?: string; category?: string;
  counterparty?: string; date: string; dueDate?: string; aiCategorized?: boolean;
  status?: TransactionStatus;
  /** 'chat' when the assistant recorded it; the dashboard measures how often owners fix those. */
  source?: 'app' | 'chat';
};

export async function createTransaction(data: NewTransaction, client: Queryable = db): Promise<Transaction> {
  // Sales and expenses change hands on the spot; only receivables/payables are still owed.
  // (The column's own default is 'pending', which printed cash sales as "Balance due".)
  const status = data.status ?? (data.type === 'sale' || data.type === 'expense' ? 'settled' : 'pending');
  const { rows } = await client.query(
    `INSERT INTO transactions
       (shop_id, user_id, type, amount, currency, description, category, counterparty, date, due_date, ai_categorized, status, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [data.shopId, data.userId, data.type, data.amount, data.currency ?? 'NGN',
     data.description ?? null, data.category ?? null, data.counterparty ?? null,
     data.date, data.dueDate ?? null, data.aiCategorized ?? false, status, data.source ?? 'app'],
  );
  return mapTransaction(rows[0]);
}

export async function updateTransaction(id: string, shopId: string, userId: string, data: {
  type?: TransactionType; amount?: number; description?: string; category?: string;
  counterparty?: string; date?: string; dueDate?: string; status?: TransactionStatus;
}): Promise<Transaction | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (data.type !== undefined)        { sets.push(`type = $${i++}`);         values.push(data.type); }
  if (data.amount !== undefined)      { sets.push(`amount = $${i++}`);       values.push(data.amount); }
  if (data.description !== undefined) { sets.push(`description = $${i++}`);  values.push(data.description); }
  if (data.category !== undefined)    { sets.push(`category = $${i++}`);     values.push(data.category); }
  if (data.counterparty !== undefined){ sets.push(`counterparty = $${i++}`); values.push(data.counterparty); }
  if (data.date !== undefined)        { sets.push(`date = $${i++}`);         values.push(data.date); }
  if (data.dueDate !== undefined)     { sets.push(`due_date = $${i++}`);     values.push(data.dueDate); }
  if (data.status !== undefined)      { sets.push(`status = $${i++}`);       values.push(data.status); }
  if (sets.length === 0) return findTransactionById(id, shopId, userId);
  values.push(id, shopId, userId);
  const { rowCount } = await db.query(
    `UPDATE transactions SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i++} AND shop_id = $${i++} AND user_id = $${i}`,
    values,
  );
  return rowCount ? findTransactionById(id, shopId, userId) : null;
}

/** Used by the chat agent's find_transactions tool — free-text search rather than exact filters. */
export async function searchTransactions(shopId: string, userId: string, opts: {
  counterparty?: string; description?: string; type?: TransactionType; unpaidOnly?: boolean; limit?: number;
}): Promise<Transaction[]> {
  const conditions = ['shop_id = $1', 'user_id = $2'];
  const values: unknown[] = [shopId, userId];
  let i = 3;
  if (opts.counterparty) { conditions.push(`counterparty ILIKE $${i++}`); values.push(`%${opts.counterparty}%`); }
  if (opts.description)  { conditions.push(`description ILIKE $${i++}`); values.push(`%${opts.description}%`); }
  if (opts.type)          { conditions.push(`type = $${i++}`);            values.push(opts.type); }
  if (opts.unpaidOnly)    { conditions.push(`status <> 'settled'`); }
  const limit = Math.min(opts.limit ?? 10, 25);
  const { rows } = await db.query(
    `SELECT * FROM transactions_with_payments WHERE ${conditions.join(' AND ')} ORDER BY date DESC, created_at DESC LIMIT $${i}`,
    [...values, limit],
  );
  return rows.map(mapTransaction);
}

// ── Debt payments (migration 005) ───────────────────────────────
// Money is compared in kobo (integer hundredths) so ₦0.10 + ₦0.20 never misses ₦0.30.
const kobo = (naira: number) => Math.round(naira * 100);

export type PaymentResult =
  | { ok: true; transaction: Transaction; payment: DebtPayment }
  | { ok: false; reason: 'not_found' | 'not_a_debt' | 'already_paid' | 'before_debt' | 'in_future' }
  | { ok: false; reason: 'more_than_owed'; balance: number };

/**
 * Records a payment towards a receivable or payable, and marks the debt paid once its
 * payments cover it. `amount` defaults to everything still owed. The debt row is locked
 * so two payments at once can't both see the old balance and overpay it.
 */
export async function recordDebtPayment(
  transactionId: string, shopId: string, userId: string, opts: { amount?: number; paidOn: string; today: string },
): Promise<PaymentResult> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id, type, amount, status, date FROM transactions
       WHERE id = $1 AND shop_id = $2 AND user_id = $3 FOR UPDATE`,
      [transactionId, shopId, userId],
    );
    const tx = rows[0] as { type: string; amount: string; status: TransactionStatus; date: string } | undefined;
    const fail = async (result: PaymentResult) => { await client.query('ROLLBACK'); return result; };
    if (!tx) return fail({ ok: false, reason: 'not_found' });
    if (tx.type !== 'receivable' && tx.type !== 'payable') return fail({ ok: false, reason: 'not_a_debt' });
    if (opts.paidOn < tx.date) return fail({ ok: false, reason: 'before_debt' });
    if (opts.paidOn > opts.today) return fail({ ok: false, reason: 'in_future' });

    const { rows: paidRows } = await client.query(
      'SELECT COALESCE(SUM(amount), 0) AS paid FROM debt_payments WHERE transaction_id = $1', [transactionId],
    );
    const owedKobo = kobo(parseFloat(tx.amount)) - kobo(parseFloat(paidRows[0].paid as string));
    if (owedKobo <= 0) return fail({ ok: false, reason: 'already_paid' });
    const payKobo = opts.amount === undefined ? owedKobo : kobo(opts.amount);
    if (payKobo > owedKobo) return fail({ ok: false, reason: 'more_than_owed', balance: owedKobo / 100 });

    const { rows: inserted } = await client.query(
      `INSERT INTO debt_payments (transaction_id, shop_id, user_id, amount, paid_on)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [transactionId, shopId, userId, payKobo / 100, opts.paidOn],
    );
    const status: TransactionStatus = payKobo === owedKobo ? 'settled' : (tx.status === 'settled' ? 'pending' : tx.status);
    await client.query('UPDATE transactions SET status = $1, updated_at = NOW() WHERE id = $2', [status, transactionId]);
    await client.query('COMMIT');
    const transaction = (await findTransactionById(transactionId, shopId, userId))!;
    return { ok: true, transaction, payment: mapPayment(inserted[0]) };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Removes payments (one by id, or all of them to reopen the debt) and puts the debt's
 * status back in line with what is still paid. Null if the debt isn't found.
 */
export async function removeDebtPayments(
  transactionId: string, shopId: string, userId: string, paymentId?: string,
): Promise<{ transaction: Transaction; removed: number } | null> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT amount, status FROM transactions WHERE id = $1 AND shop_id = $2 AND user_id = $3 FOR UPDATE',
      [transactionId, shopId, userId],
    );
    if (!rows[0]) { await client.query('ROLLBACK'); return null; }
    const { rowCount } = paymentId
      ? await client.query('DELETE FROM debt_payments WHERE id = $1 AND transaction_id = $2', [paymentId, transactionId])
      : await client.query('DELETE FROM debt_payments WHERE transaction_id = $1', [transactionId]);
    await syncDebtStatus(client, transactionId);
    await client.query('COMMIT');
    return { transaction: (await findTransactionById(transactionId, shopId, userId))!, removed: rowCount ?? 0 };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Sets a debt's status from its payments: settled when covered, otherwise not settled. */
async function syncDebtStatus(client: Queryable, transactionId: string): Promise<void> {
  await client.query(
    `UPDATE transactions t SET status = CASE
         WHEN COALESCE((SELECT SUM(amount) FROM debt_payments WHERE transaction_id = t.id), 0) >= t.amount THEN 'settled'
         WHEN t.status = 'settled' THEN 'pending'
         ELSE t.status END,
       updated_at = NOW()
     WHERE t.id = $1 AND t.type IN ('receivable', 'payable')`,
    [transactionId],
  );
}

/** For edits made outside the payment functions (e.g. the debt's amount changed). */
export async function resyncDebtStatus(transactionId: string): Promise<void> {
  await syncDebtStatus(db, transactionId);
}

export async function listDebtPayments(transactionId: string, shopId: string, userId: string): Promise<DebtPayment[]> {
  const { rows } = await db.query(
    `SELECT * FROM debt_payments WHERE transaction_id = $1 AND shop_id = $2 AND user_id = $3
     ORDER BY paid_on, created_at`,
    [transactionId, shopId, userId],
  );
  return rows.map(mapPayment);
}

function mapPayment(row: Record<string, unknown>): DebtPayment {
  return {
    id: row['id'] as string,
    transactionId: row['transaction_id'] as string,
    amount: parseFloat(row['amount'] as string),
    paidOn: row['paid_on'] as string,
    createdAt: row['created_at'] as Date,
  };
}

export async function findTransactionsByIds(ids: string[], shopId: string, userId: string): Promise<Transaction[]> {
  if (ids.length === 0) return [];
  const { rows } = await db.query(
    'SELECT * FROM transactions_with_payments WHERE id = ANY($1) AND shop_id = $2 AND user_id = $3',
    [ids, shopId, userId],
  );
  return rows.map(mapTransaction);
}

export interface SpendingSummary {
  from: string;
  to: string;
  byType: { type: TransactionType; total: number; count: number }[];
  byCategory: { type: TransactionType; category: string | null; total: number; count: number }[];
}

/** Used by the chat agent's get_spending_summary tool — real SQL aggregation, not model arithmetic. */
export async function getSpendingSummary(shopId: string, userId: string, from: string, to: string): Promise<SpendingSummary> {
  const [{ rows: byType }, { rows: byCategory }] = await Promise.all([
    db.query(
      `SELECT type, SUM(amount) AS total, COUNT(*) AS count FROM transactions
       WHERE shop_id = $1 AND user_id = $2 AND date BETWEEN $3 AND $4
       GROUP BY type ORDER BY type`,
      [shopId, userId, from, to],
    ),
    db.query(
      `SELECT type, category, SUM(amount) AS total, COUNT(*) AS count FROM transactions
       WHERE shop_id = $1 AND user_id = $2 AND date BETWEEN $3 AND $4
       GROUP BY type, category ORDER BY total DESC`,
      [shopId, userId, from, to],
    ),
  ]);
  return {
    from, to,
    byType: byType.map((r) => ({ type: r['type'], total: parseFloat(r['total']), count: parseInt(r['count'], 10) })),
    byCategory: byCategory.map((r) => ({ type: r['type'], category: r['category'], total: parseFloat(r['total']), count: parseInt(r['count'], 10) })),
  };
}

// ── Reports (Deliverable 7) ─────────────────────────────────────
export interface CategoryLine {
  type: TransactionType;
  category: string;
  count: number;
  total: number;
  /** Part of `total` not yet settled — only meaningful for receivables/payables. */
  unpaid: number;
}

/**
 * Profit & loss lines for a period, on the accrual basis: every transaction counts on its
 * own date, including sales and purchases on credit. `unpaid` is what was still owed on
 * those debts at the end of the period (payments dated after it don't count yet).
 */
export async function getProfitAndLossLines(shopId: string, userId: string, from: string, to: string): Promise<CategoryLine[]> {
  const { rows } = await db.query(
    `SELECT t.type,
            COALESCE(NULLIF(TRIM(t.category), ''), 'Uncategorised') AS category,
            COUNT(*) AS count,
            SUM(t.amount) AS total,
            SUM(CASE WHEN t.type IN ('receivable', 'payable') THEN t.amount - COALESCE(p.paid, 0) ELSE 0 END) AS unpaid
     FROM transactions t
     LEFT JOIN (
       SELECT transaction_id, SUM(amount) AS paid FROM debt_payments WHERE paid_on <= $4 GROUP BY transaction_id
     ) p ON p.transaction_id = t.id
     WHERE t.shop_id = $1 AND t.user_id = $2 AND t.date BETWEEN $3 AND $4
     GROUP BY 1, 2
     ORDER BY 1, SUM(t.amount) DESC`,
    [shopId, userId, from, to],
  );
  return rows.map((r) => ({
    type: r['type'] as TransactionType,
    category: r['category'] as string,
    count: parseInt(r['count'] as string, 10),
    total: parseFloat(r['total'] as string),
    unpaid: parseFloat(r['unpaid'] as string),
  }));
}

export type DebtAsOf = Transaction & { paidAsOf: number; balanceAsOf: number };

/**
 * Receivables or payables that were still (partly) owed at the end of `asOf`: recorded on
 * or before it, less the payments made by then. Soonest due first.
 */
export async function getDebtsAsOf(
  shopId: string, userId: string, type: 'receivable' | 'payable', asOf: string,
): Promise<DebtAsOf[]> {
  const { rows } = await db.query(
    `SELECT t.*, COALESCE(p.paid, 0) AS paid_as_of
     FROM transactions_with_payments t
     LEFT JOIN (
       SELECT transaction_id, SUM(amount) AS paid FROM debt_payments WHERE paid_on <= $4 GROUP BY transaction_id
     ) p ON p.transaction_id = t.id
     WHERE t.shop_id = $1 AND t.user_id = $2 AND t.type = $3 AND t.date <= $4
       AND t.amount > COALESCE(p.paid, 0)
     ORDER BY t.due_date NULLS LAST, t.date, t.created_at`,
    [shopId, userId, type, asOf],
  );
  return rows.map((r) => {
    const tx = mapTransaction(r);
    const paidAsOf = parseFloat(r['paid_as_of'] as string);
    return { ...tx, paidAsOf, balanceAsOf: Math.round((tx.amount - paidAsOf) * 100) / 100 };
  });
}

export interface PaymentLine {
  paidOn: string;
  amount: number;
  counterparty?: string;
  description?: string;
  transactionId: string;
}

/** Payments received (receivables) or made (payables) between two dates, in date order. */
export async function getPaymentsInPeriod(
  shopId: string, userId: string, type: 'receivable' | 'payable', from: string, to: string,
): Promise<PaymentLine[]> {
  const { rows } = await db.query(
    `SELECT p.paid_on, p.amount, t.counterparty, t.description, t.id AS transaction_id
     FROM debt_payments p JOIN transactions t ON t.id = p.transaction_id
     WHERE p.shop_id = $1 AND p.user_id = $2 AND t.type = $3 AND p.paid_on BETWEEN $4 AND $5
     ORDER BY p.paid_on, p.created_at`,
    [shopId, userId, type, from, to],
  );
  return rows.map((r) => ({
    paidOn: r['paid_on'] as string,
    amount: parseFloat(r['amount'] as string),
    counterparty: (r['counterparty'] as string | null) ?? undefined,
    description: (r['description'] as string | null) ?? undefined,
    transactionId: r['transaction_id'] as string,
  }));
}

/** Everything still owed today across all dates — shown beside the report figure for context. */
export async function getOpenDebtTotal(shopId: string, userId: string, type: 'receivable' | 'payable'): Promise<number> {
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(amount - amount_paid), 0) AS total FROM transactions_with_payments
     WHERE shop_id = $1 AND user_id = $2 AND type = $3`,
    [shopId, userId, type],
  );
  return parseFloat(rows[0]['total'] as string);
}

// ── Chat ──────────────────────────────────────────────────────
export async function createChatSession(userId: string, shopId: string): Promise<ChatSession> {
  const { rows } = await db.query(
    'INSERT INTO chat_sessions (user_id, shop_id) VALUES ($1, $2) RETURNING *',
    [userId, shopId],
  );
  return mapSession(rows[0]);
}

export async function listChatSessions(userId: string, shopId?: string, page = 1, limit = 20): Promise<PaginatedResponse<ChatSession>> {
  const conditions = ['user_id = $1'];
  const values: unknown[] = [userId];
  if (shopId) { conditions.push('shop_id = $2'); values.push(shopId); }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const offset = (page - 1) * limit;
  const i = values.length;
  const [{ rows }, { rows: countRows }] = await Promise.all([
    db.query(`SELECT * FROM chat_sessions ${where} ORDER BY last_message_at DESC NULLS LAST, created_at DESC LIMIT $${i + 1} OFFSET $${i + 2}`, [...values, limit, offset]),
    db.query(`SELECT COUNT(*) FROM chat_sessions ${where}`, values),
  ]);
  return { data: rows.map(mapSession), total: parseInt(countRows[0].count), page, limit };
}

export async function addChatMessage(sessionId: string, role: 'user' | 'assistant', content: string, type = 'text', mediaUrl?: string, extra?: {
  extractedTransactionIds?: string[]; receiptTransactionId?: string;
}): Promise<ChatMessage> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO chat_messages (session_id, role, type, content, media_url, extracted_transaction_ids, receipt_transaction_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [sessionId, role, type, content, mediaUrl ?? null, extra?.extractedTransactionIds ?? [], extra?.receiptTransactionId ?? null],
    );
    await client.query('UPDATE chat_sessions SET last_message_at = NOW() WHERE id = $1', [sessionId]);
    await client.query('COMMIT');
    return mapMessage(rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** Ownership check for a chat session — used before reading or posting to it. */
export async function findChatSessionById(id: string, userId: string): Promise<ChatSession | null> {
  const { rows } = await db.query('SELECT * FROM chat_sessions WHERE id = $1 AND user_id = $2', [id, userId]);
  return rows[0] ? mapSession(rows[0]) : null;
}

export async function listChatMessages(sessionId: string, page = 1, limit = 50): Promise<PaginatedResponse<ChatMessage>> {
  const offset = (page - 1) * limit;
  const [{ rows }, { rows: countRows }] = await Promise.all([
    db.query('SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC LIMIT $2 OFFSET $3', [sessionId, limit, offset]),
    db.query('SELECT COUNT(*) FROM chat_messages WHERE session_id = $1', [sessionId]),
  ]);
  return { data: rows.map(mapMessage), total: parseInt(countRows[0].count), page, limit };
}

/** The newest `limit` messages of a session, oldest first: the conversation the assistant sees. */
export async function listRecentChatMessages(sessionId: string, limit: number): Promise<ChatMessage[]> {
  const { rows } = await db.query(
    `SELECT * FROM (SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY created_at DESC LIMIT $2) recent
     ORDER BY created_at ASC`,
    [sessionId, limit],
  );
  return rows.map(mapMessage);
}

// ── Business dashboard data ───────────────────────────────────
export interface AiUsageRow {
  userId: string; shopId: string; model: string; calls: number;
  input: number; cacheWrite: number; cacheRead: number; output: number;
  costUsd: number | null; recorded: number; failed: boolean;
}

export async function recordAiUsage(u: AiUsageRow): Promise<void> {
  await db.query(
    `INSERT INTO ai_usage (user_id, shop_id, model, calls, input_tokens, cache_write_tokens, cache_read_tokens, output_tokens, cost_usd, recorded, failed)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [u.userId, u.shopId, u.model, u.calls, u.input, u.cacheWrite, u.cacheRead, u.output, u.costUsd, u.recorded, u.failed],
  );
}

/** Notes that the owner edited or deleted a transaction the assistant recorded (no-op for any other). */
export async function noteAiCorrection(transactionId: string, shopId: string, userId: string, kind: 'edited' | 'deleted'): Promise<void> {
  await db.query(
    `INSERT INTO ai_corrections (transaction_id, user_id, kind)
     SELECT id, user_id, $4 FROM transactions WHERE id = $1 AND shop_id = $2 AND user_id = $3 AND source = 'chat'`,
    [transactionId, shopId, userId, kind],
  );
}

/** Records that the owner used the app on `day` (a Lagos date). Repeat calls do nothing. */
export async function markActiveDay(userId: string, day: string): Promise<void> {
  await db.query('INSERT INTO user_active_days (user_id, day) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, day]);
}

export async function isAdmin(userId: string): Promise<boolean> {
  const { rows } = await db.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
  return rows[0]?.['is_admin'] === true;
}

// ── Alerts ────────────────────────────────────────────────────
export async function listAlerts(userId: string, opts: { shopId?: string; status?: AlertStatus; page: number; limit: number }): Promise<PaginatedResponse<Alert>> {
  const conditions = ['user_id = $1'];
  const values: unknown[] = [userId];
  let i = 2;
  if (opts.shopId) { conditions.push(`shop_id = $${i++}`);  values.push(opts.shopId); }
  if (opts.status) { conditions.push(`status = $${i++}`);   values.push(opts.status); }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const offset = (opts.page - 1) * opts.limit;
  const [{ rows }, { rows: countRows }] = await Promise.all([
    db.query(`SELECT * FROM alerts ${where} ORDER BY created_at DESC LIMIT $${i} OFFSET $${i + 1}`, [...values, opts.limit, offset]),
    db.query(`SELECT COUNT(*) FROM alerts ${where}`, values),
  ]);
  return { data: rows.map(mapAlert), total: parseInt(countRows[0].count), page: opts.page, limit: opts.limit };
}

export async function updateAlertStatus(id: string, userId: string, status: AlertStatus): Promise<Alert | null> {
  const { rows } = await db.query(
    'UPDATE alerts SET status = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
    [status, id, userId],
  );
  return rows[0] ? mapAlert(rows[0]) : null;
}

// ── Imports ───────────────────────────────────────────────────
export async function createImportJob(userId: string, shopId: string, filename: string, filePath: string): Promise<ExcelImport> {
  const { rows } = await db.query(
    'INSERT INTO excel_imports (user_id, shop_id, filename, file_path) VALUES ($1,$2,$3,$4) RETURNING *',
    [userId, shopId, filename, filePath],
  );
  return mapImport(rows[0]);
}

export async function findImportById(id: string, userId: string): Promise<ExcelImport | null> {
  const { rows } = await db.query(
    'SELECT * FROM excel_imports WHERE id = $1 AND user_id = $2',
    [id, userId],
  );
  return rows[0] ? mapImport(rows[0]) : null;
}

export async function updateImportJob(id: string, data: Partial<{
  status: ImportStatus; rowCount: number; validRows: number; errorRows: number;
  qualityScore: number; columnMapping: Record<string, string>; errorLog: unknown[];
}>): Promise<void> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (data.status !== undefined)        { sets.push(`status = $${i++}`);         values.push(data.status); }
  if (data.rowCount !== undefined)      { sets.push(`row_count = $${i++}`);      values.push(data.rowCount); }
  if (data.validRows !== undefined)     { sets.push(`valid_rows = $${i++}`);     values.push(data.validRows); }
  if (data.errorRows !== undefined)     { sets.push(`error_rows = $${i++}`);     values.push(data.errorRows); }
  if (data.qualityScore !== undefined)  { sets.push(`quality_score = $${i++}`);  values.push(data.qualityScore); }
  if (data.columnMapping !== undefined) { sets.push(`column_mapping = $${i++}`); values.push(JSON.stringify(data.columnMapping)); }
  if (data.errorLog !== undefined)      { sets.push(`error_log = $${i++}`);      values.push(JSON.stringify(data.errorLog)); }
  if (sets.length === 0) return;
  values.push(id);
  await db.query(`UPDATE excel_imports SET ${sets.join(', ')} WHERE id = $${i}`, values);
}

// ── Row mappers ───────────────────────────────────────────────
function mapUser(row: Record<string, unknown>): User & { passwordHash: string; loginAttempts: number; lockoutUntil: Date | null } {
  return {
    id: row['id'] as string,
    name: row['name'] as string,
    email: row['email'] as string,
    phone: row['phone'] as string | undefined,
    emailVerified: row['email_verified'] as boolean,
    isAdmin: row['is_admin'] as boolean,
    alertEmail: row['alert_email'] as boolean,
    alertSms: row['alert_sms'] as boolean,
    alertWhatsapp: row['alert_whatsapp'] as boolean,
    alertQuietStart: row['alert_quiet_start'] as string,
    alertQuietEnd: row['alert_quiet_end'] as string,
    thresholdLowCash: parseFloat(row['threshold_low_cash'] as string),
    thresholdHighPayable: parseFloat(row['threshold_high_payable'] as string),
    thresholdOverdueDays: row['threshold_overdue_days'] as number,
    passwordHash: row['password_hash'] as string,
    loginAttempts: row['login_attempts'] as number,
    lockoutUntil: row['lockout_until'] as Date | null,
    createdAt: row['created_at'] as Date,
    updatedAt: row['updated_at'] as Date,
  };
}

export const BRANDING_URL_PREFIX = '/api/v1/files/branding/';

function brandingUrl(key: unknown): string | null {
  return typeof key === 'string' && key ? BRANDING_URL_PREFIX + key : null;
}

function mapShop(row: Record<string, unknown>): Shop {
  return {
    id: row['id'] as string,
    ownerId: row['owner_id'] as string,
    name: row['name'] as string,
    type: row['type'] as Shop['type'],
    location: row['location'] as string | undefined,
    currency: row['currency'] as string,
    isActive: row['is_active'] as boolean,
    logoUrl: brandingUrl(row['logo_key']),
    signatureUrl: brandingUrl(row['signature_key']),
    createdAt: row['created_at'] as Date,
    updatedAt: row['updated_at'] as Date,
  };
}

function paidAndBalance(row: Record<string, unknown>): { amountPaid: number; balance: number } {
  const amount = parseFloat(row['amount'] as string);
  // Rows read through transactions_with_payments carry amount_paid. A row straight from an
  // INSERT doesn't, but a new transaction has no payments yet: a debt owes all of it, a
  // cash sale/expense is paid in full.
  const paid = row['amount_paid'] !== undefined
    ? parseFloat(row['amount_paid'] as string)
    : (row['status'] === 'settled' && row['type'] !== 'receivable' && row['type'] !== 'payable' ? amount : 0);
  return { amountPaid: paid, balance: Math.round((amount - paid) * 100) / 100 };
}

function mapTransaction(row: Record<string, unknown>): Transaction {
  return {
    id: row['id'] as string,
    shopId: row['shop_id'] as string,
    userId: row['user_id'] as string,
    type: row['type'] as Transaction['type'],
    amount: parseFloat(row['amount'] as string),
    currency: row['currency'] as string,
    description: row['description'] as string | undefined,
    category: row['category'] as string | undefined,
    counterparty: row['counterparty'] as string | undefined,
    date: row['date'] as string,
    dueDate: (row['due_date'] as string | null) ?? undefined,
    status: row['status'] as Transaction['status'],
    ...paidAndBalance(row),
    aiCategorized: row['ai_categorized'] as boolean,
    importId: row['import_id'] as string | undefined,
    createdAt: row['created_at'] as Date,
    updatedAt: row['updated_at'] as Date,
  };
}

function mapSession(row: Record<string, unknown>): ChatSession {
  return {
    id: row['id'] as string,
    userId: row['user_id'] as string,
    shopId: row['shop_id'] as string,
    lastMessageAt: row['last_message_at'] as Date | undefined,
    createdAt: row['created_at'] as Date,
  };
}

function mapMessage(row: Record<string, unknown>): ChatMessage {
  return {
    id: row['id'] as string,
    sessionId: row['session_id'] as string,
    role: row['role'] as ChatMessage['role'],
    type: row['type'] as ChatMessage['type'],
    content: row['content'] as string,
    mediaUrl: row['media_url'] as string | undefined,
    extractedTransactionIds: (row['extracted_transaction_ids'] as string[] | null) ?? [],
    receiptTransactionId: row['receipt_transaction_id'] as string | undefined,
    createdAt: row['created_at'] as Date,
  };
}

function mapAlert(row: Record<string, unknown>): Alert {
  return {
    id: row['id'] as string,
    userId: row['user_id'] as string,
    shopId: row['shop_id'] as string,
    type: row['type'] as Alert['type'],
    status: row['status'] as Alert['status'],
    message: row['message'] as string,
    metadata: row['metadata'] as Record<string, unknown> | undefined,
    createdAt: row['created_at'] as Date,
    updatedAt: row['updated_at'] as Date,
  };
}

function mapImport(row: Record<string, unknown>): ExcelImport {
  return {
    id: row['id'] as string,
    userId: row['user_id'] as string,
    shopId: row['shop_id'] as string,
    filename: row['filename'] as string,
    filePath: row['file_path'] as string | undefined,
    status: row['status'] as ExcelImport['status'],
    rowCount: row['row_count'] as number | undefined,
    validRows: row['valid_rows'] as number | undefined,
    errorRows: row['error_rows'] as number | undefined,
    qualityScore: row['quality_score'] ? parseFloat(row['quality_score'] as string) : undefined,
    columnMapping: row['column_mapping'] as Record<string, string> | undefined,
    errorLog: row['error_log'] as unknown[] | undefined,
    createdAt: row['created_at'] as Date,
    updatedAt: row['updated_at'] as Date,
  };
}

// ── Email verification (migration 007) ───────────────────────

/** Stores a new verification token (hashed) and retires any older unused ones. */
export async function createEmailVerification(userId: string, email: string, tokenHash: string, expiresAt: Date): Promise<void> {
  await db.query('UPDATE email_verification_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [userId]);
  await db.query(
    'INSERT INTO email_verification_tokens (user_id, email, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
    [userId, email, tokenHash, expiresAt],
  );
}

export type VerificationResult = { status: 'verified'; userId: string } | { status: 'invalid' | 'expired' | 'used' };

/**
 * Marks the user's email verified if the token is live and was issued for the address
 * the account still has (so a link sent before an email change can't verify the new one).
 */
export async function consumeEmailVerification(tokenHash: string): Promise<VerificationResult> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT t.id, t.user_id, t.email, t.expires_at, t.used_at, u.email AS current_email
       FROM email_verification_tokens t JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = $1 FOR UPDATE OF t`,
      [tokenHash],
    );
    const t = rows[0];
    let result: VerificationResult;
    if (!t || t['email'] !== t['current_email']) result = { status: 'invalid' };
    else if (t['used_at']) result = { status: 'used' };
    else if ((t['expires_at'] as Date) < new Date()) result = { status: 'expired' };
    else {
      await client.query('UPDATE email_verification_tokens SET used_at = NOW() WHERE id = $1', [t['id']]);
      await client.query('UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1', [t['user_id']]);
      result = { status: 'verified', userId: t['user_id'] as string };
    }
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Alert settings ───────────────────────────────────────────

export interface AlertSettings {
  emailAlerts: boolean;
  emailVerified: boolean;
  email: string;
  /** 'HH:MM', shop time. No alert emails are sent between quietStart and quietEnd. */
  quietStart: string;
  quietEnd: string;
}

function mapAlertSettings(row: Record<string, unknown>): AlertSettings {
  return {
    emailAlerts: row['alert_email'] as boolean,
    emailVerified: row['email_verified'] as boolean,
    email: row['email'] as string,
    quietStart: String(row['alert_quiet_start']).slice(0, 5),
    quietEnd: String(row['alert_quiet_end']).slice(0, 5),
  };
}

export async function getAlertSettings(userId: string): Promise<AlertSettings | null> {
  const { rows } = await db.query(
    'SELECT email, email_verified, alert_email, alert_quiet_start, alert_quiet_end FROM users WHERE id = $1', [userId],
  );
  return rows[0] ? mapAlertSettings(rows[0]) : null;
}

export async function updateAlertSettings(userId: string, changes: { emailAlerts?: boolean; quietStart?: string; quietEnd?: string }): Promise<AlertSettings | null> {
  const { rows } = await db.query(
    `UPDATE users SET
       alert_email = COALESCE($2, alert_email),
       alert_quiet_start = COALESCE($3::time, alert_quiet_start),
       alert_quiet_end = COALESCE($4::time, alert_quiet_end),
       updated_at = NOW()
     WHERE id = $1
     RETURNING email, email_verified, alert_email, alert_quiet_start, alert_quiet_end`,
    [userId, changes.emailAlerts ?? null, changes.quietStart ?? null, changes.quietEnd ?? null],
  );
  return rows[0] ? mapAlertSettings(rows[0]) : null;
}
