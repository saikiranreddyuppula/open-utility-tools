/**
 * Excel (XLSX / ODS) <-> CSV / JSON conversion core. Pure TypeScript, no DOM.
 *
 * Reading uses a small streaming XML tokenizer (instead of building a DOM) so that big worksheets
 * stay light on memory and the exact same code runs in the browser and in unit tests.
 * Writing produces a minimal, valid OOXML package with fflate.
 */
import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate';
import { parseCsv } from '@/lib/data/csv';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type DateKind = 'date' | 'datetime' | 'time';

/** A single worksheet cell as read from a workbook. Empty cells are `null`. */
export type XCell =
  | { t: 'n'; v: number }
  | { t: 's'; v: string }
  | { t: 'b'; v: boolean }
  | { t: 'e'; v: string }
  | { t: 'd'; v: number; k: DateKind };

export interface Sheet {
  name: string;
  hidden: boolean;
  rows: (XCell | null)[][];
  /** Number of columns that contain data (1-based width). */
  cols: number;
  /** True if rows/cols beyond the safety cap were dropped. */
  truncated: boolean;
}

export interface WorkbookReader {
  format: 'xlsx' | 'ods';
  date1904: boolean;
  sheets: { name: string; hidden: boolean }[];
  readSheet(index: number): Sheet;
}

export class UnsupportedFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedFormatError';
  }
}

export const MAX_ROWS = 1_048_576;
export const MAX_COLS = 16_384;
const MAX_PART_BYTES = 400 * 1024 * 1024;

/* ------------------------------------------------------------------ */
/* Tiny streaming XML tokenizer                                        */
/* ------------------------------------------------------------------ */

interface XmlSink {
  open(name: string, attrs: Record<string, string>): void;
  close(name: string): void;
  text(s: string): void;
  wantText?(): boolean;
}

const ENTITY_RE = /&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g;

function decodeEntities(s: string): string {
  if (s.indexOf('&') === -1) return s;
  return s.replace(ENTITY_RE, (m: string, g: string) => {
    switch (g) {
      case 'amp':
        return '&';
      case 'lt':
        return '<';
      case 'gt':
        return '>';
      case 'quot':
        return '"';
      case 'apos':
        return "'";
      default: {
        const cp = g.charCodeAt(1) === 120 || g.charCodeAt(1) === 88 ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
        if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return m;
        return String.fromCodePoint(cp);
      }
    }
  });
}

function localName(n: string): string {
  const i = n.indexOf(':');
  return i === -1 ? n : n.slice(i + 1);
}

/**
 * Minimal, tolerant XML tokenizer: elements, attributes, text, CDATA; skips comments, PIs and DOCTYPE.
 * With `strip`, element and attribute names lose their namespace prefix (`x:row` -> `row`, `r:id` -> `id`).
 */
export function parseXml(xml: string, sink: XmlSink, strip: boolean): void {
  const n = xml.length;
  let i = 0;
  const nm = strip ? localName : (x: string) => x;
  while (i < n) {
    const lt = xml.indexOf('<', i);
    if (lt === -1) {
      if (i < n && (!sink.wantText || sink.wantText())) sink.text(decodeEntities(xml.slice(i)));
      break;
    }
    if (lt > i && (!sink.wantText || sink.wantText())) sink.text(decodeEntities(xml.slice(i, lt)));
    const c1 = xml.charCodeAt(lt + 1);
    if (c1 === 33 /* ! */) {
      if (xml.startsWith('<!--', lt)) {
        const e = xml.indexOf('-->', lt + 4);
        i = e === -1 ? n : e + 3;
      } else if (xml.startsWith('<![CDATA[', lt)) {
        const e = xml.indexOf(']]>', lt + 9);
        if (!sink.wantText || sink.wantText()) sink.text(xml.slice(lt + 9, e === -1 ? n : e));
        i = e === -1 ? n : e + 3;
      } else {
        let depth = 0;
        let j = lt + 2;
        for (; j < n; j++) {
          const ch = xml.charCodeAt(j);
          if (ch === 91) depth++;
          else if (ch === 93) depth--;
          else if (ch === 62 && depth <= 0) break;
        }
        i = j + 1;
      }
      continue;
    }
    if (c1 === 63 /* ? */) {
      const e = xml.indexOf('?>', lt + 2);
      i = e === -1 ? n : e + 2;
      continue;
    }
    if (c1 === 47 /* / */) {
      const gt = xml.indexOf('>', lt + 2);
      if (gt === -1) break;
      sink.close(nm(xml.slice(lt + 2, gt).trim()));
      i = gt + 1;
      continue;
    }
    // start tag
    let j = lt + 1;
    while (j < n) {
      const ch = xml.charCodeAt(j);
      if (ch === 32 || ch === 9 || ch === 10 || ch === 13 || ch === 47 || ch === 62) break;
      j++;
    }
    const name = nm(xml.slice(lt + 1, j));
    const attrs: Record<string, string> = {};
    let selfClose = false;
    while (j < n) {
      let ch = xml.charCodeAt(j);
      while (ch === 32 || ch === 9 || ch === 10 || ch === 13) ch = xml.charCodeAt(++j);
      if (ch === 62) {
        j++;
        break;
      }
      if (ch === 47) {
        selfClose = true;
        j++;
        continue;
      }
      if (j >= n) break;
      const an = j;
      while (j < n) {
        ch = xml.charCodeAt(j);
        if (ch === 61 || ch === 32 || ch === 9 || ch === 10 || ch === 13 || ch === 62 || ch === 47) break;
        j++;
      }
      const attrName = nm(xml.slice(an, j));
      while (ch === 32 || ch === 9 || ch === 10 || ch === 13) ch = xml.charCodeAt(++j);
      if (ch === 61) {
        j++;
        ch = xml.charCodeAt(j);
        while (ch === 32 || ch === 9 || ch === 10 || ch === 13) ch = xml.charCodeAt(++j);
        if (ch === 34 || ch === 39) {
          const end = xml.indexOf(ch === 34 ? '"' : "'", j + 1);
          const stop = end === -1 ? n : end;
          attrs[attrName] = decodeEntities(xml.slice(j + 1, stop));
          j = stop + 1;
        } else {
          const vs = j;
          while (j < n && xml.charCodeAt(j) !== 32 && xml.charCodeAt(j) !== 62) j++;
          attrs[attrName] = xml.slice(vs, j);
        }
      } else {
        attrs[attrName] = '';
      }
    }
    sink.open(name, attrs);
    if (selfClose) sink.close(name);
    i = j;
  }
}

/** Excel stores control characters as _xHHHH_ in strings; `_x005F_` is a literal underscore. */
export function unescapeOoxmlString(s: string): string {
  if (s.indexOf('_x') === -1) return s;
  return s.replace(/_x([0-9A-Fa-f]{4})_/g, (_m, h: string) => String.fromCharCode(parseInt(h, 16)));
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;
const EPOCH_1900 = Date.UTC(1899, 11, 30);
const EPOCH_1904 = Date.UTC(1904, 0, 1);

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Classify an Excel number format code as date / datetime / time, or null for plain numbers. */
export function dateKindFromFormat(code: string): DateKind | null {
  if (!code || code === 'General') return null;
  let s = code.replace(/"[^"]*"/g, '').replace(/\\./g, '').replace(/_./g, '').replace(/\*./g, '');
  const elapsed = /\[(h+|m+|s+)\]/i.test(s);
  s = s.replace(/\[[^\]]*\]/g, '');
  s = (s.split(';')[0] ?? '').replace(/general/gi, '').toLowerCase();
  const ampm = /am\/pm|a\/p/.test(s);
  if (ampm) s = s.replace(/am\/pm|a\/p/g, 'h');
  const hasDay = /[dy]/.test(s);
  const hasTime = /[hs]/.test(s) || elapsed;
  const hasM = s.includes('m');
  if (!hasDay && !hasTime && !hasM) return null;
  if (hasDay) return hasTime ? 'datetime' : 'date';
  if (hasTime) return 'time';
  return 'date';
}

