/**
 * Lossless metadata inspection and removal for JPEG, PNG and WebP.
 * Image data is copied byte-for-byte — nothing is decoded or re-encoded.
 * Pure TypeScript (only depends on fflate) so it can be unit-tested outside the browser.
 */
import { unzlibSync } from 'fflate';

export type ImageFormat = 'jpeg' | 'png' | 'webp';
export type Risk = 'high' | 'medium' | 'low' | 'info';

export interface StripOptions {
  keepIcc: boolean;
  keepOrientation: boolean;
  keepCopyright: boolean;
}

export const DEFAULT_STRIP_OPTIONS: StripOptions = {
  keepIcc: true,
  keepOrientation: true,
  keepCopyright: false,
};

export interface GpsInfo {
  lat: number;
  lon: number;
  alt: number | null;
}

export interface MetaReport {
  format: ImageFormat;
  gps: GpsInfo | null;
  gpsInXmp: boolean;
  make: string | null;
  model: string | null;
  lens: string | null;
  software: string | null;
  dateTaken: string | null;
  artist: string | null;
  copyright: string | null;
  description: string | null;
  orientation: number | null;
  serials: { label: string; value: string }[];
  makerNote: boolean;
  exif: { present: boolean; bytes: number; tags: number };
  xmp: { present: boolean; bytes: number };
  iptc: { present: boolean; bytes: number; fields: { label: string; value: string }[] };
  thumbnail: { present: boolean; bytes: number };
  icc: { present: boolean; bytes: number; description: string | null };
  comments: string[];
  textChunks: { key: string; value: string }[];
  c2pa: boolean;
  timestamp: string | null;
  /** bytes after the end of the image (EOI / IEND / RIFF end) */
  trailing: number;
  other: string[];
  truncated: boolean;
}

export interface Finding {
  id: string;
  label: string;
  detail: string;
  risk: Risk;
  /** true when the current options keep this item in the output */
  kept: boolean;
}

export interface StripResult {
  data: Uint8Array;
  before: MetaReport;
  after: MetaReport;
  findings: Finding[];
  notes: string[];
  /** true when the output carries no personal-metadata beyond what the options ask to keep */
  clean: boolean;
}

const dec8 = new TextDecoder('utf-8', { fatal: false });
const latin1 = (b: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]!);
  return s;
};

export function detectFormat(b: Uint8Array): ImageFormat | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) return 'png';
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) return 'webp';
  return null;
}

