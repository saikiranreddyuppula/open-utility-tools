/**
 * Email header / message analysis: header parsing, RFC 2047 decoding, address lists,
 * Received hop timeline, Authentication-Results / SPF / DKIM / ARC parsing, red flags
 * and MIME tree extraction. Pure TypeScript (no DOM), operating on bytes.
 */

// ---------------------------------------------------------------------------
// Byte / string helpers
// ---------------------------------------------------------------------------

export function bytesToBinary(bytes: Uint8Array): string {
  const chunk = 0x4000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunk) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + chunk)));
  }
  return parts.join('');
}

export function binaryToBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

function hasHighBytes(s: string): boolean {
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) > 127) return true;
  return false;
}

/** Decode header bytes (held in a binary string) as UTF-8, falling back to windows-1252. */
export function decodeHeaderBinary(s: string): string {
  if (!hasHighBytes(s)) return s;
  const b = binaryToBytes(s);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(b);
  } catch {
    try {
      return new TextDecoder('windows-1252').decode(b);
    } catch {
      return s;
    }
  }
}

function getDecoder(label: string): TextDecoder | null {
  try {
    return new TextDecoder(label.trim().toLowerCase());
  } catch {
    return null;
  }
}

/** Decode bytes with a charset label; `ok` is false if the label is unknown (UTF-8 / latin1 fallback used). */
export function decodeWithCharset(bytes: Uint8Array, charset: string | undefined): { text: string; ok: boolean; used: string } {
  const label = (charset ?? 'utf-8').replace(/^"|"$/g, '').replace(/\*.*$/, '').trim() || 'utf-8';
  const dec = getDecoder(label);
  if (dec) return { text: dec.decode(bytes), ok: true, used: label.toLowerCase() };
  const u8 = getDecoder('utf-8');
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    text = u8 ? bytesToBinary(bytes) : '';
  }
  return { text, ok: false, used: 'utf-8' };
}

function b64decode(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/_-]/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = clean + '='.repeat((4 - (clean.length % 4)) % 4);
  let bin: string;
  try {
    bin = atob(padded);
  } catch {
    // tolerate stray trailing characters
    const trimmed = clean.slice(0, clean.length - (clean.length % 4));
    bin = atob(trimmed);
  }
  return binaryToBytes(bin);
}

function qpDecodeBinary(s: string, headerMode: boolean): Uint8Array {
  const src = headerMode ? s.replace(/_/g, ' ') : s.replace(/=\r?\n/g, '');
  const out: number[] = [];
  for (let i = 0; i < src.length; i++) {
    const c = src.charCodeAt(i);
    if (c === 0x3d /* = */) {
      const h = src.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(h)) {
        out.push(parseInt(h, 16));
        i += 2;
        continue;
      }
    }
    out.push(c & 0xff);
  }
  return Uint8Array.from(out);
}

// ---------------------------------------------------------------------------
// RFC 2047 encoded words
// ---------------------------------------------------------------------------

const ENCODED_WORD = /=\?([^?\s]+)\?([BbQq])\?([^?\s]*)\?=/g;

interface Seg {
  kind: 'text' | 'word';
  text: string;
  charset?: string;
  bytes?: Uint8Array;
}

export function decodeEncodedWords(input: string): { text: string; issues: string[] } {
  if (!input.includes('=?')) return { text: input, issues: [] };
  const issues: string[] = [];
  const segs: Seg[] = [];
  let last = 0;
  ENCODED_WORD.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ENCODED_WORD.exec(input)) !== null) {
    if (m.index > last) segs.push({ kind: 'text', text: input.slice(last, m.index) });
    const charset = (m[1] ?? '').replace(/\*.*$/, '').toLowerCase();
    const enc = (m[2] ?? '').toUpperCase();
    const data = m[3] ?? '';
    let bytes: Uint8Array;
    try {
      bytes = enc === 'B' ? b64decode(data) : qpDecodeBinary(data, true);
    } catch {
      issues.push(`Could not decode encoded-word ${m[0]}`);
      segs.push({ kind: 'text', text: m[0] });
      last = m.index + m[0].length;
      continue;
    }
    segs.push({ kind: 'word', text: m[0], charset, bytes });
    last = m.index + m[0].length;
  }
  if (last < input.length) segs.push({ kind: 'text', text: input.slice(last) });

  // whitespace between adjacent encoded words is dropped; same-charset neighbours are
  // decoded together so multi-byte sequences split across words still work
  const out: string[] = [];
  let i = 0;
  while (i < segs.length) {
    const s = segs[i];
    if (!s) break;
    if (s.kind === 'text') {
      const prev = segs[i - 1];
      const next = segs[i + 1];
      if (prev?.kind === 'word' && next?.kind === 'word' && /^[ \t\r\n]*$/.test(s.text)) {
        i++;
        continue;
      }
      out.push(s.text);
      i++;
      continue;
    }
    let j = i;
    const group: Uint8Array[] = [];
    while (j < segs.length) {
      const w = segs[j];
      if (!w) break;
      if (w.kind === 'word' && w.charset === s.charset) {
        group.push(w.bytes ?? new Uint8Array());
        j++;
        const gap = segs[j];
        const after = segs[j + 1];
        if (gap?.kind === 'text' && /^[ \t\r\n]*$/.test(gap.text) && after?.kind === 'word' && after.charset === s.charset) {
          j++;
        }
      } else break;
    }
    const total = group.reduce((n, g) => n + g.length, 0);
    const joined = new Uint8Array(total);
    let off = 0;
    for (const g of group) {
      joined.set(g, off);
      off += g.length;
    }
    const dec = decodeWithCharset(joined, s.charset);
    if (!dec.ok) issues.push(`Unsupported charset "${s.charset}" in encoded-word (decoded as ${dec.used})`);
    out.push(dec.text);
    i = j;
  }
  return { text: out.join(''), issues };
}

// ---------------------------------------------------------------------------
// Header block parsing
// ---------------------------------------------------------------------------

export interface ParsedHeader {
  index: number;
  name: string;
  lname: string;
  /** Unfolded value (as written, RFC 2047 words not decoded). */
  value: string;
  /** Value with RFC 2047 encoded words decoded (for display). */
  decoded: string;
  /** The header exactly as in the source, folds included. */
  raw: string;
}

export interface HeaderBlock {
  headers: ParsedHeader[];
  unparsed: string[];
  mboxFrom?: string;
}

export function splitHeadBody(bin: string): { head: string; body: string; hasBody: boolean } {
  const text = bin.replace(/^(?:[ \t]*\r?\n)+/, '');
  const m = /\r?\n[ \t]*\r?\n/.exec(text);
  if (!m) return { head: text, body: '', hasBody: false };
  const head = text.slice(0, m.index);
  const body = text.slice(m.index + m[0].length);
  return { head, body, hasBody: /\S/.test(body) };
}

export function parseHeaderBlock(headBin: string): HeaderBlock {
  const lines = headBin.split(/\r?\n/);
  const logical: { name: string; lines: string[] }[] = [];
  const unparsed: string[] = [];
  let mboxFrom: string | undefined;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li] ?? '';
    if (line.trim() === '') continue;
    const last = logical[logical.length - 1];
    if (/^[ \t]/.test(line) && last) {
      last.lines.push(line);
      continue;
    }
    const m = /^([^\s:][^:\s]*)[ \t]*:/.exec(line);
    if (m) {
      logical.push({ name: decodeHeaderBinary(m[1] ?? ''), lines: [line] });
      continue;
    }
    if (li === 0 && /^From\s+\S+/.test(line)) {
      mboxFrom = line;
      continue;
    }
    unparsed.push(decodeHeaderBinary(line));
  }
  const headers: ParsedHeader[] = logical.map((h, index) => {
    const raw = decodeHeaderBinary(h.lines.join('\n'));
    const value = raw.slice(raw.indexOf(':') + 1).split('\n').join('').trim();
    return { index, name: h.name, lname: h.name.toLowerCase(), value, decoded: decodeEncodedWords(value).text, raw };
  });
  return { headers, unparsed, mboxFrom };
}

export function headerValues(headers: ParsedHeader[], lname: string): ParsedHeader[] {
  return headers.filter((h) => h.lname === lname);
}

export function firstHeader(headers: ParsedHeader[], lname: string): ParsedHeader | undefined {
  return headers.find((h) => h.lname === lname);
}

// ---------------------------------------------------------------------------
// Structured field helpers
// ---------------------------------------------------------------------------

/** Remove RFC 5322 comments (nested parentheses, outside quoted strings); returns the comments too. */
export function stripComments(s: string): { text: string; comments: string[] } {
  let out = '';
  const comments: string[] = [];
  let depth = 0;
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i] ?? '';
    if (c === '\\' && (depth > 0 || inQuote)) {
      if (depth > 0) cur += (s[i + 1] ?? '');
      else out += c + (s[i + 1] ?? '');
      i++;
      continue;
    }
    if (depth === 0 && c === '"') {
      inQuote = !inQuote;
      out += c;
      continue;
    }
    if (!inQuote && c === '(') {
      if (depth === 0) cur = '';
      else cur += c;
      depth++;
      continue;
    }
    if (!inQuote && c === ')' && depth > 0) {
      depth--;
      if (depth === 0) comments.push(cur.trim());
      else cur += c;
      continue;
    }
    if (depth > 0) cur += c;
    else out += c;
  }
  if (depth > 0) comments.push(cur.trim());
  return { text: out, comments };
}

