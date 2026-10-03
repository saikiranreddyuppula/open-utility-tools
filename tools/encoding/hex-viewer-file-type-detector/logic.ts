/**
 * Hex viewer + file-type detector core. Pure TypeScript, no DOM.
 * Everything that touches a file works through a `ReadAt(offset, length)` callback so that
 * multi-gigabyte files are only ever read in windows.
 */

export type ReadAt = (offset: number, length: number) => Promise<Uint8Array>;

/* ------------------------------------------------------------------ */
/* Paste parsing                                                       */
/* ------------------------------------------------------------------ */

export const MAX_PASTE_BYTES = 64 * 1024 * 1024;

function bytesFromHexTokens(tokens: string[]): Uint8Array {
  let total = 0;
  for (const t of tokens) total += t.length >> 1;
  if (total > MAX_PASTE_BYTES) throw new Error('Pasted data is larger than 64 MB - open it as a file instead.');
  const out = new Uint8Array(total);
  let o = 0;
  for (const t of tokens) for (let i = 0; i < t.length; i += 2) out[o++] = parseInt(t.slice(i, i + 2), 16);
  return out;
}

const DUMP_LINE = /^\s*(?:0x)?([0-9a-fA-F]{4,16})(?::\s+|\s{2,})(.*)$/;

/** hexdump -C / xxd / od style listings: strip the offset and ASCII gutters. */
function tryParseDump(lines: string[]): string[] | null {
  const body = lines.filter((l) => l.trim() !== '');
  if (body.length === 0) return null;
  const first = DUMP_LINE.exec(body[0] ?? '');
  if (!first) return null;
  const firstOffset = parseInt(first[1] ?? '', 16);
  const hasBar = body.some((l) => l.includes('|'));
  if (!(firstOffset === 0 || hasBar)) return null;
  const tokens: string[] = [];
  for (const l of body) {
    const m = DUMP_LINE.exec(l);
    if (!m) {
      // trailing "00000020" total-length line of hexdump
      if (/^\s*[0-9a-fA-F]{4,16}\s*$/.test(l)) continue;
      return null;
    }
    let rest = m[2] ?? '';
    const bar = rest.indexOf('|');
    if (bar !== -1) rest = rest.slice(0, bar);
    else {
      const gap = rest.search(/ {2}\S/);
      if (gap !== -1 && l.includes(': ')) rest = rest.slice(0, gap);
    }
    for (const t of rest.trim().split(/\s+/)) {
      if (t === '') continue;
      if (!/^[0-9a-fA-F]+$/.test(t) || t.length % 2 !== 0) return null;
      tokens.push(t);
    }
  }
  return tokens;
}

/**
 * Parse pasted hex in many styles: "de ad be ef", "DE:AD:BE:EF", "0xde, 0xad", "\xde\xad", "deadbeef",
 * C arrays ("{0x00, 0x01}"), and hexdump -C / xxd listings.
 */
export function parseHexInput(text: string): Uint8Array {
  let t = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const dump = tryParseDump(t.split('\n'));
  if (dump) return bytesFromHexTokens(dump);
  t = t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  t = t.replace(/\\x/gi, ' ').replace(/0x/gi, ' ').replace(/[{}[\]();"'`]/g, ' ').replace(/[,:\-_.]/g, ' ');
  const raw = t.split(/\s+/).filter(Boolean);
  if (raw.length === 0) throw new Error('Nothing to parse - paste some hex bytes.');
  const tokens: string[] = [];
  for (const tok of raw) {
    const bad = /[^0-9a-fA-F]/.exec(tok);
    if (bad) throw new Error(`Invalid hex character "${bad[0]}" in "${tok.length > 24 ? `${tok.slice(0, 24)}…` : tok}".`);
    if (tok.length === 1) tokens.push(`0${tok}`);
    else if (tok.length % 2 === 1) throw new Error(`Odd number of hex digits in "${tok.length > 24 ? `${tok.slice(0, 24)}…` : tok}" - bytes need two digits each.`);
    else tokens.push(tok);
  }
  return bytesFromHexTokens(tokens);
}

export function parseBase64Input(text: string): Uint8Array {
  let s = text.trim().replace(/^data:[^,]*;base64,/i, '');
  s = s.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (s === '') throw new Error('Nothing to decode - paste some Base64.');
  const bad = /[^A-Za-z0-9+/=]/.exec(s);
  if (bad) throw new Error(`Invalid Base64 character "${bad[0]}".`);
  s = s.replace(/=+$/, '');
  if (s.length % 4 === 1) throw new Error('Invalid Base64 length (a stray character is left over).');
  s += '='.repeat((4 - (s.length % 4)) % 4);
  if ((s.length / 4) * 3 > MAX_PASTE_BYTES) throw new Error('Pasted data is larger than 64 MB - open it as a file instead.');
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ------------------------------------------------------------------ */
/* Formatting & export                                                 */
/* ------------------------------------------------------------------ */

export function hex2(b: number, upper: boolean): string {
  const s = b.toString(16).padStart(2, '0');
  return upper ? s.toUpperCase() : s;
}

export function toHexString(bytes: Uint8Array, upper = false, sep = ' '): string {
  const parts: string[] = new Array<string>(bytes.length);
  for (let i = 0; i < bytes.length; i++) parts[i] = hex2(bytes[i] ?? 0, upper);
  return parts.join(sep);
}

export function toCArray(bytes: Uint8Array, name = 'data', upper = false, perLine = 12): string {
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += perLine) {
    const row: string[] = [];
    for (let j = i; j < Math.min(bytes.length, i + perLine); j++) row.push(`0x${hex2(bytes[j] ?? 0, upper)}`);
    lines.push(`  ${row.join(', ')}`);
  }
  return `unsigned char ${name}[] = {\n${lines.join(',\n')}\n};\nunsigned int ${name}_len = ${bytes.length};\n`;
}

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + CH)));
  return btoa(s);
}

export function asciiChar(b: number): string {
  return b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.';
}

export function formatOffset(n: number, width = 8): string {
  return n.toString(16).padStart(width, '0');
}

/**
 * Offset input: "0x1F0", "1F0h" or a value with a-f letters is hex; plain digits are decimal;
 * a leading "-" counts from the end of the data.
 */
export function parseOffset(input: string, size: number): number {
  let s = input.trim().replace(/[_,\s]/g, '');
  if (s === '') throw new Error('Enter an offset.');
  let fromEnd = false;
  if (s.startsWith('-')) {
    fromEnd = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) s = s.slice(1);
  let n: number;
  if (/^0x[0-9a-f]+$/i.test(s)) n = parseInt(s.slice(2), 16);
  else if (/^[0-9a-f]+h$/i.test(s)) n = parseInt(s.slice(0, -1), 16);
  else if (/^\d+$/.test(s)) n = parseInt(s, 10);
  else if (/^[0-9a-f]+$/i.test(s)) n = parseInt(s, 16);
  else throw new Error(`"${input.trim()}" is not a valid offset (use decimal or hex like 0x1F0).`);
  if (!Number.isFinite(n) || n > Number.MAX_SAFE_INTEGER) throw new Error('Offset is too large.');
  if (fromEnd) n = size - n;
  if (n < 0 || n >= Math.max(size, 1)) throw new Error(`Offset is outside the data (${size.toLocaleString('en-US')} bytes, valid 0 to ${Math.max(0, size - 1).toLocaleString('en-US')}).`);
  return n;
}

/* ------------------------------------------------------------------ */
/* Data inspector                                                      */
/* ------------------------------------------------------------------ */

export interface InspectRow {
  label: string;
  le: string;
  be: string;
  /** Single value rows show only `le`. */
  single?: boolean;
}

export function fmtF32(x: number): string {
  if (!Number.isFinite(x)) return String(x);
  if (x === 0) return Object.is(x, -0) ? '-0' : '0';
  for (let p = 1; p <= 9; p++) {
    const s = x.toPrecision(p);
    if (Math.fround(Number(s)) === x) return String(Number(s));
  }
  return String(x);
}

function fmtF64(x: number): string {
  if (!Number.isFinite(x)) return String(x);
  return Object.is(x, -0) ? '-0' : String(x);
}

function isoUtc(ms: number): string | null {
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '').replace(/Z$/, '') + ' UTC';
}

export function utf8CharAt(b: Uint8Array): string {
  const lead = b[0];
  if (lead === undefined) return '-';
  let len = 1;
  if (lead >= 0xf0 && lead <= 0xf4) len = 4;
  else if (lead >= 0xe0) len = 3;
  else if (lead >= 0xc2) len = 2;
  else if (lead >= 0x80) return `invalid UTF-8 (0x${hex2(lead, true)} is a continuation or overlong lead byte)`;
  if (len > b.length) return `incomplete UTF-8 sequence (${len} bytes needed)`;
  try {
    const s = new TextDecoder('utf-8', { fatal: true }).decode(b.subarray(0, len));
    const cp = s.codePointAt(0) ?? 0;
    const shown = cp < 0x20 || cp === 0x7f ? '' : ` "${s}"`;
    return `U+${cp.toString(16).toUpperCase().padStart(4, '0')}${shown} (${len} byte${len > 1 ? 's' : ''})`;
  } catch {
    return 'invalid UTF-8 sequence';
  }
}