export function dateKindFromBuiltin(id: number): DateKind | null {
  if (id >= 14 && id <= 17) return 'date';
  if (id >= 18 && id <= 21) return 'time';
  if (id === 22) return 'datetime';
  if (id >= 45 && id <= 47) return 'time';
  if ([27, 28, 29, 30, 31, 34, 35, 36].includes(id) || (id >= 50 && id <= 58)) return 'date';
  if (id === 32 || id === 33) return 'time';
  return null;
}

export interface DateParts {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
  s: number;
}

/** Excel serial -> calendar parts. Handles the 1900 leap-year bug (serial 60 = fake 1900-02-29) and the 1904 system. */
export function serialToParts(serial: number, date1904 = false): DateParts | null {
  if (!Number.isFinite(serial) || serial < 0 || serial > 2_958_465.999) return null;
  let days = Math.floor(serial);
  let secs = Math.round((serial - days) * 86400);
  if (secs >= 86400) {
    secs -= 86400;
    days += 1;
  }
  const h = Math.floor(secs / 3600);
  const mi = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (!date1904) {
    if (days === 60) return { y: 1900, mo: 2, d: 29, h, mi, s };
    if (days === 0) return { y: 1900, mo: 1, d: 0, h, mi, s };
    const adj = days < 60 ? days + 1 : days;
    const dt = new Date(EPOCH_1900 + adj * DAY_MS);
    return { y: dt.getUTCFullYear(), mo: dt.getUTCMonth() + 1, d: dt.getUTCDate(), h, mi, s };
  }
  const dt = new Date(EPOCH_1904 + days * DAY_MS);
  return { y: dt.getUTCFullYear(), mo: dt.getUTCMonth() + 1, d: dt.getUTCDate(), h, mi, s };
}

/** Calendar parts -> Excel serial (null if before 1900-01-01 / invalid). */
export function partsToSerial(
  y: number,
  mo: number,
  d: number,
  h = 0,
  mi = 0,
  s = 0,
  date1904 = false
): number | null {
  const t = Date.UTC(y, mo - 1, d);
  const chk = new Date(t);
  if (chk.getUTCFullYear() !== y || chk.getUTCMonth() !== mo - 1 || chk.getUTCDate() !== d) return null;
  let days: number;
  if (date1904) {
    days = Math.round((t - EPOCH_1904) / DAY_MS);
    if (days < 0) return null;
  } else {
    days = Math.round((t - EPOCH_1900) / DAY_MS);
    if (days < 2) return null;
    if (days < 61) days -= 1;
  }
  return days + (h * 3600 + mi * 60 + s) / 86400;
}

export function formatDateSerial(serial: number, kind: DateKind, date1904 = false): string | null {
  if (kind === 'time') {
    if (serial >= 1) {
      const total = Math.round(serial * 86400);
      const hh = Math.floor(total / 3600);
      return `${hh}:${pad2(Math.floor((total % 3600) / 60))}:${pad2(total % 60)}`;
    }
    const p = serialToParts(serial, date1904);
    if (!p) return null;
    return `${pad2(p.h)}:${pad2(p.mi)}:${pad2(p.s)}`;
  }
  const p = serialToParts(serial, date1904);
  if (!p) return null;
  const date = `${String(p.y).padStart(4, '0')}-${pad2(p.mo)}-${pad2(p.d)}`;
  if (kind === 'date' && p.h === 0 && p.mi === 0 && p.s === 0) return date;
  return `${date}T${pad2(p.h)}:${pad2(p.mi)}:${pad2(p.s)}`;
}

/** Parse "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss[.fff]" (no timezone handling) into an Excel serial. */
export function isoToSerial(iso: string): { serial: number; kind: DateKind } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const hasTime = m[4] !== undefined;
  const h = hasTime ? Number(m[4]) : 0;
  const mi = hasTime ? Number(m[5]) : 0;
  const s = hasTime ? Number(m[6] ?? '0') + Number(`0.${m[7] ?? '0'}`) : 0;
  if (h > 23 || mi > 59 || s >= 60) return null;
  const serial = partsToSerial(y, mo, d, h, mi, s, false);
  if (serial === null) return null;
  return { serial, kind: hasTime ? 'datetime' : 'date' };
}

/** Shortest decimal that matches how Excel shows a General number (15 significant digits). */
export function numToString(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (Number.isInteger(n) && Math.abs(n) < 1e21) return String(n);
  return String(Number(n.toPrecision(15)));
}

/* ------------------------------------------------------------------ */
/* Workbook detection / opening                                        */
/* ------------------------------------------------------------------ */

const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

function startsWith(data: Uint8Array, magic: number[]): boolean {
  if (data.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) if (data[i] !== magic[i]) return false;
  return true;
}

function utf16le(s: string): Uint8Array {
  const out = new Uint8Array(s.length * 2);
  for (let i = 0; i < s.length; i++) out[i * 2] = s.charCodeAt(i) & 0xff;
  return out;
}

function containsBytes(hay: Uint8Array, needle: Uint8Array): boolean {
  const first = needle[0] ?? 0;
  let from = 0;
  for (;;) {
    const at = hay.indexOf(first, from);
    if (at === -1 || at + needle.length > hay.length) return false;
    let ok = true;
    for (let k = 1; k < needle.length; k++) {
      if (hay[at + k] !== needle[k]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
    from = at + 1;
  }
}

export function oleMessage(data: Uint8Array): string {
  if (containsBytes(data, utf16le('EncryptedPackage'))) {
    return 'This workbook is password-protected (encrypted). Encrypted workbooks cannot be read in the browser - remove the password in Excel (File > Info > Protect Workbook) and try again.';
  }
  return 'This looks like a legacy binary Office file (.xls / BIFF, OLE2 container). Legacy .xls is not supported - open it in Excel or LibreOffice and save it as .xlsx, then drop it here.';
}

function resolvePath(base: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base ? base.split('/') : [];
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.' && seg !== '') parts.push(seg);
  }
  return parts.join('/');
}

function dirOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i);
}

interface ZipHandle {
  names: string[];
  sizes: Map<string, number>;
  get(name: string): Uint8Array | undefined;
}

function openZip(data: Uint8Array): ZipHandle {
  const names: string[] = [];
  const sizes = new Map<string, number>();
  try {
    unzipSync(data, {
      filter: (f) => {
        names.push(f.name);
        sizes.set(f.name, f.originalSize);
        return false;
      },
    });
  } catch (e) {
    throw new Error(`Not a valid ZIP/OOXML container: ${e instanceof Error ? e.message : String(e)}`);
  }
  return {
    names,
    sizes,
    get(name: string): Uint8Array | undefined {
      if (!sizes.has(name)) return undefined;
      if ((sizes.get(name) ?? 0) > MAX_PART_BYTES) {
        throw new Error(`"${name}" is too large to process in the browser (${Math.round((sizes.get(name) ?? 0) / 1048576)} MB uncompressed).`);
      }
      let out: Uint8Array | undefined;
      try {
        out = unzipSync(data, { filter: (f) => f.name === name })[name];
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/unknown compression type|invalid zip data/i.test(msg)) {
          throw new Error('The workbook appears to be encrypted or uses an unsupported compression method.');
        }
        throw e;
      }
      return out;
    },
  };
}

