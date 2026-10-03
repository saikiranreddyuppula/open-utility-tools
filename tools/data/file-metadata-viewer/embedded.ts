/** Embedded metadata blocks shared by several image formats: XMP, IPTC-IIM, Photoshop resources, ICC. */
import type { Collector } from './util';
import { bytesEq, asciiBytes, clean, fmtNum, indexOfBytes, isoFromMs, latin1, textSmart, u16, u32, utf16, utf8, utf8Strict } from './util';
import { attr, localName, parseXml, type XNode } from './xml';

// ---------------------------------------------------------------------------
// XMP
// ---------------------------------------------------------------------------

export interface XmpProp {
  key: string;
  value: string;
}

export interface XmpResult {
  packet: string;
  props: XmpProp[];
}

/** Locate and decode the XMP packet inside arbitrary bytes. */
export function extractXmpPacket(b: Uint8Array): string | null {
  const start = indexOfBytes(b, asciiBytes('<x:xmpmeta'));
  const alt = start >= 0 ? start : indexOfBytes(b, asciiBytes('<rdf:RDF'));
  if (alt < 0) {
    // UTF-16 packets are rare; try a BOM-aware decode
    if (b.length > 2 && ((b[0] === 0xfe && b[1] === 0xff) || (b[0] === 0xff && b[1] === 0xfe))) {
      const t = utf16(b, b[0] === 0xff, 2);
      const i = t.indexOf('<x:xmpmeta');
      return i >= 0 ? t.slice(i) : null;
    }
    return null;
  }
  let endIdx = indexOfBytes(b, asciiBytes('</x:xmpmeta>'), alt);
  if (endIdx >= 0) endIdx += '</x:xmpmeta>'.length;
  else {
    endIdx = indexOfBytes(b, asciiBytes('</rdf:RDF>'), alt);
    endIdx = endIdx >= 0 ? endIdx + '</rdf:RDF>'.length : Math.min(b.length, alt + 1024 * 1024);
  }
  return utf8(b.subarray(alt, endIdx));
}

const SKIP_ATTR = /^(xmlns|rdf:about|rdf:parseType|xml:lang|rdf:resource$)/;

function describeLi(li: XNode): string {
  const attrs = Object.entries(li.attrs).filter(([k]) => !SKIP_ATTR.test(k));
  const kids = li.children.filter((c) => localName(c.name) !== 'Description' || c.children.length > 0 || Object.keys(c.attrs).length > 0);
  if (attrs.length === 0 && kids.length === 0) return li.text.trim();
  const parts: string[] = attrs.map(([k, v]) => `${localName(k)}=${v}`);
  for (const k of kids) {
    if (localName(k.name) === 'Description') {
      for (const [ak, av] of Object.entries(k.attrs)) if (!SKIP_ATTR.test(ak)) parts.push(`${localName(ak)}=${av}`);
      for (const kk of k.children) parts.push(`${localName(kk.name)}=${describeNode(kk)}`);
    } else {
      parts.push(`${localName(k.name)}=${describeNode(k)}`);
    }
  }
  return parts.join('; ');
}

function describeNode(node: XNode): string {
  const container = node.children.find((c) => ['Seq', 'Bag', 'Alt'].includes(localName(c.name)));
  if (container) {
    const kind = localName(container.name);
    const items = container.children.filter((c) => localName(c.name) === 'li');
    if (kind === 'Alt') {
      const def = items.find((i) => (attr(i, 'lang') ?? '') === 'x-default') ?? items[0];
      const others = items.filter((i) => i !== def).map((i) => `${describeLi(i)} [${attr(i, 'lang') ?? '?'}]`);
      const main = def ? describeLi(def) : '';
      return others.length > 0 ? `${main}; ${others.join('; ')}` : main;
    }
    const sep = items.some((i) => i.children.length > 0 || Object.keys(i.attrs).filter((k) => !SKIP_ATTR.test(k)).length > 0) ? ' | ' : ', ';
    return items.map(describeLi).join(sep);
  }
  const desc = node.children.find((c) => localName(c.name) === 'Description');
  if (desc) return describeLi(desc);
  const attrs = Object.entries(node.attrs).filter(([k]) => !SKIP_ATTR.test(k));
  if (node.children.length > 0 || attrs.length > 0) {
    const parts = attrs.map(([k, v]) => `${localName(k)}=${v}`);
    for (const c of node.children) parts.push(`${localName(c.name)}=${describeNode(c)}`);
    return parts.join('; ');
  }
  return node.text.trim();
}

