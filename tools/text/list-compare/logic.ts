/**
 * Pure list-comparison logic: parsing (delimiters / CSV columns), normalisation and set
 * operations that preserve first-seen order. Uses Map/Set so 200k+ items stay fast.
 */
import { parseCsv } from '@/lib/data/csv';

export type Delimiter = 'auto' | 'newline' | 'comma' | 'semicolon' | 'tab' | 'space';
export type CsvDelimiter = 'auto' | ',' | ';' | '\t' | '|';
export type SortMode = 'original' | 'az' | 'za' | 'natural';
export type OutputSeparator = 'newline' | 'comma' | 'comma-space' | 'semicolon' | 'tab' | 'space';

export interface CsvOptions {
  enabled: boolean;
  delimiter: CsvDelimiter;
  header: boolean;
  columnA: string;
  columnB: string;
}

export interface CompareOptions {
  delimiter: Delimiter;
  trim: boolean;
  ignoreEmpty: boolean;
  caseInsensitive: boolean;
  collapseWhitespace: boolean;
  removeDiacritics: boolean;
  numeric: boolean;
  sort: SortMode;
  csv: CsvOptions;
}

export const DEFAULT_OPTIONS: CompareOptions = {
  delimiter: 'newline',
  trim: true,
  ignoreEmpty: true,
  caseInsensitive: false,
  collapseWhitespace: false,
  removeDiacritics: false,
  numeric: false,
  sort: 'original',
  csv: { enabled: false, delimiter: 'auto', header: true, columnA: '1', columnB: '1' },
};

export interface Entry {
  /** First-seen display text (trim/whitespace normalisation applied, case preserved). */
  text: string;
  countA: number;
  countB: number;
}

export interface ListInfo {
  total: number;
  unique: number;
  delimiter: string;
  /** Resolved CSV column label (header name or "column N"), when CSV mode is on. */
  column?: string;
}

export interface CompareResult {
  error: string | null;
  infoA: ListInfo;
  infoB: ListInfo;
  onlyA: Entry[];
  onlyB: Entry[];
  both: Entry[];
  union: Entry[];
  symmetric: Entry[];
  dupA: Entry[];
  dupB: Entry[];
  /** Percentages 0..100 (null when undefined, e.g. both lists empty). */
  jaccard: number | null;
  overlapA: number | null;
  overlapB: number | null;
}

/* ------------------------------------------------------------------ */
/* Delimiters                                                           */
/* ------------------------------------------------------------------ */

const SPLITTERS: Record<Exclude<Delimiter, 'auto'>, RegExp> = {
  newline: /\r\n|\r|\n/,
  comma: /,|\r\n|\r|\n/,
  semicolon: /;|\r\n|\r|\n/,
  tab: /\t|\r\n|\r|\n/,
  space: / |\r\n|\r|\n/,
};

export function detectDelimiter(text: string): Exclude<Delimiter, 'auto'> {
  const lines = text.split(/\r\n|\r|\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return 'newline';
  let comma = 0;
  let semi = 0;
  let tab = 0;
  let linesWithDelim = 0;
  for (const l of lines) {
    let has = false;
    for (let i = 0; i < l.length; i++) {
      const c = l.charCodeAt(i);
      if (c === 44) {
        comma++;
        has = true;
      } else if (c === 59) {
        semi++;
        has = true;
      } else if (c === 9) {
        tab++;
        has = true;
      }
    }
    if (has) linesWithDelim++;
  }
  if (lines.length >= 2 && linesWithDelim / lines.length < 0.5) return 'newline';
  const best = Math.max(comma, semi, tab);
  if (best > 0) return best === comma ? 'comma' : best === semi ? 'semicolon' : 'tab';
  if (lines.length >= 2) return 'newline';
  return /\S\s+\S/.test(lines[0] ?? '') && (lines[0] ?? '').includes(' ') ? 'space' : 'newline';
}

function detectCsvDelimiter(text: string): ',' | ';' | '\t' | '|' {
  const first = text.split(/\r\n|\r|\n/).find((l) => l.trim() !== '') ?? '';
  const counts = { ',': 0, ';': 0, '\t': 0, '|': 0 };
  let inQ = false;
  for (const ch of first) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ && ch in counts) counts[ch as keyof typeof counts]++;
  }
  let best: ',' | ';' | '\t' | '|' = ',';
  for (const k of [',', ';', '\t', '|'] as const) if (counts[k] > counts[best]) best = k;
  return best;
}

export function delimiterLabel(d: string): string {
  switch (d) {
    case 'newline':
      return 'newline';
    case 'comma':
    case ',':
      return 'comma';
    case 'semicolon':
    case ';':
      return 'semicolon';
    case 'tab':
    case '\t':
      return 'tab';
    case 'space':
      return 'space';
    case '|':
      return 'pipe';
    default:
      return d;
  }
}

/* ------------------------------------------------------------------ */
/* Normalisation                                                        */
/* ------------------------------------------------------------------ */

