/**
 * Pure text-measurement helpers: grapheme/code point/byte counts, GSM-7 vs UCS-2 SMS segmentation,
 * smart-punctuation replacement and platform-specific length rules (X/Twitter weighting, URL = 23, …).
 */

/* ------------------------------------------------------------------ */
/* Graphemes & basic counts                                             */
/* ------------------------------------------------------------------ */

interface SegmenterLike {
  segment(input: string): Iterable<{ segment: string }>;
}

let graphemeSegmenter: SegmenterLike | null | undefined;

function getSegmenter(): SegmenterLike | null {
  if (graphemeSegmenter !== undefined) return graphemeSegmenter;
  try {
    const Ctor = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => SegmenterLike }).Segmenter;
    graphemeSegmenter = Ctor ? new Ctor(undefined, { granularity: 'grapheme' }) : null;
  } catch {
    graphemeSegmenter = null;
  }
  return graphemeSegmenter;
}

export function hasSegmenter(): boolean {
  return getSegmenter() !== null;
}

const isRegionalIndicator = (cp: number): boolean => cp >= 0x1f1e6 && cp <= 0x1f1ff;
const isEmojiModifier = (cp: number): boolean => cp >= 0x1f3fb && cp <= 0x1f3ff;
const MARK_RE = /^\p{M}$/u;
const PICTO_RE = /^\p{Extended_Pictographic}$/u;

function isExtender(cp: number, ch: string): boolean {
  return (
    cp === 0x200d ||
    cp === 0x200c ||
    (cp >= 0xfe00 && cp <= 0xfe0f) ||
    isEmojiModifier(cp) ||
    (cp >= 0xe0020 && cp <= 0xe007f) ||
    MARK_RE.test(ch)
  );
}

/**
 * Approximate extended-grapheme-cluster splitter used when Intl.Segmenter is missing: handles CRLF,
 * combining marks, variation selectors, skin tones, ZWJ emoji sequences, flags and keycaps.
 */
export function splitGraphemesFallback(text: string): string[] {
  const cps = Array.from(text);
  const out: string[] = [];
  let i = 0;
  while (i < cps.length) {
    let cluster = cps[i] ?? '';
    const first = cluster.codePointAt(0) ?? 0;
    i++;
    if (cluster === '\r' && cps[i] === '\n') {
      out.push('\r\n');
      i++;
      continue;
    }
    if (isRegionalIndicator(first) && isRegionalIndicator(cps[i]?.codePointAt(0) ?? 0)) {
      cluster += cps[i] ?? '';
      i++;
    }
    while (i < cps.length) {
      const c = cps[i] ?? '';
      const cp = c.codePointAt(0) ?? 0;
      if (!isExtender(cp, c)) break;
      cluster += c;
      i++;
      if (cp === 0x200d) {
        const n = cps[i] ?? '';
        if (n && PICTO_RE.test(n)) {
          cluster += n;
          i++;
        }
      }
    }
    out.push(cluster);
  }
  return out;
}

export function splitGraphemes(text: string, forceFallback = false): string[] {
  const seg = forceFallback ? null : getSegmenter();
  if (!seg) return splitGraphemesFallback(text);
  const out: string[] = [];
  for (const s of seg.segment(text)) out.push(s.segment);
  return out;
}

export function countGraphemes(text: string, forceFallback = false): number {
  if (text === '') return 0;
  return splitGraphemes(text, forceFallback).length;
}

export function countCodePoints(text: string): number {
  let n = 0;
  for (const _ of text) n++;
  return n;
}

export function countUtf8Bytes(text: string): number {
  let n = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    n += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return n;
}

export function countWords(text: string): number {
  return text.match(/\S+/g)?.length ?? 0;
}

export function countLines(text: string): number {
  return text === '' ? 0 : text.split(/\r\n|\r|\n/).length;
}

