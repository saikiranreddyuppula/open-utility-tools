/**
 * Web server log analysis: parsers (Common/Combined/vhost/nginx timing, custom log_format,
 * JSON lines, logfmt, AWS ALB), a compact columnar store, and the statistics behind the dashboard.
 * Pure TypeScript, no dependencies.
 */

/* ------------------------------------------------------------------ */
/* Records                                                             */
/* ------------------------------------------------------------------ */

export interface LogRecord {
  ip: string;
  /** first address of X-Forwarded-For ('' when absent) */
  xff: string;
  user: string;
  /** epoch milliseconds, NaN when unknown */
  time: number;
  method: string;
  uri: string;
  protocol: string;
  /** 0 when unknown */
  status: number;
  bytes: number;
  referrer: string;
  ua: string;
  /** request duration in seconds, NaN when unknown */
  rt: number;
  /** upstream response time in seconds, NaN when unknown */
  urt: number;
  vhost: string;
}

export function newRecord(): LogRecord {
  return { ip: '', xff: '', user: '', time: NaN, method: '', uri: '', protocol: '', status: 0, bytes: 0, referrer: '', ua: '', rt: NaN, urt: NaN, vhost: '' };
}

function resetRecord(r: LogRecord): void {
  r.ip = '';
  r.xff = '';
  r.user = '';
  r.time = NaN;
  r.method = '';
  r.uri = '';
  r.protocol = '';
  r.status = 0;
  r.bytes = 0;
  r.referrer = '';
  r.ua = '';
  r.rt = NaN;
  r.urt = NaN;
  r.vhost = '';
}

export type LogFormatId = 'common' | 'combined' | 'vhost' | 'nginx-timing' | 'custom' | 'json' | 'logfmt' | 'alb';

export const FORMAT_LABELS: Record<LogFormatId, string> = {
  common: 'Common Log Format',
  combined: 'Combined (nginx / Apache)',
  vhost: 'Combined with virtual host',
  'nginx-timing': 'Combined with request times',
  custom: 'Custom log_format',
  json: 'JSON lines',
  logfmt: 'logfmt (key=value)',
  alb: 'AWS Application Load Balancer',
};

/* ------------------------------------------------------------------ */
/* Time & number parsing                                               */
/* ------------------------------------------------------------------ */

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const CLF_RE = /^(\d{1,2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?: ?([+-])(\d{2}):?(\d{2}))?$/;

/** "10/Oct/2000:13:55:36 -0700" -> epoch ms (NaN when malformed). */
export function parseClfTime(s: string): number {
  const m = CLF_RE.exec(s);
  if (!m) return NaN;
  const mon = MONTHS[(m[2] ?? '').toLowerCase()];
  if (mon === undefined) return NaN;
  let t = Date.UTC(Number(m[3]), mon, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6]));
  if (m[7]) {
    const off = Number(m[8]) * 60 + Number(m[9]);
    t -= (m[7] === '-' ? -1 : 1) * off * 60000;
  }
  return t;
}

/** Epoch value of unknown unit -> ms (seconds, ms, µs or ns by magnitude). */
function epochToMs(n: number): number {
  const a = Math.abs(n);
  if (a < 1e11) return n * 1000;
  if (a < 1e14) return n;
  if (a < 1e17) return n / 1000;
  return n / 1e6;
}

/** Any of: CLF, ISO-8601, "YYYY-MM-DD HH:MM:SS", epoch seconds/ms. NaN when unknown. */
export function parseTimeValue(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? epochToMs(v) : NaN;
  if (typeof v !== 'string') return NaN;
  const s = v.trim();
  if (s === '' || s === '-') return NaN;
  const c = s.charCodeAt(0);
  if (c >= 48 && c <= 57) {
    if (/^\d+(?:\.\d+)?$/.test(s)) return epochToMs(Number(s));
    if (s.charCodeAt(2) === 47 || s.charCodeAt(1) === 47) return parseClfTime(s);
    let iso = s;
    if (/^\d{4}-\d{2}-\d{2} \d/.test(iso)) iso = iso.replace(' ', 'T');
    if (/^\d{4}-\d{2}-\d{2}T[\d:.]+$/.test(iso)) iso += 'Z';
    const t = Date.parse(iso);
    return Number.isNaN(t) ? NaN : t;
  }
  return NaN;
}

const DUR_RE = /^([0-9]*\.?[0-9]+(?:[eE][+-]?\d+)?)\s*(ns|us|µs|ms|s|m|h)?$/;
export type DurationUnit = 's' | 'ms' | 'us' | 'ns';
const UNIT_SECONDS: Record<string, number> = { ns: 1e-9, us: 1e-6, 'µs': 1e-6, ms: 1e-3, s: 1, m: 60, h: 3600 };

/** "0.123", "12ms", "1500us", 0.5 -> seconds. Plain numbers use `defaultUnit`. NaN when absent. */
export function parseDuration(v: unknown, defaultUnit: DurationUnit = 's'): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v * (UNIT_SECONDS[defaultUnit] ?? 1) : NaN;
  if (typeof v !== 'string') return NaN;
  const s = v.trim();
  if (s === '' || s === '-') return NaN;
  const m = DUR_RE.exec(s);
  if (!m) return NaN;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return NaN;
  return n * (UNIT_SECONDS[m[2] ?? defaultUnit] ?? 1);
}

/** nginx $upstream_response_time may hold several values ("0.1, 0.2" or "0.1 : 0.2"); sum the numeric ones. */
export function parseUpstreamTime(s: string): number {
  let sum = 0;
  let any = false;
  for (const part of s.split(/[,:\s]+/)) {
    if (part === '' || part === '-') continue;
    const n = Number(part);
    if (Number.isFinite(n) && n >= 0) {
      sum += n;
      any = true;
    }
  }
  return any ? sum : NaN;
}

function toStatus(s: string): number {
  if (s.length !== 3) return 0;
  const n = (s.charCodeAt(0) - 48) * 100 + (s.charCodeAt(1) - 48) * 10 + (s.charCodeAt(2) - 48);
  return n >= 100 && n <= 999 ? n : 0;
}

function toBytes(s: string): number {
  if (s === '-' || s === '') return 0;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

const IP_LIKE = /^(?:\d{1,3}\.){3}\d{1,3}$|^[0-9a-fA-F:]*:[0-9a-fA-F:.]*$/;
export const isIpLike = (s: string): boolean => IP_LIKE.test(s);

/** "GET /path HTTP/1.1" -> record fields (garbage requests keep the raw text as uri). */
function splitRequest(req: string, rec: LogRecord): void {
  const sp1 = req.indexOf(' ');
  if (sp1 > 0) {
    const sp2 = req.lastIndexOf(' ');
    if (sp2 > sp1) {
      const proto = req.slice(sp2 + 1);
      if (proto.startsWith('HTTP/') || proto.startsWith('SPDY') || proto.startsWith('http/')) {
        rec.method = req.slice(0, sp1);
        rec.uri = req.slice(sp1 + 1, sp2);
        rec.protocol = proto;
        return;
      }
    }
    const method = req.slice(0, sp1);
    if (/^[A-Z][A-Z-]{1,14}$/.test(method)) {
      rec.method = method;
      rec.uri = req.slice(sp1 + 1);
      rec.protocol = '-';
      return;
    }
  }
  rec.method = '-';
  rec.uri = req === '' ? '-' : req.length > 300 ? req.slice(0, 300) : req;
  rec.protocol = '-';
}

function unescapeLog(s: string): string {
  if (s.indexOf('\\') === -1) return s;
  return s.replace(/\\x22/g, '"').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

/** Extra fields after the user agent: nginx timing (rt=0.1 urt=0.05), X-Forwarded-For, bare numbers. */
export function parseTail(tail: string, rec: LogRecord): void {
  const tokens = tail.match(/"(?:[^"\\]|\\.)*"|\S+/g);
  if (!tokens) return;
  let bare = 0;
  for (const raw of tokens) {
    let tok = raw;
    const quoted = tok.startsWith('"');
    if (quoted) tok = tok.slice(1, -1);
    const eq = tok.indexOf('=');
    if (eq > 0 && !quoted) {
      const key = tok.slice(0, eq).toLowerCase();
      let val = tok.slice(eq + 1);
      if (val.startsWith('"')) val = val.slice(1, -1);
      if (key === 'rt' || key === 'request_time' || key === 'reqtime' || key === 'request-time') rec.rt = parseDuration(val);
      else if (key === 'urt' || key === 'upstream_response_time' || key === 'upstream_time' || key === 'uht') {
        if (Number.isNaN(rec.urt) || key !== 'uht') rec.urt = parseUpstreamTime(val);
      }
      continue;
    }
    if (quoted) {
      if (rec.xff === '' && /^[0-9a-fA-F:.,\s]+$/.test(tok) && /[0-9]/.test(tok)) {
        const first = tok.split(',')[0]?.trim() ?? '';
        if (first !== '' && isIpLike(first)) rec.xff = first;
      } else if (Number.isNaN(rec.urt) && /^[\d.]+(?:\s*[,:]\s*[\d.]+)*$/.test(tok) && bare > 0) {
        rec.urt = parseUpstreamTime(tok);
      }
      continue;
    }
    if (/^\d+(?:\.\d+)?$/.test(tok)) {
      if (bare === 0) rec.rt = tok.includes('.') ? Number(tok) : Number(tok) / 1e6; // integer: Apache %D (microseconds)
      else if (bare === 1) rec.urt = Number(tok);
      bare++;
    } else if (tok === '-') {
      bare++;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Common / Combined / vhost                                           */
/* ------------------------------------------------------------------ */

const CLF_LINE =
  /^(\S+) (\S+) (.*?) \[([^\]]+)\] "((?:[^"\\]|\\.)*)" (\d{3}|-) (\d+|-)(?: "((?:[^"\\]|\\.)*)" "((?:[^"\\]|\\.)*)")?(?: (.*))?$/;
const VHOST_LINE =
  /^(\S+?)(?::(\d+))? (\S+) (\S+) (.*?) \[([^\]]+)\] "((?:[^"\\]|\\.)*)" (\d{3}|-) (\d+|-)(?: "((?:[^"\\]|\\.)*)" "((?:[^"\\]|\\.)*)")?(?: (.*))?$/;

export function parseClf(line: string, rec: LogRecord): boolean {
  const m = CLF_LINE.exec(line);
  if (!m) return false;
  rec.ip = m[1] ?? '';
  rec.user = m[3] ?? '';
  rec.time = parseClfTime(m[4] ?? '');
  splitRequest(unescapeLog(m[5] ?? ''), rec);
  rec.status = toStatus(m[6] ?? '');
  rec.bytes = toBytes(m[7] ?? '');
  rec.referrer = m[8] !== undefined ? unescapeLog(m[8]) : '';
  rec.ua = m[9] !== undefined ? unescapeLog(m[9]) : '';
  if (m[10]) parseTail(m[10], rec);
  return true;
}

export function parseVhost(line: string, rec: LogRecord): boolean {
  const m = VHOST_LINE.exec(line);
  if (!m) return false;
  rec.vhost = m[1] ?? '';
  rec.ip = m[3] ?? '';
  rec.user = m[5] ?? '';
  rec.time = parseClfTime(m[6] ?? '');
  splitRequest(unescapeLog(m[7] ?? ''), rec);
  rec.status = toStatus(m[8] ?? '');
  rec.bytes = toBytes(m[9] ?? '');
  rec.referrer = m[10] !== undefined ? unescapeLog(m[10]) : '';
  rec.ua = m[11] !== undefined ? unescapeLog(m[11]) : '';
  if (m[12]) parseTail(m[12], rec);
  return true;
}

/* ------------------------------------------------------------------ */
/* JSON lines and logfmt                                               */
/* ------------------------------------------------------------------ */

type Field = 'ip' | 'xff' | 'user' | 'time' | 'method' | 'uri' | 'request' | 'protocol' | 'status' | 'bytes' | 'referrer' | 'ua' | 'rt' | 'urt' | 'vhost';

const FIELD_ALIASES: Record<Field, string[]> = {
  ip: ['remote_addr', 'client_ip', 'clientip', 'remote_ip', 'remoteip', 'ip', 'clientrequestip', 'client.ip', 'source.ip', 'httprequest.remoteip', 'http_x_real_ip', 'src_ip', 'remoteaddr', 'remote_host', 'client', 'c_ip', 'cs_ip', 'fwd'],
  xff: ['http_x_forwarded_for', 'x_forwarded_for', 'xff', 'x-forwarded-for', 'http_x_forwarded_for_first'],
  user: ['remote_user', 'user', 'username', 'auth_user'],
  time: ['time_iso8601', 'time_local', '@timestamp', 'timestamp', 'time', 'ts', 'datetime', 'date', 'edgestarttimestamp', 'msec', 'logtime', 'when', 't', 'at_time'],
  method: ['request_method', 'method', 'http_method', 'http.request.method', 'httprequest.requestmethod', 'verb', 'cs_method', 'req_method'],
  uri: ['request_uri', 'uri', 'url', 'path', 'request_path', 'url.original', 'url.path', 'httprequest.requesturl', 'requesturi', 'cs_uri_stem', 'req_uri', 'document_uri', 'request_url', 'http.request.url'],
  request: ['request', 'request_line', 'req', 'http_request'],
  protocol: ['server_protocol', 'protocol', 'http_version', 'http.version', 'proto'],
  status: ['status', 'status_code', 'response_code', 'http.response.status_code', 'httprequest.status', 'sc_status', 'statuscode', 'code', 'response_status', 'http_status', 'res_status'],
  bytes: ['body_bytes_sent', 'bytes_sent', 'bytes', 'size', 'response_size', 'http.response.body.bytes', 'httprequest.responsesize', 'content_length', 'sc_bytes', 'resp_bytes', 'response_bytes'],
  referrer: ['http_referer', 'referer', 'referrer', 'http.request.referrer', 'httprequest.referer', 'http_referrer'],
  ua: ['http_user_agent', 'user_agent', 'useragent', 'ua', 'agent', 'user_agent.original', 'httprequest.useragent', 'user-agent', 'http.user_agent'],
  rt: ['request_time', 'duration', 'response_time', 'latency', 'elapsed', 'time_taken', 'rt', 'duration_ms', 'request_duration', 'service', 'event.duration', 'responsetime', 'took', 'httprequest.latency'],
  urt: ['upstream_response_time', 'upstream_time', 'urt', 'upstream_duration', 'target_processing_time'],
  vhost: ['host', 'http_host', 'server_name', 'vhost', 'http.request.host', 'url.domain', 'hostname', 'domain', 'authority', ':authority'],
};