function emptyReport(format: ImageFormat): MetaReport {
  return {
    format,
    gps: null,
    gpsInXmp: false,
    make: null,
    model: null,
    lens: null,
    software: null,
    dateTaken: null,
    artist: null,
    copyright: null,
    description: null,
    orientation: null,
    serials: [],
    makerNote: false,
    exif: { present: false, bytes: 0, tags: 0 },
    xmp: { present: false, bytes: 0 },
    iptc: { present: false, bytes: 0, fields: [] },
    thumbnail: { present: false, bytes: 0 },
    icc: { present: false, bytes: 0, description: null },
    comments: [],
    textChunks: [],
    c2pa: false,
    timestamp: null,
    trailing: 0,
    other: [],
    truncated: false,
  };
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

function startsWithAscii(b: Uint8Array, at: number, s: string): boolean {
  if (at + s.length > b.length) return false;
  for (let i = 0; i < s.length; i++) if (b[at + i] !== s.charCodeAt(i)) return false;
  return true;
}

// ---------------------------------------------------------------------------------------------
// EXIF / TIFF
// ---------------------------------------------------------------------------------------------

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

interface Entry {
  tag: number;
  type: number;
  count: number;
  /** absolute offset of the value bytes inside the TIFF buffer */
  at: number;
  size: number;
}

class Tiff {
  readonly dv: DataView;
  readonly little: boolean;
  readonly valid: boolean;
  constructor(readonly buf: Uint8Array) {
    this.dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const b0 = buf[0];
    const b1 = buf[1];
    this.little = b0 === 0x49 && b1 === 0x49;
    this.valid = buf.length >= 8 && ((b0 === 0x49 && b1 === 0x49) || (b0 === 0x4d && b1 === 0x4d)) && this.dv.getUint16(2, this.little) === 42;
  }
  u16(o: number): number {
    return this.dv.getUint16(o, this.little);
  }
  u32(o: number): number {
    return this.dv.getUint32(o, this.little);
  }
  firstIfd(): number {
    return this.u32(4);
  }
  readIfd(offset: number): { entries: Entry[]; next: number } {
    const entries: Entry[] = [];
    if (offset < 8 || offset + 2 > this.buf.length) return { entries, next: 0 };
    const n = Math.min(this.u16(offset), 512);
    for (let i = 0; i < n; i++) {
      const e = offset + 2 + i * 12;
      if (e + 12 > this.buf.length) break;
      const type = this.u16(e + 2);
      const count = this.u32(e + 4);
      const unit = TYPE_SIZE[type];
      if (!unit) continue;
      const size = unit * count;
      let at = e + 8;
      if (size > 4) at = this.u32(e + 8);
      if (at < 0 || at + size > this.buf.length || count > 1 << 24) continue;
      entries.push({ tag: this.u16(e), type, count, at, size });
    }
    const nx = offset + 2 + n * 12;
    const next = nx + 4 <= this.buf.length ? this.u32(nx) : 0;
    return { entries, next };
  }
  ascii(e: Entry): string {
    let end = e.at + e.size;
    for (let i = e.at; i < e.at + e.size; i++) {
      if (this.buf[i] === 0) {
        end = i;
        break;
      }
    }
    return latin1(this.buf.subarray(e.at, end)).trim();
  }
  num(e: Entry, i = 0): number | null {
    const u = TYPE_SIZE[e.type]!;
    if (i >= e.count) return null;
    const o = e.at + i * u;
    switch (e.type) {
      case 1:
      case 7:
        return this.buf[o]!;
      case 3:
        return this.u16(o);
      case 4:
        return this.u32(o);
      case 8:
        return this.dv.getInt16(o, this.little);
      case 9:
        return this.dv.getInt32(o, this.little);
      case 5: {
        const d = this.u32(o + 4);
        return d === 0 ? null : this.u32(o) / d;
      }
      case 10: {
        const d = this.dv.getInt32(o + 4, this.little);
        return d === 0 ? null : this.dv.getInt32(o, this.little) / d;
      }
      default:
        return null;
    }
  }
}

function utf16le(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i + 1 < b.length; i += 2) {
    const c = b[i]! | (b[i + 1]! << 8);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s.trim();
}

/** Parse a TIFF/EXIF block (starting at the byte-order mark) into the report. Never throws. */
export function parseExifTiff(buf: Uint8Array, r: MetaReport): void {
  try {
    const t = new Tiff(buf);
    if (!t.valid) return;
    r.exif.present = true;
    r.exif.bytes += buf.length;
    const ifd0 = t.readIfd(t.firstIfd());
    r.exif.tags += ifd0.entries.length;
    let exifPtr = 0;
    let gpsPtr = 0;
    for (const e of ifd0.entries) {
      switch (e.tag) {
        case 0x010f:
          r.make = r.make ?? (t.ascii(e) || null);
          break;
        case 0x0110:
          r.model = r.model ?? (t.ascii(e) || null);
          break;
        case 0x0112: {
          const v = t.num(e);
          if (v !== null && v >= 1 && v <= 8) r.orientation = v;
          break;
        }
        case 0x0131:
          r.software = r.software ?? (t.ascii(e) || null);
          break;
        case 0x0132:
          r.timestamp = r.timestamp ?? (t.ascii(e) || null);
          break;
        case 0x013b:
          r.artist = r.artist ?? (t.ascii(e) || null);
          break;
        case 0x8298:
          r.copyright = r.copyright ?? (t.ascii(e) || null);
          break;
        case 0x010e:
          r.description = r.description ?? (t.ascii(e) || null);
          break;
        case 0x9c9d: {
          const s = utf16le(buf.subarray(e.at, e.at + e.size));
          if (s) r.artist = r.artist ?? s;
          break;
        }
        case 0x9c9c:
        case 0x9c9b: {
          const s = utf16le(buf.subarray(e.at, e.at + e.size));
          if (s) r.description = r.description ?? s;
          break;
        }
        case 0x8769:
          exifPtr = t.num(e) ?? 0;
          break;
        case 0x8825:
          gpsPtr = t.num(e) ?? 0;
          break;
        default:
          break;
      }
    }
    if (exifPtr) {
      const ex = t.readIfd(exifPtr);
      r.exif.tags += ex.entries.length;
      for (const e of ex.entries) {
        switch (e.tag) {
          case 0x9003:
            r.dateTaken = t.ascii(e) || r.dateTaken;
            break;
          case 0x9004:
            r.dateTaken = r.dateTaken ?? (t.ascii(e) || null);
            break;
          case 0xa430: {
            const v = t.ascii(e);
            if (v) r.serials.push({ label: 'Camera owner', value: v });
            break;
          }
          case 0xa431: {
            const v = t.ascii(e);
            if (v) r.serials.push({ label: 'Camera body serial', value: v });
            break;
          }
          case 0xa435: {
            const v = t.ascii(e);
            if (v) r.serials.push({ label: 'Lens serial', value: v });
            break;
          }
          case 0xa420: {
            const v = t.ascii(e);
            if (v) r.serials.push({ label: 'Unique image ID', value: v });
            break;
          }
          case 0xa434:
            r.lens = t.ascii(e) || r.lens;
            break;
          case 0x927c:
            r.makerNote = true;
            break;
          case 0x9286: {
            // UserComment: 8-byte charset prefix then text
            const raw = buf.subarray(e.at + 8, e.at + e.size);
            const s = (startsWithAscii(buf, e.at, 'UNICODE') ? utf16le(raw) : latin1(raw)).replace(/\0+/g, '').trim();
            if (s) r.comments.push(`EXIF comment: ${s}`);
            break;
          }
          default:
            break;
        }
      }
    }
    if (gpsPtr) {
      const g = t.readIfd(gpsPtr);
      r.exif.tags += g.entries.length;
      const get = (tag: number): Entry | undefined => g.entries.find((e) => e.tag === tag);
      const dms = (e: Entry | undefined): number | null => {
        if (!e || e.count < 1) return null;
        const d = t.num(e, 0);
        const m = e.count > 1 ? t.num(e, 1) : 0;
        const s = e.count > 2 ? t.num(e, 2) : 0;
        if (d === null) return null;
        return d + (m ?? 0) / 60 + (s ?? 0) / 3600;
      };
      const latE = get(2);
      const lonE = get(4);
      let lat = dms(latE);
      let lon = dms(lonE);
      if (lat !== null && lon !== null) {
        const latRef = get(1) ? t.ascii(get(1)!).toUpperCase() : 'N';
        const lonRef = get(3) ? t.ascii(get(3)!).toUpperCase() : 'E';
        if (latRef.startsWith('S')) lat = -lat;
        if (lonRef.startsWith('W')) lon = -lon;
        let alt: number | null = null;
        const altE = get(6);
        if (altE) {
          const a = t.num(altE);
          if (a !== null) {
            const ref = get(5) ? t.num(get(5)!) : 0;
            alt = ref === 1 ? -a : a;
          }
        }
        r.gps = { lat, lon, alt };
      } else if (g.entries.length > 0) {
        // GPS block present but no usable coordinates (e.g. only timestamp / version)
        r.other.push('GPS block without coordinates');
      }
    }
    // IFD1 = embedded thumbnail
    if (ifd0.next) {
      const ifd1 = t.readIfd(ifd0.next);
      r.exif.tags += ifd1.entries.length;
      const off = ifd1.entries.find((e) => e.tag === 0x0201);
      const len = ifd1.entries.find((e) => e.tag === 0x0202);
      const strips = ifd1.entries.find((e) => e.tag === 0x0111);
      if (off && len) {
        r.thumbnail = { present: true, bytes: t.num(len) ?? 0 };
      } else if (strips) {
        r.thumbnail = { present: true, bytes: 0 };
      }
    }
  } catch {
    /* malformed EXIF: report what we have */
  }
}

/** Build a TIFF block that only carries Orientation and/or Copyright. */
export function buildMinimalTiff(orientation: number | null, copyright: string | null): Uint8Array {
  const entries: { tag: number; type: number; count: number; value: Uint8Array }[] = [];
  if (orientation !== null) entries.push({ tag: 0x0112, type: 3, count: 1, value: new Uint8Array([orientation & 255, 0]) });
  if (copyright) {
    const s = new TextEncoder().encode(copyright.replace(/[^\x20-\x7e]/g, '?'));
    const v = new Uint8Array(s.length + 1);
    v.set(s);
    entries.push({ tag: 0x8298, type: 2, count: v.length, value: v });
  }
  const n = entries.length;
  const ifdSize = 2 + n * 12 + 4;
  let dataLen = 0;
  for (const e of entries) if (e.value.length > 4) dataLen += e.value.length + (e.value.length & 1);
  const out = new Uint8Array(8 + ifdSize + dataLen);
  const dv = new DataView(out.buffer);
  out.set([0x49, 0x49, 0x2a, 0x00], 0);
  dv.setUint32(4, 8, true);
  dv.setUint16(8, n, true);
  let dataPos = 8 + ifdSize;
  entries.forEach((e, i) => {
    const o = 10 + i * 12;
    dv.setUint16(o, e.tag, true);
    dv.setUint16(o + 2, e.type, true);
    dv.setUint32(o + 4, e.count, true);
    if (e.value.length <= 4) {
      out.set(e.value, o + 8);
    } else {
      dv.setUint32(o + 8, dataPos, true);
      out.set(e.value, dataPos);
      dataPos += e.value.length + (e.value.length & 1);
    }
  });
  dv.setUint32(10 + n * 12, 0, true);
  return out;
}

// ---------------------------------------------------------------------------------------------
// XMP / IPTC / ICC helpers
// ---------------------------------------------------------------------------------------------

function inspectXmp(xml: string, r: MetaReport): void {
  if (/GPSLatitude|GPSLongitude/.test(xml)) r.gpsInXmp = true;
  const tool = /xmp:CreatorTool(?:="([^"]*)"|>([^<]*)<)/.exec(xml);
  if (tool) r.software = r.software ?? ((tool[1] ?? tool[2] ?? '').trim() || null);
  const make = /tiff:Make(?:="([^"]*)"|>([^<]*)<)/.exec(xml);
  if (make) r.make = r.make ?? ((make[1] ?? make[2] ?? '').trim() || null);
  const model = /tiff:Model(?:="([^"]*)"|>([^<]*)<)/.exec(xml);
  if (model) r.model = r.model ?? ((model[1] ?? model[2] ?? '').trim() || null);
  const dt = /exif:DateTimeOriginal(?:="([^"]*)"|>([^<]*)<)/.exec(xml);
  if (dt) r.dateTaken = r.dateTaken ?? ((dt[1] ?? dt[2] ?? '').trim() || null);
}

