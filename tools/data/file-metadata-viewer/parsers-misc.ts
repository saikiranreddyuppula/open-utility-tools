/** Fonts, archives (GZIP / TAR / 7z / RAR), executables (ELF / PE / Mach-O / WASM / Java class) and SQLite. */
import { detectBinaryType } from './magic';
import {
  type Ctx,
  asciiBytes,
  bytesEq,
  clean,
  fmtBytes,
  fmtNum,
  fourcc,
  i32,
  inflateLimited,
  isoFromMac,
  isoFromUnix,
  latin1,
  readExact,
  toHex,
  u16,
  u32,
  u64,
  u8,
  utf16,
  utf8,
  utf8Strict,
} from './util';

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

interface FontTable {
  off: number;
  len: number;
  comp: number;
}

interface FontSrc {
  container: 'sfnt' | 'woff' | 'woff2' | 'ttc';
  flavor: string;
  tables: Map<string, FontTable>;
  order: string[];
  read(tag: string, max?: number): Promise<Uint8Array | null>;
}

const WOFF2_TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH',
  'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc',
  'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill',
];

async function openFont(c: Ctx, fontIndex = 0): Promise<FontSrc> {
  const { rd } = c;
  const h = await readExact(rd, 0, 48);
  const sig = fourcc(h, 0);
  const tables = new Map<string, FontTable>();
  const order: string[] = [];
  if (sig === 'wOFF') {
    const n = u16(h, 12);
    const dir = await readExact(rd, 44, n * 20);
    for (let i = 0; i < n; i++) {
      const tag = fourcc(dir, i * 20);
      tables.set(tag, { off: u32(dir, i * 20 + 4), comp: u32(dir, i * 20 + 8), len: u32(dir, i * 20 + 12) });
      order.push(tag);
    }
    return {
      container: 'woff',
      flavor: fourcc(h, 4),
      tables,
      order,
      async read(tag, max = 16 * 1024 * 1024) {
        const t = tables.get(tag);
        if (!t) return null;
        const raw = await rd.read(t.off, t.comp);
        if (t.comp < t.len) return inflateLimited(raw, 'zlib', Math.min(t.len, max)).out;
        return raw.slice(0, Math.min(t.len, max));
      },
    };
  }
  if (sig === 'wOF2') {
    const n = u16(h, 12);
    const buf = await rd.read(48, Math.min(rd.size - 48, n * 24 + 64));
    let p = 0;
    const base128 = (): number => {
      let v = 0;
      for (let i = 0; i < 5; i++) {
        const b = u8(buf, p++);
        v = v * 128 + (b & 0x7f);
        if (!(b & 0x80)) break;
      }
      return v;
    };
    for (let i = 0; i < n && p < buf.length; i++) {
      const flags = u8(buf, p++);
      const idx = flags & 63;
      let tag: string;
      if (idx === 63) {
        tag = fourcc(buf, p);
        p += 4;
      } else tag = WOFF2_TAGS[idx] ?? `?${idx}`;
      const xform = flags >> 6;
      const orig = base128();
      const isTransformed = tag === 'glyf' || tag === 'loca' ? xform === 0 : xform !== 0;
      const tlen = isTransformed ? base128() : orig;
      tables.set(tag, { off: 0, comp: tlen, len: orig });
      order.push(tag);
    }
    return { container: 'woff2', flavor: fourcc(h, 4), tables, order, async read() { return null; } };
  }
  let dirOff = 0;
  let container: FontSrc['container'] = 'sfnt';
  if (sig === 'ttcf') {
    container = 'ttc';
    dirOff = u32(await readExact(rd, 12 + fontIndex * 4, 4), 0);
  }
  const dh = await readExact(rd, dirOff, 12);
  const n = u16(dh, 4);
  const dir = await readExact(rd, dirOff + 12, n * 16);
  for (let i = 0; i < n; i++) {
    const tag = fourcc(dir, i * 16);
    tables.set(tag, { off: u32(dir, i * 16 + 8), len: u32(dir, i * 16 + 12), comp: u32(dir, i * 16 + 12) });
    order.push(tag);
  }
  return {
    container,
    flavor: fourcc(dh, 0),
    tables,
    order,
    async read(tag, max = 16 * 1024 * 1024) {
      const t = tables.get(tag);
      if (!t) return null;
      return (await rd.read(t.off, Math.min(t.len, max))).slice();
    },
  };
}

const NAME_IDS: Array<[number, string]> = [
  [1, 'Family'], [2, 'Subfamily'], [4, 'Full name'], [6, 'PostScript name'], [16, 'Typographic family'], [17, 'Typographic subfamily'], [5, 'Version'], [3, 'Unique ID'],
  [0, 'Copyright'], [7, 'Trademark'], [8, 'Manufacturer'], [9, 'Designer'], [10, 'Description'], [11, 'Vendor URL'], [12, 'Designer URL'], [13, 'License'], [14, 'License URL'], [19, 'Sample text'],
];

function parseNameTable(b: Uint8Array): Map<number, string> {
  const count = u16(b, 2);
  const strOff = u16(b, 4);
  const best = new Map<number, { score: number; text: string }>();
  for (let i = 0; i < count; i++) {
    const o = 6 + i * 12;
    const plat = u16(b, o);
    const enc = u16(b, o + 2);
    const lang = u16(b, o + 4);
    const id = u16(b, o + 6);
    const len = u16(b, o + 8);
    const off = u16(b, o + 10);
    const raw = b.subarray(strOff + off, strOff + off + len);
    let text: string;
    let score: number;
    if (plat === 3 || plat === 0) {
      text = utf16(raw, false);
      score = plat === 3 && lang === 0x409 ? 4 : plat === 3 ? 3 : 2;
    } else if (plat === 1) {
      text = latin1(raw);
      score = lang === 0 ? 1.5 : 1;
    } else continue;
    void enc;
    text = clean(text.replace(/\u0000/g, '')).trim();
    if (!text) continue;
    const cur = best.get(id);
    if (!cur || score > cur.score) best.set(id, { score, text });
  }
  const out = new Map<number, string>();
  for (const [k, v] of best) out.set(k, v.text);
  return out;
}