function lookup(obj: Record<string, unknown>, key: string): unknown {
  if (key in obj) return obj[key];
  if (key.indexOf('.') !== -1) {
    let cur: unknown = obj;
    for (const part of key.split('.')) {
      if (cur && typeof cur === 'object' && !Array.isArray(cur) && part in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[part];
      else return undefined;
    }
    return cur;
  }
  return undefined;
}

function scalarOf(v: unknown): string | number | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'string' || typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (Array.isArray(v)) return scalarOf(v[0]);
  return undefined;
}

/** Resolves which actual keys of a JSON/logfmt object carry which log field (case-insensitive). */
export class FieldMapper {
  private resolved = new Map<Field, string>();
  private ready = false;

  private resolve(obj: Record<string, unknown>): Map<Field, string> {
    const lower = new Map<string, string>();
    const collect = (o: Record<string, unknown>, prefix: string, depth: number): void => {
      for (const [k, v] of Object.entries(o)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          if (depth < 3) collect(v as Record<string, unknown>, prefix + k + '.', depth + 1);
        } else lower.set((prefix + k).toLowerCase(), prefix + k);
      }
    };
    collect(obj, '', 0);
    const out = new Map<Field, string>();
    for (const f of Object.keys(FIELD_ALIASES) as Field[]) {
      for (const alias of FIELD_ALIASES[f]) {
        const actual = lower.get(alias);
        if (actual !== undefined) {
          out.set(f, actual);
          break;
        }
      }
    }
    return out;
  }

  /** Fill `rec` from `obj`; returns true when the object looks like an access-log entry. */
  map(obj: Record<string, unknown>, rec: LogRecord): boolean {
    if (!this.ready) {
      this.resolved = this.resolve(obj);
      this.ready = true;
    }
    let fields = this.resolved;
    if (!fields.has('status') && !fields.has('uri') && !fields.has('request')) {
      fields = this.resolve(obj);
      if (fields.size > this.resolved.size) this.resolved = fields;
    }
    const get = (f: Field): string | number | undefined => {
      const key = fields.get(f);
      return key === undefined ? undefined : scalarOf(lookup(obj, key));
    };
    const statusV = get('status');
    const reqV = get('request');
    const uriV = get('uri');
    if (statusV === undefined && uriV === undefined && reqV === undefined) return false;
    const st = typeof statusV === 'number' ? statusV : Number(statusV);
    rec.status = Number.isInteger(st) && st >= 100 && st <= 999 ? st : 0;
    const ip = get('ip');
    rec.ip = ip === undefined ? '' : String(ip);
    const xff = get('xff');
    if (xff !== undefined) {
      const first = String(xff).split(',')[0]?.trim() ?? '';
      rec.xff = first !== '-' && isIpLike(first) ? first : '';
    }
    const user = get('user');
    rec.user = user === undefined ? '' : String(user);
    const t = get('time');
    rec.time = t === undefined ? NaN : parseTimeValue(t);
    const method = get('method');
    if (method !== undefined) rec.method = String(method);
    if (typeof reqV === 'string' && (uriV === undefined || String(uriV) === '')) splitRequest(reqV, rec);
    else if (uriV !== undefined) {
      rec.uri = String(uriV);
      if (typeof reqV === 'string' && rec.method === '') splitRequest(reqV, rec);
    }
    if (rec.method === '') rec.method = '-';
    const proto = get('protocol');
    if (proto !== undefined && rec.protocol === '') rec.protocol = String(proto);
    const bytes = get('bytes');
    rec.bytes = bytes === undefined ? 0 : toBytes(String(bytes));
    const ref = get('referrer');
    rec.referrer = ref === undefined ? '' : String(ref);
    const ua = get('ua');
    rec.ua = ua === undefined ? '' : String(ua);
    const rtKey = fields.get('rt') ?? '';
    const rtV = get('rt');
    if (rtV !== undefined) {
      const k = rtKey.toLowerCase();
      const unit: DurationUnit = /(^|[_.])ms$|millis|duration_ms/.test(k) ? 'ms' : /(^|[_.])(us|micros?)$/.test(k) ? 'us' : /(^|[_.])ns$/.test(k) || k === 'event.duration' ? 'ns' : /service$/.test(k) && typeof rtV === 'string' ? 's' : 's';
      rec.rt = parseDuration(rtV, unit);
    }
    const urtV = get('urt');
    if (urtV !== undefined) rec.urt = typeof urtV === 'number' ? urtV : parseUpstreamTime(urtV);
    const vh = get('vhost');
    if (vh !== undefined) rec.vhost = String(vh);
    return true;
  }
}

export function makeJsonParser(): (line: string, rec: LogRecord) => boolean {
  const mapper = new FieldMapper();
  return (line, rec) => {
    if (line.charCodeAt(0) !== 123) return false;
    let obj: unknown;
    try {
      obj = JSON.parse(line);
    } catch {
      return false;
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
    return mapper.map(obj as Record<string, unknown>, rec);
  };
}

/** logfmt: key=value key2="quoted value". Returns null for lines that are not logfmt. */
export function parseLogfmtPairs(line: string): Record<string, string> | null {
  const out: Record<string, string> = {};
  let i = 0;
  const n = line.length;
  let count = 0;
  while (i < n) {
    while (i < n && line.charCodeAt(i) === 32) i++;
    if (i >= n) break;
    let j = i;
    while (j < n && line.charCodeAt(j) !== 61 && line.charCodeAt(j) !== 32) j++;
    if (j >= n || line.charCodeAt(j) !== 61) {
      i = j; // bare word (e.g. a syslog prefix): skip
      continue;
    }
    const key = line.slice(i, j);
    j++;
    let value: string;
    if (line.charCodeAt(j) === 34) {
      let k = j + 1;
      let v = '';
      while (k < n && line.charCodeAt(k) !== 34) {
        if (line.charCodeAt(k) === 92 && k + 1 < n) {
          v += line.charAt(k + 1);
          k += 2;
        } else v += line.charAt(k++);
      }
      value = v;
      i = k + 1;
    } else {
      let k = j;
      while (k < n && line.charCodeAt(k) !== 32) k++;
      value = line.slice(j, k);
      i = k;
    }
    if (key !== '') {
      out[key] = value;
      count++;
    }
  }
  return count >= 2 ? out : null;
}

export function makeLogfmtParser(): (line: string, rec: LogRecord) => boolean {
  const mapper = new FieldMapper();
  return (line, rec) => {
    if (line.charCodeAt(0) === 123) return false;
    const pairs = parseLogfmtPairs(line);
    if (!pairs) return false;
    // a leading ISO timestamp (Heroku style: "2012-10-11T03:47:20+00:00 heroku[router]: at=info ...")
    const lead = /^(\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)\s/.exec(line);
    const ok = mapper.map(pairs, rec);
    if (!ok) return false;
    if (lead && Number.isNaN(rec.time)) rec.time = parseTimeValue(lead[1]);
    // Heroku router durations carry a unit: service=5ms
    if (pairs.service !== undefined) rec.rt = parseDuration(pairs.service, 's');
    return true;
  };
}

/* ------------------------------------------------------------------ */
/* AWS ALB                                                             */
/* ------------------------------------------------------------------ */

const ALB_START = /^(?:http|https|h2|grpcs|ws|wss) \d{4}-\d{2}-\d{2}T/;

function splitQuoted(line: string, max = 40): string[] {
  const out: string[] = [];
  let i = 0;
  const n = line.length;
  while (i < n && out.length < max) {
    while (i < n && line.charCodeAt(i) === 32) i++;
    if (i >= n) break;
    if (line.charCodeAt(i) === 34) {
      let j = i + 1;
      while (j < n && line.charCodeAt(j) !== 34) j++;
      out.push(line.slice(i + 1, j));
      i = j + 1;
    } else {
      let j = i;
      while (j < n && line.charCodeAt(j) !== 32) j++;
      out.push(line.slice(i, j));
      i = j;
    }
  }
  return out;
}

export function parseAlb(line: string, rec: LogRecord): boolean {
  if (!ALB_START.test(line)) return false;
  const f = splitQuoted(line, 16);
  if (f.length < 14) return false;
  rec.time = parseTimeValue(f[1] ?? '');
  const client = f[3] ?? '';
  const colon = client.lastIndexOf(':');
  rec.ip = colon > 0 ? client.slice(0, colon) : client;
  const parts = [f[5], f[6], f[7]].map((x) => Number(x));
  if (parts.every((x) => Number.isFinite(x) && x >= 0)) rec.rt = parts[0]! + parts[1]! + parts[2]!;
  const t = Number(f[6]);
  if (Number.isFinite(t) && t >= 0) rec.urt = t;
  rec.status = toStatus(f[8] ?? '');
  rec.bytes = toBytes(f[11] ?? '');
  const req = f[12] ?? '';
  const m = /^(\S+) (\S+)(?: (\S+))?$/.exec(req);
  if (m) {
    rec.method = m[1] ?? '-';
    const url = m[2] ?? '';
    const um = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)(.*)$/i.exec(url);
    if (um) {
      rec.vhost = um[1] ?? '';
      rec.uri = um[2] === '' ? '/' : (um[2] ?? '/');
    } else rec.uri = url;
    rec.protocol = m[3] ?? '-';
  } else {
    rec.method = '-';
    rec.uri = req || '-';
  }
  rec.ua = f[13] ?? '';
  if (rec.ua === '-') rec.ua = '';
  return true;
}

/* ------------------------------------------------------------------ */
/* Custom log_format -> regex                                          */
/* ------------------------------------------------------------------ */

type Slot = { group: number; field: Field | 'ignore'; kind: 'text' | 'clf-time' | 'time' | 'duration-s' | 'duration-ms' | 'duration-us' | 'upstream' | 'uri-extra' | 'port' };

export interface CompiledFormat {
  regex: RegExp;
  parse: (line: string, rec: LogRecord) => boolean;
  /** log fields this format captures */
  fields: string[];
  /** variables that were captured but are not used */
  ignored: string[];
  syntax: 'nginx' | 'apache';
  source: string;
}

export type CompileResult = { ok: true; format: CompiledFormat } | { ok: false; error: string };

