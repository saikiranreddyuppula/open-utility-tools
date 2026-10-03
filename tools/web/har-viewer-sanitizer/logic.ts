/**
 * HAR (HTTP Archive 1.2) parsing, summarising, insights and sanitising.
 * Pure TypeScript, no DOM. Written for large files: entries are summarised once into compact rows
 * and the sanitiser uses copy-on-write so untouched data is shared, never cloned.
 */

export type Rec = Record<string, unknown>;

export interface HarFile {
  log: Rec & { entries: Rec[] };
  [k: string]: unknown;
}

function isRec(x: unknown): x is Rec {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
function asRec(x: unknown): Rec | undefined {
  return isRec(x) ? x : undefined;
}
function asArr(x: unknown): unknown[] {
  return Array.isArray(x) ? x : [];
}
function asStr(x: unknown): string {
  return typeof x === 'string' ? x : '';
}
function asNum(x: unknown, d = 0): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : d;
}

export function parseHar(text: string): { ok: true; har: HarFile } | { ok: false; error: string } {
  let t = text;
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  if (!t.trim()) return { ok: false, error: 'The input is empty.' };
  let data: unknown;
  try {
    data = JSON.parse(t);
  } catch (e) {
    return { ok: false, error: `Not valid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (Array.isArray(data)) {
    return { ok: false, error: 'This is a JSON array, not a HAR file. A HAR has the shape {"log": {"entries": [...]}}.' };
  }
  if (!isRec(data) || !isRec(data.log)) {
    return { ok: false, error: 'Not a HAR file: the top-level "log" object is missing.' };
  }
  const log = data.log;
  if (!Array.isArray(log.entries)) {
    return { ok: false, error: 'Not a HAR file: "log.entries" is missing or not an array.' };
  }
  return { ok: true, har: data as HarFile };
}

// ---------------------------------------------------------------------------
// URL / header helpers
// ---------------------------------------------------------------------------

export interface UrlParts {
  scheme: string;
  host: string;
  path: string;
  query: string;
}

export function splitUrl(url: string): UrlParts {
  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):(?:\/\/([^/?#]*))?([^?#]*)(?:\?([^#]*))?/.exec(url);
  if (!m) return { scheme: '', host: '', path: url, query: '' };
  const authority = m[2] ?? '';
  const host = authority.replace(/^.*@/, '').replace(/:\d+$/, '');
  return { scheme: (m[1] ?? '').toLowerCase(), host: host.toLowerCase(), path: m[3] || '/', query: m[4] ?? '' };
}

const SECOND_LEVEL = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'org.au', 'co.nz', 'co.jp', 'ne.jp', 'or.jp', 'co.in', 'com.br', 'com.cn', 'com.mx', 'co.za',
  'com.tr', 'com.sg', 'com.hk', 'com.tw', 'com.ar', 'co.kr',
]);

export function orgDomain(host: string): string {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) return host;
  const labels = host.toLowerCase().split('.').filter(Boolean);
  if (labels.length <= 2) return labels.join('.');
  const last2 = labels.slice(-2).join('.');
  return SECOND_LEVEL.has(last2) ? labels.slice(-3).join('.') : last2;
}

export interface NameValue {
  name: string;
  value: string;
}

export function nameValues(x: unknown): NameValue[] {
  const out: NameValue[] = [];
  for (const h of asArr(x)) {
    const r = asRec(h);
    if (r) out.push({ name: asStr(r.name), value: typeof r.value === 'string' ? r.value : r.value === undefined || r.value === null ? '' : String(r.value) });
  }
  return out;
}

function headerValue(headers: unknown, lname: string): string | undefined {
  for (const h of asArr(headers)) {
    const r = asRec(h);
    if (r && asStr(r.name).toLowerCase() === lname) return asStr(r.value);
  }
  return undefined;
}

export function parseQuery(query: string): NameValue[] {
  if (!query) return [];
  return query.split('&').filter(Boolean).map((p) => {
    const eq = p.indexOf('=');
    const dec = (s: string) => {
      try {
        return decodeURIComponent(s.replace(/\+/g, ' '));
      } catch {
        return s;
      }
    };
    return eq < 0 ? { name: dec(p), value: '' } : { name: dec(p.slice(0, eq)), value: dec(p.slice(eq + 1)) };
  });
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export type ResourceType = 'xhr' | 'js' | 'css' | 'img' | 'doc' | 'font' | 'other';

export const TYPE_LABELS: Record<ResourceType, string> = {
  xhr: 'XHR/fetch',
  js: 'JS',
  css: 'CSS',
  img: 'Img',
  doc: 'Doc',
  font: 'Font',
  other: 'Other',
};

export interface Segment {
  key: 'blocked' | 'dns' | 'connect' | 'ssl' | 'send' | 'wait' | 'receive';
  ms: number;
}

export interface Row {
  i: number;
  method: string;
  url: string;
  host: string;
  path: string;
  status: number;
  statusText: string;
  mime: string;
  type: ResourceType;
  /** Bytes transferred over the wire when known, else body size. -1 when unknown. */
  size: number;
  contentSize: number;
  time: number;
  /** ms since the earliest request. */
  start: number;
  segs: Segment[];
  failed: boolean;
  error?: string;
  fromCache: boolean;
  protocol: string;
  serverIp: string;
  redirect: string;
  compressed: boolean;
}

export function mimeBase(m: string): string {
  return m.split(';')[0]?.trim().toLowerCase() ?? '';
}

export function classify(mime: string, resourceType: string, url: string): ResourceType {
  const rt = resourceType.toLowerCase();
  const m = mimeBase(mime);
  if (rt === 'xhr' || rt === 'fetch') return 'xhr';
  if (rt === 'script') return 'js';
  if (rt === 'stylesheet') return 'css';
  if (rt === 'image') return 'img';
  if (rt === 'document') return 'doc';
  if (rt === 'font') return 'font';
  if (m.startsWith('image/')) return 'img';
  if (m.includes('javascript') || m === 'application/x-javascript' || m.endsWith('/ecmascript')) return 'js';
  if (m === 'text/css') return 'css';
  if (m.startsWith('font/') || m.includes('font') || /\.(woff2?|ttf|otf|eot)(\?|$)/i.test(url)) return 'font';
  if (m === 'text/html' || m === 'application/xhtml+xml') return 'doc';
  if (m.includes('json') || m === 'application/xml' || m === 'text/xml') return rt === '' ? 'xhr' : 'other';
  return 'other';
}

function num(x: unknown): number {
  return typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : 0;
}

export function segmentsOf(timings: unknown, total: number): Segment[] {
  const t = asRec(timings);
  if (!t) return total > 0 ? [{ key: 'wait', ms: total }] : [];
  const ssl = num(t.ssl);
  const connect = num(t.connect);
  const segs: Segment[] = [
    { key: 'blocked', ms: num(t.blocked) },
    { key: 'dns', ms: num(t.dns) },
    // HAR 1.2: connect includes ssl
    { key: 'connect', ms: Math.max(0, connect - ssl) },
    { key: 'ssl', ms: ssl },
    { key: 'send', ms: num(t.send) },
    { key: 'wait', ms: num(t.wait) },
    { key: 'receive', ms: num(t.receive) },
  ];
  const sum = segs.reduce((n, s) => n + s.ms, 0);
  if (sum === 0 && total > 0) return [{ key: 'wait', ms: total }];
  return segs.filter((s) => s.ms > 0);
}

export function entryRow(entry: Rec, i: number, t0: number): Row {
  const req = asRec(entry.request) ?? {};
  const res = asRec(entry.response) ?? {};
  const content = asRec(res.content) ?? {};
  const url = asStr(req.url);
  const u = splitUrl(url);
  const status = asNum(res.status, 0);
  const mime = mimeBase(asStr(content.mimeType) || headerValue(res.headers, 'content-type') || '');
  const started = Date.parse(asStr(entry.startedDateTime));
  const time = Math.max(0, asNum(entry.time, 0));
  const bodySize = asNum(res.bodySize, -1);
  const headersSize = asNum(res.headersSize, -1);
  const transferSize = typeof res._transferSize === 'number' ? res._transferSize : undefined;
  const size = transferSize !== undefined ? transferSize : bodySize >= 0 ? bodySize + Math.max(0, headersSize) : -1;
  const contentSize = asNum(content.size, -1);
  const error = asStr(res._error) || asStr(entry._error) || asStr(res._failureText) || undefined;
  const failed = status === 0 || status < 0 || !!error;
  const encoding = (headerValue(res.headers, 'content-encoding') ?? '').toLowerCase();
  return {
    i,
    method: asStr(req.method) || 'GET',
    url,
    host: u.host,
    path: u.path + (u.query ? '?' + u.query : ''),
    status,
    statusText: asStr(res.statusText),
    mime,
    type: classify(mime, asStr(entry._resourceType), url),
    size,
    contentSize,
    time,
    start: Number.isNaN(started) ? 0 : started - t0,
    segs: segmentsOf(entry.timings, time),
    failed,
    error,
    fromCache: (transferSize === 0 && status !== 0) || (status === 304 ? false : size === 0 && status >= 200 && status < 300 && contentSize > 0),
    protocol: asStr(res.httpVersion) || asStr(req.httpVersion),
    serverIp: asStr(entry.serverIPAddress),
    redirect: asStr(res.redirectURL) || headerValue(res.headers, 'location') || '',
    compressed: encoding !== '' && encoding !== 'identity',
  };
}

export interface HarSummary {
  rows: Row[];
  t0: number;
  /** End of the last request relative to t0. */
  span: number;
  creator: string;
  browser: string;
  version: string;
  pages: { title: string; started: number; onContentLoad: number; onLoad: number }[];
}

export function summarizeHar(har: HarFile): HarSummary {
  const entries = har.log.entries;
  let t0 = Infinity;
  for (const e of entries) {
    const t = Date.parse(asStr(asRec(e)?.startedDateTime));
    if (!Number.isNaN(t) && t < t0) t0 = t;
  }
  if (!Number.isFinite(t0)) t0 = 0;
  const rows: Row[] = [];
  let span = 0;
  entries.forEach((e, i) => {
    const row = entryRow(asRec(e) ?? {}, i, t0);
    rows.push(row);
    span = Math.max(span, row.start + row.time);
  });
  const creator = asRec(har.log.creator);
  const browser = asRec(har.log.browser);
  const pages = asArr(har.log.pages).map((p) => {
    const r = asRec(p) ?? {};
    const pt = asRec(r.pageTimings) ?? {};
    const started = Date.parse(asStr(r.startedDateTime));
    return {
      title: asStr(r.title),
      started: Number.isNaN(started) ? 0 : started - t0,
      onContentLoad: asNum(pt.onContentLoad, -1),
      onLoad: asNum(pt.onLoad, -1),
    };
  });
  return {
    rows,
    t0,
    span,
    creator: creator ? `${asStr(creator.name)} ${asStr(creator.version)}`.trim() : '',
    browser: browser ? `${asStr(browser.name)} ${asStr(browser.version)}`.trim() : '',
    version: asStr(har.log.version),
    pages,
  };
}

// ---------------------------------------------------------------------------
// Filtering / sorting
// ---------------------------------------------------------------------------

export type StatusClass = '1xx' | '2xx' | '3xx' | '4xx' | '5xx' | 'failed';
export type SortKey = 'i' | 'method' | 'status' | 'host' | 'path' | 'type' | 'size' | 'time' | 'start';

export function statusClassOf(r: Row): StatusClass {
  if (r.failed) return 'failed';
  if (r.status >= 500) return '5xx';
  if (r.status >= 400) return '4xx';
  if (r.status >= 300) return '3xx';
  if (r.status >= 200) return '2xx';
  return '1xx';
}

export interface ViewOptions {
  text: string;
  types: ResourceType[];
  statuses: StatusClass[];
  sort: SortKey;
  desc: boolean;
}

function parseSize(s: string): number {
  const m = /^(\d+(?:\.\d+)?)([kmg]?)b?$/i.exec(s);
  if (!m) return NaN;
  const mult = { '': 1, k: 1024, m: 1048576, g: 1073741824 }[(m[2] ?? '').toLowerCase() as '' | 'k' | 'm' | 'g'];
  return Number(m[1]) * mult;
}

/** Text query: space separated terms; `status:404`, `method:post`, `host:x`, `mime:json`, `larger:100k`, `slower:500`, `-term` negates. */
export function compileFilter(text: string): (r: Row) => boolean {
  const terms = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return () => true;
  const tests: ((r: Row) => boolean)[] = terms.map((raw) => {
    const neg = raw.startsWith('-') && raw.length > 1;
    const t = neg ? raw.slice(1) : raw;
    let f: (r: Row) => boolean;
    const kv = /^([a-z]+):(.+)$/.exec(t);
    if (kv) {
      const k = kv[1];
      const v = kv[2] ?? '';
      switch (k) {
        case 'status':
          f = (r) => String(r.status).startsWith(v);
          break;
        case 'method':
          f = (r) => r.method.toLowerCase() === v;
          break;
        case 'host':
        case 'domain':
          f = (r) => r.host.includes(v);
          break;
        case 'mime':
          f = (r) => r.mime.includes(v);
          break;
        case 'larger': {
          const n = parseSize(v);
          f = (r) => Math.max(r.size, r.contentSize) > n;
          break;
        }
        case 'slower': {
          const n = Number(v);
          f = (r) => r.time > n;
          break;
        }
        default:
          f = (r) => r.url.toLowerCase().includes(t);
      }
    } else {
      f = (r) => r.url.toLowerCase().includes(t) || r.method.toLowerCase() === t || String(r.status) === t || r.mime.includes(t);
    }
    return neg ? (r) => !f(r) : f;
  });
  return (r) => tests.every((f) => f(r));
}

export function buildView(rows: Row[], o: ViewOptions): number[] {
  const test = compileFilter(o.text);
  const typeSet = new Set(o.types);
  const statusSet = new Set(o.statuses);
  const idx: number[] = [];
  for (let k = 0; k < rows.length; k++) {
    const r = rows[k];
    if (!r) continue;
    if (typeSet.size > 0 && !typeSet.has(r.type)) continue;
    if (statusSet.size > 0 && !statusSet.has(statusClassOf(r))) continue;
    if (!test(r)) continue;
    idx.push(k);
  }
  const dir = o.desc ? -1 : 1;
  const val = (r: Row): string | number => {
    switch (o.sort) {
      case 'i':
        return r.i;
      case 'method':
        return r.method;
      case 'status':
        return r.status;
      case 'host':
        return r.host;
      case 'path':
        return r.path;
      case 'type':
        return r.type;
      case 'size':
        return r.size;
      case 'time':
        return r.time;
      case 'start':
        return r.start;
    }
  };
  if (o.sort !== 'i' || o.desc) {
    idx.sort((a, b) => {
      const ra = rows[a];
      const rb = rows[b];
      if (!ra || !rb) return 0;
      const va = val(ra);
      const vb = val(rb);
      if (va < vb) return -dir;
      if (va > vb) return dir;
      return a - b;
    });
  }
  return idx;
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

export interface DomainStat {
  host: string;
  count: number;
  bytes: number;
  firstParty: boolean;
}

export interface RedirectChain {
  indices: number[];
  finalStatus: number;
  looped: boolean;
}

export interface Insights {
  total: number;
  transferred: number;
  contentBytes: number;
  span: number;
  slowest: number[];
  largest: number[];
  errors: number[];
  failed: number;
  clientErrors: number;
  serverErrors: number;
  domains: DomainStat[];
  firstPartyHost: string;
  thirdPartyCount: number;
  thirdPartyBytes: number;
  uncompressed: { i: number; saving: number }[];
  uncompressedSavings: number;
  missingCache: { i: number; reason: string }[];
  redirects: RedirectChain[];
  byType: { type: ResourceType; count: number; bytes: number }[];
  byStatus: { cls: StatusClass; count: number }[];
  protocols: { protocol: string; count: number }[];
}

const TEXT_MIME = /^(text\/|application\/(json|javascript|x-javascript|xml|xhtml\+xml|ld\+json|manifest\+json|x-www-form-urlencoded)|image\/svg\+xml)|\+(json|xml)$/;

export function isTextMime(m: string): boolean {
  return TEXT_MIME.test(mimeBase(m));
}

function resolveUrl(base: string, loc: string): string {
  try {
    return new URL(loc, base).href;
  } catch {
    return loc;
  }
}

export function computeInsights(har: HarFile, summary: HarSummary): Insights {
  const rows = summary.rows;
  const entries = har.log.entries;
  const n = rows.length;
  let transferred = 0;
  let contentBytes = 0;
  const counts = { failed: 0, c4: 0, c5: 0 };
  const errors: number[] = [];
  const domainMap = new Map<string, DomainStat>();
  const byType = new Map<ResourceType, { count: number; bytes: number }>();
  const byStatus = new Map<StatusClass, number>();
  const protocols = new Map<string, number>();
  let firstPartyHost = '';
  for (const r of rows) {
    if (r.type === 'doc' && r.host && r.status >= 200 && r.status < 300) {
      firstPartyHost = r.host;
      break;
    }
  }
  if (!firstPartyHost) firstPartyHost = rows.find((r) => r.host)?.host ?? '';
  const firstOrg = orgDomain(firstPartyHost);
  let thirdPartyCount = 0;
  let thirdPartyBytes = 0;
  for (const r of rows) {
    const bytes = Math.max(0, r.size);
    transferred += bytes;
    contentBytes += Math.max(0, r.contentSize);
    const sc = statusClassOf(r);
    byStatus.set(sc, (byStatus.get(sc) ?? 0) + 1);
    if (r.failed) counts.failed++;
    else if (r.status >= 500) counts.c5++;
    else if (r.status >= 400) counts.c4++;
    if (r.failed || r.status >= 400) errors.push(r.i);
    const d = domainMap.get(r.host) ?? { host: r.host, count: 0, bytes: 0, firstParty: orgDomain(r.host) === firstOrg };
    d.count++;
    d.bytes += bytes;
    domainMap.set(r.host, d);
    if (!d.firstParty) {
      thirdPartyCount++;
      thirdPartyBytes += bytes;
    }
    const t = byType.get(r.type) ?? { count: 0, bytes: 0 };
    t.count++;
    t.bytes += bytes;
    byType.set(r.type, t);
    if (r.protocol) protocols.set(r.protocol, (protocols.get(r.protocol) ?? 0) + 1);
  }
  const order = rows.map((_, i) => i);
  const slowest = order.slice().sort((a, b) => (rows[b]?.time ?? 0) - (rows[a]?.time ?? 0)).slice(0, 10);
  const largest = order.slice().sort((a, b) => Math.max(rows[b]?.size ?? 0, rows[b]?.contentSize ?? 0) - Math.max(rows[a]?.size ?? 0, rows[a]?.contentSize ?? 0)).slice(0, 10);

  const uncompressed: { i: number; saving: number }[] = [];
  const missingCache: { i: number; reason: string }[] = [];
  for (let i = 0; i < n; i++) {
    const r = rows[i];
    const e = asRec(entries[i]);
    if (!r || !e) continue;
    const res = asRec(e.response) ?? {};
    const req = asRec(e.request) ?? {};
    if (r.status >= 200 && r.status < 300 && isTextMime(r.mime) && r.contentSize >= 1024 && !r.compressed && r.size !== 0 && r.method === 'GET') {
      uncompressed.push({ i, saving: Math.round(r.contentSize * 0.7) });
    }
    if (r.method === 'GET' && r.status === 200 && (r.type === 'js' || r.type === 'css' || r.type === 'img' || r.type === 'font') && asStr(req.url).startsWith('http')) {
      const cc = (headerValue(res.headers, 'cache-control') ?? '').toLowerCase();
      const expires = headerValue(res.headers, 'expires');
      const etag = headerValue(res.headers, 'etag');
      const lm = headerValue(res.headers, 'last-modified');
      if (/no-store/.test(cc)) missingCache.push({ i, reason: 'Cache-Control: no-store' });
      else if (/no-cache/.test(cc)) missingCache.push({ i, reason: 'Cache-Control: no-cache (must revalidate every time)' });
      else if (/max-age=0\b/.test(cc) && !/s-maxage/.test(cc)) missingCache.push({ i, reason: 'max-age=0' });
      else if (!cc && !expires && !etag && !lm) missingCache.push({ i, reason: 'no Cache-Control, Expires, ETag or Last-Modified' });
      else if (!cc && !expires) missingCache.push({ i, reason: 'only validators (ETag/Last-Modified), no explicit freshness lifetime' });
    }
  }

  // redirect chains
  const redirects: RedirectChain[] = [];
  const isRedirect = (r: Row) => r.status >= 300 && r.status < 400 && r.redirect !== '';
  const targeted = new Set<number>();
  const byUrl = new Map<string, number[]>();
  rows.forEach((r, i) => {
    const list = byUrl.get(r.url) ?? [];
    list.push(i);
    byUrl.set(r.url, list);
  });
  const nextOf = (i: number): number | undefined => {
    const r = rows[i];
    if (!r || !isRedirect(r)) return undefined;
    const target = resolveUrl(r.url, r.redirect);
    const cands = byUrl.get(target) ?? byUrl.get(target.replace(/#.*$/, ''));
    if (!cands) return undefined;
    return cands.find((c) => c > i);
  };
  rows.forEach((r, i) => {
    if (isRedirect(r)) {
      const nx = nextOf(i);
      if (nx !== undefined) targeted.add(nx);
    }
  });
  rows.forEach((r, i) => {
    if (!isRedirect(r) || targeted.has(i)) return;
    const chain = [i];
    const seen = new Set<number>(chain);
    let cur = i;
    let looped = false;
    for (;;) {
      const nx = nextOf(cur);
      if (nx === undefined) break;
      if (seen.has(nx)) {
        looped = true;
        break;
      }
      chain.push(nx);
      seen.add(nx);
      cur = nx;
      if (chain.length > 50) break;
    }
    const last = rows[chain[chain.length - 1] ?? i];
    redirects.push({ indices: chain, finalStatus: last?.status ?? 0, looped });
  });
  redirects.sort((a, b) => b.indices.length - a.indices.length);

  return {
    total: n,
    transferred,
    contentBytes,
    span: summary.span,
    slowest,
    largest,
    errors,
    failed: counts.failed,
    clientErrors: counts.c4,
    serverErrors: counts.c5,
    domains: Array.from(domainMap.values()).sort((a, b) => b.count - a.count || b.bytes - a.bytes),
    firstPartyHost,
    thirdPartyCount,
    thirdPartyBytes,
    uncompressed: uncompressed.sort((a, b) => b.saving - a.saving),
    uncompressedSavings: uncompressed.reduce((s, x) => s + x.saving, 0),
    missingCache,
    redirects,
    byType: Array.from(byType.entries()).map(([type, v]) => ({ type, ...v })).sort((a, b) => b.bytes - a.bytes),
    byStatus: Array.from(byStatus.entries()).map(([cls, count]) => ({ cls, count })).sort((a, b) => a.cls.localeCompare(b.cls)),
    protocols: Array.from(protocols.entries()).map(([protocol, count]) => ({ protocol, count })).sort((a, b) => b.count - a.count),
  };
}

// ---------------------------------------------------------------------------
// Entry details / content preview
// ---------------------------------------------------------------------------

export interface EntryDetail {
  general: NameValue[];
  requestHeaders: NameValue[];
  responseHeaders: NameValue[];
  query: NameValue[];
  requestCookies: Rec[];
  responseCookies: Rec[];
  post: { mimeType: string; text?: string; params: NameValue[] } | null;
  timings: { key: string; ms: number }[];
  comment?: string;
}

function cookieList(arr: unknown, headers: NameValue[], setCookie: boolean): Rec[] {
  const direct = asArr(arr).map((c) => asRec(c)).filter((c): c is Rec => !!c);
  if (direct.length > 0) return direct;
  const out: Rec[] = [];
  for (const h of headers) {
    const l = h.name.toLowerCase();
    if (setCookie && l === 'set-cookie') {
      const parts = h.value.split(';');
      const first = parts.shift() ?? '';
      const eq = first.indexOf('=');
      const c: Rec = { name: first.slice(0, eq < 0 ? undefined : eq).trim(), value: eq < 0 ? '' : first.slice(eq + 1).trim() };
      for (const p of parts) {
        const e = p.indexOf('=');
        const k = (e < 0 ? p : p.slice(0, e)).trim().toLowerCase();
        const v = e < 0 ? true : p.slice(e + 1).trim();
        if (k === 'httponly') c.httpOnly = true;
        else if (k === 'secure') c.secure = true;
        else if (k) c[k] = v;
      }
      out.push(c);
    } else if (!setCookie && l === 'cookie') {
      for (const p of h.value.split(';')) {
        const e = p.indexOf('=');
        if (p.trim()) out.push({ name: (e < 0 ? p : p.slice(0, e)).trim(), value: e < 0 ? '' : p.slice(e + 1).trim() });
      }
    }
  }
  return out;
}

export function entryDetail(entry: Rec): EntryDetail {
  const req = asRec(entry.request) ?? {};
  const res = asRec(entry.response) ?? {};
  const reqHeaders = nameValues(req.headers);
  const resHeaders = nameValues(res.headers);
  const url = asStr(req.url);
  const u = splitUrl(url);
  const query = nameValues(req.queryString);
  const post = asRec(req.postData);
  const timings = asRec(entry.timings) ?? {};
  const general: NameValue[] = [
    { name: 'Request URL', value: url },
    { name: 'Request method', value: asStr(req.method) },
    { name: 'Status', value: `${asNum(res.status)} ${asStr(res.statusText)}`.trim() },
    { name: 'HTTP version', value: asStr(res.httpVersion) || asStr(req.httpVersion) },
    { name: 'Remote address', value: asStr(entry.serverIPAddress) + (entry.connection ? ` (connection ${asStr(entry.connection)})` : '') },
    { name: 'Started', value: asStr(entry.startedDateTime) },
    { name: 'Total time', value: `${asNum(entry.time).toFixed(1)} ms` },
    { name: 'Resource type', value: asStr(entry._resourceType) },
    { name: 'Redirect URL', value: asStr(res.redirectURL) },
    { name: 'Initiator', value: asStr(asRec(entry._initiator)?.url) || asStr(asRec(entry._initiator)?.type) },
    { name: 'Request size', value: `headers ${asNum(req.headersSize, -1)} B, body ${asNum(req.bodySize, -1)} B` },
    { name: 'Response size', value: `headers ${asNum(res.headersSize, -1)} B, body ${asNum(res.bodySize, -1)} B${typeof res._transferSize === 'number' ? `, transferred ${res._transferSize} B` : ''}` },
  ].filter((x) => x.value.trim() !== '' && x.value.trim() !== '()');
  return {
    general,
    requestHeaders: reqHeaders,
    responseHeaders: resHeaders,
    query: query.length > 0 ? query : parseQuery(u.query),
    requestCookies: cookieList(req.cookies, reqHeaders, false),
    responseCookies: cookieList(res.cookies, resHeaders, true),
    post: post
      ? {
          mimeType: asStr(post.mimeType),
          text: typeof post.text === 'string' ? post.text : undefined,
          params: nameValues(post.params),
        }
      : null,
    timings: ['blocked', 'dns', 'connect', 'ssl', 'send', 'wait', 'receive']
      .map((key) => ({ key, ms: asNum(timings[key], -1) }))
      .filter((t) => t.ms >= 0),
    comment: asStr(entry.comment) || undefined,
  };
}

export type ContentPreview =
  | { kind: 'empty'; note: string }
  | { kind: 'image'; dataUrl: string; mime: string }
  | { kind: 'json'; text: string; truncated: boolean }
  | { kind: 'text'; text: string; truncated: boolean; mime: string }
  | { kind: 'binary'; size: number; mime: string };

const PREVIEW_CHARS = 200_000;

function b64Size(b64: string): number {
  const t = b64.replace(/\s+/g, '');
  const pad = t.endsWith('==') ? 2 : t.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((t.length * 3) / 4) - pad);
}

function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, '');
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function previewContent(content: unknown, size = -1): ContentPreview {
  const c = asRec(content);
  if (!c) return { kind: 'empty', note: 'No response content recorded.' };
  const mime = mimeBase(asStr(c.mimeType));
  const text = typeof c.text === 'string' ? c.text : undefined;
  if (text === undefined || text === '') {
    return { kind: 'empty', note: `No body was saved in the HAR${asNum(c.size) > 0 ? ` (${asNum(c.size)} bytes were transferred)` : ''}. Browsers often omit bodies unless "Save as HAR with content" is used.` };
  }
  const isB64 = asStr(c.encoding).toLowerCase() === 'base64';
  if (mime.startsWith('image/')) {
    if (isB64) {
      if (text.length > 6_000_000) return { kind: 'binary', size: b64Size(text), mime };
      return { kind: 'image', dataUrl: `data:${mime};base64,${text.replace(/\s+/g, '')}`, mime };
    }
    if (mime === 'image/svg+xml') return { kind: 'image', dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`, mime };
    return { kind: 'binary', size: text.length, mime };
  }
  let body = text;
  if (isB64) {
    if (!isTextMime(mime)) return { kind: 'binary', size: b64Size(text), mime };
    try {
      body = new TextDecoder('utf-8').decode(b64ToBytes(text.length > PREVIEW_CHARS * 2 ? text.slice(0, PREVIEW_CHARS * 2 - ((PREVIEW_CHARS * 2) % 4)) : text));
    } catch {
      return { kind: 'binary', size: b64Size(text), mime };
    }
  } else if (!isTextMime(mime) && /[\u0000-\u0008\u000e-\u001f]/.test(text.slice(0, 2000)) && size !== 0) {
    return { kind: 'binary', size: text.length, mime };
  }
  if ((mime.includes('json') || /^\s*[{[]/.test(body.slice(0, 20))) && body.length <= 2_000_000) {
    try {
      const pretty = JSON.stringify(JSON.parse(body), null, 2);
      return { kind: 'json', text: pretty.slice(0, PREVIEW_CHARS), truncated: pretty.length > PREVIEW_CHARS };
    } catch {
      /* fall through to plain text */
    }
  }
  return { kind: 'text', text: body.slice(0, PREVIEW_CHARS), truncated: body.length > PREVIEW_CHARS, mime };
}

export function prettyBody(text: string, mime: string): { text: string; json: boolean } {
  const m = mimeBase(mime);
  if ((m.includes('json') || /^\s*[{[]/.test(text.slice(0, 20))) && text.length <= 2_000_000) {
    try {
      return { text: JSON.stringify(JSON.parse(text), null, 2), json: true };
    } catch {
      /* not JSON */
    }
  }
  return { text, json: false };
}

// ---------------------------------------------------------------------------
// Sanitiser
// ---------------------------------------------------------------------------

export type Category =
  | 'cookies'
  | 'authorization'
  | 'apiKeys'
  | 'queryParams'
  | 'bodyFields'
  | 'responseBodies'
  | 'jwt'
  | 'emails'
  | 'ips';

export const CATEGORY_LABELS: Record<Category, string> = {
  cookies: 'Cookies',
  authorization: 'Authorization headers',
  apiKeys: 'API-key style headers',
  queryParams: 'Sensitive query parameters',
  bodyFields: 'Request/response body fields',
  responseBodies: 'Response bodies',
  jwt: 'JWT-looking strings',
  emails: 'Email addresses',
  ips: 'IP addresses',
};

export interface SanitizeOptions {
  cookies: boolean;
  authorization: boolean;
  apiKeys: boolean;
  apiKeyNames: string[];
  queryParams: boolean;
  sensitiveNames: string[];
  bodyFields: boolean;
  jsonResponseFields: boolean;
  responseBodies: 'none' | 'all' | 'html-json';
  jwt: boolean;
  emails: boolean;
  ips: boolean;
  placeholder: 'redacted' | 'hash';
}

export const DEFAULT_API_KEY_NAMES = [
  'x-api-key', 'x-auth-token', 'x-csrf-token', 'x-xsrf-token', 'x-access-token', 'x-amz-security-token', 'x-goog-api-key', 'x-api-token',
  'api-key', 'apikey', 'x-session-token', 'x-secret-key', 'x-client-secret', 'x-auth-key', 'x-token', 'x-forwarded-access-token',
  '*token*', '*secret*', '*api-key*', '*apikey*', '*password*', '*credential*', 'x-*-key',
];

export const DEFAULT_SENSITIVE_NAMES = [
  'token', 'key', 'code', 'state', 'password', 'passwd', 'pwd', 'secret', 'signature', 'sig', 'access_token', 'id_token', 'refresh_token', 'api_key', 'apikey',
  'auth', 'authorization', 'client_secret', 'session', 'sessionid', 'session_id', 'sid', 'otp', 'jwt', 'bearer', 'credential', 'x-amz-signature',
  'x-amz-credential', 'x-amz-security-token', 'csrf_token', 'authenticity_token', 'private_key',
];

export const DEFAULT_SANITIZE_OPTIONS: SanitizeOptions = {
  cookies: true,
  authorization: true,
  apiKeys: true,
  apiKeyNames: DEFAULT_API_KEY_NAMES,
  queryParams: true,
  sensitiveNames: DEFAULT_SENSITIVE_NAMES,
  bodyFields: true,
  jsonResponseFields: true,
  responseBodies: 'none',
  jwt: true,
  emails: false,
  ips: false,
  placeholder: 'redacted',
};

export interface RedactionExample {
  category: Category;
  where: string;
  name: string;
  entry: number;
  placeholder: string;
}

export interface SanitizeReport {
  counts: Record<Category, number>;
  total: number;
  entriesTouched: number;
  entries: number;
  examples: RedactionExample[];
  names: Record<Category, string[]>;
}

function emptyCounts(): Record<Category, number> {
  return { cookies: 0, authorization: 0, apiKeys: 0, queryParams: 0, bodyFields: 0, responseBodies: 0, jwt: 0, emails: 0, ips: 0 };
}

interface Ctx {
  o: SanitizeOptions;
  counts: Record<Category, number>;
  names: Record<Category, Set<string>>;
  apiKeyMatchers: RegExp[];
  nameMatchers: RegExp[];
  entry: number;
  where: string;
  examples: RedactionExample[];
  touched: boolean;
}

export const REDACTED = '[REDACTED]';

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // second round with length mixed in to widen the hash to 64 bits of hex
  let h2 = 0xcbf29ce4 ^ s.length;
  for (let i = s.length - 1; i >= 0; i--) {
    h2 ^= s.charCodeAt(i);
    h2 = Math.imul(h2, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

function ph(ctx: Ctx, cat: Category, original: string, name = '', count = true): string {
  const out = ctx.o.placeholder === 'hash' ? `[REDACTED:${fnv1a(original)}]` : REDACTED;
  ctx.touched = true;
  if (!count) return out;
  ctx.counts[cat]++;
  if (name) ctx.names[cat].add(name);
  if (ctx.examples.length < 60 && !ctx.examples.some((e) => e.category === cat && e.where === ctx.where && e.name === name)) {
    ctx.examples.push({ category: cat, where: ctx.where, name, entry: ctx.entry, placeholder: out });
  }
  return out;
}

function globToRegex(g: string): RegExp {
  const esc = g.trim().toLowerCase().replace(/[.+^${}()|[\]\\?]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${esc}$`);
}

function matches(list: RegExp[], name: string): boolean {
  const l = name.toLowerCase();
  for (const re of list) if (re.test(l)) return true;
  return false;
}

const JWT_RE = /\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]*/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const IPV4_RE = /(?<![\w.-])(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?![\w-]|\.\d)/g;
const IPV6_RE = /(?<![\w:.])(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(?![\w:])/g;

function validIpv6(s: string): boolean {
  if (!/^[0-9a-fA-F:]+$/.test(s)) return false;
  if (s.includes(':::')) return false;
  const dbl = s.split('::').length - 1;
  if (dbl > 1) return false;
  const groups = s.split(':').filter((g) => g !== '');
  if (groups.some((g) => g.length > 4)) return false;
  if (dbl === 1) return groups.length <= 7 && s.length >= 3;
  return s.split(':').length === 8 && groups.length === 8;
}

const INLINE_PARAM_RE = /(\?|&amp;|&|#)([A-Za-z0-9_.%-]{1,64})=([^&\s"'<>#)]*)/g;

function genericPass(s: string, ctx: Ctx, skipIps = false): string {
  if (s.length < 4) return s;
  let out = s;
  const o = ctx.o;
  if (o.queryParams && out.includes('=') && /[?&#]/.test(out)) {
    out = out.replace(INLINE_PARAM_RE, (m, lead: string, rawName: string, value: string) => {
      if (value === '' || value.startsWith('[REDACTED')) return m;
      let name = rawName;
      try {
        name = decodeURIComponent(rawName);
      } catch {
        /* raw */
      }
      return matches(ctx.nameMatchers, name) ? `${lead}${rawName}=${ph(ctx, 'queryParams', value, name.toLowerCase())}` : m;
    });
  }
  if (o.jwt && out.includes('eyJ')) out = out.replace(JWT_RE, (m) => ph(ctx, 'jwt', m));
  if (o.emails && out.includes('@')) out = out.replace(EMAIL_RE, (m) => ph(ctx, 'emails', m));
  if (o.ips && !skipIps) {
    if (out.includes('.')) out = out.replace(IPV4_RE, (m) => ph(ctx, 'ips', m));
    if (out.includes(':')) out = out.replace(IPV6_RE, (m) => (validIpv6(m) ? ph(ctx, 'ips', m) : m));
  }
  return out;
}

function redactQueryString(q: string, ctx: Ctx, count: boolean): string {
  if (!q || !ctx.o.queryParams) return q;
  let changed = false;
  const parts = q.split('&').map((p) => {
    const eq = p.indexOf('=');
    if (eq < 0) return p;
    const rawName = p.slice(0, eq);
    let name = rawName;
    try {
      name = decodeURIComponent(rawName.replace(/\+/g, ' '));
    } catch {
      /* keep raw */
    }
    const value = p.slice(eq + 1);
    if (value !== '' && !value.startsWith('[REDACTED') && matches(ctx.nameMatchers, name)) {
      changed = true;
      return `${rawName}=${ph(ctx, 'queryParams', value, name.toLowerCase(), count)}`;
    }
    return p;
  });
  return changed ? parts.join('&') : q;
}

/** Redact sensitive query/fragment parameters inside a URL-ish string. */
export function redactUrl(url: string, ctx: Ctx, count = true): string {
  if (!ctx.o.queryParams || (!url.includes('?') && !url.includes('#'))) return url;
  const hashAt = url.indexOf('#');
  const base = hashAt >= 0 ? url.slice(0, hashAt) : url;
  let frag = hashAt >= 0 ? url.slice(hashAt + 1) : '';
  const qAt = base.indexOf('?');
  let head = qAt >= 0 ? base.slice(0, qAt) : base;
  let query = qAt >= 0 ? base.slice(qAt + 1) : '';
  query = redactQueryString(query, ctx, count);
  if (frag.includes('=')) frag = redactQueryString(frag, ctx, count);
  head = qAt >= 0 ? head + '?' : head;
  return head + query + (hashAt >= 0 ? '#' + frag : '');
}

function redactCookieHeader(v: string, ctx: Ctx, isSetCookie: boolean): string {
  if (isSetCookie) {
    const semi = v.indexOf(';');
    const first = semi < 0 ? v : v.slice(0, semi);
    const rest = semi < 0 ? '' : v.slice(semi);
    const eq = first.indexOf('=');
    if (eq < 0) return v;
    const val = first.slice(eq + 1).trim();
    if (val === '' || val.startsWith('[REDACTED')) return v;
    return `${first.slice(0, eq + 1)}${ph(ctx, 'cookies', val, first.slice(0, eq).trim())}${rest}`;
  }
  return v
    .split(';')
    .map((p) => {
      const eq = p.indexOf('=');
      if (eq < 0) return p;
      const val = p.slice(eq + 1).trim();
      if (val === '' || val.startsWith('[REDACTED')) return p;
      return `${p.slice(0, eq + 1)}${ph(ctx, 'cookies', val, p.slice(0, eq).trim())}`;
    })
    .join(';');
}

const URL_HEADERS = new Set(['referer', 'location', 'content-location', 'origin', 'refresh', 'x-original-url', 'x-forwarded-uri']);
const NO_IP_HEADERS = new Set(['user-agent', 'sec-ch-ua', 'sec-ch-ua-full-version-list', 'sec-ch-ua-full-version', 'server', 'x-powered-by', 'via', 'accept', 'accept-language']);

function hasHeader(headers: unknown, lname: string): boolean {
  return headerValue(headers, lname) !== undefined;
}

function sanitizeHeaders(headers: unknown, ctx: Ctx, side: 'request' | 'response'): unknown {
  if (!Array.isArray(headers)) return headers;
  let out: unknown[] | null = null;
  headers.forEach((h, idx) => {
    const r = asRec(h);
    if (!r || typeof r.value !== 'string') return;
    const name = asStr(r.name);
    const l = name.toLowerCase();
    let v = r.value;
    ctx.where = `${side} header ${name}`;
    if (ctx.o.cookies && (l === 'cookie' || l === 'set-cookie' || l === 'set-cookie2')) v = redactCookieHeader(v, ctx, l !== 'cookie');
    else if (ctx.o.authorization && (l === 'authorization' || l === 'proxy-authorization') && !v.startsWith('[REDACTED')) {
      const m = /^([A-Za-z][\w-]*)\s+(\S.*)$/.exec(v);
      if (!m) v = ph(ctx, 'authorization', v, name.toLowerCase());
      else if (!(m[2] ?? '').startsWith('[REDACTED')) v = `${m[1]} ${ph(ctx, 'authorization', m[2] ?? '', name.toLowerCase())}`;
    } else if (ctx.o.apiKeys && matches(ctx.apiKeyMatchers, l) && v !== '' && !v.startsWith('[REDACTED')) v = ph(ctx, 'apiKeys', v, l);
    else if (ctx.o.queryParams && URL_HEADERS.has(l)) v = redactUrl(v, ctx);
    v = genericPass(v, ctx, NO_IP_HEADERS.has(l));
    if (v !== r.value) {
      if (!out) out = headers.slice();
      out[idx] = { ...r, value: v };
    }
  });
  return out ?? headers;
}

function sanitizeCookieArray(cookies: unknown, ctx: Ctx, side: 'request' | 'response', count: boolean): unknown {
  if (!Array.isArray(cookies)) return cookies;
  let out: unknown[] | null = null;
  cookies.forEach((c, idx) => {
    const r = asRec(c);
    if (!r) return;
    let nr: Rec = r;
    ctx.where = `${side} cookies[]`;
    if (typeof r.value === 'string' && r.value !== '' && !r.value.startsWith('[REDACTED') && ctx.o.cookies) {
      nr = { ...nr, value: ph(ctx, 'cookies', r.value, asStr(r.name), count) };
    }
    for (const k of ['value', 'path', 'domain', 'comment']) {
      const cur = nr[k];
      if (typeof cur === 'string') {
        const g = genericPass(cur, ctx);
        if (g !== cur) nr = nr === r ? { ...r, [k]: g } : { ...nr, [k]: g };
      }
    }
    if (nr !== r) {
      if (!out) out = cookies.slice();
      out[idx] = nr;
    }
  });
  return out ?? cookies;
}

// --- body field redaction -------------------------------------------------

function redactJsonValue(v: unknown, ctx: Ctx, where: string): unknown {
  if (Array.isArray(v)) {
    let out: unknown[] | null = null;
    v.forEach((x, i) => {
      const n = redactJsonValue(x, ctx, where);
      if (n !== x) {
        if (!out) out = v.slice();
        out[i] = n;
      }
    });
    return out ?? v;
  }
  if (isRec(v)) {
    let out: Rec | null = null;
    for (const k of Object.keys(v)) {
      const x = v[k];
      let n: unknown;
      if (matches(ctx.nameMatchers, k) && x !== null && x !== '' && x !== undefined && typeof x !== 'boolean') {
        if (typeof x === 'object') {
          // redact everything below a sensitive key
          n = redactAll(x, ctx, k);
        } else if (typeof x === 'string' && x.startsWith('[REDACTED')) {
          n = x;
        } else {
          n = ph(ctx, 'bodyFields', String(x), k.toLowerCase());
        }
      } else {
        n = redactJsonValue(x, ctx, where);
      }
      if (n !== x) {
        if (!out) out = { ...v };
        out[k] = n;
      }
    }
    return out ?? v;
  }
  if (typeof v === 'string') return genericPass(v, ctx);
  return v;
}

function redactAll(v: unknown, ctx: Ctx, key: string): unknown {
  if (Array.isArray(v)) return v.map((x) => redactAll(x, ctx, key));
  if (isRec(v)) {
    const out: Rec = {};
    for (const k of Object.keys(v)) out[k] = redactAll(v[k], ctx, key);
    return out;
  }
  if (typeof v === 'string' && v !== '' && !v.startsWith('[REDACTED')) return ph(ctx, 'bodyFields', v, key.toLowerCase());
  if (typeof v === 'number') return ph(ctx, 'bodyFields', String(v), key.toLowerCase());
  return v;
}

function detectIndent(text: string): number | string | undefined {
  const m = /\n([ \t]+)\S/.exec(text);
  if (!m) return undefined;
  const ws = m[1] ?? '';
  return ws.includes('\t') ? '\t' : ws.length;
}

function redactFormEncoded(text: string, ctx: Ctx): string {
  return text
    .split('&')
    .map((p) => {
      const eq = p.indexOf('=');
      if (eq < 0) return p;
      let name = p.slice(0, eq);
      try {
        name = decodeURIComponent(name.replace(/\+/g, ' '));
      } catch {
        /* raw */
      }
      const value = p.slice(eq + 1);
      if (value !== '' && !value.startsWith('[REDACTED') && matches(ctx.nameMatchers, name)) return `${p.slice(0, eq)}=${ph(ctx, 'bodyFields', value, name.toLowerCase())}`;
      return p;
    })
    .join('&');
}

function redactMultipart(text: string, ctx: Ctx): string {
  return text.replace(/(name="([^"]*)"[^\r\n]*\r?\n(?:[^\r\n]+\r?\n)*\r?\n)([^\r\n]*)/g, (m, head: string, name: string, value: string) => {
    if (value !== '' && !value.startsWith('[REDACTED') && matches(ctx.nameMatchers, name)) return head + ph(ctx, 'bodyFields', value, name.toLowerCase());
    return m;
  });
}

function redactJsonLike(text: string, ctx: Ctx): string {
  // fallback for JSON that does not parse: "key": "value" pairs
  return text.replace(/("([^"\\]+)"\s*:\s*)("(?:[^"\\]|\\.)*"|[^\s,}\]]+)/g, (m, head: string, key: string, val: string) => {
    if (!matches(ctx.nameMatchers, key) || val === '""' || val.startsWith('"[REDACTED') || val === 'null') return m;
    return `${head}"${ph(ctx, 'bodyFields', val, key.toLowerCase()).replace(/"/g, '')}"`;
  });
}

export function sanitizeBodyText(text: string, mime: string, ctx: Ctx, fieldRedaction: boolean): string {
  const m = mimeBase(mime);
  let out = text;
  if (fieldRedaction) {
    if (m.includes('json') || /^\s*[{[]/.test(text.slice(0, 20))) {
      try {
        const parsed: unknown = JSON.parse(text);
        const red = redactJsonValue(parsed, ctx, 'body');
        if (red !== parsed) out = JSON.stringify(red, null, detectIndent(text));
      } catch {
        out = redactJsonLike(text, ctx);
      }
    } else if (m === 'application/x-www-form-urlencoded') {
      out = redactFormEncoded(text, ctx);
    } else if (m.startsWith('multipart/form-data')) {
      out = redactMultipart(text, ctx);
    }
  }
  return genericPass(out, ctx);
}

function sanitizeRequest(req: Rec, ctx: Ctx): Rec {
  let out: Rec = req;
  const set = (k: string, v: unknown) => {
    if (out === req) out = { ...req };
    out[k] = v;
  };
  const url = asStr(req.url);
  if (url) {
    ctx.where = 'request URL';
    let nu = redactUrl(url, ctx);
    nu = genericPass(nu, ctx);
    if (nu !== url) set('url', nu);
  }
  const hs = sanitizeHeaders(req.headers, ctx, 'request');
  if (hs !== req.headers) set('headers', hs);
  const ck = sanitizeCookieArray(req.cookies, ctx, 'request', !hasHeader(req.headers, 'cookie'));
  if (ck !== req.cookies) set('cookies', ck);
  if (Array.isArray(req.queryString)) {
    const urlHasQuery = url.includes('?');
    let qs: unknown[] | null = null;
    ctx.where = 'request queryString[]';
    req.queryString.forEach((q, i) => {
      const r = asRec(q);
      if (!r || typeof r.value !== 'string') return;
      let v = r.value;
      const name = asStr(r.name);
      if (ctx.o.queryParams && v !== '' && !v.startsWith('[REDACTED') && matches(ctx.nameMatchers, name)) {
        v = ph(ctx, 'queryParams', v, name.toLowerCase(), !urlHasQuery);
      }
      v = genericPass(v, ctx);
      if (v !== r.value) {
        if (!qs) qs = (req.queryString as unknown[]).slice();
        qs[i] = { ...r, value: v };
      }
    });
    if (qs) set('queryString', qs);
  }
  const post = asRec(req.postData);
  if (post) {
    let np: Rec = post;
    const setP = (k: string, v: unknown) => {
      if (np === post) np = { ...post };
      np[k] = v;
    };
    const mime = asStr(post.mimeType);
    if (typeof post.text === 'string' && post.text !== '') {
      ctx.where = 'request body';
      const t = sanitizeBodyText(post.text, mime, ctx, ctx.o.bodyFields);
      if (t !== post.text) setP('text', t);
    }
    if (Array.isArray(post.params)) {
      const textPresent = typeof post.text === 'string' && post.text !== '';
      let ps: unknown[] | null = null;
      ctx.where = 'request body params[]';
      post.params.forEach((p, i) => {
        const r = asRec(p);
        if (!r || typeof r.value !== 'string') return;
        let v = r.value;
        const name = asStr(r.name);
        if (ctx.o.bodyFields && v !== '' && !v.startsWith('[REDACTED') && matches(ctx.nameMatchers, name)) v = ph(ctx, 'bodyFields', v, name.toLowerCase(), !textPresent);
        v = genericPass(v, ctx);
        if (v !== r.value) {
          if (!ps) ps = (post.params as unknown[]).slice();
          ps[i] = { ...r, value: v };
        }
      });
      if (ps) setP('params', ps);
    }
    if (np !== post) set('postData', np);
  }
  for (const k of Object.keys(req)) {
    if (k.startsWith('_') || k === 'comment') {
      ctx.where = `request ${k}`;
      const v = deepStrings(req[k], ctx);
      if (v !== req[k]) set(k, v);
    }
  }
  return out;
}

function sanitizeResponse(res: Rec, ctx: Ctx): Rec {
  let out: Rec = res;
  const set = (k: string, v: unknown) => {
    if (out === res) out = { ...res };
    out[k] = v;
  };
  const hs = sanitizeHeaders(res.headers, ctx, 'response');
  if (hs !== res.headers) set('headers', hs);
  const ck = sanitizeCookieArray(res.cookies, ctx, 'response', !hasHeader(res.headers, 'set-cookie'));
  if (ck !== res.cookies) set('cookies', ck);
  const redirect = asStr(res.redirectURL);
  if (redirect) {
    ctx.where = 'response redirectURL';
    const nr = genericPass(redactUrl(redirect, ctx), ctx);
    if (nr !== redirect) set('redirectURL', nr);
  }
  const content = asRec(res.content);
  if (content) {
    let nc: Rec = content;
    const setC = (k: string, v: unknown) => {
      if (nc === content) nc = { ...content };
      nc[k] = v;
    };
    const mime = asStr(content.mimeType);
    const m = mimeBase(mime);
    if (typeof content.text === 'string' && content.text !== '' && !content.text.startsWith('[REDACTED')) {
      ctx.where = 'response body';
      const mode = ctx.o.responseBodies;
      const drop = mode === 'all' || (mode === 'html-json' && (m === 'text/html' || m === 'application/xhtml+xml' || m.includes('json')));
      if (drop) {
        setC('text', ctx.o.placeholder === 'hash' ? `[REDACTED:${fnv1a(content.text)}]` : REDACTED);
        ctx.counts.responseBodies++;
        ctx.touched = true;
        if (nc.encoding !== undefined) {
          delete nc.encoding;
        }
        if (ctx.examples.length < 60 && !ctx.examples.some((e) => e.category === 'responseBodies' && e.name === m)) {
          ctx.examples.push({ category: 'responseBodies', where: 'response body', name: m || 'unknown', entry: ctx.entry, placeholder: REDACTED });
        }
      } else if (isTextMime(m) || m === '') {
        const isB64 = asStr(content.encoding).toLowerCase() === 'base64';
        const anyPass = ctx.o.jwt || ctx.o.emails || ctx.o.ips || ctx.o.queryParams || (ctx.o.jsonResponseFields && ctx.o.bodyFields && m.includes('json'));
        if (anyPass) {
          let source = content.text;
          let decoded = false;
          if (isB64) {
            try {
              source = new TextDecoder('utf-8', { fatal: true }).decode(b64ToBytes(content.text));
              decoded = true;
            } catch {
              source = '';
            }
          }
          if (source) {
            const t = sanitizeBodyText(source, mime, ctx, ctx.o.jsonResponseFields && ctx.o.bodyFields && m.includes('json'));
            if (t !== source) {
              if (decoded) {
                const bytes = new TextEncoder().encode(t);
                let bin = '';
                for (let i = 0; i < bytes.length; i += 0x4000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x4000));
                setC('text', btoa(bin));
              } else setC('text', t);
            }
          }
        }
      }
    }
    for (const k of Object.keys(content)) {
      if (k.startsWith('_') || k === 'comment') {
        ctx.where = `response content ${k}`;
        const v = deepStrings(content[k], ctx);
        if (v !== content[k]) setC(k, v);
      }
    }
    if (nc !== content) set('content', nc);
  }
  for (const k of Object.keys(res)) {
    if (k.startsWith('_') || k === 'comment') {
      ctx.where = `response ${k}`;
      const v = deepStrings(res[k], ctx);
      if (v !== res[k]) set(k, v);
    }
  }
  return out;
}

/** Generic string redaction (URLs, JWT, emails, IPs) across an arbitrary JSON value. */
function deepStrings(v: unknown, ctx: Ctx): unknown {
  if (typeof v === 'string') {
    const u = /^https?:\/\//i.test(v) ? redactUrl(v, ctx) : v;
    return genericPass(u, ctx);
  }
  if (Array.isArray(v)) {
    let out: unknown[] | null = null;
    v.forEach((x, i) => {
      const n = deepStrings(x, ctx);
      if (n !== x) {
        if (!out) out = v.slice();
        out[i] = n;
      }
    });
    return out ?? v;
  }
  if (isRec(v)) {
    let out: Rec | null = null;
    for (const k of Object.keys(v)) {
      const x = v[k];
      const n = deepStrings(x, ctx);
      if (n !== x) {
        if (!out) out = { ...v };
        out[k] = n;
      }
    }
    return out ?? v;
  }
  return v;
}

export function makeCtx(o: SanitizeOptions): Ctx {
  const names = {} as Record<Category, Set<string>>;
  for (const k of Object.keys(emptyCounts()) as Category[]) names[k] = new Set();
  return {
    o,
    counts: emptyCounts(),
    names,
    apiKeyMatchers: o.apiKeyNames.filter((x) => x.trim()).map(globToRegex),
    nameMatchers: o.sensitiveNames.filter((x) => x.trim()).map(globToRegex),
    entry: 0,
    where: '',
    examples: [],
    touched: false,
  };
}

export function sanitizeEntry(entry: Rec, ctx: Ctx): Rec {
  let out: Rec = entry;
  const set = (k: string, v: unknown) => {
    if (out === entry) out = { ...entry };
    out[k] = v;
  };
  const req = asRec(entry.request);
  if (req) {
    const n = sanitizeRequest(req, ctx);
    if (n !== req) set('request', n);
  }
  const res = asRec(entry.response);
  if (res) {
    const n = sanitizeResponse(res, ctx);
    if (n !== res) set('response', n);
  }
  if (ctx.o.ips && typeof entry.serverIPAddress === 'string' && entry.serverIPAddress && !entry.serverIPAddress.startsWith('[REDACTED')) {
    ctx.where = 'serverIPAddress';
    set('serverIPAddress', ph(ctx, 'ips', entry.serverIPAddress, 'serverIPAddress'));
  }
  for (const k of Object.keys(entry)) {
    if (k.startsWith('_') || k === 'comment') {
      ctx.where = `entry ${k}`;
      const v = deepStrings(entry[k], ctx);
      if (v !== entry[k]) set(k, v);
    }
  }
  return out;
}

export function sanitizeTopLevel(har: HarFile, ctx: Ctx): { log: Rec } & Rec {
  const log = har.log;
  const newLog: Rec = {};
  for (const k of Object.keys(log)) if (k !== 'entries') newLog[k] = log[k];
  const pages = asArr(log.pages);
  if (pages.length > 0) {
    newLog.pages = pages.map((p, i) => {
      ctx.entry = -1 - i;
      ctx.where = 'page';
      const pr = asRec(p);
      if (!pr) return p;
      const title = asStr(pr.title);
      const nt = title ? genericPass(/^https?:\/\//i.test(title) ? redactUrl(title, ctx) : title, ctx) : title;
      const extra = deepStrings(Object.fromEntries(Object.entries(pr).filter(([k]) => k.startsWith('_') || k === 'comment')), ctx);
      return nt !== title || extra !== undefined ? { ...pr, ...(nt !== title ? { title: nt } : {}), ...(isRec(extra) ? extra : {}) } : pr;
    });
  }
  if (isRec(log.comment) || typeof log.comment === 'string') newLog.comment = deepStrings(log.comment, ctx);
  return { ...har, log: newLog };
}

export interface SanitizeResult {
  chunks: string[];
  report: SanitizeReport;
  bytes: number;
}

/**
 * Sanitise a HAR into JSON text chunks (never one giant string unless `pretty`). Every `yieldEvery`
 * entries it awaits `tick()` so the UI can paint progress.
 */
export async function sanitizeHar(
  har: HarFile,
  options: SanitizeOptions,
  hooks: { pretty?: boolean; tick?: (done: number, total: number) => Promise<void> | void; /** ms of work between UI yields */ yieldEvery?: number } = {}
): Promise<SanitizeResult> {
  const ctx = makeCtx(options);
  const entries = har.log.entries;
  const top = sanitizeTopLevel(har, ctx);
  const budgetMs = hooks.yieldEvery ?? 30;
  const sanitized: unknown[] = new Array<unknown>(entries.length);
  let entriesTouched = 0;
  let lastYield = Date.now();
  for (let i = 0; i < entries.length; i++) {
    ctx.entry = i;
    ctx.touched = false;
    const e = entries[i];
    sanitized[i] = isRec(e) ? sanitizeEntry(e, ctx) : e;
    if (ctx.touched) entriesTouched++;
    if (hooks.tick && Date.now() - lastYield > budgetMs) {
      await hooks.tick(i + 1, entries.length);
      lastYield = Date.now();
    }
  }
  const chunks: string[] = [];
  if (hooks.pretty) {
    chunks.push(JSON.stringify({ ...top, log: { ...top.log, entries: sanitized } }, null, 2));
  } else {
    const marker = '"__HAR_ENTRIES__"';
    const head = JSON.stringify({ ...top, log: { ...top.log, entries: ['__HAR_ENTRIES__'] } });
    const at = head.indexOf(marker);
    chunks.push(head.slice(0, at));
    for (let i = 0; i < sanitized.length; i++) {
      chunks.push((i > 0 ? ',' : '') + JSON.stringify(sanitized[i]));
      if (hooks.tick && Date.now() - lastYield > budgetMs) {
        await hooks.tick(entries.length, entries.length);
        lastYield = Date.now();
      }
    }
    chunks.push(head.slice(at + marker.length));
  }
  if (hooks.tick) await hooks.tick(entries.length, entries.length);
  let bytes = 0;
  for (const c of chunks) bytes += c.length;
  const total = (Object.keys(ctx.counts) as Category[]).reduce((n, k) => n + ctx.counts[k], 0);
  const names = {} as Record<Category, string[]>;
  for (const k of Object.keys(ctx.names) as Category[]) names[k] = Array.from(ctx.names[k]).sort();
  return {
    chunks,
    bytes,
    report: { counts: ctx.counts, total, entriesTouched, entries: entries.length, examples: ctx.examples, names },
  };
}

/** Synchronous convenience for tests / small files: returns the sanitised HAR as an object. */
export async function sanitizeHarToObject(har: HarFile, options: SanitizeOptions): Promise<{ har: HarFile; report: SanitizeReport }> {
  const r = await sanitizeHar(har, options);
  return { har: JSON.parse(r.chunks.join('')) as HarFile, report: r.report };
}

// ---------------------------------------------------------------------------
// Demo HAR
// ---------------------------------------------------------------------------

/** A small, deterministic, realistic page load (with some secrets) for the "Load sample" button. */
export function buildSampleHar(): HarFile {
  const base = Date.UTC(2024, 2, 12, 10, 0, 0);
  const iso = (ms: number) => new Date(base + ms).toISOString();
  const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MiIsIm5hbWUiOiJKYW5lIERvZSIsImVtYWlsIjoiamFuZUBhY21lLmV4YW1wbGUiLCJpYXQiOjE3MTAyMzkwMjJ9.5mG3w2Q0kqjU1o4y3b8cQh0yP6x1Zr9m2l7sT4uVwXA';
  const cookie = 'sid=7f3a9c2e1b8d4f6a; csrftoken=Qm9ndXNDc3JmVG9rZW4xMjM0; theme=dark';
  const ENTRIES: unknown[] = [];
  let t = 0;
  const hdr = (list: [string, string][]) => list.map(([name, value]) => ({ name, value }));
  interface Opt {
    method?: string;
    status?: number;
    mime?: string;
    size?: number;
    rt?: string;
    dur?: [number, number, number, number, number, number, number]; // blocked dns connect ssl send wait receive
    resHeaders?: [string, string][];
    reqHeaders?: [string, string][];
    body?: string;
    post?: { mimeType: string; text: string };
    redirect?: string;
    error?: string;
    gap?: number;
    server?: string;
    h?: string;
  }
  const add = (url: string, o: Opt = {}) => {
    const d = o.dur ?? [2, 0, 0, 0, 0.5, 40, 8];
    const [blocked, dns, connect, ssl, send, wait, receive] = d;
    const total = blocked + dns + connect + send + wait + receive;
    t += o.gap ?? 6;
    const status = o.status ?? 200;
    const mime = o.mime ?? 'text/html';
    const u = splitUrl(url);
    const query = parseQuery(u.query);
    ENTRIES.push({
      pageref: 'page_1',
      startedDateTime: iso(t),
      time: total,
      request: {
        method: o.method ?? 'GET',
        url,
        httpVersion: o.h ?? 'h2',
        cookies: u.host.endsWith('acme.example') ? [{ name: 'sid', value: '7f3a9c2e1b8d4f6a' }, { name: 'csrftoken', value: 'Qm9ndXNDc3JmVG9rZW4xMjM0' }] : [],
        headers: hdr([['Host', u.host], ['User-Agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.94 Safari/537.36'], ...(u.host.endsWith('acme.example') ? ([['Cookie', cookie]] as [string, string][]) : []), ...(o.reqHeaders ?? [])]),
        queryString: query.map((q) => ({ name: q.name, value: q.value })),
        headersSize: 520,
        bodySize: o.post ? o.post.text.length : 0,
        ...(o.post ? { postData: o.post } : {}),
      },
      response: {
        status,
        statusText: status === 200 ? 'OK' : status === 404 ? 'Not Found' : status === 500 ? 'Internal Server Error' : status === 301 ? 'Moved Permanently' : status === 302 ? 'Found' : status === 0 ? '' : '',
        httpVersion: o.h ?? 'h2',
        cookies: [],
        headers: hdr([['Content-Type', mime], ...(o.resHeaders ?? [])]),
        content: { size: o.size ?? 2048, mimeType: mime, ...(o.body ? { text: o.body } : {}) },
        redirectURL: o.redirect ?? '',
        headersSize: 340,
        bodySize: Math.round((o.size ?? 2048) * 0.35),
        ...(o.error ? { _error: o.error } : {}),
      },
      cache: {},
      timings: { blocked, dns, connect: connect + ssl, ssl, send, wait, receive },
      serverIPAddress: o.server ?? '203.0.113.10',
      _resourceType: o.rt ?? 'other',
    });
    t += total * 0.2;
  };
  const gz: [string, string][] = [['Content-Encoding', 'br'], ['Cache-Control', 'public, max-age=31536000, immutable']];
  add('http://acme.example/', { status: 301, redirect: 'https://acme.example/', rt: 'document', dur: [1, 8, 20, 0, 0.5, 30, 1], size: 0, mime: 'text/html', resHeaders: [['Location', 'https://acme.example/']], h: 'http/1.1', gap: 0 });
  add('https://acme.example/', { status: 302, redirect: 'https://www.acme.example/home?lang=en', rt: 'document', dur: [1, 6, 22, 40, 0.5, 35, 1], size: 0, mime: 'text/html', resHeaders: [['Location', 'https://www.acme.example/home?lang=en'], ['Set-Cookie', 'sid=7f3a9c2e1b8d4f6a; Path=/; HttpOnly; Secure']] });
  add('https://www.acme.example/home?lang=en', {
    rt: 'document', dur: [2, 5, 18, 42, 0.5, 120, 25], size: 48210,
    resHeaders: [['Content-Encoding', 'gzip'], ['Cache-Control', 'no-cache'], ['Set-Cookie', 'csrftoken=Qm9ndXNDc3JmVG9rZW4xMjM0; Path=/; Secure']],
    body: '<!doctype html><html><head><title>Acme</title><link rel="stylesheet" href="/static/app.css"></head><body><meta name="boot" content="' + jwt + '"><p>Signed in as jane@acme.example</p><script src="/static/app.js"></script></body></html>',
  });
  add('https://www.acme.example/static/app.css', { rt: 'stylesheet', mime: 'text/css', size: 61200, resHeaders: gz, dur: [8, 0, 0, 0, 0.5, 30, 14] });
  add('https://www.acme.example/static/vendor.js', { rt: 'script', mime: 'application/javascript', size: 412000, resHeaders: gz, dur: [10, 0, 0, 0, 0.5, 45, 120], gap: 2 });
  add('https://www.acme.example/static/app.js', { rt: 'script', mime: 'application/javascript', size: 138000, resHeaders: [], dur: [10, 0, 0, 0, 0.5, 38, 70], gap: 1 });
  add('https://www.acme.example/static/fonts/inter.woff2', { rt: 'font', mime: 'font/woff2', size: 48200, resHeaders: gz, dur: [20, 0, 0, 0, 0.5, 30, 22] });
  add('https://cdn.acme.example/img/hero.jpg', { rt: 'image', mime: 'image/jpeg', size: 268000, resHeaders: [['Cache-Control', 'public, max-age=86400']], dur: [12, 6, 20, 38, 0.5, 60, 210], server: '198.51.100.20' });
  add('https://cdn.acme.example/img/logo.svg', { rt: 'image', mime: 'image/svg+xml', size: 3400, resHeaders: [], dur: [2, 0, 0, 0, 0.5, 28, 4], body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#6d5ae6"/></svg>', server: '198.51.100.20' });
  add('https://cdn.acme.example/img/avatar.png', { rt: 'image', mime: 'image/png', size: 9100, resHeaders: [['ETag', '"a1b2c3"']], dur: [2, 0, 0, 0, 0.5, 31, 6], server: '198.51.100.20' });
  add('https://www.acme.example/api/session', {
    rt: 'fetch', mime: 'application/json', size: 640, resHeaders: [['Cache-Control', 'no-store']], dur: [4, 0, 0, 0, 0.5, 95, 2],
    reqHeaders: [['Authorization', `Bearer ${jwt}`], ['X-CSRF-Token', 'Qm9ndXNDc3JmVG9rZW4xMjM0'], ['X-Forwarded-For', '192.0.2.77']],
    body: JSON.stringify({ user: { id: 42, name: 'Jane Doe', email: 'jane@acme.example' }, access_token: 'at_9f8e7d6c5b4a39281716', expires_in: 3600 }),
  });
  add('https://www.acme.example/api/feed?page=1&api_key=ak_live_51Hx7d9e8f&limit=20', {
    rt: 'xhr', mime: 'application/json', size: 18400, resHeaders: [['Content-Encoding', 'gzip']], dur: [4, 0, 0, 0, 0.5, 220, 12],
    reqHeaders: [['Authorization', `Bearer ${jwt}`], ['X-API-Key', 'ak_live_51Hx7d9e8f']],
    body: JSON.stringify({ items: [{ id: 1, title: 'Welcome', author: 'bob@acme.example' }, { id: 2, title: 'Release notes', author: 'carol@acme.example' }] }),
  });
  add('https://www.acme.example/api/login/refresh', {
    method: 'POST', rt: 'xhr', mime: 'application/json', size: 420, dur: [3, 0, 0, 0, 1, 160, 1], resHeaders: [['Set-Cookie', 'sid=1c9d8e7f6a5b4c3d; Path=/; HttpOnly; Secure']],
    reqHeaders: [['Content-Type', 'application/json']], post: { mimeType: 'application/json', text: JSON.stringify({ refresh_token: 'rt_5c4b3a2918f7e6d5', client_id: 'web', password: 'correct horse battery staple' }, null, 2) },
    body: JSON.stringify({ access_token: 'at_new_0a1b2c3d4e5f', refresh_token: 'rt_next_7e6d5c4b3a29', token_type: 'Bearer' }),
  });
  add('https://www.acme.example/api/notifications', { rt: 'fetch', mime: 'application/json', size: 120, status: 500, dur: [3, 0, 0, 0, 0.5, 410, 1], body: '{"error":"upstream timeout"}' });
  add('https://www.acme.example/static/old-banner.png', { rt: 'image', mime: 'image/png', size: 0, status: 404, dur: [6, 0, 0, 0, 0.5, 28, 0.3] });
  add('https://www.google-analytics.com/g/collect?v=2&tid=G-ABC123&cid=1234567890.1710237600&dl=https%3A%2F%2Fwww.acme.example%2Fhome', { rt: 'ping', method: 'POST', mime: 'text/plain', size: 0, status: 204, dur: [15, 12, 30, 45, 0.5, 70, 0.4], server: '142.250.74.46', gap: 40 });
  add('https://www.googletagmanager.com/gtm.js?id=GTM-XYZ12', { rt: 'script', mime: 'application/javascript', size: 98000, resHeaders: [['Content-Encoding', 'br'], ['Cache-Control', 'private, max-age=900']], dur: [14, 10, 25, 40, 0.5, 52, 38], server: '142.250.74.72', gap: 20 });
  add('https://px.adnetwork.test/pixel.gif?uid=u_8841177&sig=3f2a1b', { rt: 'image', mime: 'image/gif', size: 43, status: 200, dur: [30, 15, 35, 50, 0.5, 90, 0.3], server: '203.0.113.99', resHeaders: [] });
  add('https://api.statuspage.test/v2/status.json', { rt: 'xhr', mime: 'application/json', size: 0, status: 0, error: 'net::ERR_CONNECTION_RESET', dur: [5, 9, 40, 0, 0, 0, 0], server: '' });
  return {
    log: {
      version: '1.2',
      creator: { name: 'Open Utility Tools sample', version: '1.0' },
      browser: { name: 'Chrome', version: '122.0.6261.94' },
      pages: [{ startedDateTime: iso(0), id: 'page_1', title: 'https://acme.example/', pageTimings: { onContentLoad: 650, onLoad: 1380 } }],
      entries: ENTRIES,
    },
  } as unknown as HarFile;
}
