/** Pure helpers for the PDF page organizer: order-expression parsing/formatting, interleaving, paper sizes. */

export const MAX_ORDER_LENGTH = 5000;

export type ParseResult =
  | { ok: true; order: number[] }
  | { ok: false; error: string; token?: string };

const DASH = /\s*[-–—]\s*/g;

function resolveBound(raw: string, total: number): number | null {
  if (raw === 'first') return 1;
  if (raw === 'last') return total;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
}

function checkPage(n: number, total: number, token: string): string | null {
  if (n < 1) return `Page ${n} doesn't exist — pages start at 1 ("${token}")`;
  if (n > total) {
    return `Page ${n} is out of range — this PDF has ${total} page${total === 1 ? '' : 's'} ("${token}")`;
  }
  return null;
}

/**
 * Parse a page-order expression against a document with `total` pages.
 * Supports `3,1,2`, ranges `2-5`, descending ranges `5-1`, duplicates `1,1,2`,
 * keywords `odd`, `even`, `rev`/`reverse`, `all`, `first`, `last`, and `-1`
 * (negative numbers count from the end: -1 is the last page).
 */
export function parseOrder(expr: string, total: number): ParseResult {
  const cleaned = expr.trim().toLowerCase().replace(DASH, '-');
  if (!cleaned) return { ok: false, error: 'Enter at least one page number.' };
  const tokens = cleaned.split(/[\s,;]+/).filter(Boolean);
  const order: number[] = [];

  for (const token of tokens) {
    const fail = (error: string): ParseResult => ({ ok: false, error, token });
    let chunk: number[] = [];

    if (token === 'odd') {
      for (let p = 1; p <= total; p += 2) chunk.push(p);
    } else if (token === 'even') {
      for (let p = 2; p <= total; p += 2) chunk.push(p);
    } else if (token === 'rev' || token === 'reverse') {
      for (let p = total; p >= 1; p--) chunk.push(p);
    } else if (token === 'all') {
      for (let p = 1; p <= total; p++) chunk.push(p);
    } else if (token === 'first' || token === 'last') {
      chunk = [token === 'first' ? 1 : total];
    } else if (/^-\d+$/.test(token)) {
      const k = Number(token.slice(1));
      if (k < 1) return fail(`"${token}" isn't a valid page — use -1 for the last page`);
      if (k > total) return fail(`"${token}" reaches before the first page — this PDF has ${total} pages`);
      chunk = [total - k + 1];
    } else if (/^\d+$/.test(token)) {
      const n = Number(token);
      const err = checkPage(n, total, token);
      if (err) return fail(err);
      chunk = [n];
    } else {
      const m = /^(\d+|first|last)-(\d+|first|last)$/.exec(token);
      if (!m) return fail(`Unrecognized "${token}" — use numbers, ranges like 2-5, or odd / even / rev / last`);
      const a = resolveBound(m[1] ?? '', total);
      const b = resolveBound(m[2] ?? '', total);
      if (a === null || b === null) return fail(`Unrecognized "${token}"`);
      const errA = checkPage(a, total, token);
      if (errA) return fail(errA);
      const errB = checkPage(b, total, token);
      if (errB) return fail(errB);
      if (a <= b) for (let p = a; p <= b; p++) chunk.push(p);
      else for (let p = a; p >= b; p--) chunk.push(p);
    }

    for (const p of chunk) order.push(p);
    if (order.length > MAX_ORDER_LENGTH) {
      return { ok: false, error: `Too many pages in the output (limit ${MAX_ORDER_LENGTH}).`, token };
    }
  }

  if (order.length === 0) {
    return { ok: false, error: 'That selection is empty — the output needs at least one page.' };
  }
  return { ok: true, order };
}

/** Compact, re-parseable representation: runs of 3+ consecutive pages become `a-b` (or `b-a` when descending). */
export function formatOrder(order: number[]): string {
  const parts: string[] = [];
  let i = 0;
  while (i < order.length) {
    const start = order[i] ?? 0;
    const next = order[i + 1];
    let dir = 0;
    if (next === start + 1) dir = 1;
    else if (next === start - 1) dir = -1;
    let j = i;
    if (dir !== 0) {
      while (j + 1 < order.length && order[j + 1] === (order[j] ?? 0) + dir) j++;
    }
    const end = order[j] ?? start;
    if (j - i >= 2) {
      parts.push(`${start}-${end}`);
      i = j + 1;
    } else {
      parts.push(String(start));
      i++;
    }
  }
  return parts.join(', ');
}

export function identityOrder(total: number): number[] {
  return Array.from({ length: total }, (_, i) => i + 1);
}

/** Items at positions 1,3,5… first, then 2,4,6… (positions in the current arrangement). */
export function oddThenEven<T>(items: T[]): T[] {
  return [...items.filter((_, i) => i % 2 === 0), ...items.filter((_, i) => i % 2 === 1)];
}

export interface InterleaveStep {
  src: 'A' | 'B';
  /** 1-based page within its own document. */
  page: number;
}

/**
 * Alternate pages of A (fronts) and B (backs): A1, B1, A2, B2, …
 * With `reverseB` the backs are taken last-to-first (a stack scanned twice).
 * When one document is longer, its remaining pages are appended in order.
 */
export function interleaveSteps(nA: number, nB: number, reverseB: boolean): InterleaveStep[] {
  const steps: InterleaveStep[] = [];
  const max = Math.max(nA, nB);
  for (let i = 0; i < max; i++) {
    if (i < nA) steps.push({ src: 'A', page: i + 1 });
    if (i < nB) steps.push({ src: 'B', page: reverseB ? nB - i : i + 1 });
  }
  return steps;
}

/** Page numbers in the merged document `[A pages…, B pages…]` for the interleave. */
export function interleaveOrder(nA: number, nB: number, reverseB: boolean): number[] {
  return interleaveSteps(nA, nB, reverseB).map((s) => (s.src === 'A' ? s.page : nA + s.page));
}

const PAPER_SIZES: { name: string; w: number; h: number }[] = [
  { name: 'A0', w: 841, h: 1189 },
  { name: 'A1', w: 594, h: 841 },
  { name: 'A2', w: 420, h: 594 },
  { name: 'A3', w: 297, h: 420 },
  { name: 'A4', w: 210, h: 297 },
  { name: 'A5', w: 148, h: 210 },
  { name: 'A6', w: 105, h: 148 },
  { name: 'B5', w: 176, h: 250 },
  { name: 'Letter', w: 215.9, h: 279.4 },
  { name: 'Legal', w: 215.9, h: 355.6 },
  { name: 'Tabloid', w: 279.4, h: 431.8 },
  { name: 'Executive', w: 184.15, h: 266.7 },
];

export function ptToMm(pt: number): number {
  return (pt * 25.4) / 72;
}

export function ptToIn(pt: number): number {
  return pt / 72;
}

/** Name of a standard paper size matching the page (either orientation, ±2 mm), or null. */
export function detectPaperSize(widthPt: number, heightPt: number): string | null {
  const w = ptToMm(widthPt);
  const h = ptToMm(heightPt);
  const lo = Math.min(w, h);
  const hi = Math.max(w, h);
  for (const s of PAPER_SIZES) {
    if (Math.abs(lo - s.w) <= 2 && Math.abs(hi - s.h) <= 2) return s.name;
  }
  return null;
}

export function orientationOf(widthPt: number, heightPt: number): 'portrait' | 'landscape' | 'square' {
  if (Math.abs(widthPt - heightPt) < 1) return 'square';
  return widthPt > heightPt ? 'landscape' : 'portrait';
}
