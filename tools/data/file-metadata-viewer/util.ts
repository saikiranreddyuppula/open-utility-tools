/** Low-level byte, string, date and formatting helpers shared by all parsers. */
import { Inflate, Unzlib, Gunzip } from 'fflate';
import type { Cat, DetectedType, Finding, Preview, Row, Section } from './types';

// ---------------------------------------------------------------------------
// Random access readers
// ---------------------------------------------------------------------------

export interface Reader {
  readonly size: number;
  read(off: number, len: number): Promise<Uint8Array>;
  /** Like read() but without the look-ahead cache: for long strides through a big file. */
  peek(off: number, len: number): Promise<Uint8Array>;
}

/** Ranged reads over a Blob with a small sliding cache so header walks stay cheap. */
export class BlobReader implements Reader {
  readonly size: number;
  private winStart = 0;
  private win: Uint8Array = new Uint8Array(0);

  constructor(
    private readonly blob: Blob,
    private readonly windowSize = 65536
  ) {
    this.size = blob.size;
  }

  async peek(off: number, len: number): Promise<Uint8Array> {
    if (!Number.isFinite(off) || !Number.isFinite(len)) return new Uint8Array(0);
    const start = Math.max(0, Math.floor(off));
    if (start >= this.size || len <= 0) return new Uint8Array(0);
    const end = Math.min(this.size, start + Math.floor(len));
    return new Uint8Array(await this.blob.slice(start, end).arrayBuffer());
  }

  async read(off: number, len: number): Promise<Uint8Array> {
    if (!Number.isFinite(off) || !Number.isFinite(len)) return new Uint8Array(0);
    const start = Math.max(0, Math.floor(off));
    if (start >= this.size || len <= 0) return new Uint8Array(0);
    const end = Math.min(this.size, start + Math.floor(len));
    const winEnd = this.winStart + this.win.length;
    if (start >= this.winStart && end <= winEnd) {
      return this.win.subarray(start - this.winStart, end - this.winStart);
    }
    const want = end - start;
    if (want > this.windowSize * 4) {
      return new Uint8Array(await this.blob.slice(start, end).arrayBuffer());
    }
    const fetchLen = Math.min(this.size - start, Math.max(want, this.windowSize));
    const buf = new Uint8Array(await this.blob.slice(start, start + fetchLen).arrayBuffer());
    this.winStart = start;
    this.win = buf;
    return buf.subarray(0, want);
  }
}

export class MemReader implements Reader {
  readonly size: number;
  constructor(readonly data: Uint8Array) {
    this.size = data.length;
  }
  peek(off: number, len: number): Promise<Uint8Array> {
    return this.read(off, len);
  }
  async read(off: number, len: number): Promise<Uint8Array> {
    if (!Number.isFinite(off) || !Number.isFinite(len)) return new Uint8Array(0);
    const start = Math.max(0, Math.floor(off));
    if (start >= this.size || len <= 0) return new Uint8Array(0);
    return this.data.subarray(start, Math.min(this.size, start + Math.floor(len)));
  }
}

/** Read exactly `len` bytes or throw (for fixed-size structures). */
export async function readExact(rd: Reader, off: number, len: number): Promise<Uint8Array> {
  const b = await rd.read(off, len);
  if (b.length < len) throw new Error(`unexpected end of file at offset ${off}`);
  return b;
}

// ---------------------------------------------------------------------------
// Integers (out-of-range reads yield 0 rather than throwing)
// ---------------------------------------------------------------------------

