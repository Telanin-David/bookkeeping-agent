// Stock tracking (migration 006): products, the movements that change their quantity,
// shelf counts and low-stock alerts.
//
// How a shelf count works: a count records what was actually on the shelf. Its change
// (the "difference" — e.g. 2 missing) is always derived: counted minus what the records
// said at that moment. When a sale dated before the count is entered afterwards (sales
// typed in the evening, shelf counted in the morning), the difference is worked out again,
// so the sale isn't taken off the shelf twice. rebaseCounts does this.

import { config, db } from '../config';
import { AppError } from '../middleware/errorHandler';
import { createTransaction, findTransactionById, type NewTransaction, type Queryable } from './db';
import type { Product, StockMovement, StockMovementKind, Transaction, TransactionItem, TransactionType } from '../types';
import { quantityText } from '../utils/quantity';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const num = (v: unknown): number => parseFloat(v as string);
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : parseFloat(v as string));
/** Quantities are compared in hundredths, as money is in kobo. */
const hundredths = (n: number): number => Math.round(n * 100);

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

function rejectDuplicateName(name: string) {
  return (err: unknown): never => {
    if ((err as { code?: string }).code === '23505') {
      throw new AppError(409, 'CONFLICT', `You already have a product called "${name.trim()}".`);
    }
    throw err;
  };
}

// ── Products ─────────────────────────────────────────────────

const PRODUCT_SELECT = `
  SELECT p.*,
         (SELECT MAX(m.occurred_on) FROM stock_movements m WHERE m.product_id = p.id AND m.kind = 'count') AS last_counted_on
  FROM products p`;

export async function listProducts(shopId: string, userId: string, opts: {
  includeArchived?: boolean; lowOnly?: boolean; search?: string;
} = {}): Promise<Product[]> {
  const conditions = ['p.shop_id = $1', 'p.user_id = $2'];
  const values: unknown[] = [shopId, userId];
  if (!opts.includeArchived) conditions.push('p.archived_at IS NULL');
  if (opts.lowOnly) conditions.push('p.low_stock_level IS NOT NULL AND p.quantity <= p.low_stock_level');
  if (opts.search) { values.push(`%${opts.search}%`); conditions.push(`p.name ILIKE $${values.length}`); }
  const { rows } = await db.query(
    `${PRODUCT_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY lower(p.name) LIMIT 500`, values,
  );
  return rows.map(mapProduct);
}

export async function findProduct(id: string, shopId: string, userId: string, client: Queryable = db): Promise<Product | null> {
  if (!UUID_RE.test(id)) return null;
  const { rows } = await client.query(`${PRODUCT_SELECT} WHERE p.id = $1 AND p.shop_id = $2 AND p.user_id = $3`, [id, shopId, userId]);
  return rows[0] ? mapProduct(rows[0]) : null;
}

export interface ProductFields {
  name?: string;
  unit?: string;
  lowStockLevel?: number | null;
  costPrice?: number | null;
  sellingPrice?: number | null;
}

export async function createProduct(shopId: string, userId: string, input: ProductFields & {
  name: string; openingQuantity?: number; today: string;
}): Promise<Product> {
  return inTransaction(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO products (shop_id, user_id, name, unit, low_stock_level, cost_price, selling_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [shopId, userId, input.name.trim(), input.unit?.trim() || 'piece',
       input.lowStockLevel ?? null, input.costPrice ?? null, input.sellingPrice ?? null],
    ).catch(rejectDuplicateName(input.name));
    const id = rows[0].id as string;
    if (input.openingQuantity) {
      await insertMovement(c, { productId: id, shopId, userId, kind: 'opening', change: input.openingQuantity, occurredOn: input.today });
    }
    await syncLowStock(c, [id]);
    return (await findProduct(id, shopId, userId, c))!;
  });
}

