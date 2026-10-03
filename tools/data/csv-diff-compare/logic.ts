/**
 * CSV diff: parse two CSV texts, match rows by key column(s) or by position, compare cells.
 * Pure TypeScript; the heavy loops are written as generators so the UI can run them in slices.
 */
import { parseCsv, toCsv } from '@/lib/data/csv';

/* ------------------------------------------------------------------ */
/* Delimiter detection & parsing                                       */
/* ------------------------------------------------------------------ */

export type Delimiter = ',' | ';' | '\t' | '|';
export const DELIMITERS: { value: Delimiter; label: string }[] = [
  { value: ',', label: 'Comma' },
  { value: ';', label: 'Semicolon' },
  { value: '\t', label: 'Tab' },
  { value: '|', label: 'Pipe' },
];

/** Per-line count of `delim` outside quotes, for the first `maxLines` logical lines. */
function countPerLine(sample: string, delim: string, maxLines: number): number[] {
  const counts: number[] = [];
  let inQ = false;
  let c = 0;
  let any = false;
  for (let i = 0; i < sample.length && counts.length < maxLines; i++) {
    const ch = sample.charAt(i);
    if (ch === '"') {
      inQ = !inQ;
      any = true;
    } else if (!inQ && ch === delim) {
      c++;
      any = true;
    } else if (!inQ && ch === '\n') {
      if (any) counts.push(c);
      c = 0;
      any = false;
    } else if (ch !== '\r') any = true;
  }
  if (any && counts.length < maxLines) counts.push(c);
  return counts;
}

/** Guess the delimiter from the first lines (consistent, non-zero count per line wins). */
export function detectDelimiter(text: string): Delimiter {
  const sample = text.charCodeAt(0) === 0xfeff ? text.slice(1, 65536) : text.slice(0, 65536);
  let best: Delimiter = ',';
  let bestScore = 0;
  for (const d of [',', ';', '\t', '|'] as Delimiter[]) {
    const counts = countPerLine(sample, d, 40);
    if (counts.length === 0) continue;
    const freq = new Map<number, number>();
    for (const c of counts) freq.set(c, (freq.get(c) ?? 0) + 1);
    let modal = 0;
    let modalFreq = 0;
    for (const [c, f] of freq) {
      if (c > 0 && f > modalFreq) {
        modal = c;
        modalFreq = f;
      }
    }
    if (modal === 0) continue;
    // fraction of lines that agree, weighted a little by the number of columns
    const score = (modalFreq / counts.length) * (1 + Math.min(modal, 20) / 40) - (d === ',' ? 0 : 0.001);
    if (score > bestScore + 1e-9) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

export interface CsvTable {
  headers: string[];
  rows: string[][];
  delimiter: Delimiter;
  hasHeader: boolean;
  /** number of non-empty lines dropped */
  blankLines: number;
}

function isBlankRow(r: string[]): boolean {
  return r.length === 0 || (r.length === 1 && r[0] === '');
}

/** Cut points (row boundaries outside quotes) so that big inputs can be parsed in slices. */
function segmentBounds(text: string, target: number): number[] {
  const cuts = [0];
  if (text.length <= target * 1.5) {
    cuts.push(text.length);
    return cuts;
  }
  let inQ = false;
  let next = target;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 34) inQ = !inQ;
    else if (c === 10 && !inQ && i >= next) {
      cuts.push(i + 1);
      next = i + target;
    }
  }
  cuts.push(text.length);
  return cuts;
}

function uniqueHeaders(raw: string[], width: number): string[] {
  const seen = new Map<string, number>();
  const out: string[] = [];
  for (let i = 0; i < width; i++) {
    let name = (raw[i] ?? '').trim();
    if (name === '') name = `Column ${i + 1}`;
    const n = seen.get(name);
    if (n === undefined) {
      seen.set(name, 1);
      out.push(name);
    } else {
      let k = n + 1;
      let candidate = `${name} (${k})`;
      while (seen.has(candidate)) candidate = `${name} (${++k})`;
      seen.set(name, k);
      seen.set(candidate, 1);
      out.push(candidate);
    }
  }
  return out;
}