export function u8(b: Uint8Array, o: number): number {
  return b[o] ?? 0;
}
export function u16(b: Uint8Array, o: number, le = false): number {
  const a = b[o] ?? 0;
  const c = b[o + 1] ?? 0;
  return le ? a | (c << 8) : (a << 8) | c;
}
export function u24(b: Uint8Array, o: number, le = false): number {
  const a = b[o] ?? 0;
  const c = b[o + 1] ?? 0;
  const d = b[o + 2] ?? 0;
  return le ? a | (c << 8) | (d << 16) : (a << 16) | (c << 8) | d;
}
export function u32(b: Uint8Array, o: number, le = false): number {
  const a = b[o] ?? 0;
  const c = b[o + 1] ?? 0;
  const d = b[o + 2] ?? 0;
  const e = b[o + 3] ?? 0;
  return (le ? (a | (c << 8) | (d << 16) | (e << 24)) : ((a << 24) | (c << 16) | (d << 8) | e)) >>> 0;
}
export function i16(b: Uint8Array, o: number, le = false): number {
  const v = u16(b, o, le);
  return v > 0x7fff ? v - 0x10000 : v;
}
export function i32(b: Uint8Array, o: number, le = false): number {
  return u32(b, o, le) | 0;
}
/** 64-bit unsigned as a JS number (exact up to 2^53). */
export function u64(b: Uint8Array, o: number, le = false): number {
  const hi = u32(b, le ? o + 4 : o, le);
  const lo = u32(b, le ? o : o + 4, le);
  return hi * 4294967296 + lo;
}
export function i64(b: Uint8Array, o: number, le = false): number {
  const hi = i32(b, le ? o + 4 : o, le);
  const lo = u32(b, le ? o : o + 4, le);
  return hi * 4294967296 + lo;
}
export function f32(b: Uint8Array, o: number, le = false): number {
  if (o + 4 > b.length) return 0;
  return new DataView(b.buffer, b.byteOffset, b.byteLength).getFloat32(o, le);
}
export function f64(b: Uint8Array, o: number, le = false): number {
  if (o + 8 > b.length) return 0;
  return new DataView(b.buffer, b.byteOffset, b.byteLength).getFloat64(o, le);
}

// ---------------------------------------------------------------------------
// Strings
// ---------------------------------------------------------------------------

export function latin1(b: Uint8Array, start = 0, end = b.length): string {
  const e = Math.min(end, b.length);
  let out = '';
  for (let i = Math.max(0, start); i < e; i += 8192) {
    out += String.fromCharCode.apply(null, Array.from(b.subarray(i, Math.min(e, i + 8192))));
  }
  return out;
}

/** 4-character code / short ASCII tag. */
export function fourcc(b: Uint8Array, o: number): string {
  return latin1(b, o, o + 4);
}

export function utf8(b: Uint8Array): string {
  return new TextDecoder('utf-8').decode(b);
}

export function utf8Strict(b: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(b);
  } catch {
    return null;
  }
}

/** UTF-8 if valid, else Latin-1. */
export function textSmart(b: Uint8Array): string {
  return utf8Strict(b) ?? latin1(b);
}

export function utf16(b: Uint8Array, le: boolean, start = 0, end = b.length): string {
  let out = '';
  const e = Math.min(end, b.length);
  for (let i = start; i + 1 < e; i += 2) out += String.fromCharCode(u16(b, i, le));
  return out;
}

/** Decode UTF-16 honouring a BOM (defaults to the given endianness). */
export function utf16Bom(b: Uint8Array, defaultLe = false): string {
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) return utf16(b, true, 2);
  if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) return utf16(b, false, 2);
  return utf16(b, defaultLe);
}

export function stripNul(s: string): string {
  return s.replace(/\u0000+$/g, '').replace(/^\u0000+/g, '');
}

/** Replace control chars so they cannot break the UI table. */
export function clean(s: string): string {
  return s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '\uFFFD');
}

export function cstringAt(b: Uint8Array, start: number, end = b.length): { text: Uint8Array; next: number } {
  let i = start;
  while (i < end && b[i] !== 0) i++;
  return { text: b.subarray(start, i), next: i + 1 };
}

export function bytesEq(b: Uint8Array, o: number, sig: ArrayLike<number>): boolean {
  if (o < 0 || o + sig.length > b.length) return false;
  for (let i = 0; i < sig.length; i++) if (b[o + i] !== sig[i]) return false;
  return true;
}

