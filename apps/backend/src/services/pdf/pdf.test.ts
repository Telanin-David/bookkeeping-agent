import { renderReceipt, renderProfitAndLoss, receiptStatus } from '.';
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
        { type: 'expense', category: 'Rent', count: 1, total: 25000, unpaid: 0 },
      ],
    });
    const empty = await renderProfitAndLoss({ shop, logo: null, from: '2025-01-01', to: '2025-01-31', lines: [] });
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
