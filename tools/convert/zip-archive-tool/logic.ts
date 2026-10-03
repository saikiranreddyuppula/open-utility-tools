/**
 * ZIP / TAR / GZ reading and ZIP creation core. Pure TypeScript, no DOM.
 *
 * The ZIP central directory, TAR headers (ustar / GNU long names / pax) and the GZIP header are parsed by hand
 * so that metadata (CRC-32, compressed size, flags, dates) is available without inflating anything.
 * Entries are inflated on demand with fflate, with hard output bounds against decompression bombs.
 */
import { Inflate, Gunzip, zipSync, type Zippable } from 'fflate';

/* ------------------------------------------------------------------ */
/* Types & constants                                                   */
/* ------------------------------------------------------------------ */

export type ArchiveFormat = 'zip' | 'tar' | 'tgz' | 'gz';
export type EntryKind = 'file' | 'dir' | 'symlink' | 'hardlink' | 'other';

export interface ArchiveEntry {
  index: number;
  /** Decoded path using "/" separators (no trailing slash). */
  path: string;
  isDir: boolean;
  kind: EntryKind;
  size: number;
  /** Compressed size in bytes; null when the format does not compress per entry (tar). */
  compressedSize: number | null;
  method: number | null;
  methodName: string;
  modified: Date | null;
  crc32: number | null;
  encrypted: boolean;
  /** Path is absolute or climbs out of the target directory ("zip-slip"). */
  unsafe: boolean;
  ratio: number | null;
  /** Compression ratio is extreme (possible decompression bomb). */
  suspicious: boolean;
  linkTarget?: string;
  comment?: string;
  /** Internal: zip local header offset or tar data offset. */
  off: number;
  /** Internal: size of the stored data (compressed bytes). */
  csize: number;
}

export interface ParsedArchive {
  format: ArchiveFormat;
  entries: ArchiveEntry[];
  /** Bytes entries are read from: zip file, tar bytes (decompressed for .tgz) or the gunzipped payload. */
  data: Uint8Array;
  /** Size of the file as uploaded. */
  fileSize: number;
  comment: string;
  warnings: string[];
  /** zip: whether ZIP64 structures were used. */
  zip64?: boolean;
}

export class ArchiveError extends Error {
  kind: 'unsupported' | 'invalid' | 'limit' | 'encrypted';
  constructor(kind: ArchiveError['kind'], message: string) {
    super(message);
    this.name = 'ArchiveError';
    this.kind = kind;
  }
}

/** Refuse to inflate any single entry whose declared size exceeds this. */
export const MAX_ENTRY_BYTES = 500 * 1024 * 1024;
/** Upper bound for gunzipping a whole .gz / .tgz into memory. */
export const MAX_GUNZIP_BYTES = 1024 * 1024 * 1024;
/** Upper bound for the sum of all entries when building a ZIP from an archive. */
export const MAX_BATCH_BYTES = 768 * 1024 * 1024;
export const MAX_ENTRIES = 1_000_000;
const TEXT_PREVIEW_BYTES = 64 * 1024;

const METHOD_NAMES: Record<number, string> = {
  0: 'Stored',
  1: 'Shrunk',
  6: 'Imploded',
  8: 'Deflate',
  9: 'Deflate64',
  12: 'BZIP2',
  14: 'LZMA',
  93: 'Zstandard',
  95: 'XZ',
  98: 'PPMd',
  99: 'AES-encrypted',
};

/* ------------------------------------------------------------------ */
/* Helpers: CRC-32, text decoding, paths                               */
/* ------------------------------------------------------------------ */

let CRC_TABLE: Uint32Array | null = null;
function crcTable(): Uint32Array {
  if (CRC_TABLE) return CRC_TABLE;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  CRC_TABLE = t;
  return t;
}

export function crc32(data: Uint8Array, prev = 0): number {
  const t = crcTable();
  let c = ~prev >>> 0;
  for (let i = 0; i < data.length; i++) c = (t[(c ^ (data[i] ?? 0)) & 0xff] ?? 0) ^ (c >>> 8);
  return ~c >>> 0;
}

const CP437_HIGH =
  'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';

export function decodeCp437(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] ?? 0;
    out += b < 0x80 ? String.fromCharCode(b) : (CP437_HIGH[b - 0x80] ?? '?');
  }
  return out;
}

const utf8 = new TextDecoder('utf-8');
const utf8Strict = new TextDecoder('utf-8', { fatal: true });

function isAscii(b: Uint8Array): boolean {
  for (let i = 0; i < b.length; i++) if ((b[i] ?? 0) > 0x7f) return false;
  return true;
}

/** Strict UTF-8 decode or null. */
export function tryUtf8(b: Uint8Array): string | null {
  try {
    return utf8Strict.decode(b);
  } catch {
    return null;
  }
}

export function decodeLatin1(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i] ?? 0);
  return s;
}

/** Windows/DOS style or absolute path or "..": the classic zip-slip shapes. */
export function isUnsafePath(path: string): boolean {
  const p = path.replace(/\\/g, '/');
  if (p.startsWith('/') || /^[A-Za-z]:/.test(p) || p.includes('\u0000')) return true;
  return p.split('/').includes('..');
}

/** Sanitize an archive path for output: no absolute roots, no "." / ".." segments. */
export function safePath(path: string): string {
  const out: string[] = [];
  for (const seg of path.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '').split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return out.join('/');
}

export function baseName(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? path : path.slice(i + 1);
}

