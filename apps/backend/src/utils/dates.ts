import { config } from '../config';

// Transaction dates are calendar days in the shop's own time zone. Taking "today" from
// UTC (new Date().toISOString()) is a day behind in Lagos between midnight and 1am.

/** Today's date in the business time zone, as 'YYYY-MM-DD'. */
export function todayIso(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: config.businessTimeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

/** Adds (or subtracts) whole days to a 'YYYY-MM-DD' date. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `fromIso` to `toIso` (positive when `toIso` is later). */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}
