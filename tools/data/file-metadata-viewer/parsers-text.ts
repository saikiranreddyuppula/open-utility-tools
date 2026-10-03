/** Text-based formats: SVG, HTML, XML (incl. GPX / KML), JSON / JSON Lines, CSV / TSV. */
import { decodeEntities, localName, parseXml, xChild, xFind, xFindAll, xText } from './xml';
import { type Ctx, fmtNum, latin1, textSmart, utf8, utf16, clean } from './util';
import { emitXmp, extractXmpPacket } from './embedded';

const MAX_PARSE = 12 * 1024 * 1024;

async function readText(c: Ctx, max: number): Promise<{ text: string; truncated: boolean }> {
  const n = Math.min(c.size, max);
  const bytes = (await c.rd.read(0, n)).slice();
  let text: string;
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) text = utf16(bytes, true, 2);
  else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) text = utf16(bytes, false, 2);
  else text = textSmart(bytes);
  return { text: text.replace(/^﻿/, ''), truncated: c.size > n };
}

function parseAttrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([^\s=/>"']+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag)) !== null) out[(m[1] ?? '').toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  return out;
}

function countMatches(s: string, re: RegExp): number {
  return (s.match(re) ?? []).length;
}

// ---------------------------------------------------------------------------
// SVG
// ---------------------------------------------------------------------------

export async function parseSvg(c: Ctx): Promise<void> {
  const { out } = c;
  const { text, truncated } = await readText(c, MAX_PARSE);
  const sec = out.section('svg', 'SVG document');
  const root = parseXml(text);
  if (!root || localName(root.name) !== 'svg') throw new Error('root element is not <svg>');
  const a = root.attrs;
  const get = (k: string) => a[k];
  out.row(sec, 'Width × height', [get('width'), get('height')].every(Boolean) ? `${get('width')} × ${get('height')}` : get('width') ?? get('height'));
  out.row(sec, 'viewBox', get('viewBox'));
  out.row(sec, 'SVG version', get('version'));
  out.row(sec, 'preserveAspectRatio', get('preserveAspectRatio'));
  const nsList = Object.entries(a).filter(([k]) => k.startsWith('xmlns')).map(([k, v]) => `${k}=${v}`);
  out.row(sec, 'Namespaces', nsList.map((x) => (x.startsWith('xmlns=') ? `(default)${x.slice(5)}` : x.replace(/^xmlns:/, ''))).join('; '));
  const title = xChild(root, 'title');
  const desc = xChild(root, 'desc');
  if (title) out.row(sec, 'Title', xText(title).trim());
  if (desc) {
    out.row(sec, 'Description', xText(desc).trim());
    if (xText(desc).trim()) out.find('comments', 'SVG <desc>', xText(desc).trim().slice(0, 200));
  }
  const inkVer = a['inkscape:version'];
  const docname = a['sodipodi:docname'];
  out.row(sec, 'Inkscape version', inkVer);
  out.row(sec, 'Inkscape document name (sodipodi:docname)', docname);
  if (inkVer) out.find('software', 'Inkscape', inkVer);
  if (docname) out.find('filename', 'Original document name (sodipodi:docname)', docname);
  const exportName = a['inkscape:export-filename'];
  if (exportName) {
    out.row(sec, 'Inkscape export file name', exportName);
    out.find('filename', 'Export file name (inkscape:export-filename)', exportName);
  }
  const allNodes = xFindAll(root, 'namedview');
  for (const nv of allNodes.slice(0, 1)) {
    const ef = nv.attrs['inkscape:export-filename'];
    if (ef) {
      out.row(sec, 'Inkscape export file name (namedview)', ef);
      out.find('filename', 'Export file name (inkscape:export-filename)', ef);
    }
  }
  // generator comments
  const comments = Array.from(text.matchAll(/<!--([\s\S]*?)-->/g)).map((m) => (m[1] ?? '').trim()).filter(Boolean);
  const gens = comments.filter((x) => /generator|created with|created by|exported|illustrator|sketch|figma|inkscape|corel|affinity|sodipodi|svg-edit|adobe/i.test(x)).slice(0, 5);
  gens.forEach((g, i) => {
    out.row(sec, gens.length > 1 ? `Generator comment ${i + 1}` : 'Generator comment', g.replace(/\s+/g, ' ').slice(0, 300));
    out.find('software', 'SVG generator comment', g.replace(/\s+/g, ' ').slice(0, 160));
  });
  const other = comments.filter((x) => !gens.includes(x)).slice(0, 5);
  if (other.length) out.row(sec, 'Other comments', other.map((x) => x.replace(/\s+/g, ' ').slice(0, 200)).join(' | '));
  // metadata block
  const md = xChild(root, 'metadata');
  if (md) {
    const msec = out.section('svg-metadata', '<metadata> block');
    const pick = (n: string) => xFindAll(md, n).map((x) => xText(x).trim()).filter(Boolean);
    const work = xFind(md, 'Work');
    const workTitle = work ? xChild(work, 'title') : undefined;
    out.row(msec, 'Title (dc:title)', workTitle ? xText(workTitle).trim() : undefined);
    out.row(msec, 'Creator (dc:creator)', pick('creator').join(', '));
    out.row(msec, 'Publisher', pick('publisher').join(', '));
    out.row(msec, 'Date', pick('date').join(', '));
    out.row(msec, 'Rights', pick('rights').join(', '));
    out.row(msec, 'Description', pick('description').join(' '));
    out.row(msec, 'Subjects', pick('subject').join(', '));
    const lic = xFindAll(md, 'license').map((x) => x.attrs['rdf:resource'] ?? xText(x).trim()).filter(Boolean);
    out.row(msec, 'License', lic.join(', '));
    const who = [...pick('creator'), ...xFindAll(md, 'Agent').flatMap((ag) => xFindAll(ag, 'title').map((t) => xText(t).trim()))].filter(Boolean);
    if (who.length) out.find('person', 'Creator (SVG metadata)', Array.from(new Set(who)).join(', '));
    const packet = text.includes('<x:xmpmeta') ? extractXmpPacket(new TextEncoder().encode(text.slice(0, 2 * 1024 * 1024))) : null;
    if (packet) emitXmp(out, packet);
  }
  const counts = out.section('svg-content', 'Content summary');
  const tally = (name: string) => xFindAll(root, name, [], 200000).length;
  const elems = ['path', 'rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline', 'text', 'tspan', 'g', 'use', 'image', 'linearGradient', 'radialGradient', 'filter', 'clipPath', 'mask', 'pattern', 'symbol', 'style', 'script', 'foreignObject', 'animate', 'animateTransform', 'a'];
  const summary: string[] = [];
  for (const e of elems) {
    const n = tally(e);
    if (n > 0) summary.push(`${e} ×${n}`);
  }
  out.row(counts, 'Elements', summary.join(', '));
  const images = xFindAll(root, 'image', [], 1000);
  const dataImgs = images.filter((i) => /^data:image\//.test(i.attrs['href'] ?? i.attrs['xlink:href'] ?? ''));
  if (dataImgs.length) {
    out.row(counts, 'Embedded raster images (data: URIs)', `${dataImgs.length} (they can carry their own EXIF / GPS)`);
    out.find('other', 'Embedded raster images', `${dataImgs.length} image${dataImgs.length === 1 ? '' : 's'} embedded as data: URIs`);
  }
  const scripts = tally('script');
  if (scripts) {
    out.row(counts, 'Scripts', `${scripts} <script> element${scripts === 1 ? '' : 's'} (active content)`);
    out.find('other', 'Active content', `${scripts} <script> element${scripts === 1 ? '' : 's'} in the SVG`);
  }
  const ext = Array.from(new Set(Array.from(text.matchAll(/(?:xlink:)?href\s*=\s*"(https?:\/\/[^"]+)"/g)).map((m) => m[1] ?? ''))).filter((u) => !/w3\.org|inkscape\.org|sourceforge\.net|purl\.org|creativecommons\.org/.test(u));
  if (ext.length) out.row(counts, 'External links', `${ext.length}: ${ext.slice(0, 4).join(', ')}`);
  const fonts = Array.from(new Set(Array.from(text.matchAll(/font-family\s*[:=]\s*['"]?([^;'"<>]+)/g)).map((m) => (m[1] ?? '').trim().replace(/['"]/g, '')))).filter(Boolean);
  if (fonts.length) out.row(counts, 'Fonts referenced', fonts.slice(0, 8).join(' | '));
  if (truncated) out.note('Only the first 12 MiB of the SVG were analysed.');
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

export async function parseHtml(c: Ctx): Promise<void> {
  const { out } = c;
  const { text, truncated } = await readText(c, 2 * 1024 * 1024);
  const sec = out.section('html', 'HTML document');
  const doctype = /<!doctype\s+([^>]+)>/i.exec(text)?.[1]?.trim();
  out.row(sec, 'Doctype', doctype);
  const lang = /<html\b[^>]*\blang\s*=\s*["']?([\w-]+)/i.exec(text)?.[1];
  out.row(sec, 'Language', lang);
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(text)?.[1];
  out.row(sec, 'Title', title ? decodeEntities(title.replace(/\s+/g, ' ').trim()) : undefined);
  const metas = Array.from(text.matchAll(/<meta\b[^>]*>/gi)).map((m) => parseAttrs(m[0]));
  const meta = out.section('html-meta', 'Meta tags');
  for (const m of metas.slice(0, 120)) {
    const key = m['name'] ?? m['property'] ?? m['http-equiv'] ?? (m['charset'] ? 'charset' : undefined) ?? m['itemprop'];
    const val = m['content'] ?? m['charset'];
    if (!key || val === undefined) continue;
    out.row(meta, key, val.length > 600 ? `${val.slice(0, 600)}…` : val);
    const k = key.toLowerCase();
    if (k === 'generator') out.find('software', 'Page generator', val);
    else if (k === 'author' || k === 'article:author' || k === 'dc.creator' || k === 'twitter:creator') out.find('person', `Meta ${key}`, val);
    else if (k === 'copyright' || k === 'publisher' || k === 'og:site_name' || k === 'application-name') {
      if (k === 'publisher' || k === 'copyright') out.find('company', `Meta ${key}`, val);
    }
  }
  const links = Array.from(text.matchAll(/<link\b[^>]*>/gi)).map((m) => parseAttrs(m[0]));
  const canonical = links.find((l) => (l['rel'] ?? '').includes('canonical'));
  out.row(sec, 'Canonical URL', canonical?.['href']);
  const icons = links.filter((l) => /icon/.test(l['rel'] ?? '')).length;
  out.row(sec, 'Stylesheets / icons', `${links.filter((l) => (l['rel'] ?? '').includes('stylesheet')).length} stylesheets, ${icons} icons`);
  const scripts = Array.from(text.matchAll(/<script\b([^>]*)>/gi));
  const ext = scripts.filter((s) => /\bsrc\s*=/.test(s[1] ?? '')).length;
  out.row(sec, 'Scripts', `${scripts.length} (${ext} external, ${scripts.length - ext} inline)`);
  out.row(sec, 'Images / links / forms', `${countMatches(text, /<img\b/gi)} images, ${countMatches(text, /<a\b/gi)} links, ${countMatches(text, /<form\b/gi)} forms`);
  const gen = Array.from(text.matchAll(/<!--([\s\S]*?)-->/g)).map((m) => (m[1] ?? '').trim()).find((x) => /generated|created|saved from|mirrored|built with|wordpress|jekyll|hugo|wix|squarespace|webflow|dreamweaver|frontpage/i.test(x) && x.length < 300);
  if (gen) {
    out.row(sec, 'Generator comment', gen.replace(/\s+/g, ' '));
    out.find('software', 'Generator comment', gen.replace(/\s+/g, ' ').slice(0, 160));
  }
  const saved = /saved from url=\(\d+\)(\S+)/i.exec(text);
  if (saved) {
    out.row(sec, 'Saved from URL (Mark of the Web)', saved[1]);
    out.find('filename', 'Source URL (saved-from comment)', saved[1] ?? '');
  }
  const phone = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g);
  if (phone) out.row(sec, 'E-mail addresses found', `${new Set(phone).size} (e.g. ${Array.from(new Set(phone)).slice(0, 3).join(', ')})`);
  if (truncated) out.note('Only the first 2 MiB of the page were analysed.');
}

// ---------------------------------------------------------------------------
// XML (incl. GPX, KML)
// ---------------------------------------------------------------------------

export async function parseXmlDoc(c: Ctx): Promise<void> {
  const { out } = c;
  const { text, truncated } = await readText(c, MAX_PARSE);
  const sec = out.section('xml', 'XML document');
  const decl = /^\s*<\?xml\s+([^?]*)\?>/.exec(text);
  if (decl) {
    const at = parseAttrs(decl[1] ?? '');
    out.row(sec, 'XML declaration', `version ${at['version'] ?? '?'}${at['encoding'] ? `, encoding ${at['encoding']}` : ''}${at['standalone'] ? `, standalone=${at['standalone']}` : ''}`);
  }
  const dt = /<!DOCTYPE\s+([^>[]+)/i.exec(text);
  out.row(sec, 'DOCTYPE', dt?.[1]?.trim());
  const pis = Array.from(text.matchAll(/<\?(?!xml\b)([\w-]+)\s+([^?]*)\?>/g)).slice(0, 5).map((m) => `${m[1]} ${(m[2] ?? '').trim()}`.slice(0, 160));
  if (pis.length) out.row(sec, 'Processing instructions', pis.join(' | '));
  const root = parseXml(text);
  if (!root) throw new Error('no root element found');
  out.row(sec, 'Root element', root.name);
  const ns = Object.entries(root.attrs).filter(([k]) => k.startsWith('xmlns'));
  if (ns.length) out.row(sec, 'Namespaces', ns.slice(0, 10).map(([k, v]) => `${k.replace(/^xmlns:?/, '') || '(default)'} = ${v}`).join('; '));
  const attrs = Object.entries(root.attrs).filter(([k]) => !k.startsWith('xmlns') && !k.startsWith('xsi:'));
  if (attrs.length) out.row(sec, 'Root attributes', attrs.slice(0, 10).map(([k, v]) => `${k}="${v.length > 60 ? `${v.slice(0, 60)}…` : v}"`).join(' '));
  const kids = new Map<string, number>();
  for (const k of root.children) kids.set(k.name, (kids.get(k.name) ?? 0) + 1);
  out.row(sec, 'Top-level children', Array.from(kids).slice(0, 20).map(([k, n]) => `${k}${n > 1 ? ` ×${n}` : ''}`).join(', '));
  out.row(sec, 'Elements (approx.)', countMatches(text, /<[A-Za-z_][\w.:-]*[\s/>]/g).toLocaleString('en-US'));
  const comments = Array.from(text.matchAll(/<!--([\s\S]*?)-->/g)).map((m) => (m[1] ?? '').trim()).filter(Boolean);
  if (comments.length) out.row(sec, 'Comments', `${comments.length}: ${comments.slice(0, 3).map((x) => x.replace(/\s+/g, ' ').slice(0, 120)).join(' | ')}`);

  const rn = localName(root.name).toLowerCase();
  if (rn === 'gpx') {
    const g = out.section('gpx', 'GPX track data');
    out.row(g, 'Creator application', root.attrs['creator']);
    if (root.attrs['creator']) out.find('software', 'GPX creator', root.attrs['creator']);
    out.row(g, 'GPX version', root.attrs['version']);
    const md = xChild(root, 'metadata');
    const nameEl = md ? xChild(md, 'name') : undefined;
    out.row(g, 'Name', nameEl ? xText(nameEl).trim() : undefined);
    const author = md ? xFind(md, 'author') : undefined;
    if (author) {
      const an = xChild(author, 'name');
      const em = xFind(author, 'email');
      const txt = [an ? xText(an).trim() : '', em ? `${em.attrs['id'] ?? ''}@${em.attrs['domain'] ?? ''}` : ''].filter(Boolean).join(' ');
      out.row(g, 'Author', txt);
      if (txt) out.find('person', 'GPX author', txt);
    }
    const time = md ? xChild(md, 'time') : undefined;
    out.row(g, 'Created', time ? xText(time).trim() : undefined);
    const bounds = md ? xChild(md, 'bounds') : undefined;
    if (bounds) out.row(g, 'Bounds', `lat ${bounds.attrs['minlat']}…${bounds.attrs['maxlat']}, lon ${bounds.attrs['minlon']}…${bounds.attrs['maxlon']}`);
    const trkpt = countMatches(text, /<trkpt\b/g);
    const wpt = countMatches(text, /<wpt\b/g);
    const rtept = countMatches(text, /<rtept\b/g);
    out.row(g, 'Track points / waypoints / route points', `${trkpt.toLocaleString('en-US')} / ${wpt.toLocaleString('en-US')} / ${rtept.toLocaleString('en-US')}`);
    const times = Array.from(text.matchAll(/<time>([^<]+)<\/time>/g)).map((m) => m[1] ?? '');
    if (times.length) out.row(g, 'Time span', `${times[0]} → ${times[times.length - 1]}`);
    const first = /<(?:trkpt|wpt|rtept)\b[^>]*\blat="([-\d.]+)"[^>]*\blon="([-\d.]+)"/.exec(text);
    if (first) {
      out.row(g, 'First point', `${first[1]}, ${first[2]}`);
      out.find('gps', 'GPS track', `${(trkpt + wpt + rtept).toLocaleString('en-US')} point(s), starting at ${first[1]}, ${first[2]}`);
    }
  } else if (rn === 'kml') {
    const k = out.section('kml', 'KML placemarks');
    const nameEl = xFind(root, 'name');
    out.row(k, 'Document name', nameEl ? xText(nameEl).trim() : undefined);
    out.row(k, 'Placemarks', String(countMatches(text, /<Placemark\b/g)));
    const coord = /<coordinates>\s*([-\d.]+),([-\d.]+)/.exec(text);
    if (coord) {
      out.row(k, 'First coordinate (lon, lat)', `${coord[1]}, ${coord[2]}`);
      out.find('gps', 'KML coordinates', `placemark data starting at lat ${coord[2]}, lon ${coord[1]}`);
    }
    const author = xFind(root, 'author');
    if (author) {
      const an = xFind(author, 'name');
      if (an) out.find('person', 'KML author', xText(an).trim());
    }
  } else if (rn === 'rss' || rn === 'feed') {
    const f = out.section('feed', 'Feed');
    const ch = xFind(root, 'channel') ?? root;
    const t = xChild(ch, 'title');
    out.row(f, 'Title', t ? xText(t).trim() : undefined);
    const gen = xChild(ch, 'generator');
    out.row(f, 'Generator', gen ? xText(gen).trim() : undefined);
    if (gen) out.find('software', 'Feed generator', xText(gen).trim());
    out.row(f, 'Items / entries', String(countMatches(text, /<(item|entry)\b/g)));
    const au = xFind(ch, 'managingEditor') ?? xFind(ch, 'author');
    if (au) out.find('person', 'Feed author / editor', xText(au).trim().slice(0, 160));
  } else if (rn === 'plist') {
    out.row(sec, 'Property list', 'Apple plist');
  }
  if (truncated) out.note('Only the first 12 MiB of the file were analysed.');
}

// ---------------------------------------------------------------------------
// JSON / JSON Lines
// ---------------------------------------------------------------------------

function jtype(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

function depthOf(v: unknown, d = 0): number {
  if (d > 60) return d;
  if (Array.isArray(v)) return v.reduce<number>((m, x) => Math.max(m, depthOf(x, d + 1)), d + 1);
  if (v && typeof v === 'object') return Object.values(v as Record<string, unknown>).reduce<number>((m, x) => Math.max(m, depthOf(x, d + 1)), d + 1);
  return d;
}

export async function parseJson(c: Ctx): Promise<void> {
  const { out, size } = c;
  const sec = out.section('json', 'JSON structure');
  if (size > 24 * 1024 * 1024) {
    out.note('File is larger than 24 MiB: structure not analysed.');
    return;
  }
  const { text } = await readText(c, 24 * 1024 * 1024);
  const isLines = c.det?.name === 'JSON Lines' || c.ext === 'jsonl' || c.ext === 'ndjson';
  if (isLines) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    out.row(sec, 'Format', 'JSON Lines (one value per line)');
    out.row(sec, 'Records', lines.length.toLocaleString('en-US'));
    let bad = 0;
    const keys = new Map<string, number>();
    for (const l of lines.slice(0, 2000)) {
      try {
        const v = JSON.parse(l) as unknown;
        if (v && typeof v === 'object' && !Array.isArray(v)) for (const k of Object.keys(v)) keys.set(k, (keys.get(k) ?? 0) + 1);
      } catch {
        bad++;
      }
    }
    out.row(sec, 'Invalid lines (first 2000)', String(bad));
    out.row(sec, 'Keys seen', Array.from(keys).slice(0, 40).map(([k, n]) => `${k} (${n})`).join(', '));
    return;
  }
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    out.row(sec, 'Valid JSON', `no: ${msg}`);
    throw new Error(`invalid JSON (${msg})`);
  }
  out.row(sec, 'Valid JSON', 'yes');
  out.row(sec, 'Top-level type', jtype(v));
  out.row(sec, 'Nesting depth', String(depthOf(v)));
  if (Array.isArray(v)) {
    out.row(sec, 'Items', v.length.toLocaleString('en-US'));
    const types = new Map<string, number>();
    for (const x of v.slice(0, 5000)) types.set(jtype(x), (types.get(jtype(x)) ?? 0) + 1);
    out.row(sec, 'Item types', Array.from(types).map(([k, n]) => `${k} ×${n}`).join(', '));
    const keys = new Map<string, number>();
    for (const x of v.slice(0, 500)) if (x && typeof x === 'object' && !Array.isArray(x)) for (const k of Object.keys(x)) keys.set(k, (keys.get(k) ?? 0) + 1);
    if (keys.size) out.row(sec, 'Keys of the first 500 objects', Array.from(keys).slice(0, 40).map(([k, n]) => `${k} (${n})`).join(', '));
  } else if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const ks = Object.keys(o);
    out.row(sec, 'Top-level keys', `${ks.length}`);
    const ksec = out.section('json-keys', 'Top-level keys');
    for (const k of ks.slice(0, 60)) {
      const val = o[k];
      const t = jtype(val);
      out.row(ksec, k, t === 'array' ? `array (${(val as unknown[]).length})` : t === 'object' ? `object (${Object.keys(val as object).length} keys)` : t === 'string' ? `string · ${String(val).length > 80 ? `${String(val).slice(0, 80)}…` : String(val)}` : `${t} · ${String(val)}`);
    }
    if (ks.length > 60) ksec.note = `Showing 60 of ${ks.length} keys.`;
    if (o['type'] === 'FeatureCollection' && Array.isArray(o['features'])) {
      const g = out.section('geojson', 'GeoJSON');
      out.row(g, 'Features', String((o['features'] as unknown[]).length));
      const gt = new Map<string, number>();
      for (const f of (o['features'] as Array<{ geometry?: { type?: string } }>).slice(0, 5000)) {
        const t = f?.geometry?.type ?? 'null';
        gt.set(t, (gt.get(t) ?? 0) + 1);
      }
      out.row(g, 'Geometry types', Array.from(gt).map(([k, n]) => `${k} ×${n}`).join(', '));
      if (Array.isArray(o['bbox'])) out.row(g, 'Bounding box', (o['bbox'] as number[]).join(', '));
      out.find('gps', 'GeoJSON geometry', `${(o['features'] as unknown[]).length} feature(s) with coordinates`);
    }
  }
}

// ---------------------------------------------------------------------------
// CSV / TSV
// ---------------------------------------------------------------------------

function splitCsvRow(line: string, delim: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] ?? '';
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) {
      cells.push(cur);
      cur = '';
    } else cur += ch;
  }
  cells.push(cur);
  return cells;
}

export async function parseCsv(c: Ctx): Promise<void> {
  const { out, size } = c;
  const { text } = await readText(c, 1024 * 1024);
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0).slice(0, 60);
  if (lines.length === 0) throw new Error('no rows found');
  const sec = out.section('csv', 'Table structure');
  let best = ',';
  let bestScore = -1;
  for (const d of [',', ';', '\t', '|']) {
    const counts = lines.slice(0, 20).map((l) => splitCsvRow(l, d).length);
    const first = counts[0] ?? 1;
    const consistent = counts.filter((n) => n === first).length;
    const score = first > 1 ? consistent * 100 + first : 0;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  const header = splitCsvRow(lines[0] ?? '', best);
  const second = lines[1] ? splitCsvRow(lines[1], best) : [];
  const hasHeader = second.length > 0 && header.every((h) => h.trim() !== '' && Number.isNaN(Number(h))) ;
  out.row(sec, 'Delimiter', ({ ',': 'comma', ';': 'semicolon', '\t': 'tab', '|': 'pipe' } as Record<string, string>)[best]);
  out.row(sec, 'Columns', String(header.length));
  const rows = c.size <= 1024 * 1024 ? text.split(/\r?\n/).filter((l) => l.length > 0).length : undefined;
  out.row(sec, 'Rows', rows !== undefined ? `${(hasHeader ? rows - 1 : rows).toLocaleString('en-US')}${hasHeader ? ' (plus a header row)' : ''}` : `more than ${lines.length} (file is ${fmtNum(size / 1048576, 1)} MiB)`);
  out.row(sec, 'Looks like a header row', hasHeader ? 'yes' : 'no');
  if (hasHeader) out.row(sec, 'Column names', header.slice(0, 40).map((h) => clean(h.trim())).join(', '));
  const ragged = lines.slice(0, 60).filter((l) => splitCsvRow(l, best).length !== header.length).length;
  if (ragged) out.row(sec, 'Rows with a different column count (first 60)', String(ragged));
  void latin1;
  void utf8;
}
