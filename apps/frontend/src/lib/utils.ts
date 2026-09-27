import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'NGN'): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
}

/** Whole naira (₦45,000), for figures read at a glance where kobo only get in the way. */
export function formatWhole(amount: number, currency = 'NGN'): string {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(Math.round(amount));
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(new Date(dateStr));
}

const lagosDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Today's date as 'YYYY-MM-DD' in Lagos — the shop's day, whatever the device clock's zone. */
const shortDateFmt = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** '2026-09-27' -> '27 Sept', the same on every phone whatever its time zone. */
export function formatShortDate(iso: string): string {
  return shortDateFmt.format(new Date(`${iso}T00:00:00Z`));
}

export function todayInLagos(): string {
  return lagosDay.format(new Date());
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