/** Safe file name for a single download. */
export function downloadName(path: string): string {
  const n = baseName(path).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_');
  return n === '' || n === '.' || n === '..' ? 'file' : n;
}

function makeEntry(p: Partial<ArchiveEntry> & { path: string; index: number }): ArchiveEntry {
  const size = p.size ?? 0;
  const csize = p.csize ?? 0;
  const compressedSize = p.compressedSize === undefined ? csize : p.compressedSize;
  const ratio = compressedSize !== null && compressedSize > 0 && !p.isDir ? size / compressedSize : null;
  const suspicious = !p.isDir && ((ratio !== null && ratio >= 500 && size >= 1024 * 1024) || size > MAX_ENTRY_BYTES);
  return {
    index: p.index,
    path: p.path,
    isDir: p.isDir ?? false,
    kind: p.kind ?? (p.isDir ? 'dir' : 'file'),
    size,
    compressedSize,
    method: p.method ?? null,
    methodName: p.methodName ?? '',
    modified: p.modified ?? null,
    crc32: p.crc32 ?? null,
    encrypted: p.encrypted ?? false,
    unsafe: isUnsafePath(p.path),
    ratio,
    suspicious,
    linkTarget: p.linkTarget,
    comment: p.comment,
    off: p.off ?? 0,
    csize,
  };
}

/* ------------------------------------------------------------------ */
/* Format detection                                                    */
/* ------------------------------------------------------------------ */

export type DetectedFormat = 'zip' | 'gzip' | 'tar' | 'rar' | '7z' | 'bzip2' | 'xz' | 'zstd' | 'unknown';

function startsWith(d: Uint8Array, magic: number[], at = 0): boolean {
  if (d.length < at + magic.length) return false;
  for (let i = 0; i < magic.length; i++) if (d[at + i] !== magic[i]) return false;
  return true;
}

function cstring(d: Uint8Array, start: number, len: number): Uint8Array {
  let end = start;
  const max = Math.min(d.length, start + len);
  while (end < max && d[end] !== 0) end++;
  return d.subarray(start, end);
}

function parseOctal(d: Uint8Array, off: number, len: number): number | null {
  const first = d[off] ?? 0;
  if (first & 0x80) {
    // GNU base-256 big-endian
    let v = first & 0x7f;
    for (let i = 1; i < len; i++) v = v * 256 + (d[off + i] ?? 0);
    return v;
  }
  let s = '';
  for (let i = 0; i < len; i++) {
    const c = d[off + i] ?? 0;
    if (c === 0 || c === 32) {
      if (s === '') continue;
      break;
    }
    if (c < 48 || c > 55) return null;
    s += String.fromCharCode(c);
  }
  if (s === '') return 0;
  return parseInt(s, 8);
}

function tarChecksumOk(h: Uint8Array): boolean {
  const stored = parseOctal(h, 148, 8);
  if (stored === null) return false;
  let unsigned = 0;
  let signed = 0;
  for (let i = 0; i < 512; i++) {
    const b = i >= 148 && i < 156 ? 32 : (h[i] ?? 0);
    unsigned += b;
    signed += b > 127 ? b - 256 : b;
  }
  return stored === unsigned || stored === signed;
}

export function looksLikeTar(d: Uint8Array): boolean {
  if (d.length < 512) return false;
  const h = d.subarray(0, 512);
  if (!tarChecksumOk(h)) return false;
  if (startsWith(h, [0x75, 0x73, 0x74, 0x61, 0x72], 257)) return true;
  // v7 tar: a plausible name and a numeric size field
  return (h[0] ?? 0) !== 0 && parseOctal(h, 124, 12) !== null;
}

