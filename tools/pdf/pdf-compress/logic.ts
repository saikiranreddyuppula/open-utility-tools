/**
 * Pure logic for the "Compress PDF" tool: presets, deciding which images can be
 * recompressed, decoding raw Flate image samples (incl. PNG / TIFF predictors),
 * JPEG header parsing and a tiny sample-PDF writer. No browser APIs.
 */
import { unzlibSync } from 'fflate';
import type { PdfImageInfo } from '@/lib/wasm/pdf';

export type PresetId = 'light' | 'recommended' | 'strong' | 'custom';

export interface Preset {
  id: PresetId;
  label: string;
  /** JPEG quality, 0..1. */
  quality: number;
  /** Longest image side in pixels. */
  maxDim: number;
  blurb: string;
}

export const PRESETS: Preset[] = [
  { id: 'light', label: 'Light', quality: 0.85, maxDim: 2400, blurb: 'Best quality, modest savings' },
  { id: 'recommended', label: 'Recommended', quality: 0.72, maxDim: 1600, blurb: 'Good balance for screens and email' },
  { id: 'strong', label: 'Strong', quality: 0.5, maxDim: 1100, blurb: 'Smallest file, visible loss on photos' },
  { id: 'custom', label: 'Custom', quality: 0.72, maxDim: 1600, blurb: 'Pick quality and size yourself' },
];

export const MIN_IMAGE_SIDE = 32;
export const MIN_IMAGE_BYTES = 8 * 1024;
/** Skip anything that would need more than this many pixels of working memory. */
export const MAX_IMAGE_PIXELS = 40_000_000;
/** An image is only replaced when the new stream is at least this much smaller. */
export const MIN_GAIN = 0.05;

// ---------------------------------------------------------------------------
// Candidate selection
// ---------------------------------------------------------------------------

export type ImageKind = 'jpeg' | 'flate';

export type Classification =
  | { ok: true; kind: ImageKind }
  | { ok: false; reason: string };

const SUPPORTED_SPACES = new Set(['DeviceGray', 'DeviceRGB', 'CalGray', 'CalRGB', 'ICCBased']);

/** Decide whether an image can be safely re-encoded as a JPEG. */
export function classifyImage(i: PdfImageInfo): Classification {
  if (i.isMask) return { ok: false, reason: 'Stencil mask' };
  if (i.page === 0) return { ok: false, reason: 'Soft mask or not drawn on a page' };
  if (i.width < MIN_IMAGE_SIDE || i.height < MIN_IMAGE_SIDE) return { ok: false, reason: 'Tiny image' };
  if (i.length < MIN_IMAGE_BYTES) return { ok: false, reason: 'Already small (under 8 KB)' };
  if (i.width * i.height > MAX_IMAGE_PIXELS) return { ok: false, reason: 'Too large to process in the browser' };
  if (i.filter === 'DCTDecode') {
    if (i.components === 4 || i.colorSpace === 'DeviceCMYK') return { ok: false, reason: 'CMYK JPEG' };
    if (i.components !== 1 && i.components !== 3) return { ok: false, reason: 'Unsupported JPEG colour space' };
    if (i.colorSpace !== '' && !SUPPORTED_SPACES.has(i.colorSpace)) {
      return { ok: false, reason: `${i.colorSpace} colour space` };
    }
    return { ok: true, kind: 'jpeg' };
  }
  if (i.filter === 'FlateDecode') {
    if (!SUPPORTED_SPACES.has(i.colorSpace)) {
      return { ok: false, reason: i.colorSpace ? `${i.colorSpace} colour space` : 'Unknown colour space' };
    }
    if (i.components !== 1 && i.components !== 3) return { ok: false, reason: 'Unsupported colour components' };
    if (i.bitsPerComponent !== 8) return { ok: false, reason: `${i.bitsPerComponent}-bit samples` };
    return { ok: true, kind: 'flate' };
  }
  if (i.filter === '') return { ok: false, reason: 'Uncompressed data' };
  return { ok: false, reason: `${i.filter.replace(/Decode$/, '')} encoding` };
}

/** Target pixel size so that the longest side is at most `maxDim` (never upscales). */
export function fitDimensions(w: number, h: number, maxDim: number): { width: number; height: number } {
  const longest = Math.max(w, h);
  if (longest <= maxDim || maxDim <= 0) return { width: w, height: h };
  const s = maxDim / longest;
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) };
}

// ---------------------------------------------------------------------------
// Raw (Flate) sample decoding
// ---------------------------------------------------------------------------

export type SamplesResult = { ok: true; samples: Uint8Array } | { ok: false; reason: string };

