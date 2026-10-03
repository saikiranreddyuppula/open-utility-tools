/**
 * Subtitle parsing, formatting and retiming. Pure TypeScript (no DOM, no React).
 * All times are integer milliseconds.
 */

export type SubFormat = 'srt' | 'vtt' | 'sbv' | 'ass' | 'lrc' | 'ttml';
export type OutFormat = SubFormat | 'txt' | 'csv';

export interface Cue {
  start: number;
  end: number;
  /** Text with "\n" line breaks. May contain simple <i>/<b>/<u> tags. */
  text: string;
  /** WebVTT cue settings ("align:start position:10%"), kept for VTT -> VTT. */
  settings?: string;
}

export interface ParseResult {
  format: SubFormat;
  cues: Cue[];
}

export const FORMAT_LABELS: Record<OutFormat, string> = {
  srt: 'SRT (SubRip)',
  vtt: 'WebVTT',
  sbv: 'SBV (YouTube)',
  ass: 'ASS / SSA',
  lrc: 'LRC (lyrics)',
  ttml: 'TTML / DFXP',
  txt: 'Plain text',
  csv: 'CSV',
};

export const FORMAT_EXT: Record<OutFormat, string> = {
  srt: 'srt',
  vtt: 'vtt',
  sbv: 'sbv',
  ass: 'ass',
  lrc: 'lrc',
  ttml: 'ttml',
  txt: 'txt',
  csv: 'csv',
};

export const FORMAT_MIME: Record<OutFormat, string> = {
  srt: 'application/x-subrip;charset=utf-8',
  vtt: 'text/vtt;charset=utf-8',
  sbv: 'text/plain;charset=utf-8',
  ass: 'text/plain;charset=utf-8',
  lrc: 'text/plain;charset=utf-8',
  ttml: 'application/ttml+xml;charset=utf-8',
  txt: 'text/plain;charset=utf-8',
  csv: 'text/csv;charset=utf-8',
};

/* ------------------------------------------------------------------ */
/* Time helpers                                                        */
/* ------------------------------------------------------------------ */

const pad = (n: number, w = 2): string => String(n).padStart(w, '0');

function fracToMs(frac: string | undefined): number {
  if (!frac) return 0;
  return Number((frac + '00').slice(0, 3));
}

function hmsToMs(h: string | undefined, m: string | undefined, s: string | undefined, frac: string | undefined): number {
  return Number(h ?? 0) * 3600000 + Number(m ?? 0) * 60000 + Number(s ?? 0) * 1000 + fracToMs(frac);
}

function splitMs(ms: number): { h: number; m: number; s: number; ms: number } {
  const t = Math.max(0, Math.round(ms));
  return {
    h: Math.floor(t / 3600000),
    m: Math.floor((t % 3600000) / 60000),
    s: Math.floor((t % 60000) / 1000),
    ms: t % 1000,
  };
}

export function formatSrtTime(ms: number): string {
  const t = splitMs(ms);
  return `${pad(t.h)}:${pad(t.m)}:${pad(t.s)},${pad(t.ms, 3)}`;
}

export function formatVttTime(ms: number): string {
  const t = splitMs(ms);
  return `${pad(t.h)}:${pad(t.m)}:${pad(t.s)}.${pad(t.ms, 3)}`;
}

export function formatSbvTime(ms: number): string {
  const t = splitMs(ms);
  return `${t.h}:${pad(t.m)}:${pad(t.s)}.${pad(t.ms, 3)}`;
}

/** ASS time: H:MM:SS.cc (centiseconds, rounded). */
export function formatAssTime(ms: number): string {
  const cs = Math.max(0, Math.round(ms / 10));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${pad(m)}:${pad(s)}.${pad(cs % 100)}`;
}

/** LRC time: mm:ss.xx (centiseconds; minutes may exceed 59). */
export function formatLrcTime(ms: number): string {
  const cs = Math.max(0, Math.round(ms / 10));
  const m = Math.floor(cs / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${pad(m)}:${pad(s)}.${pad(cs % 100)}`;
}

/** Human display used in the preview table: H:MM:SS.mmm */
export function formatDisplayTime(ms: number): string {
  return formatSbvTime(ms);
}

/**
 * Flexible user time input: "00:01:02,500", "1:02.5", "62.5", "62.5s", "1500ms".
 * Returns milliseconds or null when unparsable. Leading "-" / "+" allowed.
 */
export function parseTimeInput(input: string): number | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  let sign = 1;
  if (s.startsWith('-')) {
    sign = -1;
    s = s.slice(1).trim();
  } else if (s.startsWith('+')) {
    s = s.slice(1).trim();
  }
  let m = /^(\d+(?:[.,]\d+)?)\s*ms$/.exec(s);
  if (m) return sign * Math.round(Number((m[1] ?? '0').replace(',', '.')));
  m = /^(\d+(?:[.,]\d+)?)\s*s(?:ec)?$/.exec(s);
  if (m) return sign * Math.round(Number((m[1] ?? '0').replace(',', '.')) * 1000);
  m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,9}))?$/.exec(s);
  if (m) return sign * hmsToMs(m[1], m[2], m[3], m[4]);
  m = /^(\d+(?:[.,]\d+)?)$/.exec(s);
  if (m) return sign * Math.round(Number((m[1] ?? '0').replace(',', '.')) * 1000);
  return null;
}

