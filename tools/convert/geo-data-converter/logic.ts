/**
 * GPX / KML / GeoJSON converter core: parsers, writers and geo maths.
 * Pure TypeScript (no DOM) so it can be unit-tested under bun. All XML handling uses
 * a small namespace-aware tokenizer defined below instead of DOMParser.
 */
import { strToU8, unzipSync, zipSync } from 'fflate';
import { parseCsv, toCsv } from '@/lib/data/csv';

/* ------------------------------------------------------------------------- */
/* Model                                                                      */
/* ------------------------------------------------------------------------- */

/** [longitude, latitude] or [longitude, latitude, elevation-in-metres]. */
export type Position = [number, number] | [number, number, number];
export type Props = Record<string, unknown>;
/** Per-vertex timestamps (ISO strings) mirroring the nesting of the geometry's coordinates. */
export type TimeTree = string | null | TimeTree[];

export type Geometry =
  | { type: 'Point'; coordinates: Position }
  | { type: 'MultiPoint'; coordinates: Position[] }
  | { type: 'LineString'; coordinates: Position[] }
  | { type: 'MultiLineString'; coordinates: Position[][] }
  | { type: 'Polygon'; coordinates: Position[][] }
  | { type: 'MultiPolygon'; coordinates: Position[][][] }
  | { type: 'GeometryCollection'; geometries: Geometry[] };

export type GeometryType = Geometry['type'];

export interface Feature {
  id?: string | number;
  geometry: Geometry | null;
  properties: Props;
  /** Per-vertex times (Point: string|null; lines: (string|null)[]; multi-lines: (string|null)[][]). */
  times?: TimeTree;
  /** Original GPX element kind, used by the "keep original" GPX output mode. */
  gpxKind?: 'trk' | 'rte' | 'wpt';
}

export interface GeoDoc {
  features: Feature[];
  name?: string;
}

export type InFormatId = 'geojson' | 'topojson' | 'gpx' | 'kml' | 'tcx' | 'csv' | 'wkt' | 'polyline';
export type OutFormatId = 'geojson' | 'gpx' | 'kml' | 'kmz' | 'csv' | 'wkt' | 'polyline';

export const IN_FORMAT_LABELS: Record<InFormatId, string> = {
  geojson: 'GeoJSON',
  topojson: 'TopoJSON',
  gpx: 'GPX',
  kml: 'KML',
  tcx: 'TCX',
  csv: 'CSV',
  wkt: 'WKT',
  polyline: 'Encoded polyline',
};

export const OUT_FORMATS: { id: OutFormatId; label: string; ext: string; mime: string }[] = [
  { id: 'gpx', label: 'GPX', ext: 'gpx', mime: 'application/gpx+xml' },
  { id: 'kml', label: 'KML', ext: 'kml', mime: 'application/vnd.google-earth.kml+xml' },
  { id: 'kmz', label: 'KMZ', ext: 'kmz', mime: 'application/vnd.google-earth.kmz' },
  { id: 'geojson', label: 'GeoJSON', ext: 'geojson', mime: 'application/geo+json' },
  { id: 'csv', label: 'CSV', ext: 'csv', mime: 'text/csv' },
  { id: 'wkt', label: 'WKT', ext: 'wkt', mime: 'text/plain' },
  { id: 'polyline', label: 'Polyline', ext: 'txt', mime: 'text/plain' },
];

export class GeoError extends Error {
  line?: number;
  column?: number;
  constructor(message: string, line?: number, column?: number) {
    super(message);
    this.name = 'GeoError';
    this.line = line;
    this.column = column;
  }
}

/** Collects warnings, merging identical messages ("msg (×3)"). */
export class Warnings {
  private counts = new Map<string, number>();
  add(msg: string): void {
    this.counts.set(msg, (this.counts.get(msg) ?? 0) + 1);
  }
  list(): string[] {
    return [...this.counts].map(([m, c]) => (c > 1 ? `${m} (×${c})` : m));
  }
  get size(): number {
    return this.counts.size;
  }
}

export const EARTH_RADIUS_M = 6371008.8;
const RAD = Math.PI / 180;

/* ------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* ------------------------------------------------------------------------- */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function zOf(p: Position): number | undefined {
  return p.length === 3 ? p[2] : undefined;
}

export function mkPos(lon: number, lat: number, z?: number): Position {
  return z === undefined || !Number.isFinite(z) ? [lon, lat] : [lon, lat, z];
}

/** Plain-decimal number formatting: never emits exponent notation (invalid in GPX/KML). */
export function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '0';
  if (n === 0) return '0';
  let s = String(n);
  if (s.indexOf('e') !== -1 || s.indexOf('E') !== -1) {
    s = n.toFixed(Math.abs(n) < 1 ? 20 : 0);
    if (s.indexOf('.') !== -1) s = s.replace(/0+$/, '').replace(/\.$/, '');
  }
  return s === '-0' ? '0' : s;
}

export function roundTo(v: number, d: number): number {
  if (!Number.isFinite(v) || d > 15) return v;
  const f = 10 ** d;
  const r = Math.round(v * f) / f;
  return r === 0 ? 0 : r;
}

export function lineColAt(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let last = -1;
  for (let i = text.indexOf('\n'); i !== -1 && i < offset; i = text.indexOf('\n', i + 1)) {
    line++;
    last = i;
  }
  return { line, column: offset - last };
}

/** Normalises many time spellings to `YYYY-MM-DDTHH:mm:ss[.s]Z`. Naive local times are treated as UTC. */
export function normalizeTime(raw: string | number | undefined | null): string | null {
  if (raw === undefined || raw === null) return null;
  let ms: number;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    ms = raw < 1e11 ? raw * 1000 : raw;
  } else {
    let s = raw.trim();
    if (!s) return null;
    if (/^-?\d+(\.\d+)?$/.test(s)) {
      const num = Number(s);
      if (s.length < 9) return null;
      ms = num < 1e11 ? num * 1000 : num;
    } else {
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) s = s.replace(' ', 'T');
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) s += 'Z';
      ms = Date.parse(s);
    }
  }
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  if (y < 1000 || y > 9999) return null;
  return d
    .toISOString()
    .replace(/(\.\d*?)0+Z$/, '$1Z')
    .replace(/\.Z$/, 'Z');
}

export function timeMs(t: string | null | undefined): number | null {
  if (!t) return null;
  const v = Date.parse(t);
  return Number.isFinite(v) ? v : null;
}

/**
 * Why a lon/lat pair is invalid, or null when fine. `style` selects the wording of the
 * "swapped" hint: positional formats (GeoJSON/KML/WKT) vs formats with named lat/lon fields.
 */
export function coordProblem(lon: number, lat: number, style: 'xy' | 'named' = 'xy'): string | null {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return 'coordinates must be finite numbers';
  const latBad = Math.abs(lat) > 90;
  const lonBad = Math.abs(lon) > 180;
  if (!latBad && !lonBad) return null;
  if (latBad && !lonBad && Math.abs(lon) <= 90) {
    return style === 'xy'
      ? `latitude ${lat} is outside -90..90. The values may be swapped: GeoJSON, KML and WKT use longitude, latitude order`
      : `latitude ${lat} is outside -90..90. The latitude and longitude values may be swapped`;
  }
  if (latBad && lonBad) {
    return `longitude ${lon} / latitude ${lat} are out of range. Coordinates look projected (e.g. Web Mercator metres); only WGS84 degrees are supported`;
  }
  if (lonBad) {
    return lon > 180 && lon <= 360
      ? `longitude ${lon} is outside -180..180 (0..360 longitudes are not supported)`
      : `longitude ${lon} is outside -180..180`;
  }
  return `latitude ${lat} is outside -90..90`;
}

function pickKey(props: Props, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = props[k];
    if (typeof v === 'string' && v.trim() !== '') return k;
    if (typeof v === 'number' && Number.isFinite(v)) return k;
  }
  return undefined;
}

function pickString(props: Props, keys: string[]): string | undefined {
  const k = pickKey(props, keys);
  return k === undefined ? undefined : String(props[k]);
}

const NAME_KEYS = ['name', 'Name', 'NAME', 'title', 'Title', 'label', 'Label'];
const DESC_KEYS = ['desc', 'description', 'Description', 'DESC', 'notes', 'note', 'Notes'];

export function featureName(f: Feature): string | undefined {
  return pickString(f.properties, NAME_KEYS);
}

/* ------------------------------------------------------------------------- */
/* Geometry utilities                                                         */
/* ------------------------------------------------------------------------- */

export function forEachPosition(g: Geometry, fn: (p: Position) => void): void {
  switch (g.type) {
    case 'Point':
      fn(g.coordinates);
      return;
    case 'MultiPoint':
    case 'LineString':
      for (const p of g.coordinates) fn(p);
      return;
    case 'MultiLineString':
    case 'Polygon':
      for (const r of g.coordinates) for (const p of r) fn(p);
      return;
    case 'MultiPolygon':
      for (const poly of g.coordinates) for (const r of poly) for (const p of r) fn(p);
      return;
    case 'GeometryCollection':
      for (const m of g.geometries) forEachPosition(m, fn);
      return;
  }
}

export function mapPositions(g: Geometry, fn: (p: Position) => Position): Geometry {
  switch (g.type) {
    case 'Point':
      return { type: 'Point', coordinates: fn(g.coordinates) };
    case 'MultiPoint':
      return { type: 'MultiPoint', coordinates: g.coordinates.map(fn) };
    case 'LineString':
      return { type: 'LineString', coordinates: g.coordinates.map(fn) };
    case 'MultiLineString':
      return { type: 'MultiLineString', coordinates: g.coordinates.map((r) => r.map(fn)) };
    case 'Polygon':
      return { type: 'Polygon', coordinates: g.coordinates.map((r) => r.map(fn)) };
    case 'MultiPolygon':
      return {
        type: 'MultiPolygon',
        coordinates: g.coordinates.map((poly) => poly.map((r) => r.map(fn))),
      };
    case 'GeometryCollection':
      return { type: 'GeometryCollection', geometries: g.geometries.map((m) => mapPositions(m, fn)) };
  }
}

export function countVertices(g: Geometry | null): number {
  if (!g) return 0;
  let n = 0;
  forEachPosition(g, () => n++);
  return n;
}

/** Time tree flattened in document order (depth-first). */
function flattenTimes(t: TimeTree | undefined, out: (string | null)[]): void {
  if (t === undefined) return;
  if (Array.isArray(t)) for (const x of t) flattenTimes(x, out);
  else out.push(t);
}

/** Does the time tree have exactly the shape of the geometry's coordinates? */
export function timesMatch(g: Geometry | null, t: TimeTree | undefined): boolean {
  if (!g || t === undefined) return false;
  switch (g.type) {
    case 'Point':
      return typeof t === 'string' || t === null;
    case 'MultiPoint':
    case 'LineString':
      return Array.isArray(t) && t.length === g.coordinates.length && t.every((x) => !Array.isArray(x));
    case 'MultiLineString':
      return (
        Array.isArray(t) &&
        t.length === g.coordinates.length &&
        g.coordinates.every((seg, i) => {
          const ts = t[i];
          return Array.isArray(ts) && ts.length === seg.length && ts.every((x) => !Array.isArray(x));
        })
      );
    default:
      return false;
  }
}

/** Times of a feature that is a Point/MultiPoint/LineString/MultiLineString, or undefined. */
function alignedTimes(f: Feature): TimeTree | undefined {
  return timesMatch(f.geometry, f.times) ? f.times : undefined;
}

export function lineLengthM(coords: Position[]): number {
  let d = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1] as Position;
    const b = coords[i] as Position;
    d += haversine(a[0], a[1], b[0], b[1]);
  }
  return d;
}

export function haversine(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const p1 = lat1 * RAD;
  const p2 = lat2 * RAD;
  const dp = (lat2 - lat1) * RAD;
  const dl = (lon2 - lon1) * RAD;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/* ------------------------------------------------------------------------- */
/* Minimal namespace-aware XML parser                                         */
/* ------------------------------------------------------------------------- */

export interface XmlNode {
  /** Qualified name as written, e.g. `gx:Track`. */
  name: string;
  local: string;
  prefix: string;
  /** Resolved namespace URI ('' when none). */
  ns: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  /** Concatenated character data directly inside this element. */
  text: string;
  /** Offset of the `<` in the source. */
  offset: number;
}

const XML_ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeXmlEntities(s: string): string {
  if (s.indexOf('&') === -1) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m: string, g: string) => {
    if (g.charCodeAt(0) === 35) {
      const cp = g.charAt(1) === 'x' ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
      if (cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff)) return String.fromCodePoint(cp);
      return m;
    }
    return XML_ENT[g] ?? m;
  });
}

export function xmlError(src: string, offset: number, msg: string): GeoError {
  const { line, column } = lineColAt(src, offset);
  return new GeoError(`XML error at line ${line}, column ${column}: ${msg}`, line, column);
}

const MAX_XML_DEPTH = 400;

export function parseXml(input: string): { root: XmlNode; src: string } {
  const src = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const n = src.length;
  const stack: XmlNode[] = [];
  const scopeStack: Record<string, string>[] = [];
  let scope: Record<string, string> = { xml: 'http://www.w3.org/XML/1998/namespace' };
  let root: XmlNode | null = null;
  const attrRe = /([^\s=/>"'<]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/y;
  const nameRe = /[^\s/>]+/y;
  const closeRe = /([^\s>]+)\s*>/y;
  let i = 0;

  const onText = (s: string, at: number): void => {
    const top = stack[stack.length - 1];
    if (!top) {
      const m = /\S/.exec(s);
      if (m) throw xmlError(src, at + m.index, 'text found outside the root element');
      return;
    }
    top.text += decodeXmlEntities(s);
  };

  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt === -1) {
      onText(src.slice(i), i);
      break;
    }
    if (lt > i) onText(src.slice(i, lt), i);
    i = lt;
    if (src.startsWith('<!--', i)) {
      const e = src.indexOf('-->', i + 4);
      if (e === -1) throw xmlError(src, i, 'unterminated comment');
      i = e + 3;
      continue;
    }
    if (src.startsWith('<![CDATA[', i)) {
      const e = src.indexOf(']]>', i + 9);
      if (e === -1) throw xmlError(src, i, 'unterminated CDATA section');
      const top = stack[stack.length - 1];
      if (!top) throw xmlError(src, i, 'CDATA found outside the root element');
      top.text += src.slice(i + 9, e);
      i = e + 3;
      continue;
    }
    if (src.startsWith('<?', i)) {
      const e = src.indexOf('?>', i + 2);
      if (e === -1) throw xmlError(src, i, 'unterminated processing instruction');
      i = e + 2;
      continue;
    }
    if (src.startsWith('<!', i)) {
      // DOCTYPE (custom entities are deliberately not expanded)
      let depth = 0;
      let j = i + 2;
      for (; j < n; j++) {
        const c = src.charCodeAt(j);
        if (c === 91) depth++;
        else if (c === 93) depth--;
        else if (c === 62 && depth <= 0) break;
      }
      if (j >= n) throw xmlError(src, i, 'unterminated <!DOCTYPE> declaration');
      i = j + 1;
      continue;
    }
    if (src.charCodeAt(i + 1) === 47) {
      closeRe.lastIndex = i + 2;
      const m = closeRe.exec(src);
      if (!m) throw xmlError(src, i, 'malformed closing tag');
      const nm = m[1] as string;
      const top = stack.pop();
      if (!top) throw xmlError(src, i, `unexpected closing tag </${nm}>`);
      scope = scopeStack.pop() as Record<string, string>;
      if (top.name !== nm) {
        const o = lineColAt(src, top.offset);
        throw xmlError(src, i, `closing tag </${nm}> does not match <${top.name}> opened at line ${o.line}`);
      }
      i = closeRe.lastIndex;
      continue;
    }
    // opening tag
    nameRe.lastIndex = i + 1;
    const nm = nameRe.exec(src);
    if (!nm || !/^[A-Za-z_:À-￿]/.test(nm[0])) {
      throw xmlError(src, i, 'invalid or missing tag name after "<"');
    }
    const qname = nm[0];
    let j = i + 1 + qname.length;
    const attrs: Record<string, string> = {};
    let decls: Record<string, string> | null = null;
    let selfClosing = false;
    for (;;) {
      while (j < n && /\s/.test(src.charAt(j))) j++;
      if (j >= n) throw xmlError(src, i, `unterminated tag <${qname}`);
      const c = src.charCodeAt(j);
      if (c === 62) {
        j++;
        break;
      }
      if (c === 47 && src.charCodeAt(j + 1) === 62) {
        selfClosing = true;
        j += 2;
        break;
      }
      attrRe.lastIndex = j;
      const am = attrRe.exec(src);
      if (!am) throw xmlError(src, j, `malformed attribute in <${qname}> (values must be quoted)`);
      const an = am[1] as string;
      const av = decodeXmlEntities(am[2] ?? am[3] ?? '');
      attrs[an] = av;
      if (an === 'xmlns') (decls ??= {})[''] = av;
      else if (an.startsWith('xmlns:')) (decls ??= {})[an.slice(6)] = av;
      j = attrRe.lastIndex;
    }
    const colon = qname.indexOf(':');
    const prefix = colon > 0 ? qname.slice(0, colon) : '';
    const local = colon > 0 ? qname.slice(colon + 1) : qname;
    const parentScope = scope;
    if (decls) scope = { ...scope, ...decls };
    const node: XmlNode = {
      name: qname,
      local,
      prefix,
      ns: scope[prefix] ?? '',
      attrs,
      children: [],
      text: '',
      offset: i,
    };
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(node);
    else if (root) throw xmlError(src, i, 'more than one root element');
    else root = node;
    if (selfClosing) {
      scope = parentScope;
    } else {
      if (stack.length >= MAX_XML_DEPTH) throw xmlError(src, i, 'elements are nested too deeply');
      stack.push(node);
      scopeStack.push(parentScope);
    }
    i = j;
  }
  const open = stack[stack.length - 1];
  if (open) {
    const o = lineColAt(src, open.offset);
    throw new GeoError(
      `XML error: element <${open.name}> opened at line ${o.line}, column ${o.column} is never closed (unexpected end of file)`,
      o.line,
      o.column
    );
  }
  if (!root) throw new GeoError('XML error: no root element found');
  return { root, src };
}

