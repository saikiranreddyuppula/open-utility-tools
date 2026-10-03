/** PDF metadata reader in pure TypeScript: classic xref tables, xref streams and object streams. */
import { emitXmp, extractXmpPacket } from './embedded';
import {
  type Ctx,
  type Reader,
  fmtNum,
  inflateLimited,
  latin1,
  toHex,
  u16,
  utf16,
  utf8,
} from './util';

// ---------------------------------------------------------------------------
// Object model + lexer
// ---------------------------------------------------------------------------

type PV =
  | { t: 'null' }
  | { t: 'bool'; v: boolean }
  | { t: 'num'; v: number }
  | { t: 'name'; v: string }
  | { t: 'str'; v: Uint8Array }
  | { t: 'ref'; n: number; g: number }
  | { t: 'arr'; v: PV[] }
  | { t: 'dict'; v: Record<string, PV> };

type PDict = Record<string, PV>;

const NULL: PV = { t: 'null' };

function isWs(c: number): boolean {
  return c === 0 || c === 9 || c === 10 || c === 12 || c === 13 || c === 32;
}
function isDelim(c: number): boolean {
  return c === 40 || c === 41 || c === 60 || c === 62 || c === 91 || c === 93 || c === 123 || c === 125 || c === 47 || c === 37;
}

class Eof extends Error {}

class Lexer {
  constructor(
    readonly s: string,
    public i = 0
  ) {}

  skipWs(): void {
    const s = this.s;
    for (;;) {
      const c = s.charCodeAt(this.i);
      if (Number.isNaN(c)) return;
      if (isWs(c)) this.i++;
      else if (c === 37) {
        while (this.i < s.length && s.charCodeAt(this.i) !== 10 && s.charCodeAt(this.i) !== 13) this.i++;
      } else return;
    }
  }

  token(): string {
    const s = this.s;
    const start = this.i;
    while (this.i < s.length) {
      const c = s.charCodeAt(this.i);
      if (isWs(c) || isDelim(c)) break;
      this.i++;
    }
    return s.slice(start, this.i);
  }

  parse(depth = 0): PV {
    if (depth > 60) throw new Error('object nesting too deep');
    this.skipWs();
    const s = this.s;
    if (this.i >= s.length) throw new Eof('end of data');
    const c = s.charCodeAt(this.i);
    if (c === 47) {
      this.i++;
      return { t: 'name', v: decodeName(this.token()) };
    }
    if (c === 40) return { t: 'str', v: this.literalString() };
    if (c === 60) {
      if (s.charCodeAt(this.i + 1) === 60) {
        this.i += 2;
        const d: PDict = {};
        for (;;) {
          this.skipWs();
          if (this.i >= s.length) throw new Eof('unterminated dictionary');
          if (s.charCodeAt(this.i) === 62 && s.charCodeAt(this.i + 1) === 62) {
            this.i += 2;
            break;
          }
          if (s.charCodeAt(this.i) !== 47) {
            // tolerate junk inside dictionaries
            this.i++;
            continue;
          }
          this.i++;
          const key = decodeName(this.token());
          d[key] = this.parse(depth + 1);
        }
        return { t: 'dict', v: d };
      }
      return { t: 'str', v: this.hexString() };
    }
    if (c === 91) {
      this.i++;
      const arr: PV[] = [];
      for (;;) {
        this.skipWs();
        if (this.i >= s.length) throw new Eof('unterminated array');
        if (s.charCodeAt(this.i) === 93) {
          this.i++;
          break;
        }
        arr.push(this.parse(depth + 1));
      }
      return { t: 'arr', v: arr };
    }
    if (c === 41 || c === 62 || c === 93 || c === 123 || c === 125) {
      this.i++;
      return NULL;
    }
    const start = this.i;
    const tok = this.token();
    if (tok === '') {
      this.i++;
      return NULL;
    }
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(tok)) {
      if (/^\d+$/.test(tok)) {
        const re = /\s+(\d+)\s+R(?![A-Za-z0-9])/y;
        re.lastIndex = this.i;
        const m = re.exec(s);
        if (m) {
          this.i = re.lastIndex;
          return { t: 'ref', n: parseInt(tok, 10), g: parseInt(m[1] ?? '0', 10) };
        }
      }
      return { t: 'num', v: parseFloat(tok) };
    }
    if (tok === 'true') return { t: 'bool', v: true };
    if (tok === 'false') return { t: 'bool', v: false };
    if (tok === 'null') return NULL;
    this.i = start + tok.length;
    return NULL;
  }

  private literalString(): Uint8Array {
    const s = this.s;
    this.i++;
    let depth = 1;
    const out: number[] = [];
    while (this.i < s.length) {
      const c = s.charCodeAt(this.i++);
      if (c === 92) {
        const n = s.charCodeAt(this.i++);
        if (n === 110) out.push(10);
        else if (n === 114) out.push(13);
        else if (n === 116) out.push(9);
        else if (n === 98) out.push(8);
        else if (n === 102) out.push(12);
        else if (n >= 48 && n <= 55) {
          let v = n - 48;
          for (let k = 0; k < 2; k++) {
            const d = s.charCodeAt(this.i);
            if (d >= 48 && d <= 55) {
              v = v * 8 + (d - 48);
              this.i++;
            } else break;
          }
          out.push(v & 255);
        } else if (n === 13) {
          if (s.charCodeAt(this.i) === 10) this.i++;
        } else if (n === 10) {
          /* line continuation */
        } else out.push(n & 255);
      } else if (c === 40) {
        depth++;
        out.push(c);
      } else if (c === 41) {
        depth--;
        if (depth === 0) return Uint8Array.from(out);
        out.push(c);
      } else out.push(c & 255);
    }
    throw new Eof('unterminated string');
  }

  private hexString(): Uint8Array {
    const s = this.s;
    this.i++;
    const out: number[] = [];
    let hi = -1;
    while (this.i < s.length) {
      const c = s.charCodeAt(this.i++);
      if (c === 62) {
        if (hi >= 0) out.push(hi << 4);
        return Uint8Array.from(out);
      }
      const v = c >= 48 && c <= 57 ? c - 48 : c >= 65 && c <= 70 ? c - 55 : c >= 97 && c <= 102 ? c - 87 : -1;
      if (v < 0) continue;
      if (hi < 0) hi = v;
      else {
        out.push((hi << 4) | v);
        hi = -1;
      }
    }
    throw new Eof('unterminated hex string');
  }
}