/** Split at top-level separators (outside quotes, comments and optionally angle brackets). */
function splitTop(s: string, sep: string, angles: boolean): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  let paren = 0;
  let angle = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i] ?? '';
    if (c === '\\' && (inQuote || paren > 0)) {
      cur += c + (s[i + 1] ?? '');
      i++;
      continue;
    }
    if (c === '"' && paren === 0) inQuote = !inQuote;
    else if (!inQuote && c === '(') paren++;
    else if (!inQuote && c === ')' && paren > 0) paren--;
    else if (angles && !inQuote && paren === 0 && c === '<') angle++;
    else if (angles && !inQuote && paren === 0 && c === '>' && angle > 0) angle--;
    if (c === sep && !inQuote && paren === 0 && angle === 0) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

export interface Address {
  name: string;
  address: string;
  raw: string;
  group?: string;
}

function unquote(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    return t.slice(1, -1).replace(/\\(.)/g, '$1');
  }
  return t.replace(/\\(.)/g, '$1');
}

function parseMailbox(raw: string, group?: string): Address | null {
  const withoutComments = stripComments(raw);
  const s = withoutComments.text.trim();
  const commentName = withoutComments.comments[0] ?? '';
  if (!s) return null;
  // find "<" outside quotes
  let inQuote = false;
  let lt = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && inQuote) {
      i++;
      continue;
    }
    if (c === '"') inQuote = !inQuote;
    else if (c === '<' && !inQuote) {
      lt = i;
      break;
    }
  }
  let name = '';
  let address = '';
  if (lt >= 0) {
    const gt = s.indexOf('>', lt);
    const inner = s.slice(lt + 1, gt >= 0 ? gt : undefined).trim();
    address = inner.replace(/^@[^:]*:/, '').replace(/\s+/g, '');
    name = (s.slice(0, lt) + (gt >= 0 ? s.slice(gt + 1) : '')).trim();
  } else {
    const m = /^(.*?)(?:^|\s)((?:"[^"]*"|[^\s"<>@,;]+)@[^\s<>,;]+)\s*$/.exec(s);
    if (m && (m[1] ?? '').trim() !== '') {
      name = (m[1] ?? '').trim();
      address = m[2] ?? '';
    } else {
      address = s.replace(/\s+/g, '');
    }
  }
  name = unquote(name);
  if (!name && commentName && lt < 0) name = commentName;
  const decoded = decodeEncodedWords(name).text;
  return { name: decoded, address, raw: raw.trim(), group };
}

export function parseAddressList(value: string): Address[] {
  const out: Address[] = [];
  const items = splitTop(value, ',', true);
  let group: string | undefined;
  for (let item of items) {
    item = item.trim();
    if (item === '') continue;
    // group syntax:  Name: a@x, b@y;
    if (group === undefined) {
      const gm = /^((?:"(?:[^"\\]|\\.)*"|[^<>@":;,])+):(.*)$/s.exec(item);
      if (gm && !gm[1]?.includes('@')) {
        group = decodeEncodedWords(unquote(gm[1] ?? '')).text.trim();
        item = (gm[2] ?? '').trim();
        if (item === '' || item === ';') {
          group = undefined;
          continue;
        }
      }
    }
    let endsGroup = false;
    if (group !== undefined && item.endsWith(';')) {
      endsGroup = true;
      item = item.slice(0, -1).trim();
    }
    if (item !== '') {
      const mb = parseMailbox(item, group);
      if (mb) out.push(mb);
    }
    if (endsGroup) group = undefined;
  }
  return out;
}

export function domainOf(address: string): string {
  const at = address.lastIndexOf('@');
  if (at < 0) return '';
  return address.slice(at + 1).replace(/^\[|\]$/g, '').trim().toLowerCase().replace(/\.$/, '');
}

const SECOND_LEVEL = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'ltd.uk', 'plc.uk', 'net.uk', 'sch.uk',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'co.nz', 'org.nz', 'net.nz', 'govt.nz',
  'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'go.jp', 'co.in', 'net.in', 'org.in', 'gov.in', 'ac.in',
  'com.br', 'net.br', 'org.br', 'gov.br', 'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn',
  'com.mx', 'org.mx', 'gob.mx', 'co.za', 'org.za', 'com.tr', 'com.sg', 'com.hk', 'com.tw', 'com.ar',
  'co.kr', 'or.kr', 'co.il', 'com.my', 'com.ph', 'com.vn', 'com.ua', 'com.pl', 'co.id', 'co.th',
]);

/** Organizational domain approximated from the last two labels (three for common second-level suffixes). */
export function orgDomain(domain: string): string {
  const d = domain.toLowerCase().replace(/\.$/, '');
  const labels = d.split('.').filter(Boolean);
  if (labels.length <= 2) return labels.join('.');
  const last2 = labels.slice(-2).join('.');
  if (SECOND_LEVEL.has(last2)) return labels.slice(-3).join('.');
  return last2;
}

/** Parse "k=v; k2=v2" tag lists (DKIM / ARC style) with whitespace folded out of values. */
export function parseTagList(value: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of value.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).replace(/\s+/g, ' ').trim();
    if (k && !(k in out)) out[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
const ZONES: Record<string, number> = {
  ut: 0, utc: 0, gmt: 0, z: 0, est: -300, edt: -240, cst: -360, cdt: -300, mst: -420, mdt: -360, pst: -480, pdt: -420,
};

export interface ParsedDate {
  ms: number;
  /** Offset in minutes (null when the zone is unknown / -0000). */
  offset: number | null;
  zone: string;
}

export function parseEmailDate(input: string): ParsedDate | null {
  const s = stripComments(input).text.trim();
  const m =
    /(?:[A-Za-z]{3,9},?\s+)?(\d{1,2})[\s-]+([A-Za-z]{3,9})[\s-]+(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([+-]\d{2}:?\d{2}|[A-Za-z]{1,5})?/.exec(
      s
    );
  if (m) {
    const day = Number(m[1]);
    const mon = MONTHS[(m[2] ?? '').slice(0, 3).toLowerCase()];
    let year = Number(m[3]);
    if ((m[3] ?? '').length === 2) year += year < 50 ? 2000 : 1900;
    else if ((m[3] ?? '').length === 3) year += 1900;
    const hh = Number(m[4]);
    const mm = Number(m[5]);
    const ss = m[6] ? Number(m[6]) : 0;
    if (mon === undefined || day < 1 || day > 31 || hh > 23 || mm > 59 || ss > 60) return null;
    const z = m[7] ?? '';
    let offset: number | null = 0;
    let zone = z || '+0000';
    const zm = /^([+-])(\d{2}):?(\d{2})$/.exec(z);
    if (zm) {
      offset = (zm[1] === '-' ? -1 : 1) * (Number(zm[2]) * 60 + Number(zm[3]));
      zone = `${zm[1]}${zm[2]}${zm[3]}`;
      if (zone === '-0000') offset = null;
    } else if (z) {
      const known = ZONES[z.toLowerCase()];
      offset = known === undefined ? null : known;
    }
    const utc = Date.UTC(year, mon, day, hh, mm, ss) - (offset ?? 0) * 60000;
    if (Number.isNaN(utc)) return null;
    return { ms: utc, offset, zone };
  }
  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) return { ms: iso, offset: null, zone: '' };
  return null;
}

// ---------------------------------------------------------------------------
// IP helpers
// ---------------------------------------------------------------------------

const IPV4 = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/;

function looksLikeIPv6(s: string): boolean {
  if (!/^[0-9a-fA-F:.]+$/.test(s)) return false;
  const colons = (s.match(/:/g) ?? []).length;
  if (colons < 2 || colons > 8) return false;
  if (s.includes(':::')) return false;
  if (s.split('::').length > 2) return false;
  return /[0-9a-fA-F]/.test(s);
}

export function extractIp(text: string): string | undefined {
  const bracket = /\[(?:IPv6:)?([0-9a-fA-F:.]+)\]/i.exec(text);
  if (bracket && bracket[1] && (IPV4.test(bracket[1]) || looksLikeIPv6(bracket[1]))) return bracket[1];
  const v6 = /(?:^|[\s(])((?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4})(?=$|[\s)\]])/.exec(text);
  if (v6 && v6[1] && looksLikeIPv6(v6[1])) return v6[1];
  const v4 = IPV4.exec(text);
  return v4 ? v4[0] : undefined;
}