function buildTable(rowsIn: string[][], delimiter: Delimiter, hasHeader: boolean): CsvTable {
  let blank = 0;
  const rows: string[][] = [];
  for (const r of rowsIn) {
    if (isBlankRow(r)) blank++;
    else rows.push(r);
  }
  let width = 0;
  for (const r of rows) if (r.length > width) width = r.length;
  if (hasHeader) {
    const head = rows.shift() ?? [];
    const w = Math.max(width, head.length);
    return { headers: uniqueHeaders(head, w), rows, delimiter, hasHeader, blankLines: blank };
  }
  return { headers: Array.from({ length: width }, (_, i) => `Column ${i + 1}`), rows, delimiter, hasHeader, blankLines: blank };
}

/** Strip the BOM and normalise line endings (also inside quoted cells) so Windows/Unix files compare equal. */
function prepareText(text: string): string {
  let s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (s.includes('\r')) s = s.replace(/\r\n?/g, '\n');
  return s;
}

/** Parse CSV text synchronously (fine up to a few MB). */
export function parseTable(text: string, delimiter: Delimiter, hasHeader: boolean): CsvTable {
  const src = prepareText(text);
  const cuts = segmentBounds(src, 1 << 20);
  const rows: string[][] = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    const part = parseCsv(src.slice(cuts[k] ?? 0, cuts[k + 1] ?? src.length), delimiter);
    for (const r of part) rows.push(r);
  }
  return buildTable(rows, delimiter, hasHeader);
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Parse in ~1 MB slices, yielding to the event loop between slices. */
export async function parseTableAsync(
  text: string,
  delimiter: Delimiter,
  hasHeader: boolean,
  onProgress?: (fraction: number) => void,
  isCancelled?: () => boolean
): Promise<CsvTable | null> {
  const src = prepareText(text);
  const cuts = segmentBounds(src, 1 << 20);
  const rows: string[][] = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    const part = parseCsv(src.slice(cuts[k] ?? 0, cuts[k + 1] ?? src.length), delimiter);
    for (const r of part) rows.push(r);
    if (cuts.length > 2) {
      onProgress?.((k + 1) / (cuts.length - 1));
      await tick();
      if (isCancelled?.()) return null;
    }
  }
  return buildTable(rows, delimiter, hasHeader);
}

/* ------------------------------------------------------------------ */
/* Comparison options                                                  */
/* ------------------------------------------------------------------ */

export interface DiffOptions {
  mode: 'key' | 'position';
  /** Header names used as the row key (mode "key"). */
  keyColumns: string[];
  ignoreCase: boolean;
  trimWhitespace: boolean;
  /** Treat numeric strings as numbers (1.0 equals 1). */
  numeric: boolean;
  /** Header names that are not compared. */
  ignoreColumns: string[];
  /** Match columns by header name (column order does not matter); otherwise by position. */
  matchColumnsByName: boolean;
}

export const DEFAULT_DIFF_OPTIONS: DiffOptions = {
  mode: 'key',
  keyColumns: [],
  ignoreCase: false,
  trimWhitespace: false,
  numeric: false,
  ignoreColumns: [],
  matchColumnsByName: true,
};

const NUM_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

/** Canonical form of a numeric string, or null when it is not a safely representable number. */
export function canonicalNumber(s: string): string | null {
  if (!NUM_RE.test(s)) return null;
  const mant = s.replace(/^[+-]/, '').split(/[eE]/)[0] ?? '';
  const digits = mant.replace('.', '').replace(/^0+/, '');
  if (digits.length > 15) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n === 0 ? '0' : String(n);
}

export function makeNormalizer(opts: Pick<DiffOptions, 'ignoreCase' | 'trimWhitespace' | 'numeric'>): (s: string) => string {
  const { ignoreCase, trimWhitespace, numeric } = opts;
  if (!ignoreCase && !trimWhitespace && !numeric) return (s) => s;
  return (s) => {
    let v = trimWhitespace ? s.trim() : s;
    if (numeric) {
      const n = canonicalNumber(v);
      if (n !== null) return n;
    }
    if (ignoreCase) v = v.toLowerCase();
    return v;
  };
}

