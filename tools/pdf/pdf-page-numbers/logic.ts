/**
 * Pure logic for the "Add Page Numbers to PDF" tool: page-range parsing, label
 * templates, Bates numbers, stamp placement and a tiny sample-PDF writer.
 * No framework or browser APIs, so everything here is unit-testable.
 */
import type { PdfStandardFont, PdfTextStamp } from '@/lib/wasm/pdf';

export const MM_TO_PT = 72 / 25.4;

export const FONTS: { id: PdfStandardFont; label: string }[] = [
  { id: 'Helvetica', label: 'Helvetica' },
  { id: 'Helvetica-Bold', label: 'Helvetica Bold' },
  { id: 'Times-Roman', label: 'Times Roman' },
  { id: 'Times-Bold', label: 'Times Bold' },
  { id: 'Courier', label: 'Courier' },
  { id: 'Courier-Bold', label: 'Courier Bold' },
];

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

// ---------------------------------------------------------------------------
// Page ranges
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

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export type FormatId = 'n' | 'page-n' | 'page-n-of-N' | 'n-of-N' | 'dash-n' | 'custom' | 'bates';

export const FORMAT_PRESETS: { id: Exclude<FormatId, 'custom' | 'bates'>; label: string; template: string }[] = [
  { id: 'n', label: '1, 2, 3', template: '{n}' },
  { id: 'page-n', label: 'Page 1', template: 'Page {n}' },
  { id: 'page-n-of-N', label: 'Page 1 of 10', template: 'Page {n} of {N}' },
  { id: 'n-of-N', label: '1 / 10', template: '{n} / {N}' },
  { id: 'dash-n', label: '- 1 -', template: '- {n} -' },
];

export interface LabelContext {
  /** Number for this page. */
  n: number;
  /** Highest number in the numbered range ("of N"). */
  N: number;
  /** File name without extension. */
  file: string;
  /** Pre-formatted local date. */
  date: string;
}

/** Replace {n}, {N}, {file} and {date}. Unknown braces are left untouched. */
export function expandTemplate(template: string, ctx: LabelContext): string {
  return template.replace(/\{(n|N|file|date)\}/g, (_m, key: string) => {
    switch (key) {
      case 'n':
        return String(ctx.n);
      case 'N':
        return String(ctx.N);
      case 'file':
        return ctx.file;
      default:
        return ctx.date;
    }
  });
}

/** Bates label: prefix + zero-padded number + suffix, e.g. ACME-000123. */
export function batesLabel(prefix: string, digits: number, suffix: string, n: number): string {
  const d = Math.min(Math.max(Math.floor(digits) || 1, 1), 12);
  return `${prefix}${String(Math.max(0, Math.floor(n))).padStart(d, '0')}${suffix}`;
}

export function localIsoDate(d: Date): string {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
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

const WIN_ANSI_EXTRA = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017d,
  0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

/** Characters the standard PDF fonts (WinAnsi) cannot show; the backend prints "?" for them. */
export function unsupportedChars(text: string): string[] {
  const bad = new Set<string>();
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 32 || (c > 126 && c < 160)) bad.add(ch);
    else if (c > 255 && !WIN_ANSI_EXTRA.has(c)) bad.add(ch);
  }
  return [...bad];
}

export function parseHexColor(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) return null;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

export type VPos = 'top' | 'bottom';
export type HPos = 'left' | 'center' | 'right';

export interface PageGeom {
  page: number;
  width: number;
  height: number;
}

export interface NumberingOptions {
  formatId: FormatId;
  template: string;
  batesPrefix: string;
  batesDigits: number;
  batesSuffix: string;
  vpos: VPos;
  hpos: HPos;
  mirrorEven: boolean;
  marginXmm: number;
  marginYmm: number;
  start: number;
  /** null = all pages. */
  range: Set<number> | null;
  skipFirst: number;
  countSkipped: boolean;
  font: PdfStandardFont;
  size: number;
  color: [number, number, number];
  opacity: number;
}

export interface PlanItem {
  page: number;
  width: number;
  height: number;
  n: number;
  text: string;
  x: number;
  y: number;
  anchor: 'left' | 'center' | 'right';
}

export interface Plan {
  items: PlanItem[];
  /** The "N" used in "of N". */
  lastNumber: number;
}