export function isPrivateIp(ip: string): string | null {
  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 10) return 'private (10.0.0.0/8)';
    if (a === 172 && b >= 16 && b <= 31) return 'private (172.16.0.0/12)';
    if (a === 192 && b === 168) return 'private (192.168.0.0/16)';
    if (a === 127) return 'loopback';
    if (a === 169 && b === 254) return 'link-local';
    if (a === 100 && b >= 64 && b <= 127) return 'carrier-grade NAT (100.64.0.0/10)';
    if (a === 0) return 'unspecified';
    return null;
  }
  const l = ip.toLowerCase();
  if (l === '::1') return 'loopback';
  if (/^f[cd][0-9a-f]{2}:/.test(l)) return 'unique-local (fc00::/7)';
  if (/^fe[89ab][0-9a-f]:/.test(l)) return 'link-local (fe80::/10)';
  if (l.startsWith('::ffff:')) {
    const inner = l.slice(7);
    if (/^\d+\.\d+\.\d+\.\d+$/.test(inner)) return isPrivateIp(inner);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Received hops
// ---------------------------------------------------------------------------

export interface Hop {
  /** 0 = oldest hop. */
  order: number;
  /** Position in the header list (0 = topmost = newest). */
  headerIndex: number;
  raw: string;
  parsed: boolean;
  fromHelo?: string;
  fromRdns?: string;
  fromIp?: string;
  byHost?: string;
  byInfo?: string;
  protocol?: string;
  tls: 'yes' | 'no' | 'unknown';
  tlsDetail?: string;
  id?: string;
  forAddr?: string;
  via?: string;
  dateText?: string;
  date?: number;
  zone?: string;
  /** Seconds since the previous hop that has a timestamp. */
  delay?: number;
  /** Seconds since the first timestamped hop. */
  cumulative?: number;
  flags: string[];
}

const TLS_YES = new Set([
  'ESMTPS', 'ESMTPSA', 'SMTPS', 'LMTPS', 'LMTPSA', 'UTF8SMTPS', 'UTF8SMTPSA', 'UTF8LMTPS', 'UTF8LMTPSA', 'HTTPS', 'IMAPS', 'POP3S',
]);
const TLS_NO = new Set(['SMTP', 'ESMTP', 'ESMTPA', 'LMTP', 'LMTPA', 'UTF8SMTP', 'UTF8SMTPA', 'UTF8LMTP', 'NNTP', 'QMQP', 'BSMTP', 'QMTP']);

function splitReceivedSegments(text: string): { pre: string; segs: { key: string; content: string }[] } {
  const segs: { key: string; content: string }[] = [];
  let depth = 0;
  let inAngle = 0;
  const keyRe = /^(from|by|with|id|for|via)(?=[\s(\[<])/i;
  const marks: { key: string; at: number; contentStart: number }[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(') depth++;
    else if (c === ')' && depth > 0) depth--;
    else if (c === '<') inAngle++;
    else if (c === '>' && inAngle > 0) inAngle--;
    if (depth === 0 && inAngle === 0 && (i === 0 || /\s/.test(text[i - 1] ?? ''))) {
      const m = keyRe.exec(text.slice(i, i + 8));
      if (m) marks.push({ key: (m[1] ?? '').toLowerCase(), at: i, contentStart: i + (m[1] ?? '').length });
    }
  }
  const pre = text.slice(0, marks[0]?.at ?? text.length).trim();
  marks.forEach((mk, idx) => {
    const end = marks[idx + 1]?.at ?? text.length;
    segs.push({ key: mk.key, content: text.slice(mk.contentStart, end).trim() });
  });
  return { pre, segs };
}

function parenGroups(s: string): { head: string; groups: string[] } {
  const groups: string[] = [];
  let head = '';
  let depth = 0;
  let cur = '';
  for (const c of s) {
    if (c === '(') {
      if (depth === 0) cur = '';
      else cur += c;
      depth++;
    } else if (c === ')' && depth > 0) {
      depth--;
      if (depth === 0) groups.push(cur.trim());
      else cur += c;
    } else if (depth > 0) cur += c;
    else head += c;
  }
  if (depth > 0) groups.push(cur.trim());
  return { head: head.trim(), groups };
}

function addTlsGroups(hop: Hop, groups: string[]): void {
  const tls = groups.filter((g) => /TLS|SSL|cipher|version=/i.test(g));
  if (tls.length) hop.tlsDetail = [hop.tlsDetail, ...tls].filter(Boolean).join(' · ');
}

export function parseReceived(value: string, headerIndex = 0): Hop {
  const raw = value;
  const text = value.replace(/\s+/g, ' ').trim();
  const hop: Hop = { order: 0, headerIndex, raw, parsed: false, tls: 'unknown', flags: [] };
  const semi = text.lastIndexOf(';');
  const main = semi >= 0 ? text.slice(0, semi) : text;
  if (semi >= 0) {
    hop.dateText = text.slice(semi + 1).trim();
    const d = parseEmailDate(hop.dateText);
    if (d) {
      hop.date = d.ms;
      hop.zone = d.zone;
    }
  }
  const { segs } = splitReceivedSegments(main);
  for (const seg of segs) {
    const { head, groups } = parenGroups(seg.content);
    switch (seg.key) {
      case 'from': {
        const helo = head.split(/\s+/)[0] ?? '';
        hop.fromHelo = helo.replace(/^\[|\]$/g, '') || undefined;
        const heloIp = /^\[(?:IPv6:)?([0-9a-fA-F:.]+)\]$/i.exec(helo);
        if (heloIp) hop.fromIp = heloIp[1];
        for (const g of groups) {
          const ip = extractIp(g);
          if (ip && !hop.fromIp) hop.fromIp = ip;
          else if (ip && hop.fromIp && /\[/.test(g)) hop.fromIp = ip;
          const first = g.replace(/^(?:helo|ehlo)[= ]\s*/i, '').split(/\s+/)[0] ?? '';
          if (
            !/^(?:helo|ehlo)/i.test(g) &&
            /^[A-Za-z0-9][A-Za-z0-9._-]*\.?$/.test(first) &&
            !/^\d+(\.\d+){3}$/.test(first) &&
            !looksLikeIPv6(first) &&
            first.toLowerCase() !== 'unknown' &&
            !hop.fromRdns
          ) {
            hop.fromRdns = first.replace(/\.$/, '');
          }
          const hm = /(?:helo|ehlo)[= ]\s*(\S+)/i.exec(g);
          if (hm && !hop.fromHelo) hop.fromHelo = (hm[1] ?? '').replace(/^\[|\]$/g, '');
        }
        if (!hop.fromIp) {
          const ip = extractIp(head);
          if (ip) hop.fromIp = ip;
        }
        break;
      }
      case 'by': {
        hop.byHost = (head.split(/\s+/)[0] ?? '').replace(/^\[|\]$/g, '') || undefined;
        if (groups.length) hop.byInfo = groups.join(' · ');
        break;
      }
      case 'with': {
        hop.protocol = head || undefined;
        if (groups.length) hop.tlsDetail = groups.join(' · ');
        break;
      }
      case 'id':
        hop.id = head.split(/\s+/)[0] || undefined;
        addTlsGroups(hop, groups);
        break;
      case 'for':
        hop.forAddr = head.replace(/[<>]/g, '').split(/\s+/)[0] || undefined;
        addTlsGroups(hop, groups);
        break;
      case 'via':
        hop.via = head || undefined;
        break;
    }
  }
  hop.parsed = !!(hop.fromHelo || hop.byHost) && hop.dateText !== undefined;
  if (!hop.fromHelo && !hop.byHost) hop.flags.push('unparsed');
  else if (hop.date === undefined) hop.flags.push('no-date');

  // TLS
  const proto = (hop.protocol ?? '').toUpperCase();
  const firstWord = proto.split(/\s+/)[0] ?? '';
  const detail = `${hop.tlsDetail ?? ''} ${proto}`;
  if (TLS_YES.has(firstWord) || /\bTLS|SSL\b|CIPHER=/i.test(detail)) hop.tls = 'yes';
  else if (TLS_NO.has(firstWord)) hop.tls = 'no';
  else hop.tls = 'unknown';
  if (/with local|^local$/i.test(proto) || !hop.fromHelo) hop.tls = 'unknown';

  if (hop.fromIp) {
    const priv = isPrivateIp(hop.fromIp);
    if (priv) hop.flags.push(`private-ip: ${hop.fromIp} is ${priv}`);
  }
  return hop;
}

export interface HopTimeline {
  hops: Hop[];
  totalSeconds: number | null;
  timestamped: number;
  negative: number;
}

export function buildHopTimeline(headers: ParsedHeader[]): HopTimeline {
  const rec = headerValues(headers, 'received');
  const hops = rec.map((h, i) => parseReceived(h.value, i)).reverse();
  hops.forEach((h, i) => {
    h.order = i;
  });
  let prev: Hop | null = null;
  let first: Hop | null = null;
  let negative = 0;
  let timestamped = 0;
  for (const h of hops) {
    if (h.date === undefined) continue;
    timestamped++;
    if (!first) first = h;
    if (prev && prev.date !== undefined) {
      h.delay = Math.round((h.date - prev.date) / 1000);
      if (h.delay < 0) {
        negative++;
        h.flags.push(`clock-skew: timestamp is ${-h.delay}s earlier than the previous hop`);
      } else if (h.delay >= 3600) {
        h.flags.push(`slow: ${Math.round(h.delay / 60)} min delay at this hop`);
      }
    }
    h.cumulative = first.date !== undefined ? Math.round((h.date - first.date) / 1000) : 0;
    prev = h;
  }
  let total: number | null = null;
  if (first && prev && first !== prev && first.date !== undefined && prev.date !== undefined) {
    total = Math.round((prev.date - first.date) / 1000);
  }
  return { hops, totalSeconds: total, timestamped, negative };
}

export function formatDuration(sec: number): string {
  const neg = sec < 0;
  let s = Math.abs(Math.round(sec));
  if (s === 0) return '0s';
  const parts: string[] = [];
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s && parts.length < 2) parts.push(`${s}s`);
  return (neg ? '-' : '') + parts.join(' ');
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

export interface AuthProp {
  key: string;
  value: string;
}

export interface AuthResult {
  method: string;
  version?: string;
  result: string;
  comment?: string;
  reason?: string;
  props: AuthProp[];
}

export interface AuthResultsHeader {
  authserv: string;
  results: AuthResult[];
  raw: string;
  /** ARC-Authentication-Results instance number. */
  instance?: number;
}

export function parseAuthenticationResults(value: string, arc = false): AuthResultsHeader {
  const chunks = splitTop(value, ';', false);
  let head = (chunks.shift() ?? '').trim();
  let instance: number | undefined;
  if (arc) {
    const im = /^i\s*=\s*(\d+)\s*$/.exec(head);
    if (im) {
      instance = Number(im[1]);
      head = (chunks.shift() ?? '').trim();
    }
  }
  // Exchange Online omits the authserv-id: the first chunk is then already a result
  const headText = stripComments(head).text.trim();
  const noAuthserv = /^[A-Za-z0-9_-]+(?:\/\d+)?\s*=/.test(headText);
  if (noAuthserv) chunks.unshift(head);
  const authserv = noAuthserv ? '' : (headText.split(/\s+/)[0] ?? '');
  const results: AuthResult[] = [];
  for (const chunk of chunks) {
    const { text, comments } = stripComments(chunk);
    const t = text.trim();
    if (!t || /^none$/i.test(t)) continue;
    const m = /^([A-Za-z0-9_-]+)(?:\/(\d+))?\s*=\s*([A-Za-z0-9_-]+)(.*)$/s.exec(t);
    if (!m) continue;
    const rest = m[4] ?? '';
    const props: AuthProp[] = [];
    let reason: string | undefined;
    const re = /([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)?)\s*=\s*("(?:[^"\\]|\\.)*"|[^\s;]+)/g;
    let pm: RegExpExecArray | null;
    while ((pm = re.exec(rest)) !== null) {
      const k = pm[1] ?? '';
      let v = pm[2] ?? '';
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).replace(/\\(.)/g, '$1');
      if (k.toLowerCase() === 'reason') reason = v;
      else props.push({ key: k, value: v });
    }
    results.push({
      method: (m[1] ?? '').toLowerCase(),
      version: m[2],
      result: (m[3] ?? '').toLowerCase(),
      comment: comments[0],
      reason,
      props,
    });
  }
  return { authserv, results, raw: value, instance };
}

export interface ReceivedSpf {
  result: string;
  comment?: string;
  props: Record<string, string>;
  raw: string;
}

export function parseReceivedSpf(value: string): ReceivedSpf {
  const { text, comments } = stripComments(value);
  const t = text.trim();
  const m = /^(\w+)(.*)$/s.exec(t);
  const result = (m?.[1] ?? '').toLowerCase();
  const props: Record<string, string> = {};
  const re = /([A-Za-z0-9_-]+)\s*=\s*("(?:[^"\\]|\\.)*"|[^;]+)/g;
  let pm: RegExpExecArray | null;
  while ((pm = re.exec(m?.[2] ?? '')) !== null) {
    let v = (pm[2] ?? '').trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    props[(pm[1] ?? '').toLowerCase()] = v;
  }
  return { result, comment: comments[0], props, raw: value };
}

export interface DkimSignature {
  raw: string;
  tags: Record<string, string>;
  version: string;
  algorithm: string;
  canonHeader: string;
  canonBody: string;
  domain: string;
  selector: string;
  identity?: string;
  headersSigned: string[];
  timestamp?: number;
  expiration?: number;
  expired?: boolean;
  bodyLength?: number;
  bodyHash: string;
  signature: string;
  signsFrom: boolean;
  dnsName: string;
  issues: string[];
}

export function parseDkimSignature(value: string, now: number): DkimSignature {
  const tags = parseTagList(value);
  const issues: string[] = [];
  for (const req of ['v', 'a', 'b', 'bh', 'd', 'h', 's']) {
    if (!(req in tags)) issues.push(`Missing required tag "${req}="`);
  }
  const c = (tags.c ?? 'simple/simple').toLowerCase();
  const [ch, cb] = c.includes('/') ? c.split('/') : [c, 'simple'];
  const headersSigned = (tags.h ?? '')
    .split(':')
    .map((x) => x.trim())
    .filter(Boolean);
  const timestamp = tags.t && /^\d+$/.test(tags.t) ? Number(tags.t) : undefined;
  const expiration = tags.x && /^\d+$/.test(tags.x) ? Number(tags.x) : undefined;
  const expired = expiration !== undefined ? expiration * 1000 < now : undefined;
  const algorithm = (tags.a ?? '').toLowerCase();
  if (tags.v !== undefined && tags.v !== '1') issues.push(`Unsupported version v=${tags.v}`);
  if (algorithm === 'rsa-sha1') issues.push('rsa-sha1 is deprecated (RFC 8301): receivers may reject it');
  if (algorithm && !/^(rsa|ed25519)-sha(1|256)$/.test(algorithm)) issues.push(`Unknown algorithm "${algorithm}"`);
  if (tags.l !== undefined) issues.push('l= body length limit is set: content may be appended without invalidating the signature');
  const signsFrom = headersSigned.some((x) => x.toLowerCase() === 'from');
  if (tags.h !== undefined && !signsFrom) issues.push('From is not in h=: DKIM requires the From header to be signed');
  if (expired) issues.push('Signature has expired (x= is in the past)');
  if (timestamp !== undefined && expiration !== undefined && expiration < timestamp) issues.push('x= is earlier than t=');
  const domain = (tags.d ?? '').toLowerCase();
  const selector = tags.s ?? '';
  return {
    raw: value,
    tags,
    version: tags.v ?? '',
    algorithm,
    canonHeader: ch ?? 'simple',
    canonBody: cb ?? 'simple',
    domain,
    selector,
    identity: tags.i,
    headersSigned,
    timestamp,
    expiration,
    expired,
    bodyLength: tags.l && /^\d+$/.test(tags.l) ? Number(tags.l) : undefined,
    bodyHash: (tags.bh ?? '').replace(/\s+/g, ''),
    signature: (tags.b ?? '').replace(/\s+/g, ''),
    signsFrom,
    dnsName: selector && domain ? `${selector}._domainkey.${domain}` : '',
    issues,
  };
}

export interface ArcInstance {
  i: number;
  seal?: Record<string, string>;
  message?: Record<string, string>;
  results?: AuthResultsHeader;
  cv?: string;
  domain?: string;
  selector?: string;
  issues: string[];
}

export interface ArcAnalysis {
  instances: ArcInstance[];
  chainResult?: string;
  issues: string[];
}

export function analyzeArc(headers: ParsedHeader[]): ArcAnalysis {
  const map = new Map<number, ArcInstance>();
  const get = (i: number): ArcInstance => {
    let x = map.get(i);
    if (!x) {
      x = { i, issues: [] };
      map.set(i, x);
    }
    return x;
  };
  for (const h of headers) {
    if (h.lname === 'arc-seal') {
      const t = parseTagList(h.value);
      const i = Number(t.i);
      if (Number.isFinite(i)) {
        const inst = get(i);
        inst.seal = t;
        inst.cv = (t.cv ?? '').toLowerCase();
        inst.domain = t.d;
        inst.selector = t.s;
      }
    } else if (h.lname === 'arc-message-signature') {
      const t = parseTagList(h.value);
      const i = Number(t.i);
      if (Number.isFinite(i)) get(i).message = t;
    } else if (h.lname === 'arc-authentication-results') {
      const r = parseAuthenticationResults(h.value, true);
      if (r.instance !== undefined) get(r.instance).results = r;
    }
  }
  const instances = Array.from(map.values()).sort((a, b) => a.i - b.i);
  const issues: string[] = [];
  instances.forEach((x, idx) => {
    if (!x.seal) x.issues.push('missing ARC-Seal');
    if (!x.message) x.issues.push('missing ARC-Message-Signature');
    if (!x.results) x.issues.push('missing ARC-Authentication-Results');
    if (x.i !== idx + 1) issues.push(`ARC instance numbers are not contiguous (found i=${x.i} at position ${idx + 1})`);
    if (x.i === 1 && x.cv && x.cv !== 'none') x.issues.push(`first instance should have cv=none (has cv=${x.cv})`);
    if (x.i > 1 && x.cv === 'none') x.issues.push('cv=none on an instance other than the first');
  });
  const last = instances[instances.length - 1];
  return { instances, chainResult: last?.cv, issues };
}

// ---------------------------------------------------------------------------
// Spam headers
// ---------------------------------------------------------------------------

export interface SpamInfo {
  header: string;
  value: string;
  verdict: 'ok' | 'warn' | 'bad' | 'info';
  summary: string;
}

export function summarizeSpamHeaders(headers: ParsedHeader[]): SpamInfo[] {
  const out: SpamInfo[] = [];
  const push = (h: ParsedHeader, verdict: SpamInfo['verdict'], summary: string) =>
    out.push({ header: h.name, value: h.decoded.length > 300 ? h.decoded.slice(0, 300) + '…' : h.decoded, verdict, summary });
  for (const h of headers) {
    const v = h.value;
    switch (h.lname) {
      case 'x-spam-status': {
        const yes = /^\s*yes/i.test(v);
        const score = /score=(-?[\d.]+)/i.exec(v)?.[1];
        const req = /required=(-?[\d.]+)/i.exec(v)?.[1];
        const tests = /tests=(.*?)(?:\s+[a-z_]+=|$)/i.exec(v)?.[1];
        const n = tests ? tests.split(/[,\s]+/).filter((x) => /^[A-Za-z0-9_]+$/.test(x)).length : 0;
        push(h, yes ? 'bad' : 'ok', `${yes ? 'Marked as spam' : 'Not spam'}${score ? `, score ${score}` : ''}${req ? ` (threshold ${req})` : ''}${n ? `, ${n} rules hit` : ''}`);
        break;
      }
      case 'x-spam-flag':
        push(h, /yes/i.test(v) ? 'bad' : 'ok', /yes/i.test(v) ? 'Spam flag is set' : 'Spam flag is not set');
        break;
      case 'x-spam-score':
      case 'x-barracuda-spam-score':
      case 'x-rspamd-score': {
        const n = Number(v.trim().split(/\s+/)[0]);
        push(h, Number.isFinite(n) ? (n >= 5 ? 'bad' : n >= 2 ? 'warn' : 'ok') : 'info', Number.isFinite(n) ? `Score ${n}` : v);
        break;
      }
      case 'x-spam-level': {
        const stars = (v.match(/\*/g) ?? []).length;
        push(h, stars >= 5 ? 'bad' : stars >= 2 ? 'warn' : 'ok', `${stars} star${stars === 1 ? '' : 's'}`);
        break;
      }
      case 'x-rspamd-action':
        push(h, /reject|add header|rewrite|soft reject/i.test(v) ? 'bad' : 'ok', `Action: ${v}`);
        break;
      case 'x-barracuda-spam-status':
        push(h, /^\s*yes/i.test(v) ? 'bad' : 'ok', v);
        break;
      case 'x-ms-exchange-organization-scl': {
        const n = Number(v.trim());
        if (Number.isFinite(n)) {
          const meaning =
            n === -1 ? 'safe (skipped filtering, e.g. trusted sender)' : n <= 1 ? 'not spam' : n <= 4 ? 'borderline' : n <= 6 ? 'spam' : 'high-confidence spam';
          push(h, n === -1 || n <= 1 ? 'ok' : n <= 4 ? 'warn' : 'bad', `SCL ${n}: ${meaning}`);
        } else push(h, 'info', v);
        break;
      }
      case 'x-microsoft-antispam': {
        const bcl = /BCL:(\d+)/i.exec(v)?.[1];
        push(h, bcl && Number(bcl) >= 4 ? 'warn' : 'info', bcl ? `Bulk complaint level (BCL) ${bcl}` : 'Microsoft anti-spam info');
        break;
      }
      case 'x-forefront-antispam-report': {
        const scl = /SCL:(-?\d+)/i.exec(v)?.[1];
        const sfv = /SFV:([A-Z]+)/i.exec(v)?.[1];
        const cat = /CAT:([A-Z,]+)/i.exec(v)?.[1];
        const bad = (cat && /SPM|PHSH|MALW|HPHSH|HSPM/.test(cat)) || (sfv && /^(SPM|SKS|SKB|SKN?)$/i.test(sfv) && sfv !== 'SKN');
        push(
          h,
          bad ? 'bad' : sfv === 'BULK' ? 'warn' : 'info',
          [scl !== undefined ? `SCL ${scl}` : '', sfv ? `filter verdict ${sfv}${sfv === 'NSPM' ? ' (not spam)' : ''}` : '', cat ? `category ${cat}` : ''].filter(Boolean).join(', ') || 'Forefront report'
        );
        break;
      }
      case 'x-ms-exchange-organization-authas':
        push(h, /anonymous/i.test(v) ? 'info' : 'ok', `Authenticated as: ${v}`);
        break;
      case 'x-spam-checker-version':
      case 'x-spam-report':
        push(h, 'info', h.lname === 'x-spam-report' ? 'Detailed spam report present' : v);
        break;
      default:
        break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// MIME
// ---------------------------------------------------------------------------

export interface MimePart {
  path: string;
  headers: ParsedHeader[];
  contentType: string;
  params: Record<string, string>;
  charset?: string;
  cte: string;
  disposition?: string;
  filename?: string;
  contentId?: string;
  /** Decoded size in bytes (for multipart / message parts: size of the body). */
  size: number;
  children: MimePart[];
  isAttachment: boolean;
  preview?: string;
  previewTruncated?: boolean;
  /** Decoded bytes, only kept for attachments. */
  bytes?: Uint8Array;
  notes: string[];
}

export interface AttachmentInfo {
  path: string;
  filename: string;
  contentType: string;
  size: number;
  disposition: string;
  contentId?: string;
  bytes: Uint8Array;
}

export interface BodyPreview {
  path: string;
  contentType: string;
  charset: string;
  text: string;
  truncated: boolean;
}

const PREVIEW_LIMIT = 200_000;
const MAX_PARTS = 3000;
const MAX_DEPTH = 24;

export function parseStructured(value: string): { value: string; params: Record<string, string> } {
  const pieces = splitTop(stripComments(value).text, ';', false);
  const main = (pieces.shift() ?? '').trim();
  const raw: Record<string, string> = {};
  for (const p of pieces) {
    const eq = p.indexOf('=');
    if (eq < 0) continue;
    const k = p.slice(0, eq).trim().toLowerCase();
    let v = p.slice(eq + 1).trim();
    if (v.startsWith('"')) {
      const end = v.lastIndexOf('"');
      v = end > 0 ? v.slice(1, end).replace(/\\(.)/g, '$1') : v.slice(1);
    }
    if (k && !(k in raw)) raw[k] = v;
  }
  return { value: main, params: resolveRfc2231(raw) };
}

function percentDecodeBytes(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0x25 && /^[0-9A-Fa-f]{2}$/.test(s.slice(i + 1, i + 3))) {
      out.push(parseInt(s.slice(i + 1, i + 3), 16));
      i += 2;
    } else if (c < 0x80) out.push(c);
    else out.push(...Array.from(new TextEncoder().encode(s[i] ?? '')));
  }
  return Uint8Array.from(out);
}

function resolveRfc2231(raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  const groups = new Map<string, { n: number; star: boolean; v: string }[]>();
  for (const [k, v] of Object.entries(raw)) {
    const m = /^(.+?)\*(\d+)(\*)?$/.exec(k);
    if (m) {
      const base = m[1] ?? '';
      const arr = groups.get(base) ?? [];
      arr.push({ n: Number(m[2]), star: m[3] === '*', v });
      groups.set(base, arr);
      continue;
    }
    const sm = /^(.+?)\*$/.exec(k);
    if (sm) {
      const base = sm[1] ?? '';
      const e = /^([^']*)'[^']*'(.*)$/s.exec(v);
      if (e) {
        out[base] = decodeWithCharset(percentDecodeBytes(e[2] ?? ''), e[1] || 'utf-8').text;
      } else out[base] = v;
      continue;
    }
    out[k] = decodeEncodedWords(v).text;
  }
  for (const [base, parts] of groups) {
    parts.sort((a, b) => a.n - b.n);
    let charset = 'utf-8';
    let joinedBytes: number[] = [];
    let plain = '';
    let anyStar = false;
    parts.forEach((p, idx) => {
      let v = p.v;
      if (p.star) {
        anyStar = true;
        if (idx === 0) {
          const e = /^([^']*)'[^']*'(.*)$/s.exec(v);
          if (e) {
            charset = e[1] || 'utf-8';
            v = e[2] ?? '';
          }
        }
        joinedBytes = joinedBytes.concat(Array.from(percentDecodeBytes(v)));
      } else {
        joinedBytes = joinedBytes.concat(Array.from(new TextEncoder().encode(v)));
        plain += v;
      }
    });
    out[base] = anyStar ? decodeWithCharset(Uint8Array.from(joinedBytes), charset).text : plain;
  }
  return out;
}

function decodeBody(bodyBin: string, cte: string): Uint8Array {
  const e = cte.trim().toLowerCase();
  if (e === 'base64') return b64decode(bodyBin);
  if (e === 'quoted-printable') return qpDecodeBinary(bodyBin, false);
  return binaryToBytes(bodyBin);
}

interface MimeCtx {
  count: number;
  preferUtf8: boolean;
  textParts: BodyPreview[];
  attachments: AttachmentInfo[];
}

function parsePart(bin: string, path: string, ctx: MimeCtx, depth: number, defaultType = 'text/plain'): MimePart {
  ctx.count++;
  const { head, body } = splitHeadBody(bin);
  const block = parseHeaderBlock(head);
  const ct = firstHeader(block.headers, 'content-type');
  const parsedCt = ct ? parseStructured(ct.value) : { value: defaultType, params: {} as Record<string, string> };
  const contentType = (parsedCt.value || defaultType).toLowerCase();
  const cte = (firstHeader(block.headers, 'content-transfer-encoding')?.value ?? '7bit').split(/[\s;(]/)[0]?.toLowerCase() || '7bit';
  const cd = firstHeader(block.headers, 'content-disposition');
  const parsedCd = cd ? parseStructured(cd.value) : null;
  const disposition = parsedCd ? parsedCd.value.toLowerCase() : undefined;
  const filename = parsedCd?.params.filename ?? parsedCt.params.name;
  const contentId = firstHeader(block.headers, 'content-id')?.value.replace(/^<|>$/g, '');
  const part: MimePart = {
    path,
    headers: block.headers,
    contentType,
    params: parsedCt.params,
    charset: parsedCt.params.charset,
    cte,
    disposition,
    filename,
    contentId,
    size: 0,
    children: [],
    isAttachment: false,
    notes: [],
  };

  if (contentType.startsWith('multipart/')) {
    const boundary = parsedCt.params.boundary;
    part.size = body.length;
    if (!boundary) {
      part.notes.push('multipart without a boundary parameter');
      return part;
    }
    if (depth >= MAX_DEPTH) {
      part.notes.push('maximum nesting depth reached');
      return part;
    }
    const pieces = splitMultipart(body, boundary);
    if (pieces.length === 0) part.notes.push(`boundary "${boundary}" not found in the body`);
    pieces.forEach((p, i) => {
      if (ctx.count >= MAX_PARTS) {
        if (!part.notes.includes('part limit reached')) part.notes.push('part limit reached');
        return;
      }
      part.children.push(parsePart(p, path === '' ? String(i + 1) : `${path}.${i + 1}`, ctx, depth + 1, contentType === 'multipart/digest' ? 'message/rfc822' : 'text/plain'));
    });
    return part;
  }

  const bytes = decodeBody(body, cte);
  part.size = bytes.length;

  if (contentType === 'message/rfc822' || contentType === 'message/global') {
    if (depth < MAX_DEPTH) {
      const inner = bytesToBinary(bytes);
      part.children.push(parsePart(inner, path === '' ? '1' : `${path}.1`, ctx, depth + 1));
    }
    const hasName = !!filename;
    part.isAttachment = disposition === 'attachment' || hasName;
    if (part.isAttachment) {
      part.bytes = bytes;
      ctx.attachments.push({ path, filename: filename ?? 'message.eml', contentType, size: bytes.length, disposition: disposition ?? 'attachment', contentId, bytes });
    }
    return part;
  }

  const isText = contentType.startsWith('text/');
  const attachmentLike = disposition === 'attachment' || (!!filename && disposition !== 'inline') || (!isText && !contentType.startsWith('multipart/'));
  const inlineNamed = disposition === 'inline' && !!filename && !isText;
  if (attachmentLike || inlineNamed || (!isText && !!contentId)) {
    part.isAttachment = true;
    part.bytes = bytes;
    ctx.attachments.push({
      path,
      filename: filename ?? `part-${path || '1'}${extForType(contentType)}`,
      contentType,
      size: bytes.length,
      disposition: disposition ?? (contentId ? 'inline' : 'attachment'),
      contentId,
      bytes,
    });
    if (isText && contentType !== 'text/calendar') {
      // still give a preview for named text attachments
    } else return part;
  }

  if (isText) {
    const useUtf8 = ctx.preferUtf8 && cte !== 'base64' && cte !== 'quoted-printable';
    const dec = decodeWithCharset(bytes.length > PREVIEW_LIMIT * 4 ? bytes.subarray(0, PREVIEW_LIMIT * 4) : bytes, useUtf8 ? 'utf-8' : part.charset ?? 'us-ascii');
    if (!dec.ok) part.notes.push(`unsupported charset "${part.charset}" (shown as ${dec.used})`);
    // legacy mail often mislabels charsets: fall back to windows-1252 if UTF-8 was declared but invalid
    let text = dec.text;
    if (!useUtf8 && dec.ok && /^utf-?8$/i.test(dec.used) && text.includes('�')) {
      part.notes.push('declared UTF-8 but contains invalid sequences');
    }
    const truncated = text.length > PREVIEW_LIMIT;
    if (truncated) text = text.slice(0, PREVIEW_LIMIT);
    part.preview = text;
    part.previewTruncated = truncated;
    if (!part.isAttachment) {
      ctx.textParts.push({ path, contentType, charset: dec.used, text, truncated });
    }
  }
  return part;
}

function extForType(ct: string): string {
  const map: Record<string, string> = {
    'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'application/pdf': '.pdf', 'text/calendar': '.ics',
    'application/zip': '.zip', 'application/json': '.json', 'application/octet-stream': '.bin', 'image/webp': '.webp',
  };
  return map[ct] ?? '';
}

function splitMultipart(body: string, boundary: string): string[] {
  const delim = '--' + boundary;
  const closeDelim = delim + '--';
  const pieces: string[] = [];
  let pos = 0;
  let partStart = -1;
  while (pos <= body.length) {
    const eol = body.indexOf('\n', pos);
    if (body.startsWith(delim, pos)) {
      const lineEnd = eol < 0 ? body.length : eol;
      const trimmed = body.slice(pos, lineEnd).replace(/[ \t\r]+$/, '');
      const isClose = trimmed === closeDelim;
      if (trimmed === delim || isClose) {
        if (partStart >= 0) {
          let end = pos;
          if (body[end - 1] === '\n') end--;
          if (body[end - 1] === '\r') end--;
          pieces.push(body.slice(partStart, Math.max(partStart, end)));
        }
        if (isClose) {
          partStart = -1;
          break;
        }
        partStart = eol < 0 ? body.length : eol + 1;
      }
    }
    if (eol < 0) break;
    pos = eol + 1;
  }
  if (partStart >= 0) pieces.push(body.slice(partStart));
  return pieces;
}

// ---------------------------------------------------------------------------
// Whole-message analysis
// ---------------------------------------------------------------------------

export interface SummaryField {
  label: string;
  value: string;
  addresses?: Address[];
}

export interface RedFlag {
  id: string;
  severity: 'high' | 'medium' | 'low' | 'info';
  title: string;
  detail: string;
}

export interface AlignmentRow {
  mechanism: 'DKIM' | 'SPF';
  domain: string;
  source: string;
  result?: string;
  strict: boolean;
  relaxed: boolean;
}

export interface AuthAnalysis {
  authResults: AuthResultsHeader[];
  receivedSpf: ReceivedSpf[];
  dkim: DkimSignature[];
  arc: ArcAnalysis;
  /** Best result per method (from the topmost Authentication-Results header). */
  summary: { method: string; result: string; detail: string }[];
  fromDomain: string;
  alignment: AlignmentRow[];
  dmarcEstimate: { outcome: 'pass' | 'fail' | 'unknown'; reason: string };
}

export interface EmailAnalysis {
  headers: ParsedHeader[];
  unparsed: string[];
  mboxFrom?: string;
  hasBody: boolean;
  summary: SummaryField[];
  from: Address[];
  hops: HopTimeline;
  auth: AuthAnalysis;
  spam: SpamInfo[];
  flags: RedFlag[];
  mime: MimePart | null;
  attachments: AttachmentInfo[];
  textParts: BodyPreview[];
  issues: string[];
  inputBytes: number;
}

const BRANDS = [
  'paypal', 'amazon', 'apple', 'microsoft', 'google', 'netflix', 'facebook', 'instagram', 'linkedin', 'dropbox', 'docusign', 'dhl', 'fedex', 'ups',
  'chase', 'wells fargo', 'bank of america', 'citibank', 'usps', 'coinbase', 'binance', 'adobe', 'office 365', 'outlook', 'icloud', 'whatsapp', 'twitter',
];
const COMMON_TLDS =
  'com|net|org|edu|gov|io|co|dev|app|info|biz|me|us|uk|de|fr|ru|cn|jp|in|au|ca|nl|br|es|it|ch|se|no|xyz|online|site|shop|store|tech|cloud|ai';

function displayNameIssues(a: Address): string[] {
  const out: string[] = [];
  const name = a.name;
  if (!name) return out;
  const dom = domainOf(a.address);
  const em = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.exec(name);
  if (em && em[0].toLowerCase() !== a.address.toLowerCase()) {
    out.push(`The display name contains the address "${em[0]}", but the message is actually from <${a.address}>.`);
  }
  const dm = new RegExp(`\\b((?:[a-z0-9-]+\\.)+(?:${COMMON_TLDS}))\\b`, 'i').exec(name.replace(em?.[0] ?? '', ''));
  if (dm && dom && orgDomain(dm[1] ?? '') !== orgDomain(dom)) {
    out.push(`The display name mentions "${dm[1]}", which is unrelated to the sender domain ${dom}.`);
  }
  if (out.length === 0 && dom) {
    const lower = name.toLowerCase();
    for (const b of BRANDS) {
      if (lower.includes(b) && !dom.replace(/[^a-z0-9]/g, '').includes(b.replace(/[^a-z0-9]/g, ''))) {
        out.push(`The display name mentions "${b}" but the sender domain is ${dom}.`);
        break;
      }
    }
  }
  return out;
}

function alignmentFor(fromDomain: string, domain: string): { strict: boolean; relaxed: boolean } {
  const f = fromDomain.toLowerCase();
  const d = domain.toLowerCase();
  if (!f || !d) return { strict: false, relaxed: false };
  return { strict: f === d, relaxed: orgDomain(f) === orgDomain(d) };
}

function authSummaryMethods(list: AuthResultsHeader[]): { method: string; result: string; detail: string }[] {
  const out: { method: string; result: string; detail: string }[] = [];
  const top = list[0];
  if (!top) return out;
  for (const r of top.results) {
    const detail = r.props.map((p) => `${p.key}=${p.value}`).join(' ');
    out.push({ method: r.method, result: r.result, detail: [detail, r.comment ? `(${r.comment})` : ''].filter(Boolean).join(' ') });
  }
  return out;
}

export interface AnalyzeOptions {
  now?: number;
}

export function analyzeEmail(input: string | Uint8Array, opts: AnalyzeOptions = {}): EmailAnalysis {
  const now = opts.now ?? Date.now();
  const fromText = typeof input === 'string';
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const bin = bytesToBinary(bytes);
  const { head, hasBody } = splitHeadBody(bin);
  const block = parseHeaderBlock(head);
  const headers = block.headers;
  const issues: string[] = [];
  if (headers.length === 0) issues.push('No headers were found. Paste the raw headers ("Show original" / "View message source") or a full .eml.');
  if (block.unparsed.length > 0) issues.push(`${block.unparsed.length} line${block.unparsed.length === 1 ? '' : 's'} before/among the headers could not be parsed as headers.`);

  const get = (n: string) => firstHeader(headers, n);
  const addrs = (n: string) => headerValues(headers, n).flatMap((h) => parseAddressList(h.value));
  const from = addrs('from');
  const to = addrs('to');
  const cc = addrs('cc');
  const replyTo = addrs('reply-to');
  const returnPathRaw = get('return-path')?.value ?? '';
  const returnPath = parseAddressList(returnPathRaw)[0];

  const dateH = get('date');
  const parsedDate = dateH ? parseEmailDate(dateH.value) : null;
  const fmtAddr = (a: Address[]) => a.map((x) => (x.name ? `${x.name} <${x.address}>` : x.address)).join(', ');
  const summary: SummaryField[] = [];
  const addField = (label: string, value: string | undefined, addresses?: Address[]) => {
    if (value !== undefined && value !== '') summary.push({ label, value, addresses });
  };
  addField('From', fmtAddr(from), from);
  addField('To', fmtAddr(to), to);
  addField('Cc', fmtAddr(cc), cc);
  addField('Reply-To', fmtAddr(replyTo), replyTo);
  addField('Subject', get('subject')?.decoded);
  addField(
    'Date',
    dateH ? (parsedDate ? `${dateH.value}  →  ${new Date(parsedDate.ms).toISOString().replace('.000Z', 'Z')}` : dateH.value) : undefined
  );
  addField('Message-ID', get('message-id')?.value);
  addField('Return-Path', returnPathRaw);
  addField('Delivered-To', get('delivered-to')?.value);
  addField('X-Mailer / User-Agent', get('x-mailer')?.decoded ?? get('user-agent')?.decoded ?? get('x-mimeole')?.decoded);

  const hops = buildHopTimeline(headers);

  // --- authentication ---
  const authResults = headerValues(headers, 'authentication-results').map((h) => parseAuthenticationResults(h.value));
  const receivedSpf = headerValues(headers, 'received-spf').map((h) => parseReceivedSpf(h.value));
  const dkim = headerValues(headers, 'dkim-signature').map((h) => parseDkimSignature(h.value, now));
  const arc = analyzeArc(headers);
  const fromDomain = from[0] ? domainOf(from[0].address) : '';
  const alignment: AlignmentRow[] = [];
  const seenAlign = new Set<string>();
  const pushAlign = (mechanism: 'DKIM' | 'SPF', domain: string, source: string, result?: string) => {
    if (!domain || domain === 'none' || !domain.includes('.')) return;
    const key = `${mechanism}|${domain}|${source}`;
    if (seenAlign.has(key)) return;
    seenAlign.add(key);
    alignment.push({ mechanism, domain, source, result, ...alignmentFor(fromDomain, domain) });
  };
  const topAr = authResults[0];
  const arResult = (method: string) => topAr?.results.filter((r) => r.method === method) ?? [];
  for (const s of dkim) {
    const match = arResult('dkim').find((r) => r.props.some((p) => (p.key === 'header.d' && p.value.toLowerCase() === s.domain) || (p.key === 'header.i' && p.value.toLowerCase().endsWith(s.domain))));
    pushAlign('DKIM', s.domain, `DKIM-Signature d=${s.domain}${s.selector ? ` s=${s.selector}` : ''}`, match?.result);
  }
  for (const r of arResult('dkim')) {
    const d = r.props.find((p) => p.key === 'header.d')?.value ?? domainOf((r.props.find((p) => p.key === 'header.i')?.value ?? '').replace(/^@/, 'x@'));
    pushAlign('DKIM', (d ?? '').toLowerCase(), 'Authentication-Results header.d', r.result);
  }
  for (const r of arResult('spf')) {
    const mf = r.props.find((p) => p.key === 'smtp.mailfrom')?.value;
    const helo = r.props.find((p) => p.key === 'smtp.helo')?.value;
    if (mf) pushAlign('SPF', mf.includes('@') ? domainOf(mf) : mf.toLowerCase(), 'Authentication-Results smtp.mailfrom', r.result);
    else if (helo) pushAlign('SPF', helo.toLowerCase(), 'Authentication-Results smtp.helo', r.result);
  }
  for (const s of receivedSpf) {
    const ef = s.props['envelope-from'];
    if (ef) pushAlign('SPF', ef.includes('@') ? domainOf(ef) : ef.toLowerCase(), 'Received-SPF envelope-from', s.result);
  }
  if (returnPath && returnPath.address && !alignment.some((x) => x.mechanism === 'SPF')) {
    pushAlign('SPF', domainOf(returnPath.address), 'Return-Path', arResult('spf')[0]?.result);
  }

  // estimate DMARC from receiving server's SPF/DKIM results
  let dmarcEstimate: AuthAnalysis['dmarcEstimate'] = { outcome: 'unknown', reason: 'Not enough information (no SPF/DKIM results from the receiving server).' };
  const dkimPassAligned = alignment.find((a) => a.mechanism === 'DKIM' && a.result === 'pass' && a.relaxed);
  const spfPassAligned = alignment.find((a) => a.mechanism === 'SPF' && a.result === 'pass' && a.relaxed);
  const anyResult = alignment.some((a) => a.result);
  if (dkimPassAligned || spfPassAligned) {
    const via = dkimPassAligned ? `DKIM (d=${dkimPassAligned.domain})` : `SPF (${spfPassAligned?.domain})`;
    dmarcEstimate = { outcome: 'pass', reason: `${via} passed and is aligned with the From domain ${fromDomain} (relaxed).` };
  } else if (anyResult) {
    dmarcEstimate = { outcome: 'fail', reason: `No passing DKIM or SPF result is aligned with the From domain ${fromDomain || '(none)'}.` };
  }

  const auth: AuthAnalysis = {
    authResults,
    receivedSpf,
    dkim,
    arc,
    summary: authSummaryMethods(authResults),
    fromDomain,
    alignment,
    dmarcEstimate,
  };

  const spam = summarizeSpamHeaders(headers);

  // --- red flags ---
  const flags: RedFlag[] = [];
  const flag = (id: string, severity: RedFlag['severity'], title: string, detail: string) => flags.push({ id, severity, title, detail });
  if (headers.length > 0) {
    if (from.length === 0) flag('missing-from', 'high', 'Missing From header', 'Every legitimate message has a From header.');
    if (headerValues(headers, 'from').length > 1) flag('multiple-from', 'high', 'Multiple From headers', 'Duplicate From headers are a known spoofing trick: clients and filters may read different ones.');
    if (!get('message-id')) flag('missing-message-id', 'medium', 'Missing Message-ID', 'Mail servers normally add a Message-ID. Its absence is typical of hand-crafted or bulk spam messages.');
    if (!dateH) flag('missing-date', 'medium', 'Missing Date header', 'A Date header is required by RFC 5322.');
    else if (!parsedDate) flag('bad-date', 'low', 'Unparseable Date header', `"${dateH.value}" is not a valid RFC 5322 date.`);
    if (from.length > 1) flag('multi-from-addr', 'low', 'Several addresses in From', 'The From header lists more than one mailbox.');
    for (const a of from) {
      for (const msg of displayNameIssues(a)) flag('display-name-spoof', 'high', 'Possible display-name spoofing', msg);
      if (domainOf(a.address).includes('xn--')) {
        flag('idn-domain', 'low', 'Internationalised (punycode) sender domain', `${domainOf(a.address)} uses punycode; check that it is not a look-alike of a trusted domain.`);
      }
    }
    if (from[0] && replyTo[0]) {
      const fd = domainOf(from[0].address);
      const rd = domainOf(replyTo[0].address);
      if (fd && rd && orgDomain(fd) !== orgDomain(rd)) {
        flag('reply-to-mismatch', 'medium', 'Reply-To domain differs from From', `Replies would go to ${rd} instead of ${fd}. This is common in phishing and BEC, but also used by mailing services.`);
      }
    }
    if (from[0] && returnPath && returnPath.address) {
      const fd = domainOf(from[0].address);
      const rd = domainOf(returnPath.address);
      if (fd && rd && orgDomain(fd) !== orgDomain(rd)) {
        flag('return-path-mismatch', 'low', 'Return-Path domain differs from From', `Bounces go to ${rd} while the visible sender is ${fd}. Normal for email service providers, suspicious otherwise (SPF would not align).`);
      }
    }
    if (from[0] && get('sender')) {
      const s = parseAddressList(get('sender')?.value ?? '')[0];
      if (s && domainOf(s.address) !== domainOf(from[0].address) && orgDomain(domainOf(s.address)) !== orgDomain(domainOf(from[0].address))) {
        flag('sender-mismatch', 'low', 'Sender header differs from From', `Sender is ${s.address} while From is ${from[0].address}.`);
      }
    }
    if (returnPathRaw.trim() === '<>') flag('null-return-path', 'info', 'Empty Return-Path <>', 'A null sender is used for bounces and delivery status notifications.');

    // authentication results
    const bad = new Set(['fail', 'softfail', 'permerror', 'temperror', 'policy', 'neutral', 'none', 'hardfail', 'invalid']);
    for (const ar of authResults.slice(0, 1)) {
      for (const r of ar.results) {
        if (!['spf', 'dkim', 'dmarc', 'arc', 'bimi', 'dkim-adsp', 'auth', 'iprev'].includes(r.method)) continue;
        if (r.result === 'pass') continue;
        if (!bad.has(r.result)) continue;
        const sev: RedFlag['severity'] =
          r.result === 'fail' || r.result === 'hardfail' || r.result === 'permerror' ? (r.method === 'dmarc' || r.method === 'spf' || r.method === 'dkim' ? 'high' : 'medium') : r.result === 'softfail' || r.result === 'temperror' ? 'medium' : 'low';
        if (r.method === 'bimi' && r.result === 'none') continue;
        if (r.method === 'arc' && r.result === 'none') continue;
        flag(`auth-${r.method}-${r.result}`, sev, `${r.method.toUpperCase()} ${r.result}`, `The receiving server${ar.authserv ? ` (${ar.authserv})` : ''} reported ${r.method}=${r.result}${r.comment ? ` (${r.comment})` : ''}.`);
      }
    }
    if (authResults.length === 0 && receivedSpf.length === 0 && dkim.length === 0) {
      flag('no-auth', 'info', 'No authentication information', 'No Authentication-Results, Received-SPF or DKIM-Signature headers were found, so SPF/DKIM/DMARC cannot be assessed.');
    }
    for (const s of dkim) for (const msg of s.issues) flag('dkim-issue', /expired|From is not/.test(msg) ? 'medium' : 'low', `DKIM-Signature (${s.domain || '?'})`, msg);
    if (alignment.length > 0 && dmarcEstimate.outcome === 'fail') {
      flag('alignment', 'medium', 'No aligned SPF or DKIM pass', dmarcEstimate.reason);
    }
    if (arc.chainResult && arc.chainResult !== 'pass' && arc.chainResult !== 'none') {
      flag('arc-chain', 'low', `ARC chain validation: ${arc.chainResult}`, 'The most recent ARC-Seal reports a broken chain.');
    }
    for (const m of arc.issues) flag('arc-issue', 'low', 'ARC chain issue', m);

    const badSpam = spam.filter((x) => x.verdict === 'bad');
    if (badSpam.length > 0) {
      flag('spam-filter', 'medium', `Spam filter verdict${badSpam.length > 1 ? 's' : ''} (${badSpam.length})`, badSpam.map((x) => `${x.header}: ${x.summary}`).join(' · '));
    }

    if (hops.hops.length > 10) flag('many-hops', 'low', `Many hops (${hops.hops.length})`, 'More than 10 Received headers: long relay chains can indicate forwarding loops, mailing lists or obfuscation.');
    if (hops.negative > 0) flag('clock-skew', 'low', 'Timestamps go backwards', `${hops.negative} hop${hops.negative === 1 ? ' has' : 's have'} an earlier timestamp than the previous hop (clock skew or forged Received headers).`);
    if (hops.hops.length === 0 && headers.length > 3) flag('no-received', 'low', 'No Received headers', 'The message has no Received trace headers (they may have been stripped from the pasted text).');
    if (parsedDate && hops.hops.length > 0) {
      const firstWithDate = hops.hops.find((h) => h.date !== undefined);
      if (firstWithDate?.date !== undefined) {
        const skew = (parsedDate.ms - firstWithDate.date) / 1000;
        if (skew > 3600 * 24) flag('date-future', 'low', 'Date header is far after the first hop', `The Date header is ${formatDuration(skew)} later than the oldest Received timestamp.`);
        else if (skew < -3600 * 24 * 2) flag('date-past', 'info', 'Date header is long before the first hop', `The message was composed ${formatDuration(-skew)} before it entered the first server (queued, drafted or backdated).`);
      }
    }
    const plainHop = hops.hops.filter((h) => h.tls === 'no' && h.fromIp && !isPrivateIp(h.fromIp));
    if (plainHop.length > 0) {
      flag('no-tls', 'info', `${plainHop.length} hop${plainHop.length === 1 ? '' : 's'} without TLS`, 'These public hops used plain SMTP/ESMTP (no STARTTLS shown in the Received header): the content could have been read in transit.');
    }
  }

  // --- MIME ---
  let mime: MimePart | null = null;
  const ctx: MimeCtx = { count: 0, preferUtf8: fromText, textParts: [], attachments: [] };
  if (hasBody || get('content-type')) {
    if (hasBody) {
      mime = parsePart(bin.replace(/^(?:[ \t]*\r?\n)+/, ''), '', ctx, 0);
    }
  }
  if (mime && ctx.count >= MAX_PARTS) issues.push(`MIME parsing stopped after ${MAX_PARTS} parts.`);

  return {
    headers,
    unparsed: block.unparsed,
    mboxFrom: block.mboxFrom,
    hasBody,
    summary,
    from,
    hops,
    auth,
    spam,
    flags: sortFlags(flags),
    mime,
    attachments: ctx.attachments,
    textParts: ctx.textParts,
    issues,
    inputBytes: bytes.length,
  };
}

const SEV_ORDER: Record<RedFlag['severity'], number> = { high: 0, medium: 1, low: 2, info: 3 };
function sortFlags(f: RedFlag[]): RedFlag[] {
  return f.slice().sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
}

/** JSON-safe report (no raw attachment bytes). */
export function buildReport(a: EmailAnalysis): Record<string, unknown> {
  const stripMime = (p: MimePart): Record<string, unknown> => ({
    path: p.path || '(root)',
    contentType: p.contentType,
    charset: p.charset,
    transferEncoding: p.cte,
    disposition: p.disposition,
    filename: p.filename,
    contentId: p.contentId,
    size: p.size,
    notes: p.notes.length ? p.notes : undefined,
    children: p.children.map(stripMime),
  });
  return {
    summary: Object.fromEntries(a.summary.map((s) => [s.label, s.value])),
    redFlags: a.flags,
    hops: a.hops.hops.map((h) => ({
      order: h.order + 1,
      from: h.fromRdns ?? h.fromHelo,
      helo: h.fromHelo,
      ip: h.fromIp,
      by: h.byHost,
      protocol: h.protocol,
      tls: h.tls,
      tlsDetail: h.tlsDetail,
      time: h.date !== undefined ? new Date(h.date).toISOString() : undefined,
      delaySeconds: h.delay,
      cumulativeSeconds: h.cumulative,
      flags: h.flags,
    })),
    totalTransitSeconds: a.hops.totalSeconds,
    authentication: {
      authenticationResults: a.auth.authResults,
      receivedSpf: a.auth.receivedSpf,
      dkimSignatures: a.auth.dkim.map((d) => ({
        domain: d.domain, selector: d.selector, algorithm: d.algorithm, canonicalization: `${d.canonHeader}/${d.canonBody}`,
        signedHeaders: d.headersSigned, timestamp: d.timestamp, expiration: d.expiration, expired: d.expired, dnsName: d.dnsName, issues: d.issues,
      })),
      arc: { chainResult: a.auth.arc.chainResult, instances: a.auth.arc.instances.map((i) => ({ i: i.i, cv: i.cv, domain: i.domain, issues: i.issues })) },
      fromDomain: a.auth.fromDomain,
      alignment: a.auth.alignment,
      dmarcEstimate: a.auth.dmarcEstimate,
    },
    spam: a.spam,
    headers: a.headers.map((h) => ({ name: h.name, value: h.decoded })),
    mime: a.mime ? stripMime(a.mime) : null,
    attachments: a.attachments.map((x) => ({ path: x.path, filename: x.filename, contentType: x.contentType, size: x.size, disposition: x.disposition })),
  };
}
