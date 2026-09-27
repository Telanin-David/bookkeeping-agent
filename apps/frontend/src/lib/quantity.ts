// Same wording as the backend (apps/backend/src/utils/quantity.ts), so screens and PDFs agree.
// Stock quantities in everyday words: "3 bags", "1 carton", "2.5 kg".

const METRIC = /^(kg|g|mg|l|ml|cl|cm|m)$/i;

/** 'bag' → 'bags', 'box' → 'boxes', 'battery' → 'batteries'; metric symbols and words already ending in s stay as they are. */
export function pluralUnit(unit: string): string {
  const u = unit.trim();
  if (METRIC.test(u) || /s$/i.test(u)) return u;
  if (/(x|ch|sh)$/i.test(u)) return `${u}es`;
  if (/[^aeiou]y$/i.test(u)) return `${u.slice(0, -1)}ies`;
  return `${u}s`;
}

/** 3 → '3', 2.5 → '2.5', 1200 → '1,200'. */
export function formatQuantity(qty: number): string {
  return qty.toLocaleString('en-NG', { maximumFractionDigits: 2 });
}

export function quantityText(qty: number, unit: string): string {
  return `${formatQuantity(qty)} ${Math.abs(qty) === 1 ? unit.trim() : pluralUnit(unit)}`;
}