const IPTC_NAMES: Record<number, string> = {
  5: 'Title',
  25: 'Keyword',
  80: 'By-line',
  85: 'By-line title',
  90: 'City',
  92: 'Sub-location',
  95: 'State',
  101: 'Country',
  105: 'Headline',
  110: 'Credit',
  115: 'Source',
  116: 'Copyright',
  120: 'Caption',
  122: 'Caption writer',
};

function parseIptcIim(b: Uint8Array, r: MetaReport): void {
  let i = 0;
  while (i + 5 <= b.length) {
    if (b[i] !== 0x1c) {
      i++;
      continue;
    }
    const rec = b[i + 1]!;
    const ds = b[i + 2]!;
    let len = (b[i + 3]! << 8) | b[i + 4]!;
    let p = i + 5;
    if (len & 0x8000) {
      const nb = len & 0x7fff;
      len = 0;
      for (let k = 0; k < nb && p + k < b.length; k++) len = len * 256 + b[p + k]!;
      p += nb;
    }
    if (p + len > b.length) break;
    if (rec === 2 && IPTC_NAMES[ds]) {
      const value = dec8.decode(b.subarray(p, p + len)).trim();
      if (value) r.iptc.fields.push({ label: IPTC_NAMES[ds]!, value });
    }
    i = p + len;
  }
}

function parsePhotoshopIrb(b: Uint8Array, r: MetaReport): void {
  // b starts right after "Photoshop 3.0\0"
  let i = 0;
  while (i + 12 <= b.length && startsWithAscii(b, i, '8BIM')) {
    const id = (b[i + 4]! << 8) | b[i + 5]!;
    let p = i + 6;
    const nameLen = b[p]!;
    p += 1 + nameLen;
    if ((1 + nameLen) & 1) p++;
    if (p + 4 > b.length) break;
    const size = ((b[p]! << 24) | (b[p + 1]! << 16) | (b[p + 2]! << 8) | b[p + 3]!) >>> 0;
    p += 4;
    if (p + size > b.length) break;
    if (id === 0x0404) parseIptcIim(b.subarray(p, p + size), r);
    i = p + size + (size & 1);
  }
}

function be32(b: Uint8Array, o: number): number {
  return ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0;
}

