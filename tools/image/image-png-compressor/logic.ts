/**
 * PNG decoding, palette quantisation and optimal PNG writing.
 * Pure TypeScript (only depends on fflate) so it can be unit-tested outside the browser.
 */
import { Unzlib, Zlib, unzlibSync, zlibSync } from 'fflate';

export const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
export const MAX_PIXELS = 40_000_000;

export interface Hooks {
  onProgress?: (fraction: number) => void;
  shouldCancel?: () => boolean;
}

export class CancelledError extends Error {
  constructor() {
    super('Cancelled');
    this.name = 'CancelledError';
  }
}

export interface PngChunk {
  type: string;
  data: Uint8Array;
}

const nowMs = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function makeYielder(h?: Hooks): () => Promise<void> {
  let last = nowMs();
  return async () => {
    if (h?.shouldCancel?.()) throw new CancelledError();
    if (nowMs() - last > 12) {
      await new Promise<void>((r) => setTimeout(r, 0));
      last = nowMs();
      if (h?.shouldCancel?.()) throw new CancelledError();
    }
  };
}

function subHooks(h: Hooks | undefined, from: number, to: number): Hooks {
  return {
    shouldCancel: h?.shouldCancel,
    onProgress: (f) => h?.onProgress?.(from + (to - from) * Math.min(1, Math.max(0, f))),
  };
}

// ---------------------------------------------------------------------------------------------
// CRC32 + chunk helpers
// ---------------------------------------------------------------------------------------------

const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** Standard CRC-32 (IEEE 802.3), as used by PNG chunks. */
export function crc32(data: Uint8Array, start = 0, end: number = data.length): number {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i) & 0xff;
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out, 4, 8 + data.length));
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
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

export function isPng(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  for (let i = 0; i < 8; i++) if (bytes[i] !== PNG_SIGNATURE[i]) return false;
  return true;
}

export function readChunks(bytes: Uint8Array): PngChunk[] {
  if (!isPng(bytes)) throw new Error('Not a PNG file (bad signature).');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: PngChunk[] = [];
  let p = 8;
  while (p + 8 <= bytes.length) {
    const len = dv.getUint32(p);
    const type = String.fromCharCode(bytes[p + 4]!, bytes[p + 5]!, bytes[p + 6]!, bytes[p + 7]!);
    if (p + 12 + len > bytes.length) throw new Error('PNG file is truncated or corrupt.');
    out.push({ type, data: bytes.subarray(p + 8, p + 8 + len) });
    p += 12 + len;
    if (type === 'IEND') break;
  }
  if (!out.some((c) => c.type === 'IEND')) throw new Error('PNG file is truncated (no IEND chunk).');
  return out;
}

// ---------------------------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------------------------

export function channelsFor(colorType: number): number {
  switch (colorType) {
    case 0:
      return 1;
    case 2:
      return 3;
    case 3:
      return 1;
    case 4:
      return 2;
    case 6:
      return 4;
    default:
      throw new Error(`Unsupported PNG colour type ${colorType}.`);
  }
}

export function rowBytesFor(width: number, colorType: number, bitDepth: number): number {
  return Math.ceil((width * channelsFor(colorType) * bitDepth) / 8);
}

function bppFor(colorType: number, bitDepth: number): number {
  return Math.max(1, Math.ceil((channelsFor(colorType) * bitDepth) / 8));
}

export function describeFormat(colorType: number, bitDepth: number, paletteSize = 0): string {
  switch (colorType) {
    case 0:
      return `${bitDepth}-bit greyscale`;
    case 2:
      return `${bitDepth * 3}-bit RGB`;
    case 3:
      return `PNG-${bitDepth} palette${paletteSize ? ` (${paletteSize} colours)` : ''}`;
    case 4:
      return `${bitDepth}-bit greyscale + alpha`;
    case 6:
      return `${bitDepth * 4}-bit RGBA`;
    default:
      return 'unknown';
  }
}

export interface PngHeader {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  interlaced: boolean;
  animated: boolean;
}

export function readPngHeader(bytes: Uint8Array): PngHeader {
  if (!isPng(bytes)) throw new Error('Not a PNG file (bad signature).');
  if (bytes.length < 33) throw new Error('PNG file is truncated.');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(12) !== 0x49484452) throw new Error('PNG is missing its IHDR chunk.');
  const width = dv.getUint32(16);
  const height = dv.getUint32(20);
  let animated = false;
  // cheap scan for acTL before the first IDAT
  let p = 8;
  while (p + 8 <= bytes.length) {
    const len = dv.getUint32(p);
    const type = String.fromCharCode(bytes[p + 4]!, bytes[p + 5]!, bytes[p + 6]!, bytes[p + 7]!);
    if (type === 'acTL') animated = true;
    if (type === 'IDAT' || type === 'IEND') break;
    p += 12 + len;
  }
  return {
    width,
    height,
    bitDepth: bytes[24]!,
    colorType: bytes[25]!,
    interlaced: bytes[28] === 1,
    animated,
  };
}

// ---------------------------------------------------------------------------------------------
// Decoder
// ---------------------------------------------------------------------------------------------

export interface DecodedPng {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  interlaced: boolean;
  rowBytes: number;
  /** Unfiltered, de-interlaced scanlines (no filter bytes), height * rowBytes. */
  rows: Uint8Array;
  palette: Uint8Array | null;
  trns: Uint8Array | null;
  /** iCCP / sRGB / gAMA / cHRM / cICP chunks (colour-space information). */
  colorChunks: PngChunk[];
  animated: boolean;
}

const COLOR_CHUNKS = ['iCCP', 'sRGB', 'gAMA', 'cHRM', 'cICP'];

function unfilter(
  src: Uint8Array,
  srcPos: number,
  rowBytes: number,
  h: number,
  bpp: number,
  dst: Uint8Array,
  dstPos: number,
  yStart = 0,
  yEnd: number = h
): void {
  const stride = rowBytes + 1;
  for (let y = yStart; y < yEnd; y++) {
    const ft = src[srcPos + y * stride]!;
    const s = srcPos + y * stride + 1;
    const d = dstPos + y * rowBytes;
    const pv = d - rowBytes;
    const hasPrev = y > 0;
    switch (ft) {
      case 0:
        for (let i = 0; i < rowBytes; i++) dst[d + i] = src[s + i]!;
        break;
      case 1:
        for (let i = 0; i < rowBytes; i++) {
          const a = i >= bpp ? dst[d + i - bpp]! : 0;
          dst[d + i] = (src[s + i]! + a) & 255;
        }
        break;
      case 2:
        for (let i = 0; i < rowBytes; i++) {
          const b = hasPrev ? dst[pv + i]! : 0;
          dst[d + i] = (src[s + i]! + b) & 255;
        }
        break;
      case 3:
        for (let i = 0; i < rowBytes; i++) {
          const a = i >= bpp ? dst[d + i - bpp]! : 0;
          const b = hasPrev ? dst[pv + i]! : 0;
          dst[d + i] = (src[s + i]! + ((a + b) >> 1)) & 255;
        }
        break;
      case 4:
        for (let i = 0; i < rowBytes; i++) {
          const a = i >= bpp ? dst[d + i - bpp]! : 0;
          const b = hasPrev ? dst[pv + i]! : 0;
          const c = hasPrev && i >= bpp ? dst[pv + i - bpp]! : 0;
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          dst[d + i] = (src[s + i]! + pr) & 255;
        }
        break;
      default:
        throw new Error('PNG data is corrupt (invalid filter type).');
    }
  }
}

const ADAM7: number[][] = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
];

interface PngInfo {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  interlaced: boolean;
  rowBytes: number;
  bpp: number;
  palette: Uint8Array | null;
  trns: Uint8Array | null;
  colorChunks: PngChunk[];
  animated: boolean;
  idat: Uint8Array[];
}