/** Undo PNG row filters (Predictor 10..15). Input rows are `1 + rowBytes` long. */
export function unfilterPng(data: Uint8Array, rowBytes: number, height: number, bpp: number): Uint8Array | null {
  const out = new Uint8Array(rowBytes * height);
  const stride = rowBytes + 1;
  for (let y = 0; y < height; y++) {
    const ft = data[y * stride] ?? 0;
    const inOff = y * stride + 1;
    const outOff = y * rowBytes;
    const prevOff = outOff - rowBytes;
    switch (ft) {
      case 0:
        for (let i = 0; i < rowBytes; i++) out[outOff + i] = data[inOff + i] ?? 0;
        break;
      case 1:
        for (let i = 0; i < rowBytes; i++) {
          const a = i >= bpp ? (out[outOff + i - bpp] ?? 0) : 0;
          out[outOff + i] = ((data[inOff + i] ?? 0) + a) & 255;
        }
        break;
      case 2:
        for (let i = 0; i < rowBytes; i++) {
          const b = y > 0 ? (out[prevOff + i] ?? 0) : 0;
          out[outOff + i] = ((data[inOff + i] ?? 0) + b) & 255;
        }
        break;
      case 3:
        for (let i = 0; i < rowBytes; i++) {
          const a = i >= bpp ? (out[outOff + i - bpp] ?? 0) : 0;
          const b = y > 0 ? (out[prevOff + i] ?? 0) : 0;
          out[outOff + i] = ((data[inOff + i] ?? 0) + ((a + b) >> 1)) & 255;
        }
        break;
      case 4:
        for (let i = 0; i < rowBytes; i++) {
          const a = i >= bpp ? (out[outOff + i - bpp] ?? 0) : 0;
          const b = y > 0 ? (out[prevOff + i] ?? 0) : 0;
          const c = y > 0 && i >= bpp ? (out[prevOff + i - bpp] ?? 0) : 0;
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          out[outOff + i] = ((data[inOff + i] ?? 0) + pred) & 255;
        }
        break;
      default:
        return null;
    }
  }
  return out;
}

/** Undo the TIFF horizontal-differencing predictor (Predictor 2) for 8-bit samples. */
export function untiff(data: Uint8Array, rowBytes: number, height: number, comps: number): Uint8Array {
  const out = new Uint8Array(rowBytes * height);
  for (let y = 0; y < height; y++) {
    const o = y * rowBytes;
    for (let i = 0; i < rowBytes; i++) {
      const left = i >= comps ? (out[o + i - comps] ?? 0) : 0;
      out[o + i] = ((data[o + i] ?? 0) + left) & 255;
    }
  }
  return out;
}

/**
 * Inflate a FlateDecode image stream into raw 8-bit samples (width*height*comps bytes).
 * Anything that does not match the expected layout exactly is refused, never guessed.
 */
export function decodeFlateSamples(
  stream: Uint8Array,
  width: number,
  height: number,
  comps: number,
  hasPredictor: boolean,
): SamplesResult {
  let inflated: Uint8Array;
  try {
    inflated = unzlibSync(stream);
  } catch {
    return { ok: false, reason: 'Could not inflate the image data' };
  }
  const rowBytes = width * comps;
  const raw = rowBytes * height;
  const png = height * (rowBytes + 1);
  if (!hasPredictor) {
    if (inflated.length < raw) return { ok: false, reason: 'Image data is shorter than expected' };
    return { ok: true, samples: inflated.length === raw ? inflated : inflated.subarray(0, raw) };
  }
  if (inflated.length === png) {
    const out = unfilterPng(inflated, rowBytes, height, comps);
    return out ? { ok: true, samples: out } : { ok: false, reason: 'Unknown PNG row filter' };
  }
  if (inflated.length === raw) return { ok: true, samples: untiff(inflated, rowBytes, height, comps) };
  return { ok: false, reason: 'Unsupported predictor layout' };
}

// ---------------------------------------------------------------------------
// JPEG header parsing
// ---------------------------------------------------------------------------

export interface JpegInfo {
  width: number;
  height: number;
  components: number;
  precision: number;
  progressive: boolean;
  /** EXIF orientation 1..8, or null when absent. */
  exifOrientation: number | null;
}

function exifOrientation(d: Uint8Array, start: number, end: number): number | null {
  // d[start..end) is the APP1 payload: "Exif\0\0" + TIFF header.
  if (end - start < 14) return null;
  if (d[start] !== 0x45 || d[start + 1] !== 0x78 || d[start + 2] !== 0x69 || d[start + 3] !== 0x66) return null;
  const t = start + 6;
  const little = d[t] === 0x49 && d[t + 1] === 0x49;
  if (!little && !(d[t] === 0x4d && d[t + 1] === 0x4d)) return null;
  const view = new DataView(d.buffer, d.byteOffset, d.byteLength);
  const u16 = (o: number) => (o + 2 <= end ? view.getUint16(o, little) : 0);
  const u32 = (o: number) => (o + 4 <= end ? view.getUint32(o, little) : 0);
  if (u16(t + 2) !== 42) return null;
  const ifd = t + u32(t + 4);
  if (ifd + 2 > end) return null;
  const n = u16(ifd);
  for (let k = 0; k < n; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > end) return null;
    if (u16(e) === 0x0112) {
      const v = u16(e + 8);
      return v >= 1 && v <= 8 ? v : null;
    }
  }
  return null;
}

