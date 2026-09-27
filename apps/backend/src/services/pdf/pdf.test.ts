import { renderReceipt, renderProfitAndLoss, receiptStatus } from '.';
import type { ProfitFigures } from '../profit';

const figures = (f: Partial<ProfitFigures>): ProfitFigures => ({
  from: '2026-09-01', to: '2026-09-30', sales: 0, salesCount: 0, coverage: null, costOfGoodsSold: null,
  stockBought: 0, runningCosts: 0, running: [], method: 'spent', profit: 0, profitSold: null, profitSpent: 0, ...f,
});
import type { Shop, Transaction } from '../../types';

const shop: Shop = {
  id: 'shop-1', ownerId: 'user-1', name: 'Chioma Foods', type: 'food', location: 'Surulere, Lagos',
  currency: 'NGN', isActive: true, logoUrl: null, signatureUrl: null, createdAt: new Date(), updatedAt: new Date(),
};

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'a1b2c3d4-0000-0000-0000-00000000abcd', shopId: 'shop-1', userId: 'user-1', type: 'sale', amount: 45000,
    currency: 'NGN', description: '3 bags of rice', category: 'Groceries', counterparty: 'Ṣadé Ọlá',
    date: '2026-09-25', status: 'settled', amountPaid: 45000, balance: 0, aiCategorized: false,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

describe('PDF rendering', () => {
  it('renders a receipt PDF even for names and currency the main font lacks (₦, ṣ)', async () => {
    const pdf = await renderReceipt(tx(), shop, { logo: null, signature: null });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(5000); // fonts are embedded
  });

  it('survives a corrupt logo file instead of failing the receipt', async () => {
    const pdf = await renderReceipt(tx(), shop, { logo: Buffer.from('not an image'), signature: null });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('renders a Profit & Loss PDF, including an empty period', async () => {
    const full = await renderProfitAndLoss({
      shop, logo: null, from: '2026-09-01', to: '2026-09-30',
      lines: [
        { type: 'sale', category: 'Groceries', count: 3, total: 95000, unpaid: 0 },
        { type: 'receivable', category: 'Groceries', count: 1, total: 20000, unpaid: 20000 },
        { type: 'expense', category: 'Rent', costKind: 'running', count: 1, total: 25000, unpaid: 0 },
        { type: 'payable', category: 'Stock', costKind: 'stock', count: 1, total: 40000, unpaid: 40000 },
      ],
      profit: figures({ sales: 115000, stockBought: 40000, runningCosts: 25000, method: 'sold', costOfGoodsSold: 30000, coverage: 0.95, profit: 60000 }),
    });
    const bySpending = await renderProfitAndLoss({
      shop, logo: null, from: '2026-09-01', to: '2026-09-30',
      lines: [{ type: 'expense', category: 'Stock', costKind: 'stock', count: 1, total: 40000, unpaid: 0 }],
      profit: figures({ stockBought: 40000, profit: -40000 }),
    });
    const empty = await renderProfitAndLoss({ shop, logo: null, from: '2025-01-01', to: '2025-01-31', lines: [], profit: figures({}) });
    expect(bySpending.subarray(0, 5).toString()).toBe('%PDF-');
    expect(full.subarray(0, 5).toString()).toBe('%PDF-');
    expect(empty.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('labels a credit sale by what has been paid', () => {
    expect(receiptStatus(tx({ type: 'receivable', status: 'settled' }))).toBe('Paid');
    expect(receiptStatus(tx({ type: 'receivable', status: 'pending', amountPaid: 0, balance: 45000 }))).toBe('Balance due');
    expect(receiptStatus(tx({ type: 'receivable', status: 'pending', amountPaid: 5000, balance: 40000 }))).toBe('Part-paid');
    expect(receiptStatus(tx({ type: 'receivable', status: 'overdue', amountPaid: 0, balance: 45000 }))).toBe('Overdue');
  });
});
