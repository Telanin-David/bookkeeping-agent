/** Money for sentences: ₦45,000, not ₦45,000.00. Kobo only when there are some on a small amount. */
export function amount(n: number, currency: string): string {
  const whole = Math.abs(n) >= 100 || Number.isInteger(n);
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency', currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2,
    }).format(whole ? Math.round(n) : n);
  } catch {
    return `${currency} ${Math.round(n).toLocaleString('en-NG')}`;
  }
}