/** Interpretations of the bytes starting at the selection (pass up to 16 bytes). */
export function inspectBytes(b: Uint8Array): InspectRow[] {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const n = b.length;
  const rows: InspectRow[] = [];
  if (n === 0) return rows;
  const dash = '-';
  const both = (label: string, need: number, f: (le: boolean) => string) => {
    rows.push({ label, le: n >= need ? f(true) : dash, be: n >= need ? f(false) : dash });
  };
  if (n >= 1) {
    rows.push({ label: 'u8', le: String(dv.getUint8(0)), be: '', single: true });
    rows.push({ label: 'i8', le: String(dv.getInt8(0)), be: '', single: true });
  }
  both('u16', 2, (le) => String(dv.getUint16(0, le)));
  both('i16', 2, (le) => String(dv.getInt16(0, le)));
  both('u32', 4, (le) => String(dv.getUint32(0, le)));
  both('i32', 4, (le) => String(dv.getInt32(0, le)));
  both('u64', 8, (le) => dv.getBigUint64(0, le).toString());
  both('i64', 8, (le) => dv.getBigInt64(0, le).toString());
  both('f32', 4, (le) => fmtF32(dv.getFloat32(0, le)));
  both('f64', 8, (le) => fmtF64(dv.getFloat64(0, le)));
  both('Unix time (u32 seconds)', 4, (le) => isoUtc(dv.getUint32(0, le) * 1000) ?? dash);
  both('Unix time (u64 ms)', 8, (le) => {
    const v = Number(dv.getBigUint64(0, le));
    const d = new Date(v);
    const y = d.getUTCFullYear();
    return Number.isFinite(v) && y >= 1990 && y <= 2100 ? (isoUtc(v) ?? dash) : dash;
  });
  if (n >= 8) {
    const ticks = dv.getBigUint64(0, true);
    const ms = Number(ticks / 10000n) - 11644473600000;
    const y = new Date(ms).getUTCFullYear();
    rows.push({ label: 'Windows FILETIME (u64)', le: y >= 1980 && y <= 2100 ? (isoUtc(ms) ?? dash) : dash, be: '', single: true });
  }
  if (n >= 1) {
    const v = dv.getUint8(0);
    const bin = v.toString(2).padStart(8, '0');
    rows.push({ label: 'Binary (byte)', le: `${bin.slice(0, 4)} ${bin.slice(4)}`, be: '', single: true });
    rows.push({ label: 'Octal / hex (byte)', le: `0o${v.toString(8)} / 0x${hex2(v, true)}`, be: '', single: true });
    rows.push({ label: 'UTF-8 character', le: utf8CharAt(b.subarray(0, Math.min(4, n))), be: '', single: true });
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

const fold = (b: number) => (b >= 65 && b <= 90 ? b + 32 : b);

function indexOfPattern(buf: Uint8Array, pat: Uint8Array, from: number, ic: boolean): number {
  const n = buf.length - pat.length;
  const first = pat[0] ?? 0;
  for (let i = from; i <= n; ) {
    const at = ic ? -1 : buf.indexOf(first, i);
    let start = at;
    if (ic) {
      while (i <= n && fold(buf[i] ?? 0) !== first) i++;
      if (i > n) return -1;
      start = i;
    } else if (at === -1 || at > n) return -1;
    let ok = true;
    for (let k = 1; k < pat.length; k++) {
      const x = buf[start + k] ?? 0;
      if ((ic ? fold(x) : x) !== pat[k]) {
        ok = false;
        break;
      }
    }
    if (ok) return start;
    i = start + 1;
  }
  return -1;
}

function lastIndexOfPattern(buf: Uint8Array, pat: Uint8Array, from: number, ic: boolean): number {
  for (let i = Math.min(from, buf.length - pat.length); i >= 0; i--) {
    let ok = true;
    for (let k = 0; k < pat.length; k++) {
      const x = buf[i + k] ?? 0;
      if ((ic ? fold(x) : x) !== pat[k]) {
        ok = false;
        break;
      }
    }
    if (ok) return i;
  }
  return -1;
}

export interface SearchOptions {
  ignoreCase?: boolean;
  chunk?: number;
  /** Set `.cancelled = true` to abort. */
  signal?: { cancelled: boolean };
  onProgress?: (pos: number) => void;
}

/**
 * Find the next (dir = 1, match starting at >= from) or previous (dir = -1, match starting at <= from) occurrence.
 * Reads the file in windows; returns the match offset or -1.
 */
export async function findPattern(read: ReadAt, size: number, pattern: Uint8Array, from: number, dir: 1 | -1, opts: SearchOptions = {}): Promise<number> {
  const plen = pattern.length;
  if (plen === 0 || plen > size) return -1;
  const ic = opts.ignoreCase === true;
  const pat = ic ? pattern.map(fold) : pattern;
  const CH = opts.chunk ?? 4 * 1024 * 1024;
  if (dir === 1) {
    let pos = Math.max(0, from);
    while (pos + plen <= size) {
      if (opts.signal?.cancelled) return -2;
      const len = Math.min(CH + plen - 1, size - pos);
      const buf = await read(pos, len);
      const idx = indexOfPattern(buf, pat, 0, ic);
      if (idx !== -1) return pos + idx;
      pos += CH;
      opts.onProgress?.(pos);
    }
    return -1;
  }
  let end = Math.min(size, from + plen);
  while (end >= plen) {
    if (opts.signal?.cancelled) return -2;
    const start = Math.max(0, end - CH - plen + 1);
    const buf = await read(start, end - start);
    const idx = lastIndexOfPattern(buf, pat, buf.length - plen, ic);
    if (idx !== -1) return start + idx;
    if (start === 0) return -1;
    end = start + plen - 1;
    opts.onProgress?.(start);
  }
  return -1;
}

/* ------------------------------------------------------------------ */
/* Entropy                                                             */
/* ------------------------------------------------------------------ */

export function entropyFromCounts(counts: ArrayLike<number>, total: number): number {
  if (total <= 0) return 0;
  let h = 0;
  for (let i = 0; i < 256; i++) {
    const c = counts[i] ?? 0;
    if (c > 0) {
      const p = c / total;
      h -= p * Math.log2(p);
    }
  }
  return h;
}

export function shannonEntropy(b: Uint8Array): number {
  const c = new Uint32Array(256);
  for (let i = 0; i < b.length; i++) c[b[i] ?? 0] = (c[b[i] ?? 0] ?? 0) + 1;
  return entropyFromCounts(c, b.length);
}

export interface EntropyResult {
  overall: number;
  blocks: number[];
  blockSize: number;
  histogram: number[];
  size: number;
}

/** Streams a file through once, producing overall entropy, a byte histogram and per-block entropy. */
export class EntropyAccumulator {
  readonly blockSize: number;
  private readonly nBlocks: number;
  private readonly hist = new Float64Array(256);
  private readonly cur = new Uint32Array(256);
  private readonly blocks: number[] = [];
  private curCount = 0;
  private seen = 0;

  constructor(
    readonly size: number,
    blocks = 256,
    minBlockSize = 256
  ) {
    this.nBlocks = Math.max(1, Math.min(blocks, size));
    this.blockSize = Math.max(minBlockSize, 1, Math.ceil(size / this.nBlocks));
  }

  push(chunk: Uint8Array): void {
    let i = 0;
    while (i < chunk.length) {
      const room = this.blockSize - this.curCount;
      const end = Math.min(chunk.length, i + room);
      for (let k = i; k < end; k++) {
        const v = chunk[k] ?? 0;
        this.cur[v] = (this.cur[v] ?? 0) + 1;
        this.hist[v] = (this.hist[v] ?? 0) + 1;
      }
      this.curCount += end - i;
      this.seen += end - i;
      i = end;
      if (this.curCount === this.blockSize) this.flush();
    }
  }

  private flush(): void {
    if (this.curCount === 0) return;
    this.blocks.push(entropyFromCounts(this.cur, this.curCount));
    this.cur.fill(0);
    this.curCount = 0;
  }

  finish(): EntropyResult {
    this.flush();
    return { overall: entropyFromCounts(this.hist, this.seen), blocks: this.blocks, blockSize: this.blockSize, histogram: Array.from(this.hist), size: this.seen };
  }
}

export function describeEntropy(h: number): string {
  if (h < 0.5) return 'almost constant (padding / zeros)';
  if (h < 3.5) return 'very low - sparse or highly repetitive data';
  if (h < 5.5) return 'low - text or structured data';
  if (h < 6.8) return 'medium - typical code, mixed data';
  if (h < 7.5) return 'high - dense binary, possibly compressed';
  return 'very high - compressed or encrypted';
}

/* ------------------------------------------------------------------ */
/* File type detection                                                 */
/* ------------------------------------------------------------------ */

export type Category = 'image' | 'audio' | 'video' | 'archive' | 'document' | 'executable' | 'font' | 'database' | 'text' | 'data' | 'disk' | 'other';
export type Confidence = 'high' | 'medium' | 'low';

export interface FileType {
  id: string;
  name: string;
  mime: string;
  /** Typical extension (without dot). */
  ext: string;
  /** All extensions that are normal for this type. */
  exts: string[];
  category: Category;
}

export interface Detection extends FileType {
  confidence: Confidence;
  details: string[];
  /** Other formats the bytes also match (e.g. a DOCX is also a ZIP). */
  alternatives: string[];
}

type Magic = { at: number; bytes: number[] };
interface Sig extends FileType {
  magic: Magic[];
  conf?: Confidence;
  check?: (h: Uint8Array, size: number) => boolean;
  score: number;
}

function H(at: number, hex: string): Magic {
  return {
    at,
    bytes: hex
      .trim()
      .split(/\s+/)
      .map((t) => (t === '??' ? -1 : parseInt(t, 16))),
  };
}
function A(at: number, ascii: string): Magic {
  return { at, bytes: Array.from(ascii, (c) => c.charCodeAt(0)) };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const SIGS: Sig[] = [];

function def(name: string, mime: string, ext: string, category: Category, magic: Magic[], o: { exts?: string[]; conf?: Confidence; check?: Sig['check']; id?: string; bias?: number } = {}): void {
  let score = o.bias ?? 0;
  for (const m of magic) for (const b of m.bytes) if (b !== -1) score++;
  if (o.check) score += 2;
  SIGS.push({ id: o.id ?? slug(name), name, mime, ext, exts: o.exts ?? [ext], category, magic, conf: o.conf, check: o.check, score });
}

const u16be = (h: Uint8Array, o: number) => ((h[o] ?? 0) << 8) | (h[o + 1] ?? 0);
const u32be = (h: Uint8Array, o: number) => (((h[o] ?? 0) << 24) | ((h[o + 1] ?? 0) << 16) | ((h[o + 2] ?? 0) << 8) | (h[o + 3] ?? 0)) >>> 0;
const u16le = (h: Uint8Array, o: number) => (h[o] ?? 0) | ((h[o + 1] ?? 0) << 8);
const u32le = (h: Uint8Array, o: number) => ((h[o] ?? 0) | ((h[o + 1] ?? 0) << 8) | ((h[o + 2] ?? 0) << 16) | ((h[o + 3] ?? 0) << 24)) >>> 0;
const ascii = (h: Uint8Array, o: number, n: number) => {
  let s = '';
  for (let i = 0; i < n; i++) s += String.fromCharCode(h[o + i] ?? 0);
  return s;
};

/* ---- images ---- */
def('PNG image', 'image/png', 'png', 'image', [H(0, '89 50 4E 47 0D 0A 1A 0A')]);
def('JPEG image', 'image/jpeg', 'jpg', 'image', [H(0, 'FF D8 FF')], { exts: ['jpg', 'jpeg', 'jpe', 'jfif'], conf: 'high' });
def('GIF image', 'image/gif', 'gif', 'image', [A(0, 'GIF8')], { check: (h) => (h[4] === 0x37 || h[4] === 0x39) && h[5] === 0x61 });
def('WebP image', 'image/webp', 'webp', 'image', [A(0, 'RIFF'), H(4, '?? ?? ?? ??'), A(8, 'WEBP')]);
def('BMP image', 'image/bmp', 'bmp', 'image', [A(0, 'BM')], {
  exts: ['bmp', 'dib'],
  check: (h) => [12, 40, 52, 56, 64, 108, 124].includes(u32le(h, 14)),
});
def('ICO icon', 'image/vnd.microsoft.icon', 'ico', 'image', [H(0, '00 00 01 00')], {
  check: (h) => u16le(h, 4) >= 1 && u16le(h, 4) <= 256 && h[9] === 0 && (h[10] ?? 0) <= 1,
  conf: 'medium',
});
def('CUR cursor', 'image/x-icon', 'cur', 'image', [H(0, '00 00 02 00')], { check: (h) => u16le(h, 4) >= 1 && u16le(h, 4) <= 256 && h[9] === 0, conf: 'medium' });
def('TIFF image (little-endian)', 'image/tiff', 'tiff', 'image', [H(0, '49 49 2A 00')], { exts: ['tif', 'tiff'] });
def('TIFF image (big-endian)', 'image/tiff', 'tiff', 'image', [H(0, '4D 4D 00 2A')], { exts: ['tif', 'tiff'] });
def('BigTIFF image', 'image/tiff', 'tif', 'image', [H(0, '49 49 2B 00')], { exts: ['tif', 'tiff'] });
def('BigTIFF image (big-endian)', 'image/tiff', 'tif', 'image', [H(0, '4D 4D 00 2B')], { exts: ['tif', 'tiff'] });
def('Photoshop document (PSD)', 'image/vnd.adobe.photoshop', 'psd', 'image', [A(0, '8BPS'), H(4, '00 01')]);
def('Photoshop large document (PSB)', 'image/vnd.adobe.photoshop', 'psb', 'image', [A(0, '8BPS'), H(4, '00 02')]);
def('JPEG 2000 image', 'image/jp2', 'jp2', 'image', [H(0, '00 00 00 0C 6A 50 20 20 0D 0A 87 0A')], { exts: ['jp2', 'j2k', 'jpf'] });
def('JPEG 2000 codestream', 'image/x-jp2-codestream', 'j2k', 'image', [H(0, 'FF 4F FF 51')], { exts: ['j2k', 'j2c', 'jpc'] });
def('JPEG XL image', 'image/jxl', 'jxl', 'image', [H(0, '00 00 00 0C 4A 58 4C 20 0D 0A 87 0A')]);
def('JPEG XL codestream', 'image/jxl', 'jxl', 'image', [H(0, 'FF 0A')], { conf: 'low' });
def('DirectDraw Surface texture (DDS)', 'image/vnd-ms.dds', 'dds', 'image', [A(0, 'DDS '), H(4, '7C 00 00 00')]);
def('OpenEXR image', 'image/x-exr', 'exr', 'image', [H(0, '76 2F 31 01')]);
def('Radiance HDR image', 'image/vnd.radiance', 'hdr', 'image', [A(0, '#?RADIANCE')], { exts: ['hdr', 'pic'] });
def('Apple icon image (ICNS)', 'image/x-icns', 'icns', 'image', [A(0, 'icns')]);
def('GIMP image (XCF)', 'image/x-xcf', 'xcf', 'image', [A(0, 'gimp xcf ')]);
def('FLIF image', 'image/flif', 'flif', 'image', [A(0, 'FLIF')]);
def('DjVu document', 'image/vnd.djvu', 'djvu', 'document', [A(0, 'AT&TFORM')], { exts: ['djvu', 'djv'] });
def('Netpbm image', 'image/x-portable-anymap', 'ppm', 'image', [A(0, 'P')], {
  exts: ['pbm', 'pgm', 'ppm', 'pnm', 'pam'],
  check: (h) => (h[1] ?? 0) >= 0x31 && (h[1] ?? 0) <= 0x37 && [0x20, 0x0a, 0x0d, 0x09].includes(h[2] ?? 0) && /^[0-9 \n\r\t#]*$/.test(ascii(h, 3, 8)),
  conf: 'medium',
});
def('Windows Metafile (WMF)', 'image/wmf', 'wmf', 'image', [H(0, 'D7 CD C6 9A')]);
def('Enhanced Metafile (EMF)', 'image/emf', 'emf', 'image', [H(0, '01 00 00 00'), A(40, ' EMF')]);
def('ICC color profile', 'application/vnd.iccprofile', 'icc', 'data', [A(36, 'acsp')], { exts: ['icc', 'icm'] });

/* ---- audio ---- */
def('MP3 audio (ID3 tag)', 'audio/mpeg', 'mp3', 'audio', [A(0, 'ID3')], { check: (h) => (h[3] ?? 0) < 0xff && (h[4] ?? 0) < 0xff });
def('MP3 audio (frame sync)', 'audio/mpeg', 'mp3', 'audio', [H(0, 'FF')], {
  check: (h) => mpegFrameLength(h, 0) > 0 && mpegFrameLength(h, mpegFrameLength(h, 0)) > 0,
  conf: 'medium',
  id: 'mp3-sync',
});
def('AAC audio (ADTS)', 'audio/aac', 'aac', 'audio', [H(0, 'FF')], {
  check: (h) => ((h[1] ?? 0) & 0xf6) === 0xf0 && (((h[2] ?? 0) >> 2) & 0x0f) < 13,
  conf: 'low',
});
def('FLAC audio', 'audio/flac', 'flac', 'audio', [A(0, 'fLaC')]);
def('Ogg container', 'application/ogg', 'ogg', 'audio', [A(0, 'OggS'), H(4, '00')], { exts: ['ogg', 'oga', 'ogv', 'opus', 'spx', 'ogx'] });
def('WAV audio', 'audio/wav', 'wav', 'audio', [A(0, 'RIFF'), H(4, '?? ?? ?? ??'), A(8, 'WAVE')], { exts: ['wav', 'wave'] });
def('AVI video', 'video/x-msvideo', 'avi', 'video', [A(0, 'RIFF'), H(4, '?? ?? ?? ??'), A(8, 'AVI ')]);
def('RIFF container', 'application/x-riff', 'riff', 'data', [A(0, 'RIFF')], { exts: ['riff', 'rmi', 'ani', 'cda'], conf: 'low' });
def('AIFF audio', 'audio/aiff', 'aiff', 'audio', [A(0, 'FORM'), H(4, '?? ?? ?? ??'), A(8, 'AIFF')], { exts: ['aif', 'aiff'] });
def('AIFF-C audio', 'audio/aiff', 'aifc', 'audio', [A(0, 'FORM'), H(4, '?? ?? ?? ??'), A(8, 'AIFC')], { exts: ['aifc', 'aif', 'aiff'] });
def('MIDI audio', 'audio/midi', 'mid', 'audio', [A(0, 'MThd'), H(4, '00 00 00 06')], { exts: ['mid', 'midi', 'kar'] });
def('AMR audio', 'audio/amr', 'amr', 'audio', [A(0, '#!AMR\n')]);
def('AMR-WB audio', 'audio/amr-wb', 'awb', 'audio', [A(0, '#!AMR-WB\n')]);
def('WavPack audio', 'audio/x-wavpack', 'wv', 'audio', [A(0, 'wvpk')]);
def("Monkey's Audio (APE)", 'audio/x-ape', 'ape', 'audio', [A(0, 'MAC ')]);
def('Musepack audio', 'audio/x-musepack', 'mpc', 'audio', [A(0, 'MPCK')], { exts: ['mpc', 'mp+'] });
def('DSD Stream File (DSF)', 'audio/x-dsf', 'dsf', 'audio', [A(0, 'DSD ')]);
def('Core Audio Format (CAF)', 'audio/x-caf', 'caf', 'audio', [A(0, 'caff'), H(4, '00 01')]);
def('Sun/NeXT audio (AU)', 'audio/basic', 'au', 'audio', [A(0, '.snd')], { exts: ['au', 'snd'] });
def('FastTracker module (XM)', 'audio/x-xm', 'xm', 'audio', [A(0, 'Extended Module: ')]);
def('Impulse Tracker module (IT)', 'audio/x-it', 'it', 'audio', [A(0, 'IMPM')]);
def('ScreamTracker module (S3M)', 'audio/x-s3m', 's3m', 'audio', [A(44, 'SCRM')]);
def('ProTracker module (MOD)', 'audio/x-mod', 'mod', 'audio', [A(1080, 'M.K.')], { exts: ['mod'] });
def('ProTracker module (MOD, 4 channels)', 'audio/x-mod', 'mod', 'audio', [A(1080, 'M!K!')], { exts: ['mod'] });
def('Windows Media (ASF/WMV/WMA)', 'video/x-ms-asf', 'wmv', 'video', [H(0, '30 26 B2 75 8E 66 CF 11 A6 D9 00 AA 00 62 CE 6C')], { exts: ['asf', 'wma', 'wmv'] });

/* ---- video ---- */
def('Matroska / WebM (EBML)', 'video/x-matroska', 'mkv', 'video', [H(0, '1A 45 DF A3')], { exts: ['mkv', 'mka', 'mks', 'mk3d', 'webm'] });
def('Flash Video (FLV)', 'video/x-flv', 'flv', 'video', [A(0, 'FLV'), H(3, '01')]);
def('MPEG program stream', 'video/mpeg', 'mpg', 'video', [H(0, '00 00 01 BA')], { exts: ['mpg', 'mpeg', 'vob', 'ps'] });
def('MPEG video elementary stream', 'video/mpeg', 'm2v', 'video', [H(0, '00 00 01 B3')], { exts: ['m2v', 'mpg', 'mpeg', 'mpv'] });
def('MPEG transport stream', 'video/mp2t', 'ts', 'video', [H(0, '47')], {
  check: (h, size) => h[188] === 0x47 && (size < 377 || h[376] === 0x47) && (size < 565 || h[564] === 0x47),
  exts: ['ts', 'm2ts', 'mts', 'tp'],
  conf: 'medium',
});
def('QuickTime movie (atom)', 'video/quicktime', 'mov', 'video', [H(0, '??')], {
  check: (h) => ['moov', 'mdat', 'wide', 'free', 'skip', 'pnot'].includes(ascii(h, 4, 4)) && u32be(h, 0) >= 8,
  exts: ['mov', 'qt'],
  conf: 'medium',
  id: 'quicktime-atom',
});
def('Shockwave Flash (SWF)', 'application/x-shockwave-flash', 'swf', 'video', [A(0, 'FWS')]);
def('Shockwave Flash (SWF, zlib)', 'application/x-shockwave-flash', 'swf', 'video', [A(0, 'CWS')]);
def('Shockwave Flash (SWF, LZMA)', 'application/x-shockwave-flash', 'swf', 'video', [A(0, 'ZWS')]);
def('RealMedia', 'application/vnd.rn-realmedia', 'rm', 'video', [A(0, '.RMF')], { exts: ['rm', 'rmvb', 'ra'] });

/* ---- documents ---- */
def('PDF document', 'application/pdf', 'pdf', 'document', [A(0, '%PDF-')]);
def('PostScript / EPS', 'application/postscript', 'ps', 'document', [A(0, '%!PS')], { exts: ['ps', 'eps', 'epsf', 'ai'] });
def('Rich Text Format (RTF)', 'application/rtf', 'rtf', 'document', [A(0, '{\\rtf')]);
def('Microsoft Compound File (OLE2)', 'application/x-ole-storage', 'doc', 'document', [H(0, 'D0 CF 11 E0 A1 B1 1A E1')], {
  exts: ['doc', 'xls', 'ppt', 'msi', 'msg', 'vsd', 'pub', 'xlt', 'dot', 'pot', 'db', 'suo'],
  id: 'ole2',
});
def('Compiled HTML Help (CHM)', 'application/vnd.ms-htmlhelp', 'chm', 'document', [A(0, 'ITSF')]);
def('MOBI / PalmDOC e-book', 'application/x-mobipocket-ebook', 'mobi', 'document', [A(60, 'BOOKMOBI')], { exts: ['mobi', 'prc', 'azw'] });
def('TeX DVI', 'application/x-dvi', 'dvi', 'document', [H(0, 'F7 02')], { conf: 'medium' });
def('WordPerfect document', 'application/vnd.wordperfect', 'wpd', 'document', [H(0, 'FF 57 50 43')]);
def('Microsoft Reader e-book (LIT)', 'application/x-ms-reader', 'lit', 'document', [A(0, 'ITOLITLS')]);

/* ---- archives & compression ---- */
def('ZIP archive', 'application/zip', 'zip', 'archive', [H(0, '50 4B 03 04')], { id: 'zip', exts: ['zip'] });
def('ZIP archive (empty)', 'application/zip', 'zip', 'archive', [H(0, '50 4B 05 06')], { id: 'zip-empty' });
def('ZIP archive (spanned)', 'application/zip', 'zip', 'archive', [H(0, '50 4B 07 08')], { id: 'zip-spanned' });
def('GZIP compressed data', 'application/gzip', 'gz', 'archive', [H(0, '1F 8B 08')], { exts: ['gz', 'tgz', 'gzip', 'svgz', 'z'], conf: 'high' });
def('BZIP2 compressed data', 'application/x-bzip2', 'bz2', 'archive', [A(0, 'BZh')], { exts: ['bz2', 'tbz2', 'tbz'], check: (h) => (h[3] ?? 0) >= 0x31 && (h[3] ?? 0) <= 0x39 });
def('XZ compressed data', 'application/x-xz', 'xz', 'archive', [H(0, 'FD 37 7A 58 5A 00')], { exts: ['xz', 'txz'] });
def('Zstandard compressed data', 'application/zstd', 'zst', 'archive', [H(0, '28 B5 2F FD')], { exts: ['zst', 'zstd'] });
def('7-Zip archive', 'application/x-7z-compressed', '7z', 'archive', [H(0, '37 7A BC AF 27 1C')]);
def('RAR archive (v4)', 'application/vnd.rar', 'rar', 'archive', [H(0, '52 61 72 21 1A 07 00')]);
def('RAR archive (v5)', 'application/vnd.rar', 'rar', 'archive', [H(0, '52 61 72 21 1A 07 01 00')]);
def('TAR archive', 'application/x-tar', 'tar', 'archive', [A(257, 'ustar')]);
def('LZ4 frame', 'application/x-lz4', 'lz4', 'archive', [H(0, '04 22 4D 18')]);
def('Lzip compressed data', 'application/x-lzip', 'lz', 'archive', [A(0, 'LZIP')]);
def('Unix compress (.Z)', 'application/x-compress', 'z', 'archive', [H(0, '1F 9D')], { conf: 'medium' });
def('LHA / LZH archive', 'application/x-lzh-compressed', 'lzh', 'archive', [A(2, '-l')], {
  exts: ['lzh', 'lha'],
  check: (h) => (h[4] === 0x68 || h[4] === 0x7a) && h[6] === 0x2d && /[0-9a-z]/.test(String.fromCharCode(h[5] ?? 0)),
  conf: 'medium',
});
def('ARJ archive', 'application/x-arj', 'arj', 'archive', [H(0, '60 EA')], { conf: 'medium' });
def('Microsoft Cabinet (CAB)', 'application/vnd.ms-cab-compressed', 'cab', 'archive', [A(0, 'MSCF'), H(4, '00 00 00 00')]);
def('Unix ar archive', 'application/x-archive', 'a', 'archive', [A(0, '!<arch>\n')], { exts: ['a', 'ar', 'lib', 'deb'], id: 'ar' });
def('RPM package', 'application/x-rpm', 'rpm', 'archive', [H(0, 'ED AB EE DB')]);
def('cpio archive (ASCII)', 'application/x-cpio', 'cpio', 'archive', [A(0, '07070')], { check: (h) => [0x31, 0x32, 0x37].includes(h[5] ?? 0), exts: ['cpio'] });
def('cpio archive (binary)', 'application/x-cpio', 'cpio', 'archive', [H(0, 'C7 71')], { conf: 'low', exts: ['cpio'] });
def('ISO 9660 disc image', 'application/x-iso9660-image', 'iso', 'disk', [A(0x8001, 'CD001')], { exts: ['iso', 'img'] });
def('SquashFS filesystem', 'application/vnd.squashfs', 'squashfs', 'disk', [A(0, 'hsqs')], { exts: ['squashfs', 'sqfs', 'snap'] });
def('Chrome extension (CRX)', 'application/x-chrome-extension', 'crx', 'archive', [A(0, 'Cr24')]);
def('XAR archive', 'application/x-xar', 'xar', 'archive', [A(0, 'xar!')], { exts: ['xar', 'pkg'] });
def('Snappy framed stream', 'application/x-snappy-framed', 'sz', 'archive', [H(0, 'FF 06 00 00 73 4E 61 50 70 59')], { exts: ['sz', 'snappy'] });
def('Windows Imaging Format (WIM)', 'application/x-ms-wim', 'wim', 'disk', [A(0, 'MSWIM'), H(5, '00 00 00')], { exts: ['wim', 'swm', 'esd'] });
def('ACE archive', 'application/x-ace-compressed', 'ace', 'archive', [A(7, '**ACE**')]);
def('StuffIt archive', 'application/x-stuffit', 'sit', 'archive', [A(0, 'SIT!')]);
def('zlib stream', 'application/zlib', 'zlib', 'archive', [H(0, '78')], {
  check: (h) => [0x01, 0x5e, 0x9c, 0xda, 0x20, 0x7d, 0xbb, 0xf9].includes(h[1] ?? 0) && ((h[0] ?? 0) * 256 + (h[1] ?? 0)) % 31 === 0,
  conf: 'low',
  exts: ['zlib', 'z', 'zz'],
});
def('Android sparse image', 'application/x-android-sparse', 'img', 'disk', [H(0, '3A FF 26 ED')]);
def('VHD virtual disk', 'application/x-vhd', 'vhd', 'disk', [A(0, 'conectix')]);
def('VMDK virtual disk', 'application/x-vmdk', 'vmdk', 'disk', [A(0, 'KDMV')]);
def('QCOW virtual disk', 'application/x-qemu-disk', 'qcow2', 'disk', [H(0, '51 46 49 FB')], { exts: ['qcow', 'qcow2'] });
def('VirtualBox disk image (VDI)', 'application/x-virtualbox-vdi', 'vdi', 'disk', [A(0, '<<< Oracle VM VirtualBox Disk Image >>>')]);
def('U-Boot legacy image', 'application/x-uboot-image', 'uimg', 'disk', [H(0, '27 05 19 56')], { exts: ['uimg', 'img', 'bin'] });
def('Boot sector / MBR (0x55AA)', 'application/x-raw-disk-image', 'img', 'disk', [H(510, '55 AA')], { exts: ['img', 'bin', 'mbr', 'dd', 'raw', 'iso', 'vhd'], conf: 'low', id: 'mbr' });

/* ---- executables / code ---- */
def('ELF executable', 'application/x-elf', 'elf', 'executable', [H(0, '7F 45 4C 46')], { exts: ['elf', 'so', 'o', 'bin', 'out', 'axf', 'ko', 'prx', 'puff'], id: 'elf' });
def('Windows PE executable (MZ)', 'application/vnd.microsoft.portable-executable', 'exe', 'executable', [A(0, 'MZ')], {
  exts: ['exe', 'dll', 'sys', 'scr', 'ocx', 'cpl', 'efi', 'drv', 'mui', 'tlb', 'com'],
  check: (h) => {
    const pe = u32le(h, 0x3c);
    return pe > 0 && pe + 4 <= h.length && h[pe] === 0x50 && h[pe + 1] === 0x45 && h[pe + 2] === 0 && h[pe + 3] === 0;
  },
  id: 'pe',
});
def('DOS MZ executable', 'application/x-dosexec', 'exe', 'executable', [A(0, 'MZ')], { exts: ['exe', 'com', 'dll', 'sys', 'ovl'], conf: 'low', id: 'dos-mz' });
def('Mach-O binary (32-bit, big-endian)', 'application/x-mach-binary', 'macho', 'executable', [H(0, 'FE ED FA CE')], { exts: ['dylib', 'bundle', 'o', 'macho', 'bin'], id: 'macho-32-be' });
def('Mach-O binary (32-bit, little-endian)', 'application/x-mach-binary', 'macho', 'executable', [H(0, 'CE FA ED FE')], { exts: ['dylib', 'bundle', 'o', 'macho', 'bin'], id: 'macho-32-le' });
def('Mach-O binary (64-bit, big-endian)', 'application/x-mach-binary', 'macho', 'executable', [H(0, 'FE ED FA CF')], { exts: ['dylib', 'bundle', 'o', 'macho', 'bin'], id: 'macho-64-be' });
def('Mach-O binary (64-bit, little-endian)', 'application/x-mach-binary', 'macho', 'executable', [H(0, 'CF FA ED FE')], { exts: ['dylib', 'bundle', 'o', 'macho', 'bin'], id: 'macho-64-le' });
def('Mach-O universal (fat) binary', 'application/x-mach-binary', 'macho', 'executable', [H(0, 'CA FE BA BE')], {
  check: (h) => u32be(h, 4) >= 1 && u32be(h, 4) <= 30,
  exts: ['dylib', 'bundle', 'macho', 'bin', 'a'],
  id: 'macho-fat',
});
def('Mach-O universal (fat, 64-bit offsets)', 'application/x-mach-binary', 'macho', 'executable', [H(0, 'CA FE BA BF')], { exts: ['dylib', 'macho', 'bin'], id: 'macho-fat64' });
def('Java class file', 'application/java-vm', 'class', 'executable', [H(0, 'CA FE BA BE')], { check: (h) => u16be(h, 6) >= 45 && u16be(h, 6) <= 80, id: 'java-class' });
def('WebAssembly module', 'application/wasm', 'wasm', 'executable', [H(0, '00 61 73 6D')]);
def('Android Dalvik executable (DEX)', 'application/vnd.android.dex', 'dex', 'executable', [A(0, 'dex\n'), H(7, '00')]);
def('Android optimized DEX (ODEX)', 'application/vnd.android.dex', 'odex', 'executable', [A(0, 'dey\n')]);
def('Lua bytecode', 'application/x-lua-bytecode', 'luac', 'executable', [H(0, '1B 4C 75 61')], { exts: ['luac', 'lub'] });
def('Python bytecode (.pyc)', 'application/x-python-code', 'pyc', 'executable', [H(2, '0D 0A')], { check: (h) => isPycMagic(h), conf: 'medium', id: 'pyc', bias: -2 });
def('Windows shortcut (LNK)', 'application/x-ms-shortcut', 'lnk', 'executable', [H(0, '4C 00 00 00 01 14 02 00 00 00 00 00 C0 00 00 00 00 00 00 46')]);
def('Android binary XML', 'application/vnd.android.axml', 'xml', 'executable', [H(0, '03 00 08 00')], { exts: ['xml', 'axml'], conf: 'medium', id: 'axml' });
def('LLVM bitcode', 'application/x-llvm-bitcode', 'bc', 'executable', [H(0, 'BC C0 DE')]);
def('Java serialized object', 'application/x-java-serialized-object', 'ser', 'data', [H(0, 'AC ED 00 05')]);
def('Java KeyStore (JKS)', 'application/x-java-keystore', 'jks', 'data', [H(0, 'FE ED FE ED')], { exts: ['jks', 'keystore'] });
def('Java JCEKS keystore', 'application/x-java-jce-keystore', 'jceks', 'data', [H(0, 'CE CE CE CE')], { exts: ['jceks'] });
def('Windows minidump', 'application/x-dmp', 'dmp', 'data', [A(0, 'MDMP'), H(4, '93 A7')], { exts: ['dmp', 'mdmp'] });
def('Windows registry hive', 'application/x-ms-registry', 'dat', 'data', [A(0, 'regf')], { exts: ['dat', 'hiv', 'sav'] });
def('Windows event log (EVTX)', 'application/x-ms-evtx', 'evtx', 'data', [A(0, 'ElfFile\u0000')]);
def('Windows prefetch', 'application/x-ms-prefetch', 'pf', 'data', [A(4, 'SCCA')]);
def('Nintendo NES ROM (iNES)', 'application/x-nes-rom', 'nes', 'executable', [H(0, '4E 45 53 1A')]);
def('Linux kernel boot image (zImage / bzImage)', 'application/x-linux-kernel', 'img', 'executable', [A(0x202, 'HdrS')], { exts: ['img', 'bin', 'vmlinuz', 'zimage'], id: 'bzimage' });

/* ---- databases / scientific / data ---- */
def('SQLite 3 database', 'application/vnd.sqlite3', 'sqlite', 'database', [A(0, 'SQLite format 3\u0000')], { exts: ['sqlite', 'sqlite3', 'db', 'db3', 's3db', 'sl3'] });
def('SQLite write-ahead log', 'application/x-sqlite3-wal', 'wal', 'database', [H(0, '37 7F 06 82')], { exts: ['wal', 'db-wal'], id: 'sqlite-wal' });
def('SQLite write-ahead log (v2)', 'application/x-sqlite3-wal', 'wal', 'database', [H(0, '37 7F 06 83')], { exts: ['wal', 'db-wal'], id: 'sqlite-wal2' });
def('Microsoft Access database (MDB)', 'application/x-msaccess', 'mdb', 'database', [H(0, '00 01 00 00'), A(4, 'Standard Jet DB')]);
def('Microsoft Access database (ACCDB)', 'application/x-msaccess', 'accdb', 'database', [H(0, '00 01 00 00'), A(4, 'Standard ACE DB')]);
def('HDF5 file', 'application/x-hdf5', 'h5', 'data', [H(0, '89 48 44 46 0D 0A 1A 0A')], { exts: ['h5', 'hdf5', 'hdf', 'he5', 'nc'] });
def('NetCDF classic', 'application/x-netcdf', 'nc', 'data', [A(0, 'CDF'), H(3, '01')]);
def('NetCDF 64-bit offset', 'application/x-netcdf', 'nc', 'data', [A(0, 'CDF'), H(3, '02')]);
def('Apache Parquet', 'application/vnd.apache.parquet', 'parquet', 'data', [A(0, 'PAR1')]);
def('Apache Avro container', 'application/avro', 'avro', 'data', [A(0, 'Obj'), H(3, '01')]);
def('Apache Arrow file', 'application/vnd.apache.arrow.file', 'arrow', 'data', [A(0, 'ARROW1')], { exts: ['arrow', 'feather'] });
def('NumPy array (.npy)', 'application/x-npy', 'npy', 'data', [H(0, '93'), A(1, 'NUMPY')]);
def('KeePass 2 database (KDBX)', 'application/x-keepass2', 'kdbx', 'data', [H(0, '03 D9 A2 9A 67 FB 4B B5')]);
def('KeePass 1 database (KDB)', 'application/x-keepass', 'kdb', 'data', [H(0, '03 D9 A2 9A 65 FB 4B B5')]);
def('pcap capture (little-endian)', 'application/vnd.tcpdump.pcap', 'pcap', 'data', [H(0, 'D4 C3 B2 A1')], { exts: ['pcap', 'cap', 'dmp'], id: 'pcap-le' });
def('pcap capture (big-endian)', 'application/vnd.tcpdump.pcap', 'pcap', 'data', [H(0, 'A1 B2 C3 D4')], { exts: ['pcap', 'cap', 'dmp'], id: 'pcap-be' });
def('pcap capture (nanosecond, little-endian)', 'application/vnd.tcpdump.pcap', 'pcap', 'data', [H(0, '4D 3C B2 A1')], { exts: ['pcap', 'cap'], id: 'pcap-ns-le' });
def('pcap capture (nanosecond, big-endian)', 'application/vnd.tcpdump.pcap', 'pcap', 'data', [H(0, 'A1 B2 3C 4D')], { exts: ['pcap', 'cap'], id: 'pcap-ns-be' });
def('pcapng capture', 'application/x-pcapng', 'pcapng', 'data', [H(0, '0A 0D 0D 0A')], { exts: ['pcapng', 'ntar'] });
def('Apple binary property list', 'application/x-bplist', 'plist', 'data', [A(0, 'bplist0')], { exts: ['plist', 'bplist'] });
def('Apple .DS_Store', 'application/x-ds-store', 'ds_store', 'data', [H(0, '00 00 00 01 42 75 64 31')], { exts: ['ds_store'] });
def('FITS image', 'application/fits', 'fits', 'data', [A(0, 'SIMPLE  =')], { exts: ['fits', 'fit', 'fts'] });
def('DICOM medical image', 'application/dicom', 'dcm', 'image', [A(128, 'DICM')], { exts: ['dcm', 'dicom'] });
def('GRIB weather data', 'application/x-grib', 'grib', 'data', [A(0, 'GRIB')], { exts: ['grib', 'grb', 'grib2', 'grb2'] });
def('MATLAB MAT-file', 'application/x-matlab-data', 'mat', 'data', [A(0, 'MATLAB 5.0 MAT-file')]);
def('Git packfile', 'application/x-git-pack', 'pack', 'data', [A(0, 'PACK'), H(4, '00 00 00')], { exts: ['pack'] });
def('Git index', 'application/x-git-index', 'index', 'data', [A(0, 'DIRC'), H(4, '00 00 00')], { exts: ['index'] });
def('OpenSSH private key', 'application/x-openssh-key', 'key', 'data', [A(0, 'openssh-key-v1\u0000')]);
def('SQLite rollback journal', 'application/x-sqlite3-journal', 'db-journal', 'database', [H(0, 'D9 D5 05 F9 20 A1 63 D7')], { exts: ['db-journal', 'journal'] });

/* ---- fonts ---- */
def('TrueType font', 'font/ttf', 'ttf', 'font', [H(0, '00 01 00 00')], { check: (h) => isSfntHeader(h), conf: 'medium', id: 'ttf' });
def('TrueType font (true)', 'font/ttf', 'ttf', 'font', [A(0, 'true')], { id: 'ttf-true' });
def('OpenType font (CFF)', 'font/otf', 'otf', 'font', [A(0, 'OTTO')]);
def('TrueType collection', 'font/collection', 'ttc', 'font', [A(0, 'ttcf')], { exts: ['ttc', 'otc'] });
def('WOFF font', 'font/woff', 'woff', 'font', [A(0, 'wOFF')]);
def('WOFF2 font', 'font/woff2', 'woff2', 'font', [A(0, 'wOF2')]);
def('Embedded OpenType font (EOT)', 'application/vnd.ms-fontobject', 'eot', 'font', [A(34, 'LP')], { conf: 'low' });
def('PostScript Type 1 font (PFB)', 'application/x-font-type1', 'pfb', 'font', [H(0, '80 01')], { check: (h) => ascii(h, 6, 6) === '%!PS-A', conf: 'medium', exts: ['pfb'] });

/* ------------------------------------------------------------------ */
/* Detection helpers                                                   */
/* ------------------------------------------------------------------ */

const MPEG_BITRATES: Record<string, number[]> = {
  'v1l1': [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  'v1l2': [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  'v1l3': [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  'v2l1': [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  'v2l23': [0, 8, 16, 24, 32, 40, 48, 64, 80, 96, 112, 128, 144, 160],
};
const MPEG_RATES: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

/** Length in bytes of an MPEG audio frame starting at `o`, or 0 if the header is not valid. */
export function mpegFrameLength(h: Uint8Array, o: number): number {
  const b0 = h[o];
  const b1 = h[o + 1];
  const b2 = h[o + 2];
  if (b0 !== 0xff || b1 === undefined || b2 === undefined || (b1 & 0xe0) !== 0xe0) return 0;
  const ver = (b1 >> 3) & 3; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5, 1 reserved
  const layer = (b1 >> 1) & 3; // 1 = III, 2 = II, 3 = I
  if (ver === 1 || layer === 0) return 0;
  const bi = b2 >> 4;
  const si = (b2 >> 2) & 3;
  if (bi === 0 || bi === 15 || si === 3) return 0;
  const key = ver === 3 ? (layer === 3 ? 'v1l1' : layer === 2 ? 'v1l2' : 'v1l3') : layer === 3 ? 'v2l1' : 'v2l23';
  const br = (MPEG_BITRATES[key] ?? [])[bi];
  const sr = (MPEG_RATES[ver] ?? [])[si];
  if (!br || !sr) return 0;
  const pad = (b2 >> 1) & 1;
  if (layer === 3) return Math.floor((12 * br * 1000) / sr + pad) * 4;
  if (layer === 1 && ver !== 3) return Math.floor((72 * br * 1000) / sr + pad);
  return Math.floor((144 * br * 1000) / sr + pad);
}

function isPycMagic(h: Uint8Array): boolean {
  if (h[2] !== 0x0d || h[3] !== 0x0a) return false;
  const m = u16le(h, 0);
  // CPython magic numbers: 1.5 (20121), 1.6/2.0/2.1/2.2, 2.3-2.7 (62011-62211), 3.x (3000-3700)
  return m === 20121 || m === 50428 || m === 50823 || m === 60202 || m === 60717 || (m >= 62011 && m <= 62211) || (m >= 3000 && m <= 3700);
}

/** sfnt (TrueType / OpenType) table directory header sanity check. */
function isSfntHeader(h: Uint8Array): boolean {
  const n = u16be(h, 4);
  if (n < 4 || n > 64) return false;
  let p2 = 1;
  let log = 0;
  while (p2 * 2 <= n) {
    p2 *= 2;
    log++;
  }
  return u16be(h, 6) === p2 * 16 && u16be(h, 8) === log && u16be(h, 10) === n * 16 - p2 * 16;
}

function matchSig(s: Sig, h: Uint8Array, size: number): boolean {
  for (const m of s.magic) {
    if (m.at + m.bytes.length > h.length) return false;
    for (let i = 0; i < m.bytes.length; i++) {
      const want = m.bytes[i] ?? -1;
      if (want !== -1 && h[m.at + i] !== want) return false;
    }
  }
  return s.check ? s.check(h, size) : true;
}

function confOf(s: Sig): Confidence {
  if (s.conf) return s.conf;
  return s.score >= 4 ? 'high' : s.score >= 2 ? 'medium' : 'low';
}

const BYID = new Map<string, Sig>(SIGS.map((s) => [s.id, s]));

function mk(t: FileType, conf: Confidence, details: string[] = [], alternatives: string[] = []): Detection {
  return { ...t, confidence: conf, details, alternatives };
}

function ft(id: string, name: string, mime: string, ext: string, category: Category, exts?: string[]): FileType {
  return { id, name, mime, ext, exts: exts ?? [ext], category };
}

/* ---- ISO base media (ftyp) ---- */
const FTYP: Record<string, FileType> = {
  isom: ft('mp4', 'MP4 video (ISO base media)', 'video/mp4', 'mp4', 'video', ['mp4', 'm4v', 'mov', 'm4a', 'f4v']),
  iso2: ft('mp4', 'MP4 video (ISO base media)', 'video/mp4', 'mp4', 'video', ['mp4', 'm4v', 'mov', 'm4a', 'f4v']),
  iso4: ft('mp4', 'MP4 video (ISO base media)', 'video/mp4', 'mp4', 'video', ['mp4', 'm4v', 'mov', 'm4a', 'f4v']),
  iso5: ft('mp4', 'MP4 video (ISO base media)', 'video/mp4', 'mp4', 'video', ['mp4', 'm4v', 'mov', 'm4a', 'f4v']),
  iso6: ft('mp4', 'MP4 video (ISO base media)', 'video/mp4', 'mp4', 'video', ['mp4', 'm4v', 'mov', 'm4a', 'f4v']),
  mp41: ft('mp4', 'MP4 video', 'video/mp4', 'mp4', 'video', ['mp4', 'm4v', 'mov', 'f4v']),
  mp42: ft('mp4', 'MP4 video', 'video/mp4', 'mp4', 'video', ['mp4', 'm4v', 'mov', 'f4v']),
  avc1: ft('mp4', 'MP4 video (H.264)', 'video/mp4', 'mp4', 'video', ['mp4', 'm4v', 'mov']),
  dash: ft('mp4', 'MP4 video (MPEG-DASH segment)', 'video/mp4', 'mp4', 'video', ['mp4', 'm4s', 'm4v']),
  'M4V ': ft('m4v', 'M4V video', 'video/x-m4v', 'm4v', 'video', ['m4v', 'mp4']),
  'M4A ': ft('m4a', 'M4A audio', 'audio/mp4', 'm4a', 'audio', ['m4a', 'mp4', 'aac']),
  'M4B ': ft('m4b', 'M4B audiobook', 'audio/mp4', 'm4b', 'audio', ['m4b', 'm4a']),
  'M4P ': ft('m4p', 'M4P protected audio', 'audio/mp4', 'm4p', 'audio', ['m4p']),
  'qt  ': ft('mov', 'QuickTime movie', 'video/quicktime', 'mov', 'video', ['mov', 'qt']),
  '3gp4': ft('3gp', '3GPP video', 'video/3gpp', '3gp', 'video', ['3gp']),
  '3gp5': ft('3gp', '3GPP video', 'video/3gpp', '3gp', 'video', ['3gp']),
  '3gp6': ft('3gp', '3GPP video', 'video/3gpp', '3gp', 'video', ['3gp']),
  '3gp7': ft('3gp', '3GPP video', 'video/3gpp', '3gp', 'video', ['3gp']),
  '3g2a': ft('3g2', '3GPP2 video', 'video/3gpp2', '3g2', 'video', ['3g2']),
  '3g2b': ft('3g2', '3GPP2 video', 'video/3gpp2', '3g2', 'video', ['3g2']),
  '3g2c': ft('3g2', '3GPP2 video', 'video/3gpp2', '3g2', 'video', ['3g2']),
  heic: ft('heic', 'HEIC image', 'image/heic', 'heic', 'image', ['heic', 'heif']),
  heix: ft('heic', 'HEIC image', 'image/heic', 'heic', 'image', ['heic', 'heif']),
  hevc: ft('heic', 'HEIC image sequence', 'image/heic-sequence', 'heic', 'image', ['heic', 'heics']),
  hevx: ft('heic', 'HEIC image sequence', 'image/heic-sequence', 'heic', 'image', ['heic', 'heics']),
  mif1: ft('heif', 'HEIF image', 'image/heif', 'heif', 'image', ['heif', 'heic', 'avif']),
  msf1: ft('heif', 'HEIF image sequence', 'image/heif-sequence', 'heifs', 'image', ['heifs', 'heif']),
  avif: ft('avif', 'AVIF image', 'image/avif', 'avif', 'image'),
  avis: ft('avif', 'AVIF image sequence', 'image/avif-sequence', 'avifs', 'image', ['avifs', 'avif']),
  'crx ': ft('cr3', 'Canon CR3 raw image', 'image/x-canon-cr3', 'cr3', 'image'),
  'F4V ': ft('f4v', 'Adobe F4V video', 'video/mp4', 'f4v', 'video'),
  'jp2 ': ft('jp2-ftyp', 'JPEG 2000 image', 'image/jp2', 'jp2', 'image', ['jp2']),
};

function detectFtyp(h: Uint8Array): Detection | null {
  if (h.length < 12 || ascii(h, 4, 4) !== 'ftyp') return null;
  const size = u32be(h, 0);
  const brand = ascii(h, 8, 4);
  const compat: string[] = [];
  const end = Math.min(h.length, size >= 16 ? size : 32);
  for (let o = 16; o + 4 <= end; o += 4) compat.push(ascii(h, o, 4));
  let t = FTYP[brand];
  if ((brand === 'mif1' || brand === 'msf1') && compat.length) {
    if (compat.includes('avif')) t = FTYP.avif;
    else if (compat.includes('heic') || compat.includes('heix')) t = FTYP.heic;
  }
  const details = [`Major brand: "${brand.trim()}"`];
  if (compat.length) details.push(`Compatible brands: ${[...new Set(compat)].map((b) => b.trim()).join(', ')}`);
  if (t) return mk(t, 'high', details);
  return mk(ft('mp4', 'ISO base media file (MP4 family)', 'video/mp4', 'mp4', 'video', ['mp4', 'm4v', 'm4a', 'mov', '3gp', 'heic', 'avif']), 'medium', details);
}

/* ---- format-specific details ---- */
const PE_MACHINES: Record<number, string> = { 0x14c: 'x86 (i386)', 0x8664: 'x86-64 (AMD64)', 0xaa64: 'ARM64', 0x1c0: 'ARM', 0x1c4: 'ARM Thumb-2', 0x200: 'Itanium', 0x5064: 'RISC-V 64', 0x6232: 'LoongArch 32', 0x6264: 'LoongArch 64' };
const ELF_MACHINES: Record<number, string> = {
  2: 'SPARC', 3: 'x86', 8: 'MIPS', 20: 'PowerPC', 21: 'PowerPC64', 22: 'IBM S/390', 40: 'ARM', 42: 'SuperH', 43: 'SPARC v9', 50: 'IA-64', 62: 'x86-64', 183: 'AArch64', 243: 'RISC-V', 258: 'LoongArch', 247: 'eBPF',
};
const ELF_TYPES: Record<number, string> = { 1: 'relocatable object', 2: 'executable', 3: 'shared object / PIE executable', 4: 'core dump' };
const MACHO_CPU: Record<number, string> = { 7: 'x86', 0x01000007: 'x86-64', 12: 'ARM', 0x0100000c: 'ARM64', 18: 'PowerPC', 0x01000012: 'PowerPC64', 0x0200000c: 'ARM64_32' };
const MACHO_FILETYPE: Record<number, string> = { 1: 'object', 2: 'executable', 3: 'fixed VM library', 4: 'core', 5: 'preloaded executable', 6: 'dynamic library', 7: 'dynamic linker', 8: 'bundle', 9: 'dylib stub', 10: 'debug symbols (dSYM)', 11: 'kext bundle' };

function elfDetails(h: Uint8Array): string[] {
  if (h.length < 20) return [];
  const le = h[5] === 1;
  const u16 = (o: number) => (le ? u16le(h, o) : u16be(h, o));
  const out = [`${h[4] === 2 ? '64-bit' : '32-bit'}, ${le ? 'little' : 'big'}-endian`];
  out.push(`Type: ${ELF_TYPES[u16(16)] ?? `0x${u16(16).toString(16)}`}`);
  out.push(`Machine: ${ELF_MACHINES[u16(18)] ?? `0x${u16(18).toString(16)}`}`);
  const abi = h[7] ?? 0;
  if (abi) out.push(`OS ABI: ${abi === 3 ? 'Linux' : abi === 9 ? 'FreeBSD' : abi === 6 ? 'Solaris' : String(abi)}`);
  return out;
}

function peDetails(h: Uint8Array): { details: string[]; dll: boolean; driver: boolean } {
  const pe = u32le(h, 0x3c);
  const details: string[] = [];
  let dll = false;
  let driver = false;
  if (pe + 24 > h.length) return { details, dll, driver };
  const machine = u16le(h, pe + 4);
  const chars = u16le(h, pe + 22);
  const sections = u16le(h, pe + 6);
  details.push(`Machine: ${PE_MACHINES[machine] ?? `0x${machine.toString(16)}`}`);
  dll = (chars & 0x2000) !== 0;
  const opt = pe + 24;
  const magic = u16le(h, opt);
  const plus = magic === 0x20b;
  details.push(plus ? 'PE32+ (64-bit)' : magic === 0x10b ? 'PE32 (32-bit)' : 'Unknown optional header');
  details.push(`Sections: ${sections}`);
  const subsystem = u16le(h, opt + 68);
  const SUBS: Record<number, string> = { 1: 'Native (driver)', 2: 'Windows GUI', 3: 'Windows console', 9: 'Windows CE GUI', 10: 'EFI application', 11: 'EFI boot driver', 12: 'EFI runtime driver' };
  if (SUBS[subsystem]) details.push(`Subsystem: ${SUBS[subsystem]}`);
  driver = subsystem === 1;
  const dirBase = opt + (plus ? 112 : 96);
  if (dirBase + 15 * 8 <= h.length && u32le(h, dirBase + 14 * 8) !== 0) details.push('.NET (CLR) assembly');
  const ts = u32le(h, pe + 8);
  if (ts > 0 && ts < 0xffffffff) details.push(`Linker timestamp: ${new Date(ts * 1000).toISOString().slice(0, 19).replace('T', ' ')} UTC`);
  return { details, dll, driver };
}

function machoDetails(h: Uint8Array, le: boolean, is64: boolean): string[] {
  const u32 = (o: number) => (le ? u32le(h, o) : u32be(h, o));
  const cpu = u32(4);
  return [`${is64 ? '64-bit' : '32-bit'}, ${le ? 'little' : 'big'}-endian`, `CPU: ${MACHO_CPU[cpu] ?? `0x${cpu.toString(16)}`}`, `File type: ${MACHO_FILETYPE[u32(12)] ?? u32(12)}`];
}

function pngDetails(h: Uint8Array): string[] {
  if (h.length < 29) return [];
  const CT: Record<number, string> = { 0: 'grayscale', 2: 'RGB', 3: 'indexed', 4: 'grayscale + alpha', 6: 'RGBA' };
  const out = [`${u32be(h, 16)} × ${u32be(h, 20)} px, ${h[24]}-bit ${CT[h[25] ?? 0] ?? 'unknown color type'}`];
  const acTL = ascii(h, 0, Math.min(h.length, 4096)).indexOf('acTL');
  if (acTL !== -1) out.push('Animated PNG (APNG)');
  return out;
}

function jpegDetails(h: Uint8Array): string[] {
  const out: string[] = [];
  let p = 2;
  while (p + 4 < h.length) {
    if (h[p] !== 0xff) {
      p++;
      continue;
    }
    const m = h[p + 1] ?? 0;
    if (m === 0xff) {
      p++;
      continue;
    }
    if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) {
      p += 2;
      continue;
    }
    const len = u16be(h, p + 2);
    if (m === 0xe0 && ascii(h, p + 4, 4) === 'JFIF') out.push('JFIF');
    if (m === 0xe1 && ascii(h, p + 4, 4) === 'Exif') out.push('Exif metadata');
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      out.unshift(`${u16be(h, p + 7)} × ${u16be(h, p + 5)} px, ${h[p + 4]}-bit, ${m === 0xc2 ? 'progressive' : 'baseline'}`);
      break;
    }
    if (m === 0xda) break;
    p += 2 + len;
  }
  return out;
}

function gifDetails(h: Uint8Array): string[] {
  return h.length >= 10 ? [`${ascii(h, 0, 6)}, ${u16le(h, 6)} × ${u16le(h, 8)} px`] : [];
}

function bmpDetails(h: Uint8Array): string[] {
  if (h.length < 30) return [];
  const w = u32le(h, 18) | 0;
  const hh = u32le(h, 22) | 0;
  return [`${w} × ${Math.abs(hh)} px, ${u16le(h, 28)}-bit`];
}

function webpDetails(h: Uint8Array): string[] {
  const k = ascii(h, 12, 4);
  if (k === 'VP8X' && h.length >= 30) {
    const w = 1 + (h[24] ?? 0) + ((h[25] ?? 0) << 8) + ((h[26] ?? 0) << 16);
    const hh = 1 + (h[27] ?? 0) + ((h[28] ?? 0) << 8) + ((h[29] ?? 0) << 16);
    return [`${w} × ${hh} px, extended${(h[20] ?? 0) & 2 ? ', animated' : ''}`];
  }
  return [k === 'VP8L' ? 'Lossless' : k === 'VP8 ' ? 'Lossy' : `Chunk ${k}`];
}

function wavDetails(h: Uint8Array): string[] {
  if (ascii(h, 12, 4) !== 'fmt ' || h.length < 36) return [];
  const tag = u16le(h, 20);
  const FMT: Record<number, string> = { 1: 'PCM', 3: 'IEEE float', 6: 'A-law', 7: 'μ-law', 0x11: 'IMA ADPCM', 0x55: 'MP3', 0xfffe: 'extensible' };
  return [`${FMT[tag] ?? `format 0x${tag.toString(16)}`}, ${u16le(h, 22)} ch, ${u32le(h, 24)} Hz, ${u16le(h, 34)}-bit`];
}

function sqliteDetails(h: Uint8Array): string[] {
  if (h.length < 100) return [];
  const ps = u16be(h, 16);
  const enc = u32be(h, 56);
  return [`Page size: ${ps === 1 ? 65536 : ps}`, `Text encoding: ${enc === 1 ? 'UTF-8' : enc === 2 ? 'UTF-16le' : enc === 3 ? 'UTF-16be' : String(enc)}`, `SQLite version: ${u32be(h, 96)}`];
}

function pdfDetails(h: Uint8Array): string[] {
  const m = /%PDF-(\d\.\d)/.exec(ascii(h, 0, Math.min(h.length, 1024)));
  return m ? [`PDF ${m[1]}`] : [];
}

function oleDetails(h: Uint8Array): { ext?: string; name?: string; mime?: string; details: string[] } {
  const hay = h;
  const has = (s: string) => {
    const pat = new Uint8Array(s.length * 2);
    for (let i = 0; i < s.length; i++) pat[i * 2] = s.charCodeAt(i);
    return indexOfPattern(hay, pat, 0, false) !== -1;
  };
  if (has('EncryptedPackage')) return { name: 'Password-protected Office file (encrypted OOXML)', ext: 'docx', mime: 'application/x-ole-storage', details: ['Contains an EncryptedPackage stream'] };
  if (has('WordDocument')) return { name: 'Microsoft Word 97-2003 document (DOC)', ext: 'doc', mime: 'application/msword', details: [] };
  if (has('Workbook') || has('Book')) return { name: 'Microsoft Excel 97-2003 workbook (XLS)', ext: 'xls', mime: 'application/vnd.ms-excel', details: [] };
  if (has('PowerPoint Document')) return { name: 'Microsoft PowerPoint 97-2003 presentation (PPT)', ext: 'ppt', mime: 'application/vnd.ms-powerpoint', details: [] };
  if (has('__properties_version1.0')) return { name: 'Outlook message (MSG)', ext: 'msg', mime: 'application/vnd.ms-outlook', details: [] };
  if (has('Visio Document')) return { name: 'Microsoft Visio drawing (VSD)', ext: 'vsd', mime: 'application/vnd.visio', details: [] };
  return { details: ['Could not tell DOC / XLS / PPT / MSI apart from the header alone'] };
}

/* ---- Ogg / Matroska ---- */
function oggRefine(h: Uint8Array): FileType | null {
  const s = ascii(h, 0, Math.min(h.length, 2048));
  if (s.includes('\u0001vorbis')) return ft('ogg-vorbis', 'Ogg Vorbis audio', 'audio/ogg', 'ogg', 'audio', ['ogg', 'oga']);
  if (s.includes('OpusHead')) return ft('opus', 'Ogg Opus audio', 'audio/ogg; codecs=opus', 'opus', 'audio', ['opus', 'ogg', 'oga']);
  if (s.includes('\u007fFLAC')) return ft('ogg-flac', 'Ogg FLAC audio', 'audio/ogg', 'oga', 'audio', ['oga', 'ogg']);
  if (s.includes('Speex   ')) return ft('speex', 'Ogg Speex audio', 'audio/ogg', 'spx', 'audio', ['spx', 'ogg']);
  if (s.includes('\u0080theora')) return ft('ogg-theora', 'Ogg Theora video', 'video/ogg', 'ogv', 'video', ['ogv', 'ogg']);
  return null;
}

function ebmlRefine(h: Uint8Array): FileType | null {
  const s = ascii(h, 0, Math.min(h.length, 64));
  if (s.includes('webm')) return ft('webm', 'WebM video', 'video/webm', 'webm', 'video');
  if (s.includes('matroska')) return ft('mkv', 'Matroska video (MKV)', 'video/x-matroska', 'mkv', 'video', ['mkv', 'mka', 'mks', 'mk3d']);
  return null;
}

/* ---- plain-text style detection ---- */
export interface TextProbe {
  isText: boolean;
  encoding: string;
  controlRatio: number;
}

export function probeText(h: Uint8Array): TextProbe {
  const n = Math.min(h.length, 8192);
  if (n === 0) return { isText: false, encoding: '', controlRatio: 0 };
  if (n >= 2 && h[0] === 0xff && h[1] === 0xfe) return { isText: true, encoding: h[2] === 0 && h[3] === 0 ? 'UTF-32 LE' : 'UTF-16 LE', controlRatio: 0 };
  if (n >= 2 && h[0] === 0xfe && h[1] === 0xff) return { isText: true, encoding: 'UTF-16 BE', controlRatio: 0 };
  if (n >= 4 && h[0] === 0 && h[1] === 0 && h[2] === 0xfe && h[3] === 0xff) return { isText: true, encoding: 'UTF-32 BE', controlRatio: 0 };
  let control = 0;
  let high = 0;
  for (let i = 0; i < n; i++) {
    const b = h[i] ?? 0;
    if (b === 0) return { isText: false, encoding: '', controlRatio: 1 };
    if (b < 9 || (b > 13 && b < 32 && b !== 27)) control++;
    if (b > 127) high++;
  }
  const ratio = control / n;
  if (ratio > 0.02) return { isText: false, encoding: '', controlRatio: ratio };
  let end = n;
  if (h.length > n) while (end > 0 && ((h[end - 1] ?? 0) & 0xc0) === 0x80) end--;
  let utf8ok = true;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(h.subarray(0, end));
  } catch {
    utf8ok = false;
  }
  if (!utf8ok && high / n > 0.3) return { isText: false, encoding: '', controlRatio: ratio };
  return { isText: true, encoding: high === 0 ? 'ASCII' : utf8ok ? 'UTF-8' : 'Latin-1 / unknown 8-bit', controlRatio: ratio };
}

const TEXT_TYPE = ft('text', 'Plain text', 'text/plain', 'txt', 'text', ['txt', 'text', 'log', 'md', 'csv', 'tsv', 'ini', 'cfg', 'conf', 'yml', 'yaml', 'toml', 'sql', 'js', 'ts', 'py', 'c', 'h', 'java', 'css', 'sh', 'bat', 'ps1', 'rb', 'go', 'rs', 'php', 'srt', 'diff', 'patch', 'lst', 'env', 'properties', 'tex', 'rst']);

function detectTextual(h: Uint8Array): Detection | null {
  const probe = probeText(h);
  if (!probe.isText) return null;
  const details = [`Encoding: ${probe.encoding}`];
  if (probe.encoding.startsWith('UTF-16') || probe.encoding.startsWith('UTF-32')) {
    return mk({ ...TEXT_TYPE, name: `Text (${probe.encoding}, with BOM)` }, 'medium', details);
  }
  let s = '';
  try {
    s = new TextDecoder('utf-8').decode(h.subarray(0, Math.min(h.length, 4096)));
  } catch {
    s = ascii(h, 0, Math.min(h.length, 4096));
  }
  if (h[0] === 0xef && h[1] === 0xbb && h[2] === 0xbf) details.push('Starts with a UTF-8 byte-order mark');
  const t = s.replace(/^\s+/, '');
  const lower = t.slice(0, 600).toLowerCase();
  const crlf = s.includes('\r\n');
  if (s.includes('\n')) details.push(`Line endings: ${crlf ? 'CRLF (Windows)' : s.includes('\r') && !s.includes('\n') ? 'CR' : 'LF (Unix)'}`);
  if (t.startsWith('#!')) {
    const line = t.split('\n', 1)[0] ?? '';
    return mk(ft('script', 'Script with shebang', 'text/x-script', 'sh', 'text', ['sh', 'bash', 'py', 'rb', 'pl', 'js', 'mjs', 'zsh', 'php', 'lua', 'run', 'bin']), 'high', [`Interpreter: ${line.slice(2).trim()}`, ...details]);
  }
  if (lower.startsWith('<?xml')) {
    if (/<svg[\s>]/.test(lower) || /<svg[\s>]/.test(t.slice(0, 2000).toLowerCase())) return mk(ft('svg', 'SVG image', 'image/svg+xml', 'svg', 'image', ['svg']), 'high', details);
    if (/<(rss|feed)[\s>]/.test(lower)) return mk(ft('feed', 'RSS / Atom feed (XML)', 'application/xml', 'xml', 'text', ['xml', 'rss', 'atom']), 'medium', details);
    if (/<plist[\s>]/.test(t.slice(0, 2000).toLowerCase())) return mk(ft('plist', 'Apple property list (XML)', 'application/x-plist', 'plist', 'data', ['plist']), 'high', details);
    if (/<html[\s>]/.test(lower)) return mk(ft('xhtml', 'XHTML document', 'application/xhtml+xml', 'xhtml', 'text', ['xhtml', 'html', 'htm', 'xml']), 'medium', details);
    return mk(ft('xml', 'XML document', 'application/xml', 'xml', 'text', ['xml', 'xsd', 'xsl', 'xslt', 'xaml', 'csproj', 'config', 'plist', 'kml', 'gpx', 'rss', 'atom', 'opml', 'wsdl', 'resx', 'svg']), 'high', details);
  }
  if (lower.startsWith('<svg')) return mk(ft('svg', 'SVG image', 'image/svg+xml', 'svg', 'image', ['svg']), 'high', details);
  if (lower.startsWith('<!doctype html') || /^<html[\s>]/.test(lower) || (/^<(head|body|meta|title)[\s>]/.test(lower) && /<\/?(html|body|head|div|p)\b/.test(lower))) {
    return mk(ft('html', 'HTML document', 'text/html', 'html', 'text', ['html', 'htm', 'xhtml', 'shtml']), 'high', details);
  }
  const pem = /^-----BEGIN ([A-Z0-9 ]+)-----/.exec(t);
  if (pem) return mk(ft('pem', `PEM-encoded ${pem[1]?.toLowerCase() ?? 'data'}`, 'application/x-pem-file', 'pem', 'data', ['pem', 'crt', 'cer', 'key', 'pub', 'csr', 'asc', 'gpg', 'pgp']), 'high', details);
  if (lower.startsWith('begin:vcard')) return mk(ft('vcard', 'vCard contact', 'text/vcard', 'vcf', 'text', ['vcf', 'vcard']), 'high', details);
  if (lower.startsWith('begin:vcalendar')) return mk(ft('ical', 'iCalendar', 'text/calendar', 'ics', 'text', ['ics', 'ical', 'ifb']), 'high', details);
  if (/^[{[]/.test(t) && /^(\{\s*"|\{\s*\}|\[\s*[{["\d\-tfn\]])/.test(t)) return mk(ft('json', 'JSON document', 'application/json', 'json', 'text', ['json', 'geojson', 'jsonl', 'ndjson', 'map', 'webmanifest', 'ipynb']), 'medium', details);
  if (/^d\d+:/.test(t) || /^d\d*:(announce|info|created)/.test(t)) return mk(ft('torrent', 'BitTorrent metainfo', 'application/x-bittorrent', 'torrent', 'data', ['torrent']), 'medium', details);
  if (/^diff --git|^--- .*\n\+\+\+ /.test(t)) return mk(ft('diff', 'Unified diff / patch', 'text/x-diff', 'diff', 'text', ['diff', 'patch']), 'medium', details);
  if (/^\[[^\]\n]+\]\s*\n[^\n=]+=/.test(t)) return mk(ft('ini', 'INI / config file', 'text/plain', 'ini', 'text', ['ini', 'cfg', 'conf', 'toml', 'desktop', 'service']), 'low', details);
  return mk(TEXT_TYPE, 'low', details);
}

/* ------------------------------------------------------------------ */
/* Main detection                                                      */
/* ------------------------------------------------------------------ */

export const DETECT_HEAD = 262_144;

/** Synchronous detection from the first bytes of the data (ZIP sub-types need `refineZip`). */
export function detectFromHead(head: Uint8Array, size: number): Detection {
  if (head.length === 0) return mk(ft('empty', 'Empty file', 'application/x-empty', '', 'other', []), 'high', ['0 bytes']);

  const matches: Sig[] = [];
  for (const s of SIGS) if (matchSig(s, head, size)) matches.push(s);

  const ftyp = detectFtyp(head);
  // PDF header may be preceded by junk (up to 1024 bytes)
  let pdfLate = false;
  if (!matches.some((m) => m.id === 'pdf-document') && head.length > 5) {
    const idx = ascii(head, 0, Math.min(head.length, 1024)).indexOf('%PDF-');
    if (idx > 0) pdfLate = true;
  }

  matches.sort((a, b) => b.score - a.score);
  const best = matches[0];
  const alt = (except: string) => matches.filter((m) => m.id !== except).slice(0, 4).map((m) => m.name);

  if (ftyp) return { ...ftyp, alternatives: [] };
  if (!best && pdfLate) return mk(BYID.get('pdf-document') ?? ft('pdf', 'PDF document', 'application/pdf', 'pdf', 'document'), 'medium', ['PDF header found after leading bytes', ...pdfDetails(head.subarray(0))]);

  if (best) {
    let conf = confOf(best);
    let type: FileType = best;
    let details: string[] = [];
    switch (best.id) {
      case 'png-image':
        details = pngDetails(head);
        if (details.some((d) => d.includes('APNG'))) type = { ...best, name: 'Animated PNG (APNG)', mime: 'image/apng', ext: 'apng', exts: ['apng', 'png'] };
        break;
      case 'jpeg-image':
        details = jpegDetails(head);
        break;
      case 'gif-image':
        details = gifDetails(head);
        break;
      case 'bmp-image':
        details = bmpDetails(head);
        break;
      case 'webp-image':
        details = webpDetails(head);
        break;
      case 'wav-audio':
        details = wavDetails(head);
        break;
      case 'pdf-document':
        details = pdfDetails(head);
        break;
      case 'sqlite-3-database':
        details = sqliteDetails(head);
        break;
      case 'elf':
        details = elfDetails(head);
        if (details.some((d) => d.includes('shared object'))) type = { ...best, name: 'ELF shared object / PIE executable', ext: 'so' };
        else if (details.some((d) => d.includes('relocatable'))) type = { ...best, name: 'ELF relocatable object', ext: 'o' };
        else if (details.some((d) => d.includes('core'))) type = { ...best, name: 'ELF core dump', ext: 'core', exts: ['core', 'elf'] };
        break;
      case 'pe': {
        const p = peDetails(head);
        details = p.details;
        if (p.dll) type = { ...best, name: 'Windows DLL (PE)', ext: 'dll', exts: ['dll', 'ocx', 'cpl', 'drv', 'ax', 'mui'] };
        else if (p.driver) type = { ...best, name: 'Windows driver (PE, .sys)', ext: 'sys', exts: ['sys', 'drv'] };
        else if (details.some((d) => d.includes('EFI'))) type = { ...best, name: 'EFI executable (PE)', ext: 'efi', exts: ['efi'] };
        break;
      }
      case 'macho-32-be':
        details = machoDetails(head, false, false);
        break;
      case 'macho-32-le':
        details = machoDetails(head, true, false);
        break;
      case 'macho-64-be':
        details = machoDetails(head, false, true);
        break;
      case 'macho-64-le':
        details = machoDetails(head, true, true);
        break;
      case 'macho-fat': {
        const n = u32be(head, 4);
        const archs: string[] = [];
        for (let i = 0; i < n && 8 + i * 20 + 4 <= head.length; i++) {
          const cpu = u32be(head, 8 + i * 20);
          archs.push(MACHO_CPU[cpu] ?? `0x${cpu.toString(16)}`);
        }
        details = [`${n} architectures: ${archs.join(', ')}`];
        break;
      }
      case 'java-class': {
        const major = u16be(head, 6);
        const v = major - 44;
        details = [`Class file major version ${major} (Java ${v >= 1 && v <= 50 ? (v <= 8 ? `1.${v}` : String(v)) : '?'})`];
        break;
      }
      case 'ogg-container': {
        const o = oggRefine(head);
        if (o) type = o;
        break;
      }
      case 'matroska-webm-ebml': {
        const o = ebmlRefine(head);
        if (o) type = o;
        break;
      }
      case 'ole2': {
        const o = oleDetails(head);
        details = o.details;
        if (o.name && o.ext && o.mime) type = { ...best, name: o.name, ext: o.ext, mime: o.mime, exts: [o.ext, 'ole'] };
        break;
      }
      case 'tar-archive':
        details = [`ustar header, first entry "${ascii(head, 0, 100).split('\u0000')[0] ?? ''}"`];
        break;
      case 'bzip2-compressed-data':
        details = [`Block size ${((head[3] ?? 0x30) - 0x30) * 100} kB`];
        break;
      case 'gzip-compressed-data': {
        const flags = head[3] ?? 0;
        const os = head[9] ?? 255;
        const OS: Record<number, string> = { 0: 'FAT', 3: 'Unix', 7: 'Macintosh', 11: 'NTFS' };
        details = [`Header OS: ${OS[os] ?? os}`];
        if (flags & 8) {
          let e = 10;
          if (flags & 4) e += 2 + u16le(head, 10);
          const z = head.indexOf(0, e);
          if (z > e) details.push(`Original file name: ${ascii(head, e, z - e)}`);
        }
        break;
      }
      case 'mp3-sync':
        conf = mpegFrameLength(head, 0) > 0 && mpegFrameLength(head, mpegFrameLength(head, 0)) > 0 ? 'medium' : 'low';
        break;
      case 'mp3-audio-id3-tag':
        details = [`ID3v2.${head[3]}.${head[4]} tag`];
        break;
      default:
        break;
    }
    if (best.id === 'pe' || best.id === 'elf') conf = 'high';
    return mk(type, conf, details, alt(best.id));
  }

  const txt = detectTextual(head);
  if (txt) return txt;
  return mk(ft('unknown', 'Unknown binary data', 'application/octet-stream', '', 'other', []), 'low', ['No known signature matched']);
}

/* ---- ZIP container sub-types (needs the central directory) ---- */

export interface ZipInfo {
  names: string[];
  count: number;
  mimetype: string | null;
}

/** Read entry names from a ZIP's central directory using windowed reads. */
export async function readZipInfo(read: ReadAt, size: number): Promise<ZipInfo | null> {
  if (size < 22) return null;
  const tailLen = Math.min(size, 22 + 0xffff);
  const tail = await read(size - tailLen, tailLen);
  const dv = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) return null;
  const eocdAbs = size - tailLen + eocd;
  let count = dv.getUint16(eocd + 10, true);
  let cdSize = dv.getUint32(eocd + 12, true);
  let cdOff = dv.getUint32(eocd + 16, true);
  if (count === 0xffff || cdSize === 0xffffffff || cdOff === 0xffffffff) {
    if (eocd >= 20 && dv.getUint32(eocd - 20, true) === 0x07064b50) {
      const recOff = Number(dv.getBigUint64(eocd - 20 + 8, true));
      const rec = await read(recOff, 56);
      const rv = new DataView(rec.buffer, rec.byteOffset, rec.byteLength);
      if (rec.length >= 56 && rv.getUint32(0, true) === 0x06064b50) {
        count = Number(rv.getBigUint64(32, true));
        cdSize = Number(rv.getBigUint64(40, true));
        cdOff = Number(rv.getBigUint64(48, true));
      }
    }
  }
  let base = 0;
  const probe = await read(cdOff, 4);
  if (probe.length < 4 || new DataView(probe.buffer, probe.byteOffset, 4).getUint32(0, true) !== 0x02014b50) {
    const alt = eocdAbs - cdSize;
    if (alt >= 0) {
      const p2 = await read(alt, 4);
      if (p2.length === 4 && new DataView(p2.buffer, p2.byteOffset, 4).getUint32(0, true) === 0x02014b50) {
        base = alt - cdOff;
        cdOff = alt;
      } else return null;
    } else return null;
  }
  const CAP = 8 * 1024 * 1024;
  const cd = await read(cdOff, Math.min(cdSize, CAP));
  const cv = new DataView(cd.buffer, cd.byteOffset, cd.byteLength);
  const names: string[] = [];
  let p = 0;
  let firstLocal = -1;
  let firstMethod = -1;
  let firstCsize = 0;
  const dec = new TextDecoder('utf-8');
  while (p + 46 <= cd.length && cv.getUint32(p, true) === 0x02014b50 && names.length < 50_000) {
    const nl = cv.getUint16(p + 28, true);
    const el = cv.getUint16(p + 30, true);
    const cl = cv.getUint16(p + 32, true);
    if (p + 46 + nl > cd.length) break;
    const name = dec.decode(cd.subarray(p + 46, p + 46 + nl));
    if (names.length === 0) {
      firstLocal = cv.getUint32(p + 42, true) + base;
      firstMethod = cv.getUint16(p + 10, true);
      firstCsize = cv.getUint32(p + 20, true);
    }
    names.push(name);
    p += 46 + nl + el + cl;
  }
  let mimetype: string | null = null;
  if (names[0] === 'mimetype' && firstMethod === 0 && firstCsize > 0 && firstCsize < 256 && firstLocal >= 0) {
    const lh = await read(firstLocal, 30 + 8 + 256);
    const lv = new DataView(lh.buffer, lh.byteOffset, lh.byteLength);
    if (lh.length >= 30 && lv.getUint32(0, true) === 0x04034b50) {
      const start = 30 + lv.getUint16(26, true) + lv.getUint16(28, true);
      const data = await read(firstLocal + start, firstCsize);
      mimetype = new TextDecoder().decode(data).trim();
    }
  }
  return { names, count: Math.max(count, names.length), mimetype };
}

const ODF: Record<string, FileType> = {
  'application/vnd.oasis.opendocument.text': ft('odt', 'OpenDocument Text (ODT)', 'application/vnd.oasis.opendocument.text', 'odt', 'document', ['odt', 'ott', 'fodt']),
  'application/vnd.oasis.opendocument.spreadsheet': ft('ods', 'OpenDocument Spreadsheet (ODS)', 'application/vnd.oasis.opendocument.spreadsheet', 'ods', 'document', ['ods', 'ots']),
  'application/vnd.oasis.opendocument.presentation': ft('odp', 'OpenDocument Presentation (ODP)', 'application/vnd.oasis.opendocument.presentation', 'odp', 'document', ['odp', 'otp']),
  'application/vnd.oasis.opendocument.graphics': ft('odg', 'OpenDocument Drawing (ODG)', 'application/vnd.oasis.opendocument.graphics', 'odg', 'document', ['odg', 'otg']),
  'application/vnd.oasis.opendocument.formula': ft('odf', 'OpenDocument Formula (ODF)', 'application/vnd.oasis.opendocument.formula', 'odf', 'document', ['odf']),
  'application/epub+zip': ft('epub', 'EPUB e-book', 'application/epub+zip', 'epub', 'document', ['epub']),
  'application/x-krita': ft('kra', 'Krita document (KRA)', 'application/x-krita', 'kra', 'image', ['kra']),
  'image/openraster': ft('ora', 'OpenRaster image (ORA)', 'image/openraster', 'ora', 'image', ['ora']),
};

/** Work out which ZIP-based format a ZIP is (DOCX, JAR, APK, EPUB, ...) from its entry names. */
export function classifyZip(info: ZipInfo): { type: FileType; details: string[] } | null {
  const n = info.names;
  const has = (s: string) => n.includes(s);
  const starts = (p: string) => n.some((x) => x.startsWith(p));
  const ends = (p: string) => n.some((x) => x.toLowerCase().endsWith(p));
  const details = [`${info.count.toLocaleString('en-US')} entries`];
  if (info.mimetype && ODF[info.mimetype]) return { type: ODF[info.mimetype] as FileType, details: [...details, `mimetype: ${info.mimetype}`] };
  if (has('[Content_Types].xml')) {
    if (starts('word/')) {
      const macro = has('word/vbaProject.bin');
      return { type: macro ? ft('docm', 'Word macro-enabled document (DOCM)', 'application/vnd.ms-word.document.macroEnabled.12', 'docm', 'document', ['docm', 'dotm']) : ft('docx', 'Word document (DOCX)', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx', 'document', ['docx', 'dotx']), details };
    }
    if (starts('xl/')) {
      const macro = has('xl/vbaProject.bin');
      return { type: macro ? ft('xlsm', 'Excel macro-enabled workbook (XLSM)', 'application/vnd.ms-excel.sheet.macroEnabled.12', 'xlsm', 'document', ['xlsm', 'xltm']) : ft('xlsx', 'Excel workbook (XLSX)', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx', 'document', ['xlsx', 'xltx']), details };
    }
    if (starts('ppt/')) {
      const macro = has('ppt/vbaProject.bin');
      return { type: macro ? ft('pptm', 'PowerPoint macro-enabled presentation (PPTM)', 'application/vnd.ms-powerpoint.presentation.macroEnabled.12', 'pptm', 'document', ['pptm', 'potm']) : ft('pptx', 'PowerPoint presentation (PPTX)', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx', 'document', ['pptx', 'potx', 'ppsx']), details };
    }
    if (starts('visio/')) return { type: ft('vsdx', 'Visio drawing (VSDX)', 'application/vnd.ms-visio.drawing', 'vsdx', 'document', ['vsdx', 'vssx']), details };
    if (starts('3D/') && has('3D/3dmodel.model')) return { type: ft('3mf', '3D Manufacturing Format (3MF)', 'model/3mf', '3mf', 'data', ['3mf']), details };
    if (ends('.fdseq') || starts('Documents/')) return { type: ft('xps', 'XPS document', 'application/vnd.ms-xpsdocument', 'xps', 'document', ['xps', 'oxps']), details };
    return { type: ft('ooxml', 'Open Packaging Convention (OOXML) package', 'application/octet-stream', 'zip', 'archive', ['zip', 'docx', 'xlsx', 'pptx', 'vsdx', 'nupkg']), details };
  }
  if (has('AndroidManifest.xml') && (has('classes.dex') || has('resources.arsc'))) return { type: ft('apk', 'Android package (APK)', 'application/vnd.android.package-archive', 'apk', 'executable', ['apk', 'xapk', 'apks']), details };
  if (has('BundleConfig.pb')) return { type: ft('aab', 'Android App Bundle (AAB)', 'application/octet-stream', 'aab', 'executable', ['aab']), details };
  if (has('AndroidManifest.xml') && has('classes.jar')) return { type: ft('aar', 'Android library (AAR)', 'application/octet-stream', 'aar', 'archive', ['aar']), details };
  if (n.some((x) => /^Payload\/[^/]+\.app\//.test(x))) return { type: ft('ipa', 'iOS app (IPA)', 'application/octet-stream', 'ipa', 'executable', ['ipa']), details };
  if (starts('WEB-INF/')) return { type: ft('war', 'Java web archive (WAR)', 'application/java-archive', 'war', 'executable', ['war']), details };
  if (has('META-INF/application.xml')) return { type: ft('ear', 'Java enterprise archive (EAR)', 'application/java-archive', 'ear', 'executable', ['ear']), details };
  if (has('extension.vsixmanifest')) return { type: ft('vsix', 'Visual Studio extension (VSIX)', 'application/vsix', 'vsix', 'executable', ['vsix']), details };
  if (n.some((x) => x.endsWith('.nuspec'))) return { type: ft('nupkg', 'NuGet package', 'application/octet-stream', 'nupkg', 'archive', ['nupkg']), details };
  if (n.some((x) => /\.dist-info\/WHEEL$/.test(x))) return { type: ft('whl', 'Python wheel', 'application/octet-stream', 'whl', 'archive', ['whl']), details };
  if (starts('EGG-INFO/')) return { type: ft('egg', 'Python egg', 'application/octet-stream', 'egg', 'archive', ['egg']), details };
  if (has('install.rdf') || has('META-INF/mozilla.rsa') || has('META-INF/cose.sig')) return { type: ft('xpi', 'Firefox add-on (XPI)', 'application/x-xpinstall', 'xpi', 'archive', ['xpi']), details };
  if (has('doc.kml')) return { type: ft('kmz', 'Google Earth KMZ', 'application/vnd.google-earth.kmz', 'kmz', 'data', ['kmz']), details };
  if (has('collection.anki2') || has('collection.anki21')) return { type: ft('apkg', 'Anki deck package', 'application/octet-stream', 'apkg', 'data', ['apkg']), details };
  if (has('document.json') && starts('pages/')) return { type: ft('sketch', 'Sketch document', 'application/x-sketch', 'sketch', 'image', ['sketch']), details };
  if (has('META-INF/MANIFEST.MF') || ends('.class')) return { type: ft('jar', 'Java archive (JAR)', 'application/java-archive', 'jar', 'executable', ['jar']), details };
  const files = n.filter((x) => !x.endsWith('/'));
  if (files.length >= 3 && files.every((x) => /\.(jpe?g|png|gif|webp|bmp|avif)$/i.test(x) || /(^|\/)(comicinfo\.xml|thumbs\.db)$/i.test(x))) {
    return { type: ft('cbz', 'Comic book archive (CBZ)', 'application/vnd.comicbook+zip', 'cbz', 'archive', ['cbz', 'zip']), details };
  }
  return null;
}

export interface DetectOptions {
  /** File name, used only for the extension check. */
  fileName?: string;
}

/** Full detection: reads the head window and (for ZIPs) the central directory. */
export async function detectFileType(read: ReadAt, size: number): Promise<Detection> {
  const head = await read(0, Math.min(size, DETECT_HEAD));
  const d = detectFromHead(head, size);
  if (d.id === 'zip' || d.id === 'zip-empty' || d.id === 'zip-spanned') {
    try {
      const info = await readZipInfo(read, size);
      if (info) {
        const c = classifyZip(info);
        if (c) return mk(c.type, 'high', c.details, ['ZIP archive']);
        const sample = info.names.slice(0, 5).join(', ');
        return { ...d, details: [`${info.count.toLocaleString('en-US')} entries${sample ? `: ${sample}${info.count > 5 ? ', …' : ''}` : ''}`] };
      }
    } catch {
      /* fall through to the generic ZIP result */
    }
  }
  return d;
}

/* ---- extension check ---- */
const ZIP_FAMILY = new Set(['zip', 'jar', 'war', 'ear', 'apk', 'aab', 'aar', 'xapk', 'ipa', 'docx', 'docm', 'dotx', 'xlsx', 'xlsm', 'xltx', 'pptx', 'pptm', 'ppsx', 'potx', 'vsdx', 'odt', 'ods', 'odp', 'odg', 'odf', 'ott', 'ots', 'otp', 'epub', 'xpi', 'vsix', 'nupkg', 'whl', 'egg', 'kmz', 'cbz', 'xps', 'oxps', '3mf', 'apkg', 'sketch', 'kra', 'ora', 'crx', 'jmod', 'zipx', 'maff', 'sb3', 'mxl', 'mscz', 'gh']);

/** Extensions that are never plain text - used to flag e.g. a text file named ".png". */
const STRONG_BINARY = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'tif', 'tiff', 'heic', 'avif', 'psd', 'mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'wma', 'mp4', 'mov', 'mkv', 'avi', 'webm', 'wmv', 'flv',
  'zip', 'gz', 'tgz', 'bz2', 'xz', '7z', 'rar', 'tar', 'zst', 'pdf', 'docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt', 'odt', 'ods', 'odp', 'epub', 'exe', 'dll', 'so', 'dylib', 'elf', 'class', 'jar', 'apk',
  'wasm', 'ttf', 'otf', 'woff', 'woff2', 'sqlite', 'sqlite3', 'iso', 'dmg', 'msi', 'deb', 'rpm',
]);

export interface ExtCheck {
  status: 'match' | 'mismatch' | 'noext' | 'unknown';
  message: string;
}

export function checkExtension(fileName: string | undefined, d: Detection): ExtCheck {
  if (!fileName) return { status: 'unknown', message: '' };
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return { status: 'noext', message: 'The file name has no extension.' };
  const ext = base.slice(dot + 1).toLowerCase();
  const prev = base.slice(0, dot).toLowerCase();
  const compound = prev.endsWith('.tar') ? `tar.${ext}` : ext;
  if (d.id === 'unknown' || d.id === 'empty') return { status: 'unknown', message: '' };
  if (d.exts.includes(ext) || d.exts.includes(compound)) return { status: 'match', message: '' };
  if (d.id === 'zip' || d.id === 'zip-empty' || d.id === 'zip-spanned') {
    if (ZIP_FAMILY.has(ext)) return { status: 'match', message: '' };
  }
  if (d.id === 'gzip-compressed-data' && /^t?gz$/.test(ext)) return { status: 'match', message: '' };
  if (d.id === 'ole2' && ['doc', 'xls', 'ppt', 'msi', 'msg', 'vsd', 'pub', 'xlt', 'dot', 'pot', 'db', 'suo', 'thumbs'].includes(ext)) return { status: 'match', message: '' };
  if (d.category === 'text') {
    if (STRONG_BINARY.has(ext)) return { status: 'mismatch', message: `Named ".${ext}" but the content looks like ${d.name.toLowerCase()} - it is not a ${ext.toUpperCase()} file.` };
    return { status: 'unknown', message: '' };
  }
  if (d.id.startsWith('mp4') || d.id === 'm4a' || d.id === 'm4v' || d.id === 'mov') {
    if (['mp4', 'm4v', 'm4a', 'mov', 'f4v', '3gp', 'm4b', 'm4p'].includes(ext)) return { status: 'match', message: '' };
  }
  const expected = d.ext ? ` (usually .${d.ext})` : '';
  if (ZIP_FAMILY.has(ext) && d.alternatives.includes('ZIP archive')) {
    return { status: 'mismatch', message: `Named ".${ext}" but the contents are ${d.name}${expected} - it is a ZIP-based file of a different kind.` };
  }
  return { status: 'mismatch', message: `The extension ".${ext}" doesn't match the content, which looks like ${d.name}${expected}.` };
}

export const SIGNATURE_COUNT = SIGS.length;
export const SIGNATURE_TYPES: FileType[] = SIGS.map(({ id, name, mime, ext, exts, category }) => ({ id, name, mime, ext, exts, category }));
