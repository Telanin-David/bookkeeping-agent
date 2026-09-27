import type { Shop } from '../../types';
import { Pdf, INK, MUTED, FAINT, RULE, PANEL, type Weight } from './layout';
import { dateTime, capitalize } from './format';

// A4 portrait.
const MARGIN = 48;
const FOOTER_SPACE = 40;

export interface Column {
  label: string;
  width: number;          // share of the content width; shares are normalised
  align?: 'left' | 'right';
}

/** A cell is plain text, or text with a style for emphasis. */
export type Cell = string | { text: string; weight?: Weight; color?: string };

/**
 * An A4 report page flow: a header with the shop's branding, then content that moves
 * down the page and continues on new pages (tables repeat their header row).
 */
export class Report {
  readonly pdf: Pdf;
  y = MARGIN;
  private readonly contentWidth: number;

  constructor(private readonly shop: Shop, private readonly title: string, private readonly subtitle: string, logo: Buffer | null) {
    this.pdf = new Pdf({ size: 'A4', margin: 0, bufferPages: true, info: { Title: `${title} — ${shop.name}`, Author: shop.name } });
    this.contentWidth = this.pdf.pageWidth - MARGIN * 2;
    this.header(logo);
  }

  private get bottom() { return this.pdf.pageHeight - MARGIN - FOOTER_SPACE; }

  private header(logo: Buffer | null) {
    const { pdf } = this;
    const top = this.y;
    let textX = MARGIN;
    if (pdf.image(logo, MARGIN, top, 90, 44)) textX = MARGIN + 102;

    // The shop name gets whatever the title block on the right leaves, over up to two lines.
    const titleWidth = Math.max(pdf.width(this.title, 18, 'bold'), pdf.width(this.subtitle, 9));
    const leftWidth = MARGIN + this.contentWidth - titleWidth - 24 - textX;
    const nameLines = pdf.wrap(this.shop.name, leftWidth, 14, 'bold').slice(0, 2);
    if (pdf.wrap(this.shop.name, leftWidth, 14, 'bold').length > 2) {
      nameLines[1] = pdf.fit(`${nameLines[1]}…`, leftWidth, 14, 'bold');
    }
    let ny = top + (nameLines.length > 1 ? 0 : 6);
    for (const line of nameLines) { pdf.text(line, textX, ny, { size: 14, weight: 'bold' }); ny += 18; }
    const sub = [this.shop.location, capitalize(this.shop.type)].filter(Boolean).join(' · ');
    pdf.text(pdf.fit(sub, leftWidth, 8.5), textX, ny + 2, { size: 8.5, color: MUTED });

    pdf.text(this.title, MARGIN, top + 2, { size: 18, weight: 'bold', align: 'right', width: this.contentWidth });
    pdf.text(this.subtitle, MARGIN, top + 26, { size: 9, color: MUTED, align: 'right', width: this.contentWidth });

    this.y = Math.max(top + 58, ny + 22);
    pdf.line(MARGIN, this.y, MARGIN + this.contentWidth, this.y, INK, 1);
    this.y += 20;
  }

  /** Starts a new page when fewer than `needed` points remain. Returns true if it did. */
  ensure(needed: number): boolean {
    if (this.y + needed <= this.bottom) return false;
    this.pdf.doc.addPage({ size: 'A4', margin: 0 });
    this.y = MARGIN;
    return true;
  }

  /** A row of highlighted figures, e.g. Income / Costs / Net profit. */
  summary(items: { label: string; value: string; note?: string }[]) {
    const { pdf } = this;
    const gap = 10;
    const w = (this.contentWidth - gap * (items.length - 1)) / items.length;
    const h = items.some((i) => i.note) ? 66 : 54;
    this.ensure(h + 10);
    items.forEach((item, i) => {
      const x = MARGIN + i * (w + gap);
      pdf.rect(x, this.y, w, h, PANEL);
      pdf.text(item.label.toUpperCase(), x + 12, this.y + 11, { size: 7.5, weight: 'semibold', color: MUTED });
      pdf.text(pdf.fit(item.value, w - 24, 15, 'semibold'), x + 12, this.y + 25, { size: 15, weight: 'semibold' });
      if (item.note) pdf.text(pdf.fit(item.note, w - 24, 7.5), x + 12, this.y + 47, { size: 7.5, color: MUTED });
    });
    this.y += h + 22;
  }

  heading(text: string, note?: string) {
    this.ensure(60);
    this.pdf.text(text, MARGIN, this.y, { size: 11.5, weight: 'semibold' });
    if (note) this.pdf.text(note, MARGIN, this.y + 2, { size: 8, color: MUTED, align: 'right', width: this.contentWidth });
    this.y += 20;
  }

