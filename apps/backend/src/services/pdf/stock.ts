import type { Shop } from '../../types';
import type { CountReportLine, StockReportLine } from '../stock';
import { Report, type Cell } from './report';
import { MUTED } from './layout';
import { money, day, shortDay, period } from './format';
import { formatQuantity, pluralUnit, quantityText } from '../../utils/quantity';

export interface StockReportInput {
  shop: Shop;
  logo: Buffer | null;
  from: string;
  to: string;
  /** End of the period, or today if the period hasn't ended yet. */
  asOf: string;
  lines: StockReportLine[];
  counts: CountReportLine[];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** '+5', '−2', or a muted dash for no change. */
function signed(n: number): Cell {
  if (Math.round(n * 100) === 0) return { text: '—', color: MUTED };
  return n > 0 ? `+${formatQuantity(n)}` : `−${formatQuantity(-n)}`;
}

function plain(n: number): Cell {
  return Math.round(n * 100) === 0 ? { text: '0', color: MUTED } : formatQuantity(n);
}

function countResult(line: CountReportLine): Cell {
  const d = line.difference;
  if (Math.round(d * 100) === 0) return { text: 'Matched', color: MUTED };
  return d < 0
    ? { text: `${quantityText(-d, line.unit)} missing`, weight: 'semibold' }
    : `${quantityText(d, line.unit)} more than recorded`;
}

export async function renderStockReport({ shop, logo, from, to, asOf, lines, counts }: StockReportInput): Promise<Buffer> {
  const c = shop.currency;
  const report = new Report(shop, 'Stock Report', period(from, to), logo);

  const out = lines.filter((l) => l.isLowAtEnd && Math.round(l.closing * 100) <= 0);
  const low = lines.filter((l) => l.isLowAtEnd && Math.round(l.closing * 100) > 0);
  const valued = lines.filter((l) => l.value !== null);
  const value = valued.reduce((s, l) => s + (l.value ?? 0), 0);
  const unpriced = lines.filter((l) => l.product.costPrice === null && l.closing > 0).length;
  const shortCounts = counts.filter((l) => Math.round(l.difference * 100) < 0);

  report.summary([
    { label: 'Products', value: String(lines.length), note: lines.length ? `${low.length} running low, ${out.length} out of stock` : undefined },
    {
      label: 'Stock value', value: money(value, c),
      note: unpriced > 0 ? `at cost; ${plural(unpriced, 'product')} with no cost price` : `at cost price, ${day(asOf)}`,
    },
    { label: 'Shelf counts', value: String(counts.length), note: counts.length ? `${plural(shortCounts.length, 'count')} found items missing` : 'none in this period' },
  ]);

  if (lines.length === 0) {
    report.empty('No products yet. Add your products in Stock to track what is on your shelves.');
    return report.finish();
  }

  if (out.length || low.length) {
    report.heading('Running low', `On ${day(asOf)}`);
    report.table(
      [{ label: 'Product', width: 4.4 }, { label: 'On hand', width: 2.2, align: 'right' }, { label: 'Warn at', width: 2, align: 'right' }, { label: 'Status', width: 2.4 }],
      [...out, ...low].map((l) => [
        l.product.name,
        quantityText(l.closing, l.product.unit),
        l.product.lowStockLevel !== null ? formatQuantity(l.product.lowStockLevel) : '—',
        Math.round(l.closing * 100) <= 0 ? { text: 'Out of stock', weight: 'semibold' } : { text: 'Running low', weight: 'semibold' },
      ]),
    );
  }

  report.heading('Stock movement', 'Quantities in each product’s own unit');
  report.table(
    [
      { label: 'Product', width: 3.6 }, { label: 'Start', width: 1.2, align: 'right' }, { label: 'In', width: 1.2, align: 'right' },
      { label: 'Sold', width: 1.2, align: 'right' }, { label: 'Counts', width: 1.3, align: 'right' }, { label: 'Other', width: 1.2, align: 'right' },
      { label: 'End', width: 1.3, align: 'right' }, { label: 'Value', width: 2.2, align: 'right' },
    ],
    lines.map((l) => [
      l.product.archived ? `${l.product.name} (removed)` : `${l.product.name} · ${pluralUnit(l.product.unit)}`,
      plain(l.opening), signed(l.added), l.sold ? formatQuantity(l.sold) : { text: '—', color: MUTED },
      signed(l.countDifference), signed(l.adjusted),
      { text: formatQuantity(l.closing), weight: 'semibold' },
      l.value !== null ? money(l.value, c) : { text: '—', color: MUTED },
    ]),
    { totalRow: ['Total', '', '', '', '', '', '', money(value, c)] },
  );

  report.heading('Shelf counts', period(from, to));
  if (counts.length === 0) {
    report.empty('No shelf counts in this period. Counting your shelves regularly shows up missing stock early.');
  } else {
    report.table(
      [{ label: 'Date', width: 1.6 }, { label: 'Product', width: 4 }, { label: 'Counted', width: 2.2, align: 'right' }, { label: 'Result', width: 3.6 }],
      counts.map((l) => [shortDay(l.occurredOn, to), l.productName, quantityText(l.counted, l.unit), countResult(l)]),
    );
  }

  report.paragraph(
    'Start and End are what the records show on the first and last day. In is stock bought or added; Sold comes from sales ' +
    'recorded with products; Counts is the difference found when the shelf was counted (− means missing); Other is stock ' +
    'removed or added by hand, for example damaged or expired goods. Value is End × cost price.',
  );
  return report.finish();
}