export function parseXmp(packet: string): XmpProp[] {
  const root = parseXml(packet.slice(0, 2 * 1024 * 1024));
  if (!root) return [];
  const props: XmpProp[] = [];
  const stack: XNode[] = [root];
  const descs: XNode[] = [];
  while (stack.length > 0) {
    const n = stack.pop();
    if (!n) break;
    if (localName(n.name) === 'Description') descs.push(n);
    for (let i = n.children.length - 1; i >= 0; i--) {
      const c = n.children[i];
      if (c && localName(c.name) !== 'li') stack.push(c);
    }
  }
  for (const d of descs) {
    for (const [k, v] of Object.entries(d.attrs)) {
      if (SKIP_ATTR.test(k)) continue;
      props.push({ key: k, value: v });
    }
    for (const c of d.children) {
      if (localName(c.name) === 'Description') continue;
      const v = describeNode(c);
      if (v !== '') props.push({ key: c.name, value: v });
    }
    if (props.length > 400) break;
  }
  return props;
}

function xmpGpsToDecimal(s: string): number | null {
  const m = /^(\d+),(\d+(?:\.\d+)?)(?:,(\d+(?:\.\d+)?))?([NSEW])$/.exec(s.trim());
  if (!m) {
    const f = parseFloat(s);
    return Number.isFinite(f) ? f : null;
  }
  const deg = parseFloat(m[1] ?? '0');
  const min = parseFloat(m[2] ?? '0');
  const sec = m[3] ? parseFloat(m[3]) : 0;
  let dec = deg + min / 60 + sec / 3600;
  if (m[4] === 'S' || m[4] === 'W') dec = -dec;
  return dec;
}

/** Add an "XMP" section plus privacy findings to the collector. */
export function emitXmp(c: Collector, packet: string, sectionId = 'xmp', title = 'XMP metadata'): XmpProp[] {
  const props = parseXmp(packet);
  const sec = c.section(sectionId, title);
  for (const p of props.slice(0, 200)) c.row(sec, p.key, p.value.length > 2000 ? `${p.value.slice(0, 2000)}…` : p.value);
  if (props.length > 200) sec.note = `Showing 200 of ${props.length} properties.`;
  sec.raw = { label: 'Raw XMP packet', text: packet.length > 200000 ? `${packet.slice(0, 200000)}\n… (truncated)` : packet };
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const p = props.find((x) => x.key === k);
      if (p) return p.value;
    }
    return '';
  };
  const creators = get('dc:creator', 'pdf:Author', 'xmp:Author');
  if (creators) c.find('person', 'Creator / author (XMP)', creators);
  const tool = get('xmp:CreatorTool', 'pdf:Producer');
  if (tool) c.find('software', 'Creator tool (XMP)', tool);
  const owner = get('xmpRights:Owner', 'exifEX:CameraOwnerName', 'aux:OwnerName');
  if (owner) c.find('person', 'Owner (XMP)', owner);
  const make = get('tiff:Make');
  const model = get('tiff:Model');
  if (make || model) c.find('device', 'Camera (XMP)', `${make} ${model}`.trim());
  for (const k of ['aux:SerialNumber', 'exifEX:BodySerialNumber', 'exif:BodySerialNumber', 'aux:LensSerialNumber', 'exifEX:LensSerialNumber']) {
    const v = get(k);
    if (v) c.find('device', `${k.split(':')[1] ?? k} (XMP)`, v);
  }
  const lat = xmpGpsToDecimal(get('exif:GPSLatitude'));
  const lon = xmpGpsToDecimal(get('exif:GPSLongitude'));
  if (lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
    c.find('gps', 'GPS coordinates (XMP)', `${lat.toFixed(6)}, ${lon.toFixed(6)}`);
  }
  const hist = props.find((p) => p.key === 'xmpMM:History');
  if (hist) {
    const n = hist.value.split(' | ').length;
    c.find('editing', 'Edit history (XMP)', `${n} recorded event${n === 1 ? '' : 's'}: ${hist.value.length > 160 ? `${hist.value.slice(0, 160)}…` : hist.value}`);
    const agents = new Set<string>();
    for (const m of hist.value.matchAll(/softwareAgent=([^;|]+)/g)) agents.add((m[1] ?? '').trim());
    if (agents.size > 0) c.find('software', 'Software in edit history', Array.from(agents).join(', '));
  }
  const kept = get('xmpMM:PreservedFileName');
  if (kept) c.find('filename', 'Original file name (XMP)', kept);
  const credit = get('photoshop:Credit');
  if (credit) c.find('company', 'Credit (XMP)', credit);
  return props;
}