/** Canonical form of a plain decimal number string, or null if it isn't one ("007" -> "7", "7.50" -> "7.5"). */
export function canonicalNumber(s: string): string | null {
  const m = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m) return null;
  const sign = m[1] ?? '';
  const intRaw = m[2] ?? '';
  const fracRaw = m[3] ?? '';
  if (intRaw === '' && fracRaw === '') return null;
  const int = intRaw.replace(/^0+(?=\d)/, '') || '0';
  const frac = fracRaw.replace(/0+$/, '');
  const isZero = /^0+$/.test(int) && frac === '';
  return `${sign === '-' && !isZero ? '-' : ''}${int}${frac ? '.' + frac : ''}`;
}

const MARKS_RE = /\p{M}/gu;

export interface Normalised {
  text: string;
  key: string;
}

export function makeNormalizer(o: CompareOptions): (raw: string) => Normalised {
  return (raw: string): Normalised => {
    let t = raw;
    if (o.collapseWhitespace) t = t.replace(/\s+/g, ' ');
    if (o.trim) t = t.trim();
    let k = t;
    if (o.removeDiacritics) k = k.normalize('NFD').replace(MARKS_RE, '');
    if (o.caseInsensitive) k = k.toLowerCase();
    if (o.numeric) {
      const n = canonicalNumber(k);
      if (n !== null) k = n;
    }
    return { text: t, key: k };
  };
}

/* ------------------------------------------------------------------ */
/* Parsing                                                              */
/* ------------------------------------------------------------------ */

interface Parsed {
  items: string[];
  delimiter: string;
  column?: string;
  error?: string;
}

function resolveColumn(spec: string, header: string[] | null, label: string, width: number): { idx: number; label: string } | string {
  const s = spec.trim();
  if (header) {
    const exact = header.findIndex((h) => h.trim() === s);
    if (s && exact >= 0) return { idx: exact, label: header[exact]?.trim() || `column ${exact + 1}` };
    const ci = header.findIndex((h) => h.trim().toLowerCase() === s.toLowerCase());
    if (s && ci >= 0) return { idx: ci, label: header[ci]?.trim() || `column ${ci + 1}` };
  }
  const n = s === '' ? 1 : /^\d+$/.test(s) ? Number(s) : NaN;
  if (!Number.isFinite(n)) {
    return header
      ? `${label}: column "${s}" not found. Use a column number or one of the headers: ${header.map((h) => h.trim()).filter(Boolean).join(', ') || '(none)'}.`
      : `${label}: enter a column number (1 = first column).`;
  }
  if (n < 1 || n > Math.max(width, 1)) return `${label}: column ${n} does not exist (the data has ${width} column${width === 1 ? '' : 's'}).`;
  return { idx: n - 1, label: header?.[n - 1]?.trim() || `column ${n}` };
}

export function parseList(text: string, o: CompareOptions, which: 'A' | 'B'): Parsed {
  const label = `List ${which}`;
  if (o.csv.enabled) {
    const delim = o.csv.delimiter === 'auto' ? detectCsvDelimiter(text) : o.csv.delimiter;
    const rows = parseCsv(text, delim).filter((r) => !(r.length === 1 && (r[0] ?? '') === ''));
    if (rows.length === 0) return { items: [], delimiter: delim };
    const header = o.csv.header ? (rows[0] ?? []) : null;
    const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
    const col = resolveColumn(which === 'A' ? o.csv.columnA : o.csv.columnB, header, label, width);
    if (typeof col === 'string') return { items: [], delimiter: delim, error: col };
    const body = header ? rows.slice(1) : rows;
    return { items: body.map((r) => r[col.idx] ?? ''), delimiter: delim, column: col.label };
  }
  const d = o.delimiter === 'auto' ? detectDelimiter(text) : o.delimiter;
  return { items: text === '' ? [] : text.split(SPLITTERS[d]), delimiter: d };
}

/* ------------------------------------------------------------------ */
/* Comparison                                                           */
/* ------------------------------------------------------------------ */

interface Slot {
  text: string;
  count: number;
}

function buildMap(items: string[], norm: (s: string) => Normalised, ignoreEmpty: boolean): { map: Map<string, Slot>; total: number } {
  const map = new Map<string, Slot>();
  let total = 0;
  for (const raw of items) {
    const n = norm(raw);
    if (ignoreEmpty && n.text.trim() === '') continue;
    total++;
    const hit = map.get(n.key);
    if (hit) hit.count++;
    else map.set(n.key, { text: n.text, count: 1 });
  }
  return { map, total };
}

const collators = new Map<string, Intl.Collator>();
function collator(numeric: boolean): Intl.Collator {
  const k = numeric ? 'n' : 'a';
  let c = collators.get(k);
  if (!c) {
    c = new Intl.Collator('en', { numeric, sensitivity: 'variant' });
    collators.set(k, c);
  }
  return c;
}

export function sortEntries(list: Entry[], mode: SortMode): Entry[] {
  if (mode === 'original') return list;
  const c = collator(mode === 'natural');
  const out = list.slice();
  out.sort((x, y) => (mode === 'za' ? c.compare(y.text, x.text) : c.compare(x.text, y.text)));
  return out;
}