/** Best-effort description from an ICC profile (v2 'desc' or v4 'mluc'). */
export function iccDescription(p: Uint8Array): string | null {
  try {
    if (p.length < 132) return null;
    const n = be32(p, 128);
    for (let i = 0; i < Math.min(n, 100); i++) {
      const o = 132 + i * 12;
      if (o + 12 > p.length) break;
      if (!startsWithAscii(p, o, 'desc')) continue;
      const off = be32(p, o + 4);
      const size = be32(p, o + 8);
      if (off + size > p.length || size < 12) return null;
      if (startsWithAscii(p, off, 'desc')) {
        const len = be32(p, off + 8);
        return latin1(p.subarray(off + 12, off + 12 + Math.max(0, len - 1))).trim() || null;
      }
      if (startsWithAscii(p, off, 'mluc')) {
        const recSize = be32(p, off + 12);
        const strLen = be32(p, off + 20);
        const strOff = be32(p, off + 24);
        if (recSize < 12 || off + strOff + strLen > p.length) return null;
        let s = '';
        for (let k = 0; k + 1 < strLen; k += 2) s += String.fromCharCode((p[off + strOff + k]! << 8) | p[off + strOff + k + 1]!);
        return s.trim() || null;
      }
      return null;
    }
  } catch {
    /* ignore */
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// JPEG
// ---------------------------------------------------------------------------------------------

interface JpegSeg {
  marker: number;
  start: number;
  end: number;
  /** payload start (after marker + length) for segments with a length */
  payload: number;
  /** end of the SOS header (entropy data follows) */
  headerEnd?: number;
}

interface JpegLayout {
  segs: JpegSeg[];
  /** offset right after EOI, or -1 if the file has no EOI */
  eoiEnd: number;
}

function walkJpeg(b: Uint8Array): JpegLayout {
  const segs: JpegSeg[] = [];
  const n = b.length;
  let i = 2;
  let eoiEnd = -1;
  while (i + 1 < n) {
    if (b[i] !== 0xff) break;
    while (i + 1 < n && b[i + 1] === 0xff) i++;
    if (i + 1 >= n) break;
    const marker = b[i + 1]!;
    if (marker === 0xd9) {
      segs.push({ marker, start: i, end: i + 2, payload: i + 2 });
      eoiEnd = i + 2;
      break;
    }
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      segs.push({ marker, start: i, end: i + 2, payload: i + 2 });
      i += 2;
      continue;
    }
    if (i + 4 > n) break;
    const len = (b[i + 2]! << 8) | b[i + 3]!;
    const segEnd = i + 2 + len;
    if (len < 2 || segEnd > n) {
      segs.push({ marker, start: i, end: n, payload: Math.min(n, i + 4) });
      i = n;
      break;
    }
    if (marker === 0xda) {
      let j = segEnd;
      while (j < n) {
        if (b[j] === 0xff) {
          const nb = b[j + 1];
          if (nb === undefined) {
            j = n;
            break;
          }
          if (nb === 0x00 || (nb >= 0xd0 && nb <= 0xd7)) {
            j += 2;
            continue;
          }
          if (nb === 0xff) {
            j += 1;
            continue;
          }
          break;
        }
        j++;
      }
      segs.push({ marker, start: i, end: j, payload: i + 4, headerEnd: segEnd });
      i = j;
      continue;
    }
    segs.push({ marker, start: i, end: segEnd, payload: i + 4 });
    i = segEnd;
  }
  return { segs, eoiEnd };
}

type JpegKind =
  | 'jfif'
  | 'jfxx'
  | 'exif'
  | 'xmp'
  | 'xmp-ext'
  | 'app1-other'
  | 'icc'
  | 'mpf'
  | 'adobe'
  | 'iptc'
  | 'c2pa'
  | 'comment'
  | 'app-other'
  | 'image';

function classifyJpeg(b: Uint8Array, s: JpegSeg): JpegKind {
  const m = s.marker;
  const p = s.payload;
  if (m === 0xfe) return 'comment';
  if (m === 0xe0) {
    if (startsWithAscii(b, p, 'JFIF\0')) return 'jfif';
    if (startsWithAscii(b, p, 'JFXX\0')) return 'jfxx';
    return 'app-other';
  }
  if (m === 0xe1) {
    if (startsWithAscii(b, p, 'Exif\0')) return 'exif';
    if (startsWithAscii(b, p, 'http://ns.adobe.com/xap/1.0/\0')) return 'xmp';
    if (startsWithAscii(b, p, 'http://ns.adobe.com/xmp/extension/\0')) return 'xmp-ext';
    return 'app1-other';
  }
  if (m === 0xe2) {
    if (startsWithAscii(b, p, 'ICC_PROFILE\0')) return 'icc';
    if (startsWithAscii(b, p, 'MPF\0')) return 'mpf';
    return 'app-other';
  }
  if (m === 0xed && startsWithAscii(b, p, 'Photoshop 3.0\0')) return 'iptc';
  if (m === 0xeb && b[p] === 0x4a && b[p + 1] === 0x50) return 'c2pa';
  if (m === 0xee && startsWithAscii(b, p, 'Adobe')) return 'adobe';
  if (m >= 0xe0 && m <= 0xef) return 'app-other';
  return 'image';
}

function jpegKept(kind: JpegKind, opts: StripOptions): boolean {
  switch (kind) {
    case 'jfif':
    case 'adobe':
    case 'image':
      return true;
    case 'icc':
      return opts.keepIcc;
    default:
      return false;
  }
}

function analyzeJpeg(b: Uint8Array): MetaReport {
  const r = emptyReport('jpeg');
  const layout = walkJpeg(b);
  r.truncated = layout.eoiEnd < 0;
  if (layout.eoiEnd >= 0) r.trailing = b.length - layout.eoiEnd;
  const iccParts: { seq: number; data: Uint8Array }[] = [];
  const xmpTexts: string[] = [];
  for (const s of layout.segs) {
    const kind = classifyJpeg(b, s);
    const size = s.end - s.start;
    switch (kind) {
      case 'exif':
        parseExifTiff(b.subarray(s.payload + 6, s.end), r);
        break;
      case 'xmp':
        r.xmp.present = true;
        r.xmp.bytes += size;
        xmpTexts.push(dec8.decode(b.subarray(s.payload + 29, s.end)));
        break;
      case 'xmp-ext':
        r.xmp.present = true;
        r.xmp.bytes += size;
        break;
      case 'icc':
        iccParts.push({ seq: b[s.payload + 12] ?? 0, data: b.subarray(s.payload + 14, s.end) });
        r.icc.present = true;
        r.icc.bytes += size;
        break;
      case 'iptc':
        r.iptc.present = true;
        r.iptc.bytes += size;
        parsePhotoshopIrb(b.subarray(s.payload + 14, s.end), r);
        break;
      case 'comment': {
        const t = dec8.decode(b.subarray(s.payload, s.end)).replace(/\0+$/g, '').trim();
        r.comments.push(t ? t : '(empty comment)');
        break;
      }
      case 'c2pa':
        r.c2pa = true;
        break;
      case 'mpf':
        r.other.push('Multi-picture (MPF) index');
        break;
      case 'jfxx':
        r.thumbnail = { present: true, bytes: size };
        break;
      case 'jfif': {
        const tx = b[s.payload + 12] ?? 0;
        const ty = b[s.payload + 13] ?? 0;
        if (tx * ty > 0) r.thumbnail = { present: true, bytes: tx * ty * 3 };
        break;
      }
      case 'app1-other':
        r.other.push(`Extra APP1 segment (${size} bytes)`);
        break;
      case 'app-other':
        r.other.push(`APP${s.marker - 0xe0} segment (${size} bytes)`);
        break;
      default:
        break;
    }
  }
  if (iccParts.length) {
    iccParts.sort((a, c) => a.seq - c.seq);
    r.icc.description = iccDescription(concat(iccParts.map((p) => p.data)));
  }
  for (const x of xmpTexts) inspectXmp(x, r);
  return r;
}

function buildJpegExif(orientation: number | null, copyright: string | null): Uint8Array | null {
  if (orientation === null && !copyright) return null;
  const tiff = buildMinimalTiff(orientation, copyright);
  const len = 2 + 6 + tiff.length;
  const out = new Uint8Array(2 + len);
  out[0] = 0xff;
  out[1] = 0xe1;
  out[2] = (len >> 8) & 255;
  out[3] = len & 255;
  out.set([0x45, 0x78, 0x69, 0x66, 0, 0], 4);
  out.set(tiff, 10);
  return out;
}

function chosenOrientation(r: MetaReport, opts: StripOptions): number | null {
  return opts.keepOrientation && r.orientation !== null && r.orientation !== 1 ? r.orientation : null;
}

function chosenCopyright(r: MetaReport, opts: StripOptions): string | null {
  return opts.keepCopyright && r.copyright ? r.copyright : null;
}

function stripJpeg(b: Uint8Array, opts: StripOptions, before: MetaReport, notes: string[]): Uint8Array {
  const layout = walkJpeg(b);
  const parts: Uint8Array[] = [b.subarray(0, 2)];
  const exif = buildJpegExif(chosenOrientation(before, opts), chosenCopyright(before, opts));
  let exifPending = exif !== null;
  let firstKept = true;
  for (const s of layout.segs) {
    const kind = classifyJpeg(b, s);
    if (!jpegKept(kind, opts)) continue;
    if (exifPending && exif && !(firstKept && kind === 'jfif')) {
      parts.push(exif);
      exifPending = false;
    }
    firstKept = false;
    if (kind === 'jfif') {
      const tx = b[s.payload + 12] ?? 0;
      const ty = b[s.payload + 13] ?? 0;
      if (s.end - s.start > 18 && tx * ty > 0) {
        const seg = new Uint8Array(18);
        seg.set(b.subarray(s.start, s.start + 18));
        seg[2] = 0;
        seg[3] = 16;
        seg[16] = 0;
        seg[17] = 0;
        parts.push(seg);
      } else {
        parts.push(b.subarray(s.start, s.end));
      }
      if (exifPending && exif) {
        parts.push(exif);
        exifPending = false;
      }
      continue;
    }
    parts.push(b.subarray(s.start, s.end));
  }
  if (exifPending && exif) parts.push(exif);
  if (layout.eoiEnd < 0) notes.push('The JPEG has no end-of-image marker (file may be truncated); everything kept was copied as-is.');
  return concat(parts);
}

// ---------------------------------------------------------------------------------------------
// PNG
// ---------------------------------------------------------------------------------------------

interface PngChunkRef {
  type: string;
  start: number;
  end: number;
  dataStart: number;
  dataEnd: number;
}

function walkPng(b: Uint8Array): { chunks: PngChunkRef[]; end: number } {
  const chunks: PngChunkRef[] = [];
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let p = 8;
  while (p + 12 <= b.length) {
    const len = dv.getUint32(p);
    const end = p + 12 + len;
    if (end > b.length) {
      chunks.push({ type: String.fromCharCode(b[p + 4]!, b[p + 5]!, b[p + 6]!, b[p + 7]!), start: p, end: b.length, dataStart: p + 8, dataEnd: b.length });
      p = b.length;
      break;
    }
    const type = String.fromCharCode(b[p + 4]!, b[p + 5]!, b[p + 6]!, b[p + 7]!);
    chunks.push({ type, start: p, end, dataStart: p + 8, dataEnd: p + 8 + len });
    p = end;
    if (type === 'IEND') break;
  }
  return { chunks, end: p };
}

const PNG_DROP = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME', 'caBX', 'prVW', 'mkBT', 'mkTS', 'mkBS', 'mkBF', 'meTa', 'dSIG']);

function nul(b: Uint8Array, from: number, to: number): number {
  for (let i = from; i < to; i++) if (b[i] === 0) return i;
  return -1;
}

function analyzePng(b: Uint8Array): MetaReport {
  const r = emptyReport('png');
  const { chunks, end } = walkPng(b);
  r.truncated = !chunks.some((c) => c.type === 'IEND');
  if (!r.truncated) r.trailing = b.length - end;
  for (const c of chunks) {
    const d = b.subarray(c.dataStart, c.dataEnd);
    switch (c.type) {
      case 'tEXt': {
        const z = nul(d, 0, d.length);
        if (z > 0) r.textChunks.push({ key: latin1(d.subarray(0, z)), value: latin1(d.subarray(z + 1)) });
        break;
      }
      case 'zTXt': {
        const z = nul(d, 0, d.length);
        if (z > 0) {
          let value = '(compressed)';
          try {
            value = dec8.decode(unzlibSync(d.subarray(z + 2)));
          } catch {
            /* keep placeholder */
          }
          r.textChunks.push({ key: latin1(d.subarray(0, z)), value });
        }
        break;
      }
      case 'iTXt': {
        const z = nul(d, 0, d.length);
        if (z > 0 && z + 3 < d.length) {
          const key = latin1(d.subarray(0, z));
          const compressed = d[z + 1] === 1;
          const z2 = nul(d, z + 3, d.length);
          const z3 = z2 >= 0 ? nul(d, z2 + 1, d.length) : -1;
          if (z3 >= 0) {
            let text = '';
            try {
              text = dec8.decode(compressed ? unzlibSync(d.subarray(z3 + 1)) : d.subarray(z3 + 1));
            } catch {
              text = '(compressed)';
            }
            if (key === 'XML:com.adobe.xmp') {
              r.xmp.present = true;
              r.xmp.bytes += c.end - c.start;
              inspectXmp(text, r);
            } else {
              r.textChunks.push({ key, value: text });
            }
          }
        }
        break;
      }
      case 'eXIf':
        parseExifTiff(d, r);
        break;
      case 'tIME':
        if (d.length >= 7) {
          const y = (d[0]! << 8) | d[1]!;
          const pad = (v: number) => String(v).padStart(2, '0');
          r.timestamp = `${y}-${pad(d[2]!)}-${pad(d[3]!)} ${pad(d[4]!)}:${pad(d[5]!)}:${pad(d[6]!)}`;
        }
        break;
      case 'iCCP': {
        r.icc.present = true;
        r.icc.bytes += c.end - c.start;
        const z = nul(d, 0, d.length);
        if (z > 0) {
          const name = latin1(d.subarray(0, z));
          r.icc.description = name;
          try {
            r.icc.description = iccDescription(unzlibSync(d.subarray(z + 2))) ?? name;
          } catch {
            /* keep name */
          }
        }
        break;
      }
      case 'caBX':
        r.c2pa = true;
        break;
      case 'prVW':
      case 'mkBT':
      case 'mkTS':
      case 'mkBS':
      case 'mkBF':
      case 'meTa':
      case 'dSIG':
        r.other.push(`${c.type} chunk (${c.end - c.start} bytes)`);
        break;
      default:
        break;
    }
  }
  for (const t of r.textChunks) {
    const k = t.key.toLowerCase();
    if (k === 'software' && !r.software) r.software = t.value;
    else if (k === 'author' && !r.artist) r.artist = t.value;
    else if (k === 'copyright' && !r.copyright) r.copyright = t.value;
    else if (k === 'creation time' && !r.timestamp) r.timestamp = t.value;
    else if (k === 'description' && !r.description) r.description = t.value;
  }
  return r;
}

function u32be(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
}

const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const td = new Uint8Array(4 + data.length);
  for (let i = 0; i < 4; i++) td[i] = type.charCodeAt(i);
  td.set(data, 4);
  return concat([u32be(data.length), td, u32be(crc32(td))]);
}