export function xChild(n: XmlNode, local: string): XmlNode | undefined {
  for (const c of n.children) if (c.local === local) return c;
  return undefined;
}

export function xChildren(n: XmlNode, local: string): XmlNode[] {
  return n.children.filter((c) => c.local === local);
}

export function xText(n: XmlNode | undefined, local?: string): string | undefined {
  const t = local ? (n ? xChild(n, local) : undefined) : n;
  if (!t) return undefined;
  const s = t.text.trim();
  return s === '' ? undefined : s;
}

/* ------------------------------------------------------------------------- */
/* Encoded polyline (Google)                                                  */
/* ------------------------------------------------------------------------- */

function roundAway(x: number): number {
  const r = Math.round(Math.abs(Number(x.toPrecision(15))));
  return x < 0 ? -r : r;
}

function encodePolyInt(v: number): string {
  let u = v < 0 ? -v * 2 - 1 : v * 2;
  let s = '';
  while (u >= 0x20) {
    s += String.fromCharCode((0x20 | (u % 32)) + 63);
    u = Math.floor(u / 32);
  }
  return s + String.fromCharCode(u + 63);
}

/** Encode [lon, lat] positions (elevation ignored) as a Google encoded polyline. */
export function encodePolyline(coords: Position[], precision: 5 | 6 = 5): string {
  const factor = 10 ** precision;
  let pLat = 0;
  let pLon = 0;
  let out = '';
  for (const p of coords) {
    const lat = roundAway(p[1] * factor);
    const lon = roundAway(p[0] * factor);
    out += encodePolyInt(lat - pLat) + encodePolyInt(lon - pLon);
    pLat = lat;
    pLon = lon;
  }
  return out;
}

/** Decode a Google encoded polyline to [lon, lat] positions. */
export function decodePolyline(str: string, precision: 5 | 6 = 5): Position[] {
  const factor = 10 ** precision;
  const n = str.length;
  const out: Position[] = [];
  let i = 0;
  let lat = 0;
  let lon = 0;
  const readVal = (): number => {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      if (i >= n) {
        throw new GeoError(`Invalid polyline: the string ends in the middle of a value (character ${i})`);
      }
      b = str.charCodeAt(i) - 63;
      if (b < 0 || b > 63) {
        throw new GeoError(
          `Invalid polyline: unexpected character "${str.charAt(i)}" at position ${i} (valid characters are ? through ~)`
        );
      }
      i++;
      result += (b & 0x1f) * 2 ** shift;
      shift += 5;
      if (shift > 40) throw new GeoError(`Invalid polyline: a value is too long near character ${i}`);
    } while (b >= 0x20);
    return result % 2 === 1 ? -(result + 1) / 2 : result / 2;
  };
  while (i < n) {
    lat += readVal();
    if (i >= n)
      throw new GeoError('Invalid polyline: it contains an odd number of values (latitude without longitude)');
    lon += readVal();
    const la = lat / factor;
    const lo = lon / factor;
    const prob = coordProblem(lo, la, 'named');
    if (prob) {
      throw new GeoError(`Invalid polyline point ${out.length + 1}: ${prob}. Check the polyline precision (5 or 6)`);
    }
    out.push([lo, la]);
  }
  return out;
}

function looksLikePolylineToken(s: string): boolean {
  return s.length >= 4 && !/\s/.test(s) && /^[\x3F-\x7E]+$/.test(s);
}