/** Null if the product doesn't exist in this shop or has been removed. */
export async function updateProduct(id: string, shopId: string, userId: string, fields: ProductFields): Promise<Product | null> {
  if (!UUID_RE.test(id)) return null;
  const sets: string[] = [];
  const values: unknown[] = [];
  const set = (column: string, value: unknown) => { values.push(value); sets.push(`${column} = $${values.length}`); };
  if (fields.name !== undefined)          set('name', fields.name.trim());
  if (fields.unit !== undefined)          set('unit', fields.unit.trim() || 'piece');
  if (fields.lowStockLevel !== undefined) set('low_stock_level', fields.lowStockLevel);
  if (fields.costPrice !== undefined)     set('cost_price', fields.costPrice);
  if (fields.sellingPrice !== undefined)  set('selling_price', fields.sellingPrice);

  return inTransaction(async (c) => {
    values.push(id, shopId, userId);
    const n = values.length;
    const { rows } = await c.query(
      sets.length
        ? `UPDATE products SET ${sets.join(', ')} WHERE id = $${n - 2} AND shop_id = $${n - 1} AND user_id = $${n} AND archived_at IS NULL RETURNING id`
        : `SELECT id FROM products WHERE id = $${n - 2} AND shop_id = $${n - 1} AND user_id = $${n} AND archived_at IS NULL`,
      values,
    ).catch(rejectDuplicateName(fields.name ?? ''));
    if (!rows[0]) return null;
    await syncLowStock(c, [id]); // the name, unit or warning level may have changed
    return findProduct(id, shopId, userId, c);
  });
}

/**
 * Takes a product off the stock list. Its history stays, so past sales and reports still
 * show it; a new product may reuse the name.
 */
export async function archiveProduct(id: string, shopId: string, userId: string): Promise<boolean> {
  if (!UUID_RE.test(id)) return false;
  return inTransaction(async (c) => {
    const { rows } = await c.query(
      `UPDATE products SET archived_at = NOW() WHERE id = $1 AND shop_id = $2 AND user_id = $3 AND archived_at IS NULL RETURNING id`,
      [id, shopId, userId],
    );
    if (!rows[0]) return false;
    await syncLowStock(c, [id]);
    return true;
  });
}

/** Locks the products (in a fixed order, so two requests can't deadlock) and checks they can take stock changes. */
async function lockProducts(c: Queryable, ids: string[], shopId: string, userId: string): Promise<Map<string, { name: string; unit: string }>> {
  const unique = [...new Set(ids)].sort();
  if (unique.some((id) => !UUID_RE.test(id))) throw new AppError(404, 'NOT_FOUND', 'Product not found');
  const { rows } = await c.query(
    `SELECT id, name, unit, archived_at FROM products
     WHERE id = ANY($1::uuid[]) AND shop_id = $2 AND user_id = $3 ORDER BY id FOR UPDATE`,
    [unique, shopId, userId],
  );
  if (rows.length !== unique.length) throw new AppError(404, 'NOT_FOUND', 'Product not found');
  const archived = rows.find((r) => r['archived_at'] !== null);
  if (archived) throw new AppError(422, 'UNPROCESSABLE_ENTITY', `"${archived['name']}" has been removed from your stock list.`);
  return new Map(rows.map((r) => [r['id'] as string, { name: r['name'] as string, unit: r['unit'] as string }]));
}

// ── Movements ────────────────────────────────────────────────