// ---------------------------------------------------------------------------
// IPTC-IIM + Photoshop image resources (JPEG APP13, TIFF tag 0x83BB / 0x8649)
// ---------------------------------------------------------------------------

const IPTC2: Record<number, string> = {
  0: 'Record version', 3: 'Object type', 5: 'Object name (title)', 7: 'Edit status', 8: 'Editorial update',
  10: 'Urgency', 12: 'Subject reference', 15: 'Category', 20: 'Supplemental categories', 22: 'Fixture identifier',
  25: 'Keywords', 26: 'Content location code', 27: 'Content location name', 30: 'Release date',
  35: 'Release time', 37: 'Expiration date', 38: 'Expiration time', 40: 'Special instructions',
  42: 'Action advised', 45: 'Reference service', 47: 'Reference date', 50: 'Reference number',
  55: 'Date created', 60: 'Time created', 62: 'Digital creation date', 63: 'Digital creation time',
  65: 'Originating program', 70: 'Program version', 75: 'Object cycle', 80: 'By-line (creator)',
  85: 'By-line title', 90: 'City', 92: 'Sub-location', 95: 'Province / state', 100: 'Country code',
  101: 'Country', 103: 'Original transmission reference', 105: 'Headline', 110: 'Credit', 115: 'Source',
  116: 'Copyright notice', 118: 'Contact', 120: 'Caption / abstract', 121: 'Local caption',
  122: 'Writer / editor', 130: 'Image type', 131: 'Image orientation', 135: 'Language identifier',
};

export interface IptcResult {
  rows: Array<[string, string]>;
  byName: Record<string, string>;
}

export function parseIptc(b: Uint8Array): IptcResult {
  const rows: Array<[string, string]> = [];
  const groups = new Map<string, string[]>();
  let utf8Flag = false;
  let i = 0;
  let guard = 0;
  while (i + 5 <= b.length && guard++ < 5000) {
    if (b[i] !== 0x1c) {
      i++;
      continue;
    }
    const rec = b[i + 1] ?? 0;
    const ds = b[i + 2] ?? 0;
    let len = u16(b, i + 3);
    let off = i + 5;
    if (len & 0x8000) {
      const n = len & 0x7fff;
      len = 0;
      for (let k = 0; k < n && k < 4; k++) len = len * 256 + (b[off + k] ?? 0);
      off += n;
    }
    if (off + len > b.length) break;
    const data = b.subarray(off, off + len);
    i = off + len;
    if (rec === 1 && ds === 90) {
      utf8Flag = bytesEq(data, 0, [0x1b, 0x25, 0x47]);
      continue;
    }
    if (rec !== 2) continue;
    const name = IPTC2[ds] ?? `Dataset 2:${ds}`;
    const text = utf8Flag ? utf8(data) : (utf8Strict(data) ?? latin1(data));
    const list = groups.get(name) ?? [];
    list.push(text.replace(/\u0000/g, '').trim());
    groups.set(name, list);
  }
  const byName: Record<string, string> = {};
  for (const [k, list] of groups) {
    const v = list.filter(Boolean).join(', ');
    if (v) {
      rows.push([k, v]);
      byName[k] = v;
    }
  }
  return { rows, byName };
}

export function emitIptc(c: Collector, iptc: IptcResult): void {
  if (iptc.rows.length === 0) return;
  const sec = c.section('iptc', 'IPTC (press / caption metadata)');
  for (const [k, v] of iptc.rows) c.row(sec, k, v);
  const by = iptc.byName;
  if (by['By-line (creator)']) c.find('person', 'Creator (IPTC by-line)', by['By-line (creator)']);
  if (by['Writer / editor']) c.find('person', 'Caption writer (IPTC)', by['Writer / editor']);
  if (by['Contact']) c.find('person', 'Contact (IPTC)', by['Contact']);
  if (by['Credit']) c.find('company', 'Credit (IPTC)', by['Credit']);
  if (by['Source']) c.find('company', 'Source (IPTC)', by['Source']);
  const prog = [by['Originating program'], by['Program version']].filter(Boolean).join(' ');
  if (prog) c.find('software', 'Originating program (IPTC)', prog);
  const loc = [by['Sub-location'], by['City'], by['Province / state'], by['Country']].filter(Boolean).join(', ');
  if (loc) c.find('gps', 'Location text (IPTC)', loc);
  if (by['Caption / abstract']) c.find('comments', 'Caption (IPTC)', by['Caption / abstract']);
}