/* ------------------------------------------------------------------ */
/* Result types                                                        */
/* ------------------------------------------------------------------ */

export type RowStatus = 'added' | 'removed' | 'changed' | 'unchanged';

export interface DiffColumn {
  /** display name (the name in B, or in A for removed columns) */
  name: string;
  /** index in A (-1 when absent) */
  a: number;
  /** index in B (-1 when absent) */
  b: number;
  status: 'both' | 'added' | 'removed' | 'renamed';
  /** name in A when it differs from the one in B (positional matching) */
  renamedFrom?: string;
  ignored: boolean;
  isKey: boolean;
}

export interface DiffRow {
  status: RowStatus;
  /** row index in A (-1 for added rows) */
  a: number;
  /** row index in B (-1 for removed rows) */
  b: number;
  /** unified column indexes whose values differ (changed rows) */
  changed?: number[];
}

export interface DuplicateKey {
  key: string;
  count: number;
  firstRow: number;
}

export interface DiffResult {
  mode: DiffOptions['mode'];
  columns: DiffColumn[];
  rows: DiffRow[];
  counts: Record<RowStatus, number>;
  rowsA: number;
  rowsB: number;
  columnsAdded: string[];
  columnsRemoved: string[];
  columnsRenamed: { from: string; to: string }[];
  /** per unified column: number of changed rows */
  changedPerColumn: number[];
  duplicatesA: DuplicateKey[];
  duplicatesB: DuplicateKey[];
  /** number of rows involved in duplicate keys (extra occurrences) */
  duplicateRowsA: number;
  duplicateRowsB: number;
  emptyKeyRowsA: number;
  emptyKeyRowsB: number;
  warnings: string[];
  keyNames: string[];
}

export class DiffSetupError extends Error {}

/* ------------------------------------------------------------------ */
/* Columns                                                             */
/* ------------------------------------------------------------------ */

export function buildColumns(a: CsvTable, b: CsvTable, opts: DiffOptions): DiffColumn[] {
  const ignore = new Set(opts.ignoreColumns);
  const keys = new Set(opts.mode === 'key' ? opts.keyColumns : []);
  const cols: DiffColumn[] = [];
  if (opts.matchColumnsByName) {
    const aIdx = new Map<string, number>();
    a.headers.forEach((h, i) => {
      if (!aIdx.has(h)) aIdx.set(h, i);
    });
    const used = new Set<number>();
    b.headers.forEach((h, j) => {
      const i = aIdx.get(h);
      if (i === undefined) cols.push({ name: h, a: -1, b: j, status: 'added', ignored: ignore.has(h), isKey: keys.has(h) });
      else {
        used.add(i);
        cols.push({ name: h, a: i, b: j, status: 'both', ignored: ignore.has(h), isKey: keys.has(h) });
      }
    });
    a.headers.forEach((h, i) => {
      if (!used.has(i)) cols.push({ name: h, a: i, b: -1, status: 'removed', ignored: ignore.has(h), isKey: keys.has(h) });
    });
  } else {
    const n = Math.max(a.headers.length, b.headers.length);
    for (let i = 0; i < n; i++) {
      const ha = a.headers[i];
      const hb = b.headers[i];
      if (ha !== undefined && hb !== undefined) {
        const same = ha === hb;
        cols.push({
          name: hb,
          a: i,
          b: i,
          status: same ? 'both' : 'renamed',
          renamedFrom: same ? undefined : ha,
          ignored: ignore.has(hb) || ignore.has(ha),
          isKey: keys.has(hb) || keys.has(ha),
        });
      } else if (hb !== undefined) cols.push({ name: hb, a: -1, b: i, status: 'added', ignored: ignore.has(hb), isKey: keys.has(hb) });
      else if (ha !== undefined) cols.push({ name: ha, a: i, b: -1, status: 'removed', ignored: ignore.has(ha), isKey: keys.has(ha) });
    }
  }
  return cols;
}