export interface BasicCounts {
  graphemes: number;
  codePoints: number;
  utf16: number;
  bytes: number;
  words: number;
  lines: number;
}

export function basicCounts(text: string): BasicCounts {
  return {
    graphemes: countGraphemes(text),
    codePoints: countCodePoints(text),
    utf16: text.length,
    bytes: countUtf8Bytes(text),
    words: countWords(text),
    lines: countLines(text),
  };
}

/* ------------------------------------------------------------------ */
/* SMS: GSM 03.38                                                       */
/* ------------------------------------------------------------------ */

// 128-entry GSM 7-bit default alphabet; index 0x1B is the escape to the extension table.
const GSM_BASIC_STRING =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\u001bÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';

export const GSM_BASIC: ReadonlySet<string> = new Set(Array.from(GSM_BASIC_STRING).filter((c) => c !== '\u001b'));
/** Characters sent as ESC + code: each costs two septets. */
export const GSM_EXTENSION: ReadonlySet<string> = new Set(['\f', '^', '{', '}', '\\', '[', '~', ']', '|', '€']);

export type SmsEncoding = 'GSM-7' | 'UCS-2';

/** Septet cost of a single character in GSM-7 (1 basic, 2 extension) or 0 if it needs UCS-2. */
export function gsmCost(ch: string): 0 | 1 | 2 {
  if (GSM_BASIC.has(ch)) return 1;
  if (GSM_EXTENSION.has(ch)) return 2;
  return 0;
}

export interface NonGsmChar {
  char: string;
  codePoint: number;
  /** 1-based position in code points. */
  position: number;
}

export interface SmsSegment {
  text: string;
  units: number;
}

export interface SmsAnalysis {
  encoding: SmsEncoding;
  /** Septets (GSM-7) or UTF-16 code units (UCS-2). */
  units: number;
  segments: number;
  /** Capacity of one segment in the chosen mode (160/153 or 70/67). */
  perSegment: number;
  singleLimit: number;
  remaining: number;
  segmentList: SmsSegment[];
  nonGsm: NonGsmChar[];
  /** Number of extension-table characters (each costs 2). */
  extensionChars: number;
}

export function analyzeSms(text: string): SmsAnalysis {
  const chars = Array.from(text);
  const nonGsm: NonGsmChar[] = [];
  let extensionChars = 0;
  chars.forEach((ch, i) => {
    const c = gsmCost(ch);
    if (c === 0) nonGsm.push({ char: ch, codePoint: ch.codePointAt(0) ?? 0, position: i + 1 });
    else if (c === 2) extensionChars++;
  });
  const encoding: SmsEncoding = nonGsm.length === 0 ? 'GSM-7' : 'UCS-2';
  const cost = (ch: string): number => (encoding === 'GSM-7' ? gsmCost(ch) : ch.length);
  const singleLimit = encoding === 'GSM-7' ? 160 : 70;
  const multiLimit = encoding === 'GSM-7' ? 153 : 67;
  let units = 0;
  for (const ch of chars) units += cost(ch);

  const segmentList: SmsSegment[] = [];
  if (units > 0) {
    if (units <= singleLimit) {
      segmentList.push({ text, units });
    } else {
      let cur = '';
      let used = 0;
      for (const ch of chars) {
        const c = cost(ch);
        if (used + c > multiLimit) {
          segmentList.push({ text: cur, units: used });
          cur = '';
          used = 0;
        }
        cur += ch;
        used += c;
      }
      if (used > 0) segmentList.push({ text: cur, units: used });
    }
  }
  const segments = segmentList.length;
  const perSegment = segments > 1 ? multiLimit : singleLimit;
  const last = segmentList[segments - 1];
  return {
    encoding,
    units,
    segments,
    perSegment,
    singleLimit,
    remaining: last ? perSegment - last.units : singleLimit,
    segmentList,
    nonGsm,
    extensionChars,
  };
}

