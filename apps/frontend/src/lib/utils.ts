import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'NGN'): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(new Date(dateStr));
}

export function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dateStr));
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

/** Everyday names for transaction types — "receivable"/"payable" are accounting jargon. */
export function typeLabel(type: string): string {
  switch (type) {
    case 'sale':       return 'Sale';
    case 'expense':    return 'Expense';
    case 'receivable': return 'Credit sale';
    case 'payable':    return 'Bill on credit';
    default:           return capitalize(type);
  }
}
