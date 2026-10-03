/**
 * Magic Decoder — pure logic.
 *
 * A bank of decoders (each with a cheap canDecode precheck), a readability scorer and a beam
 * search over decode chains, in the spirit of CyberChef's "Magic" operation.
 */
import { Gunzip, Inflate, Unzlib, gzipSync } from 'fflate';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface DecoderInput {
  bytes: Uint8Array;
  /** Strict UTF-8 decoding of `bytes`, or null when the bytes are not valid UTF-8. */
  text: string | null;
}

export interface DecodeOutput {
  bytes: Uint8Array;
  params?: string;
}

export type DecoderFamily = 'base' | 'text' | 'cipher' | 'compression' | 'container';

export interface Decoder {
  id: string;
  name: string;
  family: DecoderFamily;
  description: string;
  canDecode(input: DecoderInput): boolean;
  decode(input: DecoderInput): DecodeOutput[];
}

export type ScoreKind = 'empty' | 'text' | 'binary';

export interface Score {
  /** Readability score, 0-100. */
  score: number;
  kind: ScoreKind;
  /** Short human label: "English text", "JSON", "PNG image", "binary data"… */
  label: string;
  mime?: string;
  ext?: string;
  english: number;
  printable: number;
  entropy: number;
}

export interface ChainStep {
  decoderId: string;
  name: string;
  params?: string;
  /** Output of this step. */
  bytes: Uint8Array;
}

export interface Chain {
  steps: ChainStep[];
  output: Uint8Array;
  score: Score;
  /** Ranking value: score minus a small per-step penalty. */
  rank: number;
}

export interface SearchResult {
  baseline: Score;
  chains: Chain[];
  best: Chain | null;
  explored: number;
  timedOut: boolean;
  inputBytes: number;
}

export interface SearchOptions {
  maxDepth?: number;
  beamWidth?: number;
  maxResults?: number;
  maxBytes?: number;
  timeBudgetMs?: number;
}

export const MAX_INPUT_BYTES = 2_000_000;
const MAX_OUTPUT_BYTES = 16_000_000;

const enc = new TextEncoder();

/* -------------------------------------------------------------------------- */
/* Byte / text helpers                                                        */
/* -------------------------------------------------------------------------- */

export function toBytes(s: string): Uint8Array {
  return enc.encode(s);
}

function strictUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export function makeInput(bytes: Uint8Array): DecoderInput {
  return { bytes, text: bytes.length <= MAX_INPUT_BYTES ? strictUtf8(bytes) : null };
}

/** Lossy text view for display. */
export function bytesToDisplayText(bytes: Uint8Array, max = 200_000): string {
  return new TextDecoder('utf-8').decode(bytes.length > max ? bytes.subarray(0, max) : bytes);
}

export function bytesToHex(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i++) s += (b[i] ?? 0).toString(16).padStart(2, '0');
  return s;
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function bytesKey(b: Uint8Array): string {
  let h1 = 0x811c9dc5;
  let h2 = 5381;
  for (let i = 0; i < b.length; i++) {
    const v = b[i] ?? 0;
    h1 = Math.imul(h1 ^ v, 0x01000193);
    h2 = (Math.imul(h2, 33) + v) | 0;
  }
  return `${b.length}:${h1 >>> 0}:${h2 >>> 0}`;
}

/** Trim, drop BOM and one layer of matching quotes. */
function clean(text: string): string {
  let t = text.replace(/^﻿/, '').trim();
  const f = t.charAt(0);
  if ((f === '"' || f === "'" || f === '`') && t.length >= 2 && t.endsWith(f)) t = t.slice(1, -1).trim();
  return t;
}

function shannon(bytes: Uint8Array, limit = 65536): number {
  const n = Math.min(bytes.length, limit);
  if (n === 0) return 0;
  const counts = new Uint32Array(256);
  for (let i = 0; i < n; i++) counts[bytes[i] ?? 0] = (counts[bytes[i] ?? 0] ?? 0) + 1;
  let h = 0;
  for (let i = 0; i < 256; i++) {
    const c = counts[i] ?? 0;
    if (c) {
      const p = c / n;
      h -= p * Math.log2(p);
    }
  }
  return h;
}

/* -------------------------------------------------------------------------- */
/* Base-N codecs                                                              */
/* -------------------------------------------------------------------------- */

const B64_LOOKUP = (() => {
  const t = new Int16Array(256).fill(-1);
  const std = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < 64; i++) t[std.charCodeAt(i)] = i;
  t['-'.charCodeAt(0)] = 62;
  t['_'.charCodeAt(0)] = 63;
  return t;
})();

/** Decodes unpadded base64 body (no whitespace, no '='). */
function b64DecodeBody(s: string): Uint8Array {
  const n = s.length;
  const out = new Uint8Array(Math.floor((n * 3) / 4));
  let o = 0;
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < n; i++) {
    const v = B64_LOOKUP[s.charCodeAt(i)] ?? -1;
    if (v < 0) throw new Error('invalid base64 character');
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
      acc &= (1 << bits) - 1;
    }
  }
  return out.subarray(0, o);
}

/** Validates + decodes standard or url-safe base64. Throws on invalid input. */
export function base64Decode(input: string): { bytes: Uint8Array; urlSafe: boolean } {
  const t = input.replace(/\s+/g, '');
  const m = /^([A-Za-z0-9+/_-]*)(={0,2})$/.exec(t);
  if (!m) throw new Error('not base64');
  const body = m[1] ?? '';
  const pad = m[2] ?? '';
  if (/[+/]/.test(body) && /[_-]/.test(body)) throw new Error('mixed base64 alphabets');
  if (body.length % 4 === 1) throw new Error('bad base64 length');
  if (pad && (body.length + pad.length) % 4 !== 0) throw new Error('bad base64 padding');
  return { bytes: b64DecodeBody(body), urlSafe: /[_-]/.test(body) };
}

export function base64Encode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

const B32_STD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const B32_HEX = '0123456789ABCDEFGHIJKLMNOPQRSTUV';

function base32Decode(input: string, alphabet: string): Uint8Array {
  let t = input.replace(/\s+/g, '').replace(/=+$/, '');
  if (t === t.toLowerCase()) t = t.toUpperCase();
  if (![0, 2, 4, 5, 7].includes(t.length % 8)) throw new Error('bad base32 length');
  const out: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const ch of t) {
    const v = alphabet.indexOf(ch);
    if (v < 0) throw new Error('invalid base32 character');
    acc = (acc << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
      acc &= (1 << bits) - 1;
    }
  }
  return Uint8Array.from(out);
}

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Decode(s: string): Uint8Array {
  const digits: number[] = [];
  for (const ch of s) {
    let carry = B58.indexOf(ch);
    if (carry < 0) throw new Error('invalid base58 character');
    for (let j = 0; j < digits.length; j++) {
      carry += (digits[j] ?? 0) * 58;
      digits[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      digits.push(carry & 0xff);
      carry >>= 8;
    }
  }
  let zeros = 0;
  while (zeros < s.length && s.charAt(zeros) === '1') zeros++;
  const out = new Uint8Array(zeros + digits.length);
  for (let i = 0; i < digits.length; i++) out[zeros + i] = digits[digits.length - 1 - i] ?? 0;
  return out;
}

function ascii85Decode(input: string): Uint8Array {
  let t = input.trim();
  if (t.startsWith('<~')) t = t.slice(2);
  if (t.endsWith('~>')) t = t.slice(0, -2);
  t = t.replace(/\s+/g, '');
  const out: number[] = [];
  let group: number[] = [];
  const flush = (n: number) => {
    let v = 0;
    for (let i = 0; i < 5; i++) v = v * 85 + (group[i] ?? 84);
    if (v > 0xffffffff) throw new Error('ascii85 group overflow');
    const bytes = [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
    for (let i = 0; i < n; i++) out.push(bytes[i] ?? 0);
    group = [];
  };
  for (const ch of t) {
    if (ch === 'z' && group.length === 0) {
      out.push(0, 0, 0, 0);
      continue;
    }
    const c = ch.charCodeAt(0);
    if (c < 33 || c > 117) throw new Error('invalid ascii85 character');
    group.push(c - 33);
    if (group.length === 5) flush(4);
  }
  if (group.length === 1) throw new Error('bad ascii85 tail');
  if (group.length > 1) flush(group.length - 1);
  return Uint8Array.from(out);
}

const B45 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

function base45Decode(s: string): Uint8Array {
  if (s.length % 3 === 1) throw new Error('bad base45 length');
  const out: number[] = [];
  for (let i = 0; i < s.length; i += 3) {
    const c = B45.indexOf(s.charAt(i));
    const d = B45.indexOf(s.charAt(i + 1));
    if (c < 0 || d < 0) throw new Error('invalid base45 character');
    if (i + 2 < s.length) {
      const e = B45.indexOf(s.charAt(i + 2));
      if (e < 0) throw new Error('invalid base45 character');
      const v = c + d * 45 + e * 45 * 45;
      if (v > 0xffff) throw new Error('base45 overflow');
      out.push(v >> 8, v & 0xff);
    } else {
      const v = c + d * 45;
      if (v > 0xff) throw new Error('base45 overflow');
      out.push(v);
    }
  }
  return Uint8Array.from(out);
}

/* ---- punycode (RFC 3492) ---- */

function punycodeDecode(input: string): string {
  const base = 36, tMin = 1, tMax = 26, skew = 38, damp = 700;
  const out: number[] = [];
  const basic = input.lastIndexOf('-');
  for (let j = 0; j < Math.max(basic, 0); j++) out.push(input.charCodeAt(j));
  const adapt = (delta: number, numPoints: number, first: boolean): number => {
    let k = 0;
    delta = first ? Math.floor(delta / damp) : delta >> 1;
    delta += Math.floor(delta / numPoints);
    for (; delta > ((base - tMin) * tMax) >> 1; k += base) delta = Math.floor(delta / (base - tMin));
    return Math.floor(k + ((base - tMin + 1) * delta) / (delta + skew));
  };
  let n = 128, i = 0, bias = 72;
  for (let idx = basic > 0 ? basic + 1 : 0; idx < input.length; ) {
    const oldi = i;
    for (let w = 1, k = base; ; k += base) {
      if (idx >= input.length) throw new Error('bad punycode');
      const c = input.charCodeAt(idx++);
      const digit = c - 48 < 10 ? c - 22 : c - 65 < 26 ? c - 65 : c - 97 < 26 ? c - 97 : base;
      if (digit >= base) throw new Error('bad punycode digit');
      i += digit * w;
      const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
      if (digit < t) break;
      w *= base - t;
    }
    const len = out.length + 1;
    bias = adapt(i - oldi, len, oldi === 0);
    n += Math.floor(i / len);
    i %= len;
    out.splice(i++, 0, n);
  }
  return String.fromCodePoint(...out);
}

/* ---- html entities ---- */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', copy: '©', reg: '®', trade: '™', hellip: '…',
  mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', euro: '€', pound: '£', yen: '¥', cent: '¢',
  sect: '§', deg: '°', plusmn: '±', times: '×', divide: '÷', para: '¶', middot: '·', laquo: '«', raquo: '»',
  bull: '•', larr: '←', rarr: '→', uarr: '↑', darr: '↓', hearts: '♥', iexcl: '¡', iquest: '¿', eacute: 'é',
  egrave: 'è', agrave: 'à', aacute: 'á', uuml: 'ü', ouml: 'ö', auml: 'ä', szlig: 'ß', ntilde: 'ñ', ccedil: 'ç',
  micro: 'µ', frac12: '½', frac14: '¼', infin: '∞', ne: '≠', le: '≤', ge: '≥', check: '✓',
};

function decodeHtmlEntities(s: string): string {
  return s.replace(/&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-zA-Z][a-zA-Z0-9]{1,9}));/g, (whole, dec: string | undefined, hex: string | undefined, name: string | undefined) => {
    try {
      if (dec !== undefined) return String.fromCodePoint(Number(dec));
      if (hex !== undefined) return String.fromCodePoint(parseInt(hex, 16));
      if (name !== undefined) return NAMED_ENTITIES[name] ?? NAMED_ENTITIES[name.toLowerCase()] ?? whole;
    } catch {
      return whole;
    }
    return whole;
  });
}