/**
 * Parse a shift amount. A bare number is milliseconds ("-1500"); suffix with s/ms
 * ("2.5s", "-300ms") or use a clock ("-0:00:02,500").
 */
export function parseOffsetInput(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  if (/^[+-]?\d+(?:[.,]\d+)?$/.test(s)) return Math.round(Number(s.replace(',', '.')));
  return parseTimeInput(s);
}

/* ------------------------------------------------------------------ */
/* Text helpers                                                        */
/* ------------------------------------------------------------------ */

export function normalizeNewlines(text: string): string {
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}

const ENTITY_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  lrm: '',
  rlm: '',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return whole;
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    const rep = ENTITY_MAP[body.toLowerCase()];
    return rep === undefined ? whole : rep;
  });
}

function encodeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const TAG_RE = /<\/?[a-zA-Z][^<>]*>|<\d{1,}:\d{2}(?::\d{2})?[.,]\d{1,3}>/g;

/** Remove HTML-ish / WebVTT / ASS-style tags and decode entities. */
export function stripTags(text: string): string {
  return decodeEntities(text.replace(TAG_RE, '').replace(/\{\\[^}]*\}/g, ''));
}

/** Number of visible characters in a line (tags and ASS blocks ignored). */
export function visibleLength(line: string): number {
  return Array.from(stripTags(line)).length;
}