const WEIGHTS: Record<number, string> = { 100: 'Thin', 200: 'Extra-Light', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semi-Bold', 700: 'Bold', 800: 'Extra-Bold', 900: 'Black' };
const WIDTHS = ['', 'Ultra-condensed', 'Extra-condensed', 'Condensed', 'Semi-condensed', 'Medium (normal)', 'Semi-expanded', 'Expanded', 'Extra-expanded', 'Ultra-expanded'];

function fsTypeText(v: number): string {
  if (v === 0) return 'Installable embedding (no restrictions)';
  const parts: string[] = [];
  if (v & 0x0002) parts.push('restricted license (no embedding)');
  if (v & 0x0004) parts.push('preview & print embedding');
  if (v & 0x0008) parts.push('editable embedding');
  if (v & 0x0100) parts.push('no subsetting');
  if (v & 0x0200) parts.push('bitmap embedding only');
  return parts.join(', ') || `0x${v.toString(16)}`;
}

export async function parseFont(c: Ctx): Promise<void> {
  const { rd, out } = c;
  const sig = fourcc(c.head, 0);
  const sec = out.section('font', 'Font');
  let collectionCount = 0;
  if (sig === 'ttcf') collectionCount = u32(await readExact(rd, 8, 4), 0);
  const f = await openFont(c, 0);
  const flavorName = f.flavor === 'OTTO' ? 'CFF (OpenType PostScript outlines)' : f.flavor === 'true' ? 'TrueType (Apple)' : f.flavor === '\u0000\u0001\u0000\u0000' ? 'TrueType outlines' : f.flavor === 'wOFF' ? '' : toHex(Uint8Array.from(asciiBytes(f.flavor)));
  out.row(sec, 'Container', f.container === 'ttc' ? `Font collection (${collectionCount} fonts; first font shown)` : f.container === 'woff' ? 'WOFF 1.0 (zlib-compressed tables)' : f.container === 'woff2' ? 'WOFF2 (Brotli-compressed)' : 'SFNT (TTF / OTF)');
  if (f.container === 'woff' || f.container === 'woff2') {
    const h = await readExact(rd, 0, 48);
    out.row(sec, 'Outline flavour', f.flavor === 'OTTO' ? 'CFF (OpenType PostScript)' : 'TrueType');
    out.row(sec, 'Decoded SFNT size', fmtBytes(u32(h, 16)));
    out.row(sec, 'WOFF version', `${u16(h, f.container === 'woff' ? 20 : 24)}.${u16(h, f.container === 'woff' ? 22 : 26)}`);
    if (f.container === 'woff2') {
      out.row(sec, 'Compressed table data', fmtBytes(u32(h, 20)));
      out.note('WOFF2 tables use Brotli compression, which this tool cannot decompress offline: only the header and table list are shown (names, weight and dates are not readable).');
    }
    const metaOff = u32(h, f.container === 'woff' ? 24 : 28);
    const metaLen = u32(h, f.container === 'woff' ? 28 : 32);
    const metaOrig = u32(h, f.container === 'woff' ? 32 : 36);
    if (f.container === 'woff' && metaOff && metaLen && metaLen < 1024 * 1024) {
      await out.attempt('WOFF metadata block', async () => {
        const raw = await rd.read(metaOff, metaLen);
        const xml = utf8(inflateLimited(raw, 'zlib', Math.min(metaOrig || 1024 * 1024, 1024 * 1024)).out);
        const msec = out.section('woff-meta', 'WOFF extended metadata (XML)');
        const uniq = /<uniqueid\b[^>]*\bid="([^"]*)"/.exec(xml)?.[1];
        const vendor = /<vendor\b[^>]*\bname="([^"]*)"/.exec(xml)?.[1];
        out.row(msec, 'Unique ID', uniq);
        out.row(msec, 'Vendor', vendor);
        const credits = Array.from(xml.matchAll(/<credit\b[^>]*\bname="([^"]*)"/g)).map((m) => m[1] ?? '');
        out.row(msec, 'Credits', credits.join(', '));
        const lic = /<license\b[^>]*\burl="([^"]*)"/.exec(xml)?.[1];
        out.row(msec, 'License URL', lic);
        msec.raw = { label: 'WOFF metadata XML', text: xml.slice(0, 50000) };
        if (vendor) out.find('company', 'Font vendor (WOFF metadata)', vendor);
        if (credits.length) out.find('person', 'Font credits (WOFF metadata)', credits.join(', '));
      });
    }
  } else {
    out.row(sec, 'Outline format', flavorName);
  }
  out.row(sec, 'Tables', `${f.order.length}: ${f.order.join(', ')}`);

  if (f.container === 'woff2') return;
  const nameB = await f.read('name');
  if (nameB) {
    const names = parseNameTable(nameB);
    const nsec = out.section('font-names', 'Font names (name table)');
    for (const [id, label] of NAME_IDS) {
      const t = names.get(id);
      if (t) out.row(nsec, label, t.length > 1200 ? `${t.slice(0, 1200)}…` : t);
    }
    const designer = names.get(9);
    const manu = names.get(8);
    if (designer) out.find('person', 'Font designer', designer);
    if (manu) out.find('company', 'Font manufacturer', manu);
    const copyright = names.get(0);
    if (copyright) out.find('other', 'Font copyright notice', copyright.length > 160 ? `${copyright.slice(0, 160)}…` : copyright);
  } else out.errors.push('could not parse font names: no name table');
  const os2 = await f.read('OS/2');
  const sty = out.section('font-style', 'Style & metrics');
  if (os2 && os2.length >= 68) {
    const wc = u16(os2, 4);
    out.row(sty, 'Weight class', `${wc}${WEIGHTS[wc] ? ` (${WEIGHTS[wc]})` : ''}`);
    out.row(sty, 'Width class', WIDTHS[u16(os2, 6)] ? `${u16(os2, 6)} (${WIDTHS[u16(os2, 6)]})` : String(u16(os2, 6)));
    out.row(sty, 'Embedding permissions (fsType)', fsTypeText(u16(os2, 8)));
    const vend = latin1(os2, 58, 62).replace(/[^\x20-\x7e]/g, '').trim();
    out.row(sty, 'Vendor ID', vend);
    const fsSel = u16(os2, 62);
    const flags = [fsSel & 1 ? 'italic' : '', fsSel & 32 ? 'bold' : '', fsSel & 64 ? 'regular' : '', fsSel & 512 ? 'oblique' : '', fsSel & 128 ? 'use typo metrics' : ''].filter(Boolean);
    out.row(sty, 'Style flags (fsSelection)', flags.join(', '));
    out.row(sty, 'OS/2 table version', String(u16(os2, 0)));
    out.row(sty, 'Typographic ascender / descender', `${(u16(os2, 68) << 16 >> 16)} / ${(u16(os2, 70) << 16 >> 16)}`);
    if (os2.length >= 90 && u16(os2, 0) >= 2) {
      out.row(sty, 'x-height / cap height', `${u16(os2, 86)} / ${u16(os2, 88)}`);
    }
    if (vend) out.find('company', 'Font vendor ID (OS/2)', vend);
  }
  const head = await f.read('head');
  if (head && head.length >= 54) {
    out.row(sty, 'Units per em', String(u16(head, 18)));
    out.row(sty, 'Font revision', fmtNum(u32(head, 4) / 65536, 3));
    const created = u64(head, 20);
    const modified = u64(head, 28);
    out.row(sty, 'Created (head)', isoFromMac(created) ?? undefined);
    out.row(sty, 'Modified (head)', isoFromMac(modified) ?? undefined);
    const mac = u16(head, 44);
    if (mac) out.row(sty, 'Mac style', [mac & 1 ? 'bold' : '', mac & 2 ? 'italic' : '', mac & 4 ? 'underline' : '', mac & 32 ? 'condensed' : ''].filter(Boolean).join(', '));
    out.row(sty, 'Bounding box', `${u16(head, 36) << 16 >> 16}, ${u16(head, 38) << 16 >> 16} → ${u16(head, 40) << 16 >> 16}, ${u16(head, 42) << 16 >> 16}`);
  }
  const maxp = await f.read('maxp', 64);
  if (maxp && maxp.length >= 6) out.row(sty, 'Glyph count', u16(maxp, 4).toLocaleString('en-US'));
  const post = await f.read('post', 64);
  if (post && post.length >= 16) {
    out.row(sty, 'Italic angle', `${fmtNum(i32(post, 4) / 65536, 2)}°`);
    out.row(sty, 'Monospaced', u32(post, 12) ? 'yes' : 'no');
  }
  const tags = new Set(f.order);
  const feats: string[] = [];
  if (tags.has('glyf')) feats.push('TrueType outlines (glyf)');
  if (tags.has('CFF ')) feats.push('CFF outlines');
  if (tags.has('CFF2')) feats.push('CFF2 outlines');
  if (tags.has('fvar')) feats.push('variable font (fvar)');
  if (tags.has('COLR') || tags.has('CBDT') || tags.has('sbix') || tags.has('SVG ')) feats.push('colour glyphs');
  if (tags.has('GSUB') || tags.has('GPOS')) feats.push('OpenType layout (GSUB/GPOS)');
  if (tags.has('kern')) feats.push('kern table');
  if (tags.has('gasp')) feats.push('gasp');
  if (tags.has('DSIG')) feats.push('digital signature (DSIG)');
  if (tags.has('hdmx') || tags.has('VDMX')) feats.push('device metrics');
  out.row(sty, 'Features', feats.join(', '));
  const fvar = await f.read('fvar', 4096);
  if (fvar && fvar.length >= 16) {
    const axesOff = u16(fvar, 4);
    const nAxes = u16(fvar, 8);
    const axSize = u16(fvar, 10);
    const nInst = u16(fvar, 12);
    const axes: string[] = [];
    for (let i = 0; i < nAxes && i < 16; i++) {
      const o = axesOff + i * axSize;
      axes.push(`${fourcc(fvar, o)} ${fmtNum(i32(fvar, o + 4) / 65536, 1)}–${fmtNum(i32(fvar, o + 12) / 65536, 1)} (default ${fmtNum(i32(fvar, o + 8) / 65536, 1)})`);
    }
    out.row(sty, 'Variation axes', axes.join('; '));
    out.row(sty, 'Named instances', String(nInst));
  }
  if (sig === 'ttcf' && collectionCount > 1) {
    await out.attempt('font collection members', async () => {
      const csec = out.section('font-collection', 'Fonts in collection', { collapsed: true });
      for (let i = 0; i < Math.min(collectionCount, 24); i++) {
        const fi = await openFont(c, i);
        const nb = await fi.read('name');
        const names = nb ? parseNameTable(nb) : new Map<number, string>();
        out.row(csec, `Font ${i + 1}`, names.get(4) ?? names.get(1) ?? '(unnamed)');
      }
    });
  }
}

// ---------------------------------------------------------------------------
// GZIP
// ---------------------------------------------------------------------------

const GZ_OS: Record<number, string> = {
  0: 'FAT (MS-DOS)', 1: 'Amiga', 2: 'VMS', 3: 'Unix', 4: 'VM/CMS', 5: 'Atari TOS', 6: 'HPFS (OS/2)', 7: 'Macintosh', 8: 'Z-System', 9: 'CP/M', 10: 'TOPS-20', 11: 'NTFS (Windows)',
  12: 'QDOS', 13: 'Acorn RISCOS', 255: 'unknown',
};

export async function parseGzip(c: Ctx): Promise<void> {
  const { rd, size, out } = c;
  const sec = out.section('gzip', 'GZIP header');
  const h = await rd.read(0, 16384);
  const flg = u8(h, 3);
  const mtime = u32(h, 4, true);
  const xfl = u8(h, 8);
  out.row(sec, 'Compression method', u8(h, 2) === 8 ? 'deflate' : String(u8(h, 2)));
  out.row(sec, 'Modification time', mtime ? (isoFromUnix(mtime) ?? String(mtime)) : 'not set (0)');
  out.row(sec, 'Compression level hint', xfl === 2 ? 'maximum compression' : xfl === 4 ? 'fastest' : 'default');
  out.row(sec, 'Created on (OS)', GZ_OS[u8(h, 9)] ?? String(u8(h, 9)));
  const flags = [flg & 1 ? 'text' : '', flg & 2 ? 'header CRC' : '', flg & 4 ? 'extra field' : '', flg & 8 ? 'file name' : '', flg & 16 ? 'comment' : ''].filter(Boolean);
  out.row(sec, 'Flags', flags.join(', ') || 'none');
  let p = 10;
  if (flg & 4) {
    const xlen = u16(h, p, true);
    const ids: string[] = [];
    for (let q = p + 2; q + 4 <= p + 2 + xlen; ) {
      ids.push(latin1(h, q, q + 2).replace(/[^\x20-\x7e]/g, '?'));
      q += 4 + u16(h, q + 2, true);
    }
    out.row(sec, 'Extra subfields', ids.join(', '));
    p += 2 + xlen;
  }
  if (flg & 8) {
    let e = p;
    while (e < h.length && h[e] !== 0) e++;
    const name = utf8Strict(h.subarray(p, e)) ?? latin1(h, p, e);
    out.row(sec, 'Original file name', name);
    out.find('filename', 'Original file name stored in the GZIP header', name);
    p = e + 1;
  }
  if (flg & 16) {
    let e = p;
    while (e < h.length && h[e] !== 0) e++;
    const cm = latin1(h, p, e);
    out.row(sec, 'Comment', cm);
    out.find('comments', 'GZIP comment', cm);
    p = e + 1;
  }
  if (mtime) out.find('other', 'Original modification time stored in the GZIP header', isoFromUnix(mtime) ?? String(mtime));
  const tail = await rd.read(Math.max(0, size - 8), 8);
  if (tail.length === 8) {
    out.row(sec, 'CRC-32 of data', u32(tail, 0, true).toString(16).padStart(8, '0'));
    out.row(sec, 'Uncompressed size (mod 2³²)', `${u32(tail, 4, true).toLocaleString('en-US')} bytes`);
  }
  out.row(sec, 'Compressed size', fmtBytes(size));
  await out.attempt('GZIP payload type', async () => {
    const head = await rd.read(0, 65536);
    const r = inflateLimited(head, 'gzip', 4096);
    if (r.out.length < 16) return;
    const det = detectBinaryType(r.out);
    const looksTar = bytesEq(r.out, 257, asciiBytes('ustar'));
    if (looksTar) {
      out.row(sec, 'Payload', 'TAR archive (.tar.gz / .tgz)');
      const name = latin1(r.out, 0, 100).replace(/\u0000[\s\S]*$/, '');
      out.row(sec, 'First tar entry', name);
    } else if (det) out.row(sec, 'Payload', det.name);
    else {
      const probe = r.out.subarray(0, 1024);
      if (probe.every((x) => x === 9 || x === 10 || x === 13 || (x >= 32 && x < 127) || x >= 0x80)) out.row(sec, 'Payload', 'looks like text');
    }
  });
}

