import type { Transaction, TransactionType, TransactionStatus } from '@/types';

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
): Transaction {
  const at = new Date(Date.now() - hoursAgo * HOUR).toISOString();
  return {
    id, shopId: DEMO_SHOP_ID, userId: 'demo-user-1', type, status, amount,
    currency: 'NGN', description, category, counterparty, date: at,
    dueDate: type === 'receivable' ? new Date(Date.now() + 14 * DAY).toISOString() : undefined,
    aiCategorized: true, createdAt: at, updatedAt: at,
  };
}

export const DEMO_TRANSACTIONS: Transaction[] = [
  tx('7f3a9c21-5b8e-4d62-9a14-c83e5f02b6d1', 2,   'income',     'completed', 160000, '20 bags of rice',             'Groceries', 'Mama Nkechi'),
  tx('2c8e1f04-9d3b-4a57-8e61-4b0d7a93c2e8', 5,   'income',     'completed', 42500,  'Groundnut oil, 5 × 5L',       'Groceries', 'Chinedu Okafor'),
  tx('9b4d6e12-3f7a-4c85-b2d9-1e6a8c4f7b03', 26,  'receivable', 'pending',   95000,  '10 bags of beans on credit',  'Groceries', 'Alhaji Musa'),
  tx('5e1c7a38-8b2f-4d96-a4e3-7c9b2d05f1a6', 30,  'income',     'completed', 8400,   'Sugar and powdered milk',     'Provisions'),
  tx('d6a2b9f7-1c4e-4b38-9f05-2a7e6c3d8b14', 50,  'expense',    'completed', 45000,  'Shop rent, September',        'Rent',      'Landlord'),
  tx('3a7f5c90-6e1d-4f28-8b47-9d2c1a6e4f85', 74,  'income',     'completed', 26000,  'Indomie noodles, 4 cartons',  'Provisions', 'Blessing Store'),
  tx('8c5e3b16-4a9d-4e71-a6f2-5b8d0c7e2a49', 98,  'expense',    'completed', 80000,  'Staff wages',                 'Wages'),
];

export function findDemoTransaction(id: string): Transaction {
  const found = DEMO_TRANSACTIONS.find((t) => t.id === id);
  if (!found) throw new Error('Transaction not found');
  return found;
}