function cleanLines(text: string): string[] {
  return normalizeNewlines(text)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

interface Timing {
  start: number;
  end: number;
  settings?: string;
}

const TS = String.raw`(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,9}))?`;
const ARROW_RE = new RegExp(String.raw`^\s*${TS}\s*-->\s*${TS}(?:\s+(.*?))?\s*$`);
const SBV_RE = /^\s*(\d+):(\d{1,2}):(\d{1,2})[.,](\d{1,9})\s*,\s*(\d+):(\d{1,2}):(\d{1,2})[.,](\d{1,9})\s*$/;

function matchArrow(line: string): Timing | null {
  const m = ARROW_RE.exec(line);
  if (!m) return null;
  const t: Timing = {
    start: hmsToMs(m[1], m[2], m[3], m[4]),
    end: hmsToMs(m[5], m[6], m[7], m[8]),
  };
  const settings = m[9]?.trim();
  if (settings) t.settings = settings;
  return t;
}

function matchSbv(line: string): Timing | null {
  const m = SBV_RE.exec(line);
  if (!m) return null;
  return {
    start: hmsToMs(m[1], m[2], m[3], m[4]),
    end: hmsToMs(m[5], m[6], m[7], m[8]),
  };
}

const VTT_NON_CUE_BLOCK = /^(NOTE|STYLE|REGION)(\s|$)/;

/**
 * Shared scanner for SRT / VTT / SBV: locates timing lines, then collects text up to
 * the next block. Tolerates missing blank lines between SRT cues and drops VTT
 * NOTE / STYLE / REGION blocks as well as numeric / textual cue identifiers.
 */
function parseTimed(text: string, match: (line: string) => Timing | null, vtt: boolean): Cue[] {
  const lines = normalizeNewlines(text).split('\n');
  const at: number[] = [];
  const timings: Timing[] = [];
  lines.forEach((line, i) => {
    const t = match(line);
    if (t) {
      at.push(i);
      timings.push(t);
    }
  });

  const cues: Cue[] = [];
  for (let k = 0; k < at.length; k++) {
    const timing = timings[k];
    if (!timing) continue;
    const from = (at[k] ?? 0) + 1;
    const nextAt = at[k + 1];
    const region = lines.slice(from, nextAt ?? lines.length);
    const hasNext = nextAt !== undefined;

    const blocks: string[][] = [];
    let cur: string[] = [];
    for (const raw of region) {
      if (raw.trim() === '') {
        if (cur.length) blocks.push(cur);
        cur = [];
      } else {
        cur.push(raw);
      }
    }
    if (cur.length) blocks.push(cur);
    const trailingBlank = region.length > 0 && (region[region.length - 1] ?? '').trim() === '';

    const startsBlank = (region[0] ?? '').trim() === '';
    let kept = vtt ? blocks.filter((b) => !VTT_NON_CUE_BLOCK.test((b[0] ?? '').trim())) : blocks;
    if (startsBlank) kept = [];
    if (hasNext && !trailingBlank && kept.length > 0) {
      const last = kept[kept.length - 1] ?? [];
      if (kept.length >= 2 && last.length === 1) {
        kept = kept.slice(0, -1);
      } else if (!vtt && kept.length === 1 && last.length >= 2 && /^\d+$/.test((last[last.length - 1] ?? '').trim())) {
        kept = [last.slice(0, -1)];
      }
    }
    const body = kept
      .flat()
      .map((l) => l.trim())
      .join('\n');
    const cue: Cue = { start: timing.start, end: timing.end, text: body };
    if (timing.settings) cue.settings = timing.settings;
    cues.push(cue);
  }
  return cues;
}

/* ---- ASS / SSA ---- */

function assTextToHtml(s: string): string {
  let out = '';
  const stack: string[] = [];
  let drawing = false;
  const plain = (seg: string): string =>
    seg.replace(/\\N/g, '\n').replace(/\\n/g, '\n').replace(/\\h/g, ' ');
  const re = /\{([^}]*)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const flushText = (seg: string): void => {
    if (!drawing) out += plain(seg);
  };
  while ((m = re.exec(s)) !== null) {
    flushText(s.slice(last, m.index));
    last = m.index + m[0].length;
    const block = m[1] ?? '';
    const tagRe = /\\(?:p(\d+)|([ibus])([01])(?![0-9a-zA-Z]))/g;
    let t: RegExpExecArray | null;
    while ((t = tagRe.exec(block)) !== null) {
      if (t[1] !== undefined) {
        drawing = Number(t[1]) > 0;
        continue;
      }
      const tag = t[2] ?? '';
      const on = t[3] === '1';
      const idx = stack.lastIndexOf(tag);
      if (on && idx < 0) {
        stack.push(tag);
        out += `<${tag}>`;
      } else if (!on && idx >= 0) {
        const above = stack.slice(idx + 1);
        for (let j = above.length - 1; j >= 0; j--) out += `</${above[j]}>`;
        out += `</${tag}>`;
        stack.splice(idx, 1);
        for (const a of above) out += `<${a}>`;
      }
    }
  }
  flushText(s.slice(last));
  for (let j = stack.length - 1; j >= 0; j--) out += `</${stack[j]}>`;
  return out;
}

function assClockToMs(v: string): number | null {
  const m = /^\s*(\d+):(\d{1,2}):(\d{1,2})(?:[.,](\d{1,9}))?\s*$/.exec(v);
  if (!m) return null;
  return hmsToMs(m[1], m[2], m[3], m[4]);
}

const ASS_DEFAULT_FORMAT = ['layer', 'start', 'end', 'style', 'name', 'marginl', 'marginr', 'marginv', 'effect', 'text'];

function parseAss(text: string): Cue[] {
  const lines = normalizeNewlines(text).split('\n');
  let fmt = ASS_DEFAULT_FORMAT;
  const cues: Cue[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    const fm = /^format\s*:\s*(.*)$/i.exec(line);
    if (fm) {
      const cols = (fm[1] ?? '').split(',').map((c) => c.trim().toLowerCase());
      if (cols.includes('start') && cols.includes('end') && cols.includes('text')) fmt = cols;
      continue;
    }
    const dm = /^dialogue\s*:\s?(.*)$/i.exec(line);
    if (!dm) continue;
    const body = dm[1] ?? '';
    const n = fmt.length;
    const parts: string[] = [];
    let rest = body;
    for (let i = 0; i < n - 1; i++) {
      const comma = rest.indexOf(',');
      if (comma < 0) break;
      parts.push(rest.slice(0, comma));
      rest = rest.slice(comma + 1);
    }
    parts.push(rest);
    if (parts.length < n) continue;
    const start = assClockToMs(parts[fmt.indexOf('start')] ?? '');
    const end = assClockToMs(parts[fmt.indexOf('end')] ?? '');
    if (start === null || end === null) continue;
    const textRaw = parts[fmt.indexOf('text')] ?? '';
    cues.push({
      start,
      end,
      text: assTextToHtml(textRaw)
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .join('\n'),
    });
  }
  return cues;
}

/* ---- LRC ---- */

function parseLrc(text: string): Cue[] {
  const lines = normalizeNewlines(text).split('\n');
  let offset = 0;
  const entries: { t: number; text: string; order: number }[] = [];
  const lead = /^\s*((?:\[\d+:\d{1,2}(?:[.:]\d{1,3})?\]\s*)+)(.*)$/;
  const one = /\[(\d+):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
  let order = 0;
  for (const line of lines) {
    const off = /^\s*\[offset\s*:\s*([+-]?\d+)\s*\]/i.exec(line);
    if (off) {
      offset = Number(off[1]);
      continue;
    }
    const m = lead.exec(line);
    if (!m) continue;
    const content = (m[2] ?? '')
      .replace(/<\d+:\d{1,2}(?:[.:]\d{1,3})?>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const tags = m[1] ?? '';
    one.lastIndex = 0;
    let t: RegExpExecArray | null;
    while ((t = one.exec(tags)) !== null) {
      const ms = Number(t[1]) * 60000 + Number(t[2]) * 1000 + fracToMs(t[3]) - offset;
      entries.push({ t: Math.max(0, ms), text: content, order: order++ });
    }
  }
  entries.sort((a, b) => a.t - b.t || a.order - b.order);
  const cues: Cue[] = [];
  entries.forEach((e, i) => {
    if (!e.text) return;
    const next = entries[i + 1];
    const end = next ? Math.max(next.t, e.t) : e.t + Math.min(6000, Math.max(2000, e.text.length * 70));
    cues.push({ start: e.t, end, text: e.text });
  });
  return cues;
}

/* ---- TTML / DFXP ---- */

function ttmlAttrs(tagBody: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tagBody)) !== null) {
    const name = (m[1] ?? '').replace(/^.*:/, '');
    out[name] = m[2] ?? m[3] ?? '';
    if ((m[1] ?? '').toLowerCase() === 'xml:id') out['xml:id'] = m[2] ?? m[3] ?? '';
  }
  return out;
}