function cleanPolylineLine(raw: string): string {
  let s = raw.trim();
  if (s.length > 1 && /^(["'`]).*\1$/.test(s)) {
    s = s.slice(1, -1);
    s = s.replace(/\\\\/g, '\\');
  }
  return s;
}

function parsePolyline(text: string, precision: 5 | 6): GeoDoc {
  const features: Feature[] = [];
  const lines = text.split(/\r?\n/);
  let li = 0;
  for (const raw of lines) {
    li++;
    const s = cleanPolylineLine(raw);
    if (!s) continue;
    let coords: Position[];
    try {
      coords = decodePolyline(s, precision);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new GeoError(lines.length > 1 ? `Line ${li}: ${msg}` : msg, li);
    }
    if (coords.length === 0) continue;
    if (coords.length === 1)
      features.push({ geometry: { type: 'Point', coordinates: coords[0] as Position }, properties: {} });
    else features.push({ geometry: { type: 'LineString', coordinates: coords }, properties: {} });
  }
  if (!features.length) throw new GeoError('No polyline found in the input');
  return { features };
}

/* ------------------------------------------------------------------------- */
/* Geometry validation helpers                                                */
/* ------------------------------------------------------------------------- */

function fixRing(ring: Position[], where: string, w: Warnings): Position[] {
  if (ring.length < 3) {
    throw new GeoError(`${where}: a polygon ring needs at least 3 distinct positions (found ${ring.length})`);
  }
  const a = ring[0] as Position;
  const b = ring[ring.length - 1] as Position;
  let out = ring;
  if (a[0] !== b[0] || a[1] !== b[1]) {
    out = [...ring, a];
    w.add('Unclosed polygon ring was closed automatically');
  }
  if (out.length < 4) {
    throw new GeoError(`${where}: a closed polygon ring needs at least 4 positions (found ${out.length})`);
  }
  return out;
}

/* ------------------------------------------------------------------------- */
/* WKT                                                                        */
/* ------------------------------------------------------------------------- */

const WKT_TAGS = [
  'POINT',
  'LINESTRING',
  'POLYGON',
  'MULTIPOINT',
  'MULTILINESTRING',
  'MULTIPOLYGON',
  'GEOMETRYCOLLECTION',
];
const WKT_START_RE =
  /^\s*(?:SRID\s*=\s*\d+\s*;\s*)?(POINT|LINESTRING|POLYGON|MULTIPOINT|MULTILINESTRING|MULTIPOLYGON|GEOMETRYCOLLECTION)\s*(?:ZM|Z|M)?\s*(?:\(|EMPTY\b)/i;

class WktParser {
  i = 0;
  private num = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y;
  private sawM = false;
  constructor(
    private s: string,
    private w: Warnings
  ) {}

  private err(msg: string, at = this.i): GeoError {
    const { line, column } = lineColAt(this.s, at);
    return new GeoError(`WKT error at line ${line}, column ${column}: ${msg}`, line, column);
  }
  private ws(): void {
    while (this.i < this.s.length && /\s/.test(this.s.charAt(this.i))) this.i++;
  }
  private expect(ch: string): void {
    this.ws();
    if (this.s.charAt(this.i) !== ch) {
      const found = this.i >= this.s.length ? 'end of input' : `"${this.s.charAt(this.i)}"`;
      throw this.err(`expected "${ch}" but found ${found}`);
    }
    this.i++;
  }
  private peek(ch: string): boolean {
    this.ws();
    return this.s.charAt(this.i) === ch;
  }
  atEnd(): boolean {
    this.ws();
    while (this.s.charAt(this.i) === ';') {
      this.i++;
      this.ws();
    }
    return this.i >= this.s.length;
  }

  private position(dim: 'xy' | 'z' | 'm' | 'zm' | 'auto', where: string): Position {
    const nums: number[] = [];
    for (;;) {
      this.ws();
      this.num.lastIndex = this.i;
      const m = this.num.exec(this.s);
      if (!m) break;
      nums.push(Number(m[0]));
      this.i = this.num.lastIndex;
    }
    if (nums.length < 2 || nums.length > 4) {
      throw this.err(`a coordinate needs 2 to 4 numbers (found ${nums.length})`);
    }
    const lon = nums[0] as number;
    const lat = nums[1] as number;
    const prob = coordProblem(lon, lat);
    if (prob) throw this.err(`${where}: ${prob}`);
    let z: number | undefined;
    const d = dim === 'auto' ? (nums.length === 3 ? 'z' : nums.length === 4 ? 'zm' : 'xy') : dim;
    if (d === 'z' || d === 'zm') z = nums[2];
    if (d === 'm' || d === 'zm') this.sawM = true;
    return mkPos(lon, lat, z);
  }

  private posList(dim: 'xy' | 'z' | 'm' | 'zm' | 'auto', where: string): Position[] {
    this.expect('(');
    const out: Position[] = [];
    for (;;) {
      out.push(this.position(dim, where));
      this.ws();
      if (this.s.charAt(this.i) === ',') {
        this.i++;
        continue;
      }
      break;
    }
    this.expect(')');
    return out;
  }

  private list<T>(item: () => T): T[] {
    this.expect('(');
    const out: T[] = [];
    for (;;) {
      out.push(item());
      this.ws();
      if (this.s.charAt(this.i) === ',') {
        this.i++;
        continue;
      }
      break;
    }
    this.expect(')');
    return out;
  }

  private isEmpty(): boolean {
    this.ws();
    if (/^EMPTY\b/i.test(this.s.slice(this.i, this.i + 6))) {
      this.i += 5;
      return true;
    }
    return false;
  }

  geometry(): Geometry | null {
    this.ws();
    const start = this.i;
    const sridM = /^SRID\s*=\s*(\d+)\s*;/i.exec(this.s.slice(this.i, this.i + 40));
    if (sridM) {
      if (sridM[1] !== '4326')
        this.w.add('SRID other than 4326 was ignored; coordinates are assumed to be WGS84 degrees');
      this.i += sridM[0].length;
      this.ws();
    }
    const wm = /^[A-Za-z]+/.exec(this.s.slice(this.i, this.i + 30));
    if (!wm) throw this.err('expected a geometry type such as POINT or LINESTRING', start);
    let word = wm[0].toUpperCase();
    this.i += wm[0].length;
    let dim: 'xy' | 'z' | 'm' | 'zm' | 'auto' = 'auto';
    const suffix = /(ZM|Z|M)$/.exec(word);
    if (!WKT_TAGS.includes(word) && suffix) {
      const base = word.slice(0, word.length - (suffix[1] as string).length);
      if (WKT_TAGS.includes(base)) {
        word = base;
        dim = (suffix[1] as string).toLowerCase() as 'z' | 'm' | 'zm';
      }
    }
    if (!WKT_TAGS.includes(word)) throw this.err(`unknown geometry type "${wm[0]}"`, start);
    this.ws();
    const dm = /^(ZM|Z|M)(?![A-Za-z])/i.exec(this.s.slice(this.i, this.i + 3));
    if (dm) {
      dim = (dm[1] as string).toLowerCase() as 'z' | 'm' | 'zm';
      this.i += dm[0].length;
    }
    if (this.isEmpty()) return null;
    const w = this.w;
    switch (word) {
      case 'POINT': {
        this.expect('(');
        const p = this.position(dim, 'POINT');
        this.expect(')');
        return { type: 'Point', coordinates: p };
      }
      case 'LINESTRING': {
        const c = this.posList(dim, 'LINESTRING');
        if (c.length < 2) throw this.err('a LINESTRING needs at least 2 positions', start);
        return { type: 'LineString', coordinates: c };
      }
      case 'POLYGON':
        return { type: 'Polygon', coordinates: this.polygonBody(dim, start, w) };
      case 'MULTIPOINT': {
        const pts = this.list<Position>(() => {
          if (this.peek('(')) {
            this.i++;
            const p = this.position(dim, 'MULTIPOINT');
            this.expect(')');
            return p;
          }
          return this.position(dim, 'MULTIPOINT');
        });
        return { type: 'MultiPoint', coordinates: pts };
      }
      case 'MULTILINESTRING': {
        const lines = this.list<Position[]>(() => {
          const c = this.posList(dim, 'MULTILINESTRING');
          if (c.length < 2) throw this.err('a line needs at least 2 positions', start);
          return c;
        });
        return { type: 'MultiLineString', coordinates: lines };
      }
      case 'MULTIPOLYGON': {
        const polys = this.list<Position[][]>(() => this.polygonBody(dim, start, w));
        return { type: 'MultiPolygon', coordinates: polys };
      }
      default: {
        const gs: Geometry[] = [];
        this.list<null>(() => {
          const g = this.geometry();
          if (g) gs.push(g);
          return null;
        });
        return { type: 'GeometryCollection', geometries: gs };
      }
    }
  }

  private polygonBody(dim: 'xy' | 'z' | 'm' | 'zm' | 'auto', at: number, w: Warnings): Position[][] {
    const rings = this.list<Position[]>(() => {
      const ring = this.posList(dim, 'POLYGON');
      try {
        return fixRing(ring, 'POLYGON ring', w);
      } catch (e) {
        throw this.err(e instanceof Error ? e.message : String(e), at);
      }
    });
    return rings;
  }

  finishNotes(): void {
    if (this.sawM) this.w.add('WKT measure (M) values were ignored');
  }
}

export function parseWkt(text: string, w: Warnings = new Warnings()): GeoDoc {
  const p = new WktParser(text, w);
  const features: Feature[] = [];
  let empties = 0;
  while (!p.atEnd()) {
    const g = p.geometry();
    if (g) features.push({ geometry: g, properties: {} });
    else empties++;
  }
  if (empties) w.add('EMPTY geometries were skipped');
  p.finishNotes();
  if (!features.length) throw new GeoError('No WKT geometry found in the input');
  return { features };
}

function hasAllZ(g: Geometry): boolean {
  let all = true;
  let any = false;
  forEachPosition(g, (p) => {
    if (p.length === 3) any = true;
    else all = false;
  });
  return any && all;
}

function wktPos(p: Position, z: boolean): string {
  return z ? `${fmtNum(p[0])} ${fmtNum(p[1])} ${fmtNum(p.length === 3 ? p[2] : 0)}` : `${fmtNum(p[0])} ${fmtNum(p[1])}`;
}

export function geometryToWkt(g: Geometry, forceFlat = false): string {
  const z = !forceFlat && hasAllZ(g);
  const tag = (t: string): string => (z ? `${t} Z ` : `${t} `);
  const ring = (r: Position[]): string => `(${r.map((p) => wktPos(p, z)).join(', ')})`;
  switch (g.type) {
    case 'Point':
      return `${tag('POINT')}(${wktPos(g.coordinates, z)})`;
    case 'MultiPoint':
      return `${tag('MULTIPOINT')}(${g.coordinates.map((p) => `(${wktPos(p, z)})`).join(', ')})`;
    case 'LineString':
      return `${tag('LINESTRING')}${ring(g.coordinates)}`;
    case 'MultiLineString':
      return `${tag('MULTILINESTRING')}(${g.coordinates.map(ring).join(', ')})`;
    case 'Polygon':
      return `${tag('POLYGON')}(${g.coordinates.map(ring).join(', ')})`;
    case 'MultiPolygon':
      return `${tag('MULTIPOLYGON')}(${g.coordinates.map((poly) => `(${poly.map(ring).join(', ')})`).join(', ')})`;
    case 'GeometryCollection': {
      const collZ = !forceFlat && hasAllZ(g);
      const members = g.geometries.map((m) => geometryToWkt(m, !collZ)).join(', ');
      return `GEOMETRYCOLLECTION ${collZ ? 'Z ' : ''}(${members})`;
    }
  }
}

/* ------------------------------------------------------------------------- */
/* GeoJSON                                                                    */
/* ------------------------------------------------------------------------- */

function readPositionAt(v: unknown, where: string): Position {
  if (!Array.isArray(v) || v.length < 2 || typeof v[0] !== 'number' || typeof v[1] !== 'number') {
    throw new GeoError(`${where}: a position must be an array of numbers [longitude, latitude, elevation?]`);
  }
  const lon = v[0] as number;
  const lat = v[1] as number;
  const prob = coordProblem(lon, lat);
  if (prob) throw new GeoError(`${where}: ${prob}`);
  const z = v.length > 2 && typeof v[2] === 'number' ? (v[2] as number) : undefined;
  return mkPos(lon, lat, z);
}

function readPositions(v: unknown, path: string): Position[] {
  if (!Array.isArray(v)) throw new GeoError(`${path}: expected an array of positions`);
  const out: Position[] = new Array<Position>(v.length);
  for (let i = 0; i < v.length; i++) out[i] = readPositionAt(v[i], `${path}[${i}]`);
  return out;
}

function geoJsonGeometry(g: unknown, path: string, w: Warnings): Geometry | null {
  if (g === null || g === undefined) return null;
  if (!isObj(g)) throw new GeoError(`${path}: a geometry must be an object (or null)`);
  const t = g.type;
  if (t === 'GeometryCollection') {
    const arr = g.geometries;
    if (!Array.isArray(arr)) throw new GeoError(`${path}: GeometryCollection needs a "geometries" array`);
    const gs: Geometry[] = [];
    arr.forEach((m, i) => {
      const gg = geoJsonGeometry(m, `${path}.geometries[${i}]`, w);
      if (gg) gs.push(gg);
    });
    return gs.length ? { type: 'GeometryCollection', geometries: gs } : null;
  }
  const c = g.coordinates;
  if (!Array.isArray(c)) throw new GeoError(`${path}: missing "coordinates" array for geometry type "${String(t)}"`);
  if (c.length === 0) return null;
  const cp = `${path}.coordinates`;
  switch (t) {
    case 'Point':
      return { type: 'Point', coordinates: readPositionAt(c, cp) };
    case 'MultiPoint':
      return { type: 'MultiPoint', coordinates: readPositions(c, cp) };
    case 'LineString': {
      const line = readPositions(c, cp);
      if (line.length < 2) throw new GeoError(`${path}: a LineString needs at least 2 positions`);
      return { type: 'LineString', coordinates: line };
    }
    case 'MultiLineString':
      return {
        type: 'MultiLineString',
        coordinates: c.map((l, i) => {
          const line = readPositions(l, `${cp}[${i}]`);
          if (line.length < 2) throw new GeoError(`${cp}[${i}]: a line needs at least 2 positions`);
          return line;
        }),
      };
    case 'Polygon':
      return {
        type: 'Polygon',
        coordinates: c.map((r, i) => fixRing(readPositions(r, `${cp}[${i}]`), `${cp}[${i}]`, w)),
      };
    case 'MultiPolygon':
      return {
        type: 'MultiPolygon',
        coordinates: c.map((poly, pi) => {
          if (!Array.isArray(poly)) throw new GeoError(`${cp}[${pi}]: expected an array of rings`);
          return poly.map((r, i) => fixRing(readPositions(r, `${cp}[${pi}][${i}]`), `${cp}[${pi}][${i}]`, w));
        }),
      };
    default:
      throw new GeoError(`${path}: unsupported geometry type "${String(t)}"`);
  }
}

function normTimeTree(raw: unknown, depth = 0): TimeTree | undefined {
  if (depth > 3) return undefined;
  if (typeof raw === 'string') return normalizeTime(raw);
  if (typeof raw === 'number') return normalizeTime(raw);
  if (raw === null) return null;
  if (Array.isArray(raw)) {
    const out: TimeTree[] = [];
    for (const x of raw) {
      const t = normTimeTree(x, depth + 1);
      if (t === undefined) return undefined;
      out.push(t);
    }
    return out;
  }
  return undefined;
}

function extractGeoJsonTimes(geom: Geometry | null, props: Props, w: Warnings): TimeTree | undefined {
  if (!geom) return undefined;
  if (geom.type === 'Point') {
    if (typeof props.time === 'string') {
      const t = normalizeTime(props.time);
      if (t) {
        delete props.time;
        return t;
      }
    }
    return undefined;
  }
  if (geom.type !== 'LineString' && geom.type !== 'MultiLineString' && geom.type !== 'MultiPoint') return undefined;
  let raw: unknown = props.coordTimes;
  let viaCp = false;
  if (raw === undefined && isObj(props.coordinateProperties)) {
    raw = props.coordinateProperties.times;
    viaCp = true;
  }
  if (raw === undefined) return undefined;
  const tree = normTimeTree(raw);
  if (tree === undefined || !timesMatch(geom, tree)) {
    w.add('coordTimes does not match the geometry and was kept as a plain property');
    return undefined;
  }
  if (viaCp) {
    const cp = { ...(props.coordinateProperties as Record<string, unknown>) };
    delete cp.times;
    if (Object.keys(cp).length) props.coordinateProperties = cp;
    else delete props.coordinateProperties;
  } else {
    delete props.coordTimes;
  }
  return tree;
}

function geoJsonFeature(f: Record<string, unknown>, path: string, w: Warnings): Feature {
  const props: Props = isObj(f.properties) ? { ...f.properties } : {};
  const geometry = geoJsonGeometry(f.geometry, `${path}.geometry`, w);
  const feat: Feature = { geometry, properties: props };
  if (typeof f.id === 'string' || typeof f.id === 'number') feat.id = f.id;
  const times = extractGeoJsonTimes(geometry, props, w);
  if (times !== undefined) feat.times = times;
  return feat;
}

const GEOJSON_GEOM_TYPES = [
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
  'GeometryCollection',
];

export function geoJsonToDoc(json: unknown, w: Warnings = new Warnings()): GeoDoc {
  const items: unknown[] = Array.isArray(json) ? json : [json];
  const features: Feature[] = [];
  const collect = (o: unknown, path: string): void => {
    if (!isObj(o)) throw new GeoError(`${path}: expected a GeoJSON object`);
    const t = o.type;
    if (t === 'FeatureCollection') {
      if (!Array.isArray(o.features)) throw new GeoError(`${path}: FeatureCollection needs a "features" array`);
      o.features.forEach((f, i) => {
        if (!isObj(f)) throw new GeoError(`${path}.features[${i}]: expected a Feature object`);
        collect(f, `${path}.features[${i}]`);
      });
    } else if (t === 'Feature') {
      features.push(geoJsonFeature(o, path, w));
    } else if (typeof t === 'string' && GEOJSON_GEOM_TYPES.includes(t)) {
      features.push({ geometry: geoJsonGeometry(o, path, w), properties: {} });
    } else {
      throw new GeoError(
        `${path}: not GeoJSON - expected "type" to be FeatureCollection, Feature or a geometry type, got ${t === undefined ? 'no "type" member' : JSON.stringify(t)}`
      );
    }
  };
  items.forEach((it, i) => collect(it, Array.isArray(json) ? `[${i}]` : '$'));
  if (isObj(json) && json.crs !== undefined) {
    const crs = JSON.stringify(json.crs);
    if (!/CRS84|4326/.test(crs))
      w.add('A "crs" member was found and ignored; coordinates are assumed to be WGS84 longitude/latitude');
  }
  return { features };
}

function jsonErrorWithPosition(text: string, e: unknown): GeoError {
  const msg = e instanceof Error ? e.message : String(e);
  const m = /position (\d+)/i.exec(msg);
  if (m) {
    const { line, column } = lineColAt(text, Number(m[1]));
    return new GeoError(`Invalid JSON at line ${line}, column ${column}: ${msg}`, line, column);
  }
  const lm = /line (\d+) column (\d+)/i.exec(msg);
  if (lm) return new GeoError(`Invalid JSON at line ${lm[1]}, column ${lm[2]}: ${msg}`, Number(lm[1]), Number(lm[2]));
  return new GeoError(`Invalid JSON: ${msg}`);
}

export function parseGeoJson(text: string, w: Warnings = new Warnings()): GeoDoc {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw jsonErrorWithPosition(text, e);
  }
  if (isObj(json) && json.type === 'Topology') throw new GeoError('This is TopoJSON, not GeoJSON');
  return geoJsonToDoc(json, w);
}

/* ------------------------------------------------------------------------- */
/* TopoJSON (read only)                                                       */
/* ------------------------------------------------------------------------- */

export function parseTopoJson(text: string, w: Warnings = new Warnings()): GeoDoc {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw jsonErrorWithPosition(text, e);
  }
  if (!isObj(json) || json.type !== 'Topology')
    throw new GeoError('Not TopoJSON: the top-level "type" must be "Topology"');
  const rawArcs = json.arcs;
  if (!Array.isArray(rawArcs)) throw new GeoError('TopoJSON: missing "arcs" array');
  let sx = 1;
  let sy = 1;
  let tx = 0;
  let ty = 0;
  let quantized = false;
  const tr = json.transform;
  if (isObj(tr)) {
    const sc = tr.scale;
    const tl = tr.translate;
    if (
      Array.isArray(sc) &&
      Array.isArray(tl) &&
      sc.length >= 2 &&
      tl.length >= 2 &&
      [sc[0], sc[1], tl[0], tl[1]].every((v) => typeof v === 'number' && Number.isFinite(v))
    ) {
      sx = sc[0] as number;
      sy = sc[1] as number;
      tx = tl[0] as number;
      ty = tl[1] as number;
      quantized = true;
    } else {
      throw new GeoError('TopoJSON: "transform" needs numeric "scale" and "translate" pairs');
    }
  }
  const arcs: Position[][] = rawArcs.map((arc, ai) => {
    if (!Array.isArray(arc)) throw new GeoError(`TopoJSON: arcs[${ai}] must be an array of positions`);
    const out: Position[] = new Array<Position>(arc.length);
    let x = 0;
    let y = 0;
    for (let k = 0; k < arc.length; k++) {
      const p: unknown = arc[k];
      if (!Array.isArray(p) || typeof p[0] !== 'number' || typeof p[1] !== 'number') {
        throw new GeoError(`TopoJSON: arcs[${ai}][${k}] must be a position`);
      }
      let lon: number;
      let lat: number;
      if (quantized) {
        x += p[0];
        y += p[1];
        lon = x * sx + tx;
        lat = y * sy + ty;
      } else {
        lon = p[0];
        lat = p[1];
      }
      const prob = coordProblem(lon, lat);
      if (prob) throw new GeoError(`TopoJSON arcs[${ai}][${k}]: ${prob}`);
      out[k] = mkPos(lon, lat, typeof p[2] === 'number' && !quantized ? p[2] : undefined);
    }
    return out;
  });
  const stitch = (idxs: unknown, where: string): Position[] => {
    if (!Array.isArray(idxs)) throw new GeoError(`${where}: "arcs" must be an array of arc indexes`);
    const out: Position[] = [];
    for (const raw of idxs) {
      if (typeof raw !== 'number' || !Number.isInteger(raw))
        throw new GeoError(`${where}: arc indexes must be integers`);
      const rev = raw < 0;
      const a = arcs[rev ? ~raw : raw];
      if (!a) throw new GeoError(`${where}: arc index ${raw} does not exist`);
      const seq = rev ? [...a].reverse() : a;
      for (let k = out.length ? 1 : 0; k < seq.length; k++) out.push(seq[k] as Position);
    }
    return out;
  };
  const tPos = (c: unknown, where: string): Position => {
    if (!Array.isArray(c) || typeof c[0] !== 'number' || typeof c[1] !== 'number') {
      throw new GeoError(`${where}: expected a position`);
    }
    const lon = quantized ? c[0] * sx + tx : c[0];
    const lat = quantized ? c[1] * sy + ty : c[1];
    const prob = coordProblem(lon, lat);
    if (prob) throw new GeoError(`${where}: ${prob}`);
    return mkPos(lon, lat, !quantized && typeof c[2] === 'number' ? c[2] : undefined);
  };
  const geomOf = (o: Record<string, unknown>, where: string): Geometry | null => {
    switch (o.type) {
      case 'Point':
        return Array.isArray(o.coordinates) && o.coordinates.length
          ? { type: 'Point', coordinates: tPos(o.coordinates, where) }
          : null;
      case 'MultiPoint':
        if (!Array.isArray(o.coordinates)) throw new GeoError(`${where}: missing coordinates`);
        return o.coordinates.length
          ? {
              type: 'MultiPoint',
              coordinates: o.coordinates.map((c: unknown, i: number) => tPos(c, `${where}.coordinates[${i}]`)),
            }
          : null;
      case 'LineString': {
        const l = stitch(o.arcs, where);
        return l.length >= 2 ? { type: 'LineString', coordinates: l } : null;
      }
      case 'MultiLineString': {
        if (!Array.isArray(o.arcs)) throw new GeoError(`${where}: missing arcs`);
        const ls = o.arcs.map((a: unknown) => stitch(a, where)).filter((l: Position[]) => l.length >= 2);
        return ls.length ? { type: 'MultiLineString', coordinates: ls } : null;
      }
      case 'Polygon': {
        if (!Array.isArray(o.arcs)) throw new GeoError(`${where}: missing arcs`);
        const rings = o.arcs.map((a: unknown) => fixRing(stitch(a, where), where, w));
        return rings.length ? { type: 'Polygon', coordinates: rings } : null;
      }
      case 'MultiPolygon': {
        if (!Array.isArray(o.arcs)) throw new GeoError(`${where}: missing arcs`);
        const polys = o.arcs.map((pa: unknown) => {
          if (!Array.isArray(pa)) throw new GeoError(`${where}: invalid polygon arcs`);
          return pa.map((a: unknown) => fixRing(stitch(a, where), where, w));
        });
        return polys.length ? { type: 'MultiPolygon', coordinates: polys } : null;
      }
      case 'GeometryCollection': {
        const gs: Geometry[] = [];
        for (const m of Array.isArray(o.geometries) ? o.geometries : []) {
          if (isObj(m)) {
            const g = geomOf(m, where);
            if (g) gs.push(g);
          }
        }
        return gs.length ? { type: 'GeometryCollection', geometries: gs } : null;
      }
      case null:
      case undefined:
        return null;
      default:
        throw new GeoError(`${where}: unsupported TopoJSON geometry type "${String(o.type)}"`);
    }
  };
  const featureOf = (o: Record<string, unknown>, where: string, objName?: string): Feature => {
    const f: Feature = { geometry: geomOf(o, where), properties: isObj(o.properties) ? { ...o.properties } : {} };
    if (typeof o.id === 'string' || typeof o.id === 'number') f.id = o.id;
    if (objName !== undefined) f.properties.topojson_object = objName;
    return f;
  };
  const objects = json.objects;
  if (!isObj(objects)) throw new GeoError('TopoJSON: missing "objects"');
  const names = Object.keys(objects);
  const multi = names.length > 1;
  const features: Feature[] = [];
  for (const name of names) {
    const o = objects[name];
    if (!isObj(o)) continue;
    const where = `objects.${name}`;
    if (o.type === 'GeometryCollection') {
      (Array.isArray(o.geometries) ? o.geometries : []).forEach((m: unknown, i: number) => {
        if (isObj(m)) features.push(featureOf(m, `${where}.geometries[${i}]`, multi ? name : undefined));
      });
    } else {
      features.push(featureOf(o, where, multi ? name : undefined));
    }
  }
  return { features };
}

/* ------------------------------------------------------------------------- */
/* GPX reader                                                                 */
/* ------------------------------------------------------------------------- */

interface PtRead {
  pos: Position;
  time: string | null;
}

function nodeErr(src: string, n: XmlNode, msg: string): GeoError {
  const { line, column } = lineColAt(src, n.offset);
  return new GeoError(`Line ${line}: ${msg}`, line, column);
}

function gpxProps(n: XmlNode): Props {
  const p: Props = {};
  for (const k of ['name', 'cmt', 'desc', 'src', 'sym', 'type'] as const) {
    const v = xText(n, k);
    if (v !== undefined) p[k] = v;
  }
  const num = xText(n, 'number');
  if (num !== undefined && Number.isFinite(Number(num))) p.number = Number(num);
  const link = xChild(n, 'link');
  if (link) {
    const href = link.attrs.href;
    if (href) p.link = href;
    const lt = xText(link, 'text');
    if (lt) p.linkText = lt;
  } else {
    const url = xText(n, 'url');
    if (url) p.link = url;
    const un = xText(n, 'urlname');
    if (un) p.linkText = un;
  }
  return p;
}

export function parseGpx(text: string, w: Warnings = new Warnings()): GeoDoc {
  const { root, src } = parseXml(text);
  if (root.local !== 'gpx') throw new GeoError(`Not a GPX file: the root element is <${root.name}>, expected <gpx>`);
  let badEle = 0;
  let badTime = 0;
  const readPt = (n: XmlNode): PtRead => {
    const latS = n.attrs.lat;
    const lonS = n.attrs.lon;
    if (latS === undefined || lonS === undefined || latS.trim() === '' || lonS.trim() === '') {
      throw nodeErr(src, n, `<${n.local}> is missing its lat or lon attribute`);
    }
    const lat = Number(latS);
    const lon = Number(lonS);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw nodeErr(src, n, `<${n.local} lat="${latS}" lon="${lonS}"> has a non-numeric coordinate`);
    }
    const prob = coordProblem(lon, lat, 'named');
    if (prob) throw nodeErr(src, n, `<${n.local} lat="${latS}" lon="${lonS}">: ${prob}`);
    let z: number | undefined;
    const eleS = xText(n, 'ele');
    if (eleS !== undefined) {
      const e = Number(eleS);
      if (Number.isFinite(e)) z = e;
      else badEle++;
    }
    let time: string | null = null;
    const tS = xText(n, 'time');
    if (tS !== undefined) {
      time = normalizeTime(tS);
      if (!time) badTime++;
    }
    return { pos: mkPos(lon, lat, z), time };
  };
  const readLine = (parent: XmlNode, ptName: string): { coords: Position[]; times: (string | null)[] } => {
    const coords: Position[] = [];
    const times: (string | null)[] = [];
    for (const c of parent.children) {
      if (c.local !== ptName) continue;
      const r = readPt(c);
      coords.push(r.pos);
      times.push(r.time);
    }
    return { coords, times };
  };
  const features: Feature[] = [];
  let missingEle = false;
  const noteEle = (coords: Position[]): void => {
    let z = 0;
    for (const p of coords) if (p.length === 3) z++;
    if (z > 0 && z < coords.length) missingEle = true;
  };
  for (const c of root.children) {
    if (c.local === 'wpt') {
      const r = readPt(c);
      const f: Feature = { geometry: { type: 'Point', coordinates: r.pos }, properties: gpxProps(c), gpxKind: 'wpt' };
      if (r.time) f.times = r.time;
      features.push(f);
    } else if (c.local === 'rte') {
      const { coords, times } = readLine(c, 'rtept');
      if (coords.length < 2) {
        w.add('A route with fewer than 2 points was skipped');
        continue;
      }
      noteEle(coords);
      const f: Feature = {
        geometry: { type: 'LineString', coordinates: coords },
        properties: gpxProps(c),
        gpxKind: 'rte',
      };
      if (times.some((t) => t !== null)) f.times = times;
      features.push(f);
    } else if (c.local === 'trk') {
      const segs: Position[][] = [];
      const segTimes: (string | null)[][] = [];
      for (const s of c.children) {
        if (s.local !== 'trkseg') continue;
        const { coords, times } = readLine(s, 'trkpt');
        if (coords.length < 2) {
          if (coords.length === 1) w.add('A track segment with a single point was skipped');
          continue;
        }
        noteEle(coords);
        segs.push(coords);
        segTimes.push(times);
      }
      if (!segs.length) {
        w.add('A track without a segment of at least 2 points was skipped');
        continue;
      }
      const anyTime = segTimes.some((ts) => ts.some((t) => t !== null));
      const f: Feature =
        segs.length === 1
          ? {
              geometry: { type: 'LineString', coordinates: segs[0] as Position[] },
              properties: gpxProps(c),
              gpxKind: 'trk',
            }
          : { geometry: { type: 'MultiLineString', coordinates: segs }, properties: gpxProps(c), gpxKind: 'trk' };
      if (anyTime) f.times = segs.length === 1 ? (segTimes[0] as (string | null)[]) : segTimes;
      features.push(f);
    }
  }
  if (badEle) w.add('Some <ele> values are not numbers and were ignored');
  if (badTime) w.add('Some <time> values could not be parsed and were ignored');
  if (missingEle) w.add('Some points have no elevation while others do');
  const meta = xChild(root, 'metadata');
  const name = (meta ? xText(meta, 'name') : undefined) ?? xText(root, 'name');
  return { features, name };
}

