import type { CostKind, TransactionType } from '../types';

// When nobody said whether money spent was on goods to resell or on running the business
// (a spreadsheet import), the words decide. Anything unclear is a running cost: that is
// what the owner can see and fix on the transaction.
const STOCK_WORDS = /\b(stock|restock|goods|inventory|merchandise|resale|for sale|to sell)\b/i;

export function guessCostKind(type: TransactionType, category?: string | null, description?: string | null): CostKind | undefined {
  if (type !== 'expense' && type !== 'payable') return undefined;
  return STOCK_WORDS.test(`${category ?? ''} ${description ?? ''}`) ? 'stock' : 'running';
}