export function resolveTemplate(o: Pick<NumberingOptions, 'formatId' | 'template'>): string {
  if (o.formatId === 'custom') return o.template;
  const preset = FORMAT_PRESETS.find((p) => p.id === o.formatId);
  return preset ? preset.template : '{n}';
}

export function labelFor(o: NumberingOptions, ctx: LabelContext): string {
  if (o.formatId === 'bates') return batesLabel(o.batesPrefix, o.batesDigits, o.batesSuffix, ctx.n);
  return expandTemplate(resolveTemplate(o), ctx);
}

export function isStamped(page: number, o: Pick<NumberingOptions, 'range' | 'skipFirst'>): boolean {
  if (page <= o.skipFirst) return false;
  return o.range === null || o.range.has(page);
}

/** Where the label goes on a page (visible coordinates, points, origin bottom-left). */
export function anchorFor(
  page: number,
  width: number,
  height: number,
  o: Pick<NumberingOptions, 'vpos' | 'hpos' | 'mirrorEven' | 'marginXmm' | 'marginYmm' | 'font' | 'size'>,
): { x: number; y: number; anchor: 'left' | 'center' | 'right' } {
  let h: HPos = o.hpos;
  if (o.mirrorEven && page % 2 === 0) {
    if (h === 'left') h = 'right';
    else if (h === 'right') h = 'left';
  }
  const mx = Math.max(0, o.marginXmm) * MM_TO_PT;
  const my = Math.max(0, o.marginYmm) * MM_TO_PT;
  const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max);
  const y =
    o.vpos === 'bottom' ? clamp(my, height) : clamp(height - my - capHeight(o.font) * o.size, height);
  if (h === 'left') return { x: clamp(mx, width), y, anchor: 'left' };
  if (h === 'right') return { x: clamp(width - mx, width), y, anchor: 'right' };
  return { x: width / 2, y, anchor: 'center' };
}

export function planPageNumbers(
  pages: PageGeom[],
  o: NumberingOptions,
  ctx: { file: string; date: string },
): Plan {
  const total = pages.length;
  const stamped = pages.filter((p) => isStamped(p.page, o));
  const lastNumber = o.start - 1 + (o.countSkipped ? total : stamped.length);
  const items: PlanItem[] = [];
  let ordinal = 0;
  for (const p of pages) {
    if (!isStamped(p.page, o)) continue;
    const n = o.countSkipped ? o.start + p.page - 1 : o.start + ordinal;
    ordinal++;
    const text = labelFor(o, { n, N: lastNumber, file: ctx.file, date: ctx.date });
    const pos = anchorFor(p.page, p.width, p.height, o);
    items.push({ page: p.page, width: p.width, height: p.height, n, text, ...pos });
  }
  return { items, lastNumber };
}

export function toStamps(items: PlanItem[], o: Pick<NumberingOptions, 'font' | 'size' | 'color' | 'opacity'>): PdfTextStamp[] {
  return items.map((it) => ({
    page: it.page,
    text: it.text,
    x: it.x,
    y: it.y,
    anchor: it.anchor,
    font: o.font,
    size: o.size,
    color: o.color,
    opacity: o.opacity,
    rotation: 0,
    layer: 'over' as const,
  }));
}

// ---------------------------------------------------------------------------
// Sample PDF (so the tool can be tried without a file)
// ---------------------------------------------------------------------------

const SAMPLE_PARAGRAPHS = [
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
    let top = s.h - 90;
    let c = `0.2 0.3 0.6 rg ${left} ${s.h - 70} ${Math.max(s.w - 2 * left, 10)} 3 re f\n`;
    c += `0 g BT /F2 22 Tf ${left} ${s.h - 62} Td (${pdfEscape(title)}) Tj ET\n`;
    c += `0.35 g BT /F1 10 Tf ${left} ${s.h - 86} Td (Section ${i + 1} - sample content) Tj ET\n`;
    top -= 24;
    c += '0 g BT /F1 11 Tf 15 TL ';
    c += `${left} ${top} Td `;
    const maxLines = Math.max(Math.floor((s.h - 200) / 15), 4);
    for (let l = 0; l < maxLines; l++) {
      const line = SAMPLE_PARAGRAPHS[(l + i * 3) % SAMPLE_PARAGRAPHS.length] ?? '';
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