const pct = (n: number, d: number): number | null => (d === 0 ? null : (n / d) * 100);

export function compareLists(textA: string, textB: string, o: CompareOptions): CompareResult {
  const empty: CompareResult = {
    error: null,
    infoA: { total: 0, unique: 0, delimiter: '' },
    infoB: { total: 0, unique: 0, delimiter: '' },
    onlyA: [],
    onlyB: [],
    both: [],
    union: [],
    symmetric: [],
    dupA: [],
    dupB: [],
    jaccard: null,
    overlapA: null,
    overlapB: null,
  };
  const pa = parseList(textA, o, 'A');
  const pb = parseList(textB, o, 'B');
  const err = [pa.error, pb.error].filter(Boolean).join('\n');
  if (err) return { ...empty, error: err };

  const norm = makeNormalizer(o);
  const A = buildMap(pa.items, norm, o.ignoreEmpty);
  const B = buildMap(pb.items, norm, o.ignoreEmpty);

  const onlyA: Entry[] = [];
  const both: Entry[] = [];
  const dupA: Entry[] = [];
  for (const [k, s] of A.map) {
    const inB = B.map.get(k);
    const e: Entry = { text: s.text, countA: s.count, countB: inB?.count ?? 0 };
    if (inB) both.push(e);
    else onlyA.push(e);
    if (s.count > 1) dupA.push(e);
  }
  const onlyB: Entry[] = [];
  const dupB: Entry[] = [];
  for (const [k, s] of B.map) {
    const inA = A.map.get(k);
    const e: Entry = { text: s.text, countA: inA?.count ?? 0, countB: s.count };
    if (!inA) onlyB.push(e);
    if (s.count > 1) dupB.push(e);
  }

  // Union in first-seen order: every A entry (shared or not), then B-only entries.
  const union: Entry[] = [];
  for (const [k, s] of A.map) union.push({ text: s.text, countA: s.count, countB: B.map.get(k)?.count ?? 0 });
  union.push(...onlyB);
  const symmetric = [...onlyA, ...onlyB];

  const unionSize = A.map.size + onlyB.length;
  return {
    error: null,
    infoA: { total: A.total, unique: A.map.size, delimiter: pa.delimiter, column: pa.column },
    infoB: { total: B.total, unique: B.map.size, delimiter: pb.delimiter, column: pb.column },
    onlyA: sortEntries(onlyA, o.sort),
    onlyB: sortEntries(onlyB, o.sort),
    both: sortEntries(both, o.sort),
    union: sortEntries(union, o.sort),
    symmetric: sortEntries(symmetric, o.sort),
    dupA: sortEntries(dupA, o.sort),
    dupB: sortEntries(dupB, o.sort),
    jaccard: pct(both.length, unionSize),
    overlapA: pct(both.length, A.map.size),
    overlapB: pct(both.length, B.map.size),
  };
}

const SEPARATORS: Record<OutputSeparator, string> = {
  newline: '\n',
  comma: ',',
  'comma-space': ', ',
  semicolon: ';',
  tab: '\t',
  space: ' ',
};

export function joinEntries(list: Entry[], sep: OutputSeparator, withCounts = false, side: 'A' | 'B' = 'A'): string {
  return list
    .map((e) => (withCounts ? `${e.text}${sep === 'newline' || sep === 'tab' ? '\t' : ' '}${side === 'A' ? e.countA : e.countB}` : e.text))
    .join(SEPARATORS[sep]);
}

/* ------------------------------------------------------------------ */
/* Venn geometry                                                        */
/* ------------------------------------------------------------------ */

function lensArea(r1: number, r2: number, d: number): number {
  if (d >= r1 + r2) return 0;
  if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2;
  const a1 = Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1));
  const a2 = Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2));
  const k = 0.5 * Math.sqrt((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2));
  return r1 * r1 * a1 + r2 * r2 * a2 - k;
}

export interface VennGeometry {
  rA: number;
  rB: number;
  /** Distance between circle centres. */
  d: number;
}

/**
 * Circle radii (area ∝ set size) and centre distance such that the lens area is ∝ the intersection size.
 * Units: radius of a set of size n is sqrt(n/π).
 */
export function vennGeometry(a: number, b: number, both: number): VennGeometry {
  const rA = Math.sqrt(Math.max(a, 0) / Math.PI);
  const rB = Math.sqrt(Math.max(b, 0) / Math.PI);
  if (a === 0 || b === 0 || both <= 0) return { rA, rB, d: rA + rB + Math.max(rA, rB) * 0.25 };
  if (both >= Math.min(a, b)) return { rA, rB, d: Math.abs(rA - rB) };
  const target = both;
  let lo = Math.abs(rA - rB);
  let hi = rA + rB;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (lensArea(rA, rB, mid) > target) lo = mid;
    else hi = mid;
  }
  return { rA, rB, d: (lo + hi) / 2 };
}

export { lensArea };