function parseInfo(bytes: Uint8Array): PngInfo {
  const chunks = readChunks(bytes);
  const ihdr = chunks[0];
  if (!ihdr || ihdr.type !== 'IHDR' || ihdr.data.length < 13) throw new Error('PNG is missing its IHDR chunk.');
  const dv = new DataView(ihdr.data.buffer, ihdr.data.byteOffset, ihdr.data.byteLength);
  const width = dv.getUint32(0);
  const height = dv.getUint32(4);
  const bitDepth = ihdr.data[8]!;
  const colorType = ihdr.data[9]!;
  const interlaced = ihdr.data[12] === 1;
  if (width < 1 || height < 1) throw new Error('PNG has invalid dimensions.');
  if (width * height > MAX_PIXELS) {
    throw new Error(`Image is ${((width * height) / 1e6).toFixed(1)} megapixels — the limit is ${MAX_PIXELS / 1e6} MP.`);
  }
  channelsFor(colorType);
  if (![1, 2, 4, 8, 16].includes(bitDepth)) throw new Error(`Unsupported PNG bit depth ${bitDepth}.`);
  let palette: Uint8Array | null = null;
  let trns: Uint8Array | null = null;
  let animated = false;
  const colorChunks: PngChunk[] = [];
  const idat: Uint8Array[] = [];
  for (const c of chunks) {
    if (c.type === 'PLTE') palette = c.data;
    else if (c.type === 'tRNS') trns = c.data;
    else if (c.type === 'IDAT') idat.push(c.data);
    else if (c.type === 'acTL') animated = true;
    else if (COLOR_CHUNKS.includes(c.type)) colorChunks.push(c);
  }
  if (idat.length === 0) throw new Error('PNG has no image data.');
  if (colorType === 3 && !palette) throw new Error('Palette PNG is missing its PLTE chunk.');
  return {
    width,
    height,
    bitDepth,
    colorType,
    interlaced,
    rowBytes: rowBytesFor(width, colorType, bitDepth),
    bpp: bppFor(colorType, bitDepth),
    palette,
    trns,
    colorChunks,
    animated,
    idat,
  };
}

function deinterlace(inflated: Uint8Array, info: PngInfo, rows: Uint8Array): void {
  const { width, height, bitDepth, colorType, rowBytes, bpp } = info;
  const bitsPerPixel = channelsFor(colorType) * bitDepth;
  let pos = 0;
  for (const [xs, ys, dx, dy] of ADAM7 as [number, number, number, number][]) {
    const pw = width > xs ? Math.ceil((width - xs) / dx) : 0;
    const ph = height > ys ? Math.ceil((height - ys) / dy) : 0;
    if (pw === 0 || ph === 0) continue;
    const prb = Math.ceil((pw * bitsPerPixel) / 8);
    if (inflated.length < pos + (prb + 1) * ph) throw new Error('PNG image data is truncated.');
    const tmp = new Uint8Array(prb * ph);
    unfilter(inflated, pos, prb, ph, bpp, tmp, 0);
    pos += (prb + 1) * ph;
    for (let py = 0; py < ph; py++) {
      const y = ys + py * dy;
      for (let px = 0; px < pw; px++) {
        const x = xs + px * dx;
        if (bitsPerPixel >= 8) {
          const nb = bitsPerPixel >> 3;
          const so = py * prb + px * nb;
          const dO = y * rowBytes + x * nb;
          for (let k = 0; k < nb; k++) rows[dO + k] = tmp[so + k]!;
        } else {
          const sbit = px * bitsPerPixel;
          const sb = tmp[py * prb + (sbit >> 3)]!;
          const mask = (1 << bitsPerPixel) - 1;
          const val = (sb >> (8 - bitsPerPixel - (sbit & 7))) & mask;
          const dbit = x * bitsPerPixel;
          const di = y * rowBytes + (dbit >> 3);
          rows[di] = rows[di]! | (val << (8 - bitsPerPixel - (dbit & 7)));
        }
      }
    }
  }
}

function toDecoded(info: PngInfo, rows: Uint8Array): DecodedPng {
  return {
    width: info.width,
    height: info.height,
    bitDepth: info.bitDepth,
    colorType: info.colorType,
    interlaced: info.interlaced,
    rowBytes: info.rowBytes,
    rows,
    palette: info.palette,
    trns: info.trns,
    colorChunks: info.colorChunks,
    animated: info.animated,
  };
}

export function decodePng(bytes: Uint8Array): DecodedPng {
  const info = parseInfo(bytes);
  let inflated: Uint8Array;
  try {
    inflated = unzlibSync(concat(info.idat));
  } catch {
    throw new Error('PNG image data is corrupt (could not decompress).');
  }
  const rows = new Uint8Array(info.rowBytes * info.height);
  if (!info.interlaced) {
    if (inflated.length < (info.rowBytes + 1) * info.height) throw new Error('PNG image data is truncated.');
    unfilter(inflated, 0, info.rowBytes, info.height, info.bpp, rows, 0);
  } else {
    deinterlace(inflated, info, rows);
  }
  return toDecoded(info, rows);
}

/** Streaming inflate in slices so that large images do not freeze the page. */
async function inflateChunked(parts: Uint8Array[], hooks?: Hooks): Promise<Uint8Array> {
  const out: Uint8Array[] = [];
  const z = new Unzlib();
  z.ondata = (chunk) => {
    out.push(chunk);
  };
  const yieldNow = makeYielder(hooks);
  const total = parts.reduce((n, p) => n + p.length, 0);
  let done = 0;
  const SLICE = 192 * 1024;
  let pushedFinal = false;
  try {
    for (let pi = 0; pi < parts.length; pi++) {
      const p = parts[pi]!;
      for (let off = 0; off < p.length; off += SLICE) {
        const end = Math.min(p.length, off + SLICE);
        const last = pi === parts.length - 1 && end >= p.length;
        z.push(p.subarray(off, end), last);
        if (last) pushedFinal = true;
        done += end - off;
        hooks?.onProgress?.(total ? done / total : 1);
        await yieldNow();
      }
    }
    if (!pushedFinal) z.push(new Uint8Array(0), true);
  } catch (e) {
    if (e instanceof CancelledError) throw e;
    throw new Error('PNG image data is corrupt (could not decompress).');
  }
  return concat(out);
}

/** Same result as decodePng, but cooperative: yields to the UI between slices and honours cancellation. */
export async function decodePngAsync(bytes: Uint8Array, hooks?: Hooks): Promise<DecodedPng> {
  const info = parseInfo(bytes);
  const inflated = await inflateChunked(info.idat, subHooks(hooks, 0, 0.5));
  const rows = new Uint8Array(info.rowBytes * info.height);
  if (!info.interlaced) {
    if (inflated.length < (info.rowBytes + 1) * info.height) throw new Error('PNG image data is truncated.');
    const yieldNow = makeYielder(hooks);
    const block = Math.max(1, Math.floor(600_000 / (info.rowBytes + 1)));
    for (let y = 0; y < info.height; y += block) {
      const y1 = Math.min(info.height, y + block);
      unfilter(inflated, 0, info.rowBytes, info.height, info.bpp, rows, 0, y, y1);
      hooks?.onProgress?.(0.5 + 0.5 * (y1 / info.height));
      await yieldNow();
    }
  } else {
    deinterlace(inflated, info, rows);
  }
  return toDecoded(info, rows);
}