export function asciiBytes(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 0xff);
  return out;
}

export function indexOfBytes(hay: Uint8Array, needle: ArrayLike<number>, from = 0, to = hay.length): number {
  const n = needle.length;
  const first = needle[0] ?? 0;
  const last = Math.min(to, hay.length) - n;
  for (let i = from; i <= last; i++) {
    if (hay[i] !== first) continue;
    let ok = true;
    for (let j = 1; j < n; j++) {
      if (hay[i + j] !== needle[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return i;
  }
  return -1;
}

export function concat(parts: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function toHex(b: Uint8Array, sep = ''): string {
  const parts: string[] = [];
  for (let i = 0; i < b.length; i++) parts.push((b[i] ?? 0).toString(16).padStart(2, '0'));
  return parts.join(sep);
}

export function fromBase64(s: string): Uint8Array {
  const bin = atob(s.replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------------------
// Numbers, sizes, dates
// ---------------------------------------------------------------------------

export function fmtBytes(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (n < 1024) return `${n} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)} ${units[i]}`;
}

export function fmtSize(n: number): string {
  return n < 1024 ? `${n.toLocaleString('en-US')} bytes` : `${n.toLocaleString('en-US')} bytes (${fmtBytes(n)})`;
}

/** Trim trailing zeros: 2.50 -> "2.5". */
export function fmtNum(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return String(n);
  return String(parseFloat(n.toFixed(digits)));
}

export function fmtDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return String(sec);
  const total = Math.round(sec * 1000);
  const ms = total % 1000;
  const s = Math.floor(total / 1000) % 60;
  const m = Math.floor(total / 60000) % 60;
  const h = Math.floor(total / 3600000);
  const body = h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
  return `${body}.${String(ms).padStart(3, '0')} (${fmtNum(sec, 3)} s)`;
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function validYear(d: Date): boolean {
  const y = d.getUTCFullYear();
  return Number.isFinite(d.getTime()) && y >= 1900 && y <= 2200;
}

/** ISO-8601 UTC, seconds precision. Returns null for nonsense dates. */
export function isoFromMs(ms: number): string | null {
  const d = new Date(ms);
  if (!validYear(d)) return null;
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Seconds since 1904-01-01 (QuickTime / TrueType epoch). 0 means "unset". */
export function isoFromMac(sec: number): string | null {
  if (!sec) return null;
  return isoFromMs((sec - 2082844800) * 1000);
}

export function isoFromUnix(sec: number): string | null {
  if (!sec) return null;
  return isoFromMs(sec * 1000);
}

// ---------------------------------------------------------------------------
// Shannon entropy
// ---------------------------------------------------------------------------

export function entropy(b: Uint8Array): number {
  if (b.length === 0) return 0;
  const counts = new Uint32Array(256);
  for (let i = 0; i < b.length; i++) counts[b[i] ?? 0] = (counts[b[i] ?? 0] ?? 0) + 1;
  let h = 0;
  for (let i = 0; i < 256; i++) {
    const c = counts[i] ?? 0;
    if (c === 0) continue;
    const p = c / b.length;
    h -= p * Math.log2(p);
  }
  return h;
}

// ---------------------------------------------------------------------------
// Bounded inflate (protects against decompression bombs)
// ---------------------------------------------------------------------------

class LimitSignal extends Error {}

export interface InflateResult {
  out: Uint8Array;
  truncated: boolean;
}

export function inflateLimited(
  data: Uint8Array,
  kind: 'raw' | 'zlib' | 'gzip',
  maxOut: number
): InflateResult {
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  const cb = (chunk: Uint8Array) => {
    if (total + chunk.length > maxOut) {
      const take = maxOut - total;
      if (take > 0) {
        chunks.push(chunk.slice(0, take));
        total += take;
      }
      truncated = true;
      throw new LimitSignal();
    }
    chunks.push(chunk.slice());
    total += chunk.length;
  };
  const stream = kind === 'raw' ? new Inflate(cb) : kind === 'zlib' ? new Unzlib(cb) : new Gunzip(cb);
  try {
    stream.push(data, true);
  } catch (e) {
    if (!(e instanceof LimitSignal)) {
      if (total === 0) throw e;
      truncated = true;
    }
  }
  return { out: concat(chunks), truncated };
}

// ---------------------------------------------------------------------------
// Result collector
// ---------------------------------------------------------------------------

export class Collector {
  sections: Section[] = [];
  findings: Finding[] = [];
  errors: string[] = [];
  notes: string[] = [];
  previews: Preview[] = [];

  section(id: string, title: string, opts?: { note?: string; collapsed?: boolean }): Section {
    const found = this.sections.find((s) => s.id === id);
    if (found) return found;
    const s: Section = { id, title, rows: [] };
    if (opts?.note) s.note = opts.note;
    if (opts?.collapsed) s.collapsed = true;
    this.sections.push(s);
    return s;
  }

  row(sec: Section, k: string, v: string | number | bigint | boolean | null | undefined): void {
    if (v === null || v === undefined || v === false) return;
    const s = typeof v === 'string' ? v : String(v);
    if (s === '') return;
    sec.rows.push({ k, v: clean(s) });
  }

  rows(sec: Section, rows: Array<[string, string | number | boolean | null | undefined]>): void {
    for (const [k, v] of rows) this.row(sec, k, v);
  }

  find(cat: Cat, label: string, value: string): void {
    const v = value.trim();
    if (!v) return;
    const norm = v.toLowerCase();
    if (this.findings.some((f) => f.cat === cat && f.value.toLowerCase() === norm)) return;
    this.findings.push({ cat, label, value: clean(v) });
  }

  note(msg: string): void {
    if (!this.notes.includes(msg)) this.notes.push(msg);
  }

  preview(label: string, mime: string, data: Uint8Array): void {
    if (data.length === 0 || data.length > 24 * 1024 * 1024) return;
    if (this.previews.some((p) => p.label === label && p.data.length === data.length)) return;
    this.previews.push({ label, mime, data });
  }

  /** Run a parser step; a failure is recorded and never propagates. */
  async attempt(label: string, fn: () => Promise<void> | void): Promise<void> {
    try {
      await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.errors.push(`could not parse ${label}: ${msg}`);
    }
  }

  dropEmpty(): void {
    this.sections = this.sections.filter((s) => s.rows.length > 0 || s.raw);
  }
}

export function lookup<T>(table: Record<number, T>, key: number): T | undefined {
  return table[key];
}

export function hostRow(rows: Row[], k: string, v: string | null | undefined): void {
  if (v) rows.push({ k, v });
}

/** Sniff a preview mime from image bytes. */
export function imageMime(b: Uint8Array): string | null {
  if (bytesEq(b, 0, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (bytesEq(b, 0, [0x89, 0x50, 0x4e, 0x47])) return 'image/png';
  if (bytesEq(b, 0, [0x47, 0x49, 0x46, 0x38])) return 'image/gif';
  if (bytesEq(b, 0, [0x42, 0x4d])) return 'image/bmp';
  if (bytesEq(b, 0, asciiBytes('RIFF')) && bytesEq(b, 8, asciiBytes('WEBP'))) return 'image/webp';
  return null;
}

/** What every format parser receives. */
export interface Ctx {
  rd: Reader;
  size: number;
  /** First bytes of the file (up to 64 KiB). */
  head: Uint8Array;
  out: Collector;
  name: string;
  ext: string;
  det: DetectedType | null;
  /** Replace the detected type after looking deeper (e.g. ZIP -> DOCX). */
  refine(t: DetectedType): void;
  /** Optional hook supplied by the UI to read PDFs the built-in parser cannot handle. */
  pdfFallback?: (bytes: Uint8Array) => Promise<{ info: string; pages: number | null }>;
}