const PS_RES: Record<number, string> = {
  0x03e9: 'Macintosh print manager info', 0x03ed: 'Resolution info', 0x03f3: 'Print flags',
  0x03f5: 'Colour halftoning info', 0x03f8: 'Colour transfer functions', 0x0404: 'IPTC-NAA record',
  0x0406: 'JPEG quality', 0x0408: 'Grid and guides', 0x0409: 'Thumbnail (Photoshop 4)',
  0x040a: 'Copyright flag', 0x040b: 'URL', 0x040c: 'Thumbnail (Photoshop 5)', 0x040d: 'Global angle',
  0x040f: 'ICC untagged profile', 0x0414: 'Document-specific IDs seed', 0x0415: 'Unicode alpha names',
  0x0419: 'Global altitude', 0x041a: 'Slices', 0x041e: 'URL list', 0x0421: 'Version info',
  0x0422: 'Exif data 1', 0x0423: 'Exif data 3', 0x0424: 'XMP metadata', 0x0425: 'Caption digest',
  0x0426: 'Print scale', 0x2710: 'Print flags info',
};

export interface PhotoshopResult {
  iptc: Uint8Array | null;
  xmp: Uint8Array | null;
  exif: Uint8Array | null;
  thumbnail: Uint8Array | null;
  ids: number[];
  versionInfo: string;
  dpi: string;
}

/** Parse "Photoshop 3.0" 8BIM image resource blocks (data starts at the first 8BIM). */
export function parsePhotoshopResources(b: Uint8Array): PhotoshopResult {
  const res: PhotoshopResult = { iptc: null, xmp: null, exif: null, thumbnail: null, ids: [], versionInfo: '', dpi: '' };
  let i = 0;
  let guard = 0;
  while (i + 12 <= b.length && guard++ < 2000) {
    if (!(bytesEq(b, i, asciiBytes('8BIM')) || bytesEq(b, i, asciiBytes('MeSa')))) break;
    const id = u16(b, i + 4);
    let p = i + 6;
    const nameLen = b[p] ?? 0;
    p += 1 + nameLen;
    if ((1 + nameLen) % 2 === 1) p += 1;
    const size = u32(b, p);
    p += 4;
    if (p + size > b.length) {
      if (id === 0x0404) res.iptc = b.subarray(p, b.length);
      res.ids.push(id);
      break;
    }
    const data = b.subarray(p, p + size);
    res.ids.push(id);
    if (id === 0x0404) res.iptc = data;
    else if (id === 0x0424) res.xmp = data;
    else if (id === 0x0422 || id === 0x0423) res.exif = data;
    else if ((id === 0x0409 || id === 0x040c) && size > 28) {
      const jpg = data.subarray(28);
      if (jpg[0] === 0xff && jpg[1] === 0xd8) res.thumbnail = jpg;
    } else if (id === 0x03ed && size >= 16) {
      const hRes = u32(data, 0) / 65536;
      const vRes = u32(data, 8) / 65536;
      res.dpi = `${fmtNum(hRes, 1)} × ${fmtNum(vRes, 1)} dpi`;
    } else if (id === 0x0421 && size >= 10) {
      // version(4) hasRealMergedData(1) writer name (unicode pstring) reader name (unicode pstring)
      const wl = u32(data, 5);
      const writer = utf16(data, false, 9, 9 + wl * 2);
      res.versionInfo = writer.replace(/\u0000/g, '');
    }
    i = p + size + (size % 2);
  }
  return res;
}

export function emitPhotoshop(c: Collector, ps: PhotoshopResult): void {
  const sec = c.section('photoshop', 'Photoshop image resources', { collapsed: true });
  if (ps.versionInfo) c.row(sec, 'Written by', ps.versionInfo);
  if (ps.dpi) c.row(sec, 'Resolution', ps.dpi);
  const names = ps.ids.map((id) => PS_RES[id] ?? `0x${id.toString(16).padStart(4, '0')}`);
  c.row(sec, 'Resource blocks', Array.from(new Set(names)).join(', '));
  if (ps.versionInfo) c.find('software', 'Written by (Photoshop resources)', ps.versionInfo);
  if (ps.thumbnail) {
    c.find('thumbnail', 'Embedded Photoshop thumbnail', `${ps.thumbnail.length.toLocaleString('en-US')} bytes`);
    c.preview('Embedded Photoshop thumbnail', 'image/jpeg', ps.thumbnail);
  }
}