/* ------------------------------------------------------------------------- */
/* KML reader                                                                 */
/* ------------------------------------------------------------------------- */

interface KmlGeom {
  g: Geometry;
  times?: TimeTree;
}

export function parseKml(text: string, w: Warnings = new Warnings()): GeoDoc {
  const { root, src } = parseXml(text);
  if (!['kml', 'Document', 'Folder', 'Placemark'].includes(root.local)) {
    throw new GeoError(`Not a KML file: the root element is <${root.name}>, expected <kml>`);
  }

  const coordTuples = (n: XmlNode | undefined, owner: XmlNode): Position[] => {
    if (!n) return [];
    const cleaned = n.text.replace(/\s*,\s*/g, ',').trim();
    if (!cleaned) return [];
    const toks = cleaned.split(/\s+/);
    const out: Position[] = new Array<Position>(toks.length);
    for (let i = 0; i < toks.length; i++) {
      const parts = (toks[i] as string).split(',');
      const lon = Number(parts[0]);
      const lat = Number(parts[1]);
      if (parts.length < 2 || parts[0] === '' || parts[1] === '' || !Number.isFinite(lon) || !Number.isFinite(lat)) {
        throw nodeErr(
          src,
          n,
          `<${owner.local}> coordinate "${toks[i]}" is not in "longitude,latitude[,altitude]" form`
        );
      }
      const prob = coordProblem(lon, lat);
      if (prob) throw nodeErr(src, n, `<${owner.local}> coordinate "${toks[i]}": ${prob}`);
      const alt = parts.length > 2 && parts[2] !== '' ? Number(parts[2]) : undefined;
      out[i] = mkPos(lon, lat, alt);
    }
    return out;
  };

  const ringOf = (boundary: XmlNode | undefined, owner: XmlNode): Position[] | null => {
    if (!boundary) return null;
    const lr = xChild(boundary, 'LinearRing');
    if (!lr) return null;
    const coords = coordTuples(xChild(lr, 'coordinates'), lr);
    if (coords.length === 0) return null;
    return fixRing(coords, `Line ${lineColAt(src, owner.offset).line}: polygon ring`, w);
  };

  const combine = (members: KmlGeom[]): KmlGeom | null => {
    if (members.length === 0) return null;
    if (members.length === 1) return members[0] as KmlGeom;
    const types = new Set(members.map((m) => m.g.type));
    const anyTimes = members.some((m) => m.times !== undefined);
    if (types.size === 1) {
      const t = (members[0] as KmlGeom).g.type;
      if (t === 'Point') {
        const g: Geometry = {
          type: 'MultiPoint',
          coordinates: members.map((m) => (m.g as { coordinates: Position }).coordinates),
        };
        return anyTimes ? { g, times: members.map((m) => (typeof m.times === 'string' ? m.times : null)) } : { g };
      }
      if (t === 'LineString') {
        const g: Geometry = {
          type: 'MultiLineString',
          coordinates: members.map((m) => (m.g as { coordinates: Position[] }).coordinates),
        };
        if (!anyTimes) return { g };
        return {
          g,
          times: members.map((m) => {
            const len = (m.g as { coordinates: Position[] }).coordinates.length;
            return Array.isArray(m.times) ? m.times : new Array<string | null>(len).fill(null);
          }),
        };
      }
      if (t === 'MultiLineString' && anyTimes === false) {
        return {
          g: {
            type: 'MultiLineString',
            coordinates: members.flatMap((m) => (m.g as { coordinates: Position[][] }).coordinates),
          },
        };
      }
      if (t === 'Polygon') {
        return {
          g: {
            type: 'MultiPolygon',
            coordinates: members.map((m) => (m.g as { coordinates: Position[][] }).coordinates),
          },
        };
      }
    }
    return { g: { type: 'GeometryCollection', geometries: members.map((m) => m.g) } };
  };

  const geom = (n: XmlNode): KmlGeom | null => {
    switch (n.local) {
      case 'Point': {
        const c = coordTuples(xChild(n, 'coordinates'), n);
        if (!c.length) {
          w.add('A Point without coordinates was skipped');
          return null;
        }
        return { g: { type: 'Point', coordinates: c[0] as Position } };
      }
      case 'LineString':
      case 'LinearRing': {
        const c = coordTuples(xChild(n, 'coordinates'), n);
        if (c.length < 2) {
          w.add('A line with fewer than 2 coordinates was skipped');
          return null;
        }
        return { g: { type: 'LineString', coordinates: c } };
      }
      case 'Polygon': {
        const outer = ringOf(xChild(n, 'outerBoundaryIs'), n);
        if (!outer) {
          w.add('A Polygon without an outer boundary was skipped');
          return null;
        }
        const rings = [outer];
        for (const ib of xChildren(n, 'innerBoundaryIs')) {
          const r = ringOf(ib, n);
          if (r) rings.push(r);
        }
        return { g: { type: 'Polygon', coordinates: rings } };
      }
      case 'MultiGeometry': {
        const members: KmlGeom[] = [];
        for (const c of n.children) {
          const m = geom(c);
          if (m) members.push(m);
        }
        return combine(members);
      }
      case 'Track': {
        const whens = xChildren(n, 'when').map((x) => x.text.trim());
        const coords: Position[] = [];
        for (const c of xChildren(n, 'coord')) {
          const t = c.text.trim().split(/\s+/);
          const lon = Number(t[0]);
          const lat = Number(t[1]);
          if (t.length < 2 || !Number.isFinite(lon) || !Number.isFinite(lat)) {
            throw nodeErr(src, c, `<gx:coord> "${c.text.trim()}" is not in "longitude latitude [altitude]" form`);
          }
          const prob = coordProblem(lon, lat);
          if (prob) throw nodeErr(src, c, `<gx:coord> "${c.text.trim()}": ${prob}`);
          coords.push(mkPos(lon, lat, t.length > 2 && t[2] !== '' ? Number(t[2]) : undefined));
        }
        if (coords.length < 2) {
          w.add('A gx:Track with fewer than 2 coordinates was skipped');
          return null;
        }
        const res: KmlGeom = { g: { type: 'LineString', coordinates: coords } };
        if (whens.length === coords.length) {
          const ts = whens.map((x) => normalizeTime(x));
          if (ts.some((t) => t !== null)) res.times = ts;
        } else if (whens.length) {
          w.add('A gx:Track has a different number of <when> and <gx:coord> elements; its times were ignored');
        }
        return res;
      }
      case 'MultiTrack': {
        const segs: KmlGeom[] = [];
        for (const t of xChildren(n, 'Track')) {
          const m = geom(t);
          if (m) segs.push(m);
        }
        if (!segs.length) return null;
        const anyTimes = segs.some((s) => s.times !== undefined);
        const g: Geometry = {
          type: 'MultiLineString',
          coordinates: segs.map((s) => (s.g as { coordinates: Position[] }).coordinates),
        };
        if (!anyTimes) return { g };
        return {
          g,
          times: segs.map((s) =>
            Array.isArray(s.times)
              ? s.times
              : new Array<string | null>((s.g as { coordinates: Position[] }).coordinates.length).fill(null)
          ),
        };
      }
      case 'Model':
        w.add('3D Model geometries were ignored');
        return null;
      default:
        return null;
    }
  };

  const placemark = (pm: XmlNode, folders: string[]): Feature => {
    const props: Props = {};
    const name = xText(pm, 'name');
    if (name !== undefined) props.name = name;
    const desc = xText(pm, 'description');
    if (desc !== undefined) props.description = desc;
    if (folders.length) props.folder = folders.join(' / ');
    const ed = xChild(pm, 'ExtendedData');
    if (ed) {
      for (const d of ed.children) {
        if (d.local === 'Data' && d.attrs.name) {
          const v = xText(d, 'value');
          if (v !== undefined && !(d.attrs.name in props)) props[d.attrs.name] = v;
        } else if (d.local === 'SchemaData') {
          for (const sd of xChildren(d, 'SimpleData')) {
            const k = sd.attrs.name;
            const v = sd.text.trim();
            if (k && v !== '' && !(k in props)) props[k] = v;
          }
        }
      }
    }
    const members: KmlGeom[] = [];
    for (const c of pm.children) {
      const m = geom(c);
      if (m) members.push(m);
    }
    const combined = combine(members);
    const feat: Feature = { geometry: combined ? combined.g : null, properties: props };
    if (combined?.times !== undefined) feat.times = combined.times;
    const ts = xChild(pm, 'TimeStamp');
    const tsWhen = xText(ts, 'when');
    if (tsWhen) {
      const t = normalizeTime(tsWhen);
      if (t && feat.geometry?.type === 'Point' && feat.times === undefined) feat.times = t;
      else if (t) props.timestamp = t;
    }
    const span = xChild(pm, 'TimeSpan');
    if (span) {
      const b = normalizeTime(xText(span, 'begin'));
      const e = normalizeTime(xText(span, 'end'));
      if (b) props.begin = b;
      if (e) props.end = e;
    }
    return feat;
  };

  const features: Feature[] = [];
  const walk = (node: XmlNode, folders: string[]): void => {
    for (const c of node.children) {
      switch (c.local) {
        case 'Placemark':
          features.push(placemark(c, folders));
          break;
        case 'Folder':
        case 'Document': {
          const nm = xText(c, 'name');
          const isRootDoc = c.local === 'Document' && node.local === 'kml';
          walk(c, nm && !isRootDoc ? [...folders, nm] : folders);
          break;
        }
        case 'NetworkLink':
          w.add('NetworkLink elements were ignored (no network access)');
          break;
        case 'GroundOverlay':
        case 'ScreenOverlay':
        case 'PhotoOverlay':
          w.add('Image overlays were ignored');
          break;
        default:
          break;
      }
    }
  };
  let docName: string | undefined;
  if (root.local === 'Placemark') {
    features.push(placemark(root, []));
  } else if (root.local === 'kml') {
    walk(root, []);
    const d = xChild(root, 'Document') ?? xChild(root, 'Folder');
    docName = d ? xText(d, 'name') : undefined;
  } else {
    docName = xText(root, 'name');
    walk(root, root.local === 'Folder' && docName ? [docName] : []);
  }
  return { features, name: docName };
}

/* ------------------------------------------------------------------------- */
/* TCX reader (Garmin Training Center)                                        */
/* ------------------------------------------------------------------------- */

export function parseTcx(text: string, w: Warnings = new Warnings()): GeoDoc {
  const { root, src } = parseXml(text);
  if (root.local !== 'TrainingCenterDatabase') {
    throw new GeoError(`Not a TCX file: the root element is <${root.name}>, expected <TrainingCenterDatabase>`);
  }
  let skipped = 0;
  const readTrack = (track: XmlNode): { coords: Position[]; times: (string | null)[] } => {
    const coords: Position[] = [];
    const times: (string | null)[] = [];
    for (const tp of xChildren(track, 'Trackpoint')) {
      const pos = xChild(tp, 'Position');
      const latS = xText(pos, 'LatitudeDegrees');
      const lonS = xText(pos, 'LongitudeDegrees');
      if (latS === undefined || lonS === undefined) {
        skipped++;
        continue;
      }
      const lat = Number(latS);
      const lon = Number(lonS);
      if (!Number.isFinite(lat) || !Number.isFinite(lon))
        throw nodeErr(src, tp, 'Trackpoint has a non-numeric latitude/longitude');
      const prob = coordProblem(lon, lat, 'named');
      if (prob) throw nodeErr(src, tp, prob);
      const altS = xText(tp, 'AltitudeMeters');
      const alt = altS !== undefined ? Number(altS) : undefined;
      coords.push(mkPos(lon, lat, alt !== undefined && Number.isFinite(alt) ? alt : undefined));
      times.push(normalizeTime(xText(tp, 'Time')));
    }
    return { coords, times };
  };
  const build = (tracks: XmlNode[], props: Props): Feature | null => {
    const segs: Position[][] = [];
    const segTimes: (string | null)[][] = [];
    for (const t of tracks) {
      const r = readTrack(t);
      if (r.coords.length >= 2) {
        segs.push(r.coords);
        segTimes.push(r.times);
      }
    }
    if (!segs.length) return null;
    const f: Feature =
      segs.length === 1
        ? { geometry: { type: 'LineString', coordinates: segs[0] as Position[] }, properties: props, gpxKind: 'trk' }
        : { geometry: { type: 'MultiLineString', coordinates: segs }, properties: props, gpxKind: 'trk' };
    if (segTimes.some((ts) => ts.some((t) => t !== null)))
      f.times = segs.length === 1 ? (segTimes[0] as (string | null)[]) : segTimes;
    return f;
  };
  const features: Feature[] = [];
  const acts = xChild(root, 'Activities');
  for (const a of acts ? xChildren(acts, 'Activity') : []) {
    const props: Props = {};
    const id = xText(a, 'Id');
    if (id) props.name = id;
    if (a.attrs.Sport) props.sport = a.attrs.Sport;
    const tracks: XmlNode[] = [];
    for (const lap of xChildren(a, 'Lap')) tracks.push(...xChildren(lap, 'Track'));
    const f = build(tracks, props);
    if (f) features.push(f);
  }
  const courses = xChild(root, 'Courses');
  for (const c of courses ? xChildren(courses, 'Course') : []) {
    const props: Props = {};
    const nm = xText(c, 'Name');
    if (nm) props.name = nm;
    const f = build(xChildren(c, 'Track'), props);
    if (f) features.push(f);
    for (const cp of xChildren(c, 'CoursePoint')) {
      const pos = xChild(cp, 'Position');
      const lat = Number(xText(pos, 'LatitudeDegrees'));
      const lon = Number(xText(pos, 'LongitudeDegrees'));
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || coordProblem(lon, lat)) continue;
      const pp: Props = {};
      const pn = xText(cp, 'Name');
      if (pn) pp.name = pn;
      const notes = xText(cp, 'Notes');
      if (notes) pp.desc = notes;
      const pt = xText(cp, 'PointType');
      if (pt) pp.type = pt;
      const alt = Number(xText(cp, 'AltitudeMeters'));
      const pf: Feature = {
        geometry: {
          type: 'Point',
          coordinates: mkPos(
            lon,
            lat,
            xText(cp, 'AltitudeMeters') !== undefined && Number.isFinite(alt) ? alt : undefined
          ),
        },
        properties: pp,
      };
      const tm = normalizeTime(xText(cp, 'Time'));
      if (tm) pf.times = tm;
      features.push(pf);
    }
  }
  if (skipped) w.add('Trackpoints without a position were skipped');
  if (!features.length) throw new GeoError('No tracks with position data were found in this TCX file');
  return { features };
}

/* ------------------------------------------------------------------------- */
/* CSV reader                                                                 */
/* ------------------------------------------------------------------------- */

const normHeader = (h: string): string => h.toLowerCase().replace(/[^a-z0-9]/g, '');
const LAT_NAMES = new Set([
  'lat',
  'latitude',
  'latdeg',
  'latdd',
  'lats',
  'ycoord',
  'ycoordinate',
  'gpslat',
  'gpslatitude',
  'pointy',
  'latitudedeg',
  'latitudedecimal',
  'ylat',
  'latdec',
  'y',
]);
const LON_NAMES = new Set([
  'lon',
  'lng',
  'long',
  'longitude',
  'londeg',
  'longdeg',
  'lngdeg',
  'londd',
  'longdd',
  'lngdd',
  'lons',
  'xcoord',
  'xcoordinate',
  'gpslon',
  'gpslong',
  'gpslongitude',
  'pointx',
  'longitudedeg',
  'longitudedecimal',
  'xlon',
  'londec',
  'x',
]);
const ELE_NAMES = [
  'ele',
  'elevation',
  'altitude',
  'alt',
  'elev',
  'height',
  'altitudem',
  'elevationm',
  'elevm',
  'gpsalt',
  'z',
];
const TIME_NAMES = [
  'time',
  'timestamp',
  'datetime',
  'datetimeutc',
  'timeutc',
  'gpstime',
  'utc',
  'recordedat',
  'recorded',
  'date',
  'dt',
];
const WKT_NAMES = ['wkt', 'geom', 'geometry', 'thegeom', 'wktgeom', 'shape'];
const GROUP_NAMES = ['feature', 'featureid', 'track', 'trackid', 'trk'];
const SEG_NAMES = ['segment', 'seg', 'trkseg', 'part', 'segmentid'];
const CSV_NAME_NAMES = ['name', 'title', 'label'];