/** Expand rows [y0, y1) of a decoded PNG into 8-bit non-premultiplied RGBA (`out` holds the whole image). */
function expandRows(d: DecodedPng, out: Uint8Array, y0: number, y1: number): void {
  const { width: w, colorType: ct, bitDepth: bd, rows, rowBytes, palette, trns } = d;
  if (bd === 8) {
    if (ct === 6) {
      for (let y = y0; y < y1; y++) out.set(rows.subarray(y * rowBytes, y * rowBytes + w * 4), y * w * 4);
      return;
    }
    let keyR = -1;
    let keyG = -1;
    let keyB = -1;
    if (trns && ct === 0 && trns.length >= 2) keyR = (trns[0]! << 8) | trns[1]!;
    if (trns && ct === 2 && trns.length >= 6) {
      keyR = (trns[0]! << 8) | trns[1]!;
      keyG = (trns[2]! << 8) | trns[3]!;
      keyB = (trns[4]! << 8) | trns[5]!;
    }
    for (let y = y0; y < y1; y++) {
      let s = y * rowBytes;
      let o = y * w * 4;
      for (let x = 0; x < w; x++, o += 4) {
        switch (ct) {
          case 0: {
            const v = rows[s++]!;
            out[o] = out[o + 1] = out[o + 2] = v;
            out[o + 3] = v === keyR ? 0 : 255;
            break;
          }
          case 2: {
            const r = rows[s++]!;
            const g = rows[s++]!;
            const b = rows[s++]!;
            out[o] = r;
            out[o + 1] = g;
            out[o + 2] = b;
            out[o + 3] = r === keyR && g === keyG && b === keyB ? 0 : 255;
            break;
          }
          case 3: {
            const i = rows[s++]!;
            const pi = i * 3;
            out[o] = palette![pi] ?? 0;
            out[o + 1] = palette![pi + 1] ?? 0;
            out[o + 2] = palette![pi + 2] ?? 0;
            out[o + 3] = trns && i < trns.length ? trns[i]! : 255;
            break;
          }
          default: {
            // colour type 4
            const v = rows[s++]!;
            out[o] = out[o + 1] = out[o + 2] = v;
            out[o + 3] = rows[s++]!;
            break;
          }
        }
      }
    }
    return;
  }

  // 16-bit and sub-byte depths: generic sample reader
  const ch = channelsFor(ct);
  const maxv = (1 << bd) - 1;
  const sample = (rs: number, idx: number): number => {
    if (bd === 16) return (rows[rs + idx * 2]! << 8) | rows[rs + idx * 2 + 1]!;
    const bit = idx * bd;
    return (rows[rs + (bit >> 3)]! >> (8 - bd - (bit & 7))) & maxv;
  };
  const to8 = (v: number): number => (bd === 16 ? Math.round(v / 257) : bd === 8 ? v : Math.round((v * 255) / maxv));
  let keyR = -1;
  let keyG = -1;
  let keyB = -1;
  if (trns && ct === 0 && trns.length >= 2) keyR = (trns[0]! << 8) | trns[1]!;
  if (trns && ct === 2 && trns.length >= 6) {
    keyR = (trns[0]! << 8) | trns[1]!;
    keyG = (trns[2]! << 8) | trns[3]!;
    keyB = (trns[4]! << 8) | trns[5]!;
  }
  for (let y = y0; y < y1; y++) {
    const rs = y * rowBytes;
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const base = x * ch;
      switch (ct) {
        case 0: {
          const v = sample(rs, base);
          const g = to8(v);
          out[o] = out[o + 1] = out[o + 2] = g;
          out[o + 3] = v === keyR ? 0 : 255;
          break;
        }
        case 2: {
          const r = sample(rs, base);
          const g = sample(rs, base + 1);
          const b = sample(rs, base + 2);
          out[o] = to8(r);
          out[o + 1] = to8(g);
          out[o + 2] = to8(b);
          out[o + 3] = r === keyR && g === keyG && b === keyB ? 0 : 255;
          break;
        }
        case 3: {
          const i = sample(rs, base);
          out[o] = palette![i * 3] ?? 0;
          out[o + 1] = palette![i * 3 + 1] ?? 0;
          out[o + 2] = palette![i * 3 + 2] ?? 0;
          out[o + 3] = trns && i < trns.length ? trns[i]! : 255;
          break;
        }
        case 4: {
          const g = to8(sample(rs, base));
          out[o] = out[o + 1] = out[o + 2] = g;
          out[o + 3] = to8(sample(rs, base + 1));
          break;
        }
        default: {
          out[o] = to8(sample(rs, base));
          out[o + 1] = to8(sample(rs, base + 1));
          out[o + 2] = to8(sample(rs, base + 2));
          out[o + 3] = to8(sample(rs, base + 3));
          break;
        }
      }
    }
  }
}

/** Expand any decoded PNG into 8-bit non-premultiplied RGBA. */
export function decodedToRgba(d: DecodedPng): Uint8Array {
  const out = new Uint8Array(d.width * d.height * 4);
  expandRows(d, out, 0, d.height);
  return out;
}

