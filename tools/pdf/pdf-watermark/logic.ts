/**
 * Pure logic for the "Watermark PDF" tool: page ranges, font metrics, auto-sizing,
 * single / tiled placement and a tiny sample-PDF writer. No framework or browser
 * APIs, so everything here is unit-testable.
 */
import type { PdfStandardFont, PdfTextStamp } from '@/lib/wasm/pdf';

export const FONTS: { id: PdfStandardFont; label: string }[] = [
  { id: 'Helvetica', label: 'Helvetica' },
  { id: 'Helvetica-Bold', label: 'Helvetica Bold' },
  { id: 'Times-Roman', label: 'Times Roman' },
  { id: 'Times-Bold', label: 'Times Bold' },
  { id: 'Courier', label: 'Courier' },
  { id: 'Courier-Bold', label: 'Courier Bold' },
];

export const PRESET_TEXTS = ['CONFIDENTIAL', 'DRAFT', 'COPY', 'SAMPLE', 'DO NOT COPY'] as const;

// Adobe standard-14 AFM advance widths (1000 units/em) for WinAnsi codes 32..255; 0 = no glyph.
const W_HELVETICA: number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 0,
  556, 0, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0,
  0, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 0, 500, 667,
  278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333,
  400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611,
  667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278,
  722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
  556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500,
];
const W_HELVETICA_BOLD: number[] = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 0,
  556, 0, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0,
  0, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 0, 500, 667,
  278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333,
  400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611,
  722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278,
  722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
  556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278,
  611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611, 556,
];
const W_TIMES_ROMAN: number[] = [
  250, 333, 408, 500, 500, 833, 778, 180, 333, 333, 500, 564, 250, 333, 250, 278,
  500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 278, 278, 564, 564, 564, 444,
  921, 722, 667, 667, 722, 611, 556, 722, 722, 333, 389, 722, 611, 889, 722, 722,
  556, 722, 667, 556, 611, 722, 722, 944, 722, 722, 611, 333, 278, 333, 469, 500,
  333, 444, 500, 444, 500, 444, 333, 500, 500, 278, 278, 500, 278, 778, 500, 500,
  500, 500, 333, 389, 278, 500, 500, 722, 500, 500, 444, 480, 200, 480, 541, 0,
  500, 0, 333, 500, 444, 1000, 500, 500, 333, 1000, 556, 333, 889, 0, 611, 0,
  0, 333, 333, 444, 444, 350, 500, 1000, 333, 980, 389, 333, 722, 0, 444, 722,
  250, 333, 500, 500, 500, 500, 200, 500, 333, 760, 276, 500, 564, 333, 760, 333,
  400, 564, 300, 300, 333, 500, 453, 250, 333, 300, 310, 500, 750, 750, 750, 444,
  722, 722, 722, 722, 722, 722, 889, 667, 611, 611, 611, 611, 333, 333, 333, 333,
  722, 722, 722, 722, 722, 722, 722, 564, 722, 722, 722, 722, 722, 722, 556, 500,
  444, 444, 444, 444, 444, 444, 667, 444, 444, 444, 444, 444, 278, 278, 278, 278,
  500, 500, 500, 500, 500, 500, 500, 564, 500, 500, 500, 500, 500, 500, 500, 500,
];
const W_TIMES_BOLD: number[] = [
  250, 333, 555, 500, 500, 1000, 833, 278, 333, 333, 500, 570, 250, 333, 250, 278,
  500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 333, 333, 570, 570, 570, 500,
  930, 722, 667, 722, 722, 667, 611, 778, 778, 389, 500, 778, 667, 944, 722, 778,
  611, 778, 722, 556, 667, 722, 722, 1000, 722, 722, 667, 333, 278, 333, 581, 500,
  333, 500, 556, 444, 556, 444, 333, 500, 556, 278, 333, 556, 278, 833, 556, 500,
  556, 556, 444, 389, 333, 556, 500, 722, 500, 500, 444, 394, 220, 394, 520, 0,
  500, 0, 333, 500, 500, 1000, 500, 500, 333, 1000, 556, 333, 1000, 0, 667, 0,
  0, 333, 333, 500, 500, 350, 500, 1000, 333, 1000, 389, 333, 722, 0, 444, 722,
  250, 333, 500, 500, 500, 500, 220, 500, 333, 747, 300, 500, 570, 333, 747, 333,
  400, 570, 300, 300, 333, 556, 540, 250, 333, 300, 330, 500, 750, 750, 750, 500,
  722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 389, 389, 389, 389,
  722, 722, 778, 778, 778, 778, 778, 570, 778, 722, 722, 722, 722, 722, 611, 556,
  500, 500, 500, 500, 500, 500, 722, 444, 444, 444, 444, 444, 278, 278, 278, 278,
  500, 556, 500, 500, 500, 500, 500, 570, 500, 556, 556, 556, 556, 500, 556, 500,
];