export function detectCsvDelimiter(text: string): string {
  const lines = text.split(/\r?\n/, 8).filter((l) => l.trim() !== '');
  const first = lines[0] ?? '';
  const count = (d: string): number => {
    let n = 0;
    let q = false;
    for (const ch of first) {
      if (ch === '"') q = !q;
      else if (ch === d && !q) n++;
    }
    return n;
  };
  let best = ',';
  let bestN = count(',');
  for (const d of ['\t', ';', '|']) {
    const n = count(d);
    if (n > bestN) {
      best = d;
      bestN = n;
    }
  }
  return best;
}

function findCol(headers: string[], names: string[] | Set<string>, skip: number[] = []): number {
  const list = names instanceof Set ? [...names] : names;
  for (const nm of list) {
    for (let i = 0; i < headers.length; i++) {
      if (!skip.includes(i) && normHeader(headers[i] as string) === nm) return i;
    }
  }
  return -1;
}

function parseCsvNum(s: string | undefined, decimalComma: boolean): number {
  if (s === undefined) return NaN;
  let t = s.trim();
  if (t === '') return NaN;
  if (decimalComma) t = t.replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) return NaN;
  return Number(t);
}

function coerceCell(s: string): unknown {
  const t = s.trim();
  if (/^-?(0|[1-9]\d{0,14})(\.\d+)?$/.test(t)) return Number(t);
  return s;
}

export interface CsvInfo {
  headers: string[];
  latColumn: string | null;
  lonColumn: string | null;
  mode: 'points' | 'line' | 'wkt';
  delimiter: string;
  headerless: boolean;
}

export function csvHeadersOf(text: string): string[] {
  const delim = detectCsvDelimiter(text);
  const firstLine =
    text
      .replace(/^﻿/, '')
      .split(/\r?\n/)
      .find((l) => l.trim() !== '') ?? '';
  return (parseCsv(firstLine, delim)[0] ?? []).map((h) => h.trim());
}

export interface ParseOptions {
  csvLat?: string;
  csvLon?: string;
  csvAs?: 'auto' | 'points' | 'line';
  polylinePrecision?: 5 | 6;
}

export function parseCsvGeo(text: string, opts: ParseOptions, w: Warnings): { doc: GeoDoc; info: CsvInfo } {
  const clean = text.replace(/^﻿/, '');
  const delim = detectCsvDelimiter(clean);
  const decimalComma = delim !== ',';
  const rows = parseCsv(clean, delim).filter((r) => r.some((c) => c.trim() !== ''));
  if (rows.length === 0) throw new GeoError('The CSV is empty');
  let headers = (rows[0] as string[]).map((h) => h.trim());
  let dataRows = rows.slice(1);
  let latIdx = -1;
  let lonIdx = -1;
  let headerless = false;
  if (opts.csvLat && opts.csvLon) {
    latIdx = headers.indexOf(opts.csvLat);
    lonIdx = headers.indexOf(opts.csvLon);
  }
  if (latIdx < 0 || lonIdx < 0) {
    latIdx = findCol(headers, LAT_NAMES);
    lonIdx = findCol(headers, LON_NAMES);
    // `x`/`y` are only trusted when explicit lat/lon names are absent (handled by set order) and both exist
    if (latIdx >= 0 && lonIdx >= 0 && latIdx === lonIdx) lonIdx = -1;
  }
  const wktIdx = latIdx < 0 || lonIdx < 0 ? findCol(headers, WKT_NAMES) : -1;
  if ((latIdx < 0 || lonIdx < 0) && wktIdx < 0) {
    const r0 = rows[0] as string[];
    if (
      r0.length >= 2 &&
      Number.isFinite(parseCsvNum(r0[0], decimalComma)) &&
      Number.isFinite(parseCsvNum(r0[1], decimalComma))
    ) {
      headerless = true;
      headers = r0.map((_, i) => `column${i + 1}`);
      dataRows = rows;
      let swapped = false;
      for (const r of rows) {
        const a = parseCsvNum(r[0], decimalComma);
        const b = parseCsvNum(r[1], decimalComma);
        if (Math.abs(a) > 90 && Math.abs(b) <= 90) swapped = true;
      }
      latIdx = swapped ? 1 : 0;
      lonIdx = swapped ? 0 : 1;
      w.add(
        swapped
          ? 'No header row: columns were read as longitude, latitude'
          : 'No header row: columns were read as latitude, longitude'
      );
    } else {
      throw new GeoError(
        `Could not find latitude/longitude columns. Found columns: ${headers
          .slice(0, 12)
          .map((h) => `"${h}"`)
          .join(', ')}. ` +
          'Use headers such as lat/latitude/y and lon/lng/long/longitude/x, a WKT/geometry column, or choose the columns manually.'
      );
    }
  }
  const eleIdx = findCol(headers, ELE_NAMES, [latIdx, lonIdx]);
  const timeIdx = findCol(headers, TIME_NAMES, [latIdx, lonIdx, eleIdx]);
  const groupIdx = findCol(headers, GROUP_NAMES, [latIdx, lonIdx]);
  const segIdx = findCol(headers, SEG_NAMES, [latIdx, lonIdx, groupIdx]);
  const typeIdx = findCol(headers, ['type', 'geometrytype'], [latIdx, lonIdx]);
  const nameIdx = findCol(headers, CSV_NAME_NAMES, [latIdx, lonIdx]);

  let mode: 'points' | 'line' | 'wkt' = 'points';
  if (wktIdx >= 0) mode = 'wkt';
  else {
    const asOpt = opts.csvAs ?? 'auto';
    if (asOpt === 'line') mode = 'line';
    else if (asOpt === 'auto') {
      if (groupIdx >= 0 && (segIdx >= 0 || timeIdx >= 0)) mode = 'line';
      else if (timeIdx >= 0 && nameIdx < 0 && dataRows.length >= 3) {
        const nh = normHeader(headers[timeIdx] as string);
        if (nh !== 'date' && nh !== 'dt') {
          // a GPS log: parseable timestamps that never go backwards
          let prev = -Infinity;
          let ok = 0;
          let mono = true;
          for (const r of dataRows) {
            const t = normalizeTime(r[timeIdx]);
            if (!t) continue;
            const ms = Date.parse(t);
            if (ms < prev) {
              mono = false;
              break;
            }
            prev = ms;
            ok++;
          }
          if (mono && ok >= 3) mode = 'line';
        }
      }
    }
  }
  const consumed = new Set<number>([latIdx, lonIdx, eleIdx, timeIdx, wktIdx].filter((i) => i >= 0));
  if (mode === 'line') for (const i of [groupIdx, segIdx, typeIdx]) if (i >= 0) consumed.add(i);
  const propCols: number[] = [];
  headers.forEach((_, i) => {
    if (!consumed.has(i) && (headers[i] as string) !== '') propCols.push(i);
  });
  const info: CsvInfo = {
    headers,
    latColumn: latIdx >= 0 ? (headers[latIdx] as string) : null,
    lonColumn: lonIdx >= 0 ? (headers[lonIdx] as string) : null,
    mode,
    delimiter: delim,
    headerless,
  };

  const rowProps = (r: string[]): Props => {
    const p: Props = {};
    for (const i of propCols) {
      const cell = r[i];
      if (cell === undefined || cell.trim() === '') continue;
      p[headers[i] as string] = coerceCell(cell);
    }
    return p;
  };
  let badTime = 0;
  let badEle = 0;
  let emptyRows = 0;
  const rowNo = (idx: number): number => idx + (headerless ? 1 : 2);

  const readLatLon = (r: string[], idx: number): { lon: number; lat: number } | null => {
    const latS = r[latIdx];
    const lonS = r[lonIdx];
    if ((latS ?? '').trim() === '' || (lonS ?? '').trim() === '') {
      emptyRows++;
      return null;
    }
    const lat = parseCsvNum(latS, decimalComma);
    const lon = parseCsvNum(lonS, decimalComma);
    if (!Number.isFinite(lat)) throw new GeoError(`Row ${rowNo(idx)}: latitude "${latS}" is not a number`, rowNo(idx));
    if (!Number.isFinite(lon)) throw new GeoError(`Row ${rowNo(idx)}: longitude "${lonS}" is not a number`, rowNo(idx));
    const prob = coordProblem(lon, lat, 'named');
    if (prob) throw new GeoError(`Row ${rowNo(idx)}: ${prob}`, rowNo(idx));
    return { lon, lat };
  };
  const readEleTime = (r: string[]): { z?: number; t: string | null } => {
    let z: number | undefined;
    if (eleIdx >= 0 && (r[eleIdx] ?? '').trim() !== '') {
      const e = parseCsvNum(r[eleIdx], decimalComma);
      if (Number.isFinite(e)) z = e;
      else badEle++;
    }
    let t: string | null = null;
    if (timeIdx >= 0 && (r[timeIdx] ?? '').trim() !== '') {
      t = normalizeTime(r[timeIdx]);
      if (!t) badTime++;
    }
    return { z, t };
  };

  const features: Feature[] = [];
  if (mode === 'wkt') {
    dataRows.forEach((r, idx) => {
      const cell = (r[wktIdx] ?? '').trim();
      if (!cell) return;
      let g: Geometry | null;
      try {
        const p = new WktParser(cell, w);
        g = p.geometry();
        if (!p.atEnd()) throw new GeoError('unexpected text after the geometry');
        p.finishNotes();
      } catch (e) {
        throw new GeoError(`Row ${rowNo(idx)}: ${e instanceof Error ? e.message : String(e)}`, rowNo(idx));
      }
      features.push({ geometry: g, properties: rowProps(r) });
    });
  } else if (mode === 'points') {
    dataRows.forEach((r, idx) => {
      const ll = readLatLon(r, idx);
      if (!ll) return;
      const { z, t } = readEleTime(r);
      const f: Feature = {
        geometry: { type: 'Point', coordinates: mkPos(ll.lon, ll.lat, z) },
        properties: rowProps(r),
      };
      if (t) f.times = t;
      features.push(f);
    });
  } else {
    interface Grp {
      key: string;
      type: string;
      first: string[];
      segs: { coords: Position[]; times: (string | null)[]; key: string }[];
    }
    const groups = new Map<string, Grp>();
    dataRows.forEach((r, idx) => {
      const ll = readLatLon(r, idx);
      if (!ll) return;
      const { z, t } = readEleTime(r);
      const key = groupIdx >= 0 ? (r[groupIdx] ?? '').trim() : '';
      let g = groups.get(key);
      if (!g) {
        g = { key, type: typeIdx >= 0 ? (r[typeIdx] ?? '').trim() : '', first: r, segs: [] };
        groups.set(key, g);
      }
      const sk = segIdx >= 0 ? (r[segIdx] ?? '').trim() : '';
      let seg = g.segs[g.segs.length - 1];
      if (!seg || seg.key !== sk) {
        seg = { coords: [], times: [], key: sk };
        g.segs.push(seg);
      }
      seg.coords.push(mkPos(ll.lon, ll.lat, z));
      seg.times.push(t);
    });
    for (const g of groups.values()) {
      const props = rowProps(g.first);
      if (groupIdx >= 0 && g.key !== '' && !('name' in props) && !/^\d+$/.test(g.key)) props.name = g.key;
      const segs = g.segs.filter((s) => s.coords.length >= 2 || g.type === 'Point' || g.type === 'MultiPoint');
      const anyTime = (s: { times: (string | null)[] }[]): boolean => s.some((x) => x.times.some((t) => t !== null));
      if (g.type === 'Point' || g.type === 'MultiPoint') {
        const coords = g.segs.flatMap((s) => s.coords);
        const times = g.segs.flatMap((s) => s.times);
        if (!coords.length) continue;
        if (g.type === 'Point' || coords.length === 1) {
          const f: Feature = { geometry: { type: 'Point', coordinates: coords[0] as Position }, properties: props };
          if (times[0]) f.times = times[0];
          features.push(f);
        } else {
          const f: Feature = { geometry: { type: 'MultiPoint', coordinates: coords }, properties: props };
          if (times.some((t) => t !== null)) f.times = times;
          features.push(f);
        }
        continue;
      }
      if (!segs.length) {
        w.add('A group of CSV rows had fewer than 2 points and was skipped');
        continue;
      }
      if (g.type === 'Polygon') {
        features.push({
          geometry: { type: 'Polygon', coordinates: segs.map((s) => fixRing(s.coords, 'CSV polygon ring', w)) },
          properties: props,
        });
        continue;
      }
      const f: Feature =
        segs.length === 1
          ? {
              geometry: { type: 'LineString', coordinates: (segs[0] as { coords: Position[] }).coords },
              properties: props,
            }
          : { geometry: { type: 'MultiLineString', coordinates: segs.map((s) => s.coords) }, properties: props };
      if (anyTime(segs))
        f.times = segs.length === 1 ? (segs[0] as { times: (string | null)[] }).times : segs.map((s) => s.times);
      features.push(f);
    }
  }
  if (emptyRows) w.add('Rows with empty coordinates were skipped');
  if (badTime) w.add('Some time values could not be parsed and were ignored');
  if (badEle) w.add('Some elevation values are not numbers and were ignored');
  if (!features.length) throw new GeoError('The CSV contains no rows with usable coordinates');
  return { doc: { features }, info };
}

/* ------------------------------------------------------------------------- */
/* Input decoding, detection and the parse entry point                        */
/* ------------------------------------------------------------------------- */

function decodeBytes(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe)
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff)
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 200));
  const m = /<\?xml[^>]*encoding\s*=\s*["']([A-Za-z0-9._-]+)["']/.exec(head);
  if (m && !/^utf-?8$/i.test(m[1] as string)) {
    try {
      return new TextDecoder((m[1] as string).toLowerCase()).decode(bytes);
    } catch {
      /* unknown label: fall back to UTF-8 */
    }
  }
  return new TextDecoder('utf-8').decode(bytes);
}

/** Turns an uploaded file's bytes into text; KMZ/ZIP archives are unpacked to their KML. */
export function decodeInput(bytes: Uint8Array): { text: string; note?: string } {
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 3 || bytes[2] === 5)) {
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(bytes, {
        filter: (f) => /\.kml$/i.test(f.name) && f.originalSize < 400_000_000,
      });
    } catch (e) {
      throw new GeoError(`Could not read this KMZ/ZIP archive: ${e instanceof Error ? e.message : String(e)}`);
    }
    const names = Object.keys(entries);
    if (!names.length)
      throw new GeoError('This archive does not contain a .kml file (a KMZ must hold doc.kml or another .kml)');
    const pick =
      names.find((n) => n.toLowerCase() === 'doc.kml') ??
      names.find((n) => !n.includes('/') && n.toLowerCase().endsWith('.kml')) ??
      (names[0] as string);
    return { text: decodeBytes(entries[pick] as Uint8Array), note: `Unpacked ${pick} from the KMZ archive` };
  }
  return { text: decodeBytes(bytes) };
}

export function writeKmz(kml: string): Uint8Array {
  return zipSync({ 'doc.kml': [strToU8(kml), { level: 6 }] });
}

function sniffCsv(t: string): boolean {
  const first = t.split(/\r?\n/, 1)[0] ?? '';
  if (!/[,;\t|]/.test(first)) return /^(?:\s*)(?:wkt|geom|geometry|the_geom)\s*$/i.test(first);
  const delim = detectCsvDelimiter(t);
  const cells = (parseCsv(first, delim)[0] ?? []).map((c) => c.trim());
  if (findCol(cells, LAT_NAMES) >= 0 && findCol(cells, LON_NAMES) >= 0) return true;
  if (findCol(cells, WKT_NAMES) >= 0) return true;
  const dc = delim !== ',';
  return cells.length >= 2 && Number.isFinite(parseCsvNum(cells[0], dc)) && Number.isFinite(parseCsvNum(cells[1], dc));
}

export function detectFormat(text: string): InFormatId | null {
  const t = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).trimStart();
  if (!t) return null;
  const c = t.charAt(0);
  if (c === '{' || c === '[') {
    return /"type"\s*:\s*"Topology"/.test(t.slice(0, 20000)) ? 'topojson' : 'geojson';
  }
  if (c === '<') {
    const head = t.slice(0, 20000);
    const m = /<([A-Za-z_][\w.-]*:)?([A-Za-z_][\w.-]*)(?=[\s/>])/.exec(
      head
        .replace(/<\?[\s\S]*?\?>/g, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    );
    const root = m ? (m[2] as string) : '';
    if (root === 'gpx') return 'gpx';
    if (root === 'kml' || root === 'Document' || root === 'Folder' || root === 'Placemark') return 'kml';
    if (root === 'TrainingCenterDatabase') return 'tcx';
    if (/<gpx[\s>]/.test(head)) return 'gpx';
    if (/<kml[\s>]/.test(head)) return 'kml';
    return null;
  }
  if (WKT_START_RE.test(t)) return 'wkt';
  if (sniffCsv(t)) return 'csv';
  const lines = t
    .split(/\r?\n/)
    .map((l) => cleanPolylineLine(l))
    .filter((l) => l !== '');
  if (lines.length > 0 && lines.length <= 5000 && lines.every(looksLikePolylineToken)) {
    for (const prec of [5, 6] as const) {
      try {
        decodePolyline(lines[0] as string, prec);
        return 'polyline';
      } catch {
        /* try the next precision */
      }
    }
  }
  // Last resort: a delimited table with a header and at least one row. The CSV reader then
  // explains which columns it needs, and the UI lets the user pick latitude/longitude columns.
  const rows = t.split(/\r?\n/, 3).filter((l) => l.trim() !== '');
  if (rows.length >= 2 && /[,;\t|]/.test(rows[0] as string)) return 'csv';
  return null;
}

