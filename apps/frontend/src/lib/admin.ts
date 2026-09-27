// Formatting for the business dashboard. AI is billed in US dollars, so costs stay in dollars.

/** Under 10 cents in cents (0.7¢, 1.0¢), otherwise dollars ($1.25). */
export function usd(n: number): string {
  if (n > 0 && n < 0.1) return `${(n * 100).toFixed(1)}¢`;
  return `$${n.toFixed(2)}`;
}

/** 2495 -> '2,495'. */
export function count(n: number): string {
  return n.toLocaleString('en-NG');
}

const dayFmt = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** '2026-09-27' -> '27 Sept', the same on every device whatever its time zone. */
export function shortDay(iso: string): string {
  return dayFmt.format(new Date(`${iso}T00:00:00Z`));
}

/** 1 in 20 -> '5%'; below 10% keeps one decimal. */
export function percent(part: number, whole: number): string {
  const p = (part / whole) * 100;
  return `${p < 10 && p > 0 ? p.toFixed(1).replace(/\.0$/, '') : Math.round(p)}%`;
}