function stripPng(b: Uint8Array, opts: StripOptions, before: MetaReport): Uint8Array {
  const { chunks } = walkPng(b);
  const parts: Uint8Array[] = [b.subarray(0, 8)];
  const tiff =
    chosenOrientation(before, opts) !== null || chosenCopyright(before, opts)
      ? buildMinimalTiff(chosenOrientation(before, opts), chosenCopyright(before, opts))
      : null;
  let exifPending = tiff !== null;
  for (const c of chunks) {
    if (PNG_DROP.has(c.type)) continue;
    if (c.type === 'iCCP' && !opts.keepIcc) continue;
    if (exifPending && tiff && (c.type === 'IDAT' || c.type === 'IEND')) {
      parts.push(pngChunk('eXIf', tiff));
      exifPending = false;
    }
    parts.push(b.subarray(c.start, c.end));
  }
  return concat(parts);
}

// ---------------------------------------------------------------------------------------------
// WebP
// ---------------------------------------------------------------------------------------------

interface WebpChunk {
  fourcc: string;
  start: number;
  end: number; // includes padding byte
  dataStart: number;
  dataEnd: number;
}

function walkWebp(b: Uint8Array): { chunks: WebpChunk[]; riffEnd: number } {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const declared = dv.getUint32(4, true) + 8;
  const riffEnd = Math.min(b.length, Math.max(12, declared));
  const chunks: WebpChunk[] = [];
  let p = 12;
  while (p + 8 <= riffEnd) {
    const fourcc = String.fromCharCode(b[p]!, b[p + 1]!, b[p + 2]!, b[p + 3]!);
    const size = dv.getUint32(p + 4, true);
    const dataEnd = Math.min(riffEnd, p + 8 + size);
    const end = Math.min(riffEnd, p + 8 + size + (size & 1));
    chunks.push({ fourcc, start: p, end, dataStart: p + 8, dataEnd });
    p = end;
  }
  return { chunks, riffEnd };
}