export function detectArchiveFormat(d: Uint8Array): DetectedFormat {
  if (startsWith(d, [0x50, 0x4b, 3, 4]) || startsWith(d, [0x50, 0x4b, 5, 6]) || startsWith(d, [0x50, 0x4b, 7, 8])) return 'zip';
  if (startsWith(d, [0x1f, 0x8b])) return 'gzip';
  if (startsWith(d, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])) return 'rar';
  if (startsWith(d, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return '7z';
  if (startsWith(d, [0x42, 0x5a, 0x68])) return 'bzip2';
  if (startsWith(d, [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00])) return 'xz';
  if (startsWith(d, [0x28, 0xb5, 0x2f, 0xfd])) return 'zstd';
  if (looksLikeTar(d)) return 'tar';
  return 'unknown';
}

const UNSUPPORTED_MSG: Partial<Record<DetectedFormat, string>> = {
  rar: 'RAR archives are not supported in the browser. Extract them with 7-Zip or WinRAR, or re-pack as .zip.',
  '7z': '7z archives are not supported in the browser. Extract them with 7-Zip, or re-pack as .zip.',
  bzip2: 'bzip2-compressed files (.bz2, .tar.bz2) are not supported. Re-compress as .gz or .zip, or extract with 7-Zip.',
  xz: 'xz-compressed files (.xz, .tar.xz) are not supported. Re-compress as .gz or .zip, or extract with 7-Zip.',
  zstd: 'Zstandard files (.zst, .tar.zst) are not supported. Re-compress as .gz or .zip, or extract with 7-Zip.',
};

/* ------------------------------------------------------------------ */
/* ZIP                                                                 */
/* ------------------------------------------------------------------ */

const SIG_EOCD = 0x06054b50;
const SIG_CEN = 0x02014b50;
const SIG_LOC = 0x04034b50;
const SIG_Z64_EOCD = 0x06064b50;
const SIG_Z64_LOC = 0x07064b50;

function dosDate(time: number, date: number): Date | null {
  if (date === 0) return null;
  const day = date & 0x1f;
  const mon = (date >> 5) & 0xf;
  const year = ((date >> 9) & 0x7f) + 1980;
  const sec = (time & 0x1f) * 2;
  const min = (time >> 5) & 0x3f;
  const hour = (time >> 11) & 0x1f;
  if (mon < 1 || mon > 12 || day < 1 || day > 31 || hour > 23 || min > 59 || sec > 59) return null;
  const d = new Date(year, mon - 1, day, hour, min, sec);
  return Number.isNaN(d.getTime()) ? null : d;
}

function findEocd(dv: DataView, len: number): number {
  const min = Math.max(0, len - 22 - 0xffff);
  let loose = -1;
  for (let i = len - 22; i >= min; i--) {
    if (dv.getUint32(i, true) !== SIG_EOCD) continue;
    const cl = dv.getUint16(i + 20, true);
    if (i + 22 + cl === len) return i;
    if (loose === -1 && i + 22 + cl < len) loose = i;
  }
  return loose;
}

interface ExtraFields {
  zip64?: DataView;
  unicodePath?: { crc: number; name: Uint8Array };
}

function parseExtra(dv: DataView, off: number, len: number): ExtraFields {
  const out: ExtraFields = {};
  let p = off;
  const end = off + len;
  while (p + 4 <= end) {
    const id = dv.getUint16(p, true);
    const sz = dv.getUint16(p + 2, true);
    const body = p + 4;
    if (body + sz > end) break;
    if (id === 0x0001) out.zip64 = new DataView(dv.buffer, dv.byteOffset + body, sz);
    else if (id === 0x7075 && sz >= 5 && dv.getUint8(body) === 1) {
      out.unicodePath = { crc: dv.getUint32(body + 1, true), name: new Uint8Array(dv.buffer, dv.byteOffset + body + 5, sz - 5) };
    }
    p = body + sz;
  }
  return out;
}

function u64(dv: DataView, off: number): number {
  return dv.getUint32(off, true) + dv.getUint32(off + 4, true) * 4294967296;
}

export function decodeZipName(raw: Uint8Array, utf8Flag: boolean): string {
  if (isAscii(raw)) return decodeLatin1(raw);
  if (utf8Flag) return utf8.decode(raw);
  // Spec says CP437. Many tools write UTF-8 without the flag, so accept strictly valid UTF-8 first.
  const u = tryUtf8(raw);
  return u !== null ? u : decodeCp437(raw);
}

export function parseZip(data: Uint8Array, fileSize = data.length): ParsedArchive {
  const len = data.length;
  if (len < 22) throw new ArchiveError('invalid', 'File is too small to be a ZIP archive.');
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const warnings: string[] = [];
  const eocd = findEocd(dv, len);
  if (eocd === -1) throw new ArchiveError('invalid', 'Not a ZIP archive: the end-of-central-directory record was not found (the file may be truncated or corrupt).');

  let total = dv.getUint16(eocd + 10, true);
  let cdSize = dv.getUint32(eocd + 12, true);
  let cdOffset = dv.getUint32(eocd + 16, true);
  const commentLen = dv.getUint16(eocd + 20, true);
  const commentRaw = data.subarray(eocd + 22, eocd + 22 + commentLen);
  const comment = isAscii(commentRaw) ? decodeLatin1(commentRaw) : (tryUtf8(commentRaw) ?? decodeCp437(commentRaw));
  let zip64 = false;
  let cdEnd = eocd;

  if (eocd >= 20 && dv.getUint32(eocd - 20, true) === SIG_Z64_LOC && (total === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff)) {
    let rec = u64(dv, eocd - 20 + 8);
    if (rec + 56 > len || dv.getUint32(rec, true) !== SIG_Z64_EOCD) rec = eocd - 20 - 56;
    if (rec < 0 || dv.getUint32(rec, true) !== SIG_Z64_EOCD) throw new ArchiveError('invalid', 'ZIP64 end-of-central-directory record is missing or corrupt.');
    total = u64(dv, rec + 32);
    cdSize = u64(dv, rec + 40);
    cdOffset = u64(dv, rec + 48);
    cdEnd = rec;
    zip64 = true;
  }

  // Self-extracting / prefixed archives: offsets are relative to the start of the ZIP data.
  let base = 0;
  let cd = cdOffset;
  if (cd + 4 > len || dv.getUint32(cd, true) !== SIG_CEN) {
    const alt = cdEnd - cdSize;
    if (alt >= 0 && alt + 4 <= len && dv.getUint32(alt, true) === SIG_CEN) {
      base = alt - cdOffset;
      cd = alt;
    } else if (total > 0) {
      throw new ArchiveError('invalid', 'The ZIP central directory is missing or corrupt.');
    }
  }
  if (total > MAX_ENTRIES) throw new ArchiveError('limit', `Archive declares ${total.toLocaleString('en-US')} entries - more than the ${MAX_ENTRIES.toLocaleString('en-US')} supported.`);

  const entries: ArchiveEntry[] = [];
  let p = cd;
  for (let i = 0; i < total; i++) {
    if (p + 46 > len || dv.getUint32(p, true) !== SIG_CEN) {
      warnings.push(`Central directory ended early: ${entries.length} of ${total} entries could be read.`);
      break;
    }
    const madeBy = dv.getUint16(p + 4, true);
    const flags = dv.getUint16(p + 8, true);
    const method = dv.getUint16(p + 10, true);
    const mtime = dv.getUint16(p + 12, true);
    const mdate = dv.getUint16(p + 14, true);
    const crc = dv.getUint32(p + 16, true);
    let csize = dv.getUint32(p + 20, true);
    let usize = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const cmtLen = dv.getUint16(p + 32, true);
    const extAttr = dv.getUint32(p + 38, true);
    let lho = dv.getUint32(p + 42, true);
    const next = p + 46 + nameLen + extraLen + cmtLen;
    if (next > len) {
      warnings.push(`Central directory entry ${i + 1} is truncated.`);
      break;
    }
    const rawName = data.subarray(p + 46, p + 46 + nameLen);
    const extra = parseExtra(dv, p + 46 + nameLen, extraLen);
    if (extra.zip64) {
      let q = 0;
      const z = extra.zip64;
      if (usize === 0xffffffff && q + 8 <= z.byteLength) {
        usize = u64(z, q);
        q += 8;
      }
      if (csize === 0xffffffff && q + 8 <= z.byteLength) {
        csize = u64(z, q);
        q += 8;
      }
      if (lho === 0xffffffff && q + 8 <= z.byteLength) {
        lho = u64(z, q);
        q += 8;
      }
    }
    let name: string;
    if (extra.unicodePath && extra.unicodePath.crc === crc32(rawName)) name = utf8.decode(extra.unicodePath.name);
    else name = decodeZipName(rawName, (flags & 0x800) !== 0);
    const cmtRaw = data.subarray(p + 46 + nameLen + extraLen, next);
    const dosDir = (extAttr & 0x10) !== 0;
    const slashDir = name.endsWith('/') || name.endsWith('\\');
    const isDir = slashDir || (dosDir && usize === 0);
    const path = name.replace(/\\/g, '/').replace(/\/+$/, '');
    const unixMode = madeBy >> 8 === 3 ? (extAttr >>> 16) & 0xf000 : 0;
    const kind: EntryKind = isDir ? 'dir' : unixMode === 0xa000 ? 'symlink' : 'file';
    const encrypted = (flags & 1) !== 0 || method === 99 || (flags & 0x40) !== 0;
    entries.push(
      makeEntry({
        index: entries.length,
        path,
        isDir,
        kind,
        size: usize,
        csize,
        compressedSize: csize,
        method,
        methodName: METHOD_NAMES[method] ?? `Method ${method}`,
        modified: dosDate(mtime, mdate),
        crc32: crc,
        encrypted,
        comment: cmtLen ? (isAscii(cmtRaw) ? decodeLatin1(cmtRaw) : (tryUtf8(cmtRaw) ?? decodeCp437(cmtRaw))) : undefined,
        off: lho + base,
      })
    );
    p = next;
  }
  if (entries.length === 0 && total === 0) warnings.push('The archive is empty.');
  return { format: 'zip', entries, data, fileSize, comment, warnings, zip64 };
}

/* ------------------------------------------------------------------ */
/* Bounded inflate / gunzip                                            */
/* ------------------------------------------------------------------ */

const PUSH_CHUNK = 32 * 1024;

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  if (chunks.length === 1 && chunks[0]) return chunks[0];
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/** Inflate raw deflate data, never producing more than `limit` bytes (pushes small input slices so memory stays bounded). */
export function inflateBounded(src: Uint8Array, limit: number): Uint8Array {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const inf = new Inflate((chunk) => {
    total += chunk.length;
    if (total > limit) throw new ArchiveError('limit', 'The entry inflates to more data than its header declares - the archive is corrupt or is a decompression bomb.');
    chunks.push(chunk);
  });
  try {
    if (src.length === 0) inf.push(src, true);
    for (let i = 0; i < src.length; i += PUSH_CHUNK) inf.push(src.subarray(i, Math.min(i + PUSH_CHUNK, src.length)), i + PUSH_CHUNK >= src.length);
  } catch (e) {
    if (e instanceof ArchiveError) throw e;
    throw new ArchiveError('invalid', `Compressed data is corrupt (${e instanceof Error ? e.message : String(e)}).`);
  }
  return concat(chunks, total);
}

export function gunzipBounded(src: Uint8Array, limit: number): Uint8Array {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const gz = new Gunzip((chunk) => {
    total += chunk.length;
    if (total > limit) throw new ArchiveError('limit', `The decompressed data is larger than ${Math.round(limit / 1048576)} MB - refusing to inflate it in the browser.`);
    chunks.push(chunk);
  });
  try {
    for (let i = 0; i < src.length; i += PUSH_CHUNK) gz.push(src.subarray(i, Math.min(i + PUSH_CHUNK, src.length)), i + PUSH_CHUNK >= src.length);
  } catch (e) {
    if (e instanceof ArchiveError) throw e;
    throw new ArchiveError('invalid', `Compressed data is corrupt (${e instanceof Error ? e.message : String(e)}).`);
  }
  return concat(chunks, total);
}

export interface ExtractResult {
  data: Uint8Array;
  /** null when the format carries no checksum. */
  crcOk: boolean | null;
}

function zipDataRange(arc: ParsedArchive, e: ArchiveEntry): [number, number] {
  const d = arc.data;
  const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
  const lo = e.off;
  if (lo + 30 > d.length || dv.getUint32(lo, true) !== SIG_LOC) throw new ArchiveError('invalid', `Local header for "${e.path}" is missing or corrupt.`);
  const start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
  const end = start + e.csize;
  if (end > d.length) throw new ArchiveError('invalid', `Data for "${e.path}" is truncated.`);
  return [start, end];
}

/** Read and (if needed) inflate one entry. Throws ArchiveError for encrypted / unsupported / oversized entries. */
export function extractEntry(arc: ParsedArchive, e: ArchiveEntry): ExtractResult {
  if (e.isDir) return { data: new Uint8Array(0), crcOk: null };
  if (arc.format === 'tar' || arc.format === 'tgz') {
    if (e.kind === 'symlink' || e.kind === 'hardlink' || e.kind === 'other') return { data: new Uint8Array(0), crcOk: null };
    return { data: arc.data.subarray(e.off, e.off + e.size), crcOk: null };
  }
  if (arc.format === 'gz') {
    return { data: arc.data, crcOk: e.crc32 === null ? null : crc32(arc.data) === e.crc32 };
  }
  // zip
  if (e.encrypted) throw new ArchiveError('encrypted', `"${e.path}" is password-protected (ZipCrypto / AES). Password-protected entries aren't supported.`);
  if (e.size > MAX_ENTRY_BYTES) {
    throw new ArchiveError('limit', `"${e.path}" declares ${(e.size / 1048576).toFixed(0)} MB uncompressed - refusing to inflate entries larger than ${MAX_ENTRY_BYTES / 1048576} MB.`);
  }
  const [start, end] = zipDataRange(arc, e);
  const raw = arc.data.subarray(start, end);
  let out: Uint8Array;
  if (e.method === 0) out = raw;
  else if (e.method === 8) out = inflateBounded(raw, Math.max(e.size, 0));
  else throw new ArchiveError('unsupported', `"${e.path}" uses compression method ${e.method} (${e.methodName}); only Stored and Deflate are supported.`);
  if (out.length !== e.size) {
    throw new ArchiveError('invalid', `"${e.path}": expected ${e.size} bytes but got ${out.length} - the entry is corrupt.`);
  }
  return { data: out, crcOk: e.crc32 === null ? null : crc32(out) === e.crc32 };
}

/* ------------------------------------------------------------------ */
/* TAR                                                                 */
/* ------------------------------------------------------------------ */

function parsePax(buf: Uint8Array): Record<string, string> {
  const out: Record<string, string> = {};
  let p = 0;
  while (p < buf.length) {
    let sp = p;
    while (sp < buf.length && buf[sp] !== 0x20) sp++;
    const lenStr = decodeLatin1(buf.subarray(p, sp));
    const recLen = parseInt(lenStr, 10);
    if (!Number.isFinite(recLen) || recLen <= 0 || p + recLen > buf.length) break;
    const rec = buf.subarray(sp + 1, p + recLen - 1); // drop trailing \n
    const eq = rec.indexOf(0x3d);
    if (eq > 0) {
      const key = utf8.decode(rec.subarray(0, eq));
      out[key] = utf8.decode(rec.subarray(eq + 1));
    }
    p += recLen;
  }
  return out;
}

function tarString(b: Uint8Array): string {
  return tryUtf8(b) ?? decodeLatin1(b);
}

export function parseTar(data: Uint8Array, fileSize = data.length, format: ArchiveFormat = 'tar'): ParsedArchive {
  const warnings: string[] = [];
  const entries: ArchiveEntry[] = [];
  let pos = 0;
  let longName: string | null = null;
  let longLink: string | null = null;
  let pax: Record<string, string> | null = null;
  let globalComment = '';
  const isZeroBlock = (o: number): boolean => {
    for (let i = 0; i < 512; i++) if (data[o + i] !== 0) return false;
    return true;
  };
  while (pos + 512 <= data.length) {
    if (isZeroBlock(pos)) break;
    const h = data.subarray(pos, pos + 512);
    if (!tarChecksumOk(h)) {
      if (entries.length === 0) throw new ArchiveError('invalid', 'Not a valid TAR archive (header checksum mismatch).');
      warnings.push(`Stopped at offset ${pos}: invalid TAR header checksum (archive truncated or corrupt).`);
      break;
    }
    const type = String.fromCharCode(h[156] ?? 0);
    let size = parseOctal(h, 124, 12) ?? 0;
    const dataOff = pos + 512;
    const advance = (n: number) => dataOff + Math.ceil(n / 512) * 512;

    if (type === 'L' || type === 'K') {
      const s = tarString(cstring(data, dataOff, size));
      if (type === 'L') longName = s;
      else longLink = s;
      pos = advance(size);
      continue;
    }
    if (type === 'x') {
      pax = { ...(pax ?? {}), ...parsePax(data.subarray(dataOff, dataOff + size)) };
      pos = advance(size);
      continue;
    }
    if (type === 'g') {
      const g = parsePax(data.subarray(dataOff, dataOff + size));
      if (g.comment) globalComment = g.comment;
      pos = advance(size);
      continue;
    }

    let name = tarString(cstring(h, 0, 100));
    const magic = decodeLatin1(h.subarray(257, 263));
    if (magic === 'ustar\u0000') {
      const prefix = tarString(cstring(h, 345, 155));
      if (prefix) name = `${prefix}/${name}`;
    }
    if (longName !== null) name = longName;
    if (pax?.path) name = pax.path;
    let linkName = tarString(cstring(h, 157, 100));
    if (longLink !== null) linkName = longLink;
    if (pax?.linkpath) linkName = pax.linkpath;
    if (pax?.size) {
      const ps = Number(pax.size);
      if (Number.isFinite(ps)) size = ps;
    }
    let mtimeSec = parseOctal(h, 136, 12);
    if (pax?.mtime) {
      const pm = Number(pax.mtime);
      if (Number.isFinite(pm)) mtimeSec = pm;
    }
    longName = null;
    longLink = null;
    pax = null;

    const isDir = type === '5' || (name.endsWith('/') && type !== '2' && type !== '1');
    const kind: EntryKind = isDir ? 'dir' : type === '2' ? 'symlink' : type === '1' ? 'hardlink' : type === '0' || type === '\u0000' || type === '7' ? 'file' : 'other';
    const carriesData = kind === 'file';
    let storedSize = carriesData ? size : 0;
    if (carriesData && dataOff + storedSize > data.length) {
      warnings.push(`"${name}" is truncated in the archive (expected ${size} bytes, ${Math.max(0, data.length - dataOff)} available).`);
      storedSize = Math.max(0, data.length - dataOff);
    }
    const path = name.replace(/\\/g, '/').replace(/^(\.\/)+/, '').replace(/\/+$/, '');
    if (path === '.' || path === '') {
      pos = advance(carriesData ? size : 0);
      continue;
    }
    entries.push(
      makeEntry({
        index: entries.length,
        path,
        isDir,
        kind,
        size: kind === 'file' ? storedSize : 0,
        csize: storedSize,
        compressedSize: null,
        method: null,
        methodName: 'tar',
        modified: mtimeSec !== null && mtimeSec > 0 ? new Date(mtimeSec * 1000) : null,
        off: dataOff,
        linkTarget: kind === 'symlink' || kind === 'hardlink' ? linkName : undefined,
      })
    );
    pos = advance(carriesData ? size : 0);
    if (entries.length > MAX_ENTRIES) throw new ArchiveError('limit', 'Too many entries in the archive.');
  }
  if (entries.length === 0) warnings.push('The archive is empty.');
  return { format, entries, data, fileSize, comment: globalComment, warnings };
}

/* ------------------------------------------------------------------ */
/* GZIP                                                                */
/* ------------------------------------------------------------------ */

export interface GzipHeader {
  name: string | null;
  mtime: Date | null;
  comment: string | null;
  headerLen: number;
}

export function parseGzipHeader(d: Uint8Array): GzipHeader {
  if (d.length < 18 || d[0] !== 0x1f || d[1] !== 0x8b) throw new ArchiveError('invalid', 'Not a GZIP file.');
  if (d[2] !== 8) throw new ArchiveError('invalid', 'Unsupported GZIP compression method.');
  const flg = d[3] ?? 0;
  const mt = (d[4] ?? 0) | ((d[5] ?? 0) << 8) | ((d[6] ?? 0) << 16) | ((d[7] ?? 0) << 24);
  let p = 10;
  if (flg & 4) p += 2 + ((d[p] ?? 0) | ((d[p + 1] ?? 0) << 8));
  let name: string | null = null;
  let comment: string | null = null;
  if (flg & 8) {
    const end = d.indexOf(0, p);
    if (end === -1) throw new ArchiveError('invalid', 'GZIP header is truncated.');
    name = tarString(d.subarray(p, end));
    p = end + 1;
  }
  if (flg & 16) {
    const end = d.indexOf(0, p);
    if (end === -1) throw new ArchiveError('invalid', 'GZIP header is truncated.');
    comment = tarString(d.subarray(p, end));
    p = end + 1;
  }
  if (flg & 2) p += 2;
  return { name, mtime: mt > 0 ? new Date((mt >>> 0) * 1000) : null, comment, headerLen: p };
}

export function parseGzipArchive(d: Uint8Array, fileName?: string): ParsedArchive {
  const hdr = parseGzipHeader(d);
  const payload = gunzipBounded(d, MAX_GUNZIP_BYTES);
  if (looksLikeTar(payload)) {
    const arc = parseTar(payload, d.length, 'tgz');
    return arc;
  }
  const fallback = (fileName ?? 'file').replace(/\.(gz|gzip|z)$/i, '') || 'file';
  const name = hdr.name && hdr.name !== '' ? hdr.name : fallback;
  const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
  const crc = dv.getUint32(d.length - 8, true);
  const entry = makeEntry({
    index: 0,
    path: name.replace(/\\/g, '/'),
    size: payload.length,
    csize: d.length,
    compressedSize: d.length,
    method: 8,
    methodName: 'Deflate (gzip)',
    modified: hdr.mtime,
    crc32: crc,
    off: 0,
    comment: hdr.comment ?? undefined,
  });
  const warnings: string[] = [];
  if (hdr.name === null) warnings.push('The gzip header has no stored file name; using the uploaded file name without ".gz".');
  return { format: 'gz', entries: [entry], data: payload, fileSize: d.length, comment: hdr.comment ?? '', warnings };
}

/* ------------------------------------------------------------------ */
/* Top level                                                           */
/* ------------------------------------------------------------------ */

export function parseArchive(data: Uint8Array, fileName?: string): ParsedArchive {
  if (data.length === 0) throw new ArchiveError('invalid', 'The file is empty.');
  const fmt = detectArchiveFormat(data);
  const um = UNSUPPORTED_MSG[fmt];
  if (um) throw new ArchiveError('unsupported', um);
  switch (fmt) {
    case 'zip':
      return parseZip(data);
    case 'gzip':
      return parseGzipArchive(data, fileName);
    case 'tar':
      return parseTar(data);
    default: {
      // self-extracting archives and ZIPs with leading data
      try {
        return parseZip(data);
      } catch {
        throw new ArchiveError('unsupported', 'Unrecognised file: expected a ZIP (also JAR, APK, DOCX, XLSX, EPUB…), TAR, TAR.GZ / TGZ or GZ file.');
      }
    }
  }
}

export interface ArchiveSummary {
  files: number;
  dirs: number;
  other: number;
  totalSize: number;
  totalCompressed: number | null;
  encrypted: number;
  unsafe: number;
  suspicious: number;
  ratio: number | null;
}

export function summarize(arc: ParsedArchive): ArchiveSummary {
  let files = 0;
  let dirs = 0;
  let other = 0;
  let total = 0;
  let comp = 0;
  let encrypted = 0;
  let unsafe = 0;
  let suspicious = 0;
  let hasComp = false;
  const dirSet = new Set<string>();
  for (const e of arc.entries) {
    if (e.isDir) dirSet.add(e.path);
    else if (e.kind === 'file') files++;
    else other++;
    // folders that only exist implicitly (no explicit directory entry) still count
    let slash = e.path.lastIndexOf('/');
    while (slash > 0) {
      const d = e.path.slice(0, slash);
      if (dirSet.has(d)) break;
      dirSet.add(d);
      slash = d.lastIndexOf('/');
    }
    total += e.size;
    if (e.compressedSize !== null) {
      comp += e.compressedSize;
      hasComp = true;
    }
    if (e.encrypted) encrypted++;
    if (e.unsafe) unsafe++;
    if (e.suspicious) suspicious++;
  }
  dirs = dirSet.size;
  const totalCompressed = arc.format === 'zip' && hasComp ? comp : arc.format === 'tgz' || arc.format === 'gz' ? arc.fileSize : null;
  return {
    files,
    dirs,
    other,
    totalSize: total,
    totalCompressed,
    encrypted,
    unsafe,
    suspicious,
    ratio: totalCompressed && totalCompressed > 0 ? total / totalCompressed : null,
  };
}

/* ------------------------------------------------------------------ */
/* Tree + filter                                                       */
/* ------------------------------------------------------------------ */

export interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  entry: ArchiveEntry | null;
  children: TreeNode[];
  /** Aggregated uncompressed size of all files below (or the file's size). */
  size: number;
  files: number;
}