/* ------------------------------------------------------------------ */
/* Smart punctuation -> GSM-safe                                        */
/* ------------------------------------------------------------------ */

const SMART_MAP: [RegExp, string, string][] = [
  [/[‘’‚‛′ʼ`´]/g, "'", 'curly single quotes / apostrophes'],
  [/[“”„‟″«»]/g, '"', 'curly double quotes'],
  [/[‐‑‒–—―−]/g, '-', 'dashes / minus'],
  [/…/g, '...', 'ellipsis'],
  [/[  -   　]/g, ' ', 'non-breaking & special spaces'],
  [/[​-‍⁠﻿­]/g, '', 'zero-width characters / soft hyphen'],
  [/•/g, '*', 'bullet'],
  [/[·∙]/g, '-', 'middle dot'],
  [/‹/g, '<', 'single angle quote'],
  [/›/g, '>', 'single angle quote'],
  [/©/g, '(c)', 'copyright sign'],
  [/®/g, '(R)', 'registered sign'],
  [/™/g, 'TM', 'trade mark sign'],
  [/×/g, 'x', 'multiplication sign'],
  [/÷/g, '/', 'division sign'],
];

export interface Replacement {
  label: string;
  count: number;
}

/** Replace typographic characters with GSM-7 safe equivalents (after NFC composition). */
export function replaceSmartPunctuation(text: string): { text: string; replacements: Replacement[] } {
  const replacements: Replacement[] = [];
  let out = text.normalize('NFC');
  if (out !== text) {
    const n = Math.max(1, countCodePoints(text) - countCodePoints(out));
    replacements.push({ label: 'decomposed accents composed (NFC)', count: n });
  }
  for (const [re, to, label] of SMART_MAP) {
    let count = 0;
    out = out.replace(re, () => {
      count++;
      return to;
    });
    if (count > 0) replacements.push({ label, count });
  }
  // Fullwidth ASCII forms (！ … ～) -> ASCII
  let fw = 0;
  out = out.replace(/[！-～]/g, (c) => {
    fw++;
    return String.fromCharCode(c.charCodeAt(0) - 0xfee0);
  });
  if (fw > 0) replacements.push({ label: 'fullwidth ASCII forms', count: fw });
  return { text: out, replacements };
}

/* ------------------------------------------------------------------ */
/* URLs and X/Twitter weighting                                         */
/* ------------------------------------------------------------------ */

const TLDS =
  'com|net|org|edu|gov|mil|int|info|biz|io|co|ai|app|dev|me|tv|us|uk|ca|au|de|fr|es|it|nl|se|no|dk|fi|pl|ru|jp|cn|kr|in|br|mx|ch|at|be|ie|nz|za|xyz|online|site|tech|store|shop|blog|page|link|ly|gl|cc|fm|sh|to|ws|club|live|news|world|cloud|agency|design|digital|email|group|media|network|studio|today|top|vip|work';

const URL_SCHEME_RE = /https?:\/\/[^\s<>"]+/gi;
const URL_ANY_RE = new RegExp(
  String.raw`https?:\/\/[^\s<>"]+|(?<![@\w./-])www\.[^\s<>"]+|(?<![@\w./-])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:${TLDS})\b(?::\d+)?(?:\/[^\s<>"]*)?`,
  'gi'
);

export interface UrlMatch {
  start: number;
  end: number;
  text: string;
}

/** Find URL-like spans (approximate: scheme URLs, www. hosts, and bare domains on common TLDs). */
export function findUrls(text: string, opts: { bare: boolean } = { bare: true }): UrlMatch[] {
  const re = opts.bare ? URL_ANY_RE : URL_SCHEME_RE;
  re.lastIndex = 0;
  const out: UrlMatch[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let t = m[0];
    // Trailing punctuation belongs to the sentence, not the URL; keep balanced closing brackets.
    for (;;) {
      const last = t[t.length - 1] ?? '';
      if (/[.,;:!?'"]/.test(last)) t = t.slice(0, -1);
      else if (last === ')' && !t.includes('(')) t = t.slice(0, -1);
      else if ((last === ']' && !t.includes('[')) || (last === '}' && !t.includes('{'))) t = t.slice(0, -1);
      else break;
    }
    if (t.length === 0) continue;
    out.push({ start: m.index, end: m.index + t.length, text: t });
    re.lastIndex = m.index + t.length;
  }
  return out;
}

const TWITTER_RANGES: [number, number][] = [
  [0, 4351],
  [8192, 8205],
  [8208, 8223],
  [8242, 8247],
];

function twitterCodePointWeight(cp: number): number {
  for (const [a, b] of TWITTER_RANGES) if (cp >= a && cp <= b) return 100;
  return 200;
}

const EMOJI_GRAPHEME_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]️?⃣/u;

export interface TwitterCount {
  /** Weighted length (what X compares against 280). */
  weighted: number;
  urls: number;
}

/** Approximation of twitter-text v3 weighting: Latin etc. = 1, CJK/most symbols = 2, emoji sequence = 2, URL = 23. */
export function twitterLength(text: string, forceFallback = false): TwitterCount {
  const nfc = text.normalize('NFC');
  const urls = findUrls(nfc, { bare: true });
  let weight = 0;
  let pos = 0;
  const addPlain = (s: string): void => {
    if (!s) return;
    for (const g of splitGraphemes(s, forceFallback)) {
      const cps = Array.from(g);
      const firstCp = cps[0]?.codePointAt(0) ?? 0;
      const emojiLike =
        EMOJI_GRAPHEME_RE.test(g) && (twitterCodePointWeight(firstCp) === 200 || /[‍️⃣]|\p{Regional_Indicator}|[\u{1F3FB}-\u{1F3FF}]/u.test(g));
      if (emojiLike) weight += 200;
      else for (const c of cps) weight += twitterCodePointWeight(c.codePointAt(0) ?? 0);
    }
  };
  for (const u of urls) {
    addPlain(nfc.slice(pos, u.start));
    weight += 23 * 100;
    pos = u.end;
  }
  addPlain(nfc.slice(pos));
  return { weighted: weight / 100, urls: urls.length };
}

/** Mastodon: code points, every http(s) URL counts 23, remote mentions count only @user. */
export function mastodonLength(text: string): { length: number; urls: number } {
  const urls = findUrls(text, { bare: false });
  let pos = 0;
  let len = 0;
  const plain = (s: string): number => countCodePoints(s.replace(/(?<![\w@])@([\w.+-]+)@[\w.-]+\.\w+/g, '@$1'));
  for (const u of urls) {
    len += plain(text.slice(pos, u.start)) + 23;
    pos = u.end;
  }
  len += plain(text.slice(pos));
  return { length: len, urls: urls.length };
}

/* ------------------------------------------------------------------ */
/* Platform limits                                                      */
/* ------------------------------------------------------------------ */

export type CountMethod = 'graphemes' | 'codepoints' | 'utf16' | 'bytes' | 'twitter' | 'mastodon' | 'sms';

export interface Platform {
  id: string;
  name: string;
  limit: number;
  method: CountMethod;
  note?: string;
  custom?: boolean;
}

export const METHOD_LABELS: Record<CountMethod, string> = {
  graphemes: 'characters (graphemes)',
  codepoints: 'Unicode code points',
  utf16: 'UTF-16 units',
  bytes: 'UTF-8 bytes',
  twitter: 'X weighted count',
  mastodon: 'Mastodon (URL = 23)',
  sms: 'SMS units',
};

export const LIMITS_AS_OF = '2026';

export const DEFAULT_PLATFORMS: Platform[] = [
  { id: 'x', name: 'X (Twitter) post', limit: 280, method: 'twitter', note: 'Approximate: URLs count 23, CJK and emoji count 2. Premium accounts can post longer.' },
  { id: 'bluesky', name: 'Bluesky post', limit: 300, method: 'graphemes', note: '300 graphemes (and 3,000 bytes).' },
  { id: 'mastodon', name: 'Mastodon post', limit: 500, method: 'mastodon', note: 'Default is 500; instances can change it. URLs count 23, remote mentions count only the username.' },
  { id: 'threads', name: 'Threads post', limit: 500, method: 'graphemes' },
  { id: 'linkedin', name: 'LinkedIn post', limit: 3000, method: 'graphemes' },
  { id: 'instagram', name: 'Instagram caption', limit: 2200, method: 'graphemes', note: 'Also max 30 hashtags.' },
  { id: 'facebook', name: 'Facebook post', limit: 63206, method: 'graphemes' },
  { id: 'yt-title', name: 'YouTube title', limit: 100, method: 'graphemes' },
  { id: 'yt-desc', name: 'YouTube description', limit: 5000, method: 'graphemes' },
  { id: 'tiktok', name: 'TikTok caption', limit: 4000, method: 'graphemes' },
  { id: 'pinterest', name: 'Pinterest pin description', limit: 500, method: 'graphemes' },
  { id: 'meta-title', name: 'SEO meta title', limit: 60, method: 'graphemes', note: 'Guideline: Google truncates by pixel width (~600px), roughly 50-60 characters.' },
  { id: 'meta-desc', name: 'SEO meta description', limit: 160, method: 'graphemes', note: 'Guideline: roughly 120-160 characters are shown.' },
  { id: 'gads-headline', name: 'Google Ads headline', limit: 30, method: 'graphemes' },
  { id: 'gads-desc', name: 'Google Ads description', limit: 90, method: 'graphemes' },
  { id: 'app-subtitle', name: 'App Store subtitle', limit: 30, method: 'graphemes' },
  { id: 'play-short', name: 'Google Play short description', limit: 80, method: 'graphemes' },
  { id: 'sms', name: 'SMS (one segment)', limit: 160, method: 'sms', note: '160 characters in GSM-7, 70 in UCS-2. Longer messages are split into 153/67-unit segments.' },
];

export interface Measurement {
  used: number;
  /** Effective limit (SMS depends on the encoding). */
  limit: number;
  extra?: string;
}

export function measure(text: string, p: Pick<Platform, 'limit' | 'method'>): Measurement {
  switch (p.method) {
    case 'graphemes':
      return { used: countGraphemes(text), limit: p.limit };
    case 'codepoints':
      return { used: countCodePoints(text), limit: p.limit };
    case 'utf16':
      return { used: text.length, limit: p.limit };
    case 'bytes':
      return { used: countUtf8Bytes(text), limit: p.limit };
    case 'twitter': {
      const t = twitterLength(text);
      return { used: t.weighted, limit: p.limit, extra: t.urls > 0 ? `${t.urls} URL${t.urls === 1 ? '' : 's'} × 23` : undefined };
    }
    case 'mastodon': {
      const m = mastodonLength(text);
      return { used: m.length, limit: p.limit, extra: m.urls > 0 ? `${m.urls} URL${m.urls === 1 ? '' : 's'} × 23` : undefined };
    }
    case 'sms': {
      const a = analyzeSms(text);
      return {
        used: a.units,
        limit: a.singleLimit,
        extra: `${a.encoding} · ${a.segments} segment${a.segments === 1 ? '' : 's'}`,
      };
    }
  }
}

export function formatLeft(used: number, limit: number): { text: string; level: 'ok' | 'warn' | 'over' } {
  const left = limit - used;
  if (left < 0) return { text: `${(-left).toLocaleString('en-US')} over`, level: 'over' };
  const level = used / limit >= 0.9 ? 'warn' : 'ok';
  return { text: `${left.toLocaleString('en-US')} left`, level };
}