/* ---- percent / quoted-printable ---- */

function decodeEscaped(s: string, marker: RegExp): Uint8Array {
  const chunks: Uint8Array[] = [];
  let total = 0;
  let last = 0;
  const re = new RegExp(marker.source, 'g');
  let m: RegExpExecArray | null;
  const push = (b: Uint8Array) => {
    chunks.push(b);
    total += b.length;
  };
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) push(enc.encode(s.slice(last, m.index)));
    const hexes = m[0].match(/[0-9A-Fa-f]{2}/g) ?? [];
    push(Uint8Array.from(hexes.map((h) => parseInt(h, 16))));
    last = m.index + m[0].length;
  }
  if (last < s.length) push(enc.encode(s.slice(last)));
  return concat(chunks, total);
}

/* ---- js escapes ---- */

const SIMPLE_ESC: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0', "'": "'", '"': '"', '\\': '\\', '/': '/' };

function decodeJsEscapes(s: string): string {
  let t = s.trim();
  const f = t.charAt(0);
  if ((f === '"' || f === "'" || f === '`') && t.length >= 2 && t.endsWith(f)) t = t.slice(1, -1);
  return t.replace(/\\(?:u\{([0-9a-fA-F]{1,6})\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|([nrtbfv0'"\\/]))/g, (whole, cp: string | undefined, u4: string | undefined, x2: string | undefined, simple: string | undefined) => {
    try {
      if (cp !== undefined) return String.fromCodePoint(parseInt(cp, 16));
      if (u4 !== undefined) return String.fromCharCode(parseInt(u4, 16));
      if (x2 !== undefined) return String.fromCharCode(parseInt(x2, 16));
      if (simple !== undefined) return SIMPLE_ESC[simple] ?? whole;
    } catch {
      return whole;
    }
    return whole;
  });
}

/* ---- compression (size capped, streaming) ---- */

type FlateCtor = new (cb: (chunk: Uint8Array, final: boolean) => void) => { push(chunk: Uint8Array, final?: boolean): void };

function inflateCapped(Ctor: FlateCtor, data: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const stream = new Ctor((chunk) => {
    total += chunk.length;
    if (total > MAX_OUTPUT_BYTES) throw new Error('decompressed output too large');
    chunks.push(chunk.slice());
  });
  const STEP = 2048;
  for (let i = 0; i < data.length; i += STEP) {
    stream.push(data.subarray(i, Math.min(data.length, i + STEP)), i + STEP >= data.length);
  }
  if (data.length === 0) stream.push(data, true);
  return concat(chunks, total);
}

/* ---- english-ness ---- */

const TOP_BIGRAMS = new Set(
  ('th he in er an re on at en nd ti es or te of ed is it al ar st to nt ng se ha as ou io le ve co me de hi ri ro ic ne ea ra ce li ch ll ' +
    'be ma si om ur el la ta no us di et ly pe ec wa ho tt ol ns ss ot ge ad ld il ac ow ie ut un id ul lo rs ct fo wi so ca ai ee ke os ir ' +
    'oo ew pr nc sa pa po mo ni ay fi tr ab ue ba am up em ig na do ot rt ag bo sh mi tu gh ef ep ap').split(' ')
);

const COMMON_WORDS = new Set(
  ('the be to of and a in that have i it for not on with he as you do at this but his by from they we say her she or an will my one all would there ' +
    'their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other ' +
    'than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is ' +
    'are was were been has had did am hello hi world test message secret password admin user key token flag data file name text example http https www com ' +
    'org net json true false null function return var const let class import export public private static void int string public name value error ' +
    'warning info debug request response server client login logout session cookie header body content type length date time version config script ' +
    'command shell powershell windows download invoke object new web client host port path url email address account number order please thank ' +
    'thanks dear regards best hello hey yes okay ok send receive attack defend meet tonight tomorrow today morning evening night sunday monday tuesday ' +
    'wednesday thursday friday saturday january february march april may june july august september october november december lorem ipsum dolor sit ' +
    'amet quick brown fox jumps lazy dog help here there where why very much many more little big small long short old young right left').split(' ')
);

export interface English {
  score: number;
  letters: number;
  /** Letters that belong to recognised common words. */
  wordLetters: number;
}

/** 0..1 estimate of how much a string looks like natural-language text. */
export function englishness(s: string, limit = 65536): English {
  const str = s.length > limit ? s.slice(0, limit) : s;
  let letters = 0;
  let bigrams = 0;
  let hits = 0;
  let prev = '';
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i) | 32;
    if (c >= 97 && c <= 122) {
      letters++;
      const ch = String.fromCharCode(c);
      if (prev) {
        bigrams++;
        if (TOP_BIGRAMS.has(prev + ch)) hits++;
      }
      prev = ch;
    } else {
      prev = '';
    }
  }
  let nonAsciiLetters = 0;
  if (letters < str.length * 0.5) {
    const m = str.match(/[^\x00-\x7f]/g);
    if (m && /\p{L}/u.test(m.join(''))) {
      for (const ch of m) if (/\p{L}/u.test(ch)) nonAsciiLetters++;
    }
  }
  if (letters < 2 && nonAsciiLetters < 2) return { score: 0, letters, wordLetters: 0 };
  const bigramRatio = bigrams ? hits / bigrams : 0;
  let wordLetters = 0;
  let allLetters = 0;
  for (const tok of str.toLowerCase().match(/[a-z]+/g) ?? []) {
    allLetters += tok.length;
    if (COMMON_WORDS.has(tok)) wordLetters += tok.length;
  }
  const wordRatio = allLetters ? wordLetters / allLetters : 0;
  const norm = (v: number, lo: number, hi: number) => Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  // Bigram statistics are unreliable on short strings; recognised words are strong evidence even then.
  const bg = norm(bigramRatio, 0.18, 0.62) * Math.min(1, letters / 30);
  const wd = norm(wordRatio, 0.04, 0.45) * Math.min(1, wordLetters / 12);
  let score = 0.55 * bg + 0.45 * wd;
  const letterFraction = letters / Math.max(1, str.replace(/\s/g, '').length);
  score *= Math.min(1, letterFraction / 0.5);
  if (nonAsciiLetters >= 4 && nonAsciiLetters >= str.replace(/\s/g, '').length * 0.4) score = Math.max(score, 0.6);
  return { score: Math.max(0, Math.min(1, score)), letters, wordLetters };
}

/* -------------------------------------------------------------------------- */
/* Magic bytes & structure detection                                          */
/* -------------------------------------------------------------------------- */

interface MagicEntry {
  label: string;
  mime: string;
  ext: string;
  base: number;
  match: (b: Uint8Array) => boolean;
}

const startsWith = (b: Uint8Array, sig: number[], off = 0) => sig.every((v, i) => b[off + i] === v);
const asciiAt = (b: Uint8Array, s: string, off = 0) => startsWith(b, Array.from(s, (c) => c.charCodeAt(0)), off);

const MAGICS: MagicEntry[] = [
  { label: 'PNG image', mime: 'image/png', ext: 'png', base: 78, match: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { label: 'JPEG image', mime: 'image/jpeg', ext: 'jpg', base: 78, match: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  { label: 'GIF image', mime: 'image/gif', ext: 'gif', base: 78, match: (b) => asciiAt(b, 'GIF87a') || asciiAt(b, 'GIF89a') },
  { label: 'WebP image', mime: 'image/webp', ext: 'webp', base: 78, match: (b) => asciiAt(b, 'RIFF') && asciiAt(b, 'WEBP', 8) },
  { label: 'WAV audio', mime: 'audio/wav', ext: 'wav', base: 74, match: (b) => asciiAt(b, 'RIFF') && asciiAt(b, 'WAVE', 8) },
  { label: 'PDF document', mime: 'application/pdf', ext: 'pdf', base: 78, match: (b) => asciiAt(b, '%PDF-') },
  { label: 'ZIP archive (zip/docx/xlsx/jar/apk)', mime: 'application/zip', ext: 'zip', base: 74, match: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]) || startsWith(b, [0x50, 0x4b, 0x05, 0x06]) },
  { label: 'gzip data', mime: 'application/gzip', ext: 'gz', base: 48, match: (b) => startsWith(b, [0x1f, 0x8b, 0x08]) },
  { label: 'bzip2 data', mime: 'application/x-bzip2', ext: 'bz2', base: 60, match: (b) => asciiAt(b, 'BZh') && (b[3] ?? 0) >= 0x31 && (b[3] ?? 0) <= 0x39 },
  { label: 'XZ data', mime: 'application/x-xz', ext: 'xz', base: 60, match: (b) => startsWith(b, [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]) },
  { label: '7-Zip archive', mime: 'application/x-7z-compressed', ext: '7z', base: 74, match: (b) => startsWith(b, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]) },
  { label: 'RAR archive', mime: 'application/vnd.rar', ext: 'rar', base: 74, match: (b) => asciiAt(b, 'Rar!\x1a\x07') },
  { label: 'ELF executable', mime: 'application/x-elf', ext: 'elf', base: 76, match: (b) => startsWith(b, [0x7f, 0x45, 0x4c, 0x46]) },
  { label: 'Windows PE executable (MZ)', mime: 'application/vnd.microsoft.portable-executable', ext: 'exe', base: 72, match: (b) => asciiAt(b, 'MZ') && b.length > 64 && (b[0x3c] ?? 0) < 0xf0 },
  { label: 'Mach-O executable', mime: 'application/x-mach-binary', ext: 'macho', base: 72, match: (b) => startsWith(b, [0xcf, 0xfa, 0xed, 0xfe]) || startsWith(b, [0xce, 0xfa, 0xed, 0xfe]) || startsWith(b, [0xfe, 0xed, 0xfa, 0xce]) || startsWith(b, [0xfe, 0xed, 0xfa, 0xcf]) },
  { label: 'Java class file', mime: 'application/java-vm', ext: 'class', base: 76, match: (b) => startsWith(b, [0xca, 0xfe, 0xba, 0xbe]) && b.length > 8 },
  { label: 'Java serialized object (aced0005)', mime: 'application/x-java-serialized-object', ext: 'ser', base: 80, match: (b) => startsWith(b, [0xac, 0xed, 0x00, 0x05]) },
  { label: 'WebAssembly module', mime: 'application/wasm', ext: 'wasm', base: 76, match: (b) => startsWith(b, [0x00, 0x61, 0x73, 0x6d]) },
  { label: 'SQLite database', mime: 'application/vnd.sqlite3', ext: 'sqlite', base: 76, match: (b) => asciiAt(b, 'SQLite format 3\0') },
  { label: 'TIFF image', mime: 'image/tiff', ext: 'tiff', base: 70, match: (b) => startsWith(b, [0x49, 0x49, 0x2a, 0x00]) || startsWith(b, [0x4d, 0x4d, 0x00, 0x2a]) },
  { label: 'ICO icon', mime: 'image/x-icon', ext: 'ico', base: 62, match: (b) => startsWith(b, [0x00, 0x00, 0x01, 0x00]) && (b[4] ?? 0) > 0 && (b[4] ?? 0) < 32 && b.length > 22 },
  { label: 'MP3 audio (ID3)', mime: 'audio/mpeg', ext: 'mp3', base: 72, match: (b) => asciiAt(b, 'ID3') },
  { label: 'Ogg media', mime: 'audio/ogg', ext: 'ogg', base: 72, match: (b) => asciiAt(b, 'OggS') },
  { label: 'FLAC audio', mime: 'audio/flac', ext: 'flac', base: 72, match: (b) => asciiAt(b, 'fLaC') },
  { label: 'MP4 / ISO media', mime: 'video/mp4', ext: 'mp4', base: 72, match: (b) => asciiAt(b, 'ftyp', 4) },
  { label: 'PCAP capture', mime: 'application/vnd.tcpdump.pcap', ext: 'pcap', base: 72, match: (b) => startsWith(b, [0xd4, 0xc3, 0xb2, 0xa1]) || startsWith(b, [0xa1, 0xb2, 0xc3, 0xd4]) },
  { label: 'TAR archive', mime: 'application/x-tar', ext: 'tar', base: 66, match: (b) => asciiAt(b, 'ustar', 257) },
];

