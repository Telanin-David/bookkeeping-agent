import path from 'path';
import PDFDocument from 'pdfkit';

// fontkit ships no type definitions; only glyph lookup is needed here.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fontkit = require('fontkit') as { openSync(file: string): { hasGlyphForCodePoint(cp: number): boolean } };

const FONT_DIR = path.join(__dirname, '..', '..', '..', 'assets', 'fonts');

export type Weight = 'regular' | 'semibold' | 'bold';

// Geist (the web app's font) sets the text. It has no ₦ and misses some Yoruba/Igbo
// letters (ṣ), so any character it lacks is drawn from DejaVu Sans instead — otherwise
// a customer called "Ṣadé" would print with an empty box.
const PRIMARY: Record<Weight, string> = {
  regular: 'Geist-Regular.ttf', semibold: 'Geist-SemiBold.ttf', bold: 'Geist-Bold.ttf',
};
const FALLBACK: Record<Weight, string> = {
  regular: 'DejaVuSans.ttf', semibold: 'DejaVuSans-Bold.ttf', bold: 'DejaVuSans-Bold.ttf',
};
const primaryGlyphs = fontkit.openSync(path.join(FONT_DIR, PRIMARY.regular));

export const INK = '#111111';
export const MUTED = '#6b6b6b';
export const FAINT = '#9a9a9a';
export const RULE = '#dcdcd8';
export const PANEL = '#f4f4f1';

interface TextOptions {
  size?: number;
  weight?: Weight;
  color?: string;
  /** With `width`, aligns the text within [x, x + width]. */
  align?: 'left' | 'right' | 'center';
  width?: number;
}

/**
 * Thin layer over PDFKit that draws single lines with per-character font fallback and
 * measures text the same way, so tables line up. Coordinates are in points from the top-left.
 */
export class Pdf {
  readonly doc: PDFKit.PDFDocument;

  constructor(options: PDFKit.PDFDocumentOptions) {
    this.doc = new PDFDocument({ ...options, autoFirstPage: true, info: { Producer: 'Bookkeeping AI', ...options.info } });
    for (const w of Object.keys(PRIMARY) as Weight[]) {
      this.doc.registerFont(`p-${w}`, path.join(FONT_DIR, PRIMARY[w]));
      this.doc.registerFont(`f-${w}`, path.join(FONT_DIR, FALLBACK[w]));
    }
  }

  get pageWidth() { return this.doc.page.width; }
  get pageHeight() { return this.doc.page.height; }

  /** Splits text into runs that one font can draw. */
  private runs(text: string, weight: Weight): { font: string; text: string }[] {
    const out: { font: string; text: string }[] = [];
    for (const ch of text) {
      const font = primaryGlyphs.hasGlyphForCodePoint(ch.codePointAt(0)!) ? `p-${weight}` : `f-${weight}`;
      const last = out[out.length - 1];
      if (last && last.font === font) last.text += ch;
      else out.push({ font, text: ch });
    }
    return out;
  }

  width(text: string, size = 10, weight: Weight = 'regular'): number {
    let w = 0;
    for (const r of this.runs(text, weight)) w += this.doc.font(r.font).fontSize(size).widthOfString(r.text);
    return w;
  }

  /** Draws one line of text (no wrapping) and returns its width. */
  text(text: string, x: number, y: number, opts: TextOptions = {}): number {
    const size = opts.size ?? 10;
    const weight = opts.weight ?? 'regular';
    const total = this.width(text, size, weight);
    let cx = x;
    if (opts.width !== undefined && opts.align === 'right') cx = x + opts.width - total;
    if (opts.width !== undefined && opts.align === 'center') cx = x + (opts.width - total) / 2;
    this.doc.fillColor(opts.color ?? INK);
    for (const r of this.runs(text, weight)) {
      this.doc.font(r.font).fontSize(size).text(r.text, cx, y, { lineBreak: false });
      cx += this.doc.widthOfString(r.text);
    }
    return total;
  }

  /** Shortens text with "…" so it fits in `maxWidth`. */
  fit(text: string, maxWidth: number, size = 10, weight: Weight = 'regular'): string {
    if (this.width(text, size, weight) <= maxWidth) return text;
    const chars = [...text];
    while (chars.length > 1 && this.width(chars.join('') + '…', size, weight) > maxWidth) chars.pop();
    return chars.join('').trimEnd() + '…';
  }

  /** Word-wraps text into lines no wider than `maxWidth`. */
  wrap(text: string, maxWidth: number, size = 10, weight: Weight = 'regular'): string[] {
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (this.width(candidate, size, weight) <= maxWidth) { line = candidate; continue; }
      if (line) lines.push(line);
      // A single word longer than the line is shortened rather than overflowing.
      line = this.width(word, size, weight) <= maxWidth ? word : this.fit(word, maxWidth, size, weight);
    }
    if (line) lines.push(line);
    return lines;
  }

  line(x1: number, y1: number, x2: number, y2: number, color = RULE, width = 0.75, dash?: number) {
    this.doc.save().lineWidth(width).strokeColor(color);
    if (dash) this.doc.dash(dash, { space: dash });
    this.doc.moveTo(x1, y1).lineTo(x2, y2).stroke();
    this.doc.restore();
  }

  rect(x: number, y: number, w: number, h: number, fill: string, radius = 6) {
    this.doc.save().roundedRect(x, y, w, h, radius).fill(fill).restore();
  }

  /** Draws an image scaled to fit the box; skips silently if the file can't be read. */
  image(buffer: Buffer | null, x: number, y: number, w: number, h: number, align: 'left' | 'center' = 'left'): boolean {
    if (!buffer) return false;
    try {
      this.doc.image(buffer, x, y, { fit: [w, h], align: align === 'center' ? 'center' : undefined, valign: 'center' });
      return true;
    } catch {
      return false; // corrupt or unsupported image: the document is still useful without it
    }
  }

  /** Finishes the document and returns its bytes. */
  toBuffer(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      this.doc.on('data', (c: Buffer) => chunks.push(c));
      this.doc.on('end', () => resolve(Buffer.concat(chunks)));
      this.doc.on('error', reject);
      this.doc.end();
    });
  }
}