/** Unicode code points of the cp1252 0x80-0x9F block, as WinAnsi code -> char code. */
const WIN_ANSI_HIGH: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
  0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91,
  0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98,
  0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

function widthTable(font: PdfStandardFont): number[] | null {
  switch (font) {
    case 'Helvetica':
      return W_HELVETICA;
    case 'Helvetica-Bold':
      return W_HELVETICA_BOLD;
    case 'Times-Roman':
      return W_TIMES_ROMAN;
    case 'Times-Bold':
      return W_TIMES_BOLD;
    case 'Courier':
    case 'Courier-Bold':
      return null;
  }
}

/** Cap height as a fraction of the font size (from the standard AFM metrics). */
const CAP_HEIGHT: Record<PdfStandardFont, number> = {
  Helvetica: 0.718,
  'Helvetica-Bold': 0.718,
  'Times-Roman': 0.662,
  'Times-Bold': 0.676,
  Courier: 0.562,
  'Courier-Bold': 0.562,
};

export function capHeight(font: PdfStandardFont): number {
  return CAP_HEIGHT[font];
}

/** Text width in ems (multiply by the font size for points), using the real AFM advance widths. */
export function textWidthEm(text: string, font: PdfStandardFont): number {
  const table = widthTable(font);
  let units = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 63;
    let code = cp;
    if (cp > 255) code = WIN_ANSI_HIGH[cp] ?? 63; // unsupported -> "?"
    else if (cp >= 0x80 && cp <= 0x9f) code = 63;
    if (code < 32) code = 63;
    if (!table) {
      units += 600;
      continue;
    }
    let w = table[code - 32] ?? 0;
    if (w === 0) w = table[63 - 32] ?? 556;
    units += w;
  }
  return units / 1000;
}

// ---------------------------------------------------------------------------
// Page ranges, colours, characters
// ---------------------------------------------------------------------------

export type PageRangeResult =
  | { ok: true; pages: Set<number> | null; count: number }
  | { ok: false; error: string };

/**
 * Parse "2-10", "1,3,5-8", "4-" (4 to the end) or "-3" (first three) into a set of
 * 1-based page numbers. A blank spec means "all pages" (`pages: null`).
 */
export function parsePageRange(spec: string, total: number): PageRangeResult {
  const trimmed = spec.trim().replace(/\s*-\s*/g, '-');
  if (trimmed === '') return { ok: true, pages: null, count: total };
  const set = new Set<number>();
  for (const raw of trimmed.split(/[\s,;]+/)) {
    if (raw === '') continue;
    const m = /^(\d*)(-?)(\d*)$/.exec(raw);
    if (!m || (m[1] === '' && m[3] === '')) {
      return { ok: false, error: `"${raw}" is not a valid page or range (use e.g. 2-10 or 1,3,5-8).` };
    }
    const hasDash = m[2] === '-';
    const a = m[1] === '' ? 1 : Number(m[1]);
    const b = !hasDash ? a : m[3] === '' ? total : Number(m[3]);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 1 || b < 1) {
      return { ok: false, error: `Page numbers start at 1 (got "${raw}").` };
    }
    if (a > b) return { ok: false, error: `Range "${raw}" is backwards.` };
    if (a > total) {
      return { ok: false, error: `Page ${a} does not exist: the PDF has ${total} page${total === 1 ? '' : 's'}.` };
    }
    for (let p = a; p <= Math.min(b, total); p++) set.add(p);
  }
  if (set.size === 0) return { ok: false, error: 'The page range selects no pages.' };
  return { ok: true, pages: set, count: set.size };
}

export function parseHexColor(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function normalizeHex(s: string): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s.trim());
  const h = m?.[1] ?? '000000';
  return (h.length === 3 ? h.split('').map((c) => c + c).join('') : h).toLowerCase();
}