const TEXT_MAGICS: { label: string; mime: string; ext: string; re: RegExp }[] = [
  { label: 'RTF document', mime: 'application/rtf', ext: 'rtf', re: /^\{\\rtf/ },
  { label: 'PostScript', mime: 'application/postscript', ext: 'ps', re: /^%!PS/ },
  { label: 'SVG image', mime: 'image/svg+xml', ext: 'svg', re: /^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/i },
];

export interface MagicInfo {
  label: string;
  mime: string;
  ext: string;
  base: number;
}

export function detectMagic(b: Uint8Array): MagicInfo | null {
  if (b.length < 3) return null;
  for (const m of MAGICS) {
    try {
      if (m.match(b)) return { label: m.label, mime: m.mime, ext: m.ext, base: m.base };
    } catch {
      /* ignore */
    }
  }
  return null;
}

// zlib streams: 78 01 / 78 5e / 78 9c / 78 da (header checksum must divide by 31)
function looksZlib(b: Uint8Array): boolean {
  if (b.length < 6) return false;
  const cmf = b[0] ?? 0;
  const flg = b[1] ?? 0;
  return (cmf & 0x0f) === 8 && cmf >> 4 <= 7 && ((cmf << 8) | flg) % 31 === 0 && (flg & 0x20) === 0;
}

interface Structure {
  label: string;
  bonus: number;
}

const CODE_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\b(?:IEX|Invoke-Expression|Invoke-WebRequest|New-Object|DownloadString|Start-Process|Set-ExecutionPolicy|-ExecutionPolicy|-nop\b|-w\s+hidden|powershell(?:\.exe)?)\b/i, label: 'PowerShell script' },
  { re: /^#!\s*\/(?:usr\/)?bin\/(?:env\s+)?(?:ba|z|da)?sh\b|\b(?:chmod\s+[+0-7]|curl\s+-|wget\s+http|bash\s+-c|\/bin\/sh|\/etc\/passwd)\b/m, label: 'shell script' },
  { re: /\b(?:function\s*\w*\s*\(|=>\s*[{(]|console\.log\(|document\.(?:cookie|write|getElementById)|window\.location|eval\(|atob\(|require\(|\bvar\s+\w+\s*=|\bconst\s+\w+\s*=|\blet\s+\w+\s*=)/, label: 'JavaScript' },
  { re: /\b(?:SELECT\s+[\w*,\s]+\s+FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|UNION\s+(?:ALL\s+)?SELECT|DROP\s+TABLE)\b/i, label: 'SQL' },
  { re: /<\?php|\$_(?:GET|POST|REQUEST|COOKIE)\b/, label: 'PHP' },
  { re: /^\s*(?:import\s+\w+|from\s+\w+\s+import|def\s+\w+\(|class\s+\w+[:(]|print\()/m, label: 'Python' },
  { re: /^(?:GET|POST|PUT|DELETE|HEAD|OPTIONS)\s+\S+\s+HTTP\/\d|^HTTP\/\d(?:\.\d)?\s+\d{3}|^Host:\s+\S+/m, label: 'HTTP message' },
];

export function detectStructure(s: string): Structure | null {
  const t = s.trim();
  if (t.length === 0) return null;
  let best: Structure | null = null;
  const consider = (label: string, bonus: number) => {
    if (!best || bonus > best.bonus) best = { label, bonus };
  };
  const first = t.charAt(0);
  if ((first === '{' || first === '[') && t.length >= 2) {
    try {
      const v: unknown = JSON.parse(t);
      if (v !== null && typeof v === 'object') consider('JSON', Array.isArray(v) ? (v.length ? 42 : 20) : Object.keys(v).length ? 45 : 20);
    } catch {
      /* not JSON */
    }
  }
  if (/^<(?:\?xml|!doctype|[a-zA-Z][\w:-]*)/i.test(t) && /<\/[\w:-]+>\s*$|\/>\s*$|^<!doctype[^>]*>/i.test(t) && /<[^>]+>/.test(t)) {
    consider(/^<!doctype html|<html|<body|<div|<p>|<script/i.test(t) ? 'HTML' : 'XML', 40);
  }
  if (/-----BEGIN [A-Z0-9 ]+-----[\s\S]+-----END [A-Z0-9 ]+-----/.test(t)) consider('PEM block', 45);
  if (/^(?:https?|ftp|wss?|file|ssh|git|sftp|ldaps?):\/\/[^\s]+$/i.test(t)) consider('URL', 42);
  else if (/\b(?:https?|ftp|wss?):\/\/[^\s]{4,}/i.test(t)) consider('text with URL', 18);
  if (/^eyJ[\w-]+\.eyJ[\w-]+\.[\w-]*$/.test(t)) consider('JWT', 35);
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) consider('UUID', 40);
  if (/^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?::\d{1,5})?$/.test(t)) consider('IPv4 address', 40);
  if (/^(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{0,4}$/i.test(t) && t.includes('::') || /^(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i.test(t)) consider('IPv6 address', 40);
  if (/^[\w.+-]+@[\w-]+(?:\.[\w-]+)+$/.test(t)) consider('email address', 38);
  for (const p of CODE_PATTERNS) if (p.re.test(t)) consider(p.label, 30);
  const kv = t.split(/\r?\n/).filter((l) => /^[\w.-]+\s*[=:]\s*\S/.test(l));
  if (kv.length >= 2 && kv.length >= t.split(/\r?\n/).length * 0.6) consider('key/value pairs', 22);
  if (/^(?:[\w.~%-]+=[^&\s]*&)+[\w.~%-]+=[^&\s]*$/.test(t)) consider('query string', 28);
  return best;
}

/* -------------------------------------------------------------------------- */
/* Scoring                                                                    */
/* -------------------------------------------------------------------------- */

export function scoreBytes(b: Uint8Array): Score {
  if (b.length === 0) {
    return { score: 0, kind: 'empty', label: 'empty', english: 0, printable: 0, entropy: 0 };
  }
  const entropy = shannon(b);
  const magic = detectMagic(b);
  const sampleLen = Math.min(b.length, 65536);
  const sample = b.subarray(0, sampleLen);
  let text: string | null = null;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(sample, { stream: sampleLen < b.length });
  } catch {
    text = null;
  }
  let lenient = false;
  if (text === null) {
    let printable = 0;
    for (let i = 0; i < sample.length; i++) {
      const v = sample[i] ?? 0;
      if ((v >= 32 && v < 127) || v === 9 || v === 10 || v === 13) printable++;
    }
    if (printable / sample.length >= 0.97) {
      text = new TextDecoder('utf-8').decode(sample);
      lenient = true;
    }
  }
  if (text === null) {
    if (magic) {
      return { score: magic.base, kind: 'binary', label: magic.label, mime: magic.mime, ext: magic.ext, english: 0, printable: 0, entropy };
    }
    if (looksZlib(b)) {
      return { score: 44, kind: 'binary', label: 'zlib-compressed data', mime: 'application/zlib', ext: 'zlib', english: 0, printable: 0, entropy };
    }
    const s = entropy > 7.2 ? 2 : Math.min(18, 6 + (7.2 - entropy) * 2.5);
    return { score: s, kind: 'binary', label: entropy > 7.2 ? 'high-entropy binary data' : 'binary data', english: 0, printable: 0, entropy };
  }

  // text path
  let ctrl = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if ((c < 32 && c !== 9 && c !== 10 && c !== 13) || c === 127 || c === 0xfffd) ctrl++;
  }
  const printable = 1 - ctrl / Math.max(1, text.length);
  if (printable < 0.9) {
    if (magic) {
      return { score: magic.base, kind: 'binary', label: magic.label, mime: magic.mime, ext: magic.ext, english: 0, printable, entropy };
    }
    return { score: Math.max(0, 14 * printable - 4), kind: 'binary', label: 'binary data', english: 0, printable, entropy };
  }
  const eng = englishness(text);
  const structure = detectStructure(text.length > 200000 ? text.slice(0, 200000) : text);
  const textMagic = TEXT_MAGICS.find((m) => m.re.test(text));
  const T = Math.pow(printable, 8);
  let score = T * (10 + 75 * eng.score + (structure?.bonus ?? 0) + (textMagic ? 30 : 0));
  // leftover escape sequences mean another decoding layer is probably still pending
  const leftovers = text.slice(0, 20000).match(/%[0-9A-Za-z]{2}|&#?[A-Za-z0-9]{2,8};|\\(?:u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2})|=[0-9A-F]{2}/g)?.length ?? 0;
  if (leftovers) score -= Math.min(15, (150 * leftovers) / Math.min(text.length, 20000));
  // looks like another encoding layer rather than a finished result
  const tt = text.trim();
  if (!structure && eng.score < 0.5 && tt.length >= 16 && /^[A-Za-z0-9+/=_%.\-:~<>*$!#&@?^|(){}[\]\\,;'"`]+$/.test(tt) && !/\s/.test(tt)) {
    score -= 8;
  }
  if (lenient) score *= 0.85;
  const len = text.length;
  if (len < 4) score = Math.min(score, 30);
  else if (len < 8) score = Math.min(score, 55);
  score = Math.max(0, Math.min(100, score));
  const label = structure?.label ?? textMagic?.label ?? (eng.score >= 0.55 ? 'readable text' : eng.score >= 0.3 ? 'possibly text' : 'unstructured text');
  return {
    score,
    kind: 'text',
    label,
    mime: structure?.label === 'JSON' ? 'application/json' : textMagic?.mime ?? 'text/plain',
    ext: structure?.label === 'JSON' ? 'json' : structure?.label === 'HTML' ? 'html' : structure?.label === 'XML' ? 'xml' : textMagic?.ext ?? 'txt',
    english: eng.score,
    printable,
    entropy,
  };
}

export type Confidence = 'high' | 'medium' | 'low';
export function confidenceOf(score: number): Confidence {
  return score >= 70 ? 'high' : score >= 50 ? 'medium' : 'low';
}

/* -------------------------------------------------------------------------- */
/* Decoders                                                                   */
/* -------------------------------------------------------------------------- */

function textOf(i: DecoderInput): string | null {
  return i.text === null ? null : clean(i.text);
}

function out(bytes: Uint8Array, params?: string): DecodeOutput {
  return params ? { bytes, params } : { bytes };
}

function strOut(s: string, params?: string): DecodeOutput {
  return out(enc.encode(s), params);
}

function rotLetters(s: string, shift: number): string {
  return s.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + shift) % 26) + base);
  });
}

function rot47(s: string): string {
  return s.replace(/[!-~]/g, (c) => String.fromCharCode(33 + ((c.charCodeAt(0) - 33 + 47) % 94)));
}

function letterShare(s: string): number {
  const compact = s.replace(/\s/g, '');
  if (!compact) return 0;
  const letters = compact.match(/[A-Za-z]/g)?.length ?? 0;
  return letters / compact.length;
}

/** A variant is only emitted when it is clearly more language-like than the original. */
function improvesEnglish(before: string, after: string): boolean {
  const a = englishness(before);
  const b = englishness(after);
  return b.score >= 0.45 && b.score >= a.score + 0.2 && b.wordLetters >= 4;
}

function parseHexLoose(text: string): Uint8Array | null {
  const t = text.trim();
  if (t.length < 4) return null;
  if (!/^[0-9a-fA-Fx\\\s,:;|-]+$/.test(t)) return null;
  const s = t.replace(/\\x/gi, ' ').replace(/0x/gi, ' ').trim();
  if (!s) return null;
  const tokens = s.split(/[\s,:;|-]+/).filter(Boolean);
  if (tokens.length === 0) return null;
  if (!tokens.every((x) => /^[0-9a-fA-F]+$/.test(x))) return null;
  let digits: string;
  if (tokens.length > 1 && tokens.every((x) => x.length <= 2)) digits = tokens.map((x) => x.padStart(2, '0')).join('');
  else if (tokens.every((x) => x.length % 2 === 0)) digits = tokens.join('');
  else return null;
  if (digits.length < 4) return null;
  const outBytes = new Uint8Array(digits.length / 2);
  for (let i = 0; i < outBytes.length; i++) outBytes[i] = parseInt(digits.slice(i * 2, i * 2 + 2), 16);
  return outBytes;
}

function parseBinaryLoose(text: string): Uint8Array | null {
  const t = text.trim();
  if (!/^[01\s]+$/.test(t)) return null;
  const tokens = t.split(/\s+/);
  let values: number[];
  if (tokens.length > 1 && tokens.every((x) => x.length >= 1 && x.length <= 8)) {
    values = tokens.map((x) => parseInt(x, 2));
  } else {
    const flat = t.replace(/\s+/g, '');
    if (flat.length < 8 || flat.length % 8 !== 0) return null;
    values = (flat.match(/.{8}/g) ?? []).map((x) => parseInt(x, 2));
  }
  return values.length >= 2 ? Uint8Array.from(values) : null;
}

function parseNumberList(text: string, radix: 8 | 10): Uint8Array | null {
  let t = text.trim();
  if (radix === 10) t = t.replace(/^[[({]/, '').replace(/[\])}]$/, '');
  let tokens: string[];
  if (radix === 8 && t.includes('\\')) tokens = t.split('\\').filter(Boolean).map((x) => x.trim());
  else tokens = t.split(/[\s,;]+/).filter(Boolean);
  if (tokens.length < 3) return null;
  const pattern = radix === 8 ? /^[0-7]{1,3}$/ : /^\d{1,3}$/;
  const vals: number[] = [];
  for (const tok of tokens) {
    if (!pattern.test(tok)) return null;
    if (radix === 8 && !t.includes('\\') && tok.length !== 3) return null;
    const v = parseInt(tok, radix);
    if (v > 255) return null;
    vals.push(v);
  }
  return Uint8Array.from(vals);
}

function looksUtf16(b: Uint8Array): 'le' | 'be' | null {
  if (b.length < 4 || b.length % 2 !== 0) return null;
  if (b[0] === 0xff && b[1] === 0xfe) return 'le';
  if (b[0] === 0xfe && b[1] === 0xff) return 'be';
  const pairs = Math.min(b.length, 4096) >> 1;
  let oddZero = 0;
  let evenZero = 0;
  for (let i = 0; i < pairs; i++) {
    if (b[i * 2] === 0) evenZero++;
    if (b[i * 2 + 1] === 0) oddZero++;
  }
  if (oddZero >= pairs * 0.3 && evenZero <= pairs * 0.05) return 'le';
  if (evenZero >= pairs * 0.3 && oddZero <= pairs * 0.05) return 'be';
  return null;
}

function decodeUtf16(b: Uint8Array, le: boolean): string {
  return new TextDecoder(le ? 'utf-16le' : 'utf-16be').decode(b);
}

function prettyJwt(t: string): string | null {
  const parts = t.split('.');
  if (parts.length < 2 || parts.length > 3) return null;
  const dec = (p: string): string | null => {
    try {
      return strictUtf8(base64Decode(p).bytes);
    } catch {
      return null;
    }
  };
  const h = dec(parts[0] ?? '');
  if (h === null) return null;
  let header: unknown;
  try {
    header = JSON.parse(h);
  } catch {
    return null;
  }
  if (!header || typeof header !== 'object' || Array.isArray(header)) return null;
  const p = dec(parts[1] ?? '');
  let payload: unknown = p;
  if (p !== null) {
    try {
      payload = JSON.parse(p);
    } catch {
      payload = p;
    }
  }
  return JSON.stringify({ header, payload, signature: parts[2] ?? '' }, null, 2);
}

function punycodeText(s: string): string | null {
  if (!/xn--/i.test(s)) return null;
  const converted = s.replace(/xn--[a-z0-9-]+/gi, (label) => {
    try {
      return punycodeDecode(label.slice(4));
    } catch {
      return label;
    }
  });
  return converted === s ? null : converted;
}

export const DECODERS: Decoder[] = [
  {
    id: 'gunzip', name: 'Gunzip', family: 'compression', description: 'gzip (RFC 1952) decompression',
    canDecode: (i) => i.bytes.length > 18 && i.bytes[0] === 0x1f && i.bytes[1] === 0x8b,
    decode: (i) => [out(inflateCapped(Gunzip as unknown as FlateCtor, i.bytes))],
  },
  {
    id: 'unzlib', name: 'Zlib inflate', family: 'compression', description: 'zlib (RFC 1950) decompression',
    canDecode: (i) => looksZlib(i.bytes),
    decode: (i) => [out(inflateCapped(Unzlib as unknown as FlateCtor, i.bytes))],
  },
  {
    id: 'inflate-raw', name: 'Raw deflate', family: 'compression', description: 'Raw DEFLATE stream without header',
    canDecode: (i) => i.text === null && i.bytes.length >= 4 && i.bytes.length <= MAX_INPUT_BYTES && ((i.bytes[0] ?? 0) >> 1 & 3) !== 3 && !detectMagic(i.bytes) && !looksZlib(i.bytes) && !looksUtf16(i.bytes),
    decode: (i) => [out(inflateCapped(Inflate as unknown as FlateCtor, i.bytes))],
  },
  {
    id: 'base64', name: 'Base64', family: 'base', description: 'Base64, standard or URL-safe, with or without padding; whitespace ignored',
    canDecode: (i) => {
      const t = textOf(i);
      if (!t || t.length < 4) return false;
      const c = t.replace(/\s+/g, '');
      return /^(?:[A-Za-z0-9+/]+|[A-Za-z0-9_-]+)={0,2}$/.test(c) && c.replace(/=+$/, '').length % 4 !== 1;
    },
    decode: (i) => {
      const r = base64Decode(textOf(i) ?? '');
      return r.bytes.length ? [out(r.bytes, r.urlSafe ? 'URL-safe alphabet' : undefined)] : [];
    },
  },
  {
    id: 'base32', name: 'Base32', family: 'base', description: 'Base32 (RFC 4648)',
    canDecode: (i) => {
      const t = textOf(i);
      if (!t) return false;
      const c = t.replace(/\s+/g, '').replace(/=+$/, '');
      return c.length >= 8 && /^[A-Z2-7]+$/.test(c.toUpperCase()) && (c === c.toUpperCase() || c === c.toLowerCase()) && [0, 2, 4, 5, 7].includes(c.length % 8);
    },
    decode: (i) => [out(base32Decode(textOf(i) ?? '', B32_STD))],
  },
  {
    id: 'base32hex', name: 'Base32 (extended hex)', family: 'base', description: 'Base32hex alphabet 0-9A-V (RFC 4648 §7)',
    canDecode: (i) => {
      const t = textOf(i);
      if (!t) return false;
      const c = t.replace(/\s+/g, '').replace(/=+$/, '');
      return c.length >= 8 && /^[0-9A-V]+$/.test(c.toUpperCase()) && (c === c.toUpperCase() || c === c.toLowerCase()) && [0, 2, 4, 5, 7].includes(c.length % 8) && /[0-9]/.test(c);
    },
    decode: (i) => [out(base32Decode(textOf(i) ?? '', B32_HEX))],
  },
  {
    id: 'base58', name: 'Base58 (Bitcoin)', family: 'base', description: 'Bitcoin base58 alphabet (no 0 O I l)',
    canDecode: (i) => {
      const t = textOf(i);
      return !!t && t.length >= 6 && t.length <= 4096 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(t);
    },
    decode: (i) => [out(base58Decode(textOf(i) ?? ''))],
  },
  {
    id: 'ascii85', name: 'Base85 / Ascii85', family: 'base', description: 'Adobe Ascii85, with or without <~ ~> delimiters',
    canDecode: (i) => {
      const t = i.text === null ? null : i.text.trim();
      if (!t || t.length < 5) return false;
      const wrapped = t.startsWith('<~') && t.endsWith('~>');
      const body = wrapped ? t.slice(2, -2) : t;
      if (!/^[!-uz\s]+$/.test(body)) return false;
      if (wrapped) return true;
      return t.length >= 10 && !/\s{2,}/.test(t) && /[!-/:-@[-`]/.test(t) && !/^[A-Za-z0-9+/=\s]+$/.test(t);
    },
    decode: (i) => [out(ascii85Decode(i.text ?? ''))],
  },
  {
    id: 'base45', name: 'Base45', family: 'base', description: 'Base45 (RFC 9285), as used in EU digital COVID certificates',
    canDecode: (i) => {
      const t = i.text === null ? null : i.text.replace(/[\r\n]+/g, '');
      return !!t && t.length >= 4 && t.length % 3 !== 1 && /^[0-9A-Z $%*+\-./:]+$/.test(t) && /[A-Z0-9]/.test(t) && !/^\d+$/.test(t);
    },
    decode: (i) => [out(base45Decode((i.text ?? '').replace(/[\r\n]+/g, '')))],
  },
  {
    id: 'hex', name: 'Hex', family: 'base', description: 'Hex bytes: plain, 0x, \\x, space/colon/comma separated',
    canDecode: (i) => {
      const t = textOf(i);
      return !!t && parseHexLoose(t) !== null;
    },
    decode: (i) => {
      const b = parseHexLoose(textOf(i) ?? '');
      return b ? [out(b)] : [];
    },
  },
  {
    id: 'binary', name: 'Binary (bits)', family: 'base', description: '8-bit groups of 0/1, spaced or contiguous',
    canDecode: (i) => {
      const t = textOf(i);
      return !!t && t.length >= 8 && parseBinaryLoose(t) !== null;
    },
    decode: (i) => {
      const b = parseBinaryLoose(textOf(i) ?? '');
      return b ? [out(b)] : [];
    },
  },
  {
    id: 'octal', name: 'Octal bytes', family: 'base', description: 'Octal byte list (101 102 …) or \\101\\102 escapes',
    canDecode: (i) => {
      const t = textOf(i);
      return !!t && /^[0-7\s,\\;]+$/.test(t) && parseNumberList(t, 8) !== null;
    },
    decode: (i) => {
      const b = parseNumberList(textOf(i) ?? '', 8);
      return b ? [out(b)] : [];
    },
  },
  {
    id: 'decimal', name: 'Decimal bytes', family: 'base', description: 'Decimal byte list such as 72 101 108 108 111',
    canDecode: (i) => {
      const t = textOf(i);
      return !!t && /^[[({]?[\d\s,;]+[\])}]?$/.test(t) && parseNumberList(t, 10) !== null;
    },
    decode: (i) => {
      const b = parseNumberList(textOf(i) ?? '', 10);
      return b ? [out(b)] : [];
    },
  },
  {
    id: 'url', name: 'URL / percent decoding', family: 'text', description: 'Decodes %XX sequences (and + as space in a second variant)',
    canDecode: (i) => i.text !== null && /%[0-9A-Fa-f]{2}/.test(i.text),
    decode: (i) => {
      const s = clean(i.text ?? '');
      const res = [out(decodeEscaped(s, /(?:%[0-9A-Fa-f]{2})+/))];
      if (s.includes('+')) res.push(out(decodeEscaped(s.replace(/\+/g, ' '), /(?:%[0-9A-Fa-f]{2})+/), '+ as space'));
      return res;
    },
  },
  {
    id: 'html', name: 'HTML entities', family: 'text', description: '&amp; &#65; &#x41; and common named entities',
    canDecode: (i) => i.text !== null && /&(?:#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,9});/.test(i.text),
    decode: (i) => {
      const r = decodeHtmlEntities(i.text ?? '');
      return r === i.text ? [] : [strOut(r)];
    },
  },
  {
    id: 'js-escapes', name: 'JS / JSON escapes', family: 'text', description: '\\uXXXX, \\u{…}, \\xHH, \\n, \\t… escape sequences',
    canDecode: (i) => i.text !== null && /\\(?:u[0-9a-fA-F]{4}|u\{[0-9a-fA-F]{1,6}\}|x[0-9a-fA-F]{2}|[nrtbfv0'"\\/])/.test(i.text),
    decode: (i) => {
      const r = decodeJsEscapes(i.text ?? '');
      return r === i.text ? [] : [strOut(r)];
    },
  },
  {
    id: 'quoted-printable', name: 'Quoted-printable', family: 'text', description: 'MIME quoted-printable (=C3=A9, soft line breaks)',
    canDecode: (i) => i.text !== null && (/=[0-9A-F]{2}/.test(i.text) || /=\r?\n/.test(i.text)),
    decode: (i) => {
      const s = (i.text ?? '').replace(/=\r?\n/g, '');
      return [out(decodeEscaped(s, /(?:=[0-9A-Fa-f]{2})+/))];
    },
  },
  {
    id: 'utf16le', name: 'UTF-16LE text', family: 'text', description: 'UTF-16 little-endian text (e.g. PowerShell -EncodedCommand payloads)',
    canDecode: (i) => looksUtf16(i.bytes) === 'le',
    decode: (i) => [strOut(decodeUtf16(i.bytes, true), 'little-endian')],
  },
  {
    id: 'utf16be', name: 'UTF-16BE text', family: 'text', description: 'UTF-16 big-endian text',
    canDecode: (i) => looksUtf16(i.bytes) === 'be',
    decode: (i) => [strOut(decodeUtf16(i.bytes, false), 'big-endian')],
  },
  {
    id: 'rot13', name: 'ROT13', family: 'cipher', description: 'Rotate letters by 13 (only offered when it produces clearly more readable text)',
    canDecode: (i) => i.text !== null && i.text.length >= 8 && i.text.length <= 100_000 && letterShare(i.text) >= 0.4,
    decode: (i) => {
      const t = i.text ?? '';
      const r = rotLetters(t, 13);
      return improvesEnglish(t, r) ? [strOut(r)] : [];
    },
  },
  {
    id: 'caesar', name: 'Caesar (best shift)', family: 'cipher', description: 'Tries all 25 shifts and keeps the most English-like result',
    canDecode: (i) => i.text !== null && i.text.length >= 10 && i.text.length <= 20_000 && letterShare(i.text) >= 0.4,
    decode: (i) => {
      const t = i.text ?? '';
      let bestShift = 0;
      let bestScore = -1;
      for (let s = 1; s < 26; s++) {
        if (s === 13) continue;
        const sc = englishness(rotLetters(t, s), 4000).score;
        if (sc > bestScore) {
          bestScore = sc;
          bestShift = s;
        }
      }
      const r = rotLetters(t, bestShift);
      return improvesEnglish(t, r) ? [strOut(r, `shift ${bestShift}`)] : [];
    },
  },
  {
    id: 'rot47', name: 'ROT47', family: 'cipher', description: 'Rotate printable ASCII (33-126) by 47',
    canDecode: (i) => i.text !== null && i.text.length >= 8 && i.text.length <= 100_000 && /^[\x21-\x7e\s]+$/.test(i.text) && /[^A-Za-z0-9\s]/.test(i.text),
    decode: (i) => {
      const t = i.text ?? '';
      const r = rot47(t);
      return improvesEnglish(t, r) || (detectStructure(r) !== null && detectStructure(t) === null) ? [strOut(r)] : [];
    },
  },
  {
    id: 'reverse', name: 'Reverse text', family: 'cipher', description: 'Reverses the characters (only offered when it produces clearly more readable text)',
    canDecode: (i) => i.text !== null && i.text.length >= 8 && i.text.length <= 100_000,
    decode: (i) => {
      const t = i.text ?? '';
      const r = Array.from(t).reverse().join('');
      return improvesEnglish(t, r) || (detectStructure(r) !== null && detectStructure(t) === null) ? [strOut(r)] : [];
    },
  },
  {
    id: 'jwt', name: 'JWT (header + payload)', family: 'container', description: 'Splits a JSON Web Token and base64url-decodes header and payload',
    canDecode: (i) => {
      const t = textOf(i);
      return !!t && /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]*)?$/.test(t);
    },
    decode: (i) => {
      const r = prettyJwt(textOf(i) ?? '');
      return r ? [strOut(r)] : [];
    },
  },
  {
    id: 'data-uri', name: 'data: URI', family: 'container', description: 'Extracts the payload of a data: URI (base64 or percent-encoded)',
    canDecode: (i) => i.text !== null && /^\s*data:[^,]*,/i.test(i.text),
    decode: (i) => {
      const m = /^\s*data:([^,]*),([\s\S]*)$/i.exec(i.text ?? '');
      if (!m) return [];
      const meta = m[1] ?? '';
      const mime = meta.split(';')[0] || 'text/plain';
      const payload = (m[2] ?? '').trim();
      const bytes = /;base64$/i.test(meta) ? base64Decode(decodeURIComponent(payload.replace(/%(?![0-9A-Fa-f]{2})/g, '%25'))).bytes : decodeEscaped(payload, /(?:%[0-9A-Fa-f]{2})+/);
      return [out(bytes, mime)];
    },
  },
  {
    id: 'punycode', name: 'Punycode (xn--)', family: 'text', description: 'Decodes IDNA punycode labels',
    canDecode: (i) => i.text !== null && /xn--/i.test(i.text),
    decode: (i) => {
      const r = punycodeText(i.text ?? '');
      return r ? [strOut(r)] : [];
    },
  },
];

// Stable ordering: specific container formats win ties against generic text decoders.
const PRIORITY = ['data-uri', 'jwt', 'punycode', 'gunzip', 'unzlib', 'inflate-raw'];
DECODERS.sort((a, b) => {
  const ia = PRIORITY.indexOf(a.id);
  const ib = PRIORITY.indexOf(b.id);
  return (ia < 0 ? 100 : ia) - (ib < 0 ? 100 : ib);
});

export const DECODER_BY_ID: Record<string, Decoder> = Object.fromEntries(DECODERS.map((d) => [d.id, d]));

/** Applies one decoder manually; throws a readable error when it cannot decode. */
export function applyDecoder(id: string, bytes: Uint8Array): DecodeOutput[] {
  const d = DECODER_BY_ID[id];
  if (!d) throw new Error(`Unknown decoder “${id}”.`);
  if (bytes.length === 0) throw new Error('Nothing to decode.');
  if (bytes.length > MAX_INPUT_BYTES) throw new Error('Input too large for this decoder.');
  const input = makeInput(bytes);
  let res: DecodeOutput[];
  try {
    res = d.decode(input);
  } catch (e) {
    throw new Error(`${d.name} could not decode this data (${e instanceof Error ? e.message : 'invalid input'}).`);
  }
  if (res.length === 0 || res.every((r) => r.bytes.length === 0)) {
    throw new Error(`${d.name} produced no output: the data does not look like ${d.name}.`);
  }
  return res;
}

/* -------------------------------------------------------------------------- */
/* Beam search                                                                */
/* -------------------------------------------------------------------------- */

interface Node {
  parent: Node | null;
  step: ChainStep | null;
  bytes: Uint8Array;
  score: Score;
  depth: number;
  rank: number;
  promise: number;
  bestBelow: number;
}

const STRONG_DECODERS = new Set(['gunzip', 'unzlib', 'base64', 'base32', 'base32hex', 'hex', 'binary', 'url', 'html', 'js-escapes', 'quoted-printable', 'utf16le', 'utf16be', 'jwt', 'data-uri', 'punycode', 'base45', 'ascii85']);

const WEAK_DECODERS = ['rot13', 'caesar', 'rot47', 'reverse'];

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function* searchGenerator(
  inputBytes: Uint8Array,
  options: SearchOptions = {}
): Generator<string, SearchResult, void> {
  const maxDepth = options.maxDepth ?? 5;
  const beamWidth = options.beamWidth ?? 6;
  const maxResults = options.maxResults ?? 8;
  const maxBytes = options.maxBytes ?? MAX_OUTPUT_BYTES;
  const budget = options.timeBudgetMs ?? 4000;
  const t0 = now();

  const rootBytes = inputBytes.length > MAX_INPUT_BYTES ? inputBytes.subarray(0, MAX_INPUT_BYTES) : inputBytes;
  const baseline = scoreBytes(rootBytes);
  const root: Node = { parent: null, step: null, bytes: rootBytes, score: baseline, depth: 0, rank: baseline.score, promise: baseline.score, bestBelow: -1 };
  const visited = new Set<string>([bytesKey(rootBytes)]);
  const all: Node[] = [];
  let frontier: Node[] = [root];
  let explored = 0;
  let timedOut = false;

  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
    const candidates: Node[] = [];
    for (const node of frontier) {
      const input = makeInput(node.bytes);
      for (const dec of DECODERS) {
        if (now() - t0 > budget) {
          timedOut = true;
          break;
        }
        let can = false;
        try {
          can = dec.canDecode(input);
        } catch {
          can = false;
        }
        if (!can) continue;
        let outputs: DecodeOutput[] = [];
        try {
          outputs = dec.decode(input);
        } catch {
          outputs = [];
        }
        explored++;
        for (const o of outputs.slice(0, 3)) {
          if (o.bytes.length === 0 || o.bytes.length > maxBytes) continue;
          if (sameBytes(o.bytes, node.bytes)) continue;
          const key = bytesKey(o.bytes);
          if (visited.has(key)) continue;
          visited.add(key);
          const score = scoreBytes(o.bytes);
          const step: ChainStep = { decoderId: dec.id, name: dec.name, params: o.params, bytes: o.bytes };
          const child: Node = {
            parent: node,
            step,
            bytes: o.bytes,
            score,
            depth,
            rank: score.score - 2 * depth,
            promise: score.score,
            bestBelow: -1,
          };
          // promising intermediates: still look like another encoding layer, or are one weak
          // transform (rot13, reverse…) away from readable text
          if (score.score < 60) {
            const ci = makeInput(o.bytes);
            let promising = false;
            for (const d2 of DECODERS) {
              if (!STRONG_DECODERS.has(d2.id)) continue;
              try {
                if (d2.canDecode(ci)) {
                  promising = true;
                  break;
                }
              } catch {
                /* ignore */
              }
            }
            if (promising) child.promise = score.score + 28;
            else if (ci.text !== null && ci.text.length <= 20_000) {
              for (const id of WEAK_DECODERS) {
                const d2 = DECODER_BY_ID[id];
                try {
                  if (d2 && d2.canDecode(ci) && d2.decode(ci).length > 0) {
                    child.promise = score.score + 24;
                    break;
                  }
                } catch {
                  /* ignore */
                }
              }
            }
          }
          candidates.push(child);
          all.push(child);
        }
      }
      yield `depth ${depth}`;
      if (timedOut) break;
    }
    candidates.sort((a, b) => b.promise - a.promise || b.score.score - a.score.score);
    frontier = candidates.slice(0, beamWidth).filter((c) => c.promise >= 12);
    if (timedOut) break;
  }

  // Drop intermediate steps that a deeper chain improves on.
  for (let i = all.length - 1; i >= 0; i--) {
    const n = all[i];
    if (!n || !n.parent) continue;
    const best = Math.max(n.rank, n.bestBelow);
    if (best > n.parent.bestBelow) n.parent.bestBelow = best;
  }
  const keep = all.filter((n) => !(n.bestBelow > n.rank));
  keep.sort((a, b) => b.rank - a.rank || a.depth - b.depth);

  const chains: Chain[] = keep.slice(0, maxResults).map((n) => {
    const steps: ChainStep[] = [];
    for (let cur: Node | null = n; cur && cur.step; cur = cur.parent) steps.unshift(cur.step);
    return { steps, output: n.bytes, score: n.score, rank: n.rank };
  });
  return { baseline, chains, best: chains[0] ?? null, explored, timedOut, inputBytes: inputBytes.length };
}

export function magicSearch(input: Uint8Array | string, options: SearchOptions = {}): SearchResult {
  const bytes = typeof input === 'string' ? toBytes(input) : input;
  const gen = searchGenerator(bytes, options);
  let r = gen.next();
  while (!r.done) r = gen.next();
  return r.value;
}

export async function magicSearchAsync(
  input: Uint8Array | string,
  options: SearchOptions = {},
  isCancelled: () => boolean = () => false
): Promise<SearchResult | null> {
  const bytes = typeof input === 'string' ? toBytes(input) : input;
  const gen = searchGenerator(bytes, options);
  let r = gen.next();
  while (!r.done) {
    if (isCancelled()) return null;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    r = gen.next();
  }
  return isCancelled() ? null : r.value;
}

/* -------------------------------------------------------------------------- */
/* Display helpers                                                            */
/* -------------------------------------------------------------------------- */

export function hexDump(bytes: Uint8Array, maxBytes = 2048): string {
  const n = Math.min(bytes.length, maxBytes);
  const lines: string[] = [];
  for (let off = 0; off < n; off += 16) {
    const row = bytes.subarray(off, Math.min(off + 16, n));
    const hex = Array.from(row, (v) => v.toString(16).padStart(2, '0')).join(' ');
    const ascii = Array.from(row, (v) => (v >= 32 && v < 127 ? String.fromCharCode(v) : '.')).join('');
    lines.push(`${off.toString(16).padStart(8, '0')}  ${hex.padEnd(47, ' ')}  |${ascii}|`);
  }
  if (bytes.length > n) lines.push(`… ${(bytes.length - n).toLocaleString('en-US')} more bytes`);
  return lines.join('\n');
}

export interface Preview {
  kind: 'text' | 'hex';
  text: string;
  truncated: boolean;
}

export function previewBytes(bytes: Uint8Array, score?: Score, max = 4000): Preview {
  const s = score ?? scoreBytes(bytes);
  if (s.kind === 'text') {
    const full = bytesToDisplayText(bytes, max * 4);
    return { kind: 'text', text: full.length > max ? full.slice(0, max) : full, truncated: full.length > max || bytes.length > max * 4 };
  }
  return { kind: 'hex', text: hexDump(bytes, 512), truncated: bytes.length > 512 };
}

/* -------------------------------------------------------------------------- */
/* Identify panel                                                             */
/* -------------------------------------------------------------------------- */

export interface IdentifyHit {
  label: string;
  detail: string;
  confidence: Confidence;
}

const BASE64_PREFIXES: { prefix: string; label: string }[] = [
  { prefix: 'iVBORw0KGgo', label: 'PNG image' },
  { prefix: '/9j/', label: 'JPEG image' },
  { prefix: 'R0lGOD', label: 'GIF image' },
  { prefix: 'UklGR', label: 'RIFF container (WebP / WAV)' },
  { prefix: 'JVBERi', label: 'PDF document' },
  { prefix: 'UEsDB', label: 'ZIP archive (zip / docx / xlsx / jar)' },
  { prefix: 'H4sI', label: 'gzip data' },
  { prefix: 'rO0AB', label: 'Java serialized object (aced0005)' },
  { prefix: 'TVqQ', label: 'Windows PE executable (MZ)' },
  { prefix: 'f0VMR', label: 'ELF executable' },
  { prefix: 'PHN2Zy', label: 'SVG image (text)' },
  { prefix: 'PD94bWw', label: 'XML document' },
  { prefix: 'AAAAGGZ0eXA', label: 'MP4 / ISO media' },
  { prefix: 'eJ', label: 'zlib-compressed data (likely)' },
  { prefix: 'Qk', label: 'BMP image (likely)' },
];

export function identifyInput(raw: string): IdentifyHit[] {
  const t = clean(raw);
  const hits: IdentifyHit[] = [];
  const add = (label: string, detail: string, confidence: Confidence) => hits.push({ label, detail, confidence });
  if (!t) return hits;
  const compact = t.replace(/\s+/g, '');

  if (/^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]*)?$/.test(t)) {
    const p = prettyJwt(t);
    add('JSON Web Token (JWT)', p ? 'Header and payload decode as JSON.' : 'Starts like a JWT but does not decode.', p ? 'high' : 'low');
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) {
    add('UUID / GUID', `Version ${t.charAt(14)}.`, 'high');
  }
  if (/^[0-9a-fA-F]+$/.test(compact) && compact.length >= 8) {
    const names: Record<number, string> = { 32: 'MD5 (or NTLM / MD4)', 40: 'SHA-1', 56: 'SHA-224 / SHA3-224', 64: 'SHA-256 (or SHA3-256 / BLAKE2s)', 96: 'SHA-384', 128: 'SHA-512 (or SHA3-512 / BLAKE2b)' };
    const n = names[compact.length];
    if (n) add(`Looks like a hash digest: ${n}`, `${compact.length} hex characters = ${compact.length * 4} bits. Digests cannot be decoded, only matched.`, 'medium');
    else add('Hex string', `${compact.length} hex characters (${Math.floor(compact.length / 2)} bytes).`, 'medium');
  }
  if (/-----BEGIN [A-Z0-9 ]+-----/.test(t)) {
    const m = /-----BEGIN ([A-Z0-9 ]+)-----/.exec(t);
    add('PEM block', `${m?.[1] ?? 'PEM'}: base64 between BEGIN/END lines.`, 'high');
  }
  const dataUri = /^data:([^,;]*)(;[^,]*)?,/i.exec(t);
  if (dataUri) add('data: URI', `Embedded ${dataUri[1] || 'text/plain'}${/;base64/i.test(dataUri[2] ?? '') ? ' (base64)' : ''}.`, 'high');
  if (/^\$(?:2[abxy]|1|5|6|y|argon2(?:id|i|d)|apr1)\$/.test(t) || /^\$[PH]\$/.test(t)) add('Password hash (modular crypt format)', 'Starts with a crypt scheme prefix such as $2b$, $6$ or $argon2id$.', 'high');
  if (/^[A-Za-z0-9+/_-]{16,}={0,2}$/.test(compact) && !/^[0-9a-fA-F]+$/.test(compact)) {
    for (const p of BASE64_PREFIXES) {
      if (compact.startsWith(p.prefix)) {
        add(`Base64-encoded ${p.label}`, `The prefix “${p.prefix}” is the base64 form of that file’s magic bytes.`, p.prefix.length >= 4 ? 'high' : 'low');
        break;
      }
    }
  }
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(compact) && compact.length >= 8 && compact.length % 4 === 0 && !/^[0-9a-fA-F]+$/.test(compact)) add('Base64', `${compact.length} characters, valid length and alphabet.`, 'medium');
  else if (/^[A-Za-z0-9_-]+={0,2}$/.test(compact) && compact.length >= 8 && /[_-]/.test(compact)) add('Base64url', 'URL-safe base64 alphabet (- and _).', 'medium');
  if (/^[A-Z2-7]{8,}={0,6}$/.test(compact) && compact.length % 8 === 0) add('Base32', 'Uppercase A-Z2-7 alphabet.', 'medium');
  if (/^[01\s]+$/.test(t) && compact.length >= 8 && compact.length % 8 === 0) add('Binary string', `${compact.length / 8} bytes of 0/1 bits.`, 'high');
  if (/%[0-9A-Fa-f]{2}/.test(t)) add('Percent-encoded (URL encoding)', 'Contains %XX sequences.', 'high');
  if (/&(?:#\d+|#x[0-9a-f]+|[a-z]+);/i.test(t)) add('HTML entities', 'Contains &…; entities.', 'high');
  if (/\\u[0-9a-fA-F]{4}|\\x[0-9a-fA-F]{2}/.test(t)) add('Escaped string (\\u / \\x)', 'JavaScript / JSON style escapes.', 'high');
  if (/=[0-9A-F]{2}/.test(t) && /[A-Za-z]/.test(t)) add('Quoted-printable', 'Contains =XX sequences.', 'low');
  if (/xn--/i.test(t)) add('Punycode (IDNA)', 'Contains xn-- labels.', 'high');
  if (/^(?:https?|ftp|wss?):\/\/\S+$/i.test(t)) add('URL', 'Absolute URL.', 'high');
  if (/^[\w.+-]+@[\w-]+(?:\.[\w-]+)+$/.test(t)) add('Email address', '', 'high');
  if (/^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(t)) add('IPv4 address', '', 'high');
  if (/^(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i.test(t)) add('MAC address', '', 'high');
  if (/^\d{10}$/.test(t) || /^\d{13}$/.test(t)) {
    const ms = t.length === 13 ? Number(t) : Number(t) * 1000;
    const d = new Date(ms);
    if (d.getFullYear() >= 2000 && d.getFullYear() <= 2100) add(`Unix timestamp (${t.length === 13 ? 'ms' : 's'})`, d.toISOString(), 'medium');
  }
  if (/^[{[]/.test(t)) {
    try {
      JSON.parse(t);
      add('JSON', 'Valid JSON document.', 'high');
    } catch {
      /* not json */
    }
  }
  if (/^<\?xml|^<!doctype|^<[a-z][\w:-]*[\s>]/i.test(t)) add('XML / HTML', 'Markup document.', 'medium');
  if (/^[1-9A-HJ-NP-Za-km-z]{25,}$/.test(t) && /^[13]/.test(t) && t.length <= 35) add('Bitcoin address (Base58Check)', 'Public identifier.', 'low');
  if (/^0x[0-9a-fA-F]{40}$/.test(t)) add('Ethereum address', '', 'high');
  if (/^[0-9A-HJKMNP-TV-Z]{26}$/.test(t)) add('ULID', 'Sortable 26-character identifier.', 'low');
  return hits;
}

/* -------------------------------------------------------------------------- */
/* Examples                                                                   */
/* -------------------------------------------------------------------------- */

export function utf16leBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length * 2);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out[i * 2] = c & 0xff;
    out[i * 2 + 1] = c >> 8;
  }
  return out;
}

export interface Example {
  id: string;
  label: string;
  input: string;
  /** What a correct search should end with. */
  expected: string;
  /** Number of decode steps in the intended chain. */
  steps: number;
}

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(data: Uint8Array): string {
  let bits = 0;
  let acc = 0;
  let o = '';
  for (const b of data) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      o += B32.charAt((acc >> bits) & 31);
      acc &= (1 << bits) - 1;
    }
  }
  if (bits > 0) o += B32.charAt((acc << (5 - bits)) & 31);
  while (o.length % 8) o += '=';
  return o;
}

function ascii85Encode(data: Uint8Array): string {
  let o = '';
  for (let i = 0; i < data.length; i += 4) {
    const n = Math.min(4, data.length - i);
    let v = 0;
    for (let k = 0; k < 4; k++) v = v * 256 + (data[i + k] ?? 0);
    if (n === 4 && v === 0) {
      o += 'z';
      continue;
    }
    const digits: string[] = [];
    for (let k = 0; k < 5; k++) {
      digits.unshift(String.fromCharCode((v % 85) + 33));
      v = Math.floor(v / 85);
    }
    o += digits.slice(0, n + 1).join('');
  }
  return `<~${o}~>`;
}

function hexEncode(bytes: Uint8Array): string {
  return bytesToHex(bytes);
}

export function buildExamples(): Example[] {
  const json = JSON.stringify({ user: 'alice', roles: ['admin', 'editor'], active: true, profile: { email: 'alice@corp.example.org', age: 31 } }, null, 1);
  const note = 'Meet me at the old library tonight. Bring the secret documents and do not tell anyone.';
  let ps = "Write-Host 'Hello from an encoded PowerShell command'; Get-Date";
  // make sure the Base64 text contains characters that need percent-encoding (=, + or /)
  while (encodeURIComponent(base64Encode(utf16leBytes(ps))) === base64Encode(utf16leBytes(ps))) ps += ' ';
  const qp = 'Caf\u00e9 cr\u00e8me br\u00fbl\u00e9e is a very nice French dessert, we should order two of them tonight.';
  const jwtPart = (o: unknown) => base64Encode(toBytes(JSON.stringify(o))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const rot13 = (t: string) => rotLetters(t, 13);
  return [
    { id: 'b64-gzip-json', label: 'Base64 → gzip → JSON', input: base64Encode(gzipSync(toBytes(json))), expected: json, steps: 2 },
    { id: 'hex-b64', label: 'Hex → Base64 → text', input: hexEncode(toBytes(base64Encode(toBytes(note)))), expected: note, steps: 2 },
    {
      id: 'url-b64-utf16',
      label: 'URL → Base64 → UTF-16LE (PowerShell)',
      input: encodeURIComponent(base64Encode(utf16leBytes(ps))),
      expected: ps,
      steps: 3,
    },
    { id: 'rot13', label: 'ROT13', input: rot13(note), expected: note, steps: 1 },
    { id: 'base32', label: 'Base32', input: base32Encode(toBytes(note)), expected: note, steps: 1 },
    { id: 'ascii85', label: 'Ascii85', input: ascii85Encode(toBytes(note)), expected: note, steps: 1 },
    {
      id: 'jwt',
      label: 'JWT',
      input: `${jwtPart({ alg: 'HS256', typ: 'JWT' })}.${jwtPart({ sub: '1234567890', name: 'Sample User', admin: false, iat: 1516239022 })}.${jwtPart('signature')}`,
      expected: '',
      steps: 1,
    },
    {
      id: 'qp',
      label: 'Quoted-printable',
      input: Array.from(toBytes(qp), (b) => (b > 126 || b === 61 ? `=${b.toString(16).toUpperCase().padStart(2, '0')}` : String.fromCharCode(b))).join(''),
      expected: qp,
      steps: 1,
    },
  ];
}