function textOf(zip: ZipHandle, name: string): string | undefined {
  const b = zip.get(name);
  return b ? strFromU8(b) : undefined;
}

interface Relationship {
  id: string;
  type: string;
  target: string;
}

function parseRels(xml: string, baseDir: string): Relationship[] {
  const out: Relationship[] = [];
  parseXml(
    xml,
    {
      open(name, a) {
        if (name === 'Relationship') {
          out.push({ id: a.Id ?? '', type: a.Type ?? '', target: resolvePath(baseDir, a.Target ?? '') });
        }
      },
      close() {},
      text() {},
      wantText: () => false,
    },
    true
  );
  return out;
}

/**
 * Open an .xlsx / .xlsm / .xltx / .ods file. Sheets are parsed lazily by `readSheet`.
 * Throws `UnsupportedFormatError` for legacy .xls, encrypted, .xlsb and non-workbook files.
 */
export function openWorkbook(data: Uint8Array): WorkbookReader {
  if (data.length < 4) throw new Error('The file is empty or too small to be a workbook.');
  if (startsWith(data, OLE_MAGIC)) throw new UnsupportedFormatError(oleMessage(data));
  if (!(data[0] === 0x50 && data[1] === 0x4b)) {
    throw new UnsupportedFormatError(
      'Not a spreadsheet file. Supported: .xlsx, .xlsm and .ods (ZIP-based). Legacy .xls and password-protected workbooks are not supported.'
    );
  }
  const zip = openZip(data);
  const has = (n: string) => zip.sizes.has(n);

  if (has('content.xml') && (textOf(zip, 'mimetype') ?? '').includes('opendocument.spreadsheet')) {
    return openOds(zip);
  }
  if (has('content.xml') && has('META-INF/manifest.xml') && !has('xl/workbook.xml')) {
    const mt = textOf(zip, 'mimetype') ?? '';
    if (/opendocument\.(text|presentation|graphics)/.test(mt)) {
      throw new UnsupportedFormatError('This OpenDocument file is not a spreadsheet (.ods expected).');
    }
    return openOds(zip);
  }
  if (has('xl/workbook.bin')) {
    throw new UnsupportedFormatError('Binary Excel workbooks (.xlsb) are not supported - save the file as .xlsx in Excel first.');
  }

  let wbPath = 'xl/workbook.xml';
  const rootRels = textOf(zip, '_rels/.rels');
  if (rootRels) {
    const r = parseRels(rootRels, '').find((x) => /\/officeDocument$/.test(x.type));
    if (r && has(r.target)) wbPath = r.target;
  }
  if (!has(wbPath)) {
    if (zip.names.some((n) => n.startsWith('word/'))) throw new UnsupportedFormatError('This is a Word document (.docx), not a spreadsheet.');
    if (zip.names.some((n) => n.startsWith('ppt/'))) throw new UnsupportedFormatError('This is a PowerPoint file (.pptx), not a spreadsheet.');
    throw new UnsupportedFormatError('No workbook found: this ZIP file is not an .xlsx / .ods spreadsheet.');
  }
  return openXlsx(zip, wbPath);
}

/* ------------------------------------------------------------------ */
/* XLSX                                                                */
/* ------------------------------------------------------------------ */

function colFromRef(ref: string): number {
  let idx = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i);
    if (c >= 65 && c <= 90) idx = idx * 26 + (c - 64);
    else if (c >= 97 && c <= 122) idx = idx * 26 + (c - 96);
    else break;
  }
  return idx - 1;
}

export function colLetters(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  let inSi = false;
  let inT = false;
  let ph = 0;
  let cur = '';
  parseXml(
    xml,
    {
      open(name) {
        if (name === 'si') {
          inSi = true;
          cur = '';
        } else if (name === 'rPh') ph++;
        else if (name === 't' && inSi && ph === 0) inT = true;
      },
      close(name) {
        if (name === 'si') {
          out.push(unescapeOoxmlString(cur));
          inSi = false;
        } else if (name === 'rPh') ph--;
        else if (name === 't') inT = false;
      },
      text(s) {
        if (inT) cur += s;
      },
      wantText: () => inT,
    },
    true
  );
  return out;
}

function parseStyles(xml: string): (DateKind | null)[] {
  const custom = new Map<number, string>();
  const kinds: (DateKind | null)[] = [];
  let inCellXfs = false;
  parseXml(
    xml,
    {
      open(name, a) {
        if (name === 'numFmt') {
          const id = Number(a.numFmtId);
          if (Number.isFinite(id)) custom.set(id, a.formatCode ?? '');
        } else if (name === 'cellXfs') {
          inCellXfs = true;
        } else if (name === 'xf' && inCellXfs) {
          const id = Number(a.numFmtId ?? '0');
          const code = custom.get(id);
          kinds.push(code !== undefined ? dateKindFromFormat(code) : dateKindFromBuiltin(id));
        }
      },
      close(name) {
        if (name === 'cellXfs') inCellXfs = false;
      },
      text() {},
      wantText: () => false,
    },
    true
  );
  return kinds;
}

function parseXlsxSheet(xml: string, strings: string[], kinds: (DateKind | null)[]): Omit<Sheet, 'name' | 'hidden'> {
  const rows: (XCell | null)[][] = [];
  let truncated = false;
  let rowIdx = -1;
  let curRow: (XCell | null)[] = [];
  let colIdx = -1;
  let inCell = false;
  let cellType = 'n';
  let cellStyle = 0;
  let vText = '';
  let tText = '';
  let capture: 'v' | 't' | null = null;
  let isDepth = 0;
  let phDepth = 0;
  let maxCol = 0;

  const finishCell = () => {
    inCell = false;
    if (colIdx < 0 || colIdx >= MAX_COLS) {
      if (colIdx >= MAX_COLS) truncated = true;
      return;
    }
    let cell: XCell | null = null;
    switch (cellType) {
      case 's': {
        if (vText !== '') cell = { t: 's', v: strings[Number(vText)] ?? '' };
        break;
      }
      case 'str':
        if (vText !== '') cell = { t: 's', v: unescapeOoxmlString(vText) };
        break;
      case 'inlineStr':
        cell = { t: 's', v: unescapeOoxmlString(tText) };
        break;
      case 'b':
        if (vText !== '') cell = { t: 'b', v: vText.trim() === '1' || vText.trim().toLowerCase() === 'true' };
        break;
      case 'e':
        if (vText !== '') cell = { t: 'e', v: vText };
        break;
      case 'd': {
        const r = isoToSerial(vText);
        if (r) cell = { t: 'd', v: r.serial, k: r.kind };
        else if (vText !== '') cell = { t: 's', v: vText };
        break;
      }
      default: {
        const txt = vText.trim();
        if (txt === '') break;
        const num = Number(txt);
        if (!Number.isFinite(num)) {
          cell = { t: 's', v: vText };
          break;
        }
        const k = kinds[cellStyle] ?? null;
        if (k && num >= 0 && num < 2_958_466) cell = { t: 'd', v: num, k };
        else cell = { t: 'n', v: num === 0 ? 0 : num };
      }
    }
    if (cell) {
      if (colIdx === curRow.length) curRow.push(cell);
      else curRow[colIdx] = cell;
      if (colIdx + 1 > maxCol) maxCol = colIdx + 1;
    }
  };

  parseXml(
    xml,
    {
      open(name, a) {
        switch (name) {
          case 'row':
            rowIdx = a.r !== undefined ? Number(a.r) - 1 : rowIdx + 1;
            curRow = [];
            colIdx = -1;
            break;
          case 'c':
            inCell = true;
            cellType = a.t ?? 'n';
            cellStyle = a.s !== undefined ? Number(a.s) || 0 : 0;
            colIdx = a.r !== undefined ? colFromRef(a.r) : colIdx + 1;
            vText = '';
            tText = '';
            break;
          case 'v':
            if (inCell) capture = 'v';
            break;
          case 'is':
            isDepth++;
            break;
          case 'rPh':
            phDepth++;
            break;
          case 't':
            if (inCell && isDepth > 0 && phDepth === 0) capture = 't';
            break;
          default:
            break;
        }
      },
      close(name) {
        switch (name) {
          case 'v':
          case 't':
            capture = null;
            break;
          case 'is':
            isDepth--;
            break;
          case 'rPh':
            phDepth--;
            break;
          case 'c':
            if (inCell) finishCell();
            break;
          case 'row':
            if (rowIdx >= 0 && rowIdx < MAX_ROWS) rows[rowIdx] = curRow;
            else if (rowIdx >= MAX_ROWS) truncated = true;
            break;
          default:
            break;
        }
      },
      text(s) {
        if (capture === 'v') vText += s;
        else if (capture === 't') tText += s;
      },
      wantText: () => capture !== null,
    },
    true
  );

  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  while (rows.length > 0 && (rows[rows.length - 1] ?? []).every((c) => c == null)) rows.pop();
  return { rows, cols: maxCol, truncated };
}