export async function decodedToRgbaAsync(d: DecodedPng, hooks?: Hooks): Promise<Uint8Array> {
  const out = new Uint8Array(d.width * d.height * 4);
  const yieldNow = makeYielder(hooks);
  const block = Math.max(1, Math.floor(1_500_000 / d.width));
  for (let y = 0; y < d.height; y += block) {
    const y1 = Math.min(d.height, y + block);
    expandRows(d, out, y, y1);
    hooks?.onProgress?.(y1 / d.height);
    await yieldNow();
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Encoder: filtering, deflate, assembling
// ---------------------------------------------------------------------------------------------

export interface RawImage {
  width: number;
  height: number;
  colorType: number;
  bitDepth: number;
  /** Unfiltered scanlines, height * rowBytes */
  rows: Uint8Array;
  /** RGB triples */
  palette?: Uint8Array;
  trns?: Uint8Array;
  /** Extra chunks written between IHDR and PLTE/IDAT (colour-space info). */
  chunks?: PngChunk[];
}

export type FilterStrategy = 'adaptive' | 0 | 1 | 2 | 3 | 4;

const SABS: Uint8Array = (() => {
  const t = new Uint8Array(256);
  for (let i = 0; i < 256; i++) t[i] = i < 128 ? i : 256 - i;
  return t;
})();

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Filter rows [y0, y1) into `out` (which holds (y1-y0) * (rowBytes+1) bytes starting at outPos). */
function filterRange(
  rows: Uint8Array,
  rowBytes: number,
  bpp: number,
  strategy: FilterStrategy,
  y0: number,
  y1: number,
  out: Uint8Array,
  outPos: number
): void {
  const zero = new Uint8Array(rowBytes);
  const stride = rowBytes + 1;
  for (let y = y0; y < y1; y++) {
    const cur = rows.subarray(y * rowBytes, (y + 1) * rowBytes);
    const prev = y > 0 ? rows.subarray((y - 1) * rowBytes, y * rowBytes) : zero;
    const o = outPos + (y - y0) * stride;
    let ft: number;
    if (strategy === 'adaptive') {
      let s0 = 0;
      let s1 = 0;
      let s2 = 0;
      let s3 = 0;
      let s4 = 0;
      for (let i = 0; i < rowBytes; i++) {
        const x = cur[i]!;
        const b = prev[i]!;
        const a = i >= bpp ? cur[i - bpp]! : 0;
        const c = i >= bpp ? prev[i - bpp]! : 0;
        s0 += SABS[x]!;
        s1 += SABS[(x - a) & 255]!;
        s2 += SABS[(x - b) & 255]!;
        s3 += SABS[(x - ((a + b) >> 1)) & 255]!;
        s4 += SABS[(x - paeth(a, b, c)) & 255]!;
      }
      ft = 0;
      let best = s0;
      if (s1 < best) {
        best = s1;
        ft = 1;
      }
      if (s2 < best) {
        best = s2;
        ft = 2;
      }
      if (s3 < best) {
        best = s3;
        ft = 3;
      }
      if (s4 < best) {
        ft = 4;
      }
    } else {
      ft = strategy;
    }
    out[o] = ft;
    const d = o + 1;
    switch (ft) {
      case 0:
        out.set(cur, d);
        break;
      case 1:
        for (let i = 0; i < rowBytes; i++) out[d + i] = (cur[i]! - (i >= bpp ? cur[i - bpp]! : 0)) & 255;
        break;
      case 2:
        for (let i = 0; i < rowBytes; i++) out[d + i] = (cur[i]! - prev[i]!) & 255;
        break;
      case 3:
        for (let i = 0; i < rowBytes; i++) {
          const a = i >= bpp ? cur[i - bpp]! : 0;
          out[d + i] = (cur[i]! - ((a + prev[i]!) >> 1)) & 255;
        }
        break;
      default:
        for (let i = 0; i < rowBytes; i++) {
          const a = i >= bpp ? cur[i - bpp]! : 0;
          const c = i >= bpp ? prev[i - bpp]! : 0;
          out[d + i] = (cur[i]! - paeth(a, prev[i]!, c)) & 255;
        }
        break;
    }
  }
}

export async function filterScanlines(
  rows: Uint8Array,
  rowBytes: number,
  height: number,
  bpp: number,
  strategy: FilterStrategy,
  hooks?: Hooks
): Promise<Uint8Array> {
  const out = new Uint8Array((rowBytes + 1) * height);
  const yieldNow = makeYielder(hooks);
  const block = Math.max(1, Math.floor(400_000 / (rowBytes + 1)));
  for (let y = 0; y < height; y += block) {
    const y1 = Math.min(height, y + block);
    filterRange(rows, rowBytes, bpp, strategy, y, y1, out, y * (rowBytes + 1));
    hooks?.onProgress?.(y1 / height);
    await yieldNow();
  }
  return out;
}

/** zlib-compress at level 9. Large inputs are streamed in slices so the UI stays responsive. */
export async function deflateMax(data: Uint8Array, hooks?: Hooks): Promise<Uint8Array> {
  if (data.length < 1_500_000) return zlibSync(data, { level: 9 });
  const parts: Uint8Array[] = [];
  const z = new Zlib({ level: 9 });
  z.ondata = (chunk) => {
    parts.push(chunk);
  };
  const yieldNow = makeYielder(hooks);
  const slice = 128 * 1024;
  for (let off = 0; off < data.length; off += slice) {
    const end = Math.min(data.length, off + slice);
    z.push(data.subarray(off, end), end >= data.length);
    hooks?.onProgress?.(end / data.length);
    await yieldNow();
  }
  return concat(parts);
}

function ihdrData(w: number, h: number, bitDepth: number, colorType: number): Uint8Array {
  const d = new Uint8Array(13);
  const dv = new DataView(d.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  d[8] = bitDepth;
  d[9] = colorType;
  return d;
}

export function assemblePng(img: RawImage, idatZlib: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [PNG_SIGNATURE, makeChunk('IHDR', ihdrData(img.width, img.height, img.bitDepth, img.colorType))];
  for (const c of img.chunks ?? []) parts.push(makeChunk(c.type, c.data));
  if (img.palette) parts.push(makeChunk('PLTE', img.palette));
  if (img.trns && img.trns.length > 0) parts.push(makeChunk('tRNS', img.trns));
  parts.push(makeChunk('IDAT', idatZlib));
  parts.push(makeChunk('IEND', new Uint8Array(0)));
  return concat(parts);
}

export interface EncodedPng {
  png: Uint8Array;
  strategy: FilterStrategy;
}

/** Estimate the compressed size of three bands of rows for a strategy (used on big images). */
async function sampleCost(img: RawImage, rowBytes: number, bpp: number, strategy: FilterStrategy): Promise<number> {
  const bandRows = Math.max(4, Math.min(img.height, Math.ceil(300_000 / (rowBytes + 1))));
  const starts = [0, Math.max(0, Math.floor((img.height - bandRows) / 2)), Math.max(0, img.height - bandRows)];
  let total = 0;
  const seen = new Set<number>();
  for (const s of starts) {
    if (seen.has(s)) continue;
    seen.add(s);
    const n = Math.min(bandRows, img.height - s);
    const buf = new Uint8Array(n * (rowBytes + 1));
    filterRange(img.rows, rowBytes, bpp, strategy, s, s + n, buf, 0);
    total += zlibSync(buf, { level: 6 }).length;
  }
  return total;
}

/** Filter + deflate + assemble, trying several filter strategies and keeping the smallest. */
export async function encodePng(img: RawImage, hooks?: Hooks): Promise<EncodedPng> {
  const rowBytes = rowBytesFor(img.width, img.colorType, img.bitDepth);
  if (img.rows.length < rowBytes * img.height) throw new Error('Internal error: raster is too small.');
  const bpp = bppFor(img.colorType, img.bitDepth);
  const rawLen = rowBytes * img.height;
  let candidates: FilterStrategy[];
  if (rawLen <= 3_000_000) candidates = ['adaptive', 0, 4];
  else if (rawLen <= 12_000_000) candidates = ['adaptive', 0];
  else candidates = [];
  if (candidates.length === 0) {
    const a = await sampleCost(img, rowBytes, bpp, 'adaptive');
    const n = await sampleCost(img, rowBytes, bpp, 0);
    candidates = [a <= n ? 'adaptive' : 0];
  }
  let best: EncodedPng | null = null;
  for (let ci = 0; ci < candidates.length; ci++) {
    const strategy = candidates[ci]!;
    const lo = ci / candidates.length;
    const hi = (ci + 1) / candidates.length;
    const filtered = await filterScanlines(img.rows, rowBytes, img.height, bpp, strategy, subHooks(hooks, lo, lo + (hi - lo) * 0.25));
    const z = await deflateMax(filtered, subHooks(hooks, lo + (hi - lo) * 0.25, hi));
    const png = assemblePng(img, z);
    if (!best || png.length < best.png.length) best = { png, strategy };
  }
  if (!best) throw new Error('Internal error: no encoding produced.');
  return best;
}

// ---------------------------------------------------------------------------------------------
// Palette / raster builders
// ---------------------------------------------------------------------------------------------

export function paletteBitDepth(n: number): 1 | 2 | 4 | 8 {
  return n <= 2 ? 1 : n <= 4 ? 2 : n <= 16 ? 4 : 8;
}

/** Pack one byte-per-pixel samples into scanlines of the given bit depth (1, 2, 4 or 8). */
export function packSamples(samples: Uint8Array, width: number, height: number, bitDepth: number): Uint8Array {
  if (bitDepth === 8) return samples;
  const rowBytes = Math.ceil((width * bitDepth) / 8);
  const out = new Uint8Array(rowBytes * height);
  const perByte = 8 / bitDepth;
  for (let y = 0; y < height; y++) {
    const so = y * width;
    const d = y * rowBytes;
    for (let x = 0; x < width; x++) {
      const shift = 8 - bitDepth - (x % perByte) * bitDepth;
      const di = d + Math.floor(x / perByte);
      out[di] = out[di]! | (samples[so + x]! << shift);
    }
  }
  return out;
}

/** Build an indexed RawImage from per-pixel indices and an RGBA palette. */
export function buildIndexedImage(
  indices: Uint8Array,
  paletteRgba: Uint8Array,
  count: number,
  width: number,
  height: number,
  chunks: PngChunk[]
): RawImage {
  const bitDepth = paletteBitDepth(count);
  const plte = new Uint8Array(count * 3);
  let lastTrans = -1;
  for (let i = 0; i < count; i++) {
    plte[i * 3] = paletteRgba[i * 4]!;
    plte[i * 3 + 1] = paletteRgba[i * 4 + 1]!;
    plte[i * 3 + 2] = paletteRgba[i * 4 + 2]!;
    if (paletteRgba[i * 4 + 3]! < 255) lastTrans = i;
  }
  const trns = new Uint8Array(lastTrans + 1);
  for (let i = 0; i <= lastTrans; i++) trns[i] = paletteRgba[i * 4 + 3]!;
  return {
    width,
    height,
    colorType: 3,
    bitDepth,
    rows: packSamples(indices, width, height, bitDepth),
    palette: plte,
    trns: lastTrans >= 0 ? trns : undefined,
    chunks,
  };
}

function view32(rgba: Uint8Array | Uint8ClampedArray): Uint32Array {
  if (rgba.byteOffset % 4 === 0) return new Uint32Array(rgba.buffer, rgba.byteOffset, rgba.byteLength >> 2);
  return new Uint32Array(new Uint8Array(rgba).buffer);
}

export function clearTransparentRgb(rgba: Uint8Array | Uint8ClampedArray): void {
  const px = view32(rgba);
  for (let i = 0; i < px.length; i++) {
    const p = px[i]!;
    if (p >>> 24 === 0 && p !== 0) px[i] = 0;
  }
}

export interface ExactPalette {
  n: number;
  /** packed little-endian RGBA, r | g<<8 | b<<16 | a<<24 */
  colors: Uint32Array;
  counts: Uint32Array;
  /** hash table internals for lookups */
  tableKeys: Uint32Array;
  tableIdx: Int16Array;
}

const HASH_SIZE = 2048;

function hashSlot(key: number): number {
  return (Math.imul(key, 0x9e3779b1) >>> 21) & (HASH_SIZE - 1);
}

/** Collect the distinct colours of the image; returns null as soon as more than `limit` are found. */
export function buildExactPalette(px: Uint32Array, limit: number): ExactPalette | null {
  const tableKeys = new Uint32Array(HASH_SIZE);
  const tableIdx = new Int16Array(HASH_SIZE).fill(-1);
  const colors = new Uint32Array(limit);
  const counts = new Uint32Array(limit);
  let n = 0;
  let lastKey = -1;
  let lastIdx = -1;
  for (let i = 0; i < px.length; i++) {
    const key = px[i]!;
    if (key === lastKey) {
      counts[lastIdx]!++;
      continue;
    }
    let s = hashSlot(key);
    let idx = -1;
    for (;;) {
      const t = tableIdx[s]!;
      if (t < 0) break;
      if (tableKeys[s] === key) {
        idx = t;
        break;
      }
      s = (s + 1) & (HASH_SIZE - 1);
    }
    if (idx < 0) {
      if (n >= limit) return null;
      idx = n++;
      tableKeys[s] = key;
      tableIdx[s] = idx;
      colors[idx] = key;
    }
    counts[idx]!++;
    lastKey = key;
    lastIdx = idx;
  }
  return { n, colors, counts, tableKeys, tableIdx };
}

export function lookupExact(ex: ExactPalette, key: number): number {
  let s = hashSlot(key);
  for (;;) {
    const t = ex.tableIdx[s]!;
    if (t < 0) return 0;
    if (ex.tableKeys[s] === key) return t;
    s = (s + 1) & (HASH_SIZE - 1);
  }
}

/** Order palette entries: non-opaque first (so tRNS stays short), then by popularity. Returns old->new map. */
export function orderPalette(rgba: Uint8Array, counts: ArrayLike<number>, n: number): { order: Int32Array; inverse: Int32Array } {
  const ids = Array.from({ length: n }, (_, i) => i);
  ids.sort((a, b) => {
    const ta = rgba[a * 4 + 3]! < 255 ? 0 : 1;
    const tb = rgba[b * 4 + 3]! < 255 ? 0 : 1;
    if (ta !== tb) return ta - tb;
    const d = (counts[b] ?? 0) - (counts[a] ?? 0);
    return d !== 0 ? d : a - b;
  });
  const order = Int32Array.from(ids);
  const inverse = new Int32Array(n);
  for (let i = 0; i < n; i++) inverse[order[i]!] = i;
  return { order, inverse };
}

export interface IndexedResult {
  /** RGBA bytes, count*4 */
  palette: Uint8Array;
  count: number;
  indices: Uint8Array;
  exact: boolean;
}

async function indexedFromExact(px: Uint32Array, ex: ExactPalette, hooks?: Hooks): Promise<IndexedResult> {
  const pal0 = new Uint8Array(ex.n * 4);
  for (let i = 0; i < ex.n; i++) {
    const c = ex.colors[i]!;
    pal0[i * 4] = c & 255;
    pal0[i * 4 + 1] = (c >>> 8) & 255;
    pal0[i * 4 + 2] = (c >>> 16) & 255;
    pal0[i * 4 + 3] = c >>> 24;
  }
  const { order, inverse } = orderPalette(pal0, ex.counts, ex.n);
  const palette = new Uint8Array(ex.n * 4);
  for (let i = 0; i < ex.n; i++) palette.set(pal0.subarray(order[i]! * 4, order[i]! * 4 + 4), i * 4);
  const indices = new Uint8Array(px.length);
  const yieldNow = makeYielder(hooks);
  const CH = 1 << 20;
  for (let s = 0; s < px.length; s += CH) {
    const e = Math.min(px.length, s + CH);
    let lastKey = -1;
    let lastIdx = 0;
    for (let i = s; i < e; i++) {
      const key = px[i]!;
      if (key !== lastKey) {
        lastKey = key;
        lastIdx = inverse[lookupExact(ex, key)]!;
      }
      indices[i] = lastIdx;
    }
    hooks?.onProgress?.(e / px.length);
    await yieldNow();
  }
  return { palette, count: ex.n, indices, exact: true };
}

// ---------------------------------------------------------------------------------------------
// Quantiser: histogram -> variance-driven median cut -> k-means refinement -> (dithered) mapping
// ---------------------------------------------------------------------------------------------

const WR = 0.5;
const WG = 1;
const WB = 0.45;
const WA = 0.7;
const SR = Math.sqrt(WR);
const SG = Math.sqrt(WG);
const SB = Math.sqrt(WB);
const SA = Math.sqrt(WA);

/**
 * Alpha-aware colour difference between two colours given as premultiplied (0..255) components.
 * Takes the worse of the difference over a black and over a white backdrop (as pngquant does).
 */
export function premulDistance(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  q0: number,
  q1: number,
  q2: number,
  q3: number
): number {
  const da = p3 - q3;
  const d0 = p0 - q0;
  const d1 = p1 - q1;
  const d2 = p2 - q2;
  const e0 = d0 - da;
  const e1 = d1 - da;
  const e2 = d2 - da;
  return (
    WA * da * da +
    WR * Math.max(d0 * d0, e0 * e0) +
    WG * Math.max(d1 * d1, e1 * e1) +
    WB * Math.max(d2 * d2, e2 * e2)
  );
}

export interface QuantizeOptions {
  colors: number;
  /** 0..1 */
  dither: number;
}

const A_BIN: Uint8Array = (() => {
  const t = new Uint8Array(256);
  for (let a = 1; a < 255; a++) t[a] = 1 + Math.floor(((a - 1) * 30) / 254);
  t[0] = 0;
  t[255] = 31;
  return t;
})();

const A_CENTER: Float64Array = (() => {
  const sum = new Float64Array(32);
  const cnt = new Float64Array(32);
  for (let a = 0; a < 256; a++) {
    sum[A_BIN[a]!]! += a;
    cnt[A_BIN[a]!]!++;
  }
  const t = new Float64Array(32);
  for (let b = 0; b < 32; b++) t[b] = cnt[b]! > 0 ? sum[b]! / cnt[b]! : 0;
  return t;
})();

interface Box {
  start: number;
  end: number;
  score: number;
  axis: number;
}

export async function quantizeRgba(
  rgba: Uint8Array,
  width: number,
  height: number,
  opts: QuantizeOptions,
  hooks?: Hooks
): Promise<IndexedResult> {
  const total = width * height;
  const yieldNow = makeYielder(hooks);
  const target = Math.min(256, Math.max(2, Math.round(opts.colors)));
  const px = view32(rgba);
  const report = (f: number) => hooks?.onProgress?.(f);

  const exact = buildExactPalette(px, target);
  if (exact) return indexedFromExact(px, exact, subHooks(hooks, 0, 1));

  let hasAlpha = false;
  for (let i = 0; i < total; i++) {
    if (px[i]! >>> 24 !== 255) {
      hasAlpha = true;
      break;
    }
  }
  const nb = hasAlpha ? 1 << 20 : 1 << 18;
  const cnt = new Uint32Array(nb);
  const sr = new Float64Array(nb);
  const sg = new Float64Array(nb);
  const sb = new Float64Array(nb);
  const sa = hasAlpha ? new Float64Array(nb) : null;

  const keyOf = (r: number, g: number, b: number, a: number): number => {
    if (hasAlpha) {
      if (a === 0) return 0;
      return ((r >> 3) << 15) | ((g >> 3) << 10) | ((b >> 3) << 5) | A_BIN[a]!;
    }
    return ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
  };

  // 1. histogram
  const CH = 1 << 20;
  for (let s = 0; s < total; s += CH) {
    const e = Math.min(total, s + CH);
    for (let i = s; i < e; i++) {
      const p = px[i]!;
      const r = p & 255;
      const g = (p >>> 8) & 255;
      const b = (p >>> 16) & 255;
      const a = p >>> 24;
      const k = keyOf(r, g, b, a);
      cnt[k]!++;
      sr[k]! += r;
      sg[k]! += g;
      sb[k]! += b;
      if (sa) sa[k]! += a;
    }
    report((0.1 * e) / total);
    await yieldNow();
  }

  // 2. populated bins -> items
  let M = 0;
  for (let k = 0; k < nb; k++) if (cnt[k]! > 0) M++;
  const itemKey = new Int32Array(M);
  const itemW = new Float64Array(M);
  const P0 = new Float32Array(M);
  const P1 = new Float32Array(M);
  const P2 = new Float32Array(M);
  const P3 = new Float32Array(M);
  {
    let m = 0;
    for (let k = 0; k < nb; k++) {
      const c = cnt[k]!;
      if (c === 0) continue;
      const a = sa ? sa[k]! / c : 255;
      const f = a / 255;
      itemKey[m] = k;
      itemW[m] = c;
      P0[m] = (sr[k]! / c) * f;
      P1[m] = (sg[k]! / c) * f;
      P2[m] = (sb[k]! / c) * f;
      P3[m] = a;
      m++;
    }
  }
  await yieldNow();

  // 3. median cut with variance-based box selection
  const order = new Int32Array(M);
  for (let i = 0; i < M; i++) order[i] = i;
  const tmp = new Uint32Array(M);

  const evalBox = (start: number, end: number): Box => {
    let w = 0;
    let m0 = 0;
    let m1 = 0;
    let m2 = 0;
    let m3 = 0;
    let q0 = 0;
    let q1 = 0;
    let q2 = 0;
    let q3 = 0;
    for (let i = start; i < end; i++) {
      const it = order[i]!;
      const wt = itemW[it]!;
      const y0 = P0[it]! * SR;
      const y1 = P1[it]! * SG;
      const y2 = P2[it]! * SB;
      const y3 = P3[it]! * SA;
      w += wt;
      m0 += wt * y0;
      m1 += wt * y1;
      m2 += wt * y2;
      m3 += wt * y3;
      q0 += wt * y0 * y0;
      q1 += wt * y1 * y1;
      q2 += wt * y2 * y2;
      q3 += wt * y3 * y3;
    }
    const v0 = q0 - (m0 * m0) / w;
    const v1 = q1 - (m1 * m1) / w;
    const v2 = q2 - (m2 * m2) / w;
    const v3 = q3 - (m3 * m3) / w;
    let axis = 0;
    let bv = v0;
    if (v1 > bv) {
      bv = v1;
      axis = 1;
    }
    if (v2 > bv) {
      bv = v2;
      axis = 2;
    }
    if (v3 > bv) {
      axis = 3;
    }
    return { start, end, score: v0 + v1 + v2 + v3, axis };
  };

  const boxes: Box[] = [evalBox(0, M)];
  while (boxes.length < target) {
    let bi = -1;
    let bs = 1e-6;
    for (let j = 0; j < boxes.length; j++) {
      const b = boxes[j]!;
      if (b.end - b.start >= 2 && b.score > bs) {
        bs = b.score;
        bi = j;
      }
    }
    if (bi < 0) break;
    const box = boxes[bi]!;
    const arr = box.axis === 0 ? P0 : box.axis === 1 ? P1 : box.axis === 2 ? P2 : P3;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = box.start; i < box.end; i++) {
      const v = arr[order[i]!]!;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const range = hi - lo || 1;
    const n = box.end - box.start;
    const packed = tmp.subarray(0, n);
    for (let i = 0; i < n; i++) {
      const it = order[box.start + i]!;
      const q = Math.min(2047, Math.floor(((arr[it]! - lo) / range) * 2047.999));
      packed[i] = q * 1048576 + it;
    }
    packed.sort();
    let wsum = 0;
    for (let i = 0; i < n; i++) {
      const it = packed[i]! & 1048575;
      order[box.start + i] = it;
      wsum += itemW[it]!;
    }
    let acc = 0;
    let split = box.start + 1;
    for (let i = box.start; i < box.end - 1; i++) {
      acc += itemW[order[i]!]!;
      split = i + 1;
      if (acc >= wsum / 2) break;
    }
    split = Math.min(box.end - 1, Math.max(box.start + 1, split));
    boxes[bi] = evalBox(box.start, split);
    boxes.push(evalBox(split, box.end));
    if (boxes.length % 8 === 0) {
      report(0.1 + 0.1 * (boxes.length / target));
      await yieldNow();
    }
  }

  const K = boxes.length;
  const pal0 = new Float32Array(K);
  const pal1 = new Float32Array(K);
  const pal2 = new Float32Array(K);
  const pal3 = new Float32Array(K);
  for (let k = 0; k < K; k++) {
    const b = boxes[k]!;
    let w = 0;
    let a0 = 0;
    let a1 = 0;
    let a2 = 0;
    let a3 = 0;
    for (let i = b.start; i < b.end; i++) {
      const it = order[i]!;
      const wt = itemW[it]!;
      w += wt;
      a0 += wt * P0[it]!;
      a1 += wt * P1[it]!;
      a2 += wt * P2[it]!;
      a3 += wt * P3[it]!;
    }
    pal0[k] = a0 / w;
    pal1[k] = a1 / w;
    pal2[k] = a2 / w;
    pal3[k] = a3 / w;
  }
  report(0.2);
  await yieldNow();

  // 4. k-means (Voronoi) refinement on the bins
  const assign = new Int16Array(M).fill(0);
  for (let k = 0; k < K; k++) {
    const b = boxes[k]!;
    for (let i = b.start; i < b.end; i++) assign[order[i]!] = k;
  }
  const iters = M <= 3000 ? 10 : M <= 40000 ? 6 : M <= 150000 ? 3 : 2;
  const nearestItem = (m: number): number => {
    const p0 = P0[m]!;
    const p1 = P1[m]!;
    const p2 = P2[m]!;
    const p3 = P3[m]!;
    let bestK = assign[m]!;
    let best = premulDistance(p0, p1, p2, p3, pal0[bestK]!, pal1[bestK]!, pal2[bestK]!, pal3[bestK]!);
    for (let k = 0; k < K; k++) {
      if (k === bestK) continue;
      const da = p3 - pal3[k]!;
      let d = WA * da * da;
      if (d >= best) continue;
      const d1 = p1 - pal1[k]!;
      const e1 = d1 - da;
      d += WG * Math.max(d1 * d1, e1 * e1);
      if (d >= best) continue;
      const d0 = p0 - pal0[k]!;
      const e0 = d0 - da;
      d += WR * Math.max(d0 * d0, e0 * e0);
      if (d >= best) continue;
      const d2 = p2 - pal2[k]!;
      const e2 = d2 - da;
      d += WB * Math.max(d2 * d2, e2 * e2);
      if (d < best) {
        best = d;
        bestK = k;
      }
    }
    return bestK;
  };
  const sw = new Float64Array(K);
  const s0 = new Float64Array(K);
  const s1 = new Float64Array(K);
  const s2 = new Float64Array(K);
  const s3 = new Float64Array(K);
  const MCH = 4000;
  for (let it = 0; it < iters; it++) {
    sw.fill(0);
    s0.fill(0);
    s1.fill(0);
    s2.fill(0);
    s3.fill(0);
    let changed = 0;
    for (let s = 0; s < M; s += MCH) {
      const e = Math.min(M, s + MCH);
      for (let m = s; m < e; m++) {
        const k = nearestItem(m);
        if (k !== assign[m]) {
          assign[m] = k;
          changed++;
        }
        const wt = itemW[m]!;
        sw[k]! += wt;
        s0[k]! += wt * P0[m]!;
        s1[k]! += wt * P1[m]!;
        s2[k]! += wt * P2[m]!;
        s3[k]! += wt * P3[m]!;
      }
      report(0.2 + 0.3 * ((it + s / M) / iters));
      await yieldNow();
    }
    for (let k = 0; k < K; k++) {
      const w = sw[k]!;
      if (w > 0) {
        pal0[k] = s0[k]! / w;
        pal1[k] = s1[k]! / w;
        pal2[k] = s2[k]! / w;
        pal3[k] = s3[k]! / w;
      }
    }
    if (changed === 0) break;
  }
  // final assignment against the final palette + per-entry population
  const pop = new Float64Array(K);
  for (let s = 0; s < M; s += MCH) {
    const e = Math.min(M, s + MCH);
    for (let m = s; m < e; m++) {
      const k = nearestItem(m);
      assign[m] = k;
      pop[k]! += itemW[m]!;
    }
    await yieldNow();
  }
  report(0.5);

  // 5. finalise palette (8-bit RGBA), drop empty entries, order it
  const live: number[] = [];
  for (let k = 0; k < K; k++) if (pop[k]! > 0) live.push(k);
  const L = live.length;
  const pal8 = new Uint8Array(L * 4);
  const livePop = new Float64Array(L);
  for (let j = 0; j < L; j++) {
    const k = live[j]!;
    livePop[j] = pop[k]!;
    const a = Math.min(255, Math.max(0, pal3[k]!));
    if (a < 0.5) {
      pal8[j * 4 + 3] = 0;
      continue;
    }
    pal8[j * 4] = Math.min(255, Math.max(0, Math.round((pal0[k]! * 255) / a)));
    pal8[j * 4 + 1] = Math.min(255, Math.max(0, Math.round((pal1[k]! * 255) / a)));
    pal8[j * 4 + 2] = Math.min(255, Math.max(0, Math.round((pal2[k]! * 255) / a)));
    pal8[j * 4 + 3] = Math.round(a);
  }
  const { order: pOrder, inverse } = orderPalette(pal8, livePop, L);
  const palette = new Uint8Array(L * 4);
  for (let j = 0; j < L; j++) palette.set(pal8.subarray(pOrder[j]! * 4, pOrder[j]! * 4 + 4), j * 4);
  const newOfOldK = new Int32Array(K).fill(-1);
  for (let j = 0; j < L; j++) newOfOldK[live[j]!] = inverse[j]!;

  const binToIndex = new Int16Array(nb).fill(-1);
  for (let m = 0; m < M; m++) binToIndex[itemKey[m]!] = newOfOldK[assign[m]!]!;

  // premultiplied view of the final (8-bit) palette for dithering / lookups
  const PP0 = new Float32Array(L);
  const PP1 = new Float32Array(L);
  const PP2 = new Float32Array(L);
  const PP3 = new Float32Array(L);
  for (let j = 0; j < L; j++) {
    const a = palette[j * 4 + 3]!;
    PP0[j] = (palette[j * 4]! * a) / 255;
    PP1[j] = (palette[j * 4 + 1]! * a) / 255;
    PP2[j] = (palette[j * 4 + 2]! * a) / 255;
    PP3[j] = a;
  }

  // 6. map pixels
  const indices = new Uint8Array(total);
  const strength = Math.min(1, Math.max(0, opts.dither));
  if (strength <= 0.001) {
    for (let s = 0; s < total; s += CH) {
      const e = Math.min(total, s + CH);
      for (let i = s; i < e; i++) {
        const p = px[i]!;
        indices[i] = binToIndex[keyOf(p & 255, (p >>> 8) & 255, (p >>> 16) & 255, p >>> 24)]!;
      }
      report(0.5 + (0.5 * e) / total);
      await yieldNow();
    }
    return { palette, count: L, indices, exact: false };
  }

  const nearestPremul = (p0: number, p1: number, p2: number, p3: number): number => {
    let best = Infinity;
    let bi = 0;
    for (let j = 0; j < L; j++) {
      const da = p3 - PP3[j]!;
      let d = WA * da * da;
      if (d >= best) continue;
      const d1 = p1 - PP1[j]!;
      const e1 = d1 - da;
      d += WG * Math.max(d1 * d1, e1 * e1);
      if (d >= best) continue;
      const d0 = p0 - PP0[j]!;
      const e0 = d0 - da;
      d += WR * Math.max(d0 * d0, e0 * e0);
      if (d >= best) continue;
      const d2 = p2 - PP2[j]!;
      const e2 = d2 - da;
      d += WB * Math.max(d2 * d2, e2 * e2);
      if (d < best) {
        best = d;
        bi = j;
      }
    }
    return bi;
  };
  const lookupKey = (k: number): number => {
    let q = binToIndex[k]!;
    if (q >= 0) return q;
    let rc: number;
    let gc: number;
    let bc: number;
    let ac: number;
    if (hasAlpha) {
      rc = ((k >> 15) & 31) * 8 + 4;
      gc = ((k >> 10) & 31) * 8 + 4;
      bc = ((k >> 5) & 31) * 8 + 4;
      ac = A_CENTER[k & 31]!;
    } else {
      rc = ((k >> 12) & 63) * 4 + 2;
      gc = ((k >> 6) & 63) * 4 + 2;
      bc = (k & 63) * 4 + 2;
      ac = 255;
    }
    const f = ac / 255;
    q = nearestPremul(rc * f, gc * f, bc * f, ac);
    binToIndex[k] = q;
    return q;
  };

  const transIdx = hasAlpha ? Math.max(0, binToIndex[0]!) : 0;
  const stride = (width + 2) * 4;
  let errCur = new Float32Array(stride);
  let errNext = new Float32Array(stride);
  for (let y = 0; y < height; y++) {
    const ltr = (y & 1) === 0;
    const dir = ltr ? 1 : -1;
    errNext.fill(0);
    for (let xi = 0; xi < width; xi++) {
      const x = ltr ? xi : width - 1 - xi;
      const i = y * width + x;
      const p = px[i]!;
      const a0 = p >>> 24;
      if (a0 === 0) {
        indices[i] = transIdx;
        continue;
      }
      const e = (x + 1) * 4;
      const f = a0 / 255;
      let pa = hasAlpha ? a0 + errCur[e + 3]! : 255;
      pa = pa < 0 ? 0 : pa > 255 ? 255 : pa;
      let pr = (p & 255) * f + errCur[e]!;
      let pg = ((p >>> 8) & 255) * f + errCur[e + 1]!;
      let pb = ((p >>> 16) & 255) * f + errCur[e + 2]!;
      pr = pr < 0 ? 0 : pr > pa ? pa : pr;
      pg = pg < 0 ? 0 : pg > pa ? pa : pg;
      pb = pb < 0 ? 0 : pb > pa ? pa : pb;
      let r = 0;
      let g = 0;
      let b = 0;
      if (pa >= 0.5) {
        const inv = 255 / pa;
        r = Math.min(255, pr * inv + 0.5) | 0;
        g = Math.min(255, pg * inv + 0.5) | 0;
        b = Math.min(255, pb * inv + 0.5) | 0;
      }
      const q = lookupKey(keyOf(r, g, b, hasAlpha ? Math.min(255, (pa + 0.5) | 0) : 255));
      indices[i] = q;
      const er = (pr - PP0[q]!) * strength;
      const eg = (pg - PP1[q]!) * strength;
      const eb = (pb - PP2[q]!) * strength;
      const ea = hasAlpha ? (pa - PP3[q]!) * strength : 0;
      const eA = e + dir * 4; // ahead
      const eB = e - dir * 4; // behind
      errCur[eA]! += (er * 7) / 16;
      errCur[eA + 1]! += (eg * 7) / 16;
      errCur[eA + 2]! += (eb * 7) / 16;
      errNext[eB]! += (er * 3) / 16;
      errNext[eB + 1]! += (eg * 3) / 16;
      errNext[eB + 2]! += (eb * 3) / 16;
      errNext[e]! += (er * 5) / 16;
      errNext[e + 1]! += (eg * 5) / 16;
      errNext[e + 2]! += (eb * 5) / 16;
      errNext[eA]! += er / 16;
      errNext[eA + 1]! += eg / 16;
      errNext[eA + 2]! += eb / 16;
      if (hasAlpha) {
        errCur[eA + 3]! += (ea * 7) / 16;
        errNext[eB + 3]! += (ea * 3) / 16;
        errNext[e + 3]! += (ea * 5) / 16;
        errNext[eA + 3]! += ea / 16;
      }
    }
    const t = errCur;
    errCur = errNext;
    errNext = t;
    if ((y & 7) === 7 || y === height - 1) {
      report(0.5 + (0.5 * (y + 1)) / height);
      await yieldNow();
    }
  }
  return { palette, count: L, indices, exact: false };
}

// ---------------------------------------------------------------------------------------------
// High-level compression
// ---------------------------------------------------------------------------------------------

export interface CompressOptions {
  mode: 'lossy' | 'lossless';
  /** 2..256 (lossy) */
  colors: number;
  /** 0..1 (lossy) */
  dither: number;
  /** keep iCCP / sRGB / gAMA / cHRM */
  keepColorInfo: boolean;
  /** lossless: zero the RGB values hidden under fully transparent pixels */
  clearTransparent: boolean;
}

export interface CompressOutput {
  png: Uint8Array;
  width: number;
  height: number;
  colorType: number;
  bitDepth: number;
  paletteSize: number;
  strategy: FilterStrategy;
  /** true when the output keeps every original pixel value */
  lossless: boolean;
}

export const DEFAULT_OPTIONS: CompressOptions = {
  mode: 'lossy',
  colors: 256,
  dither: 0.75,
  keepColorInfo: true,
  clearTransparent: false,
};

function toOutput(img: RawImage, enc: EncodedPng, lossless: boolean): CompressOutput {
  return {
    png: enc.png,
    width: img.width,
    height: img.height,
    colorType: img.colorType,
    bitDepth: img.bitDepth,
    paletteSize: img.palette ? img.palette.length / 3 : 0,
    strategy: enc.strategy,
    lossless,
  };
}

async function lossyFromRgba(
  rgba: Uint8Array,
  w: number,
  h: number,
  opts: CompressOptions,
  chunks: PngChunk[],
  hooks?: Hooks
): Promise<CompressOutput> {
  clearTransparentRgb(rgba);
  const q = await quantizeRgba(rgba, w, h, { colors: opts.colors, dither: opts.dither }, subHooks(hooks, 0, 0.7));
  const img = buildIndexedImage(q.indices, q.palette, q.count, w, h, chunks);
  const enc = await encodePng(img, subHooks(hooks, 0.7, 1));
  return toOutput(img, enc, q.exact);
}

function greyBitDepth(levels: Uint8Array): 1 | 2 | 4 | 8 {
  let all17 = true;
  let all85 = true;
  let all255 = true;
  for (let v = 0; v < 256; v++) {
    if (!levels[v]) continue;
    if (v % 17 !== 0) all17 = false;
    if (v % 85 !== 0) all85 = false;
    if (v !== 0 && v !== 255) all255 = false;
  }
  if (all255) return 1;
  if (all85) return 2;
  if (all17) return 4;
  return 8;
}

async function losslessFromRgba(
  rgba: Uint8Array,
  w: number,
  h: number,
  opts: CompressOptions,
  chunks: PngChunk[],
  hooks?: Hooks
): Promise<CompressOutput> {
  if (opts.clearTransparent) clearTransparentRgb(rgba);
  const total = w * h;
  const px = view32(rgba);
  const yieldNow = makeYielder(hooks);

  let allOpaque = true;
  let allGrey = true;
  const levels = new Uint8Array(256);
  const CH = 1 << 20;
  for (let s = 0; s < total; s += CH) {
    const e = Math.min(total, s + CH);
    for (let i = s; i < e; i++) {
      const p = px[i]!;
      const r = p & 255;
      const g = (p >>> 8) & 255;
      const b = (p >>> 16) & 255;
      if (p >>> 24 !== 255) allOpaque = false;
      if (r !== g || g !== b) allGrey = false;
      else levels[r] = 1;
    }
    await yieldNow();
  }
  const ex = buildExactPalette(px, 256);
  await yieldNow();

  const candidates: RawImage[] = [];
  const addDirect = () => {
    if (allGrey && allOpaque) {
      const bd = greyBitDepth(levels);
      const samples = new Uint8Array(total);
      for (let i = 0; i < total; i++) samples[i] = px[i]! & 255;
      const maxv = (1 << bd) - 1;
      if (bd !== 8) for (let i = 0; i < total; i++) samples[i] = Math.round((samples[i]! * maxv) / 255);
      candidates.push({ width: w, height: h, colorType: 0, bitDepth: bd, rows: packSamples(samples, w, h, bd), chunks });
    } else if (allGrey) {
      const rows = new Uint8Array(total * 2);
      for (let i = 0; i < total; i++) {
        const p = px[i]!;
        rows[i * 2] = p & 255;
        rows[i * 2 + 1] = p >>> 24;
      }
      candidates.push({ width: w, height: h, colorType: 4, bitDepth: 8, rows, chunks });
    } else if (allOpaque) {
      const rows = new Uint8Array(total * 3);
      for (let i = 0; i < total; i++) {
        rows[i * 3] = rgba[i * 4]!;
        rows[i * 3 + 1] = rgba[i * 4 + 1]!;
        rows[i * 3 + 2] = rgba[i * 4 + 2]!;
      }
      candidates.push({ width: w, height: h, colorType: 2, bitDepth: 8, rows, chunks });
    } else {
      candidates.push({ width: w, height: h, colorType: 6, bitDepth: 8, rows: new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength), chunks });
    }
  };

  let usePalette = false;
  if (ex) {
    if (allGrey && allOpaque) {
      usePalette = false;
      addDirect();
    } else {
      usePalette = true;
      const ix = await indexedFromExact(px, ex, subHooks(hooks, 0, 0.2));
      candidates.push(buildIndexedImage(ix.indices, ix.palette, ix.count, w, h, chunks));
      if (total <= 1_500_000) addDirect();
    }
  } else {
    addDirect();
  }
  void usePalette;

  let best: { img: RawImage; enc: EncodedPng } | null = null;
  for (let ci = 0; ci < candidates.length; ci++) {
    const img = candidates[ci]!;
    const lo = 0.2 + (0.8 * ci) / candidates.length;
    const hi = 0.2 + (0.8 * (ci + 1)) / candidates.length;
    const enc = await encodePng(img, subHooks(hooks, lo, hi));
    if (!best || enc.png.length < best.enc.png.length) best = { img, enc };
  }
  if (!best) throw new Error('Internal error: no candidate encoding.');
  return toOutput(best.img, best.enc, true);
}

function selectChunks(d: DecodedPng | null, keep: boolean): PngChunk[] {
  if (!d || !keep) return [];
  // sRGB and iCCP are mutually exclusive; prefer iCCP when both are present.
  const hasIccp = d.colorChunks.some((c) => c.type === 'iCCP');
  return d.colorChunks.filter((c) => !(hasIccp && c.type === 'sRGB'));
}

/** Compress PNG bytes. Throws for invalid, oversized or animated PNGs. */
export async function compressPngBytes(bytes: Uint8Array, opts: CompressOptions, hooks?: Hooks): Promise<CompressOutput> {
  const head = readPngHeader(bytes);
  if (head.animated) throw new Error('Animated PNG (APNG) — skipped so the animation is not lost.');
  const d = await decodePngAsync(bytes, subHooks(hooks, 0, 0.15));
  const chunks = selectChunks(d, opts.keepColorInfo);
  const pixelHooks = subHooks(hooks, 0.15, 1);
  if (opts.mode === 'lossless' && d.bitDepth === 16) {
    // Reduce to 8-bit only when that is exactly lossless; otherwise recompress at 16-bit.
    let exact8 = true;
    for (let i = 0; i + 1 < d.rows.length; i += 2) {
      if (d.rows[i] !== d.rows[i + 1]) {
        exact8 = false;
        break;
      }
    }
    if (!exact8) {
      const img: RawImage = {
        width: d.width,
        height: d.height,
        colorType: d.colorType,
        bitDepth: 16,
        rows: d.rows,
        palette: undefined,
        trns: d.trns ?? undefined,
        chunks,
      };
      const enc = await encodePng(img, pixelHooks);
      return toOutput(img, enc, true);
    }
  }
  const rgba = await decodedToRgbaAsync(d, subHooks(pixelHooks, 0, 0.04));
  return compressRgba(rgba, d.width, d.height, opts, chunks, subHooks(pixelHooks, 0.04, 1));
}

/** Compress already-decoded RGBA pixels (non-premultiplied). The array may be modified. */
export async function compressRgba(
  rgba: Uint8Array,
  width: number,
  height: number,
  opts: CompressOptions,
  chunks: PngChunk[] = [],
  hooks?: Hooks
): Promise<CompressOutput> {
  if (width * height > MAX_PIXELS) throw new Error(`Image is larger than ${MAX_PIXELS / 1e6} megapixels.`);
  return opts.mode === 'lossy'
    ? lossyFromRgba(rgba, width, height, opts, chunks, hooks)
    : losslessFromRgba(rgba, width, height, opts, chunks, hooks);
}
