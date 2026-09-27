import type {
  Alert, CountLine, DebtPayment, Product, StockMovement, Transaction, TransactionType, TransactionStatus,
} from '@/types';
import { todayInLagos } from '@/lib/utils';

export const DEMO_SHOP_ID = 'demo-shop-1';
export const DEMO_USER_ID = 'demo-user-1';

export function isDemoShop(shopId: string | undefined | null) {
  return shopId === DEMO_SHOP_ID;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function tx(
  id: string, hoursAgo: number, type: TransactionType, status: TransactionStatus,
  amount: number, description: string, category: string, counterparty?: string,
  dueInDays = 14,
): Transaction {
  const at = new Date(Date.now() - hoursAgo * HOUR).toISOString();
  return {
    id, shopId: DEMO_SHOP_ID, userId: 'demo-user-1', type, status, amount,
    currency: 'NGN', description, category, counterparty, date: at,
    dueDate: type === 'receivable' ? new Date(Date.now() + dueInDays * DAY).toISOString() : undefined,
    amountPaid: status === 'settled' ? amount : 0, balance: status === 'settled' ? 0 : amount,
    aiCategorized: true, createdAt: at, updatedAt: at,
  };
}

export const DEMO_TRANSACTIONS: Transaction[] = [
  tx('7f3a9c21-5b8e-4d62-9a14-c83e5f02b6d1', 2,   'sale',       'settled', 160000, '20 bags of rice',             'Groceries', 'Mama Nkechi'),
  tx('2c8e1f04-9d3b-4a57-8e61-4b0d7a93c2e8', 5,   'sale',       'settled', 42500,  'Groundnut oil, 5 × 5L',       'Groceries', 'Chinedu Okafor'),
  tx('9b4d6e12-3f7a-4c85-b2d9-1e6a8c4f7b03', 26,  'receivable', 'pending', 95000,  '10 bags of beans on credit',  'Groceries', 'Alhaji Musa', -3),
  tx('5e1c7a38-8b2f-4d96-a4e3-7c9b2d05f1a6', 30,  'sale',       'settled', 8400,   'Sugar and powdered milk',     'Provisions'),
  tx('d6a2b9f7-1c4e-4b38-9f05-2a7e6c3d8b14', 50,  'expense',    'settled', 45000,  'Shop rent, September',        'Rent',      'Landlord'),
  tx('3a7f5c90-6e1d-4f28-8b47-9d2c1a6e4f85', 74,  'sale',       'settled', 26000,  'Indomie noodles, 4 cartons',  'Provisions', 'Blessing Store'),
  tx('8c5e3b16-4a9d-4e71-a6f2-5b8d0c7e2a49', 98,  'expense',    'settled', 80000,  'Staff wages',                 'Wages'),
];

export function findDemoTransaction(id: string): Transaction {
  const found = DEMO_TRANSACTIONS.find((t) => t.id === id);
  if (!found) throw new Error('Transaction not found');
  return found;
}

// Demo-mode payments, kept in memory like the rest of the demo data.
const demoPayments: DebtPayment[] = [];

export function listDemoPayments(txId: string): DebtPayment[] {
  return demoPayments.filter((p) => p.transactionId === txId);
}

/** Mirrors the server: pays `amount` (default: everything owed) and settles when covered. */
export function recordDemoPayment(txId: string, amount: number | undefined, paidOn: string): Transaction {
  const tx = findDemoTransaction(txId);
  const pay = amount ?? tx.balance;
  if (pay > tx.balance + 0.001) throw new Error('That’s more than is still owed.');
  demoPayments.push({ id: `demo-pay-${Date.now()}`, transactionId: txId, amount: pay, paidOn, createdAt: new Date().toISOString() });
  return syncDemoDebt(tx);
}

export function removeDemoPayment(txId: string, paymentId: string): Transaction {
  const i = demoPayments.findIndex((p) => p.id === paymentId && p.transactionId === txId);
  if (i >= 0) demoPayments.splice(i, 1);
  return syncDemoDebt(findDemoTransaction(txId));
}

function syncDemoDebt(tx: Transaction): Transaction {
  const paid = listDemoPayments(tx.id).reduce((s, p) => s + p.amount, 0);
  return updateDemoTransaction(tx.id, {
    amountPaid: paid, balance: tx.amount - paid,
    status: paid >= tx.amount ? 'settled' : tx.status === 'settled' ? 'pending' : tx.status,
  });
}

/** Demo-mode edit: changed in place so every screen sees it. */
export function updateDemoTransaction(id: string, changes: Partial<Transaction>): Transaction {
  const found = findDemoTransaction(id);
  Object.assign(found, changes, { updatedAt: new Date().toISOString() });
  return found;
}

function alert(id: string, hoursAgo: number, type: Alert['type'], status: Alert['status'], message: string): Alert {
  const at = new Date(Date.now() - hoursAgo * HOUR).toISOString();
  return { id, userId: DEMO_USER_ID, shopId: DEMO_SHOP_ID, type, status, message, metadata: {}, createdAt: at, updatedAt: at };
}

// Mutated in place when the demo user acknowledges/dismisses, so every tab (Active/Acknowledged/…) stays consistent.
export const DEMO_ALERTS: Alert[] = [
  alert('a1b2c3d4-1111-4a5b-8c9d-0e1f2a3b4c5d', 4,  'overdue_receivable', 'active', "Alhaji Musa's ₦95,000 credit balance is 3 days overdue."),
  alert('a1b2c3d4-2222-4a5b-8c9d-0e1f2a3b4c5d', 20, 'unusual_expense',    'active', 'Staff wages of ₦80,000 is higher than your usual weekly spend.'),
  alert('a1b2c3d4-3333-4a5b-8c9d-0e1f2a3b4c5d', 72, 'low_cash',           'acknowledged', 'Cash on hand dropped below ₦50,000 after Tuesday’s rent payment.'),
];

export function setDemoAlertStatus(id: string, status: Alert['status']): Alert {
  const found = DEMO_ALERTS.find((a) => a.id === id);
  if (!found) throw new Error('Alert not found');
  found.status = status;
  found.updatedAt = new Date().toISOString();
  return found;
}

// ── Demo stock ────────────────────────────────────────────────
// In memory, like the rest of the demo data. Simpler than the server: a shelf count's
// difference is fixed when it's entered.
const today = () => todayInLagos();

function product(id: string, name: string, unit: string, quantity: number, lowStockLevel: number | null, costPrice: number | null, sellingPrice: number | null): Product {
  const at = new Date(Date.now() - 30 * DAY).toISOString();
  return {
    id, shopId: DEMO_SHOP_ID, name, unit, quantity, lowStockLevel, costPrice, sellingPrice,
    isLow: lowStockLevel !== null && quantity <= lowStockLevel, lastCountedOn: null, archived: false, createdAt: at, updatedAt: at,
  };
}

const demoProducts: Product[] = [
  product('demo-prod-rice',   'Rice (50kg)',        'bag',    14, 4,  62000, 68000),
  product('demo-prod-beans',  'Beans (Oloyin)',     'bag',    3,  4,  55000, 60000),
  product('demo-prod-indomie','Indomie Super Pack', 'carton', 22, 8,  9800,  10500),
  product('demo-prod-oil',    'Groundnut oil',      'litre',  0,  10, 2100,  2500),
  product('demo-prod-sugar',  'Sugar (St Louis)',   'box',    9,  3,  1500,  1800),
];
const demoMovements: StockMovement[] = demoProducts.map((p) => ({
  id: `demo-mv-${p.id}`, productId: p.id, productName: p.name, kind: 'opening', change: p.quantity,
  counted: null, transactionId: null, note: null, occurredOn: p.createdAt.slice(0, 10), createdAt: p.createdAt,
}));

function findDemoProduct(id: string): Product {
  const found = demoProducts.find((p) => p.id === id && !p.archived);
  if (!found) throw new Error('Product not found');
  return found;
}

function moveDemoStock(p: Product, m: Omit<StockMovement, 'id' | 'productId' | 'productName' | 'createdAt' | 'transactionId'>): StockMovement {
  const movement: StockMovement = { ...m, id: `demo-mv-${Date.now()}-${demoMovements.length}`, productId: p.id, productName: p.name, transactionId: null, createdAt: new Date().toISOString() };
  demoMovements.push(movement);
  p.quantity = Math.round((p.quantity + m.change) * 100) / 100;
  p.isLow = p.lowStockLevel !== null && p.quantity <= p.lowStockLevel;
  p.updatedAt = movement.createdAt;
  return movement;
}

export const demoStock = {
  list: (): Product[] => demoProducts.filter((p) => !p.archived).sort((a, b) => a.name.localeCompare(b.name)),
  create(input: { name: string; unit?: string; openingQuantity?: number; lowStockLevel?: number | null; costPrice?: number | null; sellingPrice?: number | null }): Product {
    if (demoProducts.some((p) => !p.archived && p.name.toLowerCase() === input.name.trim().toLowerCase())) {
      throw new Error(`You already have a product called "${input.name.trim()}".`);
    }
    const p = product(`demo-prod-${Date.now()}`, input.name.trim(), input.unit?.trim() || 'piece', 0, input.lowStockLevel ?? null, input.costPrice ?? null, input.sellingPrice ?? null);
    demoProducts.push(p);
    if (input.openingQuantity) moveDemoStock(p, { kind: 'opening', change: input.openingQuantity, counted: null, note: null, occurredOn: today() });
    return p;
  },
  update(id: string, changes: Partial<Pick<Product, 'name' | 'unit' | 'lowStockLevel' | 'costPrice' | 'sellingPrice'>>): Product {
    const p = findDemoProduct(id);
    Object.assign(p, changes);
    p.isLow = p.lowStockLevel !== null && p.quantity <= p.lowStockLevel;
    return p;
  },
  remove(id: string): void { findDemoProduct(id).archived = true; },
  movements: (id: string): StockMovement[] =>
    demoMovements.filter((m) => m.productId === id).sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt)),
  adjust(id: string, body: { kind: 'restock' | 'adjustment'; change: number; occurredOn?: string; note?: string }) {
    const p = findDemoProduct(id);
    const movement = moveDemoStock(p, { kind: body.kind, change: body.change, counted: null, note: body.note ?? null, occurredOn: body.occurredOn ?? today() });
    return { product: p, movement };
  },
  undo(movementId: string): Product {
    const i = demoMovements.findIndex((m) => m.id === movementId);
    if (i < 0) throw new Error('Stock change not found');
    const [m] = demoMovements.splice(i, 1);
    const p = findDemoProduct(m!.productId);
    p.quantity = Math.round((p.quantity - m!.change) * 100) / 100;
    p.isLow = p.lowStockLevel !== null && p.quantity <= p.lowStockLevel;
    return p;
  },
  count(items: { productId: string; counted: number }[]): CountLine[] {
    return items.map(({ productId, counted }) => {
      const p = findDemoProduct(productId);
      const expected = p.quantity;
      const difference = Math.round((counted - expected) * 100) / 100;
      moveDemoStock(p, { kind: 'count', change: difference, counted, note: null, occurredOn: today() });
      p.lastCountedOn = today();
      return { product: { ...p }, counted, expected, difference };
    });
  },
};