function openXlsx(zip: ZipHandle, wbPath: string): WorkbookReader {
  const wbXml = textOf(zip, wbPath);
  if (!wbXml) throw new Error('Could not read xl/workbook.xml.');
  const baseDir = dirOf(wbPath);
  const relsPath = `${baseDir ? `${baseDir}/` : ''}_rels/${wbPath.slice(wbPath.lastIndexOf('/') + 1)}.rels`;
  const relsXml = textOf(zip, relsPath);
  const rels = relsXml ? parseRels(relsXml, baseDir) : [];
  const relById = new Map(rels.map((r) => [r.id, r]));

  let date1904 = false;
  const sheetDefs: { name: string; hidden: boolean; path: string }[] = [];
  parseXml(
    wbXml,
    {
      open(name, a) {
        if (name === 'workbookPr') {
          date1904 = a.date1904 === '1' || a.date1904 === 'true';
        } else if (name === 'sheet') {
          const rel = relById.get(a.id ?? '');
          if (!rel || (!/\/worksheet$/.test(rel.type) && !/\/macrosheet$/.test(rel.type))) return;
          sheetDefs.push({ name: a.name ?? `Sheet${sheetDefs.length + 1}`, hidden: a.state === 'hidden' || a.state === 'veryHidden', path: rel.target });
        }
      },
      close() {},
      text() {},
      wantText: () => false,
    },
    true
  );
  if (sheetDefs.length === 0) throw new UnsupportedFormatError('This workbook has no worksheets (only chart sheets or macro sheets).');

  const ssRel = rels.find((r) => /\/sharedStrings$/.test(r.type));
  const stRel = rels.find((r) => /\/styles$/.test(r.type));
  const ssPath = ssRel?.target ?? `${baseDir ? `${baseDir}/` : ''}sharedStrings.xml`;
  const stPath = stRel?.target ?? `${baseDir ? `${baseDir}/` : ''}styles.xml`;

  let strings: string[] | null = null;
  let kinds: (DateKind | null)[] | null = null;
  const getStrings = () => {
    if (!strings) {
      const x = textOf(zip, ssPath);
      strings = x ? parseSharedStrings(x) : [];
    }
    return strings;
  };
  const getKinds = () => {
    if (!kinds) {
      const x = textOf(zip, stPath);
      kinds = x ? parseStyles(x) : [];
    }
    return kinds;
  };

  return {
    format: 'xlsx',
    date1904,
    sheets: sheetDefs.map((s) => ({ name: s.name, hidden: s.hidden })),
    readSheet(index: number): Sheet {
      const def = sheetDefs[index];
      if (!def) throw new Error(`No sheet at index ${index}`);
      const xml = textOf(zip, def.path);
      if (xml === undefined) throw new Error(`Worksheet part "${def.path}" is missing from the file.`);
      const parsed = parseXlsxSheet(xml, getStrings(), getKinds());
      return { name: def.name, hidden: def.hidden, ...parsed };
    },
  };
}

/* ------------------------------------------------------------------ */
/* ODS (OpenDocument spreadsheet)                                      */
/* ------------------------------------------------------------------ */

function parseOdsDuration(s: string): number | null {
  const m = /^(-)?P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(s);
  if (!m) return null;
  const days = Number(m[4] ?? 0);
  const secs = Number(m[5] ?? 0) * 3600 + Number(m[6] ?? 0) * 60 + Number(m[7] ?? 0);
  const v = days + secs / 86400;
  return m[1] ? -v : v;
}

interface OdsSheet extends Omit<Sheet, 'hidden'> {
  hidden: boolean;
}

