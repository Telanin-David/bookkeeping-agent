import { db } from '../config';
import {
  User, Shop, Transaction, ChatSession, ChatMessage,
  Alert, AlertHistory, ExcelImport, PaginatedResponse,
  TransactionType, TransactionStatus, AlertStatus, ImportStatus,
} from '../types';

// ── Users ─────────────────────────────────────────────────────
export async function findUserByEmail(email: string): Promise<(User & { passwordHash: string; loginAttempts: number; lockoutUntil: Date | null }) | null> {
  const { rows } = await db.query(
    `SELECT id, name, email, phone, password_hash, email_verified,
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
    `SELECT id, name, email, phone, email_verified,
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
     RETURNING id, name, email, phone, email_verified,
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
  | { status: 'rotated'; userId: string }
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
      result = { status: 'rotated', userId: row.user_id };
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

// ── Transactions ──────────────────────────────────────────────
export async function listTransactions(shopId: string, userId: string, opts: {
  type?: TransactionType; category?: string;
  dateFrom?: string; dateTo?: string;
  page: number; limit: number;
}): Promise<PaginatedResponse<Transaction>> {
  const conditions = ['shop_id = $1', 'user_id = $2'];
  const values: unknown[] = [shopId, userId];
  let i = 3;
  if (opts.type)     { conditions.push(`type = $${i++}`);                    values.push(opts.type); }
  if (opts.category) { conditions.push(`category ILIKE $${i++}`);            values.push(`%${opts.category}%`); }
  if (opts.dateFrom) { conditions.push(`date >= $${i++}`);                   values.push(opts.dateFrom); }
  if (opts.dateTo)   { conditions.push(`date <= $${i++}`);                   values.push(opts.dateTo); }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const offset = (opts.page - 1) * opts.limit;
  const [{ rows }, { rows: countRows }] = await Promise.all([
    db.query(`SELECT * FROM transactions ${where} ORDER BY date DESC, created_at DESC LIMIT $${i} OFFSET $${i + 1}`, [...values, opts.limit, offset]),
    db.query(`SELECT COUNT(*) FROM transactions ${where}`, values),
  ]);
  return { data: rows.map(mapTransaction), total: parseInt(countRows[0].count), page: opts.page, limit: opts.limit };
}

export async function findTransactionById(id: string, shopId: string, userId: string): Promise<Transaction | null> {
  const { rows } = await db.query(
    'SELECT * FROM transactions WHERE id = $1 AND shop_id = $2 AND user_id = $3',
    [id, shopId, userId],
  );
  return rows[0] ? mapTransaction(rows[0]) : null;
}

export async function createTransaction(data: {
  shopId: string; userId: string; type: TransactionType; amount: number;
  currency?: string; description?: string; category?: string;
  counterparty?: string; date: string; dueDate?: string; aiCategorized?: boolean;
  status?: TransactionStatus;
}): Promise<Transaction> {
  // Sales and expenses change hands on the spot; only receivables/payables are still owed.
  // (The column's own default is 'pending', which printed cash sales as "Balance due".)
  const status = data.status ?? (data.type === 'sale' || data.type === 'expense' ? 'settled' : 'pending');
  const { rows } = await db.query(
    `INSERT INTO transactions
       (shop_id, user_id, type, amount, currency, description, category, counterparty, date, due_date, ai_categorized, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [data.shopId, data.userId, data.type, data.amount, data.currency ?? 'NGN',
     data.description ?? null, data.category ?? null, data.counterparty ?? null,
     data.date, data.dueDate ?? null, data.aiCategorized ?? false, status],
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
  const { rows } = await db.query(
    `UPDATE transactions SET ${sets.join(', ')} WHERE id = $${i++} AND shop_id = $${i++} AND user_id = $${i} RETURNING *`,
    values,
  );
  return rows[0] ? mapTransaction(rows[0]) : null;
}

export async function deleteTransaction(id: string, shopId: string, userId: string): Promise<boolean> {
  const { rowCount } = await db.query(
    'DELETE FROM transactions WHERE id = $1 AND shop_id = $2 AND user_id = $3',
    [id, shopId, userId],
  );
  return (rowCount ?? 0) > 0;
}

/** Used by the chat agent's find_transactions tool — free-text search rather than exact filters. */
export async function searchTransactions(shopId: string, userId: string, opts: {
  counterparty?: string; description?: string; type?: TransactionType; limit?: number;
}): Promise<Transaction[]> {
  const conditions = ['shop_id = $1', 'user_id = $2'];
  const values: unknown[] = [shopId, userId];
  let i = 3;
  if (opts.counterparty) { conditions.push(`counterparty ILIKE $${i++}`); values.push(`%${opts.counterparty}%`); }
  if (opts.description)  { conditions.push(`description ILIKE $${i++}`); values.push(`%${opts.description}%`); }
  if (opts.type)          { conditions.push(`type = $${i++}`);            values.push(opts.type); }
  const limit = Math.min(opts.limit ?? 10, 25);
  const { rows } = await db.query(
    `SELECT * FROM transactions WHERE ${conditions.join(' AND ')} ORDER BY date DESC, created_at DESC LIMIT $${i}`,
    [...values, limit],
  );
  return rows.map(mapTransaction);
}

export async function findTransactionsByIds(ids: string[], shopId: string, userId: string): Promise<Transaction[]> {
  if (ids.length === 0) return [];
  const { rows } = await db.query(
    'SELECT * FROM transactions WHERE id = ANY($1) AND shop_id = $2 AND user_id = $3',
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

function mapShop(row: Record<string, unknown>): Shop {
  return {
    id: row['id'] as string,
    ownerId: row['owner_id'] as string,
    name: row['name'] as string,
    type: row['type'] as Shop['type'],
    location: row['location'] as string | undefined,
    currency: row['currency'] as string,
    isActive: row['is_active'] as boolean,
    createdAt: row['created_at'] as Date,
    updatedAt: row['updated_at'] as Date,
  };
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
    date: (row['date'] as Date).toISOString().slice(0, 10),
    dueDate: row['due_date'] ? (row['due_date'] as Date).toISOString().slice(0, 10) : undefined,
    status: row['status'] as Transaction['status'],
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