interface TtmlTiming {
  frameRate: number;
  tickRate: number;
}

function ttmlTime(v: string | undefined, tm: TtmlTiming): number | null {
  if (!v) return null;
  const s = v.trim();
  let m = /^(\d+):(\d{2}):(\d{2})(?:\.(\d+)|:(\d+)(?:\.\d+)?)?$/.exec(s);
  if (m) {
    const base = Number(m[1]) * 3600000 + Number(m[2]) * 60000 + Number(m[3]) * 1000;
    if (m[4] !== undefined) return base + fracToMs(m[4]);
    if (m[5] !== undefined) return base + Math.round((Number(m[5]) * 1000) / tm.frameRate);
    return base;
  }
  m = /^(\d+(?:\.\d+)?)(h|ms|m|s|f|t)$/.exec(s);
  if (m) {
    const n = Number(m[1]);
    switch (m[2]) {
      case 'h':
        return Math.round(n * 3600000);
      case 'm':
        return Math.round(n * 60000);
      case 's':
        return Math.round(n * 1000);
      case 'ms':
        return Math.round(n);
      case 'f':
        return Math.round((n * 1000) / tm.frameRate);
      default:
        return Math.round((n * 1000) / tm.tickRate);
    }
  }
  return null;
}

interface TtmlStyleFlags {
  i?: boolean;
  b?: boolean;
  u?: boolean;
}

function ttmlFlags(attrs: Record<string, string>, styles: Record<string, TtmlStyleFlags>): TtmlStyleFlags {
  const flags: TtmlStyleFlags = {};
  for (const id of (attrs['style'] ?? '').split(/\s+/)) {
    const st = styles[id];
    if (st) Object.assign(flags, st);
  }
  if ((attrs['fontStyle'] ?? '') === 'italic' || attrs['fontStyle'] === 'oblique') flags.i = true;
  if (attrs['fontWeight'] === 'bold') flags.b = true;
  if ((attrs['textDecoration'] ?? '').includes('underline')) flags.u = true;
  return flags;
}

function ttmlInner(inner: string, styles: Record<string, TtmlStyleFlags>): string {
  let out = '';
  const stack: string[][] = [];
  const re = /<(\/?)([\w:.-]+)([^>]*?)(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) {
    if (m[5] !== undefined) {
      out += decodeEntities(m[5].replace(/\s+/g, ' '));
      continue;
    }
    const closing = m[1] === '/';
    const name = (m[2] ?? '').replace(/^.*:/, '').toLowerCase();
    const selfClose = m[4] === '/';
    if (name === 'br') {
      if (!closing) out += '\n';
      continue;
    }
    if (name !== 'span') continue;
    if (closing) {
      const tags = stack.pop() ?? [];
      for (let j = tags.length - 1; j >= 0; j--) out += `</${tags[j]}>`;
    } else if (!selfClose) {
      const f = ttmlFlags(ttmlAttrs(m[3] ?? ''), styles);
      const tags: string[] = [];
      for (const t of ['i', 'b', 'u'] as const) {
        if (f[t]) {
          tags.push(t);
          out += `<${t}>`;
        }
      }
      stack.push(tags);
    }
  }
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join('\n');
}

function parseTtml(text: string): Cue[] {
  const src = normalizeNewlines(text);
  const root = /<(?:\w+:)?tt\b([^>]*)>/i.exec(src);
  const rootAttrs = root ? ttmlAttrs(root[1] ?? '') : {};
  const frameRate = (Number(rootAttrs['frameRate']) || 30) * (rootAttrs['frameRateMultiplier'] ? multiplier(rootAttrs['frameRateMultiplier']) : 1);
  const tm: TtmlTiming = { frameRate, tickRate: Number(rootAttrs['tickRate']) || 10000000 };

  const styles: Record<string, TtmlStyleFlags> = {};
  const styleRe = /<(?:\w+:)?style\b([^>]*?)\/?>/gi;
  let sm: RegExpExecArray | null;
  while ((sm = styleRe.exec(src)) !== null) {
    const a = ttmlAttrs(sm[1] ?? '');
    const id = a['xml:id'] ?? a['id'];
    if (!id) continue;
    const f = ttmlFlags({ ...a, style: '' }, {});
    styles[id] = f;
  }

  const cues: Cue[] = [];
  const pRe = /<(?:\w+:)?p\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?p\s*>)/gi;
  let pm: RegExpExecArray | null;
  while ((pm = pRe.exec(src)) !== null) {
    const a = ttmlAttrs(pm[1] ?? '');
    const begin = ttmlTime(a['begin'], tm);
    let end = ttmlTime(a['end'], tm);
    const dur = ttmlTime(a['dur'], tm);
    if (begin === null) continue;
    if (end === null && dur !== null) end = begin + dur;
    if (end === null) continue;
    cues.push({ start: begin, end, text: ttmlInner(pm[2] ?? '', styles) });
  }
  return cues;
}