export function buildTree(entries: ArchiveEntry[]): TreeNode {
  const root: TreeNode = { name: '', path: '', isDir: true, entry: null, children: [], size: 0, files: 0 };
  const index = new Map<string, TreeNode>();
  index.set('', root);
  const ensureDir = (path: string): TreeNode => {
    const hit = index.get(path);
    if (hit) return hit;
    const slash = path.lastIndexOf('/');
    const parent = ensureDir(slash === -1 ? '' : path.slice(0, slash));
    const node: TreeNode = { name: slash === -1 ? path : path.slice(slash + 1), path, isDir: true, entry: null, children: [], size: 0, files: 0 };
    parent.children.push(node);
    index.set(path, node);
    return node;
  };
  for (const e of entries) {
    const clean = e.path.replace(/^\/+/, '');
    if (clean === '') continue;
    if (e.isDir) {
      const d = ensureDir(clean);
      if (!d.entry) d.entry = e;
      continue;
    }
    const slash = clean.lastIndexOf('/');
    const parent = ensureDir(slash === -1 ? '' : clean.slice(0, slash));
    parent.children.push({ name: slash === -1 ? clean : clean.slice(slash + 1), path: clean, isDir: false, entry: e, children: [], size: e.size, files: 1 });
  }
  const finish = (n: TreeNode): void => {
    if (!n.isDir) return;
    n.children.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }) : a.isDir ? -1 : 1));
    let size = 0;
    let files = 0;
    for (const c of n.children) {
      finish(c);
      size += c.size;
      files += c.files;
    }
    n.size = size;
    n.files = files;
  };
  finish(root);
  return root;
}