function decodeName(t: string): string {
  return t.indexOf('#') < 0 ? t : t.replace(/#([0-9A-Fa-f]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

// ---------------------------------------------------------------------------
// Text strings and dates
// ---------------------------------------------------------------------------

const PDFDOC_HIGH: Record<number, string> = {
  0x18: '˘', 0x19: 'ˇ', 0x1a: 'ˆ', 0x1b: '˙', 0x1c: '˝', 0x1d: '˛', 0x1e: '˚', 0x1f: '˜',
  0x80: '•', 0x81: '†', 0x82: '‡', 0x83: '…', 0x84: '—', 0x85: '–', 0x86: 'ƒ', 0x87: '⁄',
  0x88: '‹', 0x89: '›', 0x8a: '−', 0x8b: '‰', 0x8c: '„', 0x8d: '“', 0x8e: '”', 0x8f: '‘',
  0x90: '’', 0x91: '‚', 0x92: '™', 0x93: 'ﬁ', 0x94: 'ﬂ', 0x95: 'Ł', 0x96: 'Œ', 0x97: 'Š',
  0x98: 'Ÿ', 0x99: 'Ž', 0x9a: 'ı', 0x9b: 'ł', 0x9c: 'œ', 0x9d: 'š', 0x9e: 'ž', 0xa0: '€',
};

export function decodePdfText(b: Uint8Array): string {
  if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) return utf16(b, false, 2);
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) return utf16(b, true, 2);
  if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return utf8(b.subarray(3));
  let s = '';
  for (let i = 0; i < b.length; i++) {
    const c = b[i] ?? 0;
    s += PDFDOC_HIGH[c] ?? String.fromCharCode(c);
  }
  return s;
}

/** D:YYYYMMDDHHmmSSOHH'mm' -> ISO 8601 (keeps the original UTC offset). */
export function parsePdfDate(raw: string): string | null {
  const m = /^\s*D?:?\s*(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?\s*(Z|[+-])?\s*(\d{2})?'?\s*(\d{2})?'?\s*$/.exec(raw);
  if (!m) return null;
  const [, y, mo = '01', d = '01', h = '00', mi = '00', s = '00', tz, oh = '00', om = '00'] = m;
  const date = `${y}-${mo}-${d}T${h}:${mi}:${s}`;
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31 || +h > 23 || +mi > 59 || +s > 60) return null;
  if (!tz || tz === 'Z') return tz === 'Z' || (oh === '00' && om === '00' && tz) ? `${date}Z` : date;
  return `${date}${tz}${oh}:${om}`;
}

// ---------------------------------------------------------------------------
// Stream filters
// ---------------------------------------------------------------------------

function ascii85(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  let group: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const c = data[i] ?? 0;
    if (c === 126) break;
    if (isWs(c)) continue;
    if (c === 122 && group.length === 0) {
      out.push(0, 0, 0, 0);
      continue;
    }
    if (c < 33 || c > 117) continue;
    group.push(c - 33);
    if (group.length === 5) {
      let v = 0;
      for (const g of group) v = v * 85 + g;
      out.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
      group = [];
    }
  }
  if (group.length > 1) {
    const n = group.length;
    while (group.length < 5) group.push(84);
    let v = 0;
    for (const g of group) v = v * 85 + g;
    const bytes = [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
    out.push(...bytes.slice(0, n - 1));
  }
  return Uint8Array.from(out);
}