function multiplier(v: string): number {
  const [a, b] = v.trim().split(/\s+/).map(Number);
  if (a && b && Number.isFinite(a) && Number.isFinite(b)) return a / b;
  return 1;
}

/* ---- Detection & entry point ---- */

export function detectFormat(input: string): SubFormat | null {
  const text = normalizeNewlines(input);
  const head = text.trimStart();
  if (!head) return null;
  if (/^WEBVTT/.test(head)) return 'vtt';
  if (/^<\?xml[\s\S]{0,400}<(?:\w+:)?tt[\s>]/i.test(head) || /^<(?:\w+:)?tt[\s>]/i.test(head)) return 'ttml';
  if (/^\[script info\]/im.test(text) || /^\s*dialogue\s*:/im.test(text) || /^\s*\[events\]/im.test(text)) return 'ass';
  const lines = text.split('\n');
  let arrow = 0;
  let sbv = 0;
  let lrc = 0;
  for (const l of lines) {
    if (matchArrow(l)) arrow++;
    else if (matchSbv(l)) sbv++;
    else if (/^\s*\[\d+:\d{1,2}(?:[.:]\d{1,3})?\]/.test(l)) lrc++;
  }
  if (arrow > 0 && arrow >= sbv && arrow >= lrc) return 'srt';
  if (sbv > 0 && sbv >= lrc) return 'sbv';
  if (lrc > 0) return 'lrc';
  return null;
}

export function parseSubtitles(input: string, format?: SubFormat | 'auto'): ParseResult | null {
  const fmt = !format || format === 'auto' ? detectFormat(input) : format;
  if (!fmt) return null;
  let cues: Cue[];
  switch (fmt) {
    case 'srt':
      // trailing "X1:100 X2:200" coordinates are not WebVTT settings
      cues = parseTimed(input, matchArrow, false).map(({ start, end, text }) => ({ start, end, text }));
      break;
    case 'vtt':
      cues = parseTimed(input, matchArrow, true);
      break;
    case 'sbv':
      cues = parseTimed(input, matchSbv, false);
      break;
    case 'ass':
      cues = parseAss(input);
      break;
    case 'lrc':
      cues = parseLrc(input);
      break;
    case 'ttml':
      cues = parseTtml(input);
      break;
  }
  return { format: fmt, cues };
}

/* ------------------------------------------------------------------ */
/* Serialisation                                                       */
/* ------------------------------------------------------------------ */

export type TxtLayout = 'lines' | 'blocks' | 'paragraph';

export interface SerializeOptions {
  /** LRC: write an empty timestamp at a cue's end when the next cue does not follow immediately. */
  lrcEndMarkers?: boolean;
  txtLayout?: TxtLayout;
  /** VTT: write numeric cue identifiers. */
  vttNumbered?: boolean;
  /** TTML: xml:lang value. */
  lang?: string;
}

/** Normalise a cue's text for writing into a block based format. */
function blockText(text: string): string {
  return cleanLines(text)
    .join('\n')
    .replace(/-->/g, '->');
}

function csvField(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function htmlToAss(text: string): string {
  let out = '';
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)[^<>]*>|([^<]+|<)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[3] !== undefined) {
      out += decodeEntities(m[3]).replace(/\{/g, '(').replace(/\}/g, ')');
      continue;
    }
    const name = (m[2] ?? '').toLowerCase();
    const tag = name === 'strike' ? 's' : name;
    if (tag === 'br') {
      out += '\n';
      continue;
    }
    if (tag === 'i' || tag === 'b' || tag === 'u' || tag === 's') {
      out += `{\\${tag}${m[1] === '/' ? '0' : '1'}}`;
    }
  }
  return out.split('\n').join('\\N');
}

function htmlToTtml(text: string): string {
  let out = '';
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)[^<>]*>|([^<]+|<)/g;
  let m: RegExpExecArray | null;
  const open: string[] = [];
  while ((m = re.exec(text)) !== null) {
    if (m[3] !== undefined) {
      out += encodeXml(decodeEntities(m[3])).split('\n').join('<br/>');
      continue;
    }
    const name = (m[2] ?? '').toLowerCase();
    const attr =
      name === 'i' ? 'tts:fontStyle="italic"' : name === 'b' ? 'tts:fontWeight="bold"' : name === 'u' ? 'tts:textDecoration="underline"' : '';
    if (!attr) continue;
    if (m[1] === '/') {
      const idx = open.lastIndexOf(name);
      if (idx >= 0) {
        open.splice(idx, 1);
        out += '</span>';
      }
    } else {
      open.push(name);
      out += `<span ${attr}>`;
    }
  }
  for (let i = 0; i < open.length; i++) out += '</span>';
  return out;
}