/** Characters the standard PDF fonts (WinAnsi) cannot show; the backend prints "?" for them. */
export function unsupportedChars(text: string): string[] {
  const bad = new Set<string>();
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 32 || (c > 126 && c < 160)) bad.add(ch);
    else if (c > 255 && WIN_ANSI_HIGH[c] === undefined) bad.add(ch);
  }
  return [...bad];
}

export function clampNum(s: string, fallback: number, min: number, max: number): number {
  if (s.trim() === '') return fallback;
  const v = Number(s);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(Math.max(v, min), max);
}

export function stripExtension(name: string): string {
  const base = name.replace(/\.pdf$/i, '');
  return base === '' ? 'document' : base;
}

// ---------------------------------------------------------------------------
// Watermark planning
// ---------------------------------------------------------------------------

export type RotationMode = 'diagonal' | 'custom';
export type Layout = 'single' | 'tile';

export interface WatermarkSettings {
  text: string;
  font: PdfStandardFont;
  autoSize: boolean;
  /** Used when autoSize is off (points). */
  size: number;
  color: [number, number, number];
  opacity: number;
  rotationMode: RotationMode;
  /** Degrees counter-clockwise, used when rotationMode is "custom". */
  rotation: number;
  layer: 'over' | 'under';
  layout: Layout;
  rows: number;
  cols: number;
  stagger: boolean;
}

export interface Placement {
  /** Text anchor (baseline centre) in visible page coordinates. */
  x: number;
  y: number;
  size: number;
  rotation: number;
}

const MIN_SIZE = 4;
const MAX_SIZE = 1000;

/** Counter-clockwise angle in degrees from the bottom-left to the top-right corner. */
export function diagonalAngle(width: number, height: number): number {
  return (Math.atan2(height, width) * 180) / Math.PI;
}

/**
 * Largest font size at which the text, rotated by `deg`, spans `frac` of the longest
 * line through the centre of a box and still fits inside the box.
 */
export function fitSize(
  text: string,
  font: PdfStandardFont,
  boxW: number,
  boxH: number,
  deg: number,
  frac = 0.8,
): number {
  const wEm = textWidthEm(text, font);
  if (wEm <= 0 || boxW <= 0 || boxH <= 0) return 48;
  const th = (deg * Math.PI) / 180;
  const c = Math.abs(Math.cos(th));
  const s = Math.abs(Math.sin(th));
  const along = Math.min(c > 1e-9 ? boxW / c : Infinity, s > 1e-9 ? boxH / s : Infinity);
  const byLength = (frac * along) / wEm;
  const capEm = capHeight(font);
  const extW = wEm * c + capEm * s;
  const extH = wEm * s + capEm * c;
  const byBox = 0.95 * Math.min(boxW / extW, boxH / extH);
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.min(byLength, byBox)));
}

/** Anchor (centre-aligned baseline point) that puts the visual centre of the text at (cx, cy). */
export function centeredAnchor(
  cx: number,
  cy: number,
  deg: number,
  size: number,
  font: PdfStandardFont,
): { x: number; y: number } {
  const th = (deg * Math.PI) / 180;
  const half = (capHeight(font) * size) / 2;
  return { x: cx + half * Math.sin(th), y: cy - half * Math.cos(th) };
}

export function rotationFor(width: number, height: number, s: Pick<WatermarkSettings, 'rotationMode' | 'rotation'>): number {
  return s.rotationMode === 'diagonal' ? diagonalAngle(width, height) : s.rotation;
}

/** Placements for one page of the given visible size. */
export function planWatermark(width: number, height: number, s: WatermarkSettings): Placement[] {
  const rotation = rotationFor(width, height, s);
  if (s.text.trim() === '' || width <= 0 || height <= 0) return [];
  if (s.layout === 'single') {
    const size = s.autoSize ? fitSize(s.text, s.font, width, height, rotation) : s.size;
    const a = centeredAnchor(width / 2, height / 2, rotation, size, s.font);
    return [{ x: a.x, y: a.y, size, rotation }];
  }
  const rows = Math.max(1, Math.floor(s.rows));
  const cols = Math.max(1, Math.floor(s.cols));
  const cellW = width / cols;
  const cellH = height / rows;
  const size = s.autoSize ? fitSize(s.text, s.font, cellW, cellH, rotation) : s.size;
  const out: Placement[] = [];
  for (let r = 0; r < rows; r++) {
    const cy = height - (r + 0.5) * cellH;
    const shifted = s.stagger && r % 2 === 1;
    // Brick pattern: odd rows sit on the cell boundaries (edge tiles would be cut in half, so skip them).
    const count = shifted ? cols - 1 : cols;
    for (let c = 0; c < count; c++) {
      const cx = shifted ? (c + 1) * cellW : (c + 0.5) * cellW;
      const a = centeredAnchor(cx, cy, rotation, size, s.font);
      out.push({ x: a.x, y: a.y, size, rotation });
    }
  }
  return out;
}