function analyzeWebp(b: Uint8Array): MetaReport {
  const r = emptyReport('webp');
  const { chunks, riffEnd } = walkWebp(b);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  r.truncated = dv.getUint32(4, true) + 8 > b.length;
  r.trailing = Math.max(0, b.length - riffEnd);
  for (const c of chunks) {
    const d = b.subarray(c.dataStart, c.dataEnd);
    if (c.fourcc === 'EXIF') {
      const off = startsWithAscii(d, 0, 'Exif\0\0') ? 6 : 0;
      r.exif.present = true;
      const before = r.exif.bytes;
      parseExifTiff(d.subarray(off), r);
      if (r.exif.bytes === before) r.exif.bytes = d.length;
    } else if (c.fourcc === 'XMP ') {
      r.xmp.present = true;
      r.xmp.bytes += d.length;
      inspectXmp(dec8.decode(d), r);
    } else if (c.fourcc === 'ICCP') {
      r.icc.present = true;
      r.icc.bytes += d.length;
      r.icc.description = iccDescription(d);
    }
  }
  return r;
}

function buildExifChunkWebp(tiff: Uint8Array): Uint8Array {
  const pad = tiff.length & 1;
  const out = new Uint8Array(8 + tiff.length + pad);
  out.set([0x45, 0x58, 0x49, 0x46], 0);
  new DataView(out.buffer).setUint32(4, tiff.length, true);
  out.set(tiff, 8);
  return out;
}

function stripWebp(b: Uint8Array, opts: StripOptions, before: MetaReport): Uint8Array {
  const { chunks } = walkWebp(b);
  const tiff =
    chosenOrientation(before, opts) !== null || chosenCopyright(before, opts)
      ? buildMinimalTiff(chosenOrientation(before, opts), chosenCopyright(before, opts))
      : null;
  const body: Uint8Array[] = [];
  let vp8xIndex = -1;
  for (const c of chunks) {
    if (c.fourcc === 'EXIF' || c.fourcc === 'XMP ') continue;
    if (c.fourcc === 'ICCP' && !opts.keepIcc) continue;
    if (c.fourcc === 'VP8X' && c.dataEnd - c.dataStart >= 10) {
      const copy = new Uint8Array(b.subarray(c.start, c.end));
      copy[8] = copy[8]! & ~(0x08 | 0x04);
      if (!opts.keepIcc) copy[8] = copy[8]! & ~0x20;
      vp8xIndex = body.length;
      body.push(copy);
      continue;
    }
    body.push(b.subarray(c.start, c.end));
  }
  if (tiff && vp8xIndex >= 0) {
    const v = body[vp8xIndex]!;
    v[8] = v[8]! | 0x08;
    body.push(buildExifChunkWebp(tiff));
  }
  const bodyLen = body.reduce((n, p) => n + p.length, 0);
  const head = new Uint8Array(12);
  head.set(b.subarray(0, 12));
  new DataView(head.buffer).setUint32(4, 4 + bodyLen, true);
  return concat([head, ...body]);
}

// ---------------------------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------------------------