function readOdsSheets(xml: string): OdsSheet[] {
  const sheets: OdsSheet[] = [];
  const hiddenStyles = new Set<string>();
  let curStyle = '';
  let tableDepth = 0;
  let cur: OdsSheet | null = null;
  let rowCells: (XCell | null)[] = [];
  let rowRepeat = 1;
  let rowHasData = false;
  let rowIndex = 0;
  let col = 0;
  let cellAttrs: Record<string, string> | null = null;
  let cellRepeat = 1;
  let paras: string[] = [];
  let inPara = false;
  let skipDepth = 0;
  let maxCol = 0;

  const flushCell = () => {
    const a = cellAttrs;
    cellAttrs = null;
    if (!a || !cur) return;
    let cell: XCell | null = null;
    const vt = a['office:value-type'];
    const text = paras.join('\n');
    if (a['calcext:value-type'] === 'error') {
      cell = { t: 'e', v: text || '#ERR' };
    } else switch (vt) {
      case 'float':
      case 'percentage':
      case 'currency': {
        const n = Number(a['office:value']);
        if (Number.isFinite(n)) cell = { t: 'n', v: n };
        break;
      }
      case 'date': {
        const iso = a['office:date-value'] ?? '';
        const r = isoToSerial(iso);
        if (r) cell = { t: 'd', v: r.serial, k: r.kind };
        else if (iso) cell = { t: 's', v: iso };
        break;
      }
      case 'time': {
        const n = parseOdsDuration(a['office:time-value'] ?? '');
        if (n !== null) cell = { t: 'd', v: n, k: 'time' };
        break;
      }
      case 'boolean':
        cell = { t: 'b', v: a['office:boolean-value'] === 'true' };
        break;
      case 'string':
        cell = { t: 's', v: a['office:string-value'] ?? text };
        break;
      default:
        if (text !== '') cell = { t: 's', v: text };
    }
    if (cell) {
      rowHasData = true;
      const reps = Math.min(cellRepeat, MAX_COLS);
      for (let r = 0; r < reps; r++) {
        const ci = col + r;
        if (ci >= MAX_COLS) {
          cur.truncated = true;
          break;
        }
        if (ci === rowCells.length) rowCells.push(cell);
        else rowCells[ci] = cell;
        if (ci + 1 > maxCol) maxCol = ci + 1;
      }
    }
    col += cellRepeat;
  };

  parseXml(
    xml,
    {
      open(name, a) {
        if (name === 'style:style') curStyle = a['style:name'] ?? '';
        else if (name === 'style:table-properties' && a['table:display'] === 'false') hiddenStyles.add(curStyle);
        else if (name === 'table:table') {
          tableDepth++;
          if (tableDepth === 1) {
            cur = { name: a['table:name'] ?? `Sheet${sheets.length + 1}`, hidden: hiddenStyles.has(a['table:style-name'] ?? '\0'), rows: [], cols: 0, truncated: false };
            rowIndex = 0;
            maxCol = 0;
          }
        } else if (tableDepth === 1 && cur) {
          if (name === 'table:table-row') {
            rowCells = [];
            rowHasData = false;
            col = 0;
            rowRepeat = Math.max(1, Number(a['table:number-rows-repeated'] ?? '1') || 1);
          } else if (name === 'table:table-cell' || name === 'table:covered-table-cell') {
            cellAttrs = name === 'table:covered-table-cell' ? {} : a;
            cellRepeat = Math.max(1, Number(a['table:number-columns-repeated'] ?? '1') || 1);
            paras = [];
          } else if (name === 'text:p' && cellAttrs && skipDepth === 0) {
            inPara = true;
            paras.push('');
          } else if (name === 'office:annotation' || name === 'draw:frame') {
            skipDepth++;
          } else if (inPara && skipDepth === 0) {
            if (name === 'text:s') {
              const c = Math.max(1, Number(a['text:c'] ?? '1') || 1);
              paras[paras.length - 1] += ' '.repeat(Math.min(c, 10_000));
            } else if (name === 'text:tab') paras[paras.length - 1] += '\t';
            else if (name === 'text:line-break') paras[paras.length - 1] += '\n';
          }
        }
      },
      close(name) {
        if (name === 'table:table') {
          if (tableDepth === 1 && cur) {
            cur.cols = maxCol;
            while (cur.rows.length > 0 && (cur.rows[cur.rows.length - 1] ?? []).length === 0) cur.rows.pop();
            sheets.push(cur);
            cur = null;
          }
          tableDepth--;
        } else if (tableDepth === 1 && cur) {
          if (name === 'text:p') inPara = false;
          else if (name === 'office:annotation' || name === 'draw:frame') skipDepth--;
          else if (name === 'table:table-cell' || name === 'table:covered-table-cell') flushCell();
          else if (name === 'table:table-row') {
            if (rowHasData) {
              if (rowIndex < MAX_ROWS) {
                for (let r = 0; r < rowRepeat && rowIndex + r < MAX_ROWS; r++) {
                  cur.rows[rowIndex + r] = r === 0 ? rowCells : rowCells.slice();
                }
              }
              if (rowIndex + rowRepeat > MAX_ROWS) cur.truncated = true;
            }
            rowIndex += rowRepeat;
          }
        }
      },
      text(s) {
        if (inPara && skipDepth === 0 && paras.length > 0) paras[paras.length - 1] += s;
      },
      wantText: () => inPara && skipDepth === 0,
    },
    false
  );
  for (const s of sheets) for (let i = 0; i < s.rows.length; i++) if (!s.rows[i]) s.rows[i] = [];
  return sheets;
}

