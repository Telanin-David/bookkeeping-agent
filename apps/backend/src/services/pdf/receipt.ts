import type { Shop, Transaction } from '../../types';
import { Pdf, INK, MUTED, FAINT, RULE } from './layout';
import { money, day, time, capitalize } from './format';
import { todayIso } from '../../utils/dates';

// 80 mm — the width of a standard receipt printer roll, and a comfortable shape to
// read when the PDF is shared on WhatsApp.
const WIDTH = 226.77;
const PAD = 18;
const INNER = WIDTH - PAD * 2;

/** Same numbering the web receipt shows, so a printed copy matches the screen. */
export function receiptNumber(tx: Transaction): string {
  const prefix = tx.type === 'receivable' ? 'INV' : 'RCT';
  return `${prefix}-${tx.id.replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase()}`;
}

export function receiptStatus(tx: Transaction): string {
  if (tx.status === 'settled') return 'Paid';
  if (tx.status === 'overdue') return tx.amountPaid > 0 ? 'Part-paid, overdue' : 'Overdue';
  if (tx.amountPaid > 0) return 'Part-paid';
  return 'Balance due';
}

export interface ReceiptImages { logo: Buffer | null; signature: Buffer | null }

/** Lays the receipt out top to bottom and returns the height used. */
function draw(pdf: Pdf, tx: Transaction, shop: Shop, images: ReceiptImages): number {
  const isInvoice = tx.type === 'receivable';
  let y = PAD + 4;

  const rule = () => { y += 10; pdf.line(PAD, y, WIDTH - PAD, y, RULE, 0.75, 2); y += 12; };
  const row = (label: string, value: string, strong = false) => {
    pdf.text(label, PAD, y, { size: 8.5, color: MUTED });
    const v = pdf.fit(value, INNER * 0.62, 8.5, strong ? 'semibold' : 'regular');
    pdf.text(v, PAD, y, { size: 8.5, weight: strong ? 'semibold' : 'regular', align: 'right', width: INNER });
    y += 14;
  };

  if (pdf.image(images.logo, PAD, y, INNER, 40, 'center')) y += 48;
  for (const line of pdf.wrap(shop.name, INNER, 15, 'bold')) {
    pdf.text(line, PAD, y, { size: 15, weight: 'bold', align: 'center', width: INNER });
    y += 19;
  }
  const sub = [shop.location, capitalize(shop.type)].filter(Boolean).join(' · ');
  pdf.text(pdf.fit(sub, INNER, 8), PAD, y, { size: 8, color: MUTED, align: 'center', width: INNER });
  y += 8;
  rule();

  pdf.text(isInvoice ? 'INVOICE' : 'RECEIPT', PAD, y, { size: 8, weight: 'semibold' });
  pdf.text(receiptNumber(tx), PAD, y, { size: 8, color: MUTED, align: 'right', width: INNER });
  y += 18;
  row('Date', day(tx.date));
  // The time is when the sale was typed in. Only show it for sales recorded on the day
  // they happened — for a back-dated sale it would look like the time of the sale.
  if (todayIso(tx.createdAt) === tx.date) row('Time', time(tx.createdAt));
  row('Customer', tx.counterparty?.trim() || 'Walk-in customer');
  if (isInvoice && tx.dueDate) row('Due', day(tx.dueDate));
  y -= 4;
  rule();

  const amount = money(tx.amount, tx.currency);
  const amountWidth = pdf.width(amount, 9.5);
  const descLines = pdf.wrap(tx.description?.trim() || 'Item', INNER - amountWidth - 12, 9.5, 'semibold');
  pdf.text(amount, PAD, y, { size: 9.5, align: 'right', width: INNER });
  for (const line of descLines) { pdf.text(line, PAD, y, { size: 9.5, weight: 'semibold' }); y += 13; }
  if (tx.category) { pdf.text(pdf.fit(tx.category, INNER - amountWidth - 12, 8), PAD, y, { size: 8, color: MUTED }); y += 12; }
  y -= 4;
  rule();

  pdf.text('TOTAL', PAD, y + 3, { size: 9, weight: 'semibold' });
  pdf.text(amount, PAD, y, { size: 14, weight: 'semibold', align: 'right', width: INNER });
  y += 24;
  // A part-paid invoice shows how much has come in and what is left.
  if (isInvoice && tx.amountPaid > 0 && tx.balance > 0) {
    row('Paid so far', money(tx.amountPaid, tx.currency));
    row('Balance due', money(tx.balance, tx.currency), true);
  }
  row('Status', receiptStatus(tx), true);

  if (isInvoice) {
    y += 14;
    pdf.image(images.signature, PAD, y, 110, 34);
    y += 38;
    pdf.line(PAD, y, PAD + 120, y, INK, 0.6);
    y += 5;
    pdf.text('Authorised signature', PAD, y, { size: 7.5, color: MUTED });
    y += 10;
  }
  y -= 4;
  rule();

  pdf.text('Thank you for your patronage.', PAD, y, { size: 8.5, color: INK, align: 'center', width: INNER });
  y += 13;
  pdf.text(`Issued ${day(todayIso())} · Bookkeeping AI`, PAD, y, { size: 7, color: FAINT, align: 'center', width: INNER });
  return y + 10 + PAD;
}

export async function renderReceipt(tx: Transaction, shop: Shop, images: ReceiptImages): Promise<Buffer> {
  // The page is exactly as tall as the receipt: measure on a scratch page first, then draw.
  const scratch = new Pdf({ size: [WIDTH, 2000], margin: 0 });
  const height = Math.ceil(draw(scratch, tx, shop, images));
  scratch.doc.end();

  const title = `${tx.type === 'receivable' ? 'Invoice' : 'Receipt'} ${receiptNumber(tx)} — ${shop.name}`;
  const pdf = new Pdf({ size: [WIDTH, height], margin: 0, info: { Title: title, Author: shop.name } });
  draw(pdf, tx, shop, images);
  return pdf.toBuffer();
}