export function analyze(bytes: Uint8Array): MetaReport {
  const f = detectFormat(bytes);
  if (!f) throw new Error('Unsupported file — only JPEG, PNG and WebP images are supported.');
  switch (f) {
    case 'jpeg':
      return analyzeJpeg(bytes);
    case 'png':
      return analyzePng(bytes);
    default:
      return analyzeWebp(bytes);
  }
}

const fmtCoord = (n: number): string => n.toFixed(6);

export function describeFindings(r: MetaReport, opts: StripOptions): Finding[] {
  const out: Finding[] = [];
  const add = (id: string, label: string, detail: string, risk: Risk, kept = false) => out.push({ id, label, detail, risk, kept });
  if (r.gps) {
    add(
      'gps',
      'GPS location',
      `${fmtCoord(r.gps.lat)}, ${fmtCoord(r.gps.lon)}${r.gps.alt !== null ? ` · altitude ${r.gps.alt.toFixed(1)} m` : ''}`,
      'high'
    );
  }
  if (r.gpsInXmp) add('gps-xmp', 'GPS location in XMP', 'Coordinates stored in the XMP packet', 'high');
  if (r.serials.length) {
    for (const s of r.serials) {
      add(`serial-${s.label}`, s.label, s.value, 'high');
    }
  }
  if (r.make || r.model) add('camera', 'Camera make / model', [r.make, r.model].filter(Boolean).join(' '), 'medium');
  if (r.lens) add('lens', 'Lens', r.lens, 'low');
  if (r.artist) add('artist', 'Author / artist', r.artist, 'medium');
  if (r.dateTaken) add('date', 'Date taken', r.dateTaken, 'medium');
  else if (r.timestamp) add('date', 'Date / time stamp', r.timestamp, 'medium');
  if (r.software) add('software', 'Software', r.software, 'low');
  if (r.description) add('description', 'Description', r.description.length > 140 ? r.description.slice(0, 140) + '…' : r.description, 'medium');
  if (r.copyright) add('copyright', 'Copyright notice', r.copyright, 'info', opts.keepCopyright);
  if (r.makerNote) add('makernote', 'Maker note', 'Vendor-specific data that can include serial numbers and settings', 'medium');
  if (r.thumbnail.present) {
    add('thumbnail', 'Embedded thumbnail', r.thumbnail.bytes ? `${r.thumbnail.bytes} bytes — can reveal the un-cropped original` : 'Preview image inside the file', 'medium');
  }
  if (r.exif.present) {
    const orientationKept = opts.keepOrientation && r.orientation !== null && r.orientation !== 1;
    add('exif', 'EXIF block', `${r.exif.tags} tags · ${r.exif.bytes} bytes`, 'info');
    if (r.orientation !== null) {
      add('orientation', 'Orientation', `value ${r.orientation}${orientationKept ? ' (kept so the photo is not rotated)' : ''}`, 'info', orientationKept);
    }
  }
  if (r.xmp.present) add('xmp', 'XMP metadata', `${r.xmp.bytes} bytes`, 'medium');
  if (r.iptc.present) {
    const f = r.iptc.fields.slice(0, 4).map((x) => `${x.label}: ${x.value}`).join(' · ');
    add('iptc', 'IPTC / Photoshop data', f || `${r.iptc.bytes} bytes`, 'medium');
  }
  if (r.icc.present) add('icc', 'ICC colour profile', r.icc.description ?? `${r.icc.bytes} bytes`, 'info', opts.keepIcc);
  for (const [i, c] of r.comments.entries()) add(`comment-${i}`, 'Comment', c.length > 140 ? c.slice(0, 140) + '…' : c, 'medium');
  for (const [i, t] of r.textChunks.entries()) {
    const v = t.value.replace(/\s+/g, ' ');
    add(`text-${i}`, `Text: ${t.key}`, v.length > 140 ? v.slice(0, 140) + '…' : v || '(empty)', 'medium');
  }
  if (r.c2pa) add('c2pa', 'Content Credentials (C2PA)', 'Signed provenance manifest — removing it invalidates the signature', 'medium');
  if (r.trailing > 0) add('trailing', 'Data appended after the image', `${r.trailing} bytes (e.g. extra pictures / MPF, motion-photo video, hidden payload)`, 'medium');
  for (const [i, o] of r.other.entries()) add(`other-${i}`, 'Other embedded data', o, 'low');
  return out;
}

export function stripMetadata(bytes: Uint8Array, opts: StripOptions): StripResult {
  const before = analyze(bytes);
  const notes: string[] = [];
  let data: Uint8Array;
  switch (before.format) {
    case 'jpeg':
      data = stripJpeg(bytes, opts, before, notes);
      break;
    case 'png':
      data = stripPng(bytes, opts, before);
      break;
    default:
      data = stripWebp(bytes, opts, before);
      break;
  }
  if (before.trailing > 0) notes.push(`Dropped ${before.trailing} bytes of data appended after the end of the image.`);
  if (before.truncated) notes.push('The file looks truncated; it was processed as far as it could be read.');
  let after: MetaReport;
  try {
    after = analyze(data);
  } catch {
    after = emptyReport(before.format);
  }
  const findings = describeFindings(before, opts);
  const remaining = describeFindings(after, opts).filter(
    (f) => f.risk !== 'info' || ((f.id === 'copyright' || f.id === 'icc') && !f.kept)
  );
  return { data, before, after, findings, notes, clean: remaining.length === 0 };
}

// ---------------------------------------------------------------------------------------------
// Demo helper: decorate a plain JPEG with realistic (fictional) metadata
// ---------------------------------------------------------------------------------------------

interface TagVal {
  tag: number;
  type: 1 | 2 | 3 | 4 | 5 | 7;
  value: string | number | number[] | [number, number][] | Uint8Array;
}