function openOds(zip: ZipHandle): WorkbookReader {
  const xml = textOf(zip, 'content.xml');
  if (!xml) throw new Error('content.xml is missing from the OpenDocument file.');
  let cache: OdsSheet[] | null = null;
  const all = () => {
    if (!cache) cache = readOdsSheets(xml);
    return cache;
  };
  // Sheet names are needed up-front; a cheap scan avoids parsing every cell.
  const names: { name: string; hidden: boolean }[] = [];
  for (const s of all()) names.push({ name: s.name, hidden: s.hidden });
  if (names.length === 0) throw new UnsupportedFormatError('No sheets found in this OpenDocument spreadsheet.');
  return {
    format: 'ods',
    date1904: false,
    sheets: names,
    readSheet(index: number): Sheet {
      const s = all()[index];
      if (!s) throw new Error(`No sheet at index ${index}`);
      return s;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Sheet -> matrix -> text exports                                     */
/* ------------------------------------------------------------------ */

export type OutVal = string | number | boolean | null;

export interface ReadOptions {
  header: boolean;
  skipEmptyRows: boolean;
  skipEmptyCols: boolean;
  trim: boolean;
  dates: 'iso' | 'serial';
}

export interface Matrix {
  /** Header texts when `header` is on, otherwise null. */
  header: string[] | null;
  rows: OutVal[][];
  /** Excel column letters of each kept column (A, B, ...). */
  letters: string[];
  width: number;
}

export function cellToOut(c: XCell | null, o: Pick<ReadOptions, 'trim' | 'dates'>, date1904: boolean): OutVal {
  if (!c) return null;
  switch (c.t) {
    case 'n':
      return c.v;
    case 'b':
      return c.v;
    case 'e':
      return c.v;
    case 's': {
      const s = o.trim ? c.v.trim() : c.v;
      return s === '' ? null : s;
    }
    case 'd': {
      if (o.dates === 'serial') return c.v;
      return formatDateSerial(c.v, c.k, date1904) ?? c.v;
    }
  }
}

function isEmptyVal(v: OutVal): boolean {
  return v === null || v === '';
}

export function sheetToMatrix(sheet: Sheet, o: ReadOptions, date1904: boolean): Matrix {
  let grid: OutVal[][] = [];
  let width = 0;
  for (const r of sheet.rows) {
    const out: OutVal[] = new Array<OutVal>(r.length);
    let last = -1;
    for (let c = 0; c < r.length; c++) {
      const v = cellToOut(r[c] ?? null, o, date1904);
      out[c] = v;
      if (!isEmptyVal(v)) last = c;
    }
    if (last + 1 > width) width = last + 1;
    grid.push(out);
  }
  // trim trailing empty rows
  while (grid.length > 0 && (grid[grid.length - 1] ?? []).every(isEmptyVal)) grid.pop();
  if (o.skipEmptyRows) grid = grid.filter((r) => !r.every(isEmptyVal));
  for (const r of grid) {
    r.length = width;
    for (let c = 0; c < width; c++) if (r[c] === undefined) r[c] = null;
  }
  let keep: number[] = [];
  for (let c = 0; c < width; c++) keep.push(c);
  if (o.skipEmptyCols) keep = keep.filter((c) => grid.some((r) => !isEmptyVal(r[c] ?? null)));
  const letters = keep.map((c) => colLetters(c));
  if (o.skipEmptyCols) grid = grid.map((r) => keep.map((c) => r[c] ?? null));
  let header: string[] | null = null;
  if (o.header && grid.length > 0) {
    const first = grid[0] ?? [];
    header = first.map((v) => (v === null ? '' : valToString(v)));
    grid = grid.slice(1);
  } else if (o.header) {
    header = letters.map(() => '');
  }
  return { header, rows: grid, letters, width: keep.length };
}

export function valToString(v: OutVal): string {
  if (v === null) return '';
  if (typeof v === 'number') return numToString(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return v;
}

export type ExportFormat = 'csv' | 'tsv' | 'json' | 'json-arrays' | 'markdown';
export type Delimiter = ',' | ';' | '\t' | '|';

export function csvField(s: string, delim: string): string {
  if (s.includes('"') || s.includes(delim) || s.includes('\n') || s.includes('\r')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function matrixToDelimited(m: Matrix, delim: string): string {
  const lines: string[] = [];
  if (m.header) lines.push(m.header.map((h) => csvField(h, delim)).join(delim));
  for (const r of m.rows) lines.push(r.map((v) => csvField(valToString(v), delim)).join(delim));
  return lines.join('\n') + (lines.length ? '\n' : '');
}

/** Unique, non-empty JSON keys from a header row (duplicates get _2, _3 ...). */
export function headerKeys(m: Matrix): string[] {
  const keys: string[] = [];
  const seen = new Map<string, number>();
  for (let i = 0; i < m.width; i++) {
    let k = m.header ? (m.header[i] ?? '').trim() : (m.letters[i] ?? colLetters(i));
    if (k === '') k = `column_${i + 1}`;
    const base = k;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    if (n > 1) k = `${base}_${n}`;
    keys.push(k);
  }
  return keys;
}

export function matrixToJsonObjects(m: Matrix, indent = 2): string {
  const keys = headerKeys(m);
  const arr = m.rows.map((r) => {
    const o: Record<string, OutVal> = {};
    keys.forEach((k, i) => {
      o[k] = r[i] ?? null;
    });
    return o;
  });
  return JSON.stringify(arr, null, indent);
}

export function matrixToJsonArrays(m: Matrix, indent = 2): string {
  const all: OutVal[][] = [];
  if (m.header) all.push(m.header);
  for (const r of m.rows) all.push(r);
  if (indent === 0) return JSON.stringify(all);
  // one inner array per line keeps big tables readable
  return `[\n${all.map((r) => `${' '.repeat(indent)}${JSON.stringify(r)}`).join(',\n')}\n]`;
}

export function matrixToMarkdown(m: Matrix): string {
  const head = m.header ? m.header.map((h, i) => (h === '' ? (m.letters[i] ?? colLetters(i)) : h)) : m.letters.slice();
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
  const cells = m.rows.map((r) => r.map((v) => esc(valToString(v))));
  const heads = head.map(esc);
  const numeric = heads.map((_h, c) => m.rows.length > 0 && m.rows.every((r) => r[c] === null || typeof r[c] === 'number'));
  const widths = heads.map((h, c) => {
    let w = Math.max(3, h.length);
    for (const r of cells) w = Math.max(w, Math.min(40, (r[c] ?? '').length));
    return w;
  });
  const line = (cs: string[]) => `| ${cs.map((s, c) => (numeric[c] ? s.padStart(widths[c] ?? 3) : s.padEnd(widths[c] ?? 3))).join(' | ')} |`;
  const sep = `| ${widths.map((w, c) => (numeric[c] ? `${'-'.repeat(Math.max(2, w - 1))}:` : '-'.repeat(w))).join(' | ')} |`;
  return [line(heads), sep, ...cells.map(line)].join('\n') + '\n';
}

export interface ExportConfig {
  format: ExportFormat;
  delimiter: Delimiter;
}

export function exportMatrix(m: Matrix, cfg: ExportConfig): string {
  switch (cfg.format) {
    case 'csv':
      return matrixToDelimited(m, cfg.delimiter);
    case 'tsv':
      return matrixToDelimited(m, '\t');
    case 'json':
      return matrixToJsonObjects(m);
    case 'json-arrays':
      return matrixToJsonArrays(m);
    case 'markdown':
      return matrixToMarkdown(m);
  }
}

export function exportExtension(cfg: ExportConfig): string {
  switch (cfg.format) {
    case 'csv':
      return 'csv';
    case 'tsv':
      return 'tsv';
    case 'json':
    case 'json-arrays':
      return 'json';
    case 'markdown':
      return 'md';
  }
}

export function exportMime(cfg: ExportConfig): string {
  switch (cfg.format) {
    case 'csv':
      return 'text/csv;charset=utf-8';
    case 'tsv':
      return 'text/tab-separated-values;charset=utf-8';
    case 'json':
    case 'json-arrays':
      return 'application/json;charset=utf-8';
    case 'markdown':
      return 'text/markdown;charset=utf-8';
  }
}

/** Safe file name stem from a sheet name. */
export function fileSafe(name: string, fallback = 'sheet'): string {
  const s = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '').trim();
  return s === '' ? fallback : s.slice(0, 80);
}

/* ------------------------------------------------------------------ */
/* Input parsing (CSV / TSV / JSON text -> table)                      */
/* ------------------------------------------------------------------ */

export type RawCell = string | number | boolean | null;
export type InputFormat = 'auto' | 'csv' | 'tsv' | 'json';

export interface ParsedInput {
  kind: 'csv' | 'tsv' | 'json-objects' | 'json-arrays' | 'json-values';
  delimiter?: string;
  table: RawCell[][];
  /** Whether values are native JSON types (true) or all strings from delimited text (false). */
  typed: boolean;
}

const CANDIDATE_DELIMS = ['\t', ',', ';', '|'];

export function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 40).join('\n');
  let best = ',';
  let bestScore = 0;
  for (const d of CANDIDATE_DELIMS) {
    const rows = parseCsv(sample, d).filter((r) => r.length > 0 && !(r.length === 1 && r[0] === ''));
    if (rows.length === 0) continue;
    const counts = new Map<number, number>();
    for (const r of rows) counts.set(r.length, (counts.get(r.length) ?? 0) + 1);
    let mode = 0;
    let modeN = 0;
    for (const [len, n] of counts) {
      if (n > modeN || (n === modeN && len > mode)) {
        mode = len;
        modeN = n;
      }
    }
    if (mode < 2) continue;
    const score = (modeN / rows.length) * (mode - 1) + (modeN === rows.length ? 0.5 : 0);
    if (score > bestScore + 1e-9) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

function scalarToRaw(v: unknown): RawCell {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' || typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : String(v);
  return JSON.stringify(v);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function flattenInto(o: Record<string, unknown>, prefix: string, out: Record<string, unknown>): void {
  for (const k of Object.keys(o)) {
    const v = o[k];
    const key = prefix ? `${prefix}.${k}` : k;
    if (isPlainObject(v) && Object.keys(v).length > 0) flattenInto(v, key, out);
    else out[key] = v;
  }
}

function jsonToTable(data: unknown, flatten: boolean): ParsedInput {
  let arr: unknown[];
  if (Array.isArray(data)) arr = data;
  else if (isPlainObject(data)) arr = [data];
  else throw new Error('JSON must be an array of objects, an array of arrays, or a single object.');
  if (arr.length === 0) return { kind: 'json-objects', table: [], typed: true };

  if (arr.every(isPlainObject)) {
    const keys: string[] = [];
    const seen = new Set<string>();
    const objs = (arr as Record<string, unknown>[]).map((o) => {
      if (flatten) {
        const f: Record<string, unknown> = {};
        flattenInto(o, '', f);
        return f;
      }
      return o;
    });
    for (const o of objs) {
      for (const k of Object.keys(o)) {
        if (!seen.has(k)) {
          seen.add(k);
          keys.push(k);
        }
      }
    }
    const table: RawCell[][] = [keys.slice()];
    for (const o of objs) table.push(keys.map((k) => scalarToRaw(o[k])));
    return { kind: 'json-objects', table, typed: true };
  }
  if (arr.every((x) => Array.isArray(x))) {
    return { kind: 'json-arrays', table: (arr as unknown[][]).map((r) => r.map(scalarToRaw)), typed: true };
  }
  if (arr.every((x) => !isPlainObject(x) && !Array.isArray(x))) {
    return { kind: 'json-values', table: [['value'], ...arr.map((x) => [scalarToRaw(x)])], typed: true };
  }
  throw new Error('Mixed JSON array: expected all objects, all arrays, or all plain values.');
}

export function parseTabularInput(text: string, format: InputFormat, flatten: boolean): ParsedInput {
  let t = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (t.trim() === '') return { kind: 'csv', delimiter: ',', table: [], typed: false };
  const trimmed = t.trimStart();
  const looksJson = trimmed.startsWith('[') || trimmed.startsWith('{');
  if (format === 'json' || (format === 'auto' && looksJson)) {
    let data: unknown;
    try {
      data = JSON.parse(t);
    } catch (e) {
      const lines = t.split(/\r?\n/).filter((l) => l.trim() !== '');
      let parsedLines: unknown[] | null = null;
      if (lines.length > 1) {
        try {
          parsedLines = lines.map((l) => JSON.parse(l) as unknown);
        } catch {
          parsedLines = null;
        }
      }
      if (!parsedLines) {
        throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}${format === 'auto' ? ' (input starting with [ or { is treated as JSON - pick CSV/TSV as the format if it is delimited text)' : ''}`);
      }
      data = parsedLines;
    }
    return jsonToTable(data, flatten);
  }
  let delim = format === 'tsv' ? '\t' : format === 'csv' ? ',' : detectDelimiter(t);
  // single-line pasted spreadsheets often have tabs
  if (format === 'auto' && !t.includes('\n') && t.includes('\t')) delim = '\t';
  t = t.replace(/\r\n?/g, '\n');
  const rows = parseCsv(t, delim);
  return { kind: delim === '\t' ? 'tsv' : 'csv', delimiter: delim, table: rows, typed: false };
}

/* ------------------------------------------------------------------ */
/* Type inference + OOXML writer                                       */
/* ------------------------------------------------------------------ */

export type WCell =
  | null
  | { t: 's'; v: string }
  | { t: 'n'; v: number }
  | { t: 'b'; v: boolean }
  | { t: 'd'; v: number; k: 'date' | 'datetime' };

export interface InferOptions {
  /** Convert numbers / booleans / ISO dates in text to real Excel values. */
  infer: boolean;
  /** Keep 00123, +4412..., and 16+ digit integers as text. */
  keepText: boolean;
}

const NUM_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/;

export function inferDate(s: string): { serial: number; k: 'date' | 'datetime' } | null {
  const m = ISO_RE.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const hasTime = m[4] !== undefined;
  let h = hasTime ? Number(m[4]) : 0;
  let mi = hasTime ? Number(m[5]) : 0;
  const sec = hasTime ? Number(m[6] ?? '0') + Number(`0.${m[7] ?? '0'}`) : 0;
  if (h > 23 || mi > 59 || sec >= 60) return null;
  let yy = y;
  let mm = mo;
  let dd = d;
  const tz = m[8];
  if (hasTime && tz && tz !== 'Z') {
    const sign = tz.startsWith('-') ? -1 : 1;
    const digits = tz.slice(1).replace(':', '');
    const off = sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4)));
    const t = Date.UTC(y, mo - 1, d, h, mi) - off * 60000;
    const u = new Date(t);
    yy = u.getUTCFullYear();
    mm = u.getUTCMonth() + 1;
    dd = u.getUTCDate();
    h = u.getUTCHours();
    mi = u.getUTCMinutes();
  }
  const serial = partsToSerial(yy, mm, dd, h, mi, sec, false);
  if (serial === null) return null;
  return { serial, k: hasTime ? 'datetime' : 'date' };
}

export function inferCell(raw: string, o: InferOptions): WCell {
  if (raw === '') return null;
  if (!o.infer) return { t: 's', v: raw };
  const s = raw.trim();
  if (s === '') return { t: 's', v: raw };
  const low = s.toLowerCase();
  if (low === 'true' || low === 'false') return { t: 'b', v: low === 'true' };
  if (NUM_RE.test(s)) {
    if (o.keepText) {
      if (s.startsWith('+')) return { t: 's', v: raw };
      if (/^-?0\d/.test(s)) return { t: 's', v: raw };
      if (/^-?\d+$/.test(s) && s.replace(/^-/, '').replace(/^0+/, '').length > 15) return { t: 's', v: raw };
    }
    const n = Number(s);
    if (Number.isFinite(n)) return { t: 'n', v: n };
    return { t: 's', v: raw };
  }
  const d = inferDate(s);
  if (d) return { t: 'd', v: d.serial, k: d.k };
  return { t: 's', v: raw };
}

/** Convert a parsed table into typed cells. `skipHeader` keeps the first row as plain text. */
export function tableToCells(p: ParsedInput, o: InferOptions, skipHeader: boolean): WCell[][] {
  return p.table.map((row, ri) =>
    row.map((v): WCell => {
      if (v === null) return null;
      if (ri === 0 && skipHeader) return v === '' ? null : { t: 's', v: String(v) };
      if (typeof v === 'number') return Number.isFinite(v) ? { t: 'n', v } : { t: 's', v: String(v) };
      if (typeof v === 'boolean') return { t: 'b', v };
      if (p.typed) {
        if (o.infer) {
          const d = inferDate(v.trim());
          if (d) return { t: 'd', v: d.serial, k: d.k };
        }
        return v === '' ? null : { t: 's', v };
      }
      return inferCell(v, o);
    })
  );
}

export interface WriteOptions {
  /** Treat the first row as a header (needed for bold / freeze / filter). */
  header: boolean;
  bold: boolean;
  freeze: boolean;
  autoFilter: boolean;
  autoWidth: boolean;
}

export interface WSheet {
  name: string;
  rows: WCell[][];
}

const ILLEGAL_SHEET_CHARS = /[[\]:*?/\\]/;

export function validateSheetNames(names: string[]): (string | null)[] {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const key = n.toLowerCase();
    const prev = seen.get(key);
    seen.set(key, (prev ?? 0) + 1);
    if (n.trim() === '') return 'Name cannot be empty';
    if (n.length > 31) return 'Max 31 characters';
    if (ILLEGAL_SHEET_CHARS.test(n)) return 'Cannot contain [ ] : * ? / \\';
    if (n.startsWith("'") || n.endsWith("'")) return "Cannot start or end with '";
    if (key === 'history') return '"History" is reserved by Excel';
    if (prev !== undefined) return 'Duplicate sheet name';
    return null;
  });
}

export function sanitizeSheetName(name: string, fallback: string): string {
  let s = name.replace(/[[\]:*?/\\]/g, '_').replace(/^'+|'+$/g, '').trim();
  if (s.length > 31) s = s.slice(0, 31).trim();
  if (s === '' || s.toLowerCase() === 'history') s = fallback;
  return s;
}

const XML_BAD = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** XML-escape and strip characters that are illegal in XML 1.0. */
export function xmlEscape(s: string): string {
  return s
    .replace(XML_BAD, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeCellText(s: string): string {
  // literal "_x0041_" text must be protected from Excel's _xHHHH_ unescaping
  return xmlEscape(s.replace(/_x([0-9A-Fa-f]{4})_/g, '_x005F_x$1_').replace(/\r/g, '_x000D_'));
}

const MAX_CELL_CHARS = 32_767;

export interface BuildResult {
  bytes: Uint8Array;
  warnings: string[];
}

function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    w += cp >= 0x1100 && (cp <= 0x115f || (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe30 && cp <= 0xfe6f) || (cp >= 0xff00 && cp <= 0xff60) || (cp >= 0xffe0 && cp <= 0xffe6) || cp >= 0x1f300) ? 2 : 1;
  }
  return w;
}

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/** Write a minimal, valid .xlsx package. */
export function buildXlsx(sheets: WSheet[], opts: WriteOptions): BuildResult {
  if (sheets.length === 0) throw new Error('Add at least one sheet.');
  const nameErrs = validateSheetNames(sheets.map((s) => s.name));
  const bad = nameErrs.findIndex((e) => e !== null);
  if (bad !== -1) throw new Error(`Sheet "${sheets[bad]?.name ?? ''}": ${nameErrs[bad]}`);

  const warnings: string[] = [];
  const sst = new Map<string, number>();
  const sstList: string[] = [];
  let sstCount = 0;
  const sheetXml: string[] = [];

  sheets.forEach((sh, si) => {
    let rows = sh.rows;
    if (rows.length > MAX_ROWS) {
      warnings.push(`"${sh.name}": only the first ${MAX_ROWS.toLocaleString('en-US')} rows fit in an Excel sheet; the rest was dropped.`);
      rows = rows.slice(0, MAX_ROWS);
    }
    let width = 0;
    for (const r of rows) {
      let last = -1;
      for (let c = 0; c < r.length; c++) if (r[c]) last = c;
      if (last + 1 > width) width = last + 1;
    }
    if (width > MAX_COLS) {
      warnings.push(`"${sh.name}": only the first ${MAX_COLS.toLocaleString('en-US')} columns fit in an Excel sheet; the rest was dropped.`);
      width = MAX_COLS;
    }
    const widths: number[] = new Array<number>(width).fill(0);
    const body: string[] = [];
    let longWarned = false;
    rows.forEach((r, ri) => {
      const rowNum = ri + 1;
      const cells: string[] = [];
      const isHeader = opts.header && ri === 0;
      const lim = Math.min(r.length, width);
      for (let c = 0; c < lim; c++) {
        const cell = r[c];
        if (!cell) continue;
        const ref = `${colLetters(c)}${rowNum}`;
        let text = '';
        switch (cell.t) {
          case 's': {
            let v = cell.v;
            if (v.length > MAX_CELL_CHARS) {
              v = v.slice(0, MAX_CELL_CHARS);
              if (!longWarned) {
                warnings.push(`"${sh.name}": cells longer than ${MAX_CELL_CHARS.toLocaleString('en-US')} characters were truncated (Excel limit).`);
                longWarned = true;
              }
            }
            let idx = sst.get(v);
            if (idx === undefined) {
              idx = sstList.length;
              sst.set(v, idx);
              sstList.push(v);
            }
            sstCount++;
            const style = isHeader && opts.bold ? ' s="1"' : '';
            cells.push(`<c r="${ref}"${style} t="s"><v>${idx}</v></c>`);
            text = v;
            break;
          }
          case 'n':
            cells.push(`<c r="${ref}"><v>${String(cell.v)}</v></c>`);
            text = numToString(cell.v);
            break;
          case 'b':
            cells.push(`<c r="${ref}" t="b"><v>${cell.v ? 1 : 0}</v></c>`);
            text = 'TRUE';
            break;
          case 'd':
            cells.push(`<c r="${ref}" s="${cell.k === 'date' ? 2 : 3}"><v>${String(cell.v)}</v></c>`);
            text = cell.k === 'date' ? '0000-00-00' : '0000-00-00 00:00:00';
            break;
        }
        if (opts.autoWidth && ri < 2000) {
          const lines = text.split('\n');
          let w = 0;
          for (const ln of lines) w = Math.max(w, displayWidth(ln));
          if (isHeader && opts.bold) w = Math.ceil(w * 1.15);
          if (w > (widths[c] ?? 0)) widths[c] = w;
        }
      }
      if (cells.length > 0) body.push(`<row r="${rowNum}">${cells.join('')}</row>`);
    });

    const lastRow = Math.max(1, rows.length);
    const dim = `A1:${colLetters(Math.max(0, width - 1))}${lastRow}`;
    const freeze = opts.header && opts.freeze && rows.length > 0;
    const pane = freeze
      ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/>'
      : '';
    let cols = '';
    if (opts.autoWidth && width > 0) {
      cols =
        '<cols>' +
        widths
          .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.min(60, Math.max(8.43, Math.round((w * 1.1 + 2) * 100) / 100))}" customWidth="1"/>`)
          .join('') +
        '</cols>';
    }
    const filter = opts.header && opts.autoFilter && rows.length > 0 && width > 0 ? `<autoFilter ref="A1:${colLetters(width - 1)}${lastRow}"/>` : '';
    sheetXml.push(
      `${XML_DECL}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><dimension ref="${dim}"/>` +
        `<sheetViews><sheetView workbookViewId="0"${si === 0 ? ' tabSelected="1"' : ''}>${pane}</sheetView></sheetViews>` +
        `<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${body.join('')}</sheetData>${filter}</worksheet>`
    );
  });

  const n = sheets.length;
  const sstXml =
    `${XML_DECL}<sst xmlns="${NS_MAIN}" count="${sstCount}" uniqueCount="${sstList.length}">` +
    sstList
      .map((s) => {
        const keep = /^\s|\s$|\n/.test(s) ? ' xml:space="preserve"' : '';
        return `<si><t${keep}>${escapeCellText(s)}</t></si>`;
      })
      .join('') +
    '</sst>';

  const stylesXml =
    `${XML_DECL}<styleSheet xmlns="${NS_MAIN}">` +
    '<numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"/><numFmt numFmtId="165" formatCode="yyyy\\-mm\\-dd\\ hh:mm:ss"/></numFmts>' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="4">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  const workbookXml =
    `${XML_DECL}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><bookViews><workbookView activeTab="0"/></bookViews><sheets>` +
    sheets.map((s, i) => `<sheet name="${xmlEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
    '</sheets></workbook>';

  const wbRels =
    `${XML_DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    sheets.map((_s, i) => `<Relationship Id="rId${i + 1}" Type="${NS_REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
    `<Relationship Id="rId${n + 1}" Type="${NS_REL}/styles" Target="styles.xml"/>` +
    `<Relationship Id="rId${n + 2}" Type="${NS_REL}/sharedStrings" Target="sharedStrings.xml"/>` +
    '</Relationships>';

  const contentTypes =
    `${XML_DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    sheets.map((_s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
    '</Types>';

  const rootRels =
    `${XML_DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>` +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    `<Relationship Id="rId3" Type="${NS_REL}/extended-properties" Target="docProps/app.xml"/>` +
    '</Relationships>';

  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const core =
    `${XML_DECL}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:creator>Open Utility Tools</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
  const app = `${XML_DECL}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Open Utility Tools</Application></Properties>`;

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rootRels),
    'docProps/core.xml': strToU8(core),
    'docProps/app.xml': strToU8(app),
    'xl/workbook.xml': strToU8(workbookXml),
    'xl/_rels/workbook.xml.rels': strToU8(wbRels),
    'xl/styles.xml': strToU8(stylesXml),
    'xl/sharedStrings.xml': strToU8(sstXml),
  };
  sheetXml.forEach((x, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(x);
  });
  return { bytes: zipSync(files, { level: 6 }), warnings };
}

/** Quick row/col/cell counts for UI stats. */
export function tableStats(cells: WCell[][]): { rows: number; cols: number; cells: number } {
  let cols = 0;
  let count = 0;
  for (const r of cells) {
    if (r.length > cols) cols = r.length;
    for (const c of r) if (c) count++;
  }
  return { rows: cells.length, cols, cells: count };
}