  /** Draws a table; long tables continue on the next page with the header repeated. */
  table(columns: Column[], rows: Cell[][], opts: { totalRow?: Cell[] } = {}) {
    const { pdf } = this;
    const share = columns.reduce((s, c) => s + c.width, 0);
    const widths = columns.map((c) => (c.width / share) * this.contentWidth);
    const xs = widths.map((_, i) => MARGIN + widths.slice(0, i).reduce((s, w) => s + w, 0));
    const CELL_PAD = 6;
    const ROW_H = 20;

    const headerRow = () => {
      columns.forEach((c, i) => {
        pdf.text(c.label.toUpperCase(), xs[i]! + (i === 0 ? 0 : CELL_PAD), this.y, {
          size: 7, weight: 'semibold', color: MUTED, align: c.align ?? 'left', width: widths[i]! - (i === 0 ? CELL_PAD : CELL_PAD * 2) + (i === columns.length - 1 ? CELL_PAD : 0),
        });
      });
      this.y += 13;
      pdf.line(MARGIN, this.y, MARGIN + this.contentWidth, this.y, INK, 0.75);
      this.y += 6;
    };

    const drawRow = (cells: Cell[], isTotal = false) => {
      cells.forEach((cell, i) => {
        const c = typeof cell === 'string' ? { text: cell } : cell;
        const weight = c.weight ?? (isTotal ? 'semibold' : 'regular');
        const left = xs[i]! + (i === 0 ? 0 : CELL_PAD);
        const width = widths[i]! - (i === 0 ? CELL_PAD : CELL_PAD * 2) + (i === columns.length - 1 ? CELL_PAD : 0);
        pdf.text(pdf.fit(c.text, width, 9, weight), left, this.y, {
          size: 9, weight, color: c.color ?? INK, align: columns[i]!.align ?? 'left', width,
        });
      });
    };

    this.ensure(ROW_H * 2 + 20);
    headerRow();
    for (const cells of rows) {
      if (this.ensure(ROW_H)) headerRow();
      drawRow(cells);
      this.y += ROW_H - 6;
      pdf.line(MARGIN, this.y, MARGIN + this.contentWidth, this.y, RULE, 0.5);
      this.y += 6;
    }
    if (opts.totalRow) {
      if (this.ensure(ROW_H + 4)) headerRow();
      this.y += 2;
      drawRow(opts.totalRow, true);
      this.y += ROW_H;
    }
    this.y += 14;
  }

  /** A labelled line with a right-aligned amount, e.g. "Net profit ...... ₦120,000". */
  keyLine(label: string, value: string, opts: { size?: number; weight?: Weight; color?: string; indent?: number } = {}) {
    const size = opts.size ?? 9.5;
    this.ensure(size + 10);
    const x = MARGIN + (opts.indent ?? 0);
    this.pdf.text(label, x, this.y, { size, weight: opts.weight, color: opts.color });
    this.pdf.text(value, MARGIN, this.y, { size, weight: opts.weight, color: opts.color, align: 'right', width: this.contentWidth });
    this.y += size + 8;
  }

  rule(color = RULE) {
    this.pdf.line(MARGIN, this.y, MARGIN + this.contentWidth, this.y, color, color === INK ? 1 : 0.75);
    this.y += 10;
  }

  paragraph(text: string, opts: { size?: number; color?: string } = {}) {
    const size = opts.size ?? 8.5;
    for (const line of this.pdf.wrap(text, this.contentWidth, size)) {
      this.ensure(size + 6);
      this.pdf.text(line, MARGIN, this.y, { size, color: opts.color ?? MUTED });
      this.y += size + 4.5;
    }
    this.y += 6;
  }

  empty(text: string) {
    this.ensure(50);
    this.pdf.rect(MARGIN, this.y, this.contentWidth, 44, PANEL);
    this.pdf.text(text, MARGIN, this.y + 16, { size: 9.5, color: MUTED, align: 'center', width: this.contentWidth });
    this.y += 64;
  }

  /** Adds the footer to every page and returns the finished PDF. */
  finish(): Promise<Buffer> {
    const { pdf } = this;
    const range = pdf.doc.bufferedPageRange();
    const generated = `${this.shop.name} · ${this.title} · generated ${dateTime(new Date())} · Bookkeeping AI`;
    for (let i = 0; i < range.count; i++) {
      pdf.doc.switchToPage(range.start + i);
      const fy = pdf.pageHeight - MARGIN;
      pdf.line(MARGIN, fy - 8, MARGIN + this.contentWidth, fy - 8, RULE, 0.5);
      pdf.text(pdf.fit(generated, this.contentWidth - 70, 7), MARGIN, fy, { size: 7, color: FAINT });
      pdf.text(`Page ${i + 1} of ${range.count}`, MARGIN, fy, { size: 7, color: FAINT, align: 'right', width: this.contentWidth });
    }
    return pdf.toBuffer();
  }
}