async function insertMovement(c: Queryable, m: {
  productId: string; shopId: string; userId: string; kind: StockMovementKind; change: number;
  counted?: number; transactionId?: string; note?: string; occurredOn: string;
}): Promise<string> {
  const { rows } = await c.query(
    `INSERT INTO stock_movements (product_id, shop_id, user_id, kind, change, counted, transaction_id, note, occurred_on)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [m.productId, m.shopId, m.userId, m.kind, m.change, m.counted ?? null, m.transactionId ?? null, m.note?.trim() || null, m.occurredOn],
  );
  return rows[0].id as string;
}

/**
 * Re-derives every shelf count's difference for a product: counted minus the sum of all
 * movements before it (by date, then by when it was entered). The products.quantity
 * trigger follows each change.
 */
async function rebaseCounts(c: Queryable, productId: string): Promise<void> {
  const { rows: counts } = await c.query(
    `SELECT id FROM stock_movements WHERE product_id = $1 AND kind = 'count' ORDER BY occurred_on, created_at, id`,
    [productId],
  );
  for (const { id } of counts) {
    await c.query(
      `UPDATE stock_movements cm SET change = cm.counted - COALESCE((
         SELECT SUM(o.change) FROM stock_movements o
         WHERE o.product_id = cm.product_id
           AND (o.occurred_on, o.created_at, o.id) < (cm.occurred_on, cm.created_at, cm.id)
       ), 0)
       WHERE cm.id = $1`,
      [id],
    );
  }
}

/** After any stock change: counts re-derived, then low-stock alerts raised, updated or resolved. */
async function settle(c: Queryable, productIds: string[]): Promise<void> {
  for (const id of new Set(productIds)) await rebaseCounts(c, id);
  await syncLowStock(c, productIds);
}

export async function adjustStock(shopId: string, userId: string, productId: string, input: {
  kind: 'restock' | 'adjustment'; change: number; occurredOn: string; note?: string; today: string;
}): Promise<{ product: Product; movement: StockMovement }> {
  if (input.occurredOn > input.today) throw new AppError(422, 'UNPROCESSABLE_ENTITY', 'The date can’t be in the future.');
  if (input.kind === 'restock' && !(input.change > 0)) throw new AppError(422, 'UNPROCESSABLE_ENTITY', 'Enter how many were added.');
  if (hundredths(input.change) === 0) throw new AppError(422, 'UNPROCESSABLE_ENTITY', 'Enter how many to add or remove.');
  return inTransaction(async (c) => {
    await lockProducts(c, [productId], shopId, userId);
    const id = await insertMovement(c, { productId, shopId, userId, kind: input.kind, change: input.change, note: input.note, occurredOn: input.occurredOn });
    await settle(c, [productId]);
    return { product: (await findProduct(productId, shopId, userId, c))!, movement: (await findMovement(c, id))! };
  });
}

export interface CountLine {
  product: Product;
  counted: number;
  /** What the records said was on the shelf at the time of the count. */
  expected: number;
  /** counted − expected: negative means missing, positive means more than recorded. */
  difference: number;
}

export async function recordShelfCount(shopId: string, userId: string, input: {
  items: { productId: string; counted: number }[]; occurredOn: string; note?: string; today: string;
}): Promise<CountLine[]> {
  if (input.occurredOn > input.today) throw new AppError(422, 'UNPROCESSABLE_ENTITY', 'The count date can’t be in the future.');
  const ids = input.items.map((i) => i.productId);
  if (new Set(ids).size !== ids.length) throw new AppError(400, 'BAD_REQUEST', 'Each product can only be counted once per count.');
  return inTransaction(async (c) => {
    await lockProducts(c, ids, shopId, userId);
    const movementIds: string[] = [];
    for (const item of input.items) {
      // change starts at 0; rebaseCounts works out the real difference.
      movementIds.push(await insertMovement(c, {
        productId: item.productId, shopId, userId, kind: 'count', change: 0, counted: item.counted, note: input.note, occurredOn: input.occurredOn,
      }));
    }
    await settle(c, ids);
    const lines: CountLine[] = [];
    for (const [i, item] of input.items.entries()) {
      const movement = (await findMovement(c, movementIds[i]!))!;
      lines.push({
        product: (await findProduct(item.productId, shopId, userId, c))!,
        counted: item.counted,
        expected: (hundredths(item.counted) - hundredths(movement.change)) / 100,
        difference: movement.change,
      });
    }
    return lines;
  });
}

/**
 * Undoes a restock, adjustment, count or opening quantity entered by mistake. Stock that
 * came from a sale or purchase is changed by editing or deleting that transaction instead.
 */
export async function removeMovement(movementId: string, shopId: string, userId: string): Promise<Product | null> {
  if (!UUID_RE.test(movementId)) return null;
  return inTransaction(async (c) => {
    const { rows } = await c.query(
      `SELECT product_id, transaction_id FROM stock_movements WHERE id = $1 AND shop_id = $2 AND user_id = $3`,
      [movementId, shopId, userId],
    );
    const row = rows[0];
    if (!row) return null;
    if (row['transaction_id']) {
      throw new AppError(422, 'UNPROCESSABLE_ENTITY', 'This stock change came from a sale or purchase. Edit or delete that transaction instead.');
    }
    const productId = row['product_id'] as string;
    await lockProducts(c, [productId], shopId, userId);
    await c.query('DELETE FROM stock_movements WHERE id = $1', [movementId]);
    await settle(c, [productId]);
    return findProduct(productId, shopId, userId, c);
  });
}

export async function listMovements(productId: string, shopId: string, userId: string, limit = 100): Promise<StockMovement[] | null> {
  if (!(await findProduct(productId, shopId, userId))) return null;
  const { rows } = await db.query(
    `SELECT m.*, p.name AS product_name FROM stock_movements m JOIN products p ON p.id = m.product_id
     WHERE m.product_id = $1 ORDER BY m.occurred_on DESC, m.created_at DESC, m.id DESC LIMIT $2`,
    [productId, Math.min(limit, 500)],
  );
  return rows.map(mapMovement);
}

async function findMovement(c: Queryable, id: string): Promise<StockMovement | null> {
  const { rows } = await c.query(
    `SELECT m.*, p.name AS product_name FROM stock_movements m JOIN products p ON p.id = m.product_id WHERE m.id = $1`, [id],
  );
  return rows[0] ? mapMovement(rows[0]) : null;
}

// ── Stock on sales and purchases ─────────────────────────────

/** Sales take stock off the shelf; purchases (expenses and bills on credit) put it on. */
export const stockDirection = (type: TransactionType): -1 | 1 => (type === 'sale' || type === 'receivable' ? -1 : 1);

function mergeItems(items: TransactionItem[]): TransactionItem[] {
  const byProduct = new Map<string, number>();
  for (const item of items) byProduct.set(item.productId, (byProduct.get(item.productId) ?? 0) + item.quantity);
  return [...byProduct].map(([productId, quantity]) => ({ productId, quantity }));
}

/** Records a transaction and its product lines together: both are saved, or neither. */
export async function createTransactionWithItems(data: NewTransaction, items: TransactionItem[]): Promise<Transaction> {
  const lines = mergeItems(items);
  const id = await inTransaction(async (c) => {
    // Goods put on the shelf are stock bought to resell, whatever else was said.
    const tx = await createTransaction(stockDirection(data.type) > 0 ? { ...data, costKind: 'stock' } : data, c);
    await lockProducts(c, lines.map((l) => l.productId), data.shopId, data.userId);
    const direction = stockDirection(data.type);
    for (const line of lines) {
      await insertMovement(c, {
        productId: line.productId, shopId: data.shopId, userId: data.userId,
        kind: direction < 0 ? 'sale' : 'restock', change: direction * line.quantity,
        transactionId: tx.id, occurredOn: data.date,
      });
    }
    await settle(c, lines.map((l) => l.productId));
    return tx.id;
  });
  return (await findTransactionById(id, data.shopId, data.userId))!;
}

export interface TransactionItemLine { productId: string; name: string; unit: string; quantity: number }

export async function getTransactionItems(transactionId: string): Promise<TransactionItemLine[]> {
  const { rows } = await db.query(
    `SELECT m.product_id, p.name, p.unit, ABS(m.change) AS quantity
     FROM stock_movements m JOIN products p ON p.id = m.product_id
     WHERE m.transaction_id = $1 ORDER BY lower(p.name)`,
    [transactionId],
  );
  return rows.map((r) => ({ productId: r['product_id'] as string, name: r['name'] as string, unit: r['unit'] as string, quantity: num(r['quantity']) }));
}

/** True when changing a transaction's type would flip its stock the wrong way (a sale with items becoming an expense). */
export async function wouldFlipStock(transactionId: string, currentType: TransactionType, newType: TransactionType): Promise<boolean> {
  if (stockDirection(currentType) === stockDirection(newType)) return false;
  const { rows } = await db.query('SELECT 1 FROM stock_movements WHERE transaction_id = $1 LIMIT 1', [transactionId]);
  return rows.length > 0;
}

/** True when the transaction put products on the shelf or took them off. */
export async function hasItems(transactionId: string): Promise<boolean> {
  const { rows } = await db.query('SELECT 1 FROM stock_movements WHERE transaction_id = $1 LIMIT 1', [transactionId]);
  return rows.length > 0;
}

/** A transaction's items follow its date. */
export async function moveTransactionItems(transactionId: string, date: string): Promise<void> {
  await inTransaction(async (c) => {
    const { rows } = await c.query(
      'UPDATE stock_movements SET occurred_on = $1 WHERE transaction_id = $2 RETURNING product_id', [date, transactionId],
    );
    await settle(c, rows.map((r) => r['product_id'] as string));
  });
}

/** Deletes a transaction; any stock it moved goes back (or comes off) the shelf with it. */
export async function deleteTransactionWithStock(id: string, shopId: string, userId: string): Promise<boolean> {
  if (!UUID_RE.test(id)) return false;
  return inTransaction(async (c) => {
    const { rows: moved } = await c.query('SELECT DISTINCT product_id FROM stock_movements WHERE transaction_id = $1', [id]);
    const { rowCount } = await c.query('DELETE FROM transactions WHERE id = $1 AND shop_id = $2 AND user_id = $3', [id, shopId, userId]);
    if (!rowCount) return false;
    await settle(c, moved.map((r) => r['product_id'] as string));
    return true;
  });
}

// ── Low-stock alerts ─────────────────────────────────────────

/**
 * One alert per spell of low stock. It's raised when a product falls to its warning level,
 * kept up to date while it stays low (and shown again if the product runs out altogether),
 * and marked resolved once the product is restocked above the level or removed.
 */
async function syncLowStock(c: Queryable, productIds: string[]): Promise<void> {
  for (const id of new Set(productIds)) {
    const { rows } = await c.query(
      `SELECT p.*, a.metadata AS alert_metadata FROM products p LEFT JOIN alerts a ON a.id = p.low_alert_id
       WHERE p.id = $1 FOR UPDATE OF p`,
      [id],
    );
    const p = rows[0];
    if (!p) continue;
    const quantity = num(p['quantity']);
    const level = numOrNull(p['low_stock_level']);
    const alertId = p['low_alert_id'] as string | null;
    const low = p['archived_at'] === null && level !== null && hundredths(quantity) <= hundredths(level);

    if (!low) {
      if (alertId) {
        await c.query(`UPDATE alerts SET status = 'resolved' WHERE id = $1 AND status IN ('active', 'acknowledged')`, [alertId]);
        await c.query('UPDATE products SET low_alert_id = NULL WHERE id = $1', [id]);
      }
      continue;
    }

    const name = p['name'] as string;
    const out = hundredths(quantity) <= 0;
    const message = out ? `${name} is out of stock.` : `${name} is running low: ${quantityText(quantity, p['unit'] as string)} left.`;
    const metadata = JSON.stringify({
      productId: id, productName: name, quantity, unit: p['unit'], lowStockLevel: level, level: out ? 'out' : 'low',
    });
    if (!alertId) {
      const { rows: created } = await c.query(
        `INSERT INTO alerts (user_id, shop_id, type, message, metadata) VALUES ($1, $2, 'low_stock', $3, $4) RETURNING id`,
        [p['user_id'], p['shop_id'], message, metadata],
      );
      await c.query('UPDATE products SET low_alert_id = $1 WHERE id = $2', [created[0].id, id]);
    } else {
      // Running out altogether deserves a fresh look even if "running low" was dismissed.
      const wasOut = (p['alert_metadata'] as { level?: string } | null)?.level === 'out';
      await c.query(
        `UPDATE alerts SET message = $1, metadata = $2, status = CASE WHEN $3::boolean THEN 'active' ELSE status END WHERE id = $4`,
        [message, metadata, out && !wasOut, alertId],
      );
    }
  }
}

// ── Stock report ─────────────────────────────────────────────

export interface StockReportLine {
  product: Product;
  /** On hand at the start of the period. */
  opening: number;
  /** Restocked or newly added in the period. */
  added: number;
  sold: number;
  /** Shelf-count differences in the period (negative: missing). */
  countDifference: number;
  /** Damaged, expired, used… (usually negative). */
  adjusted: number;
  /** On hand at the end of the period. */
  closing: number;
  isLowAtEnd: boolean;
  /** closing × cost price, when a cost price is set and there is stock. */
  value: number | null;
}

export async function getStockReport(shopId: string, userId: string, from: string, to: string): Promise<StockReportLine[]> {
  const { rows } = await db.query(
    `SELECT p.*, NULL AS last_counted_on,
       COALESCE(SUM(m.change) FILTER (WHERE m.occurred_on < $3), 0) AS opening_qty,
       COALESCE(SUM(m.change) FILTER (WHERE m.occurred_on BETWEEN $3 AND $4 AND m.kind IN ('opening', 'restock')), 0) AS added,
       COALESCE(-SUM(m.change) FILTER (WHERE m.occurred_on BETWEEN $3 AND $4 AND m.kind = 'sale'), 0) AS sold,
       COALESCE(SUM(m.change) FILTER (WHERE m.occurred_on BETWEEN $3 AND $4 AND m.kind = 'count'), 0) AS count_diff,
       COALESCE(SUM(m.change) FILTER (WHERE m.occurred_on BETWEEN $3 AND $4 AND m.kind = 'adjustment'), 0) AS adjusted,
       COALESCE(SUM(m.change) FILTER (WHERE m.occurred_on <= $4), 0) AS closing_qty
     FROM products p LEFT JOIN stock_movements m ON m.product_id = p.id
     WHERE p.shop_id = $1 AND p.user_id = $2
     GROUP BY p.id
     HAVING (p.archived_at IS NULL AND (p.created_at AT TIME ZONE $5)::date <= $4)
         OR COUNT(m.id) FILTER (WHERE m.occurred_on BETWEEN $3 AND $4) > 0
     ORDER BY lower(p.name)`,
    [shopId, userId, from, to, config.businessTimeZone],
  );
  return rows.map((r) => {
    const product = mapProduct(r);
    const closing = num(r['closing_qty']);
    const level = product.lowStockLevel;
    return {
      product,
      opening: num(r['opening_qty']),
      added: num(r['added']),
      sold: num(r['sold']),
      countDifference: num(r['count_diff']),
      adjusted: num(r['adjusted']),
      closing,
      isLowAtEnd: level !== null && hundredths(closing) <= hundredths(level),
      value: product.costPrice !== null && closing > 0 ? Math.round(closing * product.costPrice * 100) / 100 : null,
    };
  });
}

export interface CountReportLine { productName: string; unit: string; occurredOn: string; counted: number; difference: number }

export async function getCountsInPeriod(shopId: string, userId: string, from: string, to: string): Promise<CountReportLine[]> {
  const { rows } = await db.query(
    `SELECT p.name, p.unit, m.occurred_on, m.counted, m.change
     FROM stock_movements m JOIN products p ON p.id = m.product_id
     WHERE m.shop_id = $1 AND m.user_id = $2 AND m.kind = 'count' AND m.occurred_on BETWEEN $3 AND $4
     ORDER BY m.occurred_on, m.created_at`,
    [shopId, userId, from, to],
  );
  return rows.map((r) => ({
    productName: r['name'] as string, unit: r['unit'] as string, occurredOn: r['occurred_on'] as string,
    counted: num(r['counted']), difference: num(r['change']),
  }));
}

// ── Mapping ──────────────────────────────────────────────────

function mapProduct(row: Record<string, unknown>): Product {
  const quantity = num(row['quantity']);
  const lowStockLevel = numOrNull(row['low_stock_level']);
  return {
    id: row['id'] as string,
    shopId: row['shop_id'] as string,
    name: row['name'] as string,
    unit: row['unit'] as string,
    quantity,
    lowStockLevel,
    costPrice: numOrNull(row['cost_price']),
    sellingPrice: numOrNull(row['selling_price']),
    isLow: row['archived_at'] === null && lowStockLevel !== null && hundredths(quantity) <= hundredths(lowStockLevel),
    lastCountedOn: (row['last_counted_on'] as string | null) ?? null,
    archived: row['archived_at'] !== null,
    createdAt: row['created_at'] as Date,
    updatedAt: row['updated_at'] as Date,
  };
}

function mapMovement(row: Record<string, unknown>): StockMovement {
  return {
    id: row['id'] as string,
    productId: row['product_id'] as string,
    productName: row['product_name'] as string | undefined,
    kind: row['kind'] as StockMovementKind,
    change: num(row['change']),
    counted: numOrNull(row['counted']),
    transactionId: (row['transaction_id'] as string | null) ?? null,
    note: (row['note'] as string | null) ?? null,
    occurredOn: row['occurred_on'] as string,
    createdAt: row['created_at'] as Date,
  };
}