export interface TreeRow {
  node: TreeNode;
  depth: number;
}

/** Flatten the tree into visible rows. With a filter, only matches and their ancestors are shown (all expanded). */
export function flattenTree(root: TreeNode, expanded: ReadonlySet<string>, filter: string): TreeRow[] {
  const q = filter.trim().toLowerCase();
  const out: TreeRow[] = [];
  const matches = (n: TreeNode): boolean => {
    if (n.path.toLowerCase().includes(q)) return true;
    return n.isDir && n.children.some(matches);
  };
  const walk = (n: TreeNode, depth: number): void => {
    for (const c of n.children) {
      if (q && !matches(c)) continue;
      out.push({ node: c, depth });
      if (c.isDir && (q !== '' || expanded.has(c.path))) walk(c, depth + 1);
    }
  };
  walk(root, 0);
  return out;
}

/* ------------------------------------------------------------------ */
/* Preview helpers                                                     */
/* ------------------------------------------------------------------ */

const IMAGE_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpe: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
  avif: 'image/avif',
};

export function imageMime(path: string): string | null {
  const m = /\.([a-z0-9]+)$/i.exec(path);
  return m ? (IMAGE_EXT[(m[1] ?? '').toLowerCase()] ?? null) : null;
}

export interface TextPreview {
  kind: 'text';
  text: string;
  truncated: boolean;
}
export interface BinaryPreview {
  kind: 'binary';
}