export interface PageGeom {
  page: number;
  width: number;
  height: number;
}

export function buildStamps(
  pages: PageGeom[],
  selected: Set<number> | null,
  s: WatermarkSettings,
): PdfTextStamp[] {
  const stamps: PdfTextStamp[] = [];
  for (const p of pages) {
    if (selected && !selected.has(p.page)) continue;
    for (const pl of planWatermark(p.width, p.height, s)) {
      stamps.push({
        page: p.page,
        text: s.text,
        x: pl.x,
        y: pl.y,
        anchor: 'center',
        font: s.font,
        size: pl.size,
        color: s.color,
        opacity: s.opacity,
        rotation: pl.rotation,
        layer: s.layer,
      });
    }
  }
  return stamps;
}

// ---------------------------------------------------------------------------
// Sample PDF (so the tool can be tried without a file)
// ---------------------------------------------------------------------------

const SAMPLE_LINES = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod',
  'tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim',
  'veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea',
  'commodo consequat. Duis aute irure dolor in reprehenderit in voluptate',
  'velit esse cillum dolore eu fugiat nulla pariatur.',
  '',
  'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui',
  'officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde',
  'omnis iste natus error sit voluptatem accusantium doloremque laudantium,',
  'totam rem aperiam, eaque ipsa quae ab illo inventore veritatis.',
];

function pdfEscape(s: string): string {
  return s.replace(/[\\()]/g, (c) => `\\${c}`);
}

/** A small valid multi-page PDF with some body text; page sizes are in points. */
export function buildSamplePdf(sizes: { w: number; h: number }[], title: string): Uint8Array {
  const parts: string[] = [];
  let length = 0;
  const offsets: number[] = [];
  const push = (s: string) => {
    parts.push(s);
    length += s.length; // ASCII only
  };
  const obj = (num: number, body: string) => {
    offsets[num] = length;
    push(`${num} 0 obj\n${body}\nendobj\n`);
  };
  const pageObjs = sizes.map((_s, i) => 5 + i * 2);
  push('%PDF-1.4\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${pageObjs.map((n) => `${n} 0 R`).join(' ')}] /Count ${sizes.length} >>`);
  obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  obj(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  sizes.forEach((s, i) => {
    const pageNo = 5 + i * 2;
    const left = 64;
    const top = s.h - 114;
    let c = `0.2 0.3 0.6 rg ${left} ${s.h - 70} ${Math.max(s.w - 2 * left, 10)} 3 re f\n`;
    c += `0 g BT /F2 22 Tf ${left} ${s.h - 62} Td (${pdfEscape(title)}) Tj ET\n`;
    c += `0.35 g BT /F1 10 Tf ${left} ${s.h - 86} Td (Section ${i + 1} - sample content) Tj ET\n`;
    c += `0 g BT /F1 11 Tf 15 TL ${left} ${top} Td `;
    const maxLines = Math.max(Math.floor((s.h - 200) / 15), 4);
    for (let l = 0; l < maxLines; l++) {
      const line = SAMPLE_LINES[(l + i * 3) % SAMPLE_LINES.length] ?? '';
      c += `(${pdfEscape(line)}) Tj T* `;
    }
    c += 'ET\n';
    obj(pageNo, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${s.w} ${s.h}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageNo + 1} 0 R >>`);
    obj(pageNo + 1, `<< /Length ${c.length} >>\nstream\n${c}endstream`);
  });
  const objCount = 4 + sizes.length * 2;
  const xref = length;
  push(`xref\n0 ${objCount + 1}\n0000000000 65535 f \n`);
  for (let n = 1; n <= objCount; n++) push(`${String(offsets[n] ?? 0).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${objCount + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(length);
  for (let i = 0, o = 0; i < parts.length; i++) {
    const s = parts[i] ?? '';
    for (let k = 0; k < s.length; k++) out[o++] = s.charCodeAt(k) & 255;
  }
  return out;
}