/** Read size, component count and EXIF orientation from a JPEG without decoding it. */
export function parseJpeg(d: Uint8Array): JpegInfo | null {
  if (d.length < 4 || d[0] !== 0xff || d[1] !== 0xd8) return null;
  let orientation: number | null = null;
  let i = 2;
  while (i + 4 <= d.length) {
    if (d[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = d[i + 1] ?? 0;
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // reached image data without a frame header
    const len = ((d[i + 2] ?? 0) << 8) | (d[i + 3] ?? 0);
    if (len < 2) return null;
    if (marker === 0xe1 && orientation === null) {
      orientation = exifOrientation(d, i + 4, Math.min(i + 2 + len, d.length));
    }
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (i + 10 > d.length) return null;
      return {
        precision: d[i + 4] ?? 0,
        height: ((d[i + 5] ?? 0) << 8) | (d[i + 6] ?? 0),
        width: ((d[i + 7] ?? 0) << 8) | (d[i + 8] ?? 0),
        components: d[i + 9] ?? 0,
        progressive: marker === 0xc2,
        exifOrientation: orientation,
      };
    }
    i += 2 + len;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Result bookkeeping
// ---------------------------------------------------------------------------

export type RowStatus = 'recompressed' | 'kept' | 'skipped';

export interface ImageRow {
  id: number;
  page: number;
  status: RowStatus;
  note: string;
  widthBefore: number;
  heightBefore: number;
  widthAfter: number;
  heightAfter: number;
  bytesBefore: number;
  bytesAfter: number;
}

export function percentSaved(before: number, after: number): number {
  if (before <= 0) return 0;
  return ((before - after) / before) * 100;
}

// ---------------------------------------------------------------------------
// Sample PDF with big photographic-style JPEGs (so the tool can be tried without a file)
// ---------------------------------------------------------------------------

/** A PDF with one full-page JPEG per page (DCTDecode), sizes in points. */
export function buildJpegPdf(
  pages: { jpeg: Uint8Array; width: number; height: number; pageW: number; pageH: number; caption: string }[],
): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let length = 0;
  const offsets: number[] = [];
  const push = (b: Uint8Array | string) => {
    const u = typeof b === 'string' ? enc.encode(b) : b;
    chunks.push(u);
    length += u.length;
  };
  const obj = (num: number, body: string) => {
    offsets[num] = length;
    push(`${num} 0 obj\n${body}\nendobj\n`);
  };
  const kids = pages.map((_p, i) => `${4 + i * 3} 0 R`).join(' ');
  push('%PDF-1.4\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  obj(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  pages.forEach((p, i) => {
    const pageNo = 4 + i * 3;
    const margin = 36;
    const availW = p.pageW - 2 * margin;
    const availH = p.pageH - 2 * margin - 24;
    const s = Math.min(availW / p.width, availH / p.height);
    const dw = p.width * s;
    const dh = p.height * s;
    const x = (p.pageW - dw) / 2;
    const y = margin;
    const caption = p.caption.replace(/[\\()]/g, (c) => `\\${c}`);
    const content =
      `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q\n` +
      `BT /F1 12 Tf ${margin} ${(p.pageH - margin - 8).toFixed(2)} Td (${caption}) Tj ET\n`;
    obj(
      pageNo,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.pageW} ${p.pageH}] /Resources << /Font << /F1 3 0 R >> /XObject << /Im0 ${pageNo + 2} 0 R >> >> /Contents ${pageNo + 1} 0 R >>`,
    );
    obj(pageNo + 1, `<< /Length ${content.length} >>\nstream\n${content}endstream`);
    offsets[pageNo + 2] = length;
    push(
      `${pageNo + 2} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`,
    );
    push(p.jpeg);
    push('\nendstream\nendobj\n');
  });
  const objCount = 3 + pages.length * 3;
  const xref = length;
  push(`xref\n0 ${objCount + 1}\n0000000000 65535 f \n`);
  for (let n = 1; n <= objCount; n++) push(`${String(offsets[n] ?? 0).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${objCount + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(length);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

export function stripExtension(name: string): string {
  const base = name.replace(/\.pdf$/i, '');
  return base === '' ? 'document' : base;
}
