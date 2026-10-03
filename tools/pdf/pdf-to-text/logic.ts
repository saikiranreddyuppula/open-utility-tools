/** Pure text post-processing for PDF text extraction: reflow, de-hyphenation, whitespace, search, stats. */

export interface PageText {
  page: number;
  text: string;
}

export interface TextOptions {
  reflow: boolean;
  trim: boolean;
}

const BULLET = /^\s*(?:[•◦▪▫●○■□‣⁃*+\-–—]\s|\(?\d{1,3}[.)]\s|\(?[a-zA-Z][.)]\s)/u;
const ENDS_SENTENCE = /[.!?…]["'”’)\]]*$/u;
const COLUMN_GAP = /\S {3,}\S|\t/;

function normalizeNewlines(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000\f]/g, '')
    .replace(/\n[ \t]+(?=\n)/g, '\n');
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1) + 0.5));
  return sorted[idx] ?? 0;
}

/**
 * Join hard-wrapped lines into paragraphs and repair words split by a trailing hyphen
 * (`exam-\nple` -> `example`). Blank lines, bullets/numbered items, tabular lines and
 * short lines (headings, last lines of paragraphs) keep their line breaks.
 */
export function reflowParagraphs(input: string): string {
  const text = normalizeNewlines(input).replace(/­\n[ \t]*/g, '');
  const lines = text.split('\n').map((l) => l.replace(/[ \t]+$/, ''));
  const lengths = lines.filter((l) => l.trim().length > 0).map((l) => l.trim().length);
  const maxLen = lengths.length >= 4 ? percentile(lengths, 0.9) : Math.max(0, ...lengths);

  const out: string[] = [];
  let cur: string | null = null;
  let prevRaw = '';

  const flush = () => {
    if (cur !== null) out.push(cur);
    cur = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') {
      flush();
      out.push('');
      prevRaw = '';
      continue;
    }
    if (cur === null) {
      cur = raw;
      prevRaw = raw;
      continue;
    }
    const prev = prevRaw.trim();
    const hyphenEnd = /\p{L}-$/u.test(prev);
    const startsLower = /^\p{Ll}/u.test(line);
    let join: boolean;
    if (BULLET.test(raw) || COLUMN_GAP.test(prevRaw) || COLUMN_GAP.test(raw)) {
      join = false;
    } else if (hyphenEnd && startsLower) {
      cur = cur.replace(/-$/, '') + line;
      prevRaw = raw;
      continue;
    } else if (!ENDS_SENTENCE.test(prev)) {
      join = startsLower || prev.length >= 0.55 * maxLen;
    } else if (startsLower) {
      join = prev.length >= 0.6 * maxLen;
    } else {
      join = prev.length >= 0.9 * maxLen;
    }
    if (join) {
      cur = `${cur} ${line}`;
    } else {
      flush();
      cur = raw;
    }
    prevRaw = raw;
  }
  flush();
  return out.join('\n');
}

/** Collapse runs of spaces/tabs, trim line ends and squeeze 3+ newlines into one blank line. */
export function trimWhitespace(input: string): string {
  return normalizeNewlines(input)
    .split('\n')
    .map((l) => l.replace(/[ \t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function processPageText(raw: string, opts: TextOptions): string {
  let t = normalizeNewlines(raw);
  if (opts.reflow) t = reflowParagraphs(t);
  if (opts.trim) t = trimWhitespace(t);
  return t;
}

/** Join processed pages; with `separators` every page is preceded by `--- Page N ---`. */
export function assemblePages(pages: PageText[], separators: boolean): string {
  if (!separators) {
    return pages
      .map((p) => p.text)
      .filter((t) => t.trim().length > 0)
      .join('\n\n');
  }
  return pages.map((p) => (p.text ? `--- Page ${p.page} ---\n${p.text}` : `--- Page ${p.page} ---`)).join('\n\n');
}

export function countWords(text: string): number {
  const m = text.match(/\S+/g);
  return m ? m.length : 0;
}

/** "1-3, 5, 7-9" from a list of page numbers. */
export function compressPageList(pages: number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const parts: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    const start = sorted[i] ?? 0;
    let j = i;
    while (j + 1 < sorted.length && (sorted[j + 1] ?? 0) === (sorted[j] ?? 0) + 1) j++;
    const end = sorted[j] ?? start;
    parts.push(j - i >= 1 ? `${start}-${end}` : String(start));
    i = j + 1;
  }
  return parts.join(', ');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface Segment {
  text: string;
  match: boolean;
}

export interface SearchResult {
  /** Total number of matches in the text. */
  total: number;
  /** Alternating plain/match segments; matches beyond `limit` are left as plain text. */
  segments: Segment[];
  /** Number of highlighted matches (≤ limit). */
  highlighted: number;
}

/** Case-insensitive (by default) literal search with segments ready for highlighting. */
export function searchText(text: string, query: string, limit = 3000, matchCase = false): SearchResult {
  if (!query) return { total: 0, segments: [{ text, match: false }], highlighted: 0 };
  const re = new RegExp(escapeRegExp(query), matchCase ? 'gu' : 'giu');
  const segments: Segment[] = [];
  let last = 0;
  let total = 0;
  let highlighted = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    total++;
    if (highlighted < limit) {
      if (m.index > last) segments.push({ text: text.slice(last, m.index), match: false });
      segments.push({ text: m[0], match: true });
      last = m.index + m[0].length;
      highlighted++;
    }
  }
  if (last < text.length) segments.push({ text: text.slice(last), match: false });
  return { total, segments, highlighted };
}

/** Number of matches of `query` in each page's text (pages with at least one match only). */
export function matchesPerPage(pages: PageText[], query: string, matchCase = false): Map<number, number> {
  const out = new Map<number, number>();
  if (!query) return out;
  for (const p of pages) {
    const n = searchText(p.text, query, 0, matchCase).total;
    if (n > 0) out.set(p.page, n);
  }
  return out;
}