export function serialize(cues: Cue[], format: OutFormat, opts: SerializeOptions = {}): string {
  switch (format) {
    case 'srt':
      return cues
        .map((c, i) => `${i + 1}\n${formatSrtTime(c.start)} --> ${formatSrtTime(c.end)}\n${blockText(c.text)}\n`)
        .join('\n');
    case 'vtt': {
      const body = cues
        .map((c, i) => {
          const id = opts.vttNumbered ? `${i + 1}\n` : '';
          const settings = c.settings ? ` ${c.settings}` : '';
          return `${id}${formatVttTime(c.start)} --> ${formatVttTime(c.end)}${settings}\n${blockText(c.text)}\n`;
        })
        .join('\n');
      return `WEBVTT\n\n${body}`;
    }
    case 'sbv':
      return cues.map((c) => `${formatSbvTime(c.start)},${formatSbvTime(c.end)}\n${blockText(c.text)}\n`).join('\n');
    case 'ass': {
      const header = [
        '[Script Info]',
        '; Converted with Open Utility Tools',
        'ScriptType: v4.00+',
        'WrapStyle: 0',
        'ScaledBorderAndShadow: yes',
        'PlayResX: 1920',
        'PlayResY: 1080',
        '',
        '[V4+ Styles]',
        'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
        'Style: Default,Arial,56,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,40,1',
        '',
        '[Events]',
        'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      ];
      const events = cues.map(
        (c) => `Dialogue: 0,${formatAssTime(c.start)},${formatAssTime(c.end)},Default,,0,0,0,,${htmlToAss(cleanLines(c.text).join('\n'))}`
      );
      return header.concat(events).join('\n') + '\n';
    }
    case 'lrc': {
      const out: string[] = [];
      cues.forEach((c, i) => {
        const line = cleanLines(stripTags(c.text)).join(' ');
        out.push(`[${formatLrcTime(c.start)}]${line}`);
        if (opts.lrcEndMarkers) {
          const next = cues[i + 1];
          if (!next || Math.abs(next.start - c.end) >= 10) out.push(`[${formatLrcTime(c.end)}]`);
        }
      });
      return out.join('\n') + '\n';
    }
    case 'ttml': {
      const lang = opts.lang && opts.lang.trim() ? opts.lang.trim() : 'en';
      const ps = cues
        .map((c) => `      <p begin="${formatVttTime(c.start)}" end="${formatVttTime(c.end)}">${htmlToTtml(cleanLines(c.text).join('\n'))}</p>`)
        .join('\n');
      return (
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling" xml:lang="${encodeXml(lang).replace(/"/g, '&quot;')}">\n` +
        '  <body>\n    <div>\n' +
        ps +
        '\n    </div>\n  </body>\n</tt>\n'
      );
    }
    case 'txt': {
      const layout = opts.txtLayout ?? 'lines';
      const texts = cues.map((c) => cleanLines(stripTags(c.text)));
      if (layout === 'blocks') return texts.map((t) => t.join('\n')).filter(Boolean).join('\n\n') + '\n';
      if (layout === 'paragraph') return texts.map((t) => t.join(' ')).filter(Boolean).join(' ') + '\n';
      return texts.map((t) => t.join(' ')).filter(Boolean).join('\n') + '\n';
    }
    case 'csv': {
      const rows = ['index,start,end,text'];
      cues.forEach((c, i) => {
        rows.push([String(i + 1), formatVttTime(c.start), formatVttTime(c.end), csvField(cleanLines(c.text).join('\n'))].join(','));
      });
      return rows.join('\n') + '\n';
    }
  }
}

/* ------------------------------------------------------------------ */
/* Text clean-up                                                       */
/* ------------------------------------------------------------------ */

export interface CleanOptions {
  stripTags: boolean;
  removeSdh: boolean;
  removeSpeakers: boolean;
  mergeLines: boolean;
  /** 0 = no wrapping. */
  maxLineChars: number;
  dropEmpty: boolean;
}

export const DEFAULT_CLEAN: CleanOptions = {
  stripTags: false,
  removeSdh: false,
  removeSpeakers: false,
  mergeLines: false,
  maxLineChars: 0,
  dropEmpty: true,
};

const MUSIC_RE = /[♪♫♬♩]/;

/** Remove [sound], (sound), {sound} annotations, musical-note lines and stray dashes. */
export function removeHearingImpaired(text: string): string {
  const lines = normalizeNewlines(text).split('\n');
  const dashed = lines.filter((l) => /^\s*[-–—]\s*/.test(l)).length;
  const kept: string[] = [];
  for (const line of lines) {
    if (MUSIC_RE.test(line)) continue;
    let l = line;
    let prev: string;
    do {
      prev = l;
      l = l.replace(/\[[^[\]]*\]|\([^()]*\)|\{[^{}]*\}/g, '');
    } while (l !== prev);
    l = l.replace(/\s{2,}/g, ' ').trim();
    if (l === '' || (l !== line.trim() && /^[-–—\s.…:;,!?]*$/.test(l))) continue;
    kept.push(l);
  }
  if (kept.length === 1 && dashed >= 2) {
    return (kept[0] ?? '').replace(/^[-–—]\s*/, '');
  }
  return kept.join('\n');
}

/** Remove leading speaker labels such as "JOHN:" / ">> BOB:". */
export function removeSpeakerLabels(text: string): string {
  return normalizeNewlines(text)
    .split('\n')
    .map((l) => l.replace(/^(\s*(?:[-–—]\s*)?)(?:>>\s*)?[A-Z][A-Z0-9 .'_-]{0,24}:\s+/, '$1'))
    .join('\n');
}

/**
 * Greedy word wrap, then narrows the width as far as possible without adding lines so
 * that two-line cues come out balanced instead of one long + one short line.
 */
export function wrapText(text: string, maxChars: number): string {
  const max = Math.max(8, Math.floor(maxChars));
  const words = text.match(/(?:<[^<>]*>|[^\s<]|<)+/g) ?? [];
  if (words.length === 0) return '';
  const lens = words.map(visibleLength);
  const greedy = (limit: number): string[] => {
    const out: string[] = [];
    let line = '';
    let len = 0;
    words.forEach((w, i) => {
      const wl = lens[i] ?? 0;
      if (line === '') {
        line = w;
        len = wl;
      } else if (len + 1 + wl > limit) {
        out.push(line);
        line = w;
        len = wl;
      } else {
        line += ` ${w}`;
        len += 1 + wl;
      }
    });
    if (line) out.push(line);
    return out;
  };
  const base = greedy(max);
  if (base.length < 2) return base.join('\n');
  const total = lens.reduce((a, b) => a + b, 0) + words.length - 1;
  for (let w = Math.ceil(total / base.length); w < max; w++) {
    const attempt = greedy(w);
    if (attempt.length === base.length) return attempt.join('\n');
  }
  return base.join('\n');
}

export function cleanCueText(text: string, o: CleanOptions): string {
  let t = normalizeNewlines(text);
  if (o.stripTags) t = stripTags(t);
  if (o.removeSdh) t = removeHearingImpaired(t);
  if (o.removeSpeakers) t = removeSpeakerLabels(t);
  let lines = t
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (o.mergeLines || o.maxLineChars > 0) {
    const joined = lines.join(' ');
    if (o.maxLineChars > 0) return wrapText(joined, o.maxLineChars);
    lines = [joined];
  }
  return lines.join('\n');
}

export function cleanCues(cues: Cue[], o: CleanOptions): Cue[] {
  const out: Cue[] = [];
  for (const c of cues) {
    const text = cleanCueText(c.text, o);
    if (o.dropEmpty && stripTags(text).trim() === '') continue;
    out.push({ ...c, text });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Timing tools                                                        */
/* ------------------------------------------------------------------ */

/** 1-based inclusive cue range. null = every cue. */
export type CueRange = { from: number; to: number } | null;

function inRange(i: number, range: CueRange): boolean {
  return !range || (i + 1 >= range.from && i + 1 <= range.to);
}

/** t' = m * t + c on every start/end of cues in range. Negative results clamp to 0. */
export function applyLinear(cues: Cue[], m: number, c: number, range: CueRange = null): Cue[] {
  return cues.map((cue, i) => {
    if (!inRange(i, range)) return cue;
    return {
      ...cue,
      start: Math.max(0, Math.round(cue.start * m + c)),
      end: Math.max(0, Math.round(cue.end * m + c)),
    };
  });
}

export function shiftCues(cues: Cue[], ms: number, range: CueRange = null): Cue[] {
  return applyLinear(cues, 1, ms, range);
}

/** Shift so the first cue of the range starts at targetMs. */
export function shiftToFirstStart(cues: Cue[], targetMs: number, range: CueRange = null): Cue[] {
  const idx = cues.findIndex((_, i) => inRange(i, range));
  const first = cues[idx];
  if (!first) return cues;
  return shiftCues(cues, targetMs - first.start, range);
}

export interface TwoPoint {
  m: number;
  c: number;
}

/** Map cue A's start to aNew and cue B's start to bNew, linearly. */
export function solveTwoPoint(aStart: number, aNew: number, bStart: number, bNew: number): TwoPoint | null {
  if (aStart === bStart) return null;
  const m = (bNew - aNew) / (bStart - aStart);
  if (!Number.isFinite(m) || m <= 0) return null;
  return { m, c: aNew - m * aStart };
}

export const FPS_PRESETS: { id: string; label: string; value: number }[] = [
  { id: '23.976', label: '23.976', value: 24000 / 1001 },
  { id: '24', label: '24', value: 24 },
  { id: '25', label: '25', value: 25 },
  { id: '29.97', label: '29.97', value: 30000 / 1001 },
  { id: '30', label: '30', value: 30 },
  { id: '48', label: '48', value: 48 },
  { id: '50', label: '50', value: 50 },
  { id: '59.94', label: '59.94', value: 60000 / 1001 },
  { id: '60', label: '60', value: 60 },
];

/** Time scale for retiming subtitles authored for `from` fps onto video running at `to` fps. */
export function fpsFactor(from: number, to: number): number {
  return from / to;
}

/* ------------------------------------------------------------------ */
/* Post processing                                                     */
/* ------------------------------------------------------------------ */

export interface PostOptions {
  sort: boolean;
  fixOverlaps: boolean;
  /** Gap (ms) kept between a trimmed cue and the next. */
  overlapGap: number;
  /** 0 = off */
  minDuration: number;
  /** 0 = off */
  maxDuration: number;
}

export const DEFAULT_POST: PostOptions = {
  sort: true,
  fixOverlaps: false,
  overlapGap: 0,
  minDuration: 0,
  maxDuration: 0,
};

export function sortCues(cues: Cue[]): Cue[] {
  return cues
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.start - b.c.start || a.c.end - b.c.end || a.i - b.i)
    .map((x) => x.c);
}

export function postProcess(input: Cue[], o: PostOptions): Cue[] {
  let cues = o.sort ? sortCues(input) : input.map((c) => ({ ...c }));
  cues = cues.map((c) => ({ ...c }));
  if (o.maxDuration > 0) {
    for (const c of cues) if (c.end - c.start > o.maxDuration) c.end = c.start + o.maxDuration;
  }
  if (o.fixOverlaps) {
    for (let i = 0; i < cues.length - 1; i++) {
      const c = cues[i];
      const n = cues[i + 1];
      if (!c || !n) continue;
      if (c.end > n.start && n.start > c.start) {
        c.end = Math.max(c.start + 1, n.start - o.overlapGap);
        if (c.end > n.start) c.end = n.start;
      }
    }
  }
  if (o.minDuration > 0) {
    for (let i = 0; i < cues.length; i++) {
      const c = cues[i];
      if (!c) continue;
      if (c.end - c.start >= o.minDuration) continue;
      let target = c.start + o.minDuration;
      const n = cues[i + 1];
      if (n && n.start > c.start) target = Math.min(target, Math.max(c.end, n.start - o.overlapGap));
      c.end = Math.max(c.end, target);
    }
  }
  return cues;
}

/* ------------------------------------------------------------------ */
/* Analysis (warnings)                                                 */
/* ------------------------------------------------------------------ */

export type WarningKind = 'overlap' | 'negative' | 'zero' | 'long-line' | 'fast' | 'empty';

export interface CueWarnings {
  kinds: WarningKind[];
  /** Characters per second (visible, excluding line breaks). */
  cps: number;
  longestLine: number;
}

export const WARNING_LABELS: Record<WarningKind, string> = {
  overlap: 'Overlaps next cue',
  negative: 'End before start',
  zero: 'Zero duration',
  'long-line': 'Line too long',
  fast: 'Reading speed too high',
  empty: 'Empty text',
};

export function analyzeCues(cues: Cue[], maxLine = 42, maxCps = 20): CueWarnings[] {
  return cues.map((c, i) => {
    const kinds: WarningKind[] = [];
    const lines = cleanLines(c.text);
    const lens = lines.map(visibleLength);
    const longest = lens.length ? Math.max(...lens) : 0;
    const dur = c.end - c.start;
    const chars = lens.reduce((a, b) => a + b, 0);
    const cps = dur > 0 ? chars / (dur / 1000) : 0;
    const next = cues[i + 1];
    if (next && c.end > next.start) kinds.push('overlap');
    if (dur < 0) kinds.push('negative');
    else if (dur === 0) kinds.push('zero');
    if (longest > maxLine) kinds.push('long-line');
    if (dur > 0 && cps > maxCps) kinds.push('fast');
    if (chars === 0) kinds.push('empty');
    return { kinds, cps, longestLine: longest };
  });
}

/* ------------------------------------------------------------------ */
/* Byte decoding                                                       */
/* ------------------------------------------------------------------ */

export const ENCODINGS: { id: string; label: string }[] = [
  { id: 'auto', label: 'Auto (UTF-8, else Windows-1252)' },
  { id: 'utf-8', label: 'UTF-8' },
  { id: 'utf-16le', label: 'UTF-16 LE' },
  { id: 'utf-16be', label: 'UTF-16 BE' },
  { id: 'windows-1252', label: 'Western (Windows-1252)' },
  { id: 'windows-1250', label: 'Central European (Windows-1250)' },
  { id: 'windows-1251', label: 'Cyrillic (Windows-1251)' },
  { id: 'windows-1253', label: 'Greek (Windows-1253)' },
  { id: 'windows-1254', label: 'Turkish (Windows-1254)' },
  { id: 'windows-1255', label: 'Hebrew (Windows-1255)' },
  { id: 'windows-1256', label: 'Arabic (Windows-1256)' },
  { id: 'shift_jis', label: 'Japanese (Shift_JIS)' },
  { id: 'gbk', label: 'Chinese Simplified (GBK)' },
  { id: 'big5', label: 'Chinese Traditional (Big5)' },
  { id: 'euc-kr', label: 'Korean (EUC-KR)' },
];

/** Decode subtitle file bytes. "auto" honours BOMs, tries strict UTF-8, then Windows-1252. */
export function decodeSubtitleBytes(bytes: Uint8Array, encoding: string): { text: string; used: string } {
  if (encoding === 'auto') {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder('utf-16le').decode(bytes), used: 'utf-16le' };
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: new TextDecoder('utf-16be').decode(bytes), used: 'utf-16be' };
    try {
      return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), used: 'utf-8' };
    } catch {
      return { text: new TextDecoder('windows-1252').decode(bytes), used: 'windows-1252' };
    }
  }
  return { text: new TextDecoder(encoding).decode(bytes), used: encoding };
}