function encodeTagVal(v: TagVal): { bytes: Uint8Array; count: number } {
  switch (v.type) {
    case 2: {
      const s = new TextEncoder().encode(String(v.value));
      const out = new Uint8Array(s.length + 1);
      out.set(s);
      return { bytes: out, count: out.length };
    }
    case 3: {
      const arr = Array.isArray(v.value) ? (v.value as number[]) : [Number(v.value)];
      const out = new Uint8Array(arr.length * 2);
      const dv = new DataView(out.buffer);
      arr.forEach((n, i) => dv.setUint16(i * 2, n, true));
      return { bytes: out, count: arr.length };
    }
    case 4: {
      const arr = Array.isArray(v.value) ? (v.value as number[]) : [Number(v.value)];
      const out = new Uint8Array(arr.length * 4);
      const dv = new DataView(out.buffer);
      arr.forEach((n, i) => dv.setUint32(i * 4, n, true));
      return { bytes: out, count: arr.length };
    }
    case 5: {
      const arr = v.value as [number, number][];
      const out = new Uint8Array(arr.length * 8);
      const dv = new DataView(out.buffer);
      arr.forEach(([n, d], i) => {
        dv.setUint32(i * 8, n, true);
        dv.setUint32(i * 8 + 4, d, true);
      });
      return { bytes: out, count: arr.length };
    }
    default: {
      const arr = v.value instanceof Uint8Array ? v.value : Uint8Array.from(v.value as number[]);
      return { bytes: arr, count: arr.length };
    }
  }
}

function writeTiffLE(ifd0: TagVal[], exif: TagVal[], gps: TagVal[]): Uint8Array {
  const p0: TagVal[] = [...ifd0, { tag: 0x8769, type: 4, value: 0 }, { tag: 0x8825, type: 4, value: 0 }];
  const sizeOf = (n: number) => 2 + n * 12 + 4;
  const exifOff = 8 + sizeOf(p0.length);
  const gpsOff = exifOff + sizeOf(exif.length);
  const dataStart = gpsOff + sizeOf(gps.length);
  const blobs: Uint8Array[] = [];
  let dataLen = 0;
  const build = (entries: TagVal[], at: number): Uint8Array => {
    const sorted = [...entries].sort((a, b) => a.tag - b.tag);
    const out = new Uint8Array(sizeOf(sorted.length));
    const dv = new DataView(out.buffer);
    dv.setUint16(0, sorted.length, true);
    sorted.forEach((e, i) => {
      const o = 2 + i * 12;
      dv.setUint16(o, e.tag, true);
      dv.setUint16(o + 2, e.type, true);
      let val = e;
      if (e.tag === 0x8769) val = { ...e, value: exifOff };
      if (e.tag === 0x8825) val = { ...e, value: gpsOff };
      const enc = encodeTagVal(val);
      dv.setUint32(o + 4, enc.count, true);
      if (enc.bytes.length <= 4) out.set(enc.bytes, o + 8);
      else {
        dv.setUint32(o + 8, dataStart + dataLen, true);
        const padded = new Uint8Array(enc.bytes.length + (enc.bytes.length & 1));
        padded.set(enc.bytes);
        blobs.push(padded);
        dataLen += padded.length;
      }
    });
    void at;
    return out;
  };
  const a = build(p0, 8);
  const b = build(exif, exifOff);
  const c = build(gps, gpsOff);
  const head = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 8, 0, 0, 0]);
  return concat([head, a, b, c, ...blobs]);
}

function jpegSegment(marker: number, payload: Uint8Array): Uint8Array {
  const len = payload.length + 2;
  const out = new Uint8Array(4 + payload.length);
  out[0] = 0xff;
  out[1] = marker;
  out[2] = (len >> 8) & 255;
  out[3] = len & 255;
  out.set(payload, 4);
  return out;
}

/** Add fictional EXIF (with GPS), XMP, IPTC and a comment to a JPEG, to demonstrate the tool. */
export function buildSampleJpeg(base: Uint8Array): Uint8Array {
  const enc = new TextEncoder();
  const tiff = writeTiffLE(
    [
      { tag: 0x010f, type: 2, value: 'Contoso' },
      { tag: 0x0110, type: 2, value: 'PhotoPhone 12 Pro' },
      { tag: 0x0131, type: 2, value: 'PhotoPhone OS 17.2' },
      { tag: 0x0132, type: 2, value: '2024:06:15 18:42:07' },
      { tag: 0x013b, type: 2, value: 'Alex Example' },
      { tag: 0x8298, type: 2, value: '(c) 2024 Alex Example' },
    ],
    [
      { tag: 0x9003, type: 2, value: '2024:06:15 18:42:07' },
      { tag: 0xa430, type: 2, value: 'Alex Example' },
      { tag: 0xa431, type: 2, value: 'SN-48210-X' },
      { tag: 0xa434, type: 2, value: '24-70mm f/2.8' },
      { tag: 0xa435, type: 2, value: 'LN-77120' },
      { tag: 0x927c, type: 7, value: new Uint8Array(24).fill(0x41) },
    ],
    [
      { tag: 0x0001, type: 2, value: 'N' },
      { tag: 0x0002, type: 5, value: [[48, 1], [51, 1], [2961, 100]] },
      { tag: 0x0003, type: 2, value: 'E' },
      { tag: 0x0004, type: 5, value: [[2, 1], [17, 1], [4012, 100]] },
      { tag: 0x0005, type: 1, value: [0] },
      { tag: 0x0006, type: 5, value: [[3500, 100]] },
    ]
  );
  const exifPayload = concat([enc.encode('Exif\0\0'), tiff]);
  const xmp = enc.encode(
    '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmp:CreatorTool="PhotoPhone OS 17.2"/></rdf:RDF></x:xmpmeta><?xpacket end="w"?>'
  );
  const ds = (n: number, v: string): Uint8Array => {
    const b = enc.encode(v);
    return concat([new Uint8Array([0x1c, 2, n, (b.length >> 8) & 255, b.length & 255]), b]);
  };
  const iim = concat([ds(80, 'Alex Example'), ds(90, 'Paris'), ds(120, 'Evening walk')]);
  const irb = concat([
    enc.encode('Photoshop 3.0\0'),
    enc.encode('8BIM'),
    new Uint8Array([0x04, 0x04, 0, 0, (iim.length >>> 24) & 255, (iim.length >>> 16) & 255, (iim.length >>> 8) & 255, iim.length & 255]),
    iim,
    new Uint8Array(iim.length & 1),
  ]);
  const segs = concat([
    jpegSegment(0xe1, exifPayload),
    jpegSegment(0xe1, concat([enc.encode('http://ns.adobe.com/xap/1.0/\0'), xmp])),
    jpegSegment(0xed, irb),
    jpegSegment(0xfe, enc.encode('Taken with my PhotoPhone')),
  ]);
  let at = 2;
  if (base[2] === 0xff && base[3] === 0xe0) at = 4 + ((base[4]! << 8) | base[5]!);
  return concat([base.subarray(0, at), segs, base.subarray(at)]);
}
