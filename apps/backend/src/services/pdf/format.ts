import { config } from '../../config';

export function money(amount: number, currency = 'NGN'): string {
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  } catch {
    // An unrecognised currency code shouldn't stop the document from printing.
    return `${currency} ${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

const dayFmt = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** '2026-09-25' → '25 Sept 2026'. Calendar dates carry no time zone, so format them in UTC. */
export function day(isoDate: string): string {
  return dayFmt.format(new Date(`${isoDate}T00:00:00Z`));
}

/** A moment (e.g. when a sale was logged) → '10:42 am' in the shop's time zone. */
export function time(at: Date): string {
  return new Intl.DateTimeFormat('en-NG', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: config.businessTimeZone }).format(at);
}

export function dateTime(at: Date): string {
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: config.businessTimeZone,
  }).format(at);
}

const shortDayFmt = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** For narrow table columns: '17 Sept' — the year is added only when it differs from the reference date's. */
export function shortDay(isoDate: string, refIsoDate: string): string {
  return isoDate.slice(0, 4) === refIsoDate.slice(0, 4) ? shortDayFmt.format(new Date(`${isoDate}T00:00:00Z`)) : day(isoDate);
}

export function period(from: string, to: string): string {
  return from === to ? day(from) : `${day(from)} – ${day(to)}`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