export interface ParsedGeo {
  doc: GeoDoc;
  format: InFormatId;
  warnings: string[];
  csv?: CsvInfo;
}

export const MAX_INPUT_CHARS = 120_000_000;

export function parseGeo(text: string, format: InFormatId | 'auto' = 'auto', opts: ParseOptions = {}): ParsedGeo {
  if (!text.trim()) throw new GeoError('Paste some data or drop a file to start.');
  if (text.length > MAX_INPUT_CHARS)
    throw new GeoError('This input is too large to process in the browser (limit about 120 MB).');
  const w = new Warnings();
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  let fmt: InFormatId;
  if (format === 'auto') {
    const d = detectFormat(body);
    if (!d) {
      throw new GeoError(
        'Could not detect the format. Expected GPX, KML, GeoJSON/TopoJSON, CSV with latitude/longitude columns, WKT, TCX or an encoded polyline. Pick the input format manually if needed.'
      );
    }
    fmt = d;
  } else {
    fmt = format;
  }
  let doc: GeoDoc;
  let csv: CsvInfo | undefined;
  switch (fmt) {
    case 'geojson':
      doc = parseGeoJson(body, w);
      break;
    case 'topojson':
      doc = parseTopoJson(body, w);
      break;
    case 'gpx':
      doc = parseGpx(body, w);
      break;
    case 'kml':
      doc = parseKml(body, w);
      break;
    case 'tcx':
      doc = parseTcx(body, w);
      break;
    case 'wkt':
      doc = parseWkt(body, w);
      break;
    case 'polyline':
      doc = parsePolyline(body, opts.polylinePrecision ?? 5);
      break;
    case 'csv': {
      const r = parseCsvGeo(body, opts, w);
      doc = r.doc;
      csv = r.info;
      break;
    }
  }
  const noGeom = doc.features.filter((f) => !f.geometry).length;
  if (noGeom) w.add(`${noGeom} feature(s) without geometry (they appear only in GeoJSON output)`);
  return { doc, format: fmt, warnings: w.list(), csv };
}

/* ------------------------------------------------------------------------- */
/* Simplification (Ramer-Douglas-Peucker in a local equirectangular plane)    */
/* ------------------------------------------------------------------------- */

/** Indices of vertices kept by RDP with the given tolerance in metres. Endpoints are always kept. */
export function rdpKeepIndices(coords: Position[], tolM: number): number[] {
  const n = coords.length;
  if (n <= 2 || !(tolM > 0)) return coords.map((_, i) => i);
  let lat0 = 0;
  let lon0 = 0;
  for (const p of coords) {
    lat0 += p[1];
    lon0 += p[0];
  }
  lat0 /= n;
  lon0 /= n;
  const kx = RAD * EARTH_RADIUS_M * Math.cos(lat0 * RAD);
  const ky = RAD * EARTH_RADIUS_M;
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const p = coords[i] as Position;
    xs[i] = (p[0] - lon0) * kx;
    ys[i] = (p[1] - lat0) * ky;
  }
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const tol2 = tolM * tolM;
  const stack: number[] = [0, n - 1];
  while (stack.length) {
    const hi = stack.pop() as number;
    const lo = stack.pop() as number;
    if (hi - lo < 2) continue;
    const ax = xs[lo] as number;
    const ay = ys[lo] as number;
    const dx = (xs[hi] as number) - ax;
    const dy = (ys[hi] as number) - ay;
    const len2 = dx * dx + dy * dy;
    let maxD = -1;
    let idx = -1;
    for (let i = lo + 1; i < hi; i++) {
      const px = (xs[i] as number) - ax;
      const py = (ys[i] as number) - ay;
      let d2: number;
      if (len2 === 0) d2 = px * px + py * py;
      else {
        let t = (px * dx + py * dy) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = px - t * dx;
        const ey = py - t * dy;
        d2 = ex * ex + ey * ey;
      }
      if (d2 > maxD) {
        maxD = d2;
        idx = i;
      }
    }
    if (maxD > tol2 && idx > 0) {
      keep[idx] = 1;
      stack.push(lo, idx, idx, hi);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(i);
  return out;
}

/* ------------------------------------------------------------------------- */
/* Transforms                                                                 */
/* ------------------------------------------------------------------------- */

export interface TransformOptions {
  lines: 'keep' | 'merge' | 'split';
  /** RDP tolerance in metres; 0 disables. */
  simplifyMeters: number;
  /** Decimal places for longitude/latitude; null keeps full precision. */
  precision: number | null;
  reverse: boolean;
  stripTime: boolean;
  stripElevation: boolean;
}

export const DEFAULT_TRANSFORM: TransformOptions = {
  lines: 'keep',
  simplifyMeters: 0,
  precision: null,
  reverse: false,
  stripTime: false,
  stripElevation: false,
};

const TIME_PROP_KEYS = ['time', 'timestamp', 'timeStamp', 'coordTimes', 'begin', 'end'];

function isLineGeom(g: Geometry | null): g is Extract<Geometry, { type: 'LineString' | 'MultiLineString' }> {
  return !!g && (g.type === 'LineString' || g.type === 'MultiLineString');
}

interface LinePart {
  coords: Position[];
  times: (string | null)[] | undefined;
}

function lineParts(f: Feature): LinePart[] {
  const g = f.geometry;
  if (!isLineGeom(g)) return [];
  const t = alignedTimes(f);
  if (g.type === 'LineString')
    return [{ coords: g.coordinates, times: Array.isArray(t) ? (t as (string | null)[]) : undefined }];
  return g.coordinates.map((c, i) => ({
    coords: c,
    times: Array.isArray(t) && Array.isArray(t[i]) ? (t[i] as (string | null)[]) : undefined,
  }));
}

function fromParts(f: Feature, parts: LinePart[]): Feature {
  const anyTimes = parts.some((p) => p.times && p.times.some((x) => x !== null));
  const base: Feature = { ...f };
  delete base.times;
  if (parts.length === 1) {
    base.geometry = { type: 'LineString', coordinates: (parts[0] as LinePart).coords };
    if (anyTimes) base.times = (parts[0] as LinePart).times;
  } else {
    base.geometry = { type: 'MultiLineString', coordinates: parts.map((p) => p.coords) };
    if (anyTimes) base.times = parts.map((p) => p.times ?? new Array<string | null>(p.coords.length).fill(null));
  }
  return base;
}

function simplifyRing(ring: Position[], tol: number): Position[] {
  const idx = rdpKeepIndices(ring, tol);
  if (idx.length < 4) return ring;
  return idx.map((i) => ring[i] as Position);
}

function simplifyGeometryNoTimes(g: Geometry, tol: number): Geometry {
  switch (g.type) {
    case 'LineString':
      return {
        type: 'LineString',
        coordinates: rdpKeepIndices(g.coordinates, tol).map((i) => g.coordinates[i] as Position),
      };
    case 'MultiLineString':
      return {
        type: 'MultiLineString',
        coordinates: g.coordinates.map((c) => rdpKeepIndices(c, tol).map((i) => c[i] as Position)),
      };
    case 'Polygon':
      return { type: 'Polygon', coordinates: g.coordinates.map((r) => simplifyRing(r, tol)) };
    case 'MultiPolygon':
      return { type: 'MultiPolygon', coordinates: g.coordinates.map((poly) => poly.map((r) => simplifyRing(r, tol))) };
    case 'GeometryCollection':
      return { type: 'GeometryCollection', geometries: g.geometries.map((m) => simplifyGeometryNoTimes(m, tol)) };
    default:
      return g;
  }
}

function dropZ(p: Position): Position {
  return p.length === 3 ? [p[0], p[1]] : p;
}

function stripProps(props: Props): Props {
  const out: Props = { ...props };
  for (const k of TIME_PROP_KEYS) delete out[k];
  if (isObj(out.coordinateProperties)) {
    const cp = { ...(out.coordinateProperties as Record<string, unknown>) };
    delete cp.times;
    if (Object.keys(cp).length) out.coordinateProperties = cp;
    else delete out.coordinateProperties;
  }
  return out;
}

function reversedFeature(f: Feature): Feature {
  const g = f.geometry;
  if (!isLineGeom(g)) return f;
  const parts = lineParts(f);
  const flat: (string | null)[] = [];
  flattenTimes(alignedTimes(f), flat);
  const newCoords = parts.map((p) => [...p.coords].reverse()).reverse();
  let cursor = 0;
  const newParts: LinePart[] = newCoords.map((coords) => {
    let times: (string | null)[] | undefined;
    if (flat.length) {
      times = flat.slice(cursor, cursor + coords.length);
      cursor += coords.length;
    }
    return { coords, times };
  });
  return fromParts(f, newParts);
}

function mergeLines(features: Feature[]): Feature[] {
  const idxs: number[] = [];
  features.forEach((f, i) => {
    if (isLineGeom(f.geometry)) idxs.push(i);
  });
  if (!idxs.length) return features;
  const first = features[idxs[0] as number] as Feature;
  if (idxs.length === 1 && first.geometry?.type === 'LineString') return features;
  const coords: Position[] = [];
  const times: (string | null)[] = [];
  const names = new Set<string>();
  for (const i of idxs) {
    const f = features[i] as Feature;
    const n = featureName(f);
    if (n) names.add(n);
    for (const p of lineParts(f)) {
      for (let k = 0; k < p.coords.length; k++) {
        coords.push(p.coords[k] as Position);
        times.push(p.times ? (p.times[k] ?? null) : null);
      }
    }
  }
  const props: Props = { ...first.properties };
  if (names.size > 1) props.name = 'Merged track';
  const merged: Feature = { geometry: { type: 'LineString', coordinates: coords }, properties: props };
  if (first.gpxKind) merged.gpxKind = first.gpxKind;
  if (times.some((t) => t !== null)) merged.times = times;
  const out: Feature[] = [];
  const idxSet = new Set(idxs);
  features.forEach((f, i) => {
    if (i === idxs[0]) out.push(merged);
    else if (!idxSet.has(i)) out.push(f);
  });
  return out;
}

function splitLines(features: Feature[]): Feature[] {
  const out: Feature[] = [];
  for (const f of features) {
    if (f.geometry?.type !== 'MultiLineString') {
      out.push(f);
      continue;
    }
    const parts = lineParts(f);
    const name = featureName(f);
    parts.forEach((p, i) => {
      const nf = fromParts({ ...f, properties: { ...f.properties } }, [p]);
      delete nf.id;
      if (name) nf.properties.name = `${name} (${i + 1})`;
      out.push(nf);
    });
  }
  return out;
}

export function transformDoc(doc: GeoDoc, o: TransformOptions): { doc: GeoDoc; warnings: string[] } {
  const w = new Warnings();
  let features: Feature[] = doc.features.map((f) => ({ ...f, properties: { ...f.properties } }));
  const anyLine = features.some((f) => isLineGeom(f.geometry));

  if (o.stripTime) {
    features = features.map((f) => {
      const nf: Feature = { ...f, properties: stripProps(f.properties) };
      delete nf.times;
      return nf;
    });
  }
  if (o.stripElevation) {
    features = features.map((f) => (f.geometry ? { ...f, geometry: mapPositions(f.geometry, dropZ) } : f));
  }
  if (o.reverse) {
    if (!anyLine) w.add('Reverse direction had no effect: there are no line geometries');
    features = features.map(reversedFeature);
  }
  if (o.lines === 'merge') features = mergeLines(features);
  else if (o.lines === 'split') features = splitLines(features);

  if (o.simplifyMeters > 0) {
    let hasShape = false;
    features = features.map((f) => {
      const g = f.geometry;
      if (!g) return f;
      if (isLineGeom(g)) {
        hasShape = true;
        const parts = lineParts(f).map((p) => {
          const keep = rdpKeepIndices(p.coords, o.simplifyMeters);
          return {
            coords: keep.map((i) => p.coords[i] as Position),
            times: p.times ? keep.map((i) => (p.times as (string | null)[])[i] ?? null) : undefined,
          };
        });
        return fromParts(f, parts);
      }
      if (g.type === 'Polygon' || g.type === 'MultiPolygon' || g.type === 'GeometryCollection') {
        hasShape = true;
        return { ...f, geometry: simplifyGeometryNoTimes(g, o.simplifyMeters) };
      }
      return f;
    });
    if (!hasShape) w.add('Simplify had no effect: there are no lines or polygons');
  }

  if (o.precision !== null && o.precision >= 0) {
    const d = o.precision;
    features = features.map((f) =>
      f.geometry
        ? {
            ...f,
            geometry: mapPositions(f.geometry, (p) => {
              const lon = roundTo(p[0], d);
              const lat = roundTo(p[1], d);
              return p.length === 3 ? [lon, lat, roundTo(p[2], Math.min(d, 2))] : [lon, lat];
            }),
          }
        : f
    );
  }
  return { doc: { features, name: doc.name }, warnings: w.list() };
}

/* ------------------------------------------------------------------------- */
/* Statistics                                                                 */
/* ------------------------------------------------------------------------- */

export interface GeoStats {
  featureCount: number;
  noGeometry: number;
  byType: Record<string, number>;
  vertexCount: number;
  bbox: [number, number, number, number] | null;
  lineCount: number;
  lengthM: number;
  hasElevation: boolean;
  eleMin: number | null;
  eleMax: number | null;
  gainM: number;
  lossM: number;
  hasTime: boolean;
  startTime: string | null;
  endTime: string | null;
  durationSec: number;
  movingSec: number;
  stoppedSec: number;
  movingDistM: number;
  avgSpeedMs: number | null;
  avgMovingSpeedMs: number | null;
  maxSpeedMs: number | null;
}

/**
 * Elevation gain/loss with hysteresis: a change only counts once the elevation has moved
 * by at least `thresholdM` from the last counted reference. threshold 0 sums every change.
 */
export function elevationGainLoss(eles: number[], thresholdM: number): { gain: number; loss: number } {
  let gain = 0;
  let loss = 0;
  if (eles.length < 2) return { gain, loss };
  let ref = eles[0] as number;
  for (let i = 1; i < eles.length; i++) {
    const e = eles[i] as number;
    const d = e - ref;
    if (thresholdM <= 0) {
      if (d > 0) gain += d;
      else if (d < 0) loss -= d;
      ref = e;
    } else if (d >= thresholdM) {
      gain += d;
      ref = e;
    } else if (d <= -thresholdM) {
      loss -= d;
      ref = e;
    }
  }
  return { gain, loss };
}

export function computeStats(doc: GeoDoc, o: { eleThresholdM?: number; stoppedKmh?: number } = {}): GeoStats {
  const eleT = o.eleThresholdM ?? 0;
  const stopped = o.stoppedKmh ?? 1;
  const byType: Record<string, number> = {};
  let noGeometry = 0;
  let vertexCount = 0;
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  let lineCount = 0;
  let lengthM = 0;
  let eleMin = Infinity;
  let eleMax = -Infinity;
  let anyZ = false;
  let gain = 0;
  let loss = 0;
  let durationSec = 0;
  let movingSec = 0;
  let stoppedSec = 0;
  let movingDist = 0;
  let timedLength = 0;
  let maxSpeed = 0;
  let tMin = Infinity;
  let tMax = -Infinity;
  let lineTMin = Infinity;
  let lineTMax = -Infinity;

  for (const f of doc.features) {
    if (!f.geometry) {
      noGeometry++;
      continue;
    }
    byType[f.geometry.type] = (byType[f.geometry.type] ?? 0) + 1;
    forEachPosition(f.geometry, (p) => {
      vertexCount++;
      if (p[0] < minLon) minLon = p[0];
      if (p[0] > maxLon) maxLon = p[0];
      if (p[1] < minLat) minLat = p[1];
      if (p[1] > maxLat) maxLat = p[1];
      if (p.length === 3) {
        anyZ = true;
        if (p[2] < eleMin) eleMin = p[2];
        if (p[2] > eleMax) eleMax = p[2];
      }
    });
    const tt = alignedTimes(f);
    if (tt !== undefined) {
      const flat: (string | null)[] = [];
      flattenTimes(tt, flat);
      for (const t of flat) {
        const ms = timeMs(t);
        if (ms !== null) {
          if (ms < tMin) tMin = ms;
          if (ms > tMax) tMax = ms;
        }
      }
    }
    // lines nested in a GeometryCollection count for length/elevation but not time
    const parts: LinePart[] =
      f.geometry.type === 'GeometryCollection'
        ? f.geometry.geometries.flatMap((m) =>
            m.type === 'LineString'
              ? [{ coords: m.coordinates, times: undefined }]
              : m.type === 'MultiLineString'
                ? m.coordinates.map((c) => ({ coords: c, times: undefined }))
                : []
          )
        : lineParts(f);
    for (const p of parts) {
      lineCount++;
      const len = lineLengthM(p.coords);
      lengthM += len;
      const eles: number[] = [];
      for (const c of p.coords) if (c.length === 3) eles.push(c[2]);
      if (eles.length > 1) {
        const gl = elevationGainLoss(eles, eleT);
        gain += gl.gain;
        loss += gl.loss;
      }
      if (p.times) {
        let first = -1;
        let last = -1;
        for (let i = 0; i < p.times.length; i++) {
          const ms = timeMs(p.times[i]);
          if (ms === null) continue;
          if (first < 0) first = i;
          last = i;
          if (ms < lineTMin) lineTMin = ms;
          if (ms > lineTMax) lineTMax = ms;
        }
        if (first >= 0 && last > first) {
          const a = timeMs(p.times[first]) as number;
          const b = timeMs(p.times[last]) as number;
          durationSec += Math.abs(b - a) / 1000;
          timedLength += lineLengthM(p.coords.slice(first, last + 1));
          let prevI = -1;
          for (let i = first; i <= last; i++) {
            const ms = timeMs(p.times[i]);
            if (ms === null) continue;
            if (prevI >= 0) {
              const pa = p.coords[prevI] as Position;
              const pb = p.coords[i] as Position;
              const dt = (ms - (timeMs(p.times[prevI]) as number)) / 1000;
              if (dt > 0) {
                const d = haversine(pa[0], pa[1], pb[0], pb[1]);
                const kmh = d / 1000 / (dt / 3600);
                if (kmh > stopped) {
                  movingSec += dt;
                  movingDist += d;
                  if (d / dt > maxSpeed) maxSpeed = d / dt;
                } else {
                  stoppedSec += dt;
                }
              }
            }
            prevI = i;
          }
        }
      }
    }
  }
  const hasLineTime = lineTMin !== Infinity;
  const sMin = hasLineTime ? lineTMin : tMin;
  const sMax = hasLineTime ? lineTMax : tMax;
  const flatZ = anyZ && eleMin === 0 && eleMax === 0;
  return {
    featureCount: doc.features.length,
    noGeometry,
    byType,
    vertexCount,
    bbox: vertexCount ? [minLon, minLat, maxLon, maxLat] : null,
    lineCount,
    lengthM,
    hasElevation: anyZ && !flatZ,
    eleMin: anyZ ? eleMin : null,
    eleMax: anyZ ? eleMax : null,
    gainM: gain,
    lossM: loss,
    hasTime: sMin !== Infinity,
    startTime: sMin !== Infinity ? new Date(sMin).toISOString().replace(/\.000Z$/, 'Z') : null,
    endTime: sMax !== -Infinity ? new Date(sMax).toISOString().replace(/\.000Z$/, 'Z') : null,
    durationSec,
    movingSec,
    stoppedSec,
    movingDistM: movingDist,
    avgSpeedMs: durationSec > 0 ? timedLength / durationSec : null,
    avgMovingSpeedMs: movingSec > 0 ? movingDist / movingSec : null,
    maxSpeedMs: maxSpeed > 0 ? maxSpeed : null,
  };
}

export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec)) return '-';
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