/** Accepts a bare format string, an nginx `log_format name '…';` or an Apache `LogFormat "…" name` line. */
export function normalizeFormatInput(input: string): string {
  const s = input.trim();
  const ng = /^log_format\s+\S+\s+([\s\S]*)$/.exec(s);
  if (ng) {
    const body = (ng[1] ?? '').trim().replace(/;\s*$/, '');
    const parts: string[] = [];
    const re = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) parts.push((m[1] ?? m[2] ?? '').replace(/\\(['"\\])/g, '$1'));
    return parts.length > 0 ? parts.join('') : body;
  }
  const ap = /^LogFormat\s+([\s\S]*)$/i.exec(s);
  if (ap) {
    const body = (ap[1] ?? '').trim();
    if (body.startsWith('"')) {
      let out = '';
      let i = 1;
      while (i < body.length && body.charAt(i) !== '"') {
        if (body.charAt(i) === '\\' && i + 1 < body.length) {
          out += body.charAt(i) + body.charAt(i + 1);
          i += 2;
        } else out += body.charAt(i++);
      }
      return out;
    }
  }
  if (s.length > 1 && s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
  // a whole format wrapped in double quotes, inner quotes escaped as \"
  if (s.length > 1 && s.startsWith('"') && s.endsWith('"') && !/(^|[^\\])"/.test(s.slice(1, -1))) return s.slice(1, -1);
  return s;
}

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');

interface VarSpec {
  field: Field | 'ignore';
  kind: Slot['kind'];
  bare?: string;
}

const NGINX_VARS: Record<string, VarSpec> = {
  remote_addr: { field: 'ip', kind: 'text' },
  realip_remote_addr: { field: 'ip', kind: 'text' },
  http_x_real_ip: { field: 'ip', kind: 'text' },
  remote_user: { field: 'user', kind: 'text', bare: '\\S*' },
  time_local: { field: 'time', kind: 'clf-time', bare: '\\d{1,2}/\\w{3}/\\d{4}:\\d{2}:\\d{2}:\\d{2} [+-]\\d{4}' },
  time_iso8601: { field: 'time', kind: 'time' },
  msec: { field: 'time', kind: 'time' },
  request: { field: 'request', kind: 'text', bare: '\\S+ \\S+(?: \\S+)?' },
  request_method: { field: 'method', kind: 'text' },
  request_uri: { field: 'uri', kind: 'text' },
  uri: { field: 'uri', kind: 'text' },
  document_uri: { field: 'uri', kind: 'text' },
  args: { field: 'ignore', kind: 'uri-extra' },
  query_string: { field: 'ignore', kind: 'uri-extra' },
  server_protocol: { field: 'protocol', kind: 'text' },
  status: { field: 'status', kind: 'text' },
  body_bytes_sent: { field: 'bytes', kind: 'text' },
  bytes_sent: { field: 'bytes', kind: 'text' },
  http_referer: { field: 'referrer', kind: 'text', bare: '.*?' },
  http_user_agent: { field: 'ua', kind: 'text', bare: '.*?' },
  request_time: { field: 'rt', kind: 'duration-s' },
  upstream_response_time: { field: 'urt', kind: 'upstream' },
  upstream_connect_time: { field: 'ignore', kind: 'text' },
  http_x_forwarded_for: { field: 'xff', kind: 'text', bare: '.*?' },
  host: { field: 'vhost', kind: 'text' },
  http_host: { field: 'vhost', kind: 'text' },
  server_name: { field: 'vhost', kind: 'text' },
  server_port: { field: 'ignore', kind: 'port' },
};

function apacheSpec(letter: string, arg: string): VarSpec | null {
  const a = arg.toLowerCase();
  switch (letter) {
    case 'h':
    case 'a':
      return { field: 'ip', kind: 'text' };
    case 'l':
      return { field: 'ignore', kind: 'text' };
    case 'u':
      return { field: 'user', kind: 'text', bare: '\\S*' };
    case 't':
      return { field: 'time', kind: 'clf-time' };
    case 'r':
      return { field: 'request', kind: 'text', bare: '\\S+ \\S+(?: \\S+)?' };
    case 'm':
      return { field: 'method', kind: 'text' };
    case 'U':
      return { field: 'uri', kind: 'text' };
    case 'q':
      return { field: 'ignore', kind: 'uri-extra' };
    case 'H':
      return { field: 'protocol', kind: 'text' };
    case 's':
      return { field: 'status', kind: 'text' };
    case 'b':
    case 'B':
    case 'O':
      return { field: 'bytes', kind: 'text' };
    case 'D':
      return { field: 'rt', kind: 'duration-us' };
    case 'T':
      return { field: 'rt', kind: a === 'ms' ? 'duration-ms' : a === 'us' ? 'duration-us' : 'duration-s' };
    case 'v':
    case 'V':
      return { field: 'vhost', kind: 'text' };
    case 'i':
      if (a === 'referer' || a === 'referrer') return { field: 'referrer', kind: 'text', bare: '.*?' };
      if (a === 'user-agent') return { field: 'ua', kind: 'text', bare: '.*?' };
      if (a === 'x-forwarded-for') return { field: 'xff', kind: 'text', bare: '.*?' };
      if (a === 'host') return { field: 'vhost', kind: 'text' };
      return { field: 'ignore', kind: 'text' };
    case 'p':
      return { field: 'ignore', kind: 'port' };
    default:
      return { field: 'ignore', kind: 'text' };
  }
}

interface FormatPart {
  lit?: string;
  name?: string;
  spec?: VarSpec;
}

function tokenizeNginx(fmt: string): FormatPart[] {
  const parts: FormatPart[] = [];
  let lit = '';
  const flush = (): void => {
    if (lit !== '') parts.push({ lit });
    lit = '';
  };
  for (let i = 0; i < fmt.length; i++) {
    const c = fmt.charAt(i);
    if (c === '$') {
      const m = /^\$(?:\{([a-zA-Z0-9_]+)\}|([a-zA-Z0-9_]+))/.exec(fmt.slice(i));
      if (m) {
        flush();
        const name = m[1] ?? m[2] ?? '';
        const spec = NGINX_VARS[name] ?? (name.startsWith('http_') ? { field: 'ignore' as const, kind: 'text' as const, bare: '.*?' } : { field: 'ignore' as const, kind: 'text' as const });
        parts.push({ name: '$' + name, spec });
        i += m[0].length - 1;
        continue;
      }
    }
    lit += c;
  }
  flush();
  return parts;
}

function tokenizeApache(fmt: string): FormatPart[] {
  const parts: FormatPart[] = [];
  let lit = '';
  const flush = (): void => {
    if (lit !== '') parts.push({ lit });
    lit = '';
  };
  for (let i = 0; i < fmt.length; i++) {
    const c = fmt.charAt(i);
    if (c === '\\' && i + 1 < fmt.length) {
      const e = fmt.charAt(i + 1);
      lit += e === 't' ? '\t' : e === 'n' ? '\n' : e;
      i++;
      continue;
    }
    if (c === '%') {
      if (fmt.charAt(i + 1) === '%') {
        lit += '%';
        i++;
        continue;
      }
      const m = /^%!?(?:\d{3}(?:,\d{3})*)?[<>]?(?:\{([^}]*)\})?(\^ti|\^to|[a-zA-Z])/.exec(fmt.slice(i));
      if (m) {
        flush();
        const letter = m[2] ?? '';
        const arg = m[1] ?? '';
        const spec = apacheSpec(letter, arg) ?? { field: 'ignore' as const, kind: 'text' as const };
        parts.push({ name: m[0], spec });
        i += m[0].length - 1;
        continue;
      }
    }
    lit += c;
  }
  flush();
  return parts;
}

/** Compile a custom nginx (`$var`) or Apache (`%x`) log format into a line parser. */
export function compileLogFormat(input: string, syntax?: 'nginx' | 'apache'): CompileResult {
  const source = normalizeFormatInput(input);
  if (source.trim() === '') return { ok: false, error: 'Enter a log format, e.g. $remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent' };
  const kind: 'nginx' | 'apache' = syntax ?? (source.includes('$') ? 'nginx' : source.includes('%') ? 'apache' : 'nginx');
  const parts = kind === 'nginx' ? tokenizeNginx(source) : tokenizeApache(source);
  const vars = parts.filter((p) => p.spec);
  if (vars.length === 0) return { ok: false, error: `No ${kind === 'nginx' ? '$variables' : '%directives'} found in the format.` };

  let pattern = '^';
  const slots: Slot[] = [];
  let group = 0;
  let inQuote = false;
  let inBracket = false;
  const fields = new Set<string>();
  const ignored: string[] = [];
  parts.forEach((p, idx) => {
    if (p.lit !== undefined) {
      for (const ch of p.lit) {
        if (ch === '"') inQuote = !inQuote;
        else if (ch === '[' && !inQuote) inBracket = true;
        else if (ch === ']' && !inQuote) inBracket = false;
      }
      pattern += p.lit.replace(/ +/g, ' ').split(/( )/).map((x) => (x === ' ' ? ' +' : esc(x))).join('');
      return;
    }
    const spec = p.spec as VarSpec;
    const isTime = spec.kind === 'clf-time' || spec.kind === 'time';
    let body: string;
    if (kind === 'apache' && p.name?.endsWith('t') && spec.field === 'time' && !inBracket) {
      body = '\\[([^\\]]*)\\]'; // Apache %t includes the brackets
    } else if (inQuote) body = '((?:[^"\\\\]|\\\\.)*)';
    else if (inBracket) body = '([^\\]]*)';
    else if (spec.bare) body = `(${spec.bare})`;
    else if (isTime && spec.kind === 'clf-time') body = '(\\S+ \\S+)';
    else {
      // last variable of the line may hold the rest; others are single tokens
      const next = parts[idx + 1];
      const following = parts.slice(idx + 1).some((x) => x.spec) || (next?.lit !== undefined && next.lit.trim() !== '');
      body = following ? '(\\S+)' : '(\\S+)';
    }
    group++;
    slots.push({ group, field: spec.field, kind: spec.kind });
    if (spec.field !== 'ignore') fields.add(spec.field === 'request' ? 'request (method, uri, protocol)' : spec.field);
    else ignored.push(p.name ?? '');
    pattern += body;
  });
  pattern += '\\s*$';
  let regex: RegExp;
  try {
    regex = new RegExp(pattern);
  } catch (e) {
    return { ok: false, error: `The format could not be compiled: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!slots.some((s) => s.field === 'status' || s.field === 'ip' || s.field === 'request' || s.field === 'uri')) {
    return { ok: false, error: 'The format has no recognisable status, address or request field.' };
  }

  const parse = (line: string, rec: LogRecord): boolean => {
    const m = regex.exec(line);
    if (!m) return false;
    let extraUri = '';
    for (const slot of slots) {
      const raw = m[slot.group] ?? '';
      switch (slot.field) {
        case 'ip':
          rec.ip = raw;
          break;
        case 'xff': {
          const first = raw.split(',')[0]?.trim() ?? '';
          rec.xff = first !== '-' && isIpLike(first) ? first : '';
          break;
        }
        case 'user':
          rec.user = raw;
          break;
        case 'time':
          rec.time = slot.kind === 'clf-time' ? parseClfTime(raw) : parseTimeValue(raw);
          break;
        case 'request':
          splitRequest(unescapeLog(raw), rec);
          break;
        case 'method':
          rec.method = raw;
          break;
        case 'uri':
          rec.uri = raw;
          break;
        case 'protocol':
          rec.protocol = raw;
          break;
        case 'status':
          rec.status = toStatus(raw);
          break;
        case 'bytes':
          rec.bytes = toBytes(raw);
          break;
        case 'referrer':
          rec.referrer = unescapeLog(raw);
          break;
        case 'ua':
          rec.ua = unescapeLog(raw);
          break;
        case 'rt':
          rec.rt = slot.kind === 'duration-us' ? parseDuration(raw, 'us') : slot.kind === 'duration-ms' ? parseDuration(raw, 'ms') : parseDuration(raw, 's');
          break;
        case 'urt':
          rec.urt = parseUpstreamTime(raw);
          break;
        case 'vhost':
          rec.vhost = raw;
          break;
        case 'ignore':
          if (slot.kind === 'uri-extra' && raw !== '' && raw !== '-') extraUri = raw;
          break;
      }
    }
    if (rec.method === '') rec.method = '-';
    if (extraUri !== '' && rec.uri !== '' && !rec.uri.includes('?')) rec.uri += (extraUri.startsWith('?') ? '' : '?') + extraUri;
    return true;
  };
  return { ok: true, format: { regex, parse, fields: [...fields], ignored, syntax: kind, source } };
}

/* ------------------------------------------------------------------ */
/* Format detection                                                    */
/* ------------------------------------------------------------------ */

export type LineParser = (line: string, rec: LogRecord) => boolean;

export function parserFor(id: LogFormatId, custom?: CompiledFormat | null): LineParser | null {
  switch (id) {
    case 'common':
    case 'combined':
    case 'nginx-timing':
      return parseClf;
    case 'vhost':
      return parseVhost;
    case 'json':
      return makeJsonParser();
    case 'logfmt':
      return makeLogfmtParser();
    case 'alb':
      return parseAlb;
    case 'custom':
      return custom ? custom.parse : null;
  }
}

export interface Detection {
  id: LogFormatId | null;
  /** fraction of sampled lines the chosen parser understood */
  rate: number;
  sampled: number;
}

/** Look at up to 80 lines and pick the parser that understands the most of them. */
export function detectFormat(lines: string[]): Detection {
  const sample = lines.filter((l) => l.trim() !== '').slice(0, 80);
  if (sample.length === 0) return { id: null, rate: 0, sampled: 0 };
  const rec = newRecord();
  const score = (p: LineParser, accept?: (r: LogRecord) => boolean): number => {
    let ok = 0;
    for (const l of sample) {
      resetRecord(rec);
      if (p(l, rec) && (!accept || accept(rec))) ok++;
    }
    return ok / sample.length;
  };
  const json = score(makeJsonParser());
  const alb = score(parseAlb);
  const logfmt = score(makeLogfmtParser(), (r) => r.status > 0 || r.uri !== '');
  const vhost = score(parseVhost, (r) => !isIpLike(r.vhost) && isIpLike(r.ip));
  const clf = score(parseClf, (r) => r.status > 0);
  // timing / UA information decides between common, combined and combined+timing
  let hasUa = 0;
  let hasTiming = 0;
  let clfOk = 0;
  for (const l of sample) {
    resetRecord(rec);
    if (parseClf(l, rec)) {
      clfOk++;
      if (rec.ua !== '' || rec.referrer !== '') hasUa++;
      if (!Number.isNaN(rec.rt)) hasTiming++;
    }
  }
  const candidates: { id: LogFormatId; rate: number; priority: number }[] = [
    { id: 'json', rate: json, priority: 6 },
    { id: 'alb', rate: alb, priority: 5 },
    { id: 'logfmt', rate: logfmt, priority: 4 },
    { id: 'vhost', rate: vhost, priority: 3 },
    {
      id: clfOk > 0 && hasTiming / clfOk > 0.5 ? 'nginx-timing' : clfOk > 0 && hasUa / clfOk > 0.5 ? 'combined' : 'common',
      rate: clf,
      priority: 1,
    },
  ];
  candidates.sort((a, b) => b.rate - a.rate || b.priority - a.priority);
  const best = candidates[0] as { id: LogFormatId; rate: number };
  if (best.rate < 0.3) return { id: null, rate: best.rate, sampled: sample.length };
  // prefer the more specific parser when it is nearly as good
  const vh = candidates.find((c) => c.id === 'vhost');
  if (vh && vh.rate >= 0.8 * Math.max(clf, 0.0001) && vh.rate > 0.3 && best.id !== 'json' && best.id !== 'alb' && best.id !== 'logfmt') return { id: 'vhost', rate: vh.rate, sampled: sample.length };
  return { id: best.id, rate: best.rate, sampled: sample.length };
}

/* ------------------------------------------------------------------ */
/* Columnar store                                                      */
/* ------------------------------------------------------------------ */

export const MAX_ROWS = 3_000_000;
const MAX_LINE = 32768;

export class Interner {
  private map = new Map<string, number>();
  list: string[] = [];
  id(s: string, owned = false): number {
    let v = this.map.get(s);
    if (v === undefined) {
      v = this.list.length;
      // detach from the (large) line/chunk the substring was sliced from so chunks can be freed
      const own = owned || s.length <= 24 ? s : (s + '\u0000').slice(0, -1);
      this.list.push(own);
      this.map.set(own, v);
    }
    return v;
  }
  get size(): number {
    return this.list.length;
  }
}

export interface FileStats {
  name: string;
  format: LogFormatId | null;
  requested: LogFormatId | 'auto';
  detection: Detection | null;
  lines: number;
  parsed: number;
  unparsed: number;
  samples: { line: number; text: string }[];
  bytes: number;
  truncated: boolean;
  /** index of this file's first row in the store */
  startRow: number;
}

export class LogStore {
  n = 0;
  private cap = 0;
  time = new Float64Array(0);
  status = new Uint16Array(0);
  bytes = new Uint32Array(0);
  rt = new Float32Array(0);
  urt = new Float32Array(0);
  ip = new Uint32Array(0);
  xff = new Int32Array(0);
  method = new Uint32Array(0);
  path = new Uint32Array(0);
  uri = new Uint32Array(0);
  ua = new Uint32Array(0);
  ref = new Uint32Array(0);
  vhost = new Uint32Array(0);
  line = new Uint32Array(0);
  file = new Uint16Array(0);
  ips = new Interner();
  methods = new Interner();
  paths = new Interner();
  uris = new Interner();
  uas = new Interner();
  refs = new Interner();
  vhosts = new Interner();
  files: FileStats[] = [];

  constructor() {
    this.grow(1 << 14);
  }

  private grow(cap: number): void {
    const g = <T extends { length: number; set(a: ArrayLike<number>): void }>(old: T, make: (n: number) => T): T => {
      const next = make(cap);
      next.set(old as unknown as ArrayLike<number>);
      return next;
    };
    this.time = g(this.time, (n) => new Float64Array(n));
    this.status = g(this.status, (n) => new Uint16Array(n));
    this.bytes = g(this.bytes, (n) => new Uint32Array(n));
    this.rt = g(this.rt, (n) => new Float32Array(n));
    this.urt = g(this.urt, (n) => new Float32Array(n));
    this.ip = g(this.ip, (n) => new Uint32Array(n));
    this.xff = g(this.xff, (n) => new Int32Array(n));
    this.method = g(this.method, (n) => new Uint32Array(n));
    this.path = g(this.path, (n) => new Uint32Array(n));
    this.uri = g(this.uri, (n) => new Uint32Array(n));
    this.ua = g(this.ua, (n) => new Uint32Array(n));
    this.ref = g(this.ref, (n) => new Uint32Array(n));
    this.vhost = g(this.vhost, (n) => new Uint32Array(n));
    this.line = g(this.line, (n) => new Uint32Array(n));
    this.file = g(this.file, (n) => new Uint16Array(n));
    this.cap = cap;
  }

  /** Append a record; returns false when the store is full. */
  push(rec: LogRecord, fileIdx: number, lineNo: number): boolean {
    if (this.n >= MAX_ROWS) return false;
    if (this.n >= this.cap) this.grow(Math.min(MAX_ROWS, this.cap * 2));
    const i = this.n++;
    this.time[i] = rec.time;
    this.status[i] = rec.status;
    this.bytes[i] = rec.bytes > 4294967295 ? 4294967295 : rec.bytes;
    this.rt[i] = rec.rt;
    this.urt[i] = rec.urt;
    this.ip[i] = this.ips.id(rec.ip);
    this.xff[i] = rec.xff === '' ? -1 : this.ips.id(rec.xff);
    this.method[i] = this.methods.id(rec.method);
    const uri = rec.uri;
    let q = uri.indexOf('?');
    const h = uri.indexOf('#');
    if (q === -1 || (h !== -1 && h < q)) q = h;
    const uriId = this.uris.id(uri);
    this.uri[i] = uriId;
    this.path[i] = q === -1 ? this.paths.id(this.uris.list[uriId] as string, true) : this.paths.id(uri.slice(0, q));
    this.ua[i] = this.uas.id(rec.ua);
    this.ref[i] = this.refs.id(rec.referrer);
    this.vhost[i] = this.vhosts.id(rec.vhost);
    this.line[i] = lineNo;
    this.file[i] = fileIdx;
    return true;
  }

  /** Drop every file from index `keep` on (rows are appended file by file, so this is a cheap cut). */
  truncate(keep: number): void {
    const f = this.files[keep];
    if (f) this.n = f.startRow;
    this.files.length = Math.min(this.files.length, keep);
  }

  clear(): void {
    this.n = 0;
    this.ips = new Interner();
    this.methods = new Interner();
    this.paths = new Interner();
    this.uris = new Interner();
    this.uas = new Interner();
    this.refs = new Interner();
    this.vhosts = new Interner();
    this.files = [];
    this.grow(1 << 14);
    this.derived.clear();
    this.uaInfo = null;
  }

  /** cache for per-unique-value derived data (bot flags, security flags …) */
  derived = new Map<string, { size: number; data: Uint8Array | Uint16Array }>();
  uaInfo: UaInfo | null = null;
}

/* ------------------------------------------------------------------ */
/* Ingest                                                              */
/* ------------------------------------------------------------------ */

export class LogIngest {
  readonly stats: FileStats;
  private parser: LineParser | null = null;
  private readonly rec = newRecord();
  private buffer: { text: string; no: number }[] = [];
  private detected = false;
  private full = false;

  constructor(
    private readonly store: LogStore,
    private readonly fileIdx: number,
    name: string,
    private readonly requested: LogFormatId | 'auto',
    private readonly custom: CompiledFormat | null
  ) {
    this.stats = { name, format: null, requested, detection: null, lines: 0, parsed: 0, unparsed: 0, samples: [], bytes: 0, truncated: false, startRow: store.n };
    store.files[fileIdx] = this.stats;
    if (requested !== 'auto') {
      this.parser = parserFor(requested, custom);
      this.stats.format = requested;
      this.detected = true;
    }
  }

  addLine(text: string, lineNo: number): void {
    this.stats.lines = lineNo;
    if (this.full) return;
    if (text.charCodeAt(0) <= 32 && text.trim() === '') return;
    if (!this.detected) {
      this.buffer.push({ text, no: lineNo });
      if (this.buffer.length >= 200) this.detect();
      return;
    }
    this.handle(text, lineNo);
  }

  private detect(): void {
    this.detected = true;
    const d = detectFormat(this.buffer.map((b) => b.text));
    this.stats.detection = d;
    if (d.id) {
      this.parser = parserFor(d.id, this.custom);
      this.stats.format = d.id;
    }
    const pending = this.buffer;
    this.buffer = [];
    for (const b of pending) this.handle(b.text, b.no);
  }

  private handle(text: string, lineNo: number): void {
    const rec = this.rec;
    let ok = false;
    if (this.parser && text.length <= MAX_LINE) {
      resetRecord(rec);
      try {
        ok = this.parser(text, rec);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      if (rec.referrer === '-') rec.referrer = '';
      if (rec.ua === '-') rec.ua = '';
      if (rec.vhost === '-') rec.vhost = '';
      if (!this.store.push(rec, this.fileIdx, lineNo)) {
        this.full = true;
        this.stats.truncated = true;
        return;
      }
      this.stats.parsed++;
    } else {
      this.stats.unparsed++;
      if (this.stats.samples.length < 20) this.stats.samples.push({ line: lineNo, text: text.length > 400 ? text.slice(0, 400) + '…' : text });
    }
  }

  get isFull(): boolean {
    return this.full;
  }

  finish(): FileStats {
    if (!this.detected) this.detect();
    return this.stats;
  }
}

/** Splits text chunks into lines (handles CRLF and lines that straddle chunk boundaries). */
export class LineFeeder {
  private carry = '';
  lineNo = 0;
  constructor(private readonly onLine: (line: string, no: number) => void) {}
  feed(chunk: string): void {
    const text = this.carry === '' ? chunk : this.carry + chunk;
    let start = 0;
    for (;;) {
      const idx = text.indexOf('\n', start);
      if (idx === -1) break;
      let end = idx;
      if (end > start && text.charCodeAt(end - 1) === 13) end--;
      this.lineNo++;
      this.onLine(text.slice(start, end), this.lineNo);
      start = idx + 1;
    }
    this.carry = text.slice(start);
  }
  end(): void {
    if (this.carry !== '') {
      const t = this.carry.endsWith('\r') ? this.carry.slice(0, -1) : this.carry;
      this.carry = '';
      this.lineNo++;
      this.onLine(t, this.lineNo);
    }
  }
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

export interface IngestProgress {
  bytes: number;
  total: number;
  lines: number;
}

/** Parse pasted text in slices so the page stays responsive. */
export async function ingestText(
  text: string,
  store: LogStore,
  fileIdx: number,
  name: string,
  requested: LogFormatId | 'auto',
  custom: CompiledFormat | null,
  onProgress?: (p: IngestProgress) => void,
  isCancelled?: () => boolean
): Promise<FileStats | null> {
  const ingest = new LogIngest(store, fileIdx, name, requested, custom);
  const feeder = new LineFeeder((l, no) => ingest.addLine(l, no));
  const SLICE = 1 << 20;
  for (let pos = 0; pos < text.length; pos += SLICE) {
    feeder.feed(text.slice(pos, pos + SLICE));
    ingest.stats.bytes = Math.min(text.length, pos + SLICE);
    onProgress?.({ bytes: ingest.stats.bytes, total: text.length, lines: feeder.lineNo });
    if (text.length > SLICE) {
      await tick();
      if (isCancelled?.()) return null;
    }
    if (ingest.isFull) break;
  }
  feeder.end();
  ingest.stats.bytes = text.length;
  return ingest.finish();
}

/** Stream a File/Blob (optionally gzip) through the parser without loading it all as one string. */
export async function ingestBlob(
  blob: Blob,
  name: string,
  store: LogStore,
  fileIdx: number,
  requested: LogFormatId | 'auto',
  custom: CompiledFormat | null,
  onProgress?: (p: IngestProgress) => void,
  isCancelled?: () => boolean
): Promise<FileStats | null> {
  const ingest = new LogIngest(store, fileIdx, name, requested, custom);
  const feeder = new LineFeeder((l, no) => ingest.addLine(l, no));
  let gz = /\.gz$/i.test(name) || blob.type === 'application/gzip' || blob.type === 'application/x-gzip';
  if (!gz && blob.size >= 2) {
    const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    gz = head[0] === 0x1f && head[1] === 0x8b;
  }
  let stream: ReadableStream<Uint8Array> = blob.stream();
  if (gz) {
    const DS = (globalThis as unknown as { DecompressionStream?: new (f: string) => TransformStream<Uint8Array, Uint8Array> }).DecompressionStream;
    if (!DS) throw new Error('This browser cannot decompress .gz files; unzip the log first.');
    stream = stream.pipeThrough(new DS('gzip'));
  }
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let bytes = 0;
  let last = performance.now();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (isCancelled?.()) return null;
      bytes += value.byteLength;
      feeder.feed(decoder.decode(value, { stream: true }));
      ingest.stats.bytes = gz ? bytes : Math.min(bytes, blob.size);
      if (ingest.isFull) break;
      const now = performance.now();
      if (now - last > 40) {
        onProgress?.({ bytes: gz ? 0 : bytes, total: gz ? 0 : blob.size, lines: feeder.lineNo });
        await tick();
        last = performance.now();
        if (isCancelled?.()) return null;
      }
    }
    feeder.feed(decoder.decode());
    feeder.end();
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* already closed */
    }
  }
  onProgress?.({ bytes: blob.size, total: blob.size, lines: feeder.lineNo });
  return ingest.finish();
}

/* ------------------------------------------------------------------ */
/* User agents                                                         */
/* ------------------------------------------------------------------ */

export type UaKind = 'human' | 'bot' | 'tool' | 'other' | 'empty';

const NAMED_BOTS: [RegExp, string][] = [
  [/googlebot|google-inspectiontool|googleother|apis-google|adsbot-google|mediapartners-google|storebot-google|feedfetcher-google/i, 'Googlebot'],
  [/bingbot|bingpreview|msnbot/i, 'Bingbot'],
  [/yandex(?:bot|images|metrika)?/i, 'YandexBot'],
  [/baiduspider|baidu/i, 'Baidu'],
  [/duckduckbot|duckduckgo/i, 'DuckDuckBot'],
  [/slurp/i, 'Yahoo Slurp'],
  [/applebot/i, 'Applebot'],
  [/gptbot|chatgpt-user|oai-searchbot/i, 'OpenAI'],
  [/claudebot|claude-web|anthropic-ai/i, 'Anthropic'],
  [/perplexitybot/i, 'Perplexity'],
  [/ccbot/i, 'CCBot'],
  [/bytespider|bytedance/i, 'Bytespider'],
  [/petalbot/i, 'PetalBot'],
  [/semrushbot/i, 'SemrushBot'],
  [/ahrefsbot/i, 'AhrefsBot'],
  [/mj12bot/i, 'MJ12bot'],
  [/dotbot/i, 'DotBot'],
  [/facebookexternalhit|facebot|meta-externalagent/i, 'Facebook'],
  [/twitterbot/i, 'Twitterbot'],
  [/linkedinbot/i, 'LinkedInBot'],
  [/slackbot|slack-imgproxy/i, 'Slackbot'],
  [/discordbot/i, 'Discordbot'],
  [/telegrambot/i, 'TelegramBot'],
  [/whatsapp/i, 'WhatsApp'],
  [/pinterest(?:bot)?/i, 'Pinterest'],
  [/sogou/i, 'Sogou'],
  [/exabot/i, 'Exabot'],
  [/seznambot/i, 'SeznamBot'],
  [/uptimerobot|pingdom|statuscake|site24x7|betteruptime|uptime-kuma|datadog|newrelic|zabbix|nagios|prometheus|blackbox|checkmk/i, 'Monitoring'],
  [/lighthouse|gtmetrix|pagespeed|webpagetest/i, 'Performance test'],
];
const TOOLS_RE = /curl\/|wget\/|python-requests|python-urllib|python\/|aiohttp|httpx|go-http-client|java\/|okhttp|apache-httpclient|libwww-perl|lwp::|httpie|axios\/|node-fetch|undici|postman|insomnia|scrapy|guzzlehttp|restsharp|ruby|php\/|powershell|winhttp|headlesschrome|phantomjs|selenium|puppeteer|playwright|nikto|sqlmap|nmap|masscan|zgrab|gobuster|dirbuster|wpscan|nuclei|acunetix|nessus|openvas|havij|ffuf|feroxbuster|hydra/i;
const GENERIC_BOT_RE = /\b(?:bot|crawler?|spider|scraper|fetcher|archiver|indexer|checker|monitor|scanner|probe)\b|[-_/ ](?:bot|spider|crawl)/i;
const BROWSER_RE = /^(?:Mozilla|Opera)\/|Firefox\/|Chrome\/|Safari\/|Edg\/|MSIE |Trident\/|Dalvik\/|CFNetwork|AppleWebKit/;

export function classifyUa(ua: string): { kind: UaKind; name: string } {
  const s = ua.trim();
  if (s === '' || s === '-') return { kind: 'empty', name: '(empty)' };
  for (const [re, name] of NAMED_BOTS) if (re.test(s)) return { kind: 'bot', name };
  if (TOOLS_RE.test(s)) {
    const m = /(curl|wget|python-requests|python-urllib|go-http-client|okhttp|libwww-perl|httpie|axios|node-fetch|postman|scrapy|java|headlesschrome|selenium|puppeteer|playwright|nikto|sqlmap|nmap|masscan|zgrab|gobuster|dirbuster|wpscan|nuclei|aiohttp|httpx|guzzlehttp|apache-httpclient|ruby|php|powershell)/i.exec(s);
    return { kind: 'tool', name: m ? (m[1] ?? 'tool').toLowerCase() : 'tool' };
  }
  if (GENERIC_BOT_RE.test(s)) return { kind: 'bot', name: s.length > 40 ? s.slice(0, 40) + '…' : s };
  if (BROWSER_RE.test(s)) return { kind: 'human', name: browserName(s) };
  return { kind: 'other', name: s.length > 40 ? s.slice(0, 40) + '…' : s };
}

function browserName(ua: string): string {
  if (/Edg(?:e|A|iOS)?\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/Firefox\/|FxiOS/.test(ua)) return 'Firefox';
  if (/Chrome\/|CriOS/.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  if (/MSIE |Trident\//.test(ua)) return 'Internet Explorer';
  return 'Browser';
}

/* ------------------------------------------------------------------ */
/* Security heuristics                                                 */
/* ------------------------------------------------------------------ */

export interface SecurityRule {
  id: string;
  label: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  bit: number;
  test: RegExp;
}

export const SECURITY_RULES: SecurityRule[] = [
  { id: 'traversal', label: 'Path traversal / local file access', severity: 'high', description: '../, encoded dots, /etc/passwd, win.ini and similar file probes', bit: 1, test: /\.\.[\\/]|%2e%2e|\.\.%2f|\.\.%5c|%252e%252e|\/etc\/(?:passwd|shadow|hosts)|\/proc\/self|c:\\windows|c:\/windows|boot\.ini|win\.ini|\/windows\/system32/ },
  { id: 'sqli', label: 'SQL injection attempts', severity: 'high', description: 'UNION SELECT, OR 1=1, quotes, SLEEP(), information_schema…', bit: 2, test: /union(?:\s|\+|%20|\/\*.*?\*\/)+(?:all(?:\s|\+|%20)+)?select|(?:'|%27)\s*(?:or|and)\s*(?:'|%27)?\d|\bor\s+1\s*=\s*1|(?:'|%27)(?:\s|\+|%20)*(?:--|%2d%2d|#)|%27|sleep\s*\(\d|benchmark\s*\(|information_schema|waitfor\s+delay|load_file\s*\(|into\s+outfile|xp_cmdshell|\bselect(?:\s|\+|%20|\/\*.*?\*\/)+(?:[^&=]{0,100}?(?:\s|\+|%20))?from(?:\s|\+|%20)/ },
  { id: 'xss', label: 'Cross-site scripting attempts', severity: 'high', description: '<script>, javascript:, onerror= and encoded variants', bit: 4, test: /<script|%3cscript|%3c%73cript|javascript:|\bon(?:error|load|mouseover|focus)\s*=|<img[^>]+src|alert\s*\(|<svg|%3csvg|<iframe/ },
  { id: 'rce', label: 'Command / code injection', severity: 'high', description: 'shell commands, eval, ${jndi:…}, php://input, web shells', bit: 8, test: /\$\{jndi:|cmd\.exe|\/bin\/(?:ba)?sh|;\s*(?:cat|ls|id|wget|curl)\b|\|\s*(?:cat|ls|id|wget|curl)\b|%7c(?:cat|ls|id|wget)|`[^`]+`|\$\([^)]+\)|\beval\s*\(|base64_decode|php:\/\/|allow_url_include|auto_prepend_file|eval-stdin\.php|\/(?:shell|c99|r57|webshell|cmd|wso|b374k)\.(?:php|jsp|asp)|\bwget\s+https?:|\bcurl\s+https?:/ },
  { id: 'sensitive', label: 'Sensitive file probes', severity: 'medium', description: '/.env, /.git/, /.aws, backups, config files, phpinfo', bit: 16, test: /\/\.env(?:\.|$|\/|\?)|\/\.git(?:\/|$)|\/\.svn(?:\/|$)|\/\.hg(?:\/|$)|\/\.aws\/|\/\.ssh\/|\/\.htaccess|\/\.htpasswd|\/\.ds_store|\/id_rsa|\/web\.config|\/wp-config\.php|\/config\.(?:php|json|yml|yaml|inc)(?:$|\?)|\/(?:backup|dump|database|db|site|www)\.(?:sql|zip|tar|tar\.gz|tgz|gz|bak|old|7z|rar)(?:$|\?)|\/phpinfo\.php|\/server-status|\/server-info|\/credentials|\/secrets?\.(?:json|ya?ml|txt)|\.(?:bak|old|orig|swp|sql)(?:$|\?)|\/composer\.(?:json|lock)|\/package-lock\.json|\/docker-compose\.ya?ml|\/\.dockerenv|\/actuator\/(?:env|heapdump|configprops)/ },
  { id: 'wordpress', label: 'WordPress / CMS probing', severity: 'medium', description: '/wp-login.php, /xmlrpc.php, /wp-admin, plugin and theme scans', bit: 32, test: /\/wp-login\.php|\/xmlrpc\.php|\/wp-admin|\/wp-content\/(?:plugins|themes|uploads\/.*\.php)|\/wp-includes|\/wp-json\/wp\/v2\/users|\/administrator\/index\.php|\/user\/login|\/joomla|\/drupal|\/typo3|\/magento|\/wp-cron\.php|\/wordpress\// },
  { id: 'adminscan', label: 'Admin panel & framework scanners', severity: 'medium', description: 'phpMyAdmin, /manager/html, /solr, /console, /cgi-bin, router and CMS exploits', bit: 64, test: /\/phpmyadmin|\/pma\/|\/myadmin|\/manager\/html|\/solr\/|\/jenkins|\/console\/?(?:$|\?)|\/cgi-bin\/|\/boaform|\/hnap1|\/vendor\/phpunit|\/_ignition|\/owa\/|\/ecp\/|\/remote\/login|\/vpn\/|\/admin(?:istrator)?\/?(?:$|\?|\/login)|\/login\.(?:php|asp|aspx|jsp)|\/setup\.php|\/install\.php|\/telescope|\/\.well-known\/security\.txt|\/api\/jsonws|\/jmx-console|\/axis2|\/struts|\/geoserver|\/ssi\/|\/shell\?|\/GponForm/i },
  { id: 'scanner-ua', label: 'Known scanner user agents', severity: 'medium', description: 'sqlmap, nikto, nmap, masscan, zgrab, wpscan, nuclei, acunetix…', bit: 128, test: /sqlmap|nikto|nmap|masscan|zgrab|wpscan|nuclei|acunetix|nessus|openvas|havij|dirbuster|gobuster|feroxbuster|ffuf|hydra|netsparker|burp|w3af|arachni|metasploit|libwww-perl|zmeu|morfeus/i },
];

const SEC_URI_RULES = SECURITY_RULES.filter((r) => r.id !== 'scanner-ua');
const SEC_UA_RULE = SECURITY_RULES.find((r) => r.id === 'scanner-ua') as SecurityRule;

function safeDecode(s: string): string {
  if (s.indexOf('%') === -1) return s;
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
}

/** Bitmask of the security rules matched by a request target (raw and percent-decoded, case-insensitive). */
export function securityFlagsForUri(uri: string): number {
  const raw = uri.toLowerCase();
  const decoded = safeDecode(raw);
  let flags = 0;
  for (const r of SEC_URI_RULES) {
    if (r.test.test(raw) || (decoded !== raw && r.test.test(decoded))) flags |= r.bit;
  }
  return flags;
}

export function securityFlagsForUa(ua: string): number {
  return SEC_UA_RULE.test.test(ua) ? SEC_UA_RULE.bit : 0;
}

function* derivedGen(store: LogStore, key: string, interner: Interner, fn: (s: string) => number, wide: boolean): Generator<number, Uint8Array | Uint16Array, void> {
  const cached = store.derived.get(key);
  const size = interner.size;
  if (cached && cached.size === size) return cached.data;
  const data = wide ? new Uint16Array(size) : new Uint8Array(size);
  const old = cached?.data;
  const from = old ? old.length : 0;
  if (old && from > 0) (data as Uint16Array).set(old as Uint16Array);
  for (let i = from; i < size; i++) {
    data[i] = fn(interner.list[i] ?? '');
    if ((i - from) % 20000 === 19999) yield (i - from) / (size - from);
  }
  store.derived.set(key, { size, data });
  return data;
}

function* scaled<T>(g: Generator<number, T, void>, factor: number): Generator<number, T, void> {
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
    yield r.value * factor;
  }
}

function drive<T>(g: Generator<number, T, void>): T {
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
  }
}

const UA_KIND_CODE: Record<UaKind, number> = { human: 1, bot: 2, tool: 3, other: 4, empty: 5 };
const UA_KIND_BY_CODE: UaKind[] = ['other', 'human', 'bot', 'tool', 'other', 'empty'];

/** Per-unique-user-agent classification (kind + display name), computed once and extended as the store grows. */
export interface UaInfo {
  size: number;
  kind: Uint8Array;
  nameId: Uint32Array;
  names: string[];
  nameKinds: UaKind[];
  nameMap: Map<string, number>;
}

function* uaInfoGen(store: LogStore): Generator<number, UaInfo, void> {
  const size = store.uas.size;
  const cached = store.uaInfo;
  if (cached && cached.size === size) return cached;
  const kind = new Uint8Array(size);
  const nameId = new Uint32Array(size);
  const from = cached ? cached.size : 0;
  if (cached) {
    kind.set(cached.kind);
    nameId.set(cached.nameId);
  }
  const names = cached ? cached.names : [];
  const nameKinds = cached ? cached.nameKinds : [];
  const nameMap = cached ? cached.nameMap : new Map<string, number>();
  for (let i = from; i < size; i++) {
    const c = classifyUa(store.uas.list[i] ?? '');
    kind[i] = UA_KIND_CODE[c.kind];
    const key = c.kind + '|' + c.name;
    let ni = nameMap.get(key);
    if (ni === undefined) {
      ni = names.length;
      names.push(c.name);
      nameKinds.push(c.kind);
      nameMap.set(key, ni);
    }
    nameId[i] = ni;
    if ((i - from) % 20000 === 19999) yield (i - from) / (size - from);
  }
  const info: UaInfo = { size, kind, nameId, names, nameKinds, nameMap };
  store.uaInfo = info;
  return info;
}

/** Make sure the per-value caches (user agent kinds, security flags) are up to date; call after ingesting. */
export async function warmCaches(store: LogStore, onProgress?: (f: number) => void, isCancelled?: () => boolean): Promise<boolean> {
  const steps: Generator<number, unknown, void>[] = [uaInfoGen(store), derivedGen(store, 'urisec', store.uris, securityFlagsForUri, true), derivedGen(store, 'uasec', store.uas, securityFlagsForUa, true)];
  let last = performance.now();
  for (let k = 0; k < steps.length; k++) {
    const g = steps[k] as Generator<number, unknown, void>;
    for (;;) {
      const r = g.next();
      if (r.done) break;
      onProgress?.((k + r.value) / steps.length);
      if (performance.now() - last > 30) {
        await tick();
        last = performance.now();
        if (isCancelled?.()) return false;
      }
    }
  }
  onProgress?.(1);
  return true;
}

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */

export interface LogFilters {
  /** "404, 5xx, 400-499, >=500" */
  status: string;
  /** "1.2.3.4, 10.0.0.0/8, 192.168., *.example" */
  ip: string;
  /** JavaScript regular expression tested against the request target (path + query) */
  path: string;
  /** "GET, POST" */
  method: string;
  from: number | null;
  to: number | null;
  audience: 'all' | 'humans' | 'bots';
  useXff: boolean;
  /** '' = off, 'any' = every suspicious request, or a SECURITY_RULES id */
  security: string;
}

export const NO_FILTERS: LogFilters = { status: '', ip: '', path: '', method: '', from: null, to: null, audience: 'all', useXff: false, security: '' };

export function parseStatusFilter(spec: string): { test: (s: number) => boolean; error: string | null } {
  const tokens = spec.split(/[\s,;]+/).filter(Boolean);
  const tests: ((s: number) => boolean)[] = [];
  const negs: ((s: number) => boolean)[] = [];
  for (let tok of tokens) {
    let neg = false;
    if (tok.startsWith('!')) {
      neg = true;
      tok = tok.slice(1);
    }
    let f: ((s: number) => boolean) | null = null;
    let m: RegExpExecArray | null;
    if ((m = /^([1-5])xx$/i.exec(tok))) {
      const c = Number(m[1]);
      f = (s) => s >= c * 100 && s < c * 100 + 100;
    } else if ((m = /^(\d{3})$/.exec(tok))) {
      const c = Number(m[1]);
      f = (s) => s === c;
    } else if ((m = /^(\d{3})-(\d{3})$/.exec(tok))) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      f = (s) => s >= Math.min(a, b) && s <= Math.max(a, b);
    } else if ((m = /^(>=|<=|>|<|=)\s*(\d{3})$/.exec(tok))) {
      const c = Number(m[2]);
      const op = m[1];
      f = op === '>=' ? (s) => s >= c : op === '<=' ? (s) => s <= c : op === '>' ? (s) => s > c : op === '<' ? (s) => s < c : (s) => s === c;
    }
    if (!f) return { test: () => true, error: `Cannot read the status filter "${tok}" (use 404, 5xx, 400-499 or >=500).` };
    (neg ? negs : tests).push(f);
  }
  return {
    test: (s) => (tests.length === 0 || tests.some((t) => t(s))) && !negs.some((t) => t(s)),
    error: null,
  };
}

function ipv4ToInt(s: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return null;
  const p = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  if (p.some((x) => x > 255)) return null;
  return ((p[0]! << 24) | (p[1]! << 16) | (p[2]! << 8) | p[3]!) >>> 0;
}

export function parseIpFilter(spec: string): { test: (ip: string) => boolean; error: string | null } {
  const tokens = spec.split(/[\s,;]+/).filter(Boolean);
  const pos: ((ip: string) => boolean)[] = [];
  const neg: ((ip: string) => boolean)[] = [];
  for (let tok of tokens) {
    let isNeg = false;
    if (tok.startsWith('!')) {
      isNeg = true;
      tok = tok.slice(1);
    }
    let f: (ip: string) => boolean;
    const cidr = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(tok);
    if (cidr) {
      const base = ipv4ToInt(cidr[1] ?? '');
      const bits = Number(cidr[2]);
      if (base === null || bits > 32) return { test: () => true, error: `"${tok}" is not a valid IPv4 CIDR range.` };
      const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
      f = (ip) => {
        const v = ipv4ToInt(ip);
        return v !== null && ((v & mask) >>> 0) === ((base & mask) >>> 0);
      };
    } else if (tok.endsWith('*')) {
      const p = tok.slice(0, -1);
      f = (ip) => ip.startsWith(p);
    } else if (tok.startsWith('*')) {
      const p = tok.slice(1);
      f = (ip) => ip.endsWith(p);
    } else if (/^[0-9a-fA-F:.]+$/.test(tok) && (tok.endsWith('.') || tok.endsWith(':'))) {
      f = (ip) => ip.startsWith(tok);
    } else if (/^[0-9a-fA-F:.]+$/.test(tok)) {
      f = (ip) => ip === tok;
    } else {
      const low = tok.toLowerCase();
      f = (ip) => ip.toLowerCase().includes(low);
    }
    (isNeg ? neg : pos).push(f);
  }
  return { test: (ip) => (pos.length === 0 || pos.some((t) => t(ip))) && !neg.some((t) => t(ip)), error: null };
}

export interface BuiltFilter {
  test: (i: number) => boolean;
  error: string | null;
  active: boolean;
}

/** Turn the filter settings into a fast per-row predicate (string checks run once per unique value). */
export function buildFilter(store: LogStore, f: LogFilters): BuiltFilter {
  const st = f.status.trim() ? parseStatusFilter(f.status) : null;
  if (st?.error) return { test: () => true, error: st.error, active: false };
  const ipSpec = f.ip.trim() ? parseIpFilter(f.ip) : null;
  if (ipSpec?.error) return { test: () => true, error: ipSpec.error, active: false };
  let re: RegExp | null = null;
  if (f.path.trim()) {
    try {
      re = new RegExp(f.path, 'i');
    } catch (e) {
      return { test: () => true, error: `Invalid path regular expression: ${e instanceof Error ? e.message : String(e)}`, active: false };
    }
  }
  const methods = f.method.split(/[\s,;]+/).filter(Boolean).map((m) => m.toUpperCase());
  const stOk = st ? st.test : null;

  let ipOk: Uint8Array | null = null;
  if (ipSpec) {
    ipOk = new Uint8Array(store.ips.size);
    for (let k = 0; k < ipOk.length; k++) ipOk[k] = ipSpec.test(store.ips.list[k] ?? '') ? 1 : 0;
  }
  let uriOk: Uint8Array | null = null;
  if (re) {
    uriOk = new Uint8Array(store.uris.size);
    for (let k = 0; k < uriOk.length; k++) uriOk[k] = re.test(store.uris.list[k] ?? '') ? 1 : 0;
  }
  let methodOk: Uint8Array | null = null;
  if (methods.length > 0) {
    methodOk = new Uint8Array(store.methods.size);
    for (let k = 0; k < methodOk.length; k++) methodOk[k] = methods.includes((store.methods.list[k] ?? '').toUpperCase()) ? 1 : 0;
  }
  let uaKind: Uint8Array | null = null;
  if (f.audience !== 'all') uaKind = drive(uaInfoGen(store)).kind;
  let secMask = 0;
  let uriSecTable: Uint16Array | null = null;
  let uaSecTable: Uint16Array | null = null;
  if (f.security !== '') {
    const rule = SECURITY_RULES.find((r) => r.id === f.security);
    secMask = f.security === 'any' ? 0xffff : (rule?.bit ?? 0xffff);
    uriSecTable = drive(derivedGen(store, 'urisec', store.uris, securityFlagsForUri, true)) as Uint16Array;
    uaSecTable = drive(derivedGen(store, 'uasec', store.uas, securityFlagsForUa, true)) as Uint16Array;
  }
  const from = f.from;
  const to = f.to;
  const useXff = f.useXff;
  const humans = f.audience === 'humans';
  const active = !!(st || ipSpec || re || methods.length || from !== null || to !== null || f.audience !== 'all' || f.security !== '');
  const test = (i: number): boolean => {
    if (stOk && !stOk(store.status[i] as number)) return false;
    if (ipOk) {
      const x = store.xff[i] as number;
      const id = useXff && x >= 0 ? x : (store.ip[i] as number);
      if (!ipOk[id]) return false;
    }
    if (uriOk && !uriOk[store.uri[i] as number]) return false;
    if (methodOk && !methodOk[store.method[i] as number]) return false;
    if (from !== null || to !== null) {
      const t = store.time[i] as number;
      if (Number.isNaN(t)) return false;
      if (from !== null && t < from) return false;
      if (to !== null && t > to) return false;
    }
    if (uaKind) {
      const k = uaKind[store.ua[i] as number] as number;
      if (humans ? k !== 1 : k === 1) return false;
    }
    if (uriSecTable && uaSecTable) {
      const flags = (uriSecTable[store.uri[i] as number] as number) | (uaSecTable[store.ua[i] as number] as number);
      if ((flags & secMask) === 0) return false;
    }
    return true;
  };
  return { test, error: null, active };
}

/* ------------------------------------------------------------------ */
/* Statistics                                                          */
/* ------------------------------------------------------------------ */

/** Percentile with linear interpolation between closest ranks (the numpy / Excel PERCENTILE.INC default). */
export function percentile(sorted: ArrayLike<number>, p: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  if (n === 1) return sorted[0] as number;
  const rank = (Math.min(100, Math.max(0, p)) / 100) * (n - 1);
  const lo = Math.floor(rank);
  const hi = Math.min(n - 1, lo + 1);
  const frac = rank - lo;
  return (sorted[lo] as number) + ((sorted[hi] as number) - (sorted[lo] as number)) * frac;
}

export interface LatencyStats {
  count: number;
  min: number;
  avg: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
}

/** Summarise a list of durations (seconds). Sorts a copy. */
export function summarizeLatency(values: ArrayLike<number>): LatencyStats | null {
  const n = values.length;
  if (n === 0) return null;
  const a = new Float64Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = values[i] as number;
    a[i] = v;
    sum += v;
  }
  a.sort();
  return {
    count: n,
    min: a[0] as number,
    avg: sum / n,
    p50: percentile(a, 50),
    p90: percentile(a, 90),
    p95: percentile(a, 95),
    p99: percentile(a, 99),
    max: a[n - 1] as number,
  };
}

const BUCKET_SIZES = [1, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400, 172800, 604800, 2592000].map((s) => s * 1000);

/** Smallest "nice" bucket that keeps the chart under `maxBuckets` bars. */
export function pickBucketSize(rangeMs: number, maxBuckets = 80): number {
  for (const b of BUCKET_SIZES) if (rangeMs / b <= maxBuckets) return b;
  return BUCKET_SIZES[BUCKET_SIZES.length - 1] as number;
}

export function bucketLabel(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${s / 60} min`;
  if (s < 86400) return `${s / 3600} h`;
  return `${s / 86400} d`;
}

export interface TopEntry {
  key: string;
  count: number;
  bytes?: number;
  extra?: number;
  extra2?: number;
}

export interface HistogramBucket {
  total: number;
  c2: number;
  c3: number;
  c4: number;
  c5: number;
}

export interface Histogram {
  start: number;
  size: number;
  buckets: HistogramBucket[];
}

export interface RowView {
  row: number;
  line: number;
  file: number;
  time: number;
  ip: string;
  method: string;
  uri: string;
  status: number;
  bytes: number;
  rt: number;
  ua: string;
}

export interface SecurityFinding {
  id: string;
  label: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  requests: number;
  uniqueIps: number;
  topIps: TopEntry[];
  topUris: TopEntry[];
}

export interface Analysis {
  total: number;
  uniqueIps: number;
  withTime: number;
  firstTime: number;
  lastTime: number;
  bytes: number;
  statusClass: { c1: number; c2: number; c3: number; c4: number; c5: number; other: number };
  statusCodes: TopEntry[];
  topIps: TopEntry[];
  topPaths: TopEntry[];
  topUas: TopEntry[];
  topReferrers: TopEntry[];
  methods: TopEntry[];
  audience: { human: number; bot: number; tool: number; other: number; empty: number };
  topBots: TopEntry[];
  topBrowsers: TopEntry[];
  histogram: Histogram | null;
  latency: LatencyStats | null;
  upstream: LatencyStats | null;
  slowestPaths: TopEntry[];
  slowestRequests: RowView[];
  largestRequests: RowView[];
  topBytesPaths: TopEntry[];
  errorPaths4xx: TopEntry[];
  errorPaths5xx: TopEntry[];
  samples4xx: RowView[];
  samples5xx: RowView[];
  security: SecurityFinding[];
  suspiciousRequests: number;
  notFoundIps: TopEntry[];
  rateIps: TopEntry[];
  vhosts: TopEntry[];
}

export interface AnalyzeOptions {
  topN: number;
  /** IPs with at least this many 404s are listed */
  notFoundThreshold: number;
  /** IPs need at least this many requests to be checked for burst rates */
  rateMinRequests: number;
  useXff: boolean;
}

export const DEFAULT_ANALYZE_OPTIONS: AnalyzeOptions = { topN: 10, notFoundThreshold: 20, rateMinRequests: 100, useXff: false };

/** Indexes of the `k` largest entries of `counts` (descending), ignoring zeros. */
export function topIndexes(counts: ArrayLike<number>, k: number): number[] {
  const n = counts.length;
  let nonZero = 0;
  for (let i = 0; i < n; i++) if ((counts[i] as number) > 0) nonZero++;
  if (nonZero === 0) return [];
  const idx: number[] = [];
  if (nonZero <= 20000) {
    for (let i = 0; i < n; i++) if ((counts[i] as number) > 0) idx.push(i);
  } else {
    // threshold selection: sort a copy of the counts to find the k-th largest value
    const copy = Float64Array.from(counts as ArrayLike<number>);
    copy.sort();
    const threshold = Math.max(1, copy[Math.max(0, n - k)] as number);
    let ties = 0;
    for (let i = 0; i < n; i++) {
      const c = counts[i] as number;
      if (c > threshold) idx.push(i);
      else if (c === threshold) ties++;
    }
    let room = k - idx.length;
    if (ties > 0 && room > 0) {
      for (let i = 0; i < n && room > 0; i++) {
        if ((counts[i] as number) === threshold) {
          idx.push(i);
          room--;
        }
      }
    }
  }
  idx.sort((a, b) => (counts[b] as number) - (counts[a] as number) || a - b);
  return idx.slice(0, k);
}

function rowView(store: LogStore, i: number): RowView {
  return {
    row: i,
    line: store.line[i] as number,
    file: store.file[i] as number,
    time: store.time[i] as number,
    ip: store.ips.list[store.ip[i] as number] ?? '',
    method: store.methods.list[store.method[i] as number] ?? '',
    uri: store.uris.list[store.uri[i] as number] ?? '',
    status: store.status[i] as number,
    bytes: store.bytes[i] as number,
    rt: store.rt[i] as number,
    ua: store.uas.list[store.ua[i] as number] ?? '',
  };
}

const SLICE_ROWS = 150000;

/**
 * Compute the dashboard numbers for the rows accepted by `filter`. A generator so callers can
 * run it in slices (yielding progress 0..1).
 */
export function* analyzeGen(store: LogStore, filter: BuiltFilter, opts: AnalyzeOptions): Generator<number, Analysis, void> {
  const n = store.n;
  const topN = opts.topN;
  const nIps = store.ips.size;
  const nPaths = store.paths.size;
  const nUas = store.uas.size;
  const nRefs = store.refs.size;
  const nMethods = store.methods.size;
  const nVhosts = store.vhosts.size;

  const uaI = yield* scaled(uaInfoGen(store), 0.05);
  const uriSec = (yield* scaled(derivedGen(store, 'urisec', store.uris, securityFlagsForUri, true), 0.1)) as Uint16Array;
  const uaSec = (yield* scaled(derivedGen(store, 'uasec', store.uas, securityFlagsForUa, true), 0.02)) as Uint16Array;
  const uaKind = uaI.kind;
  const uaNameList = uaI.names;
  const uaNameKind = uaI.nameKinds;

  const ipCount = new Uint32Array(nIps);
  const ipBytes = new Float64Array(nIps);
  const ip404 = new Uint32Array(nIps);
  const pathCount = new Uint32Array(nPaths);
  const pathBytes = new Float64Array(nPaths);
  const pathRtSum = new Float64Array(nPaths);
  const pathRtCnt = new Uint32Array(nPaths);
  const pathRtMax = new Float32Array(nPaths);
  const uaCount = new Uint32Array(nUas);
  const refCount = new Uint32Array(nRefs);
  const methodCount = new Uint32Array(nMethods);
  const vhostCount = new Uint32Array(nVhosts);
  const statusCount = new Uint32Array(1000);
  const errPaths4 = new Map<number, number>();
  const errPaths5 = new Map<number, number>();
  const rtValues = new Float64Array(n);
  const urtValues = new Float64Array(n);
  let rtN = 0;
  let urtN = 0;
  const slowest: { i: number; v: number }[] = [];
  const largest: { i: number; v: number }[] = [];
  const samples4: RowView[] = [];
  const samples5: RowView[] = [];
  const secIps: Map<number, number>[] = SECURITY_RULES.map(() => new Map());
  const secUris: Map<number, number>[] = SECURITY_RULES.map(() => new Map());
  const secCount: number[] = SECURITY_RULES.map(() => 0);
  const secIpSets: Set<number>[] = SECURITY_RULES.map(() => new Set());
  let suspicious = 0;
  const audience = { human: 0, bot: 0, tool: 0, other: 0, empty: 0 };
  const botNameCount: number[] = [];
  const browserNameCount: number[] = [];

  let total = 0;
  let bytes = 0;
  let withTime = 0;
  let first = Infinity;
  let last = -Infinity;
  const cls = { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, other: 0 };
  const xff = opts.useXff;
  const test = filter.test;
  const matched: Uint8Array = new Uint8Array(n);

  const pushTop = (arr: { i: number; v: number }[], i: number, v: number): void => {
    if (arr.length < 10) {
      arr.push({ i, v });
      arr.sort((a, b) => b.v - a.v);
    } else if (v > (arr[9] as { v: number }).v) {
      arr[9] = { i, v };
      arr.sort((a, b) => b.v - a.v);
    }
  };
  const countBump = (m: Map<number, number>, k: number): void => {
    m.set(k, (m.get(k) ?? 0) + 1);
  };

  for (let i = 0; i < n; i++) {
    if (i % SLICE_ROWS === SLICE_ROWS - 1) yield (0.7 * i) / n;
    if (!test(i)) continue;
    matched[i] = 1;
    total++;
    const st = store.status[i] as number;
    const b = store.bytes[i] as number;
    bytes += b;
    const sc = (st / 100) | 0;
    if (sc === 2) cls.c2++;
    else if (sc === 3) cls.c3++;
    else if (sc === 4) cls.c4++;
    else if (sc === 5) cls.c5++;
    else if (sc === 1) cls.c1++;
    else cls.other++;
    statusCount[st < 1000 ? st : 0] = (statusCount[st < 1000 ? st : 0] as number) + 1;
    const xi = store.xff[i] as number;
    const ipId = xff && xi >= 0 ? xi : (store.ip[i] as number);
    ipCount[ipId] = (ipCount[ipId] as number) + 1;
    ipBytes[ipId] = (ipBytes[ipId] as number) + b;
    if (st === 404) ip404[ipId] = (ip404[ipId] as number) + 1;
    const pid = store.path[i] as number;
    pathCount[pid] = (pathCount[pid] as number) + 1;
    pathBytes[pid] = (pathBytes[pid] as number) + b;
    const uaId = store.ua[i] as number;
    uaCount[uaId] = (uaCount[uaId] as number) + 1;
    const rid = store.ref[i] as number;
    refCount[rid] = (refCount[rid] as number) + 1;
    const mid = store.method[i] as number;
    methodCount[mid] = (methodCount[mid] as number) + 1;
    const vid = store.vhost[i] as number;
    vhostCount[vid] = (vhostCount[vid] as number) + 1;
    const t = store.time[i] as number;
    if (!Number.isNaN(t)) {
      withTime++;
      if (t < first) first = t;
      if (t > last) last = t;
    }
    const rt = store.rt[i] as number;
    if (!Number.isNaN(rt)) {
      rtValues[rtN++] = rt;
      pathRtSum[pid] = (pathRtSum[pid] as number) + rt;
      pathRtCnt[pid] = (pathRtCnt[pid] as number) + 1;
      if (rt > (pathRtMax[pid] as number)) pathRtMax[pid] = rt;
      if (slowest.length < 10 || rt > (slowest[9] as { v: number }).v) pushTop(slowest, i, rt);
    }
    const urt = store.urt[i] as number;
    if (!Number.isNaN(urt)) urtValues[urtN++] = urt;
    if (b > 0 && (largest.length < 10 || b > (largest[9] as { v: number }).v)) pushTop(largest, i, b);
    if (sc === 4) {
      countBump(errPaths4, pid * 1000 + st);
      if (samples4.length < 10) samples4.push(rowView(store, i));
    } else if (sc === 5) {
      countBump(errPaths5, pid * 1000 + st);
      if (samples5.length < 10) samples5.push(rowView(store, i));
    }
    // audience
    const kind = UA_KIND_BY_CODE[uaKind[uaId] as number] ?? 'other';
    audience[kind]++;
    if (kind === 'bot' || kind === 'human' || kind === 'tool') {
      const nameIdx = uaI.nameId[uaId] as number;
      if (kind === 'human') browserNameCount[nameIdx] = (browserNameCount[nameIdx] ?? 0) + 1;
      else botNameCount[nameIdx] = (botNameCount[nameIdx] ?? 0) + 1;
    }
    // security
    const flags = (uriSec[store.uri[i] as number] as number) | (uaSec[uaId] as number);
    if (flags !== 0) {
      suspicious++;
      for (let r = 0; r < SECURITY_RULES.length; r++) {
        const rule = SECURITY_RULES[r] as SecurityRule;
        if (flags & rule.bit) {
          secCount[r] = (secCount[r] as number) + 1;
          countBump(secIps[r] as Map<number, number>, ipId);
          countBump(secUris[r] as Map<number, number>, store.uri[i] as number);
          (secIpSets[r] as Set<number>).add(ipId);
        }
      }
    }
  }

  // ---- second pass: histogram + request bursts ----
  let histogram: Histogram | null = null;
  const rateCandidates = new Uint8Array(nIps);
  let anyRate = false;
  for (let k = 0; k < nIps; k++) {
    if ((ipCount[k] as number) >= opts.rateMinRequests) {
      rateCandidates[k] = 1;
      anyRate = true;
    }
  }
  const rateMap = new Map<number, number>();
  if (withTime > 0) {
    const size = pickBucketSize(last - first);
    const start = Math.floor(first / size) * size;
    const nb = Math.min(2000, Math.floor((last - start) / size) + 1);
    const buckets: HistogramBucket[] = Array.from({ length: nb }, () => ({ total: 0, c2: 0, c3: 0, c4: 0, c5: 0 }));
    for (let i = 0; i < n; i++) {
      if (i % SLICE_ROWS === SLICE_ROWS - 1) yield 0.7 + (0.2 * i) / n;
      if (!matched[i]) continue;
      const t = store.time[i] as number;
      if (Number.isNaN(t)) continue;
      const bi = Math.min(nb - 1, Math.floor((t - start) / size));
      const bk = buckets[bi] as HistogramBucket;
      bk.total++;
      const sc = ((store.status[i] as number) / 100) | 0;
      if (sc === 2) bk.c2++;
      else if (sc === 3) bk.c3++;
      else if (sc === 4) bk.c4++;
      else if (sc === 5) bk.c5++;
      if (anyRate) {
        const xi = store.xff[i] as number;
        const ipId = xff && xi >= 0 ? xi : (store.ip[i] as number);
        if (rateCandidates[ipId]) {
          const minute = Math.floor((t - first) / 60000);
          const key = ipId * 1048576 + (minute % 1048576);
          rateMap.set(key, (rateMap.get(key) ?? 0) + 1);
        }
      }
    }
    histogram = { start, size, buckets };
  }

  // ---- assemble ----
  const list = store.ips.list;
  const topIpsIdx = topIndexes(ipCount, topN);
  let uniqueIps = 0;
  for (let k = 0; k < nIps; k++) if ((ipCount[k] as number) > 0) uniqueIps++;
  const entriesFrom = (idx: number[], names: string[], counts: ArrayLike<number>, bytesArr?: ArrayLike<number>): TopEntry[] =>
    idx.map((k) => ({ key: names[k] ?? '', count: counts[k] as number, bytes: bytesArr ? (bytesArr[k] as number) : undefined }));

  const topIps = topIpsIdx.map((k) => ({ key: list[k] ?? '', count: ipCount[k] as number, bytes: ipBytes[k] as number }));
  const topPaths = entriesFrom(topIndexes(pathCount, topN), store.paths.list, pathCount, pathBytes);
  const topUas = entriesFrom(topIndexes(uaCount, topN), store.uas.list, uaCount).map((e) => ({ ...e, key: e.key === '' ? '(empty)' : e.key }));
  const topReferrers = entriesFrom(topIndexes(refCount, topN + 1), store.refs.list, refCount)
    .filter((e) => e.key !== '' && e.key !== '-')
    .slice(0, topN);
  const methods = entriesFrom(topIndexes(methodCount, 12), store.methods.list, methodCount);
  const vhosts = entriesFrom(topIndexes(vhostCount, topN), store.vhosts.list, vhostCount).filter((e) => e.key !== '');
  const codes: TopEntry[] = [];
  for (let c = 100; c < 1000; c++) if ((statusCount[c] as number) > 0) codes.push({ key: String(c), count: statusCount[c] as number });
  if ((statusCount[0] as number) > 0) codes.push({ key: '–', count: statusCount[0] as number });
  codes.sort((a, b) => b.count - a.count);
  const topBytesIdx = topIndexes(pathBytes, topN);
  const topBytesPaths = topBytesIdx.map((k) => ({ key: store.paths.list[k] ?? '', count: pathCount[k] as number, bytes: pathBytes[k] as number }));

  const slowPathIdx: number[] = [];
  const avgs = new Float64Array(nPaths);
  for (let k = 0; k < nPaths; k++) {
    const c = pathRtCnt[k] as number;
    if (c >= 2) avgs[k] = (pathRtSum[k] as number) / c;
  }
  for (const k of topIndexes(avgs, topN)) slowPathIdx.push(k);
  const slowestPaths = slowPathIdx.map((k) => ({
    key: store.paths.list[k] ?? '',
    count: pathRtCnt[k] as number,
    extra: avgs[k] as number,
    extra2: pathRtMax[k] as number,
  }));

  const errTop = (m: Map<number, number>): TopEntry[] =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([key, count]) => {
        const st = key % 1000;
        const pid = (key - st) / 1000;
        return { key: `${st} ${store.paths.list[pid] ?? ''}`, count };
      });

  const botEntries = (counts: number[], wantKinds: UaKind[]): TopEntry[] =>
    counts
      .map((c, k) => ({ key: uaNameList[k] ?? '', count: c ?? 0, kind: uaNameKind[k] }))
      .filter((e) => e.count > 0 && wantKinds.includes(e.kind as UaKind))
      .sort((a, b) => b.count - a.count)
      .slice(0, topN)
      .map((e) => ({ key: e.key, count: e.count }));

  const security: SecurityFinding[] = [];
  SECURITY_RULES.forEach((rule, r) => {
    const count = secCount[r] as number;
    if (count === 0) return;
    const ipsMap = secIps[r] as Map<number, number>;
    const urisMap = secUris[r] as Map<number, number>;
    security.push({
      id: rule.id,
      label: rule.label,
      severity: rule.severity,
      description: rule.description,
      requests: count,
      uniqueIps: (secIpSets[r] as Set<number>).size,
      topIps: [...ipsMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, c]) => ({ key: list[k] ?? '', count: c })),
      topUris: [...urisMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, c]) => ({ key: store.uris.list[k] ?? '', count: c })),
    });
  });
  security.sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.severity] - ({ high: 0, medium: 1, low: 2 })[b.severity] || b.requests - a.requests);

  const nf = topIndexes(ip404, 20)
    .filter((k) => (ip404[k] as number) >= opts.notFoundThreshold)
    .slice(0, 10)
    .map((k) => ({ key: list[k] ?? '', count: ip404[k] as number, extra: (ip404[k] as number) / (ipCount[k] as number), bytes: ipCount[k] as number }));

  const peak = new Map<number, { count: number; minute: number }>();
  for (const [key, c] of rateMap) {
    const ipId = Math.floor(key / 1048576);
    const minute = key % 1048576;
    const cur = peak.get(ipId);
    if (!cur || c > cur.count) peak.set(ipId, { count: c, minute });
  }
  const rateIps = [...peak.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([ipId, p]) => ({ key: list[ipId] ?? '', count: p.count, extra: first + p.minute * 60000, bytes: ipCount[ipId] as number }));

  const toRows = (arr: { i: number; v: number }[]): RowView[] => arr.map((x) => rowView(store, x.i));
  yield 1;
  return {
    total,
    uniqueIps,
    withTime,
    firstTime: withTime > 0 ? first : NaN,
    lastTime: withTime > 0 ? last : NaN,
    bytes,
    statusClass: cls,
    statusCodes: codes,
    topIps,
    topPaths,
    topUas,
    topReferrers,
    methods,
    audience,
    topBots: botEntries(botNameCount, ['bot', 'tool']),
    topBrowsers: botEntries(browserNameCount, ['human']),
    histogram,
    latency: summarizeLatency(rtValues.subarray(0, rtN)),
    upstream: summarizeLatency(urtValues.subarray(0, urtN)),
    slowestPaths,
    slowestRequests: toRows(slowest),
    largestRequests: toRows(largest),
    topBytesPaths,
    errorPaths4xx: errTop(errPaths4),
    errorPaths5xx: errTop(errPaths5),
    samples4xx: samples4,
    samples5xx: samples5,
    security,
    suspiciousRequests: suspicious,
    notFoundIps: nf,
    rateIps,
    vhosts,
  };
}

export function analyze(store: LogStore, filter: BuiltFilter, opts: AnalyzeOptions = DEFAULT_ANALYZE_OPTIONS): Analysis {
  const g = analyzeGen(store, filter, opts);
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
  }
}

export async function analyzeAsync(
  store: LogStore,
  filter: BuiltFilter,
  opts: AnalyzeOptions,
  onProgress?: (f: number) => void,
  isCancelled?: () => boolean
): Promise<Analysis | null> {
  const g = analyzeGen(store, filter, opts);
  let lastTick = performance.now();
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
    onProgress?.(r.value);
    if (performance.now() - lastTick > 30) {
      await tick();
      lastTick = performance.now();
      if (isCancelled?.()) return null;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

export type ExportKind = 'csv' | 'json' | 'ndjson';
export const EXPORT_COLUMNS = ['line', 'time', 'ip', 'forwarded_for', 'method', 'uri', 'status', 'bytes', 'request_time', 'upstream_time', 'user_agent', 'referrer', 'host'] as const;

function csvCell(s: string): string {
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function rowObject(store: LogStore, i: number): Record<string, string | number | null> {
  const t = store.time[i] as number;
  const rt = store.rt[i] as number;
  const urt = store.urt[i] as number;
  const x = store.xff[i] as number;
  return {
    line: store.line[i] as number,
    time: Number.isNaN(t) ? null : new Date(t).toISOString(),
    ip: store.ips.list[store.ip[i] as number] ?? '',
    forwarded_for: x >= 0 ? (store.ips.list[x] ?? '') : '',
    method: store.methods.list[store.method[i] as number] ?? '',
    uri: store.uris.list[store.uri[i] as number] ?? '',
    status: store.status[i] as number,
    bytes: store.bytes[i] as number,
    request_time: Number.isNaN(rt) ? null : Math.round(rt * 1e6) / 1e6,
    upstream_time: Number.isNaN(urt) ? null : Math.round(urt * 1e6) / 1e6,
    user_agent: store.uas.list[store.ua[i] as number] ?? '',
    referrer: store.refs.list[store.ref[i] as number] ?? '',
    host: store.vhosts.list[store.vhost[i] as number] ?? '',
  };
}

/** Export the rows accepted by `filter`. Built in chunks; returns a Blob. */
export async function exportRows(
  store: LogStore,
  filter: BuiltFilter,
  kind: ExportKind,
  limit = 2_000_000,
  onProgress?: (f: number) => void
): Promise<{ blob: Blob; rows: number; truncated: boolean }> {
  const parts: string[] = [];
  let chunk: string[] = [];
  let rows = 0;
  let truncated = false;
  if (kind === 'csv') parts.push(EXPORT_COLUMNS.join(',') + '\n');
  if (kind === 'json') parts.push('[');
  const flush = (): void => {
    if (chunk.length > 0) {
      parts.push(chunk.join(''));
      chunk = [];
    }
  };
  for (let i = 0; i < store.n; i++) {
    if (!filter.test(i)) continue;
    if (rows >= limit) {
      truncated = true;
      break;
    }
    const o = rowObject(store, i);
    if (kind === 'csv') chunk.push(EXPORT_COLUMNS.map((c) => csvCell(o[c] === null || o[c] === undefined ? '' : String(o[c]))).join(',') + '\n');
    else if (kind === 'ndjson') chunk.push(JSON.stringify(o) + '\n');
    else chunk.push((rows > 0 ? ',\n' : '\n') + JSON.stringify(o));
    rows++;
    if (rows % 20000 === 0) {
      flush();
      onProgress?.(i / store.n);
      await tick();
    }
  }
  flush();
  if (kind === 'json') parts.push(rows > 0 ? '\n]\n' : ']\n');
  return { blob: new Blob(parts, { type: kind === 'csv' ? 'text/csv' : kind === 'json' ? 'application/json' : 'application/x-ndjson' }), rows, truncated };
}

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                  */
/* ------------------------------------------------------------------ */

export function formatTime(ms: number, tz: 'utc' | 'local' = 'utc'): string {
  if (!Number.isFinite(ms)) return '–';
  const d = new Date(ms);
  const p = (x: number, w = 2): string => String(x).padStart(w, '0');
  if (tz === 'utc') return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function formatSeconds(s: number): string {
  if (!Number.isFinite(s)) return '–';
  if (s < 0.001) return `${(s * 1e6).toFixed(0)} µs`;
  if (s < 1) return `${(s * 1000).toFixed(s < 0.01 ? 2 : 1)} ms`;
  if (s < 60) return `${s.toFixed(s < 10 ? 2 : 1)} s`;
  return `${(s / 60).toFixed(1)} min`;
}

/* ------------------------------------------------------------------ */
/* Paging through matching rows                                        */
/* ------------------------------------------------------------------ */

/** A page of the rows accepted by `filter`, in file order. */
export function matchingRows(store: LogStore, filter: BuiltFilter, offset: number, limit: number): { rows: RowView[]; more: boolean } {
  const rows: RowView[] = [];
  let seen = 0;
  let more = false;
  for (let i = 0; i < store.n; i++) {
    if (!filter.test(i)) continue;
    if (seen >= offset + limit) {
      more = true;
      break;
    }
    if (seen >= offset) rows.push(rowView(store, i));
    seen++;
  }
  return { rows, more };
}

/* ------------------------------------------------------------------ */
/* Sample data                                                         */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SAMPLE_PATHS = [
  '/', '/', '/', '/index.html', '/about', '/pricing', '/blog', '/blog/2024/launch-notes', '/blog/2024/performance-tips', '/docs/getting-started', '/docs/api/reference',
  '/static/app.js', '/static/app.css', '/static/logo.svg', '/static/hero.webp', '/favicon.ico', '/robots.txt', '/sitemap.xml', '/api/v1/users', '/api/v1/orders', '/api/v1/search?q=widgets',
  '/api/v1/search?q=gadgets&page=2', '/login', '/account', '/cart', '/checkout', '/downloads/report-2024.pdf',
];
const SAMPLE_ATTACKS = [
  '/wp-login.php', '/xmlrpc.php', '/.env', '/.git/config', '/phpmyadmin/index.php', '/admin/', '/cgi-bin/test.cgi', '/index.php?id=1%27%20OR%201=1--', '/search?q=%3Cscript%3Ealert(1)%3C/script%3E',
  '/download?file=../../../../etc/passwd', '/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php', '/api/v1/users?id=1%20UNION%20SELECT%20username,password%20FROM%20users', '/wp-content/plugins/x/shell.php',
];
const SAMPLE_BROWSERS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
];
const SAMPLE_BOTS = [
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
  'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)',
  'curl/8.5.0',
  'python-requests/2.31.0',
  'Go-http-client/1.1',
];
const SAMPLE_REFS = ['-', '-', '-', 'https://www.google.com/', 'https://www.google.com/', 'https://duckduckgo.com/', 'https://news.ycombinator.com/', 'https://example.com/blog', 'https://t.co/abc123'];

export type SampleFormat = 'combined' | 'timing' | 'common' | 'json';

export interface SampleOptions {
  lines: number;
  format?: SampleFormat;
  seed?: number;
  /** epoch ms of the first request (default 2024-05-14 00:00:00 UTC) */
  start?: number;
  /** total span covered in ms (default 6 hours) */
  span?: number;
  /** share of requests that are scanner / attack traffic (default 2 %) */
  attackRate?: number;
}

/** Deterministic synthetic access log for demos and tests. */
export function generateSampleLog(o: SampleOptions): string {
  const rnd = mulberry32(o.seed ?? 1);
  const format = o.format ?? 'combined';
  const start = o.start ?? Date.UTC(2024, 4, 14, 0, 0, 0);
  const span = o.span ?? 6 * 3600 * 1000;
  const attackRate = o.attackRate ?? 0.02;
  const ips: string[] = [];
  for (let i = 0; i < 150; i++) ips.push(`${20 + Math.floor(rnd() * 180)}.${Math.floor(rnd() * 256)}.${Math.floor(rnd() * 256)}.${1 + Math.floor(rnd() * 254)}`);
  const scanners = [0, 1, 2].map(() => `${rnd() < 0.5 ? 185 : 45}.${rnd() < 0.5 ? 220 : 155}.${Math.floor(rnd() * 200)}.${1 + Math.floor(rnd() * 250)}`);
  const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)] as T;
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const p2 = (x: number): string => (x < 10 ? '0' + x : String(x));
  const out: { t: number; line: string }[] = [];
  for (let i = 0; i < o.lines; i++) {
    // gentle daily wave: more traffic in the second half of the span
    const frac = Math.pow(rnd(), 0.8);
    const t = start + Math.floor(frac * span);
    const d = new Date(t);
    const attack = rnd() < attackRate;
    const ip = attack ? pick(scanners) : rnd() < 0.5 ? (ips[Math.floor(Math.pow(rnd(), 2) * ips.length)] as string) : pick(ips);
    let path = attack ? pick(SAMPLE_ATTACKS) : pick(SAMPLE_PATHS);
    let status: number;
    const r = rnd();
    if (attack) status = r < 0.6 ? 404 : r < 0.8 ? 403 : r < 0.9 ? 400 : 200;
    else if (path === '/login' && r < 0.1) status = 401;
    else if (path.startsWith('/api/v1/orders') && r < 0.08) status = 500;
    else if (path.startsWith('/api/') && r < 0.03) status = 502;
    else if (r < 0.04) status = 404;
    else if (r < 0.1) status = 304;
    else if (r < 0.13) status = 301;
    else status = 200;
    if (status === 404 && !attack && rnd() < 0.7) path = pick(['/old-page', '/images/missing.png', '/blog/2019/removed', '/apple-touch-icon.png', '/assets/app.map']);
    const method = attack && rnd() < 0.3 ? 'POST' : path.startsWith('/api/v1/orders') && rnd() < 0.4 ? 'POST' : rnd() < 0.01 ? 'HEAD' : 'GET';
    const bytes = status === 304 ? 0 : status === 404 ? 150 + Math.floor(rnd() * 100) : path.endsWith('.pdf') ? 150000 + Math.floor(rnd() * 1100000) : path.startsWith('/static/') ? 2000 + Math.floor(rnd() * 90000) : 500 + Math.floor(rnd() * 20000);
    const botish = attack ? rnd() < 0.5 : rnd() < 0.15;
    const ua = attack && rnd() < 0.4 ? pick(['sqlmap/1.7.2#stable (https://sqlmap.org)', 'Nikto/2.1.6', 'Mozilla/5.0 zgrab/0.x']) : botish ? pick(SAMPLE_BOTS) : pick(SAMPLE_BROWSERS);
    const ref = botish || attack ? '-' : pick(SAMPLE_REFS);
    const slow = path.startsWith('/api/') ? 0.04 + rnd() * rnd() * 1.2 : path.endsWith('.pdf') ? 0.2 + rnd() : 0.002 + rnd() * rnd() * 0.08;
    const rt = status === 502 ? 5 + rnd() * 55 : slow;
    const clfTime = `${p2(d.getUTCDate())}/${mon[d.getUTCMonth()]}/${d.getUTCFullYear()}:${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())} +0000`;
    if (format === 'json') {
      out.push({ t, line:
        JSON.stringify({ time: d.toISOString(), remote_addr: ip, request_method: method, request_uri: path, status, body_bytes_sent: bytes, request_time: Math.round(rt * 1000) / 1000, http_user_agent: ua, http_referer: ref === '-' ? '' : ref }) }
      );
    } else if (format === 'common') {
      out.push({ t, line: `${ip} - - [${clfTime}] "${method} ${path} HTTP/1.1" ${status} ${bytes}` });
    } else if (format === 'timing') {
      out.push({ t, line: `${ip} - - [${clfTime}] "${method} ${path} HTTP/1.1" ${status} ${bytes} "${ref}" "${ua}" rt=${rt.toFixed(3)} urt=${(rt * 0.9).toFixed(3)}` });
    } else {
      out.push({ t, line: `${ip} - - [${clfTime}] "${method} ${path} HTTP/1.1" ${status} ${bytes} "${ref}" "${ua}"` });
    }
  }
  // sort by time like a real log
  out.sort((a, b) => a.t - b.t);
  return out.map((x) => x.line).join('\n') + '\n';
}

/** Plain-text digest of an analysis (for copy / share). */
export function summaryText(a: Analysis, tz: 'utc' | 'local' = 'utc'): string {
  const pct = (n: number): string => (a.total > 0 ? ((n / a.total) * 100).toFixed(1) + '%' : '0%');
  const lines: string[] = [];
  lines.push(`Requests: ${a.total.toLocaleString('en-US')}   Unique IPs: ${a.uniqueIps.toLocaleString('en-US')}   Transferred: ${formatBytesShort(a.bytes)}`);
  if (a.withTime > 0) lines.push(`Time range: ${formatTime(a.firstTime, tz)} to ${formatTime(a.lastTime, tz)} (${tz === 'utc' ? 'UTC' : 'local time'})`);
  const c = a.statusClass;
  lines.push(`Status: 2xx ${c.c2} (${pct(c.c2)}), 3xx ${c.c3} (${pct(c.c3)}), 4xx ${c.c4} (${pct(c.c4)}), 5xx ${c.c5} (${pct(c.c5)})`);
  if (a.latency) lines.push(`Request time: p50 ${formatSeconds(a.latency.p50)}, p90 ${formatSeconds(a.latency.p90)}, p95 ${formatSeconds(a.latency.p95)}, p99 ${formatSeconds(a.latency.p99)}, max ${formatSeconds(a.latency.max)}`);
  const section = (title: string, rows: TopEntry[]): void => {
    if (rows.length === 0) return;
    lines.push('', title);
    for (const r of rows.slice(0, 5)) lines.push(`  ${r.count.toLocaleString('en-US').padStart(9)}  ${r.key}`);
  };
  section('Top IPs', a.topIps);
  section('Top paths', a.topPaths);
  section('Top 4xx', a.errorPaths4xx);
  section('Top 5xx', a.errorPaths5xx);
  if (a.security.length > 0) {
    lines.push('', 'Security heuristics');
    for (const f of a.security) lines.push(`  [${f.severity}] ${f.label}: ${f.requests} requests from ${f.uniqueIps} IPs`);
  }
  return lines.join('\n');
}

export function formatBytesShort(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '–';
  if (n < 1024) return `${n} B`;
  const u = ['KB', 'MB', 'GB', 'TB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0)} ${u[i]}`;
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