/* ------------------------------------------------------------------ */
/* The diff                                                            */
/* ------------------------------------------------------------------ */

const SLICE = 4000;

function* diffGen(a: CsvTable, b: CsvTable, opts: DiffOptions): Generator<number, DiffResult, void> {
  const norm = makeNormalizer(opts);
  const needNorm = opts.ignoreCase || opts.trimWhitespace || opts.numeric;
  const columns = buildColumns(a, b, opts);
  const warnings: string[] = [];

  // key column positions in A and B
  const keyA: number[] = [];
  const keyB: number[] = [];
  const keyNames = opts.mode === 'key' ? opts.keyColumns : [];
  if (opts.mode === 'key') {
    if (keyNames.length === 0) throw new DiffSetupError('Choose at least one key column, or match rows by position.');
    for (const name of keyNames) {
      const ia = a.headers.indexOf(name);
      const ib = b.headers.indexOf(name);
      if (ia === -1 || ib === -1) {
        throw new DiffSetupError(`Key column "${name}" must exist in both files${ia === -1 ? ' (missing in A)' : ' (missing in B)'}.`);
      }
      keyA.push(ia);
      keyB.push(ib);
    }
  }

  const cmp: { a: number; b: number; ui: number }[] = [];
  columns.forEach((c, ui) => {
    if (c.a >= 0 && c.b >= 0 && !c.ignored) cmp.push({ a: c.a, b: c.b, ui });
  });
  const changedPerColumn = new Array<number>(columns.length).fill(0);

  const rowsA = a.rows;
  const rowsB = b.rows;
  const nA = rowsA.length;
  const nB = rowsB.length;
  const matchB = new Int32Array(nA).fill(-1);
  const matchA = new Int32Array(nB).fill(-1);
  const duplicatesA: DuplicateKey[] = [];
  const duplicatesB: DuplicateKey[] = [];
  let duplicateRowsA = 0;
  let duplicateRowsB = 0;
  let emptyKeyRowsA = 0;
  let emptyKeyRowsB = 0;

  if (opts.mode === 'key') {
    const keyOf = (row: string[], idx: number[]): string => {
      if (idx.length === 1) return norm(row[idx[0] ?? 0] ?? '');
      let k = '';
      for (let i = 0; i < idx.length; i++) k += (i > 0 ? '\u0001' : '') + norm(row[idx[i] ?? 0] ?? '');
      return k;
    };
    const isEmptyKey = (k: string): boolean => k.replace(/\u0001/g, '') === '';
    const firstB = new Map<string, number>();
    const moreB = new Map<string, number[]>();
    for (let j = 0; j < nB; j++) {
      const k = keyOf(rowsB[j] ?? [], keyB);
      if (isEmptyKey(k)) emptyKeyRowsB++;
      const f = firstB.get(k);
      if (f === undefined) firstB.set(k, j);
      else {
        const list = moreB.get(k);
        if (list) list.push(j);
        else moreB.set(k, [j]);
      }
      if (j % SLICE === SLICE - 1) yield (0.15 * j) / nB;
    }
    const seenA = new Map<string, number>();
    const firstA = new Map<string, number>();
    for (let i = 0; i < nA; i++) {
      const k = keyOf(rowsA[i] ?? [], keyA);
      if (isEmptyKey(k)) emptyKeyRowsA++;
      const occ = seenA.get(k) ?? 0;
      seenA.set(k, occ + 1);
      if (occ === 0) {
        firstA.set(k, i);
        const j = firstB.get(k);
        if (j !== undefined) {
          matchB[i] = j;
          matchA[j] = i;
        }
      } else {
        const j = moreB.get(k)?.[occ - 1];
        if (j !== undefined) {
          matchB[i] = j;
          matchA[j] = i;
        }
      }
      if (i % SLICE === SLICE - 1) yield 0.15 + (0.25 * i) / nA;
    }
    for (const [k, c] of seenA) {
      if (c > 1) {
        duplicatesA.push({ key: k.replace(/\u0001/g, ' | '), count: c, firstRow: (firstA.get(k) ?? 0) + 1 });
        duplicateRowsA += c - 1;
      }
    }
    for (const [k, list] of moreB) {
      duplicatesB.push({ key: k.replace(/\u0001/g, ' | '), count: list.length + 1, firstRow: (firstB.get(k) ?? 0) + 1 });
      duplicateRowsB += list.length;
    }
    duplicatesA.sort((x, y) => y.count - x.count || x.firstRow - y.firstRow);
    duplicatesB.sort((x, y) => y.count - x.count || x.firstRow - y.firstRow);
    if (duplicateRowsA + duplicateRowsB > 0) {
      warnings.push(
        'Duplicate keys: rows that share a key are paired in order of appearance (1st with 1st, 2nd with 2nd …); extra rows without a partner count as added or removed.'
      );
    }
    if (emptyKeyRowsA + emptyKeyRowsB > 0) {
      warnings.push(`${emptyKeyRowsA + emptyKeyRowsB} row${emptyKeyRowsA + emptyKeyRowsB === 1 ? ' has' : 's have'} an empty key; such rows are matched with each other like any other duplicate key.`);
    }
  } else {
    const n = Math.min(nA, nB);
    for (let i = 0; i < n; i++) {
      matchB[i] = i;
      matchA[i] = i;
    }
  }

  // assemble the unified, ordered row list
  const removedAfter = new Map<number, number[]>();
  let last = -1;
  for (let i = 0; i < nA; i++) {
    const j = matchB[i] ?? -1;
    if (j >= 0) last = j;
    else {
      const list = removedAfter.get(last);
      if (list) list.push(i);
      else removedAfter.set(last, [i]);
    }
  }
  const out: DiffRow[] = [];
  const counts: Record<RowStatus, number> = { added: 0, removed: 0, changed: 0, unchanged: 0 };
  const flushRemoved = (anchor: number): void => {
    const list = removedAfter.get(anchor);
    if (!list) return;
    for (const i of list) {
      out.push({ status: 'removed', a: i, b: -1 });
      counts.removed++;
    }
  };
  flushRemoved(-1);
  for (let j = 0; j < nB; j++) {
    const i = matchA[j] ?? -1;
    if (i < 0) {
      out.push({ status: 'added', a: -1, b: j });
      counts.added++;
    } else {
      const ra = rowsA[i] ?? [];
      const rb = rowsB[j] ?? [];
      let changed: number[] | undefined;
      for (let c = 0; c < cmp.length; c++) {
        const spec = cmp[c];
        if (!spec) continue;
        const x = ra[spec.a] ?? '';
        const y = rb[spec.b] ?? '';
        if (x === y) continue;
        if (needNorm && norm(x) === norm(y)) continue;
        (changed ??= []).push(spec.ui);
        changedPerColumn[spec.ui] = (changedPerColumn[spec.ui] ?? 0) + 1;
      }
      if (changed) {
        out.push({ status: 'changed', a: i, b: j, changed });
        counts.changed++;
      } else {
        out.push({ status: 'unchanged', a: i, b: j });
        counts.unchanged++;
      }
    }
    flushRemoved(j);
    if (j % SLICE === SLICE - 1) yield 0.4 + (0.6 * j) / nB;
  }

  const columnsAdded = columns.filter((c) => c.status === 'added').map((c) => c.name);
  const columnsRemoved = columns.filter((c) => c.status === 'removed').map((c) => c.name);
  const columnsRenamed = columns.filter((c) => c.status === 'renamed').map((c) => ({ from: c.renamedFrom ?? '', to: c.name }));
  if (opts.mode === 'position' && nA !== nB) {
    warnings.push(`The files have ${nA.toLocaleString()} and ${nB.toLocaleString()} rows; the extra rows at the end count as ${nA > nB ? 'removed' : 'added'}.`);
  }
  return {
    mode: opts.mode,
    columns,
    rows: out,
    counts,
    rowsA: nA,
    rowsB: nB,
    columnsAdded,
    columnsRemoved,
    columnsRenamed,
    changedPerColumn,
    duplicatesA,
    duplicatesB,
    duplicateRowsA,
    duplicateRowsB,
    emptyKeyRowsA,
    emptyKeyRowsB,
    warnings,
    keyNames,
  };
}