/* ------------------------------------------------------------------------- */
/* Preview (SVG mini-map, Web Mercator, no tiles)                             */
/* ------------------------------------------------------------------------- */

export interface PreviewShape {
  kind: 'point' | 'line' | 'polygon';
  d: string;
  label: string;
  index: number;
}

export interface PreviewModel {
  width: number;
  height: number;
  shapes: PreviewShape[];
  /** Start / end markers of the first line (only when there are few lines). */
  start: { x: number; y: number } | null;
  end: { x: number; y: number } | null;
  scale: { px: number; label: string };
  truncated: boolean;
  drawnFeatures: number;
}

export function mercator(lon: number, lat: number): { x: number; y: number } {
  const la = Math.max(-85.0511287798, Math.min(85.0511287798, lat));
  return { x: lon * RAD, y: Math.log(Math.tan(Math.PI / 4 + (la * RAD) / 2)) };
}

export function niceLength(raw: number): number {
  if (!(raw > 0)) return 1;
  const exp = Math.floor(Math.log10(raw));
  const base = 10 ** exp;
  const frac = raw / base;
  return (frac >= 5 ? 5 : frac >= 2 ? 2 : 1) * base;
}

const PREVIEW_MAX_FEATURES = 4000;
const PREVIEW_MAX_VERTS = 2500;

export function buildPreview(doc: GeoDoc, width = 800, height = 400, pad = 28): PreviewModel | null {
  const feats = doc.features
    .map((f, index) => ({ f, index }))
    .filter((x) => x.f.geometry)
    .slice(0, PREVIEW_MAX_FEATURES);
  const truncated = doc.features.filter((f) => f.geometry).length > feats.length;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const stride = (n: number): number => (n > PREVIEW_MAX_VERTS ? Math.ceil(n / PREVIEW_MAX_VERTS) : 1);
  const sample = (c: Position[]): Position[] => {
    const s = stride(c.length);
    if (s === 1) return c;
    const out: Position[] = [];
    for (let i = 0; i < c.length; i += s) out.push(c[i] as Position);
    const last = c[c.length - 1] as Position;
    if (out[out.length - 1] !== last) out.push(last);
    return out;
  };
  for (const { f } of feats) {
    forEachPosition(f.geometry as Geometry, (p) => {
      const m = mercator(p[0], p[1]);
      if (m.x < minX) minX = m.x;
      if (m.x > maxX) maxX = m.x;
      if (m.y < minY) minY = m.y;
      if (m.y > maxY) maxY = m.y;
    });
  }
  if (!feats.length || minX === Infinity) return null;
  let spanX = maxX - minX;
  let spanY = maxY - minY;
  if (spanX < 1e-9 && spanY < 1e-9) {
    spanX = 0.002;
    spanY = 0.002;
  }
  spanX = Math.max(spanX, 1e-9);
  spanY = Math.max(spanY, 1e-9);
  const s = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const proj = (p: Position): [number, number] => {
    const m = mercator(p[0], p[1]);
    return [width / 2 + (m.x - cx) * s, height / 2 - (m.y - cy) * s];
  };
  const pt = (p: Position): string => {
    const [x, y] = proj(p);
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  };
  const pathOf = (c: Position[], close: boolean): string => {
    const pts = sample(c);
    return `M${pts.map(pt).join('L')}${close ? 'Z' : ''}`;
  };
  const shapes: PreviewShape[] = [];
  const addGeom = (g: Geometry, label: string, index: number): void => {
    switch (g.type) {
      case 'Point':
      case 'MultiPoint': {
        const pts = g.type === 'Point' ? [g.coordinates] : g.coordinates;
        for (const p of pts.length > PREVIEW_MAX_VERTS ? sample(pts) : pts) {
          const [x, y] = proj(p);
          shapes.push({ kind: 'point', d: `${x.toFixed(1)} ${y.toFixed(1)}`, label, index });
        }
        return;
      }
      case 'LineString':
        shapes.push({ kind: 'line', d: pathOf(g.coordinates, false), label, index });
        return;
      case 'MultiLineString':
        shapes.push({ kind: 'line', d: g.coordinates.map((c) => pathOf(c, false)).join(''), label, index });
        return;
      case 'Polygon':
        shapes.push({ kind: 'polygon', d: g.coordinates.map((r) => pathOf(r, true)).join(''), label, index });
        return;
      case 'MultiPolygon':
        shapes.push({
          kind: 'polygon',
          d: g.coordinates.map((poly) => poly.map((r) => pathOf(r, true)).join('')).join(''),
          label,
          index,
        });
        return;
      case 'GeometryCollection':
        for (const m of g.geometries) addGeom(m, label, index);
        return;
    }
  };
  // polygons first (below), then lines, then points
  const order = { polygon: 0, line: 1, point: 2 } as const;
  for (const { f, index } of feats) {
    const g = f.geometry as Geometry;
    addGeom(g, featureName(f) ?? `${g.type} #${index + 1}`, index);
  }
  shapes.sort((a, b) => order[a.kind] - order[b.kind]);
  let start: PreviewModel['start'] = null;
  let end: PreviewModel['end'] = null;
  const lineFeats = feats.filter((x) => isLineGeom(x.f.geometry));
  if (lineFeats.length > 0 && lineFeats.length <= 12) {
    const first = lineFeats[0] as { f: Feature };
    const parts = lineParts(first.f);
    const firstPart = parts[0];
    const lastPart = parts[parts.length - 1];
    if (firstPart && lastPart) {
      const a = proj(firstPart.coords[0] as Position);
      const b = proj(lastPart.coords[lastPart.coords.length - 1] as Position);
      start = { x: a[0], y: a[1] };
      end = { x: b[0], y: b[1] };
    }
  }
  const latC = (2 * Math.atan(Math.exp(cy)) - Math.PI / 2) / RAD;
  const mPerPx = (EARTH_RADIUS_M * Math.cos(latC * RAD)) / s;
  const nice = niceLength(mPerPx * width * 0.2);
  const label = nice >= 1000 ? `${+(nice / 1000).toPrecision(3)} km` : `${+nice.toPrecision(3)} m`;
  return {
    width,
    height,
    shapes,
    start,
    end,
    scale: { px: nice / mPerPx, label },
    truncated,
    drawnFeatures: feats.length,
  };
}

/* ------------------------------------------------------------------------- */
/* Writers                                                                    */
/* ------------------------------------------------------------------------- */

export interface WriteOptions {
  gpxLines: 'auto' | 'tracks' | 'routes';
  /** Indent XML / JSON output. */
  pretty: boolean;
  /** Name for the GPX metadata / KML document; falls back to the source document's name. */
  docName: string;
  /** Write timed lines as gx:Track (keeps timestamps) instead of plain LineString. */
  kmlGxTrack: boolean;
  csvDelimiter: string;
  polylinePrecision: 5 | 6;
}

export const DEFAULT_WRITE: WriteOptions = {
  gpxLines: 'auto',
  pretty: true,
  docName: '',
  kmlGxTrack: true,
  csvDelimiter: ',',
  polylinePrecision: 5,
};

export interface WriteResult {
  text: string;
  warnings: string[];
}

function xmlEsc(s: string, attr = false): string {
  let t = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '');
  t = t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (attr) t = t.replace(/"/g, '&quot;').replace(/\n/g, '&#10;').replace(/\r/g, '&#13;').replace(/\t/g, '&#9;');
  return t;
}

class XmlOut {
  private parts: string[] = [];
  private depth = 0;
  constructor(private pretty: boolean) {}
  private nl(): string {
    return this.pretty ? '\n' + '  '.repeat(this.depth) : '';
  }
  private attrs(a?: Record<string, string>): string {
    if (!a) return '';
    let s = '';
    for (const k of Object.keys(a)) s += ` ${k}="${xmlEsc(a[k] as string, true)}"`;
    return s;
  }
  decl(): void {
    this.parts.push('<?xml version="1.0" encoding="UTF-8"?>');
  }
  open(name: string, a?: Record<string, string>): void {
    this.parts.push(`${this.nl()}<${name}${this.attrs(a)}>`);
    this.depth++;
  }
  close(name: string): void {
    this.depth--;
    this.parts.push(`${this.nl()}</${name}>`);
  }
  leaf(name: string, text: string, a?: Record<string, string>): void {
    this.parts.push(`${this.nl()}<${name}${this.attrs(a)}>${xmlEsc(text)}</${name}>`);
  }
  empty(name: string, a?: Record<string, string>): void {
    this.parts.push(`${this.nl()}<${name}${this.attrs(a)}/>`);
  }
  /** Element holding one item per line when pretty-printing, space separated otherwise. */
  leafLines(name: string, items: string[]): void {
    if (!this.pretty) {
      this.parts.push(`<${name}>${items.join(' ')}</${name}>`);
      return;
    }
    const pad = '  '.repeat(this.depth + 1);
    this.parts.push(`${this.nl()}<${name}>\n${pad}${items.join('\n' + pad)}${this.nl()}</${name}>`);
  }
  toString(): string {
    return this.parts.join('') + (this.pretty ? '\n' : '');
  }
}

function boundsOf(doc: GeoDoc): [number, number, number, number] | null {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const f of doc.features) {
    if (!f.geometry) continue;
    forEachPosition(f.geometry, (p) => {
      if (p[0] < minLon) minLon = p[0];
      if (p[0] > maxLon) maxLon = p[0];
      if (p[1] < minLat) minLat = p[1];
      if (p[1] > maxLat) maxLat = p[1];
    });
  }
  return minLon === Infinity ? null : [minLon, minLat, maxLon, maxLat];
}

/* ---------- GeoJSON ---------- */

function serialize(v: unknown, indent: string, level: number): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    if (v.every((x) => x === null || typeof x !== 'object')) {
      return '[' + v.map((x) => JSON.stringify(x) ?? 'null').join(', ') + ']';
    }
    const pad = indent.repeat(level + 1);
    return '[\n' + v.map((x) => pad + serialize(x, indent, level + 1)).join(',\n') + '\n' + indent.repeat(level) + ']';
  }
  const entries = Object.entries(v as Record<string, unknown>).filter(
    ([, x]) => x !== undefined && typeof x !== 'function'
  );
  if (!entries.length) return '{}';
  const pad = indent.repeat(level + 1);
  return (
    '{\n' +
    entries.map(([k, x]) => `${pad}${JSON.stringify(k)}: ${serialize(x, indent, level + 1)}`).join(',\n') +
    '\n' +
    indent.repeat(level) +
    '}'
  );
}

export function docToGeoJsonObject(doc: GeoDoc): Record<string, unknown> {
  return {
    type: 'FeatureCollection',
    features: doc.features.map((f) => {
      const props: Props = { ...f.properties };
      const t = alignedTimes(f);
      if (t !== undefined) {
        if (f.geometry?.type === 'Point') {
          if (typeof t === 'string') props.time = t;
        } else {
          const flat: (string | null)[] = [];
          flattenTimes(t, flat);
          if (flat.some((x) => x !== null)) props.coordTimes = t;
        }
      }
      const o: Record<string, unknown> = { type: 'Feature' };
      if (f.id !== undefined) o.id = f.id;
      o.properties = props;
      o.geometry = f.geometry;
      return o;
    }),
  };
}

export function writeGeoJson(doc: GeoDoc, pretty: boolean): WriteResult {
  const obj = docToGeoJsonObject(doc);
  return { text: pretty ? serialize(obj, '  ', 0) + '\n' : JSON.stringify(obj), warnings: [] };
}

/* ---------- GPX ---------- */

interface GpxWpt {
  pos: Position;
  time: string | null;
  props: Props;
  name?: string;
}
interface GpxLine {
  segs: { coords: Position[]; times?: (string | null)[] }[];
  props: Props;
  name?: string;
}

function propNumber(props: Props): number | undefined {
  const n = props.number;
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : undefined;
}

function gpxCommon(x: XmlOut, props: Props, name: string | undefined, kind: 'wpt' | 'line'): void {
  if (name) x.leaf('name', name);
  const cmt = pickString(props, ['cmt', 'comment', 'Comment']);
  if (cmt) x.leaf('cmt', cmt);
  const desc = pickString(props, DESC_KEYS);
  if (desc) x.leaf('desc', desc);
  const src = pickString(props, ['src', 'source']);
  if (src) x.leaf('src', src);
  const link = pickString(props, ['link', 'url', 'href']);
  if (link) {
    x.open('link', { href: link });
    const lt = pickString(props, ['linkText']);
    if (lt) x.leaf('text', lt);
    x.close('link');
  }
  if (kind === 'wpt') {
    const sym = pickString(props, ['sym', 'symbol']);
    if (sym) x.leaf('sym', sym);
  } else {
    const num = propNumber(props);
    if (num !== undefined) x.leaf('number', String(num));
  }
  const type = pickString(props, ['type']);
  if (type) x.leaf('type', type);
}

function gpxPoint(x: XmlOut, tag: string, pos: Position, time: string | null, props?: Props, name?: string): void {
  const a = { lat: fmtNum(pos[1]), lon: fmtNum(pos[0]) };
  const z = zOf(pos);
  const hasProps = props !== undefined;
  if (z === undefined && !time && !hasProps) {
    x.empty(tag, a);
    return;
  }
  x.open(tag, a);
  if (z !== undefined) x.leaf('ele', fmtNum(z));
  if (time) x.leaf('time', time);
  if (props) gpxCommon(x, props, name, 'wpt');
  x.close(tag);
}