// ---------------------------------------------------------------------------
// TAR
// ---------------------------------------------------------------------------

function tarOct(b: Uint8Array, o: number, n: number): number {
  if ((b[o] ?? 0) & 0x80) {
    let v = (b[o] ?? 0) & 0x7f;
    for (let i = 1; i < n; i++) v = v * 256 + (b[o + i] ?? 0);
    return v;
  }
  const s = latin1(b, o, o + n).replace(/[\u0000 ]+$/g, '').trim();
  const v = parseInt(s || '0', 8);
  return Number.isFinite(v) ? v : 0;
}

function tarStr(b: Uint8Array, o: number, n: number): string {
  let e = o;
  while (e < o + n && b[e] !== 0) e++;
  return utf8Strict(b.subarray(o, e)) ?? latin1(b, o, e);
}

export async function parseTar(c: Ctx): Promise<void> {
  const { rd, size, out } = c;
  const sec = out.section('tar', 'TAR archive');
  let off = 0;
  let count = 0;
  let files = 0;
  let dirs = 0;
  let links = 0;
  let total = 0;
  let minM = Infinity;
  let maxM = 0;
  const owners = new Map<string, number>();
  const uids = new Set<string>();
  const entries: string[] = [];
  let longName = '';
  let paxPath = '';
  let format = '';
  const abs: string[] = [];
  let guard = 0;
  const started = Date.now();
  let truncated = false;
  while (off + 512 <= size && guard++ < 500000) {
    if (Date.now() - started > 4000) {
      truncated = true;
      break;
    }
    const h = await rd.peek(off, 512);
    if (h.length < 512) break;
    if (h.every((x) => x === 0)) break;
    const type = String.fromCharCode(u8(h, 156) || 48);
    const fsize = tarOct(h, 124, 12);
    const magic = latin1(h, 257, 263);
    if (!format) format = magic.startsWith('ustar  ') ? 'GNU tar' : magic.startsWith('ustar') ? 'POSIX ustar' : 'old V7 tar';
    let name = tarStr(h, 0, 100);
    const prefix = magic.startsWith('ustar') && !magic.startsWith('ustar  ') ? tarStr(h, 345, 155) : '';
    if (prefix) name = `${prefix}/${name}`;
    const dataBlocks = Math.ceil(fsize / 512) * 512;
    if (type === 'L' || type === 'K') {
      const d = await rd.read(off + 512, Math.min(fsize, 8192));
      if (type === 'L') longName = tarStr(d, 0, d.length);
      off += 512 + dataBlocks;
      continue;
    }
    if (type === 'x' || type === 'g') {
      const d = await rd.read(off + 512, Math.min(fsize, 65536));
      const txt = utf8(d);
      for (const m of txt.matchAll(/\d+ (\w+(?:\.\w+)*)=([^\n]*)\n/g)) {
        const k = m[1] ?? '';
        const v = m[2] ?? '';
        if (k === 'path' && type === 'x') paxPath = v;
        else if (k === 'uname' || k === 'gname') owners.set(`${k}:${v}`, (owners.get(`${k}:${v}`) ?? 0) + 1);
      }
      format = 'POSIX pax';
      off += 512 + dataBlocks;
      continue;
    }
    if (longName) {
      name = longName;
      longName = '';
    }
    if (paxPath) {
      name = paxPath;
      paxPath = '';
    }
    count++;
    const mtime = tarOct(h, 136, 12);
    if (mtime) {
      minM = Math.min(minM, mtime);
      maxM = Math.max(maxM, mtime);
    }
    if (type === '5') dirs++;
    else if (type === '1' || type === '2') links++;
    else {
      files++;
      total += fsize;
    }
    if (magic.startsWith('ustar')) {
      const un = tarStr(h, 265, 32);
      const gn = tarStr(h, 297, 32);
      if (un) owners.set(`user:${un}`, (owners.get(`user:${un}`) ?? 0) + 1);
      if (gn) owners.set(`group:${gn}`, (owners.get(`group:${gn}`) ?? 0) + 1);
    }
    uids.add(`${tarOct(h, 108, 8)}:${tarOct(h, 116, 8)}`);
    if (entries.length < 40) entries.push(`${name}\t${type === '5' ? 'folder' : `${fsize.toLocaleString('en-US')} bytes`}${mtime ? `  ·  ${isoFromUnix(mtime) ?? ''}` : ''}`);
    if (abs.length < 3 && (name.startsWith('/') || name.includes('../') || /^[A-Za-z]:[\\/]/.test(name) || /(^|\/)(Users|home)\/[^/]+\//.test(name))) abs.push(name);
    off += 512 + dataBlocks;
  }
  out.row(sec, 'Format', format || 'tar');
  out.row(sec, 'Entries', `${count.toLocaleString('en-US')}${truncated ? '+' : ''} (${files.toLocaleString('en-US')} files, ${dirs} folders${links ? `, ${links} links` : ''})`);
  out.row(sec, 'Total file data', `${total.toLocaleString('en-US')} bytes (${fmtBytes(total)})`);
  if (minM !== Infinity) {
    out.row(sec, 'Oldest entry', isoFromUnix(minM) ?? undefined);
    out.row(sec, 'Newest entry', isoFromUnix(maxM) ?? undefined);
  }
  const users = Array.from(owners.keys()).filter((k) => k.startsWith('user:') || k.startsWith('uname:')).map((k) => k.slice(k.indexOf(':') + 1));
  const groups = Array.from(owners.keys()).filter((k) => k.startsWith('group:') || k.startsWith('gname:')).map((k) => k.slice(k.indexOf(':') + 1));
  if (users.length) {
    out.row(sec, 'Owner user names', users.slice(0, 10).join(', '));
    out.find('person', 'User names stored in the TAR entries', users.slice(0, 10).join(', '));
  }
  if (groups.length) out.row(sec, 'Owner group names', groups.slice(0, 10).join(', '));
  if (uids.size) out.row(sec, 'Numeric uid:gid pairs', Array.from(uids).slice(0, 8).join(', '));
  if (abs.length) out.find('filename', 'Entry names contain user/absolute paths', abs.join(', '));
  if (truncated) out.note('The TAR walk stopped after a few seconds; totals cover only the part scanned.');
  const list = out.section('tar-entries', 'Archive contents');
  for (const e of entries) {
    const [n, rest] = e.split('\t');
    out.row(list, n ?? '', rest ?? '');
  }
  if (count > entries.length) list.note = `Showing the first ${entries.length} of ${count.toLocaleString('en-US')} entries.`;
}

// ---------------------------------------------------------------------------
// 7z / RAR (header-level only)
// ---------------------------------------------------------------------------

export async function parse7z(c: Ctx): Promise<void> {
  const { rd, size, out } = c;
  const h = await readExact(rd, 0, 32);
  const sec = out.section('7z', '7-Zip archive');
  out.row(sec, 'Format version', `${u8(h, 6)}.${u8(h, 7)}`);
  const nextOff = u64(h, 12, true);
  const nextSize = u64(h, 20, true);
  out.row(sec, 'Header database', `${nextSize.toLocaleString('en-US')} bytes at offset ${(32 + nextOff).toLocaleString('en-US')}`);
  out.row(sec, 'Packed streams', fmtBytes(Math.max(0, nextOff)));
  if (nextSize > 0 && 32 + nextOff + nextSize <= size) {
    const hd = await rd.read(32 + nextOff, 1);
    out.row(sec, 'Header type', u8(hd, 0) === 0x17 ? 'compressed (encoded) header' : u8(hd, 0) === 0x01 ? 'plain header (file names visible)' : `0x${u8(hd, 0).toString(16)}`);
  }
  out.note('7-Zip file names and dates live in an LZMA-compressed header, which is not decoded here.');
}

export async function parseRar(c: Ctx): Promise<void> {
  const { rd, out } = c;
  const h = await rd.read(0, 64);
  const sec = out.section('rar', 'RAR archive');
  const v5 = u8(h, 6) === 1;
  out.row(sec, 'Format', v5 ? 'RAR 5.0+' : 'RAR 1.5–4.x');
  if (!v5) {
    const flags = u16(h, 10, true);
    const names = [flags & 1 ? 'volume' : '', flags & 2 ? 'archive comment' : '', flags & 4 ? 'locked' : '', flags & 8 ? 'solid' : '', flags & 0x20 ? 'authenticity verification' : '', flags & 0x40 ? 'recovery record' : '', flags & 0x80 ? 'encrypted headers' : '', flags & 0x100 ? 'first volume' : ''].filter(Boolean);
    out.row(sec, 'Archive flags', names.join(', ') || 'none');
    if (flags & 2) out.find('comments', 'RAR archive comment', 'The archive carries a comment block.');
  } else {
    let p = 8 + 4;
    const vint = (): number => {
      let v = 0;
      let mul = 1;
      for (let i = 0; i < 9; i++) {
        const b = u8(h, p++);
        v += (b & 0x7f) * mul;
        mul *= 128;
        if (!(b & 0x80)) break;
      }
      return v;
    };
    vint();
    const type = vint();
    const hflags = vint();
    if (type === 1) {
      if (hflags & 1) vint();
      if (hflags & 2) vint();
      const aflags = vint();
      out.row(sec, 'Archive flags', [aflags & 1 ? 'volume' : '', aflags & 4 ? 'solid' : '', aflags & 8 ? 'recovery record' : '', aflags & 16 ? 'locked' : ''].filter(Boolean).join(', ') || 'none');
    }
  }
  out.note('RAR file names and dates are not decoded; only the archive header is shown.');
}

// ---------------------------------------------------------------------------
// ELF
// ---------------------------------------------------------------------------

const ELF_MACHINE: Record<number, string> = {
  0: 'none', 2: 'SPARC', 3: 'x86 (i386)', 4: 'Motorola 68000', 8: 'MIPS', 20: 'PowerPC', 21: 'PowerPC 64-bit', 22: 'IBM S/390', 40: 'ARM', 42: 'SuperH', 43: 'SPARC v9',
  50: 'Intel IA-64', 62: 'x86-64 (AMD64)', 83: 'AVR', 94: 'Xtensa', 105: 'MSP430', 183: 'AArch64 (ARM64)', 243: 'RISC-V', 247: 'eBPF', 258: 'LoongArch',
};
const ELF_OSABI: Record<number, string> = { 0: 'UNIX System V', 1: 'HP-UX', 2: 'NetBSD', 3: 'Linux (GNU)', 6: 'Solaris', 9: 'FreeBSD', 12: 'OpenBSD', 97: 'ARM EABI', 255: 'standalone' };
const ELF_TYPE: Record<number, string> = { 0: 'none', 1: 'relocatable object', 2: 'executable', 3: 'shared object / PIE executable', 4: 'core dump' };

export async function parseElf(c: Ctx): Promise<void> {
  const { rd, size, out } = c;
  const h = await readExact(rd, 0, 64);
  const is64 = u8(h, 4) === 2;
  const le = u8(h, 5) !== 2;
  const rd16 = (o: number) => u16(h, o, le);
  const rd32 = (o: number) => u32(h, o, le);
  const rdA = (o: number) => (is64 ? u64(h, o, le) : u32(h, o, le));
  const sec = out.section('elf', 'ELF header');
  out.row(sec, 'Class', is64 ? '64-bit' : '32-bit');
  out.row(sec, 'Byte order', le ? 'little-endian' : 'big-endian');
  out.row(sec, 'OS / ABI', `${ELF_OSABI[u8(h, 7)] ?? u8(h, 7)}${u8(h, 8) ? ` (ABI version ${u8(h, 8)})` : ''}`);
  const type = rd16(16);
  out.row(sec, 'Type', ELF_TYPE[type] ?? String(type));
  const machine = rd16(18);
  out.row(sec, 'Machine', ELF_MACHINE[machine] ?? `0x${machine.toString(16)}`);
  out.row(sec, 'Entry point', `0x${rdA(24).toString(16)}`);
  const phoff = rdA(is64 ? 32 : 28);
  const shoff = rdA(is64 ? 40 : 32);
  const phentsize = rd16(is64 ? 54 : 42);
  const phnum = rd16(is64 ? 56 : 44);
  const shentsize = rd16(is64 ? 58 : 46);
  const shnum = rd16(is64 ? 60 : 48);
  const shstrndx = rd16(is64 ? 62 : 50);
  out.row(sec, 'Program headers', String(phnum));
  out.row(sec, 'Section headers', String(shnum));
  void rd32;

  // program headers: interpreter
  if (phnum > 0 && phnum < 200 && phoff > 0) {
    const ph = await rd.read(phoff, phnum * phentsize);
    for (let i = 0; i < phnum; i++) {
      const o = i * phentsize;
      const ptype = u32(ph, o, le);
      if (ptype === 3) {
        const poff = is64 ? u64(ph, o + 8, le) : u32(ph, o + 4, le);
        const psz = is64 ? u64(ph, o + 32, le) : u32(ph, o + 16, le);
        const s = await rd.read(poff, Math.min(psz, 256));
        out.row(sec, 'Dynamic linker (PT_INTERP)', latin1(s).replace(/\u0000[\s\S]*$/, ''));
      }
    }
  }
  // sections
  if (shnum > 0 && shnum < 4000 && shoff > 0 && shoff + shnum * shentsize <= size) {
    const sh = await rd.read(shoff, shnum * shentsize);
    interface Sh { name: number; type: number; off: number; size: number; link: number; nameStr: string }
    const secs: Sh[] = [];
    for (let i = 0; i < shnum; i++) {
      const o = i * shentsize;
      secs.push({
        name: u32(sh, o, le),
        type: u32(sh, o + 4, le),
        off: is64 ? u64(sh, o + 24, le) : u32(sh, o + 16, le),
        size: is64 ? u64(sh, o + 32, le) : u32(sh, o + 20, le),
        link: u32(sh, o + (is64 ? 40 : 24), le),
        nameStr: '',
      });
    }
    const strSec = secs[shstrndx];
    if (strSec && strSec.size < 4 * 1024 * 1024) {
      const strs = await rd.read(strSec.off, strSec.size);
      for (const s of secs) {
        let e = s.name;
        while (e < strs.length && strs[e] !== 0) e++;
        s.nameStr = latin1(strs, s.name, e);
      }
    }
    const names = secs.map((s) => s.nameStr).filter(Boolean);
    const hasSym = names.includes('.symtab');
    const hasDebug = names.some((n) => n.startsWith('.debug_') || n === '.zdebug_info');
    out.row(sec, 'Symbols', hasSym ? 'symbol table present (not stripped)' : 'stripped (no .symtab)');
    out.row(sec, 'Debug info', hasDebug ? 'DWARF sections present (may embed source paths)' : 'none');
    if (hasDebug) out.find('filename', 'Debug information', 'DWARF debug sections can embed absolute source paths and the build machine layout.');
    const bySec = (n: string) => secs.find((s) => s.nameStr === n);
    const comment = bySec('.comment');
    if (comment && comment.size > 0 && comment.size < 65536) {
      const b = await rd.read(comment.off, comment.size);
      const items = Array.from(new Set(latin1(b).split('\u0000').map((x) => x.trim()).filter(Boolean)));
      out.row(sec, 'Compiler / toolchain (.comment)', items.join(' · '));
      for (const it of items.slice(0, 4)) out.find('software', 'Compiler (.comment section)', it);
    }
    const note = bySec('.note.gnu.build-id');
    if (note && note.size >= 16 && note.size < 256) {
      const b = await rd.read(note.off, note.size);
      const namesz = u32(b, 0, le);
      const descsz = u32(b, 4, le);
      const desc = b.subarray(12 + Math.ceil(namesz / 4) * 4, 12 + Math.ceil(namesz / 4) * 4 + descsz);
      out.row(sec, 'GNU build ID', toHex(desc));
    }
    const dbgl = bySec('.gnu_debuglink');
    if (dbgl && dbgl.size < 512) {
      const b = await rd.read(dbgl.off, dbgl.size);
      out.row(sec, 'Debug link file', latin1(b).replace(/\u0000[\s\S]*$/, ''));
    }
    const dyn = bySec('.dynamic');
    const dynstrSec = dyn ? secs[dyn.link] : undefined;
    if (dyn && dynstrSec && dyn.size < 65536 && dynstrSec.size < 4 * 1024 * 1024) {
      const d = await rd.read(dyn.off, dyn.size);
      const str = await rd.read(dynstrSec.off, dynstrSec.size);
      const entSize = is64 ? 16 : 8;
      const strAt = (o: number) => {
        let e = o;
        while (e < str.length && str[e] !== 0) e++;
        return latin1(str, o, e);
      };
      const needed: string[] = [];
      let soname = '';
      let rpath = '';
      let runpath = '';
      for (let i = 0; i + entSize <= d.length; i += entSize) {
        const tag = is64 ? u64(d, i, le) : u32(d, i, le);
        const val = is64 ? u64(d, i + 8, le) : u32(d, i + 4, le);
        if (tag === 0) break;
        if (tag === 1) needed.push(strAt(val));
        else if (tag === 14) soname = strAt(val);
        else if (tag === 15) rpath = strAt(val);
        else if (tag === 29) runpath = strAt(val);
      }
      out.row(sec, 'Shared library name (SONAME)', soname);
      out.row(sec, 'Needed libraries', needed.join(', '));
      out.row(sec, 'RPATH', rpath);
      out.row(sec, 'RUNPATH', runpath);
      if (rpath || runpath) out.find('filename', 'Library search path (RPATH / RUNPATH)', rpath || runpath);
    }
    const ss = out.section('elf-sections', 'ELF sections', { collapsed: true });
    names.slice(0, 80).forEach((n, i) => out.row(ss, String(i + 1), n));
  }
}

// ---------------------------------------------------------------------------
// PE (Windows executables)
// ---------------------------------------------------------------------------

const PE_MACHINE: Record<number, string> = { 0x14c: 'x86 (i386)', 0x8664: 'x64 (AMD64)', 0x1c0: 'ARM', 0x1c4: 'ARM Thumb-2', 0xaa64: 'ARM64', 0x200: 'Intel IA-64', 0x5064: 'RISC-V 64', 0xebc: 'EFI byte code' };
const PE_SUBSYSTEM: Record<number, string> = { 0: 'unknown', 1: 'native', 2: 'Windows GUI', 3: 'Windows console', 5: 'OS/2 console', 7: 'POSIX console', 9: 'Windows CE GUI', 10: 'EFI application', 11: 'EFI boot service driver', 12: 'EFI runtime driver', 14: 'Xbox', 16: 'Windows boot application' };
const DEBUG_TYPES: Record<number, string> = { 1: 'COFF', 2: 'CodeView', 3: 'FPO', 4: 'MISC', 9: 'Borland', 10: 'Reserved', 11: 'CLSID', 12: 'VC feature', 13: 'POGO', 14: 'ILTCG', 16: 'Reproducible build', 17: 'Embedded PDB', 19: 'SPGO', 20: 'PDB checksum', 21: 'Extended DLL characteristics' };

function derCommonNames(der: Uint8Array): { cn: string[]; org: string[] } {
  const cn: string[] = [];
  const org: string[] = [];
  const take = (oid: number, into: string[]) => {
    for (let i = 0; i + 8 < der.length; i++) {
      if (der[i] === 0x06 && der[i + 1] === 0x03 && der[i + 2] === 0x55 && der[i + 3] === 0x04 && der[i + 4] === oid) {
        const tag = der[i + 5] ?? 0;
        const len = der[i + 6] ?? 0;
        if ((tag === 0x0c || tag === 0x13 || tag === 0x16 || tag === 0x14) && len > 0 && len < 128) {
          const s = utf8(der.subarray(i + 7, i + 7 + len));
          if (!into.includes(s)) into.push(s);
        }
      }
    }
  };
  take(0x03, cn);
  take(0x0a, org);
  return { cn, org };
}

export async function parsePe(c: Ctx): Promise<void> {
  const { rd, out } = c;
  const dos = await readExact(rd, 0, 64);
  const peOff = u32(dos, 0x3c, true);
  const hd = await readExact(rd, peOff, 24 + 240);
  if (latin1(hd, 0, 4) !== 'PE\u0000\u0000') throw new Error('PE signature not found');
  const machine = u16(hd, 4, true);
  const nSec = u16(hd, 6, true);
  const ts = u32(hd, 8, true);
  const optSize = u16(hd, 20, true);
  const chars = u16(hd, 22, true);
  const opt = 24;
  const magic = u16(hd, opt, true);
  const plus = magic === 0x20b;
  const sec = out.section('pe', 'PE header');
  out.row(sec, 'Format', plus ? 'PE32+ (64-bit)' : magic === 0x10b ? 'PE32 (32-bit)' : `unknown optional header 0x${magic.toString(16)}`);
  out.row(sec, 'Machine', PE_MACHINE[machine] ?? `0x${machine.toString(16)}`);
  const kind = [chars & 0x2000 ? 'DLL' : chars & 0x2 ? 'executable' : 'object', chars & 0x1 ? 'relocations stripped' : '', chars & 0x20 ? 'large-address aware' : '', chars & 0x100 ? '32-bit word machine' : ''].filter(Boolean);
  out.row(sec, 'Characteristics', kind.join(', '));
  const stamp = isoFromUnix(ts);
  out.row(sec, 'Link timestamp (TimeDateStamp)', ts ? `${stamp ?? ts}${ts > 4102444800 || ts < 631152000 ? ' (not a real date: likely a reproducible-build hash)' : ''}` : '0 (not set)');
  if (ts && stamp && ts > 631152000 && ts < 4102444800) out.find('other', 'Build / link timestamp', stamp);
  out.row(sec, 'Sections', String(nSec));
  out.row(sec, 'Linker version', `${u8(hd, opt + 2)}.${u8(hd, opt + 3)}`);
  out.row(sec, 'Entry point (RVA)', `0x${u32(hd, opt + 16, true).toString(16)}`);
  out.row(sec, 'Image base', `0x${(plus ? u64(hd, opt + 24, true) : u32(hd, opt + 28, true)).toString(16)}`);
  out.row(sec, 'OS version required', `${u16(hd, opt + 40, true)}.${u16(hd, opt + 42, true)}`);
  out.row(sec, 'Subsystem', PE_SUBSYSTEM[u16(hd, opt + 68, true)] ?? String(u16(hd, opt + 68, true)));
  const dllc = u16(hd, opt + 70, true);
  out.row(sec, 'DLL characteristics', [dllc & 0x40 ? 'ASLR' : '', dllc & 0x100 ? 'DEP (NX)' : '', dllc & 0x20 ? 'high-entropy ASLR' : '', dllc & 0x4000 ? 'Control Flow Guard' : '', dllc & 0x400 ? 'no SEH' : ''].filter(Boolean).join(', ') || 'none');
  const ddBase = opt + (plus ? 112 : 96);
  const dd = (i: number) => ({ rva: u32(hd, ddBase + i * 8, true), size: u32(hd, ddBase + i * 8 + 4, true) });
  // sections
  const st = await rd.read(peOff + 24 + optSize, nSec * 40);
  interface Sc { name: string; va: number; vsize: number; raw: number; rawSize: number }
  const scs: Sc[] = [];
  for (let i = 0; i < nSec && i < 96; i++) {
    const o = i * 40;
    scs.push({ name: latin1(st, o, o + 8).replace(/\u0000[\s\S]*$/, ''), vsize: u32(st, o + 8, true), va: u32(st, o + 12, true), rawSize: u32(st, o + 16, true), raw: u32(st, o + 20, true) });
  }
  const rva2off = (rva: number): number => {
    for (const s of scs) if (rva >= s.va && rva < s.va + Math.max(s.vsize, s.rawSize)) return rva - s.va + s.raw;
    return -1;
  };
  out.row(sec, 'Section names', scs.map((s) => s.name).join(', '));
  const dotnet = dd(14);
  if (dotnet.rva) {
    await out.attempt('.NET header', async () => {
      const o = rva2off(dotnet.rva);
      const clr = await rd.read(o, 72);
      out.row(sec, '.NET assembly', `managed code (CLR ${u16(clr, 4, true)}.${u16(clr, 6, true)})`);
      const mdo = rva2off(u32(clr, 8, true));
      if (mdo >= 0) {
        const md = await rd.read(mdo, 64);
        if (u32(md, 0, true) === 0x424a5342) out.row(sec, '.NET runtime version string', latin1(md, 16, 16 + Math.min(u32(md, 12, true), 40)).replace(/\u0000[\s\S]*$/, ''));
      }
      const fl = u32(clr, 16, true);
      out.row(sec, '.NET flags', [fl & 1 ? 'IL only' : '', fl & 2 ? '32-bit required' : '', fl & 8 ? 'strong-name signed' : ''].filter(Boolean).join(', '));
    });
  }
  const exp = dd(0);
  if (exp.rva) {
    await out.attempt('export table', async () => {
      const o = rva2off(exp.rva);
      const e = await rd.read(o, 40);
      const nameOff = rva2off(u32(e, 12, true));
      if (nameOff >= 0) out.row(sec, 'Export DLL name', latin1(await rd.read(nameOff, 128)).replace(/\u0000[\s\S]*$/, ''));
      out.row(sec, 'Exported functions', `${u32(e, 20, true)} (${u32(e, 24, true)} named)`);
    });
  }
  // debug directory
  const dbg = dd(6);
  if (dbg.rva && dbg.size) {
    await out.attempt('debug directory', async () => {
      const o = rva2off(dbg.rva);
      if (o < 0) return;
      const d = await rd.read(o, Math.min(dbg.size, 28 * 16));
      const types: string[] = [];
      for (let i = 0; i + 28 <= d.length; i += 28) {
        const t = u32(d, i + 12, true);
        types.push(DEBUG_TYPES[t] ?? String(t));
        if (t === 2) {
          const raw = u32(d, i + 24, true);
          const cv = await rd.read(raw, 24 + 520);
          if (latin1(cv, 0, 4) === 'RSDS') {
            const g = cv.subarray(4, 20);
            const guid = `${u32(g, 0, true).toString(16).padStart(8, '0')}-${u16(g, 4, true).toString(16).padStart(4, '0')}-${u16(g, 6, true).toString(16).padStart(4, '0')}-${toHex(g.subarray(8, 10))}-${toHex(g.subarray(10, 16))}`;
            let e = 24;
            while (e < cv.length && cv[e] !== 0) e++;
            const pdb = utf8(cv.subarray(24, e));
            out.row(sec, 'PDB path (CodeView)', pdb);
            out.row(sec, 'PDB GUID / age', `${guid} / ${u32(cv, 20, true)}`);
            c.out.find('filename', 'Debug-symbol (PDB) path on the build machine', pdb);
          }
        }
      }
      out.row(sec, 'Debug directory entries', types.join(', '));
    });
  }
  // Authenticode
  const cert = dd(4);
  if (cert.rva && cert.size) {
    await out.attempt('Authenticode signature', async () => {
      const data = await rd.read(cert.rva, Math.min(cert.size, 256 * 1024));
      const names = derCommonNames(data);
      out.row(sec, 'Digital signature (Authenticode)', `present (${cert.size.toLocaleString('en-US')} bytes; validity is NOT verified here)`);
      if (names.cn.length) out.row(sec, 'Certificate common names', names.cn.slice(0, 8).join(' · '));
      if (names.org.length) out.row(sec, 'Certificate organisations', names.org.slice(0, 8).join(' · '));
      if (names.org[0] || names.cn[0]) out.find('company', 'Code-signing identity (from certificate)', (names.org[0] ?? names.cn[0]) as string);
    });
  } else out.row(sec, 'Digital signature (Authenticode)', 'none');
  // version resource
  const res = dd(2);
  if (res.rva && res.size) {
    await out.attempt('version resource', async () => {
      const base = rva2off(res.rva);
      if (base < 0) return;
      const buf = await rd.read(base, Math.min(res.size, 8 * 1024 * 1024));
      const dirEntries = (o: number): Array<{ id: number; named: boolean; off: number; isDir: boolean }> => {
        const n = u16(buf, o + 12, true) + u16(buf, o + 14, true);
        const outE: Array<{ id: number; named: boolean; off: number; isDir: boolean }> = [];
        for (let i = 0; i < n && i < 512; i++) {
          const nm = u32(buf, o + 16 + i * 8, true);
          const dv = u32(buf, o + 20 + i * 8, true);
          outE.push({ id: nm & 0x7fffffff, named: (nm & 0x80000000) !== 0, off: dv & 0x7fffffff, isDir: (dv & 0x80000000) !== 0 });
        }
        return outE;
      };
      const root = dirEntries(0);
      const ver = root.find((e) => !e.named && e.id === 16 && e.isDir);
      if (!ver) return;
      const l2 = dirEntries(ver.off);
      const first = l2[0];
      if (!first || !first.isDir) return;
      const l3 = dirEntries(first.off);
      const leaf = l3[0];
      if (!leaf || leaf.isDir) return;
      const dataRva = u32(buf, leaf.off, true);
      const dataSize = u32(buf, leaf.off + 4, true);
      const o = rva2off(dataRva);
      if (o < 0 || dataSize > 1024 * 1024) return;
      const v = await rd.read(o, dataSize);
      const vsec = out.section('pe-version', 'Version information (resource)');
      const readBlock = (p: number) => {
        const len = u16(v, p, true);
        const vlen = u16(v, p + 2, true);
        const type = u16(v, p + 4, true);
        let q = p + 6;
        let e = q;
        while (e + 1 < v.length && !(v[e] === 0 && v[e + 1] === 0)) e += 2;
        const key = utf16(v, true, q, e);
        q = (e + 2 + 3) & ~3;
        return { len, vlen, type, key, valueOff: q, end: p + len, childStart: (q + (type === 1 ? vlen * 2 : vlen) + 3) & ~3 };
      };
      const top = readBlock(0);
      if (top.vlen >= 52 && u32(v, top.valueOff, true) === 0xfeef04bd) {
        const ms = u32(v, top.valueOff + 8, true);
        const ls = u32(v, top.valueOff + 12, true);
        out.row(vsec, 'Fixed file version', `${ms >>> 16}.${ms & 0xffff}.${ls >>> 16}.${ls & 0xffff}`);
        const pms = u32(v, top.valueOff + 16, true);
        const pls = u32(v, top.valueOff + 20, true);
        out.row(vsec, 'Fixed product version', `${pms >>> 16}.${pms & 0xffff}.${pls >>> 16}.${pls & 0xffff}`);
        const ff = u32(v, top.valueOff + 28, true) & u32(v, top.valueOff + 24, true);
        out.row(vsec, 'File flags', [ff & 1 ? 'debug build' : '', ff & 2 ? 'prerelease' : '', ff & 4 ? 'patched' : '', ff & 8 ? 'private build' : '', ff & 32 ? 'special build' : ''].filter(Boolean).join(', ') || undefined);
      }
      const strings: Record<string, string> = {};
      let p = top.childStart;
      while (p + 6 < top.end && p < v.length) {
        const b = readBlock(p);
        if (b.len === 0) break;
        if (b.key === 'StringFileInfo') {
          let t = b.childStart;
          while (t + 6 < b.end) {
            const tb = readBlock(t);
            if (tb.len === 0) break;
            let s = tb.childStart;
            while (s + 6 < tb.end) {
              const sb = readBlock(s);
              if (sb.len === 0) break;
              const val = utf16(v, true, sb.valueOff, sb.valueOff + sb.vlen * 2).replace(/\u0000+$/, '');
              if (sb.key && val && !(sb.key in strings)) strings[sb.key] = val;
              s += (sb.len + 3) & ~3;
            }
            t += (tb.len + 3) & ~3;
          }
        }
        p += (b.len + 3) & ~3;
      }
      const order = ['CompanyName', 'FileDescription', 'FileVersion', 'ProductName', 'ProductVersion', 'InternalName', 'OriginalFilename', 'LegalCopyright', 'LegalTrademarks', 'Comments', 'PrivateBuild', 'SpecialBuild'];
      for (const k of order) if (strings[k]) out.row(vsec, k, strings[k]);
      for (const [k, val] of Object.entries(strings)) if (!order.includes(k)) out.row(vsec, k, val);
      if (strings['CompanyName']) out.find('company', 'Company (version resource)', strings['CompanyName']);
      if (strings['OriginalFilename']) out.find('filename', 'Original file name (version resource)', strings['OriginalFilename']);
      if (strings['Comments']) out.find('comments', 'Comments (version resource)', strings['Comments']);
    });
  }
}

// ---------------------------------------------------------------------------
// Mach-O
// ---------------------------------------------------------------------------

const MACHO_CPU: Record<number, string> = { 7: 'x86', 0x01000007: 'x86_64', 12: 'ARM', 0x0100000c: 'ARM64', 0x0200000c: 'ARM64_32', 18: 'PowerPC', 0x01000012: 'PowerPC64' };
const MACHO_FILETYPE: Record<number, string> = { 1: 'object file', 2: 'executable', 3: 'fixed VM library', 4: 'core dump', 5: 'preloaded executable', 6: 'dynamic library', 7: 'dynamic linker', 8: 'bundle', 9: 'dylib stub', 10: 'debug symbols (dSYM)', 11: 'kernel extension' };
const MACHO_PLATFORM: Record<number, string> = { 1: 'macOS', 2: 'iOS', 3: 'tvOS', 4: 'watchOS', 5: 'bridgeOS', 6: 'Mac Catalyst', 7: 'iOS Simulator', 8: 'tvOS Simulator', 9: 'watchOS Simulator', 10: 'DriverKit', 11: 'visionOS', 12: 'visionOS Simulator' };

function ver32(v: number): string {
  return `${v >>> 16}.${(v >>> 8) & 255}.${v & 255}`;
}

async function parseThinMachO(c: Ctx, base: number, sec: import('./types').Section): Promise<void> {
  const { rd, out } = c;
  const h = await readExact(rd, base, 32);
  const magic = u32(h, 0);
  const le = magic === 0xcefaedfe || magic === 0xcffaedfe;
  const is64 = magic === 0xfeedfacf || magic === 0xcffaedfe;
  const r32 = (o: number) => u32(h, o, le);
  const cpu = r32(4);
  out.row(sec, 'CPU', MACHO_CPU[cpu] ?? `0x${cpu.toString(16)}`);
  out.row(sec, 'Bits', is64 ? '64-bit' : '32-bit');
  out.row(sec, 'File type', MACHO_FILETYPE[r32(12)] ?? String(r32(12)));
  const ncmds = r32(16);
  const sizeofcmds = r32(20);
  const flags = r32(24);
  out.row(sec, 'Flags', [flags & 4 ? 'dyld-linked' : '', flags & 0x80 ? 'two-level namespace' : '', flags & 0x200000 ? 'PIE' : '', flags & 0x20000 ? 'allows stack execution' : '', flags & 0x1000000 ? 'no heap execution' : '', flags & 0x2000000 ? 'app-extension safe' : ''].filter(Boolean).join(', '));
  if (ncmds > 4000 || sizeofcmds > 8 * 1024 * 1024) return;
  const cmds = await rd.read(base + (is64 ? 32 : 28), sizeofcmds);
  let p = 0;
  const libs: string[] = [];
  const rpaths: string[] = [];
  const segs: string[] = [];
  let sigOff = 0;
  let sigSize = 0;
  for (let i = 0; i < ncmds && p + 8 <= cmds.length; i++) {
    const cmd = u32(cmds, p, le);
    const sz = u32(cmds, p + 4, le);
    if (sz < 8) break;
    const str = (o: number) => {
      let e = p + o;
      while (e < p + sz && cmds[e] !== 0) e++;
      return latin1(cmds, p + o, e);
    };
    switch (cmd) {
      case 0x1b:
        out.row(sec, 'UUID', toHex(cmds.subarray(p + 8, p + 24)));
        break;
      case 0x32: {
        const platform = u32(cmds, p + 8, le);
        out.row(sec, 'Target platform', `${MACHO_PLATFORM[platform] ?? platform} (min OS ${ver32(u32(cmds, p + 12, le))}, SDK ${ver32(u32(cmds, p + 16, le))})`);
        break;
      }
      case 0x24:
      case 0x25:
      case 0x2f:
      case 0x30:
        out.row(sec, 'Minimum OS version', `${{ 0x24: 'macOS', 0x25: 'iOS', 0x2f: 'tvOS', 0x30: 'watchOS' }[cmd]} ${ver32(u32(cmds, p + 8, le))} (SDK ${ver32(u32(cmds, p + 12, le))})`);
        break;
      case 0x2a: {
        const v = u64(cmds, p + 8, le);
        out.row(sec, 'Source version', `${Math.floor(v / 2 ** 40)}.${Math.floor(v / 2 ** 30) & 1023}.${Math.floor(v / 2 ** 20) & 1023}.${Math.floor(v / 2 ** 10) & 1023}.${v % 1024}`);
        break;
      }
      case 0xd:
        out.row(sec, 'Install name (dylib ID)', str(u32(cmds, p + 8, le)));
        break;
      case 0xc:
      case 0x80000018:
      case 0x8000001f:
      case 0x1f:
        libs.push(str(u32(cmds, p + 8, le)));
        break;
      case 0x8000001c:
        rpaths.push(str(u32(cmds, p + 8, le)));
        break;
      case 0x1d:
        sigOff = u32(cmds, p + 8, le);
        sigSize = u32(cmds, p + 12, le);
        break;
      case 0x21:
      case 0x2c:
        out.row(sec, 'Encrypted (App Store FairPlay)', u32(cmds, p + 16, le) ? 'yes' : 'no');
        break;
      case 0x19:
      case 0x1: {
        segs.push(latin1(cmds, p + 8, p + 24).replace(/\u0000[\s\S]*$/, ''));
        break;
      }
      default:
        break;
    }
    p += sz;
  }
  out.row(sec, 'Segments', segs.join(', '));
  out.row(sec, 'Linked libraries', libs.length ? `${libs.length}: ${libs.slice(0, 12).join(', ')}${libs.length > 12 ? ' …' : ''}` : undefined);
  out.row(sec, 'Run-path search paths (rpath)', rpaths.join(', '));
  if (rpaths.some((r) => /\/(Users|home)\//.test(r))) out.find('filename', 'rpath contains a user directory', rpaths.filter((r) => /\/(Users|home)\//.test(r)).join(', '));
  if (sigOff && sigSize) {
    await out.attempt('code signature', async () => {
      const sb = await rd.read(base + sigOff, Math.min(sigSize, 65536));
      out.row(sec, 'Code signature', `present (${sigSize.toLocaleString('en-US')} bytes; validity not verified here)`);
      if (u32(sb, 0) === 0xfade0cc0) {
        const n = u32(sb, 8);
        for (let i = 0; i < n && i < 16; i++) {
          const type = u32(sb, 12 + i * 8);
          const off = u32(sb, 16 + i * 8);
          if (type === 0 && u32(sb, off) === 0xfade0c02) {
            const identOff = u32(sb, off + 20);
            let e = off + identOff;
            while (e < sb.length && sb[e] !== 0) e++;
            out.row(sec, 'Signing identifier', latin1(sb, off + identOff, e));
            const ver = u32(sb, off + 8);
            if (ver >= 0x20200) {
              const teamOff = u32(sb, off + 48);
              if (teamOff) {
                let t = off + teamOff;
                while (t < sb.length && sb[t] !== 0) t++;
                const team = latin1(sb, off + teamOff, t);
                out.row(sec, 'Team ID', team);
                if (team) out.find('company', 'Apple developer Team ID', team);
              }
            }
          }
        }
      }
    });
  } else out.row(sec, 'Code signature', 'none');
}

export async function parseMachO(c: Ctx): Promise<void> {
  const { rd, out } = c;
  const sec = out.section('macho', 'Mach-O');
  const h = await readExact(rd, 0, 8);
  const magic = u32(h, 0);
  if (magic === 0xcafebabe || magic === 0xcafebabf) {
    const is64 = magic === 0xcafebabf;
    const n = u32(h, 4);
    const ent = is64 ? 32 : 20;
    const d = await readExact(rd, 8, Math.min(n, 16) * ent);
    const archs: string[] = [];
    let firstOff = 0;
    for (let i = 0; i < Math.min(n, 16); i++) {
      const cpu = u32(d, i * ent);
      const sub = u32(d, i * ent + 4) & 0xffffff;
      const off = is64 ? u64(d, i * ent + 8) : u32(d, i * ent + 8);
      const sz = is64 ? u64(d, i * ent + 16) : u32(d, i * ent + 12);
      if (i === 0) firstOff = off;
      archs.push(`${MACHO_CPU[cpu] ?? `0x${cpu.toString(16)}`}${(cpu & 0xffffff) === 12 && sub === 2 ? 'e' : ''} (${fmtBytes(sz)})`);
    }
    out.row(sec, 'Universal binary architectures', archs.join(', '));
    out.note('Details below describe the first architecture slice.');
    await parseThinMachO(c, firstOff, sec);
  } else {
    await parseThinMachO(c, 0, sec);
  }
}

// ---------------------------------------------------------------------------
// Java class + WebAssembly
// ---------------------------------------------------------------------------

export async function parseJavaClass(c: Ctx): Promise<void> {
  const { rd, size, out } = c;
  const b = (await rd.read(0, Math.min(size, 4 * 1024 * 1024))).slice();
  const major = u16(b, 6);
  const minor = u16(b, 4);
  const sec = out.section('java', 'Java class file');
  out.row(sec, 'Class file version', `${major}.${minor}`);
  const javaVer = major >= 49 ? major - 44 : major === 48 ? 1.4 : major === 47 ? 1.3 : major === 46 ? 1.2 : 1.1;
  out.row(sec, 'Compiled for', `Java ${javaVer} or newer${major > 69 ? ' (newer than known releases)' : ''}`);
  const count = u16(b, 8);
  const utf: Map<number, string> = new Map();
  const classes: Map<number, number> = new Map();
  let p = 10;
  for (let i = 1; i < count && p < b.length; i++) {
    const tag = u8(b, p);
    switch (tag) {
      case 1: {
        const len = u16(b, p + 1);
        utf.set(i, utf8(b.subarray(p + 3, p + 3 + len)));
        p += 3 + len;
        break;
      }
      case 3:
      case 4:
      case 9:
      case 10:
      case 11:
      case 12:
      case 17:
      case 18:
        p += 5;
        break;
      case 5:
      case 6:
        p += 9;
        i++;
        break;
      case 7:
        classes.set(i, u16(b, p + 1));
        p += 3;
        break;
      case 8:
      case 16:
      case 19:
      case 20:
        p += 3;
        break;
      case 15:
        p += 4;
        break;
      default:
        throw new Error(`unknown constant pool tag ${tag}`);
    }
  }
  out.row(sec, 'Constant pool entries', String(count - 1));
  const acc = u16(b, p);
  const thisC = utf.get(classes.get(u16(b, p + 2)) ?? 0);
  const superC = utf.get(classes.get(u16(b, p + 4)) ?? 0);
  const ifaces = u16(b, p + 6);
  p += 8 + ifaces * 2;
  out.row(sec, 'Class', thisC?.replace(/\//g, '.'));
  out.row(sec, 'Super class', superC?.replace(/\//g, '.'));
  out.row(sec, 'Access flags', [acc & 1 ? 'public' : '', acc & 0x10 ? 'final' : '', acc & 0x200 ? 'interface' : '', acc & 0x400 ? 'abstract' : '', acc & 0x4000 ? 'enum' : '', acc & 0x2000 ? 'annotation' : ''].filter(Boolean).join(' '));
  out.row(sec, 'Interfaces', String(ifaces));
  const skipMembers = (): number => {
    const n = u16(b, p);
    p += 2;
    for (let i = 0; i < n; i++) {
      p += 6;
      const na = u16(b, p);
      p += 2;
      for (let a = 0; a < na; a++) p += 6 + u32(b, p + 2);
    }
    return n;
  };
  out.row(sec, 'Fields', String(skipMembers()));
  out.row(sec, 'Methods', String(skipMembers()));
  const na = u16(b, p);
  p += 2;
  for (let a = 0; a < na && p < b.length; a++) {
    const name = utf.get(u16(b, p));
    const len = u32(b, p + 2);
    if (name === 'SourceFile') {
      const sf = utf.get(u16(b, p + 6));
      out.row(sec, 'Source file (SourceFile attribute)', sf);
      if (sf) out.find('filename', 'Source file name', sf);
    }
    p += 6 + len;
  }
}

const WASM_SECTIONS: Record<number, string> = { 0: 'custom', 1: 'type', 2: 'import', 3: 'function', 4: 'table', 5: 'memory', 6: 'global', 7: 'export', 8: 'start', 9: 'element', 10: 'code', 11: 'data', 12: 'data count', 13: 'tag' };

function leb(b: Uint8Array, p: number): [number, number] {
  let v = 0;
  let mul = 1;
  let i = p;
  for (let k = 0; k < 6; k++) {
    const x = u8(b, i++);
    v += (x & 0x7f) * mul;
    mul *= 128;
    if (!(x & 0x80)) break;
  }
  return [v, i];
}

export async function parseWasm(c: Ctx): Promise<void> {
  const { rd, size, out } = c;
  const h = await readExact(rd, 0, 8);
  const sec = out.section('wasm', 'WebAssembly module');
  out.row(sec, 'Version', String(u32(h, 4, true)));
  let off = 8;
  const names: string[] = [];
  const customs: string[] = [];
  let guard = 0;
  while (off < size && guard++ < 500) {
    const hd = await rd.peek(off, 16);
    if (hd.length < 2) break;
    const id = u8(hd, 0);
    const [len, after] = leb(hd, 1);
    const body = off + (after);
    const label = WASM_SECTIONS[id] ?? `id ${id}`;
    if (id === 0) {
      const raw = await rd.read(body, Math.min(len, 2 * 1024 * 1024));
      const [nl, np] = leb(raw, 0);
      const name = utf8(raw.subarray(np, np + nl));
      customs.push(name);
      names.push(`custom "${name}" (${fmtBytes(len)})`);
      if (name === 'producers') {
        await out.attempt('producers section', () => {
          const psec = out.section('wasm-producers', 'Toolchain (producers section)');
          let p = np + nl;
          const [nf, p1] = leb(raw, p);
          p = p1;
          for (let f = 0; f < nf && p < raw.length; f++) {
            const [fl, pa] = leb(raw, p);
            const field = utf8(raw.subarray(pa, pa + fl));
            p = pa + fl;
            const [nv, pb] = leb(raw, p);
            p = pb;
            const vals: string[] = [];
            for (let v = 0; v < nv && p < raw.length; v++) {
              const [nl2, pc] = leb(raw, p);
              const nm = utf8(raw.subarray(pc, pc + nl2));
              p = pc + nl2;
              const [vl, pd] = leb(raw, p);
              const ver = utf8(raw.subarray(pd, pd + vl));
              p = pd + vl;
              vals.push(`${nm}${ver ? ` ${ver}` : ''}`);
            }
            out.row(psec, field, vals.join(', '));
            if (field === 'processed-by' || field === 'sdk') out.find('software', `WASM ${field}`, vals.join(', '));
          }
        });
      } else if (name === 'name') {
        await out.attempt('name section', () => {
          let p = np + nl;
          while (p < raw.length) {
            const sub = u8(raw, p);
            const [sl, sp] = leb(raw, p + 1);
            if (sub === 0) {
              const [ml, mp] = leb(raw, sp);
              out.row(sec, 'Module name', utf8(raw.subarray(mp, mp + ml)));
            } else if (sub === 1) {
              const [cnt] = leb(raw, sp);
              out.row(sec, 'Named functions (debug names)', String(cnt));
            }
            p = sp + sl;
          }
        });
      } else if (name === 'target_features') {
        const [nf, p0] = leb(raw, np + nl);
        let p = p0;
        const feats: string[] = [];
        for (let f = 0; f < nf && p < raw.length; f++) {
          const pre = String.fromCharCode(u8(raw, p));
          const [fl, pa] = leb(raw, p + 1);
          feats.push(`${pre}${utf8(raw.subarray(pa, pa + fl))}`);
          p = pa + fl;
        }
        out.row(sec, 'Target features', feats.join(' '));
      } else if (name === 'sourceMappingURL' || name === 'external_debug_info') {
        const [ul, up] = leb(raw, np + nl);
        const url = utf8(raw.subarray(up, up + ul));
        out.row(sec, name === 'sourceMappingURL' ? 'Source map URL' : 'External debug info', url);
        out.find('filename', 'Debug / source-map reference', url);
      } else if (name === 'build_id') {
        out.row(sec, 'Build ID', toHex(raw.subarray(np + nl + 1)));
      } else if (name.startsWith('.debug_')) {
        out.row(sec, 'DWARF debug info', 'present (may embed source file paths)');
      }
    } else {
      names.push(`${label} (${fmtBytes(len)})`);
      if (id === 3 || id === 2 || id === 7) {
        const raw = await rd.read(body, Math.min(len, 1024 * 1024));
        const [cnt, cp] = leb(raw, 0);
        if (id === 3) out.row(sec, 'Functions defined', cnt.toLocaleString('en-US'));
        else if (id === 2 || id === 7) {
          const list: string[] = [];
          let p = cp;
          for (let k = 0; k < cnt && k < 400 && p < raw.length; k++) {
            if (id === 2) {
              const [ml, mp] = leb(raw, p);
              const mod = utf8(raw.subarray(mp, mp + ml));
              p = mp + ml;
              const [fl, fp] = leb(raw, p);
              const fld = utf8(raw.subarray(fp, fp + fl));
              p = fp + fl;
              const kind = u8(raw, p);
              p++;
              if (kind === 0) p = leb(raw, p)[1];
              else if (kind === 1) {
                p++;
                const fl2 = u8(raw, p++);
                p = leb(raw, p)[1];
                if (fl2 & 1) p = leb(raw, p)[1];
              } else if (kind === 2) {
                const fl2 = u8(raw, p++);
                p = leb(raw, p)[1];
                if (fl2 & 1) p = leb(raw, p)[1];
              } else if (kind === 3) p += 2;
              else p = leb(raw, p)[1];
              if (list.length < 40) list.push(`${mod}.${fld}`);
            } else {
              const [nl2, np2] = leb(raw, p);
              const nm = utf8(raw.subarray(np2, np2 + nl2));
              p = np2 + nl2 + 1;
              p = leb(raw, p)[1];
              if (list.length < 40) list.push(nm);
            }
          }
          out.row(sec, id === 2 ? `Imports (${cnt})` : `Exports (${cnt})`, `${list.join(', ')}${cnt > list.length ? ' …' : ''}`);
        }
      }
    }
    off = body + len;
  }
  const ss = out.section('wasm-sections', 'Sections', { collapsed: true });
  names.slice(0, 80).forEach((n, i) => out.row(ss, String(i + 1), n));
  void customs;
}

// ---------------------------------------------------------------------------
// SQLite
// ---------------------------------------------------------------------------

const APP_IDS: Record<number, string> = { 0x0f055112: 'Fossil', 0x47504b47: 'GeoPackage (GPKG)', 0x47503130: 'GeoPackage 1.0 (GP10)', 0x4d504258: 'MBTiles (MPBX)', 0x41707041: 'Application file (AppA)' };

export async function parseSqlite(c: Ctx): Promise<void> {
  const { rd, size, out } = c;
  const h = await readExact(rd, 0, 100);
  const sec = out.section('sqlite', 'SQLite database');
  let pageSize = u16(h, 16);
  if (pageSize === 1) pageSize = 65536;
  const enc = u32(h, 56);
  out.row(sec, 'Page size', `${pageSize.toLocaleString('en-US')} bytes`);
  const pageCount = u32(h, 28);
  out.row(sec, 'Pages', `${pageCount.toLocaleString('en-US')} (${fmtBytes(pageCount * pageSize)})${pageCount * pageSize !== size ? ' · header page count differs from file size' : ''}`);
  out.row(sec, 'Journal mode', u8(h, 18) === 2 ? 'WAL' : 'rollback journal (legacy)');
  out.row(sec, 'Text encoding', enc === 1 ? 'UTF-8' : enc === 2 ? 'UTF-16 little-endian' : enc === 3 ? 'UTF-16 big-endian' : String(enc));
  out.row(sec, 'User version (PRAGMA user_version)', String(u32(h, 60)));
  out.row(sec, 'Schema format', String(u32(h, 44)));
  out.row(sec, 'Schema cookie', String(u32(h, 40)));
  out.row(sec, 'File change counter', String(u32(h, 24)));
  out.row(sec, 'Free pages', String(u32(h, 36)));
  const av = u32(h, 52);
  out.row(sec, 'Auto-vacuum', av === 0 ? 'off' : u32(h, 64) ? 'incremental' : 'full');
  const appId = u32(h, 68);
  if (appId) out.row(sec, 'Application ID', `0x${appId.toString(16)}${APP_IDS[appId] ? ` (${APP_IDS[appId]})` : ''}`);
  const ver = u32(h, 96);
  if (ver) out.row(sec, 'Written by SQLite version', `${Math.floor(ver / 1000000)}.${Math.floor(ver / 1000) % 1000}.${ver % 1000}`);
  // schema from sqlite_master (page 1 b-tree)
  await out.attempt('schema (sqlite_master)', async () => {
    if (enc !== 1) throw new Error('schema listing supports UTF-8 databases only');
    const reserved = u8(h, 20);
    const usable = pageSize - reserved;
    const rows: Array<{ type: string; name: string; tbl: string; root: number }> = [];
    const pageBuf = async (n: number) => rd.read((n - 1) * pageSize, pageSize);
    const varint = (b: Uint8Array, p: number): [number, number] => {
      let v = 0;
      for (let i = 0; i < 8; i++) {
        const x = u8(b, p + i);
        v = v * 128 + (x & 0x7f);
        if (!(x & 0x80)) return [v, p + i + 1];
      }
      return [v * 2 + (u8(b, p + 8) & 1) + (u8(b, p + 8) >> 1) * 0, p + 9];
    };
    const visit = async (pageNo: number, depth: number): Promise<void> => {
      if (depth > 6 || rows.length > 5000 || pageNo < 1 || pageNo > pageCount) return;
      const pg = await pageBuf(pageNo);
      const base = pageNo === 1 ? 100 : 0;
      const t = u8(pg, base);
      const ncell = u16(pg, base + 3);
      if (t === 5) {
        const right = u32(pg, base + 8);
        for (let i = 0; i < ncell; i++) {
          const cp = u16(pg, base + 12 + i * 2);
          await visit(u32(pg, cp), depth + 1);
        }
        await visit(right, depth + 1);
      } else if (t === 13) {
        for (let i = 0; i < ncell; i++) {
          let p = u16(pg, base + 8 + i * 2);
          const [payload, p1] = varint(pg, p);
          const [, p2] = varint(pg, p1);
          p = p2;
          const x = usable - 35;
          let local = payload;
          if (payload > x) {
            const m = Math.floor(((usable - 12) * 32) / 255) - 23;
            const k = m + ((payload - m) % (usable - 4));
            local = k <= x ? k : m;
          }
          const rec = pg.subarray(p, p + local);
          const [hsz, hp] = varint(rec, 0);
          const types: number[] = [];
          let q = hp;
          while (q < hsz) {
            const [st, nq] = varint(rec, q);
            types.push(st);
            q = nq;
          }
          let dp = hsz;
          const vals: Array<string | number> = [];
          for (const st of types) {
            let len = 0;
            if (st >= 12) len = st % 2 === 0 ? (st - 12) / 2 : (st - 13) / 2;
            else len = [0, 1, 2, 3, 4, 6, 8, 8, 0, 0][st] ?? 0;
            if (st >= 12 && st % 2 === 1) vals.push(utf8(rec.subarray(dp, dp + len)));
            else if (st >= 1 && st <= 6) {
              let n = 0;
              for (let k = 0; k < len; k++) n = n * 256 + u8(rec, dp + k);
              vals.push(n);
            } else if (st === 8) vals.push(0);
            else if (st === 9) vals.push(1);
            else vals.push('');
            dp += len;
          }
          rows.push({ type: String(vals[0] ?? ''), name: String(vals[1] ?? ''), tbl: String(vals[2] ?? ''), root: Number(vals[3] ?? 0) });
        }
      }
    };
    await visit(1, 0);
    const tables = rows.filter((r) => r.type === 'table' && !r.name.startsWith('sqlite_'));
    const idx = rows.filter((r) => r.type === 'index' && !r.name.startsWith('sqlite_'));
    const views = rows.filter((r) => r.type === 'view');
    const trig = rows.filter((r) => r.type === 'trigger');
    const ss = out.section('sqlite-schema', 'Schema');
    out.row(ss, `Tables (${tables.length})`, tables.slice(0, 80).map((r) => r.name).join(', '));
    out.row(ss, `Indexes (${idx.length})`, idx.slice(0, 80).map((r) => r.name).join(', '));
    out.row(ss, `Views (${views.length})`, views.slice(0, 40).map((r) => r.name).join(', '));
    out.row(ss, `Triggers (${trig.length})`, trig.slice(0, 40).map((r) => r.name).join(', '));
  });
}