/** Synchronous diff (tests, small inputs). Throws DiffSetupError for configuration problems. */
export function diffTables(a: CsvTable, b: CsvTable, opts: DiffOptions): DiffResult {
  const g = diffGen(a, b, opts);
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
  }
}

/** Diff in slices so the page stays responsive. Resolves to null when cancelled. */
export async function diffTablesAsync(
  a: CsvTable,
  b: CsvTable,
  opts: DiffOptions,
  onProgress?: (fraction: number) => void,
  isCancelled?: () => boolean
): Promise<DiffResult | null> {
  const g = diffGen(a, b, opts);
  let lastTick = performance.now();
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
    onProgress?.(r.value);
    if (performance.now() - lastTick > 40) {
      await tick();
      lastTick = performance.now();
      if (isCancelled?.()) return null;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Suggesting a key                                                    */
/* ------------------------------------------------------------------ */

const ID_NAME = /^(?:id|uuid|guid|key|pk|code|sku|ref|number|no|num|#)$|(?:^|[_\-\s.])(?:id|uuid|guid|key|sku|code)$/i;
const CAMEL_ID = /[a-z](?:Id|ID|Uuid|Key|Sku)$/;

function allUnique(rows: string[][], idx: number[], norm: (s: string) => string): boolean {
  const seen = new Set<string>();
  for (const r of rows) {
    let k = '';
    for (let i = 0; i < idx.length; i++) {
      const v = norm(r[idx[i] ?? 0] ?? '');
      if (v === '') return false;
      k += (i > 0 ? '\u0001' : '') + v;
    }
    if (seen.has(k)) return false;
    seen.add(k);
  }
  return true;
}

/**
 * Pick header name(s) that identify a row in both files: an id-like column whose values are
 * unique and non-empty in both, else any such column, else a unique pair of leading columns.
 */
export function suggestKeyColumns(a: CsvTable, b: CsvTable): string[] {
  if (a.rows.length === 0 || b.rows.length === 0) return [];
  const bSet = new Set(b.headers);
  const common = a.headers.filter((h) => bSet.has(h));
  if (common.length === 0) return [];
  const norm = makeNormalizer({ ignoreCase: false, trimWhitespace: true, numeric: false });
  const ordered = [...common].sort((x, y) => Number(ID_NAME.test(y) || CAMEL_ID.test(y)) - Number(ID_NAME.test(x) || CAMEL_ID.test(x)) || common.indexOf(x) - common.indexOf(y));
  const unique = (names: string[]): boolean => {
    const ia = names.map((n) => a.headers.indexOf(n));
    const ib = names.map((n) => b.headers.indexOf(n));
    return allUnique(a.rows, ia, norm) && allUnique(b.rows, ib, norm);
  };
  for (const h of ordered.slice(0, 10)) {
    if (unique([h])) return [h];
  }
  const lead = common.slice(0, 4);
  for (let i = 0; i < lead.length; i++) {
    for (let j = i + 1; j < lead.length; j++) {
      const pair = [lead[i] as string, lead[j] as string];
      if (unique(pair)) return pair;
    }
  }
  return [];
}

/* ------------------------------------------------------------------ */
/* Cells, exports                                                      */
/* ------------------------------------------------------------------ */

export interface CellView {
  /** value shown (new value when it changed) */
  value: string;
  /** old value for changed cells */
  old?: string;
}

/** Cell values of one unified row, aligned with `result.columns`. */
export function rowCells(result: DiffResult, a: CsvTable, b: CsvTable, row: DiffRow): CellView[] {
  const ra = row.a >= 0 ? (a.rows[row.a] ?? []) : [];
  const rb = row.b >= 0 ? (b.rows[row.b] ?? []) : [];
  const changed = row.changed ? new Set(row.changed) : null;
  return result.columns.map((c, ui) => {
    if (row.status === 'removed') return { value: c.a >= 0 ? (ra[c.a] ?? '') : '' };
    if (row.status === 'added') return { value: c.b >= 0 ? (rb[c.b] ?? '') : '' };
    const fromB = c.b >= 0 ? (rb[c.b] ?? '') : (ra[c.a] ?? '');
    if (changed && changed.has(ui)) return { value: fromB, old: ra[c.a] ?? '' };
    return { value: fromB };
  });
}

export const STATUS_LABEL: Record<RowStatus, string> = {
  added: 'added',
  removed: 'removed',
  changed: 'changed',
  unchanged: 'unchanged',
};

export interface ExportOptions {
  /** which row statuses to include */
  include: ReadonlySet<RowStatus>;
  /** add a `_status` column (and `_changes` for changed rows) */
  meta: boolean;
  /** how changed cells are written */
  changed: 'new' | 'arrow';
  delimiter: Delimiter;
  /** leave out columns that exist only in one file or are ignored */
  onlyComparable?: boolean;
}

/** Build a CSV of the diff: unified columns, values from B (A for removed rows). */
export function diffToCsv(result: DiffResult, a: CsvTable, b: CsvTable, opts: ExportOptions): string {
  const cols = result.columns.map((c, ui) => ({ c, ui })).filter(({ c }) => !opts.onlyComparable || (c.status !== 'added' && c.status !== 'removed' && !c.ignored));
  const header: string[] = [];
  if (opts.meta) header.push('_status', '_changes');
  for (const { c } of cols) header.push(c.renamedFrom ? `${c.renamedFrom} -> ${c.name}` : c.name);
  const lines: (string | number | boolean | null)[][] = [header];
  for (const row of result.rows) {
    if (!opts.include.has(row.status)) continue;
    const cells = rowCells(result, a, b, row);
    const out: string[] = [];
    if (opts.meta) {
      out.push(row.status);
      out.push(
        row.changed
          ? row.changed
              .map((ui) => {
                const cell = cells[ui];
                return `${result.columns[ui]?.name ?? ''}: ${cell?.old ?? ''} -> ${cell?.value ?? ''}`;
              })
              .join('; ')
          : ''
      );
    }
    for (const { ui } of cols) {
      const cell = cells[ui];
      if (!cell) {
        out.push('');
        continue;
      }
      out.push(cell.old !== undefined && opts.changed === 'arrow' ? `${cell.old} -> ${cell.value}` : cell.value);
    }
    lines.push(out);
  }
  return toCsv(lines, opts.delimiter);
}

export function summaryText(result: DiffResult, nameA: string, nameB: string): string {
  const c = result.counts;
  const parts = [
    `CSV diff: ${nameA} (${result.rowsA.toLocaleString()} rows) vs ${nameB} (${result.rowsB.toLocaleString()} rows)`,
    result.mode === 'key' ? `Matched by key: ${result.keyNames.join(', ')}` : 'Matched by row position',
    `Added: ${c.added.toLocaleString()}`,
    `Removed: ${c.removed.toLocaleString()}`,
    `Changed: ${c.changed.toLocaleString()}`,
    `Unchanged: ${c.unchanged.toLocaleString()}`,
  ];
  if (result.columnsAdded.length) parts.push(`Columns added: ${result.columnsAdded.join(', ')}`);
  if (result.columnsRemoved.length) parts.push(`Columns removed: ${result.columnsRemoved.join(', ')}`);
  if (result.columnsRenamed.length) parts.push(`Columns renamed: ${result.columnsRenamed.map((r) => `${r.from} -> ${r.to}`).join(', ')}`);
  const changedCols = result.columns
    .map((col, ui) => ({ name: col.name, n: result.changedPerColumn[ui] ?? 0 }))
    .filter((x) => x.n > 0)
    .sort((x, y) => y.n - x.n)
    .slice(0, 8);
  if (changedCols.length) parts.push(`Most changed columns: ${changedCols.map((x) => `${x.name} (${x.n})`).join(', ')}`);
  if (result.duplicateRowsA + result.duplicateRowsB > 0) {
    parts.push(`Duplicate key rows: ${result.duplicateRowsA} in A, ${result.duplicateRowsB} in B`);
  }
  return parts.join('\n');
}