export function writeGpx(doc: GeoDoc, o: WriteOptions): WriteResult {
  const w = new Warnings();
  const wpts: GpxWpt[] = [];
  const trks: GpxLine[] = [];
  const rtes: GpxLine[] = [];
  let polygons = false;
  let noGeom = 0;

  const emit = (g: Geometry, f: Feature, times: TimeTree | undefined, asRte: boolean): void => {
    const name = featureName(f);
    const line = (segs: GpxLine['segs'], nm: string | undefined): void => {
      (asRte ? rtes : trks).push({ segs, props: f.properties, name: nm });
    };
    const tOf = (t: TimeTree | undefined, i: number): (string | null)[] | undefined => {
      if (!Array.isArray(t)) return undefined;
      const e = t[i];
      return Array.isArray(e) ? (e as (string | null)[]) : undefined;
    };
    switch (g.type) {
      case 'Point':
        wpts.push({ pos: g.coordinates, time: typeof times === 'string' ? times : null, props: f.properties, name });
        return;
      case 'MultiPoint':
        g.coordinates.forEach((p, i) => {
          const t = Array.isArray(times) ? times[i] : null;
          wpts.push({
            pos: p,
            time: typeof t === 'string' ? t : null,
            props: f.properties,
            name: name && g.coordinates.length > 1 ? `${name} (${i + 1})` : name,
          });
        });
        return;
      case 'LineString':
        line([{ coords: g.coordinates, times: Array.isArray(times) ? (times as (string | null)[]) : undefined }], name);
        return;
      case 'MultiLineString':
        if (asRte) {
          g.coordinates.forEach((c, i) =>
            line([{ coords: c, times: tOf(times, i) }], name && g.coordinates.length > 1 ? `${name} (${i + 1})` : name)
          );
        } else {
          line(
            g.coordinates.map((c, i) => ({ coords: c, times: tOf(times, i) })),
            name
          );
        }
        return;
      case 'Polygon':
        polygons = true;
        if (asRte)
          g.coordinates.forEach((r, i) =>
            line([{ coords: r }], name && g.coordinates.length > 1 ? `${name} (ring ${i + 1})` : name)
          );
        else
          line(
            g.coordinates.map((r) => ({ coords: r })),
            name
          );
        return;
      case 'MultiPolygon':
        polygons = true;
        g.coordinates.forEach((poly, pi) => {
          const nm = name && g.coordinates.length > 1 ? `${name} (${pi + 1})` : name;
          if (asRte)
            poly.forEach((r, i) => line([{ coords: r }], nm && poly.length > 1 ? `${nm} (ring ${i + 1})` : nm));
          else
            line(
              poly.map((r) => ({ coords: r })),
              nm
            );
        });
        return;
      case 'GeometryCollection':
        for (const m of g.geometries) emit(m, f, undefined, asRte);
        return;
    }
  };

  for (const f of doc.features) {
    if (!f.geometry) {
      noGeom++;
      continue;
    }
    const asRte = o.gpxLines === 'routes' || (o.gpxLines === 'auto' && f.gpxKind === 'rte');
    emit(f.geometry, f, alignedTimes(f), asRte);
  }
  if (polygons) w.add('GPX has no polygon type: polygon rings are written as closed tracks/routes');
  if (noGeom) w.add('Features without geometry were skipped');

  const x = new XmlOut(o.pretty);
  x.decl();
  x.open('gpx', {
    version: '1.1',
    creator: 'Open Utility Tools (geo-data-converter)',
    xmlns: 'http://www.topografix.com/GPX/1/1',
    'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    'xsi:schemaLocation': 'http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd',
  });
  const docName = o.docName.trim() || doc.name;
  const b = boundsOf(doc);
  if (docName || b) {
    x.open('metadata');
    if (docName) x.leaf('name', docName);
    if (b)
      x.empty('bounds', { minlat: fmtNum(b[1]), minlon: fmtNum(b[0]), maxlat: fmtNum(b[3]), maxlon: fmtNum(b[2]) });
    x.close('metadata');
  }
  for (const p of wpts) gpxPoint(x, 'wpt', p.pos, p.time, p.props, p.name);
  for (const r of rtes) {
    x.open('rte');
    gpxCommon(x, r.props, r.name, 'line');
    const seg = r.segs[0];
    if (seg) seg.coords.forEach((p, i) => gpxPoint(x, 'rtept', p, seg.times?.[i] ?? null));
    x.close('rte');
  }
  for (const t of trks) {
    x.open('trk');
    gpxCommon(x, t.props, t.name, 'line');
    for (const s of t.segs) {
      x.open('trkseg');
      s.coords.forEach((p, i) => gpxPoint(x, 'trkpt', p, s.times?.[i] ?? null));
      x.close('trkseg');
    }
    x.close('trk');
  }
  x.close('gpx');
  if (!wpts.length && !rtes.length && !trks.length) w.add('Nothing to write: the data has no geometry');
  return { text: x.toString(), warnings: w.list() };
}

/* ---------- KML ---------- */

function kmlCoord(p: Position): string {
  return p.length === 3 ? `${fmtNum(p[0])},${fmtNum(p[1])},${fmtNum(p[2])}` : `${fmtNum(p[0])},${fmtNum(p[1])}`;
}

function propText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

export function writeKml(doc: GeoDoc, o: WriteOptions): WriteResult {
  const w = new Warnings();
  const x = new XmlOut(o.pretty);
  const coordsEl = (c: Position[]): void => x.leafLines('coordinates', c.map(kmlCoord));
  const ringEl = (r: Position[]): void => {
    x.open('LinearRing');
    coordsEl(r);
    x.close('LinearRing');
  };
  const polygonEl = (rings: Position[][]): void => {
    x.open('Polygon');
    x.leaf('tessellate', '1');
    const [outer, ...holes] = rings;
    if (outer) {
      x.open('outerBoundaryIs');
      ringEl(outer);
      x.close('outerBoundaryIs');
    }
    for (const h of holes) {
      x.open('innerBoundaryIs');
      ringEl(h);
      x.close('innerBoundaryIs');
    }
    x.close('Polygon');
  };
  const fullTimes = (t: (string | null)[] | undefined, n: number): t is string[] =>
    !!t && t.length === n && t.every((s) => typeof s === 'string');
  const trackEl = (coords: Position[], times: string[]): void => {
    x.open('gx:Track');
    for (const t of times) x.leaf('when', t);
    for (const p of coords) {
      x.leaf(
        'gx:coord',
        p.length === 3 ? `${fmtNum(p[0])} ${fmtNum(p[1])} ${fmtNum(p[2])}` : `${fmtNum(p[0])} ${fmtNum(p[1])}`
      );
    }
    x.close('gx:Track');
  };
  const lineEl = (coords: Position[]): void => {
    x.open('LineString');
    x.leaf('tessellate', '1');
    coordsEl(coords);
    x.close('LineString');
  };
  const timeWarn = 'Line timestamps were not written (enable "gx:Track", and every vertex needs a time)';
  const geomEl = (g: Geometry, times: TimeTree | undefined): void => {
    switch (g.type) {
      case 'Point':
        x.open('Point');
        coordsEl([g.coordinates]);
        x.close('Point');
        return;
      case 'MultiPoint':
        x.open('MultiGeometry');
        for (const p of g.coordinates) geomEl({ type: 'Point', coordinates: p }, undefined);
        x.close('MultiGeometry');
        return;
      case 'LineString': {
        const t = Array.isArray(times) ? (times as (string | null)[]) : undefined;
        if (o.kmlGxTrack && fullTimes(t, g.coordinates.length)) trackEl(g.coordinates, t);
        else {
          if (t && t.some((s) => s !== null)) w.add(timeWarn);
          lineEl(g.coordinates);
        }
        return;
      }
      case 'MultiLineString': {
        const parts = g.coordinates.map((_, i) => {
          const e = Array.isArray(times) ? times[i] : undefined;
          return Array.isArray(e) ? (e as (string | null)[]) : undefined;
        });
        if (o.kmlGxTrack && g.coordinates.every((c, i) => fullTimes(parts[i], c.length))) {
          x.open('gx:MultiTrack');
          x.leaf('gx:interpolate', '0');
          g.coordinates.forEach((c, i) => trackEl(c, parts[i] as string[]));
          x.close('gx:MultiTrack');
        } else {
          if (parts.some((t) => t && t.some((s) => s !== null))) w.add(timeWarn);
          x.open('MultiGeometry');
          for (const c of g.coordinates) lineEl(c);
          x.close('MultiGeometry');
        }
        return;
      }
      case 'Polygon':
        polygonEl(g.coordinates);
        return;
      case 'MultiPolygon':
        x.open('MultiGeometry');
        for (const poly of g.coordinates) polygonEl(poly);
        x.close('MultiGeometry');
        return;
      case 'GeometryCollection':
        x.open('MultiGeometry');
        for (const m of g.geometries) geomEl(m, undefined);
        x.close('MultiGeometry');
        return;
    }
  };

  const placemark = (f: Feature): void => {
    const used = new Set<string>(['folder']);
    x.open('Placemark');
    const nameKey = pickKey(f.properties, NAME_KEYS);
    if (nameKey) {
      x.leaf('name', pickString(f.properties, [nameKey]) as string);
      used.add(nameKey);
    }
    const descKey = pickKey(f.properties, ['description', 'Description', ...DESC_KEYS]);
    if (descKey) {
      x.leaf('description', pickString(f.properties, [descKey]) as string);
      used.add(descKey);
    }
    const t = alignedTimes(f);
    const p = f.properties;
    if (typeof t === 'string' && f.geometry?.type === 'Point') {
      x.open('TimeStamp');
      x.leaf('when', t);
      x.close('TimeStamp');
    } else if (typeof p.begin === 'string' || typeof p.end === 'string') {
      x.open('TimeSpan');
      if (typeof p.begin === 'string') x.leaf('begin', p.begin);
      if (typeof p.end === 'string') x.leaf('end', p.end);
      x.close('TimeSpan');
      used.add('begin').add('end');
    } else if (typeof p.timestamp === 'string') {
      x.open('TimeStamp');
      x.leaf('when', p.timestamp);
      x.close('TimeStamp');
      used.add('timestamp');
    }
    x.leaf('styleUrl', '#s');
    const extra = Object.keys(p).filter((k) => !used.has(k) && propText(p[k]) !== null);
    if (extra.length) {
      x.open('ExtendedData');
      for (const k of extra) {
        x.open('Data', { name: k });
        x.leaf('value', propText(p[k]) as string);
        x.close('Data');
      }
      x.close('ExtendedData');
    }
    if (f.geometry) geomEl(f.geometry, t);
    x.close('Placemark');
  };

  x.decl();
  x.open('kml', { xmlns: 'http://www.opengis.net/kml/2.2', 'xmlns:gx': 'http://www.google.com/kml/ext/2.2' });
  x.open('Document');
  const docName = o.docName.trim() || doc.name;
  if (docName) x.leaf('name', docName);
  x.open('Style', { id: 's' });
  x.open('IconStyle');
  x.leaf('scale', '1.1');
  x.close('IconStyle');
  x.open('LineStyle');
  x.leaf('color', 'ffeb6325');
  x.leaf('width', '3');
  x.close('LineStyle');
  x.open('PolyStyle');
  x.leaf('color', '55eb6325');
  x.close('PolyStyle');
  x.close('Style');

  const entries: ({ kind: 'f'; f: Feature } | { kind: 'folder'; name: string; items: Feature[] })[] = [];
  const folders = new Map<string, Feature[]>();
  for (const f of doc.features) {
    const fn = typeof f.properties.folder === 'string' && f.properties.folder.trim() ? f.properties.folder : null;
    if (fn === null) entries.push({ kind: 'f', f });
    else {
      let list = folders.get(fn);
      if (!list) {
        list = [];
        folders.set(fn, list);
        entries.push({ kind: 'folder', name: fn, items: list });
      }
      list.push(f);
    }
  }
  for (const e of entries) {
    if (e.kind === 'f') placemark(e.f);
    else {
      x.open('Folder');
      x.leaf('name', e.name);
      for (const f of e.items) placemark(f);
      x.close('Folder');
    }
  }
  x.close('Document');
  x.close('kml');
  if (!doc.features.some((f) => f.geometry)) w.add('Nothing to write: the data has no geometry');
  return { text: x.toString(), warnings: w.list() };
}

/* ---------- WKT ---------- */

export function writeWkt(doc: GeoDoc): WriteResult {
  const w = new Warnings();
  const lines: string[] = [];
  let withProps = false;
  let mixedZ = false;
  for (const f of doc.features) {
    if (!f.geometry) continue;
    if (Object.keys(f.properties).length || f.times !== undefined) withProps = true;
    let any = false;
    let all = true;
    forEachPosition(f.geometry, (p) => {
      if (p.length === 3) any = true;
      else all = false;
    });
    if (any && !all) mixedZ = true;
    lines.push(geometryToWkt(f.geometry));
  }
  if (withProps) w.add('WKT carries geometry only: properties and timestamps are not included');
  if (mixedZ) w.add('Some geometries mix vertices with and without elevation; their elevation was dropped');
  if (!lines.length) w.add('Nothing to write: the data has no geometry');
  return { text: lines.length ? lines.join('\n') + '\n' : '', warnings: w.list() };
}

/* ---------- Polyline ---------- */

export function writePolyline(doc: GeoDoc, precision: 5 | 6): WriteResult {
  const w = new Warnings();
  const lines: string[] = [];
  const add = (coords: Position[]): void => {
    if (coords.length) lines.push(encodePolyline(coords, precision));
  };
  let skipped = false;
  let hasZ = false;
  for (const f of doc.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'LineString') add(g.coordinates);
    else if (g.type === 'MultiLineString') g.coordinates.forEach(add);
    else skipped = true;
    forEachPosition(g, (p) => {
      if (p.length === 3) hasZ = true;
    });
  }
  if (skipped)
    w.add('Only LineString / MultiLineString geometries can be written as polylines; other geometries were skipped');
  if (hasZ) w.add('Polylines carry no elevation or timestamps');
  if (!lines.length) w.add('Nothing to write: there are no lines');
  return { text: lines.length ? lines.join('\n') + '\n' : '', warnings: w.list() };
}

/* ---------- CSV ---------- */

export function writeCsv(doc: GeoDoc, delimiter: string): WriteResult {
  const w = new Warnings();
  interface Row {
    feature: number;
    gtype: string;
    seg: number;
    pos: Position;
    time: string | null;
    f: Feature;
  }
  const rows: Row[] = [];
  let nonPoint = false;
  let multiPoly = false;
  let fi = 0;
  for (const f of doc.features) {
    const g = f.geometry;
    if (!g) continue;
    fi++;
    const t = alignedTimes(f);
    const push = (type: string, seg: number, pos: Position, time: string | null): void => {
      rows.push({ feature: fi, gtype: type, seg, pos, time, f });
    };
    const walk = (gg: Geometry, times: TimeTree | undefined): void => {
      switch (gg.type) {
        case 'Point':
          push('Point', 1, gg.coordinates, typeof times === 'string' ? times : null);
          return;
        case 'MultiPoint':
          gg.coordinates.forEach((p, i) =>
            push('MultiPoint', 1, p, Array.isArray(times) && typeof times[i] === 'string' ? (times[i] as string) : null)
          );
          return;
        case 'LineString':
          nonPoint = true;
          gg.coordinates.forEach((p, i) =>
            push('LineString', 1, p, Array.isArray(times) && typeof times[i] === 'string' ? (times[i] as string) : null)
          );
          return;
        case 'MultiLineString':
          nonPoint = true;
          gg.coordinates.forEach((c, si) =>
            c.forEach((p, i) => {
              const ts = Array.isArray(times) ? times[si] : undefined;
              push(
                'MultiLineString',
                si + 1,
                p,
                Array.isArray(ts) && typeof ts[i] === 'string' ? (ts[i] as string) : null
              );
            })
          );
          return;
        case 'Polygon':
          nonPoint = true;
          gg.coordinates.forEach((r, ri) => r.forEach((p) => push('Polygon', ri + 1, p, null)));
          return;
        case 'MultiPolygon': {
          nonPoint = true;
          multiPoly = true;
          let ri = 0;
          for (const poly of gg.coordinates)
            for (const r of poly) {
              ri++;
              r.forEach((p) => push('MultiPolygon', ri, p, null));
            }
          return;
        }
        case 'GeometryCollection':
          for (const m of gg.geometries) walk(m, undefined);
          return;
      }
    };
    walk(g, t);
  }
  if (multiPoly) w.add('MultiPolygon rings are numbered consecutively; the polygon grouping is not preserved in CSV');
  if (!rows.length) {
    w.add('Nothing to write: the data has no geometry');
    return { text: '', warnings: w.list() };
  }
  const hasEle = rows.some((r) => r.pos.length === 3);
  const hasTime = rows.some((r) => r.time !== null);
  const fixed = new Set(['lat', 'lon', 'ele', 'time', 'feature', 'geometry_type', 'segment']);
  const keys: string[] = [];
  const seen = new Set<string>();
  const addKey = (k: string): void => {
    if (!seen.has(k)) {
      seen.add(k);
      keys.push(k);
    }
  };
  if (rows.some((r) => r.f.properties.name !== undefined)) addKey('name');
  for (const r of rows)
    for (const k of Object.keys(r.f.properties)) if (propText(r.f.properties[k]) !== null) addKey(k);
  const colName = (k: string): string => (fixed.has(k) && !(k === 'time' && !hasTime) ? `${k}_prop` : k);
  const header: string[] = [];
  if (nonPoint) header.push('feature', 'geometry_type', 'segment');
  header.push('lat', 'lon');
  if (hasEle) header.push('ele');
  if (hasTime) header.push('time');
  for (const k of keys) header.push(colName(k));
  const out: (string | number | null)[][] = [header];
  for (const r of rows) {
    const line: (string | number | null)[] = [];
    if (nonPoint) line.push(r.feature, r.gtype, r.seg);
    line.push(fmtNum(r.pos[1]), fmtNum(r.pos[0]));
    if (hasEle) line.push(r.pos.length === 3 ? fmtNum(r.pos[2]) : '');
    if (hasTime) line.push(r.time ?? '');
    for (const k of keys) line.push(propText(r.f.properties[k]) ?? '');
    out.push(line);
  }
  return { text: toCsv(out, delimiter) + '\n', warnings: w.list() };
}

/* ---------- entry points ---------- */

export function writeDoc(doc: GeoDoc, fmt: OutFormatId, o: WriteOptions): WriteResult {
  switch (fmt) {
    case 'geojson':
      return writeGeoJson(doc, o.pretty);
    case 'gpx':
      return writeGpx(doc, o);
    case 'kml':
    case 'kmz':
      return writeKml(doc, o);
    case 'csv':
      return writeCsv(doc, o.csvDelimiter);
    case 'wkt':
      return writeWkt(doc);
    case 'polyline':
      return writePolyline(doc, o.polylinePrecision);
  }
}

export function outFormatInfo(id: OutFormatId): { id: OutFormatId; label: string; ext: string; mime: string } {
  return OUT_FORMATS.find((f) => f.id === id) ?? (OUT_FORMATS[0] as (typeof OUT_FORMATS)[number]);
}

export interface ConvertResult {
  doc: GeoDoc;
  text: string;
  warnings: string[];
}

export function convertDoc(doc: GeoDoc, fmt: OutFormatId, t: TransformOptions, o: WriteOptions): ConvertResult {
  const tr = transformDoc(doc, t);
  const wr = writeDoc(tr.doc, fmt, o);
  return { doc: tr.doc, text: wr.text, warnings: [...tr.warnings, ...wr.warnings] };
}