// ---------------------------------------------------------------------------
// ICC colour profile
// ---------------------------------------------------------------------------

const ICC_CLASS: Record<string, string> = {
  scnr: 'Input device', mntr: 'Display device', prtr: 'Output device', link: 'DeviceLink',
  spac: 'Colour space conversion', abst: 'Abstract', nmcl: 'Named colour',
};
const ICC_PLATFORM: Record<string, string> = { APPL: 'Apple', MSFT: 'Microsoft', SGI: 'Silicon Graphics', SUNW: 'Sun Microsystems', TGNT: 'Taligent' };

function iccText(b: Uint8Array, off: number, size: number): string {
  if (off + 12 > b.length) return '';
  const type = latin1(b, off, off + 4);
  if (type === 'desc') {
    const n = u32(b, off + 8);
    return latin1(b, off + 12, off + 12 + Math.max(0, n - 1));
  }
  if (type === 'mluc') {
    const nrec = u32(b, off + 8);
    if (nrec < 1) return '';
    const len = u32(b, off + 20);
    const o = u32(b, off + 24);
    return utf16(b, false, off + o, off + o + len);
  }
  if (type === 'text') return latin1(b, off + 8, off + size).replace(/\u0000+$/g, '');
  return '';
}

export function parseIcc(b: Uint8Array): Array<[string, string]> | null {
  if (b.length < 132 || latin1(b, 36, 40) !== 'acsp') return null;
  const rows: Array<[string, string]> = [];
  const tags = new Map<string, [number, number]>();
  const nTags = Math.min(u32(b, 128), 200);
  for (let i = 0; i < nTags; i++) {
    const o = 132 + i * 12;
    tags.set(latin1(b, o, o + 4), [u32(b, o + 4), u32(b, o + 8)]);
  }
  const textTag = (sig: string): string => {
    const t = tags.get(sig);
    return t ? clean(iccText(b, t[0], t[1])) : '';
  };
  const desc = textTag('desc');
  if (desc) rows.push(['Profile description', desc]);
  const cprt = textTag('cprt');
  if (cprt) rows.push(['Copyright', cprt]);
  const dmnd = textTag('dmnd');
  if (dmnd) rows.push(['Device manufacturer', dmnd]);
  const dmdd = textTag('dmdd');
  if (dmdd) rows.push(['Device model', dmdd]);
  rows.push(['Profile version', `${b[8] ?? 0}.${(b[9] ?? 0) >> 4}.${(b[9] ?? 0) & 15}`]);
  const cls = latin1(b, 12, 16);
  rows.push(['Profile class', ICC_CLASS[cls] ?? cls]);
  rows.push(['Colour space', latin1(b, 16, 20).trim()]);
  rows.push(['Connection space (PCS)', latin1(b, 20, 24).trim()]);
  const yr = u16(b, 24);
  const iso = yr > 1900 ? isoFromMs(Date.UTC(yr, u16(b, 26) - 1, u16(b, 28), u16(b, 30), u16(b, 32), u16(b, 34))) : null;
  if (iso) rows.push(['Created', iso]);
  const cmm = latin1(b, 4, 8).replace(/\u0000/g, '').trim();
  if (cmm) rows.push(['Preferred CMM', cmm]);
  const plat = latin1(b, 40, 44);
  if (plat.trim() && plat !== '\u0000\u0000\u0000\u0000') rows.push(['Primary platform', ICC_PLATFORM[plat] ?? plat]);
  const creator = latin1(b, 80, 84).replace(/\u0000/g, '').trim();
  if (creator) rows.push(['Creator', creator]);
  rows.push(['Profile size', `${u32(b, 0).toLocaleString('en-US')} bytes`]);
  return rows;
}

export function emitIcc(c: Collector, icc: Uint8Array): void {
  const rows = parseIcc(icc);
  if (!rows) {
    c.errors.push('could not parse ICC profile: missing "acsp" signature');
    return;
  }
  const sec = c.section('icc', 'ICC colour profile');
  for (const [k, v] of rows) c.row(sec, k, v);
}

export function textOf(b: Uint8Array): string {
  return textSmart(b);
}