/** Decide whether bytes look like UTF-8 text and return the first 64 KB. */
export function previewText(data: Uint8Array): TextPreview | BinaryPreview {
  const head = data.subarray(0, TEXT_PREVIEW_BYTES);
  if (head.length === 0) return { kind: 'text', text: '', truncated: false };
  let control = 0;
  for (let i = 0; i < head.length; i++) {
    const b = head[i] ?? 0;
    if (b === 0) return { kind: 'binary' };
    if (b < 9 || (b > 13 && b < 32)) control++;
  }
  if (control / head.length > 0.02) return { kind: 'binary' };
  // a truncated multi-byte sequence at the cut is fine; strict decode on a trimmed copy
  let end = head.length;
  if (data.length > head.length) while (end > 0 && ((head[end - 1] ?? 0) & 0xc0) === 0x80) end--;
  if (data.length > head.length && end > 0 && ((head[end - 1] ?? 0) & 0x80) !== 0) end--;
  const strict = tryUtf8(head.subarray(0, end));
  if (strict === null) {
    // not valid UTF-8: only call it text if mostly printable Latin-1
    return { kind: 'text', text: utf8.decode(head), truncated: data.length > head.length };
  }
  return { kind: 'text', text: strict, truncated: data.length > head.length };
}

/** Classic hex dump of the first `n` bytes (offset, hex, ascii). */
export function hexDump(data: Uint8Array, n = 256): string {
  const lines: string[] = [];
  const lim = Math.min(n, data.length);
  for (let o = 0; o < lim; o += 16) {
    const row = data.subarray(o, Math.min(o + 16, lim));
    const hex = Array.from(row, (b) => b.toString(16).padStart(2, '0')).join(' ').padEnd(47, ' ');
    const asc = Array.from(row, (b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');
    lines.push(`${o.toString(16).padStart(8, '0')}  ${hex}  ${asc}`);
  }
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Creating ZIP archives                                               */
/* ------------------------------------------------------------------ */

export type ZipLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface NewZipFile {
  path: string;
  data: Uint8Array;
  mtime: number;
  /** Add as an (empty) directory entry. */
  dir?: boolean;
}

const ALREADY_COMPRESSED = new Set([
  'zip', 'gz', 'tgz', 'bz2', 'xz', 'zst', '7z', 'rar', 'jar', 'war', 'apk', 'docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp', 'epub',
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic', 'mp3', 'aac', 'ogg', 'opus', 'flac', 'm4a', 'mp4', 'm4v', 'mov', 'mkv', 'webm', 'avi', 'woff2', 'pdf',
]);

export function isAlreadyCompressed(path: string): boolean {
  const m = /\.([a-z0-9]+)$/i.exec(path);
  return m ? ALREADY_COMPRESSED.has((m[1] ?? '').toLowerCase()) : false;
}

/** Normalise a user-visible entry name: forward slashes, no leading "/" or "./", no ".." segments. */
export function normalizeEntryPath(p: string): string {
  return safePath(p.trim());
}

/** Make names unique by appending " (n)" before the extension. */
export function dedupePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  return paths.map((p) => {
    let out = p;
    let n = 1;
    while (seen.has(out.toLowerCase())) {
      const slash = out.lastIndexOf('/');
      const dot = p.lastIndexOf('.');
      const hasExt = dot > slash + 1;
      out = hasExt ? `${p.slice(0, dot)} (${n})${p.slice(dot)}` : `${p} (${n})`;
      n++;
    }
    seen.add(out.toLowerCase());
    return out;
  });
}

const MIN_MTIME = Date.UTC(1980, 0, 1);
const MAX_MTIME = Date.UTC(2099, 11, 31);

export function prepareZip(files: NewZipFile[], level: ZipLevel, storeCompressed: boolean): Zippable {
  const names = dedupePaths(files.map((f) => normalizeEntryPath(f.path) || (f.dir ? 'folder' : 'file')));
  const z: Zippable = {};
  files.forEach((f, i) => {
    const name = names[i] ?? `file${i}`;
    const lvl: ZipLevel = f.dir || (storeCompressed && isAlreadyCompressed(name)) ? 0 : level;
    const mt = Math.min(MAX_MTIME, Math.max(MIN_MTIME + 86_400_000, Number.isFinite(f.mtime) ? f.mtime : Date.now()));
    z[f.dir ? `${name}/` : name] = [f.dir ? new Uint8Array(0) : f.data, { level: lvl, mtime: mt }];
  });
  return z;
}

export function buildZipSync(files: NewZipFile[], level: ZipLevel, storeCompressed = true): Uint8Array {
  return zipSync(prepareZip(files, level, storeCompressed), { level });
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

function p2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatDate(d: Date | null): string {
  if (!d) return '';
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

export function formatRatio(e: { ratio: number | null }): string {
  if (e.ratio === null) return '';
  if (e.ratio >= 100) return `${Math.round(e.ratio)}:1`;
  return `${e.ratio.toFixed(1)}:1`;
}

export function crcHex(n: number | null): string {
  return n === null ? '' : n.toString(16).padStart(8, '0');
}

export function formatFormat(f: ArchiveFormat): string {
  switch (f) {
    case 'zip':
      return 'ZIP';
    case 'tar':
      return 'TAR';
    case 'tgz':
      return 'TAR.GZ';
    case 'gz':
      return 'GZIP';
  }
}