function pngPredictor(data: Uint8Array, columns: number, colors: number, bpc: number): Uint8Array {
  const rowBytes = Math.ceil((columns * colors * bpc) / 8);
  const bpp = Math.max(1, Math.ceil((colors * bpc) / 8));
  const rows = Math.floor(data.length / (rowBytes + 1));
  const out = new Uint8Array(rows * rowBytes);
  for (let r = 0; r < rows; r++) {
    const ft = data[r * (rowBytes + 1)] ?? 0;
    const src = r * (rowBytes + 1) + 1;
    const dst = r * rowBytes;
    for (let i = 0; i < rowBytes; i++) {
      const x = data[src + i] ?? 0;
      const a = i >= bpp ? (out[dst + i - bpp] ?? 0) : 0;
      const b = r > 0 ? (out[dst - rowBytes + i] ?? 0) : 0;
      const c2 = r > 0 && i >= bpp ? (out[dst - rowBytes + i - bpp] ?? 0) : 0;
      let v = x;
      if (ft === 1) v = x + a;
      else if (ft === 2) v = x + b;
      else if (ft === 3) v = x + ((a + b) >> 1);
      else if (ft === 4) {
        const p = a + b - c2;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c2);
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c2);
      }
      out[dst + i] = v & 255;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Document model
// ---------------------------------------------------------------------------

type XrefEntry = { kind: 0 } | { kind: 1; off: number } | { kind: 2; stm: number; idx: number };

interface ParsedObject {
  value: PV;
  streamOff: number | null;
}

function num(v: PV | null | undefined): number | null {
  return v && v.t === 'num' ? v.v : null;
}
function nameOf(v: PV | null | undefined): string | null {
  return v && v.t === 'name' ? v.v : null;
}

class PdfDoc {
  xref = new Map<number, XrefEntry>();
  trailer: PDict = {};
  sections = 0;
  rebuilt = false;
  xrefKinds = new Set<'table' | 'stream'>();
  private cache = new Map<number, PV | null>();
  private streamInfo = new Map<number, number>();
  private objStms = new Map<number, { text: string; first: number; offs: Map<number, number> } | null>();

  constructor(
    readonly rd: Reader,
    readonly size: number
  ) {}

  get encrypted(): boolean {
    return this.trailer['Encrypt'] !== undefined;
  }

  async loadXref(): Promise<void> {
    const tailLen = Math.min(this.size, 8192);
    const tail = latin1(await this.rd.read(this.size - tailLen, tailLen));
    const idx = tail.lastIndexOf('startxref');
    if (idx < 0) throw new Error('"startxref" keyword not found near the end of the file');
    const m = /startxref\s+(\d+)/.exec(tail.slice(idx));
    if (!m) throw new Error('startxref has no offset');
    let off: number | null = parseInt(m[1] ?? '0', 10);
    const seen = new Set<number>();
    while (off !== null && !seen.has(off) && this.sections < 300) {
      seen.add(off);
      off = await this.readXrefSection(off);
      this.sections++;
    }
  }

  private async readXrefSection(off: number): Promise<number | null> {
    if (off < 0 || off >= this.size) throw new Error(`xref offset ${off} is outside the file`);
    const head = latin1(await this.rd.read(off, 40));
    const t = head.replace(/^[\s\u0000]+/, '');
    if (t.startsWith('xref')) return this.readXrefTable(off);
    if (/^\d+\s+\d+\s+obj/.test(t)) return this.readXrefStream(off);
    throw new Error(`startxref offset ${off} does not point to a cross-reference section`);
  }

  private async readXrefTable(off: number): Promise<number | null> {
    this.xrefKinds.add('table');
    let want = 256 * 1024;
    for (;;) {
      const text = latin1(await this.rd.read(off, want));
      const atEnd = off + text.length >= this.size;
      let i = text.indexOf('xref') + 4;
      const entries: Array<[number, XrefEntry]> = [];
      let complete = false;
      let trailerAt = -1;
      const re = /\s*(\d{1,10})[ \t]+(\d{1,5})[ \t]*([nf])\s*/y;
      for (;;) {
        const sub = /\s*(\d+)\s+(\d+)\s*/y;
        sub.lastIndex = i;
        const lexSkip = /\s*/y;
        lexSkip.lastIndex = i;
        lexSkip.exec(text);
        if (text.startsWith('trailer', lexSkip.lastIndex)) {
          trailerAt = lexSkip.lastIndex + 7;
          complete = true;
          break;
        }
        const sm = sub.exec(text);
        if (!sm) break;
        i = sub.lastIndex;
        const first = parseInt(sm[1] ?? '0', 10);
        const count = parseInt(sm[2] ?? '0', 10);
        let ok = true;
        for (let k = 0; k < count; k++) {
          re.lastIndex = i;
          const em = re.exec(text);
          if (!em) {
            ok = false;
            break;
          }
          i = re.lastIndex;
          const o = parseInt(em[1] ?? '0', 10);
          entries.push([first + k, em[3] === 'n' && o > 0 ? { kind: 1, off: o } : { kind: 0 }]);
        }
        if (!ok) break;
      }
      if (!complete) {
        if (atEnd || want >= 128 * 1024 * 1024) throw new Error('cross-reference table is malformed or truncated');
        want *= 4;
        continue;
      }
      for (const [n, e] of entries) if (!this.xref.has(n)) this.xref.set(n, e);
      const lx = new Lexer(text, trailerAt);
      const tr = lx.parse();
      if (tr.t !== 'dict') throw new Error('trailer is not a dictionary');
      this.mergeTrailer(tr.v);
      const stm = num(tr.v['XRefStm']);
      if (stm !== null) {
        try {
          await this.readXrefStream(stm, true);
        } catch {
          /* hybrid-reference stream is optional */
        }
      }
      return num(tr.v['Prev']);
    }
  }

  private mergeTrailer(d: PDict): void {
    for (const k of ['Root', 'Info', 'Encrypt', 'ID', 'Size']) {
      if (this.trailer[k] === undefined && d[k] !== undefined) this.trailer[k] = d[k] as PV;
    }
  }

  private async readXrefStream(off: number, hybrid = false): Promise<number | null> {
    this.xrefKinds.add('stream');
    const obj = await this.readObjectAt(off, null);
    if (obj.value.t !== 'dict' || obj.streamOff === null) throw new Error('cross-reference stream object is malformed');
    const d = obj.value.v;
    const data = await this.streamData(d, obj.streamOff, 256 * 1024 * 1024);
    const wArr = d['W'];
    if (!wArr || wArr.t !== 'arr') throw new Error('xref stream has no /W array');
    const w = wArr.v.map((x) => num(x) ?? 0);
    const w0 = w[0] ?? 0, w1 = w[1] ?? 0, w2 = w[2] ?? 0;
    const size = num(d['Size']) ?? 0;
    const idxArr = d['Index'];
    const index: number[] = idxArr && idxArr.t === 'arr' ? idxArr.v.map((x) => num(x) ?? 0) : [0, size];
    const rec = w0 + w1 + w2;
    if (rec <= 0) throw new Error('invalid /W in xref stream');
    let p = 0;
    const rd = (n: number): number => {
      let v = 0;
      for (let k = 0; k < n; k++) v = v * 256 + (data[p++] ?? 0);
      return v;
    };
    for (let s = 0; s + 1 < index.length; s += 2) {
      const first = index[s] ?? 0;
      const count = index[s + 1] ?? 0;
      for (let k = 0; k < count && p + rec <= data.length; k++) {
        const type = w0 > 0 ? rd(w0) : 1;
        const f2 = rd(w1);
        const f3 = rd(w2);
        const n = first + k;
        if (this.xref.has(n)) continue;
        if (type === 0) this.xref.set(n, { kind: 0 });
        else if (type === 1) this.xref.set(n, { kind: 1, off: f2 });
        else if (type === 2) this.xref.set(n, { kind: 2, stm: f2, idx: f3 });
      }
    }
    if (!hybrid) this.mergeTrailer(d);
    return hybrid ? null : num(d['Prev']);
  }

  /** Last-resort recovery: scan the file for "N G obj" markers and trailers. */
  async rebuild(): Promise<void> {
    this.rebuilt = true;
    this.xref.clear();
    this.trailer = {};
    const CHUNK = 8 * 1024 * 1024;
    const limit = Math.min(this.size, 192 * 1024 * 1024);
    const objStms: number[] = [];
    const trailers: PDict[] = [];
    let catalog = -1;
    for (let base = 0; base < limit; base += CHUNK) {
      const bytes = await this.rd.read(base, CHUNK + 256);
      const text = latin1(bytes);
      const re = /(?:^|[\s>\]])(\d{1,10})[ \t\r\n]+(\d{1,5})[ \t\r\n]+obj\b/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        if (m.index >= CHUNK && base + CHUNK < limit) break;
        const n = parseInt(m[1] ?? '0', 10);
        const objOff = base + m.index + (m[0].length - m[0].trimStart().length);
        const start = base + m.index + m[0].indexOf(m[1] ?? '');
        this.xref.set(n, { kind: 1, off: start });
        void objOff;
        const peek = text.slice(m.index, m.index + 400);
        if (/\/Type\s*\/ObjStm/.test(peek)) objStms.push(n);
        else if (/\/Type\s*\/Catalog/.test(peek)) catalog = n;
        else if (/\/Type\s*\/XRef/.test(peek)) {
          try {
            const lx = new Lexer(text, m.index + m[0].length);
            const dv = lx.parse();
            if (dv.t === 'dict') trailers.push(dv.v);
          } catch {
            /* ignore */
          }
        }
      }
      const tre = /trailer\s*/g;
      let tm: RegExpExecArray | null;
      while ((tm = tre.exec(text)) !== null) {
        if (tm.index >= CHUNK && base + CHUNK < limit) break;
        try {
          const lx = new Lexer(text, tm.index + tm[0].length);
          const dv = lx.parse();
          if (dv.t === 'dict') trailers.push(dv.v);
        } catch {
          /* ignore */
        }
      }
    }
    for (const t of trailers.reverse()) this.mergeTrailer(t);
    if (!this.trailer['Root'] && catalog >= 0) this.trailer['Root'] = { t: 'ref', n: catalog, g: 0 };
    for (const stm of objStms.slice(0, 3000)) {
      try {
        const info = await this.objStm(stm);
        if (info) for (const [n] of info.offs) if (!this.xref.has(n)) this.xref.set(n, { kind: 2, stm, idx: 0 });
      } catch {
        /* encrypted or damaged object stream */
      }
    }
    if (!this.trailer['Info']) {
      // find an Info-looking dictionary
      for (const [n, e] of this.xref) {
        if (e.kind !== 1) continue;
        const win = latin1(await this.rd.read(e.off, 600));
        if (/\/(Producer|Creator|Author|Title)\s*[(<]/.test(win) && !/\/Type\s*\//.test(win.slice(0, 200))) {
          this.trailer['Info'] = { t: 'ref', n, g: 0 };
          break;
        }
      }
    }
  }

  async readObjectAt(off: number, expect: number | null): Promise<ParsedObject> {
    for (const win of [16 * 1024, 256 * 1024, 4 * 1024 * 1024, 32 * 1024 * 1024]) {
      const bytes = await this.rd.read(off, win);
      const text = latin1(bytes);
      const hm = /^[\s\u0000]*(\d+)\s+(\d+)\s+obj/.exec(text);
      if (!hm) throw new Error(`no "obj" header at offset ${off}`);
      if (expect !== null && parseInt(hm[1] ?? '-1', 10) !== expect) throw new Error(`object number mismatch at offset ${off}`);
      const lx = new Lexer(text, hm[0].length);
      let value: PV;
      try {
        value = lx.parse();
      } catch (e) {
        if (e instanceof Eof && off + bytes.length < this.size) continue;
        throw e;
      }
      lx.skipWs();
      let streamOff: number | null = null;
      if (text.startsWith('stream', lx.i)) {
        let p = lx.i + 6;
        if (text.charCodeAt(p) === 13 && text.charCodeAt(p + 1) === 10) p += 2;
        else if (text.charCodeAt(p) === 10 || text.charCodeAt(p) === 13) p += 1;
        streamOff = off + p;
      } else if (lx.i >= text.length - 8 && off + bytes.length < this.size) {
        continue;
      }
      return { value, streamOff };
    }
    throw new Error(`object at offset ${off} is too large to read`);
  }

  async get(n: number): Promise<PV | null> {
    if (this.cache.has(n)) return this.cache.get(n) ?? null;
    const e = this.xref.get(n);
    let v: PV | null = null;
    if (e && e.kind === 1) {
      const o = await this.readObjectAt(e.off, n);
      v = o.value;
      if (o.streamOff !== null) this.streamInfo.set(n, o.streamOff);
    } else if (e && e.kind === 2) {
      const stm = await this.objStm(e.stm);
      const off = stm?.offs.get(n);
      if (stm && off !== undefined) {
        const lx = new Lexer(stm.text, stm.first + off);
        v = lx.parse();
      }
    }
    this.cache.set(n, v);
    return v;
  }

  async resolve(v: PV | null | undefined): Promise<PV | null> {
    let cur: PV | undefined | null = v;
    for (let i = 0; i < 12 && cur && cur.t === 'ref'; i++) cur = await this.get(cur.n);
    return cur ?? null;
  }

  async dict(v: PV | null | undefined): Promise<PDict | null> {
    const r = await this.resolve(v);
    return r && r.t === 'dict' ? r.v : null;
  }

  private async objStm(n: number): Promise<{ text: string; first: number; offs: Map<number, number> } | null> {
    if (this.objStms.has(n)) return this.objStms.get(n) ?? null;
    const dv = await this.get(n);
    const so = this.streamInfo.get(n);
    if (!dv || dv.t !== 'dict' || so === undefined) {
      this.objStms.set(n, null);
      return null;
    }
    const d = dv.v;
    const data = await this.streamData(d, so, 128 * 1024 * 1024);
    const text = latin1(data);
    const count = num(d['N']) ?? 0;
    const first = num(d['First']) ?? 0;
    const lx = new Lexer(text, 0);
    const offs = new Map<number, number>();
    for (let k = 0; k < count; k++) {
      const a = lx.parse();
      const b = lx.parse();
      if (a.t !== 'num' || b.t !== 'num') break;
      offs.set(a.v, b.v);
    }
    const res = { text, first, offs };
    if (this.objStms.size > 12) this.objStms.clear();
    this.objStms.set(n, res);
    return res;
  }

  /** Raw (still filtered) bytes of a stream. */
  private async rawStream(d: PDict, off: number): Promise<Uint8Array> {
    const len = num(await this.resolve(d['Length']));
    if (len !== null && len >= 0 && off + len <= this.size) {
      const tail = latin1(await this.rd.read(off + len, 24));
      if (/^\s*endstream/.test(tail)) return (await this.rd.read(off, len)).slice();
    }
    // Length is wrong or missing: look for "endstream"
    const CHUNK = 4 * 1024 * 1024;
    let acc = '';
    for (let base = off; base < Math.min(this.size, off + 512 * 1024 * 1024); base += CHUNK) {
      const bytes = await this.rd.read(base, CHUNK);
      acc += latin1(bytes);
      const e = acc.indexOf('endstream');
      if (e >= 0) {
        let end = e;
        if (acc.charCodeAt(end - 1) === 10) end--;
        if (acc.charCodeAt(end - 1) === 13) end--;
        return (await this.rd.read(off, end)).slice();
      }
      if (bytes.length < CHUNK) break;
    }
    throw new Error('stream has no end marker');
  }

  async streamData(d: PDict, off: number, maxOut: number): Promise<Uint8Array> {
    let data = await this.rawStream(d, off);
    const f = await this.resolve(d['Filter'] ?? d['F']);
    const filters: string[] = [];
    if (f && f.t === 'name') filters.push(f.v);
    else if (f && f.t === 'arr') for (const x of f.v) filters.push(nameOf(await this.resolve(x)) ?? '');
    const dp = await this.resolve(d['DecodeParms'] ?? d['DP']);
    const parms: Array<PDict | null> = [];
    if (dp && dp.t === 'dict') parms.push(dp.v);
    else if (dp && dp.t === 'arr') for (const x of dp.v) parms.push(await this.dict(x));
    for (let i = 0; i < filters.length; i++) {
      const name = filters[i];
      const p = parms[i] ?? null;
      if (name === 'FlateDecode' || name === 'Fl') {
        try {
          data = inflateLimited(data, 'zlib', maxOut).out;
        } catch {
          data = inflateLimited(data.subarray(2), 'raw', maxOut).out;
        }
        const pred = p ? (num(p['Predictor']) ?? 1) : 1;
        if (p && pred >= 10) data = pngPredictor(data, num(p['Columns']) ?? 1, num(p['Colors']) ?? 1, num(p['BitsPerComponent']) ?? 8);
        else if (p && pred === 2) throw new Error('TIFF predictor is not supported');
      } else if (name === 'ASCII85Decode' || name === 'A85') data = ascii85(data);
      else if (name === 'ASCIIHexDecode' || name === 'AHx') {
        const hex = latin1(data).replace(/[^0-9A-Fa-f]/g, '');
        const out = new Uint8Array(Math.floor(hex.length / 2));
        for (let k = 0; k < out.length; k++) out[k] = parseInt(hex.slice(k * 2, k * 2 + 2), 16);
        data = out;
      } else throw new Error(`stream filter ${name} is not supported`);
    }
    return data;
  }

  async stream(n: number, maxOut: number): Promise<{ dict: PDict; data: Uint8Array } | null> {
    const v = await this.get(n);
    const off = this.streamInfo.get(n);
    if (!v || v.t !== 'dict' || off === undefined) return null;
    return { dict: v.v, data: await this.streamData(v.v, off, maxOut) };
  }
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

const PAPER: Array<[string, number, number]> = [
  ['A0', 2383.94, 3370.39], ['A1', 1683.78, 2383.94], ['A2', 1190.55, 1683.78], ['A3', 841.89, 1190.55], ['A4', 595.28, 841.89],
  ['A5', 419.53, 595.28], ['A6', 297.64, 419.53], ['B5', 498.9, 708.66], ['Letter', 612, 792], ['Legal', 612, 1008],
  ['Tabloid', 792, 1224], ['Executive', 522, 756], ['Statement', 396, 612],
];

function paperName(w: number, h: number): string {
  const a = Math.min(w, h);
  const b = Math.max(w, h);
  for (const [name, pw, ph] of PAPER) {
    if (Math.abs(a - pw) <= 3 && Math.abs(b - ph) <= 3) return name;
  }
  return '';
}

const INFO_ORDER = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate', 'Trapped'];

function pdfString(v: PV | null): string | null {
  if (!v) return null;
  if (v.t === 'str') return decodePdfText(v.v);
  if (v.t === 'name') return v.v;
  if (v.t === 'num') return String(v.v);
  if (v.t === 'bool') return String(v.v);
  return null;
}

const PERMS: Array<[number, string]> = [
  [4, 'print'], [8, 'modify'], [16, 'copy text'], [32, 'annotate'], [256, 'fill forms'], [512, 'accessibility extraction'], [1024, 'assemble'], [2048, 'high-quality print'],
];

export async function parsePdf(c: Ctx): Promise<void> {
  const { rd, size, out } = c;
  const sec = out.section('pdf', 'PDF document');
  const headTxt = latin1(c.head.subarray(0, 1100));
  const hm = /%PDF-(\d\.\d+)/.exec(headTxt);
  const headerOffset = hm ? headTxt.indexOf('%PDF-') : 0;
  const doc = new PdfDoc(rd, size);
  let structureError: string | null = null;
  try {
    await doc.loadXref();
  } catch (e) {
    structureError = e instanceof Error ? e.message : String(e);
  }
  if (structureError || !doc.trailer['Root']) {
    if (size <= 192 * 1024 * 1024) {
      try {
        await doc.rebuild();
        out.note(`The cross-reference table could not be used${structureError ? ` (${structureError})` : ''}. The file structure was rebuilt by scanning for objects.`);
        structureError = null;
      } catch (e) {
        structureError = e instanceof Error ? e.message : String(e);
      }
    }
  }
  if (structureError) out.errors.push(`could not parse PDF structure: ${structureError}`);
  else if (!doc.trailer['Root']) out.errors.push('could not parse PDF structure: no document catalog (/Root) was found');

  const version = hm?.[1] ?? '';
  const encryptDict = await doc.dict(doc.trailer['Encrypt']).catch(() => null);
  const root = await doc.dict(doc.trailer['Root']).catch(() => null);
  const catVersion = root ? nameOf(root['Version']) : null;
  if (version) out.row(sec, 'PDF version', catVersion && catVersion !== version ? `${catVersion} (catalog; file header says ${version})` : version);
  if (headerOffset > 0) out.row(sec, 'Junk before %PDF header', `${headerOffset} bytes`);

  // --- pages / page size
  let pages: number | null = null;
  let pageSize = '';
  let rotation = 0;
  if (root) {
    await out.attempt('page tree', async () => {
      const pagesRoot = await doc.dict(root['Pages']);
      if (pagesRoot) {
        pages = num(await doc.resolve(pagesRoot['Count']));
        // first page: follow /Kids[0], collecting inherited attributes
        let node: PDict | null = pagesRoot;
        let mediaBox: PV | undefined = pagesRoot['MediaBox'];
        let crop: PV | undefined = pagesRoot['CropBox'];
        let rot: PV | undefined = pagesRoot['Rotate'];
        for (let depth = 0; depth < 40 && node; depth++) {
          const kidsV: PV | null = await doc.resolve(node['Kids']);
          if (!kidsV || kidsV.t !== 'arr' || kidsV.v.length === 0) break;
          const kid: PDict | null = await doc.dict(kidsV.v[0]);
          if (!kid) break;
          if (kid['MediaBox']) mediaBox = kid['MediaBox'];
          if (kid['CropBox']) crop = kid['CropBox'];
          if (kid['Rotate']) rot = kid['Rotate'];
          node = kid;
        }
        const box = await doc.resolve(crop ?? mediaBox);
        if (box && box.t === 'arr' && box.v.length >= 4) {
          const n4: number[] = [];
          for (const x of box.v.slice(0, 4)) n4.push(num(await doc.resolve(x)) ?? 0);
          const w = Math.abs((n4[2] ?? 0) - (n4[0] ?? 0));
          const h = Math.abs((n4[3] ?? 0) - (n4[1] ?? 0));
          rotation = num(await doc.resolve(rot)) ?? 0;
          const paper = paperName(w, h);
          pageSize = `${fmtNum(w, 1)} × ${fmtNum(h, 1)} pt (${fmtNum(w / 2.834646, 0)} × ${fmtNum(h / 2.834646, 0)} mm; ${fmtNum(w / 72, 2)} × ${fmtNum(h / 72, 2)} in)${paper ? ` · ${paper}` : ''}`;
        }
      }
    });
  }
  if (pages === null && c.pdfFallback && size <= 150 * 1024 * 1024) {
    await out.attempt('PDF (fallback reader)', async () => {
      const all = (await rd.read(0, size)).slice();
      const fb = await c.pdfFallback?.(all);
      if (fb && fb.pages !== null) pages = fb.pages;
    });
  }
  out.row(sec, 'Pages', pages !== null ? String(pages) : undefined);
  out.row(sec, 'First page size', pageSize || undefined);
  if (rotation) out.row(sec, 'First page rotation', `${rotation}°`);

  // --- encryption
  if (encryptDict) {
    const v = num(encryptDict['V']) ?? 0;
    const r = num(encryptDict['R']) ?? 0;
    let lenBits = num(encryptDict['Length']) ?? 40;
    let algo = v === 1 ? 'RC4 40-bit' : v === 2 ? `RC4 ${lenBits}-bit` : v === 5 ? 'AES-256' : 'RC4/AES';
    if (v === 4) {
      const cf = await doc.dict(encryptDict['CF']);
      const std = cf ? await doc.dict(cf['StdCF']) : null;
      const cfm = std ? nameOf(std['CFM']) : null;
      algo = cfm === 'AESV2' ? 'AES-128' : cfm === 'AESV3' ? 'AES-256' : cfm === 'V2' ? 'RC4 128-bit' : 'crypt filters';
      lenBits = 128;
    }
    out.row(sec, 'Encryption', `yes: ${algo} (V${v}, R${r})`);
    const p = num(encryptDict['P']);
    if (p !== null) {
      const allowed = PERMS.filter(([bit]) => (p & bit) !== 0).map(([, n]) => n);
      const denied = PERMS.filter(([bit]) => (p & bit) === 0).map(([, n]) => n);
      out.row(sec, 'Permissions allowed', allowed.join(', ') || 'none');
      if (denied.length) out.row(sec, 'Permissions denied', denied.join(', '));
    }
    out.note('This PDF is encrypted. Info-dictionary strings and XMP are stored encrypted and cannot be read without decrypting.');
  } else {
    out.row(sec, 'Encryption', 'no');
  }
  out.row(sec, 'Linearized (fast web view)', /\/Linearized\b/.test(headTxt) ? 'yes' : 'no');
  if (doc.rebuilt) out.row(sec, 'Cross-reference data', 'damaged; rebuilt by scanning');
  else if (doc.xrefKinds.size > 0) out.row(sec, 'Cross-reference format', Array.from(doc.xrefKinds).map((k) => (k === 'table' ? 'classic table' : 'xref stream + object streams')).join(' + '));
  out.row(sec, 'Objects (xref entries)', doc.xref.size ? doc.xref.size.toLocaleString('en-US') : undefined);

  // --- document ID
  const idArr = await doc.resolve(doc.trailer['ID']);
  if (idArr && idArr.t === 'arr') {
    const ids = idArr.v.map((x) => (x.t === 'str' ? toHex(x.v) : '')).filter(Boolean);
    if (ids[0]) out.row(sec, 'Document ID (original)', ids[0]);
    if (ids[1]) out.row(sec, 'Document ID (current)', ids[1] + (ids[0] && ids[1] !== ids[0] ? '  · differs: file was modified after creation' : ''));
  }

  // --- catalog flags
  if (root) {
    const lang = pdfString(await doc.resolve(root['Lang']));
    out.row(sec, 'Language', lang ?? undefined);
    const mark = await doc.dict(root['MarkInfo']);
    out.row(sec, 'Tagged PDF (accessible)', mark && (await doc.resolve(mark['Marked']))?.t === 'bool' ? 'yes' : root['StructTreeRoot'] ? 'yes' : 'no');
    if (root['AcroForm']) {
      const af = await doc.dict(root['AcroForm']);
      const fields = af ? await doc.resolve(af['Fields']) : null;
      out.row(sec, 'Interactive form', `yes${fields && fields.t === 'arr' ? ` (${fields.v.length} top-level field${fields.v.length === 1 ? '' : 's'})` : ''}${af && af['XFA'] ? ', XFA' : ''}`);
      const sigFlags = af ? num(await doc.resolve(af['SigFlags'])) : null;
      if (sigFlags) out.row(sec, 'Signature flags', sigFlags & 1 ? 'document contains signatures' : String(sigFlags));
    }
    if (root['OCProperties']) out.row(sec, 'Layers (optional content)', 'yes');
    if (root['Outlines']) out.row(sec, 'Bookmarks / outline', 'yes');
    if (root['OpenAction']) {
      const oa = await doc.resolve(root['OpenAction']);
      if (oa && oa.t === 'dict') {
        const kind = nameOf(oa.v['S']) ?? 'unknown';
        out.row(sec, 'Open action', `${kind} action, runs when the file is opened`);
        if (kind === 'JavaScript' || kind === 'Launch' || kind === 'URI' || kind === 'SubmitForm') out.find('other', `${kind} open action`, 'An action is triggered automatically when the PDF is opened.');
      } else out.row(sec, 'Open action', 'go to a page view (destination)');
    }
    if (root['AA']) out.row(sec, 'Additional actions', 'defined');
    const perms = await doc.dict(root['Perms']);
    if (perms && perms['DocMDP']) out.row(sec, 'Certified (DocMDP)', 'yes');
    const names = await doc.dict(root['Names']);
    if (names?.['EmbeddedFiles']) {
      out.row(sec, 'Embedded files', 'yes (name tree present)');
      out.find('other', 'Embedded files', 'The PDF carries file attachments.');
    }
    if (names?.['JavaScript']) {
      out.row(sec, 'Document-level JavaScript', 'yes');
      out.find('other', 'JavaScript', 'Document-level JavaScript is present.');
    }
  }

  // --- feature scan of uncompressed content
  await out.attempt('raw feature scan', async () => {
    if (size > 96 * 1024 * 1024) return;
    const counts = new Map<string, number>();
    let eof = 0;
    const CHUNK = 4 * 1024 * 1024;
    const re = /\/(JavaScript|JS|Launch|EmbeddedFile|ByteRange|RichMedia|XFA|SubmitForm|URI|OpenAction)(?![A-Za-z0-9])|%%EOF/g;
    for (let base = 0; base < size; base += CHUNK) {
      const text = latin1(await rd.read(base, CHUNK + 40));
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        if (m.index >= CHUNK && base + CHUNK < size) break;
        if (m[0] === '%%EOF') eof++;
        else counts.set(m[1] ?? '', (counts.get(m[1] ?? '') ?? 0) + 1);
      }
    }
    const linearized = /\/Linearized\b/.test(headTxt);
    const updates = Math.max(0, eof - (linearized ? 2 : 1));
    out.row(sec, 'Revisions (%%EOF markers)', eof ? `${eof}${updates > 0 ? ` · ${updates} incremental update${updates === 1 ? '' : 's'}` : ''}` : undefined);
    if (updates > 0) out.find('editing', 'Incremental updates', `${updates} appended revision${updates === 1 ? '' : 's'}: earlier versions of pages or metadata may still be recoverable from the file`);
    const feats: string[] = [];
    const add = (k: string, label: string) => {
      const n = counts.get(k);
      if (n) feats.push(`${label} ×${n}`);
    };
    add('JavaScript', 'JavaScript');
    add('JS', 'JS');
    add('Launch', 'Launch actions');
    add('EmbeddedFile', 'embedded files');
    add('ByteRange', 'digital signatures');
    add('RichMedia', 'rich media');
    add('XFA', 'XFA forms');
    add('SubmitForm', 'form submit');
    add('URI', 'links (URI)');
    if (feats.length) out.row(sec, 'Features found in uncompressed objects', feats.join(', '));
    if ((counts.get('JavaScript') ?? 0) + (counts.get('JS') ?? 0) > 0) out.find('other', 'JavaScript', 'The PDF contains JavaScript actions.');
    if (counts.get('Launch')) out.find('other', 'Launch actions', 'The PDF contains /Launch actions.');
    if (counts.get('EmbeddedFile')) out.find('other', 'Embedded files', 'The PDF carries file attachments.');
  });

  // --- Info dictionary
  const info = await doc.dict(doc.trailer['Info']).catch(() => null);
  const infoSec = out.section('pdf-info', 'Document information (Info dictionary)');
  if (info) {
    const keys = [...INFO_ORDER.filter((k) => info[k] !== undefined), ...Object.keys(info).filter((k) => !INFO_ORDER.includes(k))];
    const custom: string[] = [];
    for (const k of keys) {
      const raw = await doc.resolve(info[k]);
      let val = pdfString(raw);
      if (val === null) continue;
      if (doc.encrypted && raw && raw.t === 'str') val = '(encrypted)';
      if (k === 'CreationDate' || k === 'ModDate') {
        const iso = doc.encrypted ? null : parsePdfDate(val);
        out.row(infoSec, k, iso ? `${iso}   (raw ${val})` : val);
      } else out.row(infoSec, k, val);
      if (!INFO_ORDER.includes(k)) custom.push(k);
      if (doc.encrypted) continue;
      if (k === 'Author' && val) out.find('person', 'Author', val);
      else if (k === 'Creator' && val) out.find('software', 'Creator (authoring application)', val);
      else if (k === 'Producer' && val) out.find('software', 'Producer (PDF library)', val);
    }
    if (custom.length) out.find('other', 'Custom Info keys', custom.join(', '));
  } else if (doc.trailer['Info'] === undefined && !structureError) {
    out.note('This PDF has no Info dictionary (metadata, if any, lives in XMP).');
  }

  // --- fallback reader for what the built-in parser could not read
  if (c.pdfFallback && !info && size <= 150 * 1024 * 1024 && !doc.encrypted) {
    await out.attempt('PDF (fallback reader)', async () => {
      const all = (await rd.read(0, size)).slice();
      const fb = await c.pdfFallback?.(all);
      if (!fb) return;
      for (const line of fb.info.split('\n')) {
        const i = line.indexOf(':');
        if (i <= 0) continue;
        const k = line.slice(0, i).trim();
        if (k === 'Pages' || k === 'PDF version') continue;
        out.row(infoSec, k, line.slice(i + 1).trim());
        if (k === 'Author') out.find('person', 'Author', line.slice(i + 1).trim());
        if (k === 'Creator') out.find('software', 'Creator (authoring application)', line.slice(i + 1).trim());
        if (k === 'Producer') out.find('software', 'Producer (PDF library)', line.slice(i + 1).trim());
      }
    });
  }

  // --- XMP
  let xmpDone = false;
  if (root && root['Metadata'] && !doc.encrypted) {
    await out.attempt('XMP metadata stream', async () => {
      const ref = root['Metadata'];
      if (ref && ref.t === 'ref') {
        const st = await doc.stream(ref.n, 8 * 1024 * 1024);
        if (st) {
          const pk = extractXmpPacket(st.data);
          if (pk) {
            emitXmp(out, pk);
            xmpDone = true;
          }
        }
      }
    });
  }
  if (!xmpDone && !doc.encrypted) {
    await out.attempt('XMP scan', async () => {
      const CHUNK = 8 * 1024 * 1024;
      for (let base = 0; base < Math.min(size, 96 * 1024 * 1024); base += CHUNK) {
        const bytes = await rd.read(base, CHUNK + 4096);
        const text = latin1(bytes);
        const i = text.indexOf('<x:xmpmeta');
        if (i >= 0) {
          const pk = extractXmpPacket(bytes.subarray(i));
          if (pk) {
            emitXmp(out, pk);
            xmpDone = true;
          }
          break;
        }
      }
    });
  }
  if (!xmpDone && !doc.encrypted) out.note('No XMP packet found (it may be inside a compressed or unreadable stream).');
  void u16;
}
