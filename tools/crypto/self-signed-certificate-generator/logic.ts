/* =====================================================================
 * Shared PKI primitives: bytes / Base64 / PEM encode, DER writer, DER+BER
 * reader, OID helpers. Pure TypeScript, no dependencies.
 * (This block is intentionally duplicated in each PKI tool's logic.ts so
 * every tool folder stays self-contained.)
 * ===================================================================== */

export const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

const bs = (u: Uint8Array): BufferSource => u as unknown as BufferSource;

/* ------------------------------ bytes ------------------------------ */

export function toHex(b: Uint8Array, sep = ''): string {
  const parts: string[] = new Array<string>(b.length);
  for (let i = 0; i < b.length; i++) parts[i] = (b[i] ?? 0).toString(16).padStart(2, '0');
  return parts.join(sep);
}

export function fromHex(s: string): Uint8Array {
  const h = s.replace(/[\s:]/g, '').replace(/^0x/i, '');
  if (h.length % 2 !== 0 || /[^0-9a-fA-F]/.test(h)) throw new Error('Invalid hex string');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
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

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

const textEnc = new TextEncoder();
export function utf8Encode(s: string): Uint8Array {
  return textEnc.encode(s);
}
export function utf8Decode(b: Uint8Array, fatal = false): string {
  return new TextDecoder('utf-8', { fatal }).decode(b);
}

export function b64Encode(b: Uint8Array): string {
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < b.length; i += CH) {
    bin += String.fromCharCode(...b.subarray(i, Math.min(i + CH, b.length)));
  }
  return btoa(bin);
}

/** Decodes standard or URL-safe Base64 (padding optional, whitespace ignored). */
export function b64Decode(s: string): Uint8Array {
  let t = s.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(t)) throw new Error('Invalid Base64 characters');
  t = t.replace(/=+$/, '');
  if (t.length % 4 === 1) throw new Error('Invalid Base64 length');
  t += '==='.slice((t.length + 3) % 4);
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function wrapLines(s: string, width = 64): string {
  const lines: string[] = [];
  for (let i = 0; i < s.length; i += width) lines.push(s.slice(i, i + width));
  return lines.join('\n');
}

/** DER → PEM text (LF line endings, 64-column body, trailing newline). */
export function toPem(der: Uint8Array, label: string): string {
  return `-----BEGIN ${label}-----\n${wrapLines(b64Encode(der))}\n-----END ${label}-----\n`;
}

export type HashName = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';
export async function digest(alg: HashName, data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await wc.subtle.digest(alg, bs(data)));
}

/* ----------------------------- DER writer ----------------------------- */

export function derLength(n: number): Uint8Array {
  if (n < 0x80) return Uint8Array.of(n);
  const bytes: number[] = [];
  let x = n;
  while (x > 0) {
    bytes.unshift(x % 256);
    x = Math.floor(x / 256);
  }
  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

/** Encodes a TLV with a single-byte identifier. */
export function tlv(tag: number, ...parts: Uint8Array[]): Uint8Array {
  const body = concatBytes(...parts);
  return concatBytes(Uint8Array.of(tag), derLength(body.length), body);
}

export const seq = (...p: Uint8Array[]): Uint8Array => tlv(0x30, ...p);
export const setOf = (...p: Uint8Array[]): Uint8Array => tlv(0x31, ...p);
export const octetString = (b: Uint8Array): Uint8Array => tlv(0x04, b);
export const bitString = (b: Uint8Array, unused = 0): Uint8Array =>
  tlv(0x03, Uint8Array.of(unused), b);
export const derNull = (): Uint8Array => Uint8Array.of(0x05, 0x00);
export const derBool = (v: boolean): Uint8Array => Uint8Array.of(0x01, 0x01, v ? 0xff : 0x00);

/** Context-specific tag [n]; `constructed` selects EXPLICIT/constructed vs primitive. */
export function ctx(n: number, constructed: boolean, ...parts: Uint8Array[]): Uint8Array {
  return tlv(0x80 | (constructed ? 0x20 : 0) | n, ...parts);
}

/** Non-negative INTEGER from a number, bigint or an unsigned big-endian magnitude. */
export function derInteger(v: number | bigint | Uint8Array): Uint8Array {
  let mag: Uint8Array;
  if (v instanceof Uint8Array) {
    let i = 0;
    while (i < v.length - 1 && v[i] === 0) i++;
    mag = v.subarray(i);
    if (mag.length === 0) mag = Uint8Array.of(0);
  } else {
    let x = BigInt(v);
    if (x < 0n) throw new Error('Negative INTEGER not supported');
    const arr: number[] = [];
    do {
      arr.unshift(Number(x & 0xffn));
      x >>= 8n;
    } while (x > 0n);
    mag = Uint8Array.from(arr);
  }
  if (((mag[0] ?? 0) & 0x80) !== 0) mag = concatBytes(Uint8Array.of(0), mag);
  return tlv(0x02, mag);
}

export function encodeOidContent(dotted: string): Uint8Array {
  const arcs = dotted
    .trim()
    .split('.')
    .map((a) => {
      if (!/^\d+$/.test(a)) throw new Error(`Invalid OID: ${dotted}`);
      return BigInt(a);
    });
  if (arcs.length < 2) throw new Error(`Invalid OID: ${dotted}`);
  const a0 = arcs[0] ?? 0n;
  const a1 = arcs[1] ?? 0n;
  if (a0 > 2n || (a0 < 2n && a1 >= 40n)) throw new Error(`Invalid OID: ${dotted}`);
  const out: number[] = [];
  const pushArc = (val: bigint) => {
    const tmp: number[] = [Number(val & 0x7fn)];
    let v = val >> 7n;
    while (v > 0n) {
      tmp.push(Number(v & 0x7fn) | 0x80);
      v >>= 7n;
    }
    out.push(...tmp.reverse());
  };
  pushArc(a0 * 40n + a1);
  for (let i = 2; i < arcs.length; i++) pushArc(arcs[i] ?? 0n);
  return Uint8Array.from(out);
}
export const derOid = (dotted: string): Uint8Array => tlv(0x06, encodeOidContent(dotted));

export function decodeOidContent(c: Uint8Array): string {
  if (c.length === 0) throw new Error('Empty OBJECT IDENTIFIER');
  if (((c[c.length - 1] ?? 0) & 0x80) !== 0) throw new Error('Truncated OBJECT IDENTIFIER');
  const arcs: string[] = [];
  let v = 0n;
  let first = true;
  for (const b of c) {
    v = (v << 7n) | BigInt(b & 0x7f);
    if ((b & 0x80) === 0) {
      if (first) {
        const a0 = v >= 80n ? 2n : v / 40n;
        arcs.push(String(a0), String(v - a0 * 40n));
        first = false;
      } else {
        arcs.push(String(v));
      }
      v = 0n;
    }
  }
  return arcs.join('.');
}

export const derUtf8 = (s: string): Uint8Array => tlv(0x0c, utf8Encode(s));
export const derPrintable = (s: string): Uint8Array => tlv(0x13, utf8Encode(s));
export const derIa5 = (s: string): Uint8Array => tlv(0x16, utf8Encode(s));

const p2 = (n: number): string => String(n).padStart(2, '0');
/** UTCTime for 1950–2049, GeneralizedTime otherwise (RFC 5280 §4.1.2.5). */
export function derTime(d: Date): Uint8Array {
  const y = d.getUTCFullYear();
  const rest = `${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`;
  if (y >= 1950 && y <= 2049) return tlv(0x17, utf8Encode(`${p2(y % 100)}${rest}`));
  return tlv(0x18, utf8Encode(`${String(y).padStart(4, '0')}${rest}`));
}

/* ---------------------------- DER/BER reader ---------------------------- */

export class Asn1Error extends Error {
  offset: number;
  constructor(message: string, offset: number) {
    super(message);
    this.name = 'Asn1Error';
    this.offset = offset;
  }
}

export interface Tlv {
  /** Tag class: 0 universal, 1 application, 2 context-specific, 3 private. */
  cls: number;
  tag: number;
  constructed: boolean;
  /** Offset of the identifier octet inside `buf`. */
  start: number;
  headerLen: number;
  /** Content length (for indefinite length: excludes the end-of-contents marker). */
  len: number;
  indef: boolean;
  contentStart: number;
  /** Offset just past the whole element (including EOC for indefinite length). */
  end: number;
  buf: Uint8Array;
}

export const MAX_DEPTH = 64;

export function readTlv(
  buf: Uint8Array,
  pos = 0,
  limit: number = buf.length,
  strict = false,
  depth = 0
): Tlv {
  if (depth > MAX_DEPTH) throw new Asn1Error('Maximum nesting depth exceeded', pos);
  if (pos >= limit) throw new Asn1Error('Unexpected end of data', pos);
  const b0 = buf[pos] ?? 0;
  let p = pos + 1;
  const cls = b0 >> 6;
  const constructed = (b0 & 0x20) !== 0;
  let tag = b0 & 0x1f;
  if (tag === 0x1f) {
    tag = 0;
    let n = 0;
    for (;;) {
      if (p >= limit) throw new Asn1Error('Truncated high-tag-number identifier', pos);
      const b = buf[p++] ?? 0;
      tag = tag * 128 + (b & 0x7f);
      if (++n > 5) throw new Asn1Error('Tag number too large', pos);
      if ((b & 0x80) === 0) break;
    }
  }
  if (p >= limit) throw new Asn1Error('Truncated length', pos);
  const l0 = buf[p++] ?? 0;
  let len = 0;
  let indef = false;
  if (l0 < 0x80) {
    len = l0;
  } else if (l0 === 0x80) {
    if (!constructed) throw new Asn1Error('Indefinite length on a primitive element', pos);
    if (strict) throw new Asn1Error('Indefinite length not allowed in DER', pos);
    indef = true;
  } else {
    const n = l0 & 0x7f;
    if (n > 6) throw new Asn1Error(`Length field too large (${n} octets)`, pos);
    if (p + n > limit) throw new Asn1Error('Truncated length', pos);
    for (let i = 0; i < n; i++) len = len * 256 + (buf[p++] ?? 0);
    if (strict && (len < 0x80 || (n > 1 && (buf[p - n] ?? 0) === 0)))
      throw new Asn1Error('Non-minimal length encoding', pos);
  }
  const headerLen = p - pos;
  if (!indef) {
    if (p + len > limit)
      throw new Asn1Error(`Length ${len} exceeds the ${limit - p} bytes available`, pos);
    return { cls, tag, constructed, start: pos, headerLen, len, indef, contentStart: p, end: p + len, buf };
  }
  let q = p;
  for (;;) {
    if (q + 2 > limit) throw new Asn1Error('Missing end-of-contents for indefinite length', pos);
    if (buf[q] === 0 && buf[q + 1] === 0) break;
    q = readTlv(buf, q, limit, strict, depth + 1).end;
  }
  return { cls, tag, constructed, start: pos, headerLen, len: q - p, indef, contentStart: p, end: q + 2, buf };
}

export function tlvChildren(t: Tlv): Tlv[] {
  if (!t.constructed) return [];
  const out: Tlv[] = [];
  const end = t.contentStart + t.len;
  let p = t.contentStart;
  while (p < end) {
    const c = readTlv(t.buf, p, end);
    out.push(c);
    p = c.end;
  }
  return out;
}

export const tlvContent = (t: Tlv): Uint8Array => t.buf.subarray(t.contentStart, t.contentStart + t.len);
export const tlvRaw = (t: Tlv): Uint8Array => t.buf.subarray(t.start, t.end);

/** Parses exactly one element that must span the whole buffer. */
export function parseSingle(buf: Uint8Array, strict = false): Tlv {
  const t = readTlv(buf, 0, buf.length, strict);
  if (t.end !== buf.length)
    throw new Asn1Error(`${buf.length - t.end} unexpected trailing byte(s)`, t.end);
  return t;
}

export const isUniv = (t: Tlv | undefined, tag: number): t is Tlv =>
  !!t && t.cls === 0 && t.tag === tag;
export const isCtx = (t: Tlv | undefined, n: number): t is Tlv => !!t && t.cls === 2 && t.tag === n;

/** Unsigned magnitude of an INTEGER's content (leading zero byte removed). */
export function intMagnitude(content: Uint8Array): Uint8Array {
  let i = 0;
  while (i < content.length - 1 && content[i] === 0) i++;
  return content.subarray(i);
}

export function bytesToBigInt(b: Uint8Array): bigint {
  let v = 0n;
  for (const x of b) v = (v << 8n) | BigInt(x);
  return v;
}

/** Two's-complement signed INTEGER content → bigint. */
export function signedToBigInt(c: Uint8Array): bigint {
  if (c.length === 0) return 0n;
  let v = bytesToBigInt(c);
  if (((c[0] ?? 0) & 0x80) !== 0) v -= 1n << BigInt(c.length * 8);
  return v;
}

export function bitLength(mag: Uint8Array): number {
  const m = intMagnitude(mag);
  if (m.length === 0 || (m.length === 1 && m[0] === 0)) return 0;
  let top = m[0] ?? 0;
  let bits = 0;
  while (top > 0) {
    bits++;
    top >>= 1;
  }
  return (m.length - 1) * 8 + bits;
}

/** Parses "oid name" lines into a lookup table. */
export function parseOidTable(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const sp = t.indexOf(' ');
    if (sp > 0) out[t.slice(0, sp)] = t.slice(sp + 1).trim();
  }
  return out;
}

/* ============================ end shared block ============================ */

/* ------------------------------- OID names ------------------------------- */

const OID_NAMES: Record<string, string> = parseOidTable(`
2.5.4.3 commonName
2.5.4.6 countryName
2.5.4.7 localityName
2.5.4.8 stateOrProvinceName
2.5.4.10 organizationName
2.5.4.11 organizationalUnitName
1.2.840.113549.1.1.1 rsaEncryption
1.2.840.113549.1.1.11 sha256WithRSAEncryption
1.2.840.113549.1.1.12 sha384WithRSAEncryption
1.2.840.113549.1.1.13 sha512WithRSAEncryption
1.2.840.10045.2.1 ecPublicKey
1.2.840.10045.4.3.2 ecdsa-with-SHA256
1.2.840.10045.4.3.3 ecdsa-with-SHA384
1.2.840.10045.4.3.4 ecdsa-with-SHA512
1.2.840.10045.3.1.7 prime256v1 (P-256)
1.3.132.0.34 secp384r1 (P-384)
1.3.132.0.35 secp521r1 (P-521)
1.3.101.112 Ed25519
1.2.840.113549.1.9.14 extensionRequest
2.5.29.14 subjectKeyIdentifier
2.5.29.15 keyUsage
2.5.29.17 subjectAltName
2.5.29.19 basicConstraints
2.5.29.35 authorityKeyIdentifier
2.5.29.37 extendedKeyUsage
1.3.6.1.5.5.7.3.1 serverAuth
1.3.6.1.5.5.7.3.2 clientAuth
1.3.6.1.5.5.7.3.3 codeSigning
1.3.6.1.5.5.7.3.4 emailProtection
`);

export function oidName(oid: string): string {
  return OID_NAMES[oid] ?? '';
}

/* ============================ options & validation ============================ */

export type KeyType = 'ec-p256' | 'ec-p384' | 'ec-p521' | 'rsa-2048' | 'rsa-3072' | 'rsa-4096' | 'ed25519';
export type HashAlg = 'SHA-256' | 'SHA-384' | 'SHA-512';
export type Profile = 'tls-server' | 'tls-client' | 'ca' | 'code-signing';
export type Mode = 'self-signed' | 'csr' | 'ca-leaf';
export type EkuKey = 'serverAuth' | 'clientAuth' | 'codeSigning' | 'emailProtection';

export const EKU_OIDS: Record<EkuKey, string> = {
  serverAuth: '1.3.6.1.5.5.7.3.1',
  clientAuth: '1.3.6.1.5.5.7.3.2',
  codeSigning: '1.3.6.1.5.5.7.3.3',
  emailProtection: '1.3.6.1.5.5.7.3.4',
};
export const EKU_KEYS: EkuKey[] = ['serverAuth', 'clientAuth', 'codeSigning', 'emailProtection'];

export const KEY_TYPE_LABELS: Record<KeyType, string> = {
  'ec-p256': 'ECDSA P-256',
  'ec-p384': 'ECDSA P-384',
  'ec-p521': 'ECDSA P-521',
  'rsa-2048': 'RSA 2048',
  'rsa-3072': 'RSA 3072',
  'rsa-4096': 'RSA 4096',
  ed25519: 'Ed25519',
};

export interface DnInput {
  cn: string;
  o: string;
  ou: string;
  c: string;
  st: string;
  l: string;
}

export interface GenOptions {
  mode: Mode;
  profile: Profile;
  dn: DnInput;
  /** Raw SAN entries (DNS names, IPs, emails, URIs). */
  sans: string[];
  addCnToSan: boolean;
  days: number;
  keyType: KeyType;
  hash: HashAlg;
  /** Basic Constraints pathLenConstraint for CA certificates; null = unlimited. */
  pathLen: number | null;
  eku: EkuKey[];
  /** `ca-leaf` mode: CA common name and validity. */
  caCn: string;
  caDays: number;
  now?: Date;
}

export function defaultEku(profile: Profile): EkuKey[] {
  switch (profile) {
    case 'tls-server':
      return ['serverAuth'];
    case 'tls-client':
      return ['clientAuth'];
    case 'code-signing':
      return ['codeSigning'];
    case 'ca':
      return [];
  }
}

export interface SanEntry {
  type: 'dns' | 'ip' | 'email' | 'uri';
  value: string;
  bytes: Uint8Array;
}

/** Parses an IPv4 dotted quad; null when not a valid address. */
export function parseIPv4(s: string): Uint8Array | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return null;
  const out = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    const v = Number(m[i + 1]);
    if (v > 255 || (m[i + 1] ?? '').length > 1 && (m[i + 1] ?? '').startsWith('0')) return null;
    out[i] = v;
  }
  return out;
}

/** Parses an IPv6 address (with `::` compression and optional embedded IPv4). */
export function parseIPv6(input: string): Uint8Array | null {
  let s = input.trim();
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
  if (!s.includes(':') || /[^0-9a-fA-F:.]/.test(s)) return null;
  const dbl = s.split('::');
  if (dbl.length > 2) return null;
  const toGroups = (part: string): number[] | null => {
    if (part === '') return [];
    const groups: number[] = [];
    const bits = part.split(':');
    for (const [i, g] of bits.entries()) {
      if (g.includes('.')) {
        if (i !== bits.length - 1) return null;
        const v4 = parseIPv4(g);
        if (!v4) return null;
        groups.push(((v4[0] ?? 0) << 8) | (v4[1] ?? 0), ((v4[2] ?? 0) << 8) | (v4[3] ?? 0));
      } else {
        if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
        groups.push(parseInt(g, 16));
      }
    }
    return groups;
  };
  const head = toGroups(dbl[0] ?? '');
  const tail = dbl.length === 2 ? toGroups(dbl[1] ?? '') : [];
  if (!head || !tail) return null;
  let groups: number[];
  if (dbl.length === 2) {
    const fill = 8 - head.length - tail.length;
    if (fill < 1) return null;
    groups = [...head, ...new Array<number>(fill).fill(0), ...tail];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  const out = new Uint8Array(16);
  groups.forEach((g, i) => {
    out[i * 2] = g >> 8;
    out[i * 2 + 1] = g & 0xff;
  });
  return out;
}

export function ipBytesToString(b: Uint8Array): string {
  if (b.length === 4) return Array.from(b).join('.');
  const w: number[] = [];
  for (let i = 0; i < 16; i += 2) w.push(((b[i] ?? 0) << 8) | (b[i + 1] ?? 0));
  let bestStart = -1;
  let bestLen = 0;
  for (let i = 0; i < 8; ) {
    if (w[i] === 0) {
      let j = i;
      while (j < 8 && w[j] === 0) j++;
      if (j - i > bestLen) {
        bestStart = i;
        bestLen = j - i;
      }
      i = j;
    } else i++;
  }
  if (bestLen < 2) return w.map((x) => x.toString(16)).join(':');
  return `${w.slice(0, bestStart).map((x) => x.toString(16)).join(':')}::${w.slice(bestStart + bestLen).map((x) => x.toString(16)).join(':')}`;
}

const DNS_LABEL = /^[A-Za-z0-9_]([A-Za-z0-9_-]{0,61}[A-Za-z0-9_])?$/;

function normalizeDns(raw: string): { value?: string; error?: string } {
  let name = raw.trim().replace(/\.$/, '');
  if (!name) return { error: 'empty DNS name' };
  if (/[^\x20-\x7e]/.test(name)) {
    try {
      name = new URL(`http://${name}`).hostname;
    } catch {
      return { error: `"${raw}" is not a valid internationalised domain name` };
    }
  }
  name = name.toLowerCase();
  if (name.length > 253) return { error: `"${raw}" is longer than 253 characters` };
  const labels = name.split('.');
  for (const [i, l] of labels.entries()) {
    if (l === '*' && i === 0 && labels.length > 2) continue;
    if (!DNS_LABEL.test(l)) {
      return { error: l === '*' ? `"${raw}": a wildcard is only allowed as the whole left-most label (e.g. *.example.com)` : `"${raw}" is not a valid DNS name (bad label "${l}")` };
    }
  }
  return { value: name };
}

/** Classifies and validates SAN entries (DNS / IP / email / URI). */
export function parseSans(entries: string[]): { sans: SanEntry[]; errors: string[] } {
  const sans: SanEntry[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const add = (e: SanEntry) => {
    const key = `${e.type}:${e.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      sans.push(e);
    }
  };
  for (const raw0 of entries) {
    const raw = raw0.trim();
    if (!raw) continue;
    const uri = /^([a-z][a-z0-9+.-]*):\/\/\S+$/i.exec(raw);
    if (uri) {
      if (/[^\x20-\x7e]/.test(raw)) errors.push(`URI "${raw}" must be ASCII (percent-encode non-ASCII characters)`);
      else add({ type: 'uri', value: raw, bytes: utf8Encode(raw) });
    } else if (raw.includes('@')) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) || /[^\x20-\x7e]/.test(raw)) errors.push(`"${raw}" is not a valid ASCII e-mail address`);
      else add({ type: 'email', value: raw, bytes: utf8Encode(raw) });
    } else if (/^\d+\.\d+\.\d+\.\d+$/.test(raw)) {
      const ip = parseIPv4(raw);
      if (!ip) errors.push(`"${raw}" is not a valid IPv4 address`);
      else add({ type: 'ip', value: raw, bytes: ip });
    } else if (raw.includes(':') || (raw.startsWith('[') && raw.endsWith(']'))) {
      const ip = parseIPv6(raw);
      if (!ip) errors.push(`"${raw}" is not a valid IPv6 address`);
      else add({ type: 'ip', value: ipBytesToString(ip), bytes: ip });
    } else {
      const d = normalizeDns(raw);
      if (d.error || !d.value) errors.push(d.error ?? `"${raw}" is not valid`);
      else add({ type: 'dns', value: d.value, bytes: utf8Encode(d.value) });
    }
  }
  return { sans, errors };
}

export interface Validation {
  errors: string[];
  warnings: string[];
  sans: SanEntry[];
  /** Resolved Subject DN (trimmed, C upper-cased). */
  dn: DnInput;
}

const MAX_LEN: Record<keyof DnInput, number> = { cn: 64, o: 64, ou: 64, c: 2, st: 128, l: 128 };

export function validateOptions(o: GenOptions): Validation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const dn: DnInput = {
    cn: o.dn.cn.trim(), o: o.dn.o.trim(), ou: o.dn.ou.trim(), c: o.dn.c.trim().toUpperCase(), st: o.dn.st.trim(), l: o.dn.l.trim(),
  };
  if (!dn.cn) errors.push('Common Name is required.');
  if (dn.c && !/^[A-Z]{2}$/.test(dn.c)) errors.push('Country must be a 2-letter ISO code (e.g. US, DE).');
  for (const k of ['cn', 'o', 'ou', 'st', 'l'] as const) {
    if (dn[k].length > MAX_LEN[k]) errors.push(`${k.toUpperCase()} is longer than ${MAX_LEN[k]} characters (RFC 5280 limit).`);
  }
  if (o.mode !== 'csr' && (!Number.isFinite(o.days) || o.days < 1 || o.days > 36500 || !Number.isInteger(o.days))) errors.push('Validity must be a whole number of days between 1 and 36500.');
  const wantsSan = o.profile !== 'ca';
  const entries = [...o.sans];
  if (o.addCnToSan && wantsSan && dn.cn && !/\s/.test(dn.cn) && (dn.cn.includes('.') || dn.cn.includes(':') || /^[A-Za-z0-9-]+$/.test(dn.cn)) && !dn.cn.includes('@')) {
    entries.unshift(dn.cn);
  }
  const parsed = parseSans(entries);
  errors.push(...parsed.errors);
  if (wantsSan && parsed.sans.length === 0 && o.profile === 'tls-server') {
    warnings.push('No Subject Alternative Name: browsers ignore the Common Name, so this server certificate will not validate for any host name. Add at least one DNS name or IP address.');
  }
  if (o.profile === 'ca' || o.mode === 'ca-leaf') {
    if (o.pathLen !== null && (!Number.isInteger(o.pathLen) || o.pathLen < 0 || o.pathLen > 99)) errors.push('Path length must be a whole number between 0 and 99 (or empty for none).');
  }
  if (o.mode === 'ca-leaf') {
    if (!o.caCn.trim()) errors.push('CA Common Name is required.');
    if (!Number.isInteger(o.caDays) || o.caDays < 1 || o.caDays > 36500) errors.push('CA validity must be a whole number of days between 1 and 36500.');
    else if (o.days > o.caDays) errors.push('The leaf certificate cannot be valid longer than its CA.');
    if (o.profile === 'ca') errors.push('Choose a leaf profile (TLS server, TLS client or code signing) for the certificate signed by the local CA.');
  }
  if ((o.profile === 'tls-server' || o.profile === 'tls-client') && o.days > 398 && o.mode !== 'csr') {
    warnings.push(`Validity is ${o.days} days. Public CAs and browsers cap TLS certificates at 398 days or less; certificates trusted through a locally installed root are usually exempt, but some clients (e.g. Apple platforms, Chrome policies) may still reject long-lived ones.`);
  }
  if (o.keyType === 'ed25519' && (o.profile === 'tls-server' || o.profile === 'tls-client')) {
    warnings.push('Ed25519 certificates are not accepted by every TLS stack or browser yet; use ECDSA P-256 if you need the widest compatibility.');
  }
  if (o.keyType === 'rsa-4096') warnings.push('RSA 4096 key generation can take several seconds in a browser.');
  if (o.hash !== 'SHA-256' && o.keyType === 'ed25519') warnings.push('Ed25519 always signs with SHA-512 internally; the hash selection is ignored.');
  return { errors, warnings, sans: parsed.sans, dn };
}

/* ============================ DER building blocks ============================ */

const OID = {
  cn: '2.5.4.3', c: '2.5.4.6', l: '2.5.4.7', st: '2.5.4.8', o: '2.5.4.10', ou: '2.5.4.11',
  rsa: '1.2.840.113549.1.1.1', ecPublicKey: '1.2.840.10045.2.1', ed25519: '1.3.101.112',
  extReq: '1.2.840.113549.1.9.14',
  ski: '2.5.29.14', ku: '2.5.29.15', san: '2.5.29.17', bc: '2.5.29.19', aki: '2.5.29.35', eku: '2.5.29.37',
} as const;

/** RDNSequence in the conventional order C, ST, L, O, OU, CN. */
export function buildName(dn: DnInput): Uint8Array {
  const rdn = (oid: string, v: Uint8Array) => setOf(seq(derOid(oid), v));
  const parts: Uint8Array[] = [];
  if (dn.c) parts.push(rdn(OID.c, derPrintable(dn.c)));
  if (dn.st) parts.push(rdn(OID.st, derUtf8(dn.st)));
  if (dn.l) parts.push(rdn(OID.l, derUtf8(dn.l)));
  if (dn.o) parts.push(rdn(OID.o, derUtf8(dn.o)));
  if (dn.ou) parts.push(rdn(OID.ou, derUtf8(dn.ou)));
  if (dn.cn) parts.push(rdn(OID.cn, derUtf8(dn.cn)));
  return seq(...parts);
}

export function buildExtension(oid: string, critical: boolean, value: Uint8Array): Uint8Array {
  return seq(derOid(oid), ...(critical ? [derBool(true)] : []), octetString(value));
}

export function buildSan(sans: SanEntry[]): Uint8Array {
  const tags: Record<SanEntry['type'], number> = { email: 0x81, dns: 0x82, uri: 0x86, ip: 0x87 };
  return seq(...sans.map((s) => tlv(tags[s.type], s.bytes)));
}

export function buildBasicConstraints(ca: boolean, pathLen: number | null): Uint8Array {
  if (!ca) return seq();
  return seq(derBool(true), ...(pathLen !== null ? [derInteger(pathLen)] : []));
}

export type KuBit = 'digitalSignature' | 'nonRepudiation' | 'keyEncipherment' | 'dataEncipherment' | 'keyAgreement' | 'keyCertSign' | 'cRLSign';
const KU_ORDER: KuBit[] = ['digitalSignature', 'nonRepudiation', 'keyEncipherment', 'dataEncipherment', 'keyAgreement', 'keyCertSign', 'cRLSign'];

/** KeyUsage BIT STRING in minimal DER form (trailing zero bits removed). */
export function buildKeyUsage(bits: KuBit[]): Uint8Array {
  let v = 0;
  let highest = 0;
  for (const b of bits) {
    const i = KU_ORDER.indexOf(b);
    v |= 0x80 >> i;
    highest = Math.max(highest, i);
  }
  return bitString(Uint8Array.of(v), 7 - highest);
}

export function buildEku(keys: EkuKey[]): Uint8Array {
  return seq(...keys.map((k) => derOid(EKU_OIDS[k])));
}

export function kuForProfile(profile: Profile, keyType: KeyType): KuBit[] {
  const rsa = keyType.startsWith('rsa');
  switch (profile) {
    case 'tls-server':
      return rsa ? ['digitalSignature', 'keyEncipherment'] : ['digitalSignature'];
    case 'tls-client':
      return rsa ? ['digitalSignature', 'keyEncipherment'] : ['digitalSignature'];
    case 'code-signing':
      return ['digitalSignature'];
    case 'ca':
      return ['keyCertSign', 'cRLSign'];
  }
}

/** ECDSA raw r||s (WebCrypto) → DER SEQUENCE { INTEGER r, INTEGER s }. */
export function ecdsaRawToDer(raw: Uint8Array): Uint8Array {
  const n = raw.length / 2;
  return seq(derInteger(raw.slice(0, n)), derInteger(raw.slice(n)));
}

/** DER ECDSA signature → fixed-width raw r||s. */
export function ecdsaDerToRaw(der: Uint8Array, size: number): Uint8Array {
  const k = tlvChildren(parseSingle(der));
  const r = intMagnitude(tlvContent(k[0] ?? parseSingle(der)));
  const s = intMagnitude(tlvContent(k[1] ?? parseSingle(der)));
  if (r.length > size || s.length > size) throw new Error('ECDSA signature component too large');
  const out = new Uint8Array(size * 2);
  out.set(r, size - r.length);
  out.set(s, size * 2 - s.length);
  return out;
}

/* ============================== key generation ============================== */

export interface KeyPair {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  spki: Uint8Array;
  pkcs8: Uint8Array;
  keyType: KeyType;
  hash: HashAlg;
}

let ed25519Cache: Promise<boolean> | null = null;
/** Feature-detects WebCrypto Ed25519 (Chrome 137+, Firefox 129+, Safari 17+). */
export function ed25519Supported(): Promise<boolean> {
  if (!ed25519Cache) {
    ed25519Cache = (async () => {
      try {
        await wc.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);
        return true;
      } catch {
        return false;
      }
    })();
  }
  return ed25519Cache;
}

export async function generateKeyPair(keyType: KeyType, hash: HashAlg): Promise<KeyPair> {
  let pair: CryptoKeyPair;
  if (keyType.startsWith('ec-')) {
    const curve = keyType === 'ec-p256' ? 'P-256' : keyType === 'ec-p384' ? 'P-384' : 'P-521';
    pair = (await wc.subtle.generateKey({ name: 'ECDSA', namedCurve: curve }, true, ['sign', 'verify'])) as CryptoKeyPair;
  } else if (keyType.startsWith('rsa-')) {
    const bits = Number(keyType.slice(4));
    pair = (await wc.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: bits, publicExponent: Uint8Array.of(1, 0, 1), hash },
      true,
      ['sign', 'verify']
    )) as CryptoKeyPair;
  } else {
    if (!(await ed25519Supported())) throw new Error('This browser does not support Ed25519 in WebCrypto. Choose ECDSA or RSA instead.');
    pair = (await wc.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  }
  const spki = new Uint8Array(await wc.subtle.exportKey('spki', pair.publicKey));
  const pkcs8 = new Uint8Array(await wc.subtle.exportKey('pkcs8', pair.privateKey));
  return { privateKey: pair.privateKey, publicKey: pair.publicKey, spki, pkcs8, keyType, hash };
}

const HASH_SUFFIX: Record<HashAlg, number> = { 'SHA-256': 0, 'SHA-384': 1, 'SHA-512': 2 };

/** AlgorithmIdentifier for the signature (NULL params for RSA, absent for ECDSA/Ed25519). */
export function signatureAlgorithm(keyType: KeyType, hash: HashAlg): Uint8Array {
  const i = HASH_SUFFIX[hash];
  if (keyType.startsWith('rsa-')) return seq(derOid(`1.2.840.113549.1.1.${11 + i}`), derNull());
  if (keyType === 'ed25519') return seq(derOid(OID.ed25519));
  return seq(derOid(`1.2.840.10045.4.3.${2 + i}`));
}

/** Signs `data` and returns the X.509 signature value (ECDSA converted to DER). Verifies it before returning. */
export async function signData(kp: KeyPair, data: Uint8Array): Promise<Uint8Array> {
  if (kp.keyType.startsWith('ec-')) {
    const algo = { name: 'ECDSA', hash: kp.hash };
    const raw = new Uint8Array(await wc.subtle.sign(algo, kp.privateKey, bs(data)));
    if (!(await wc.subtle.verify(algo, kp.publicKey, bs(raw), bs(data)))) throw new Error('Internal error: generated signature did not verify');
    return ecdsaRawToDer(raw);
  }
  const algo = kp.keyType === 'ed25519' ? { name: 'Ed25519' } : { name: 'RSASSA-PKCS1-v1_5' };
  const sig = new Uint8Array(await wc.subtle.sign(algo, kp.privateKey, bs(data)));
  if (!(await wc.subtle.verify(algo, kp.publicKey, bs(sig), bs(data)))) throw new Error('Internal error: generated signature did not verify');
  return sig;
}

/** SHA-1 of the subjectPublicKey BIT STRING contents (RFC 5280 method 1). */
export async function subjectKeyId(spki: Uint8Array): Promise<Uint8Array> {
  const k = tlvChildren(parseSingle(spki));
  const bits = tlvContent(k[1] ?? parseSingle(spki));
  return digest('SHA-1', bits.subarray(1));
}

export function randomSerial(): Uint8Array {
  const b = new Uint8Array(16);
  wc.getRandomValues(b);
  b[0] = (b[0] ?? 0) & 0x7f;
  if (b[0] === 0) b[0] = 0x01;
  return b;
}

/* ============================ certificate / CSR assembly ============================ */

function extensionList(opts: GenOptions, v: Validation, ski?: Uint8Array, aki?: Uint8Array, forCsr = false): Uint8Array[] {
  const exts: Uint8Array[] = [];
  const isCa = opts.profile === 'ca';
  exts.push(buildExtension(OID.bc, true, buildBasicConstraints(isCa, isCa ? opts.pathLen : null)));
  exts.push(buildExtension(OID.ku, true, buildKeyUsage(kuForProfile(opts.profile, opts.keyType))));
  if (!isCa && opts.eku.length > 0) exts.push(buildExtension(OID.eku, false, buildEku(opts.eku)));
  if (!forCsr && ski) exts.push(buildExtension(OID.ski, false, octetString(ski)));
  if (!forCsr && aki) exts.push(buildExtension(OID.aki, false, seq(ctx(0, false, aki))));
  if (v.sans.length > 0) exts.push(buildExtension(OID.san, false, buildSan(v.sans)));
  return exts;
}

/** Truncates to whole seconds (X.509 times have no sub-second precision). */
function secs(d: Date): Date {
  return new Date(Math.floor(d.getTime() / 1000) * 1000);
}

async function buildCertificate(p: {
  subjectName: Uint8Array;
  issuerName: Uint8Array;
  spki: Uint8Array;
  signer: KeyPair;
  extensions: Uint8Array[];
  notBefore: Date;
  notAfter: Date;
}): Promise<Uint8Array> {
  const sigAlg = signatureAlgorithm(p.signer.keyType, p.signer.hash);
  const tbs = seq(
    ctx(0, true, derInteger(2)),
    derInteger(randomSerial()),
    sigAlg,
    p.issuerName,
    seq(derTime(secs(p.notBefore)), derTime(secs(p.notAfter))),
    p.subjectName,
    p.spki,
    ctx(3, true, seq(...p.extensions))
  );
  const sig = await signData(p.signer, tbs);
  return seq(tbs, sigAlg, bitString(sig));
}

async function buildCsr(p: { subjectName: Uint8Array; spki: Uint8Array; signer: KeyPair; extensions: Uint8Array[] }): Promise<Uint8Array> {
  const attrs = ctx(0, true, seq(derOid(OID.extReq), setOf(seq(...p.extensions))));
  const info = seq(derInteger(0), p.subjectName, p.spki, attrs);
  const sigAlg = signatureAlgorithm(p.signer.keyType, p.signer.hash);
  const sig = await signData(p.signer, info);
  return seq(info, sigAlg, bitString(sig));
}

/* ================================== output model ================================== */

export interface GeneratedFile {
  id: string;
  name: string;
  title: string;
  description: string;
  pem: string;
  kind: 'certificate' | 'private-key' | 'csr' | 'chain';
  der?: Uint8Array;
}

export interface SummaryRow {
  label: string;
  value: string;
}

export interface ObjectSummary {
  title: string;
  rows: SummaryRow[];
  fingerprint?: string;
}

export interface GenerationResult {
  mode: Mode;
  files: GeneratedFile[];
  summaries: ObjectSummary[];
  commands: string;
  warnings: string[];
  trustNote?: string;
  elapsedMs: number;
}

/* --------------------------- decoding what we generated --------------------------- */

const DN_NAMES: Record<string, string> = { '2.5.4.3': 'CN', '2.5.4.6': 'C', '2.5.4.7': 'L', '2.5.4.8': 'ST', '2.5.4.10': 'O', '2.5.4.11': 'OU' };

function escapeRdn(s: string): string {
  return s.replace(/([\\",+;<>])/g, '\\$1').replace(/^([ #])/, '\\$1').replace(/ $/, '\\ ');
}

/** RFC 4514-style DN (most specific RDN first). */
export function dnToString(name: Tlv): string {
  return tlvChildren(name)
    .map((rdn) =>
      tlvChildren(rdn)
        .map((ava) => {
          const k = tlvChildren(ava);
          const oid = decodeOidContent(tlvContent(k[0] ?? ava));
          const v = k[1];
          return `${DN_NAMES[oid] ?? oid}=${v ? escapeRdn(utf8Decode(tlvContent(v))) : ''}`;
        })
        .join('+')
    )
    .reverse()
    .join(',');
}

const colonHex = (b: Uint8Array): string => toHex(b, ':').toUpperCase();

function describeSpki(spki: Uint8Array): string {
  const k = tlvChildren(parseSingle(spki));
  const alg = tlvChildren(k[0] ?? parseSingle(spki));
  const oid = decodeOidContent(tlvContent(alg[0] ?? parseSingle(spki)));
  if (oid === OID.rsa) {
    const rsa = tlvChildren(parseSingle(tlvContent(k[1] ?? parseSingle(spki)).subarray(1)));
    return `RSA ${bitLength(tlvContent(rsa[0] ?? parseSingle(spki)))} bit`;
  }
  if (oid === OID.ecPublicKey) {
    const c = alg[1] ? decodeOidContent(tlvContent(alg[1])) : '';
    return `EC ${oidName(c) || c}`;
  }
  return oidName(oid) || oid;
}

function generalNameText(t: Tlv): string {
  const c = tlvContent(t);
  switch (t.tag) {
    case 1:
      return `email:${utf8Decode(c)}`;
    case 2:
      return `DNS:${utf8Decode(c)}`;
    case 6:
      return `URI:${utf8Decode(c)}`;
    case 7:
      return `IP:${ipBytesToString(c)}`;
    default:
      return `[${t.tag}]:${toHex(c)}`;
  }
}

const KU_TEXT: [KuBit, string][] = [
  ['digitalSignature', 'Digital Signature'], ['nonRepudiation', 'Non Repudiation'], ['keyEncipherment', 'Key Encipherment'],
  ['dataEncipherment', 'Data Encipherment'], ['keyAgreement', 'Key Agreement'], ['keyCertSign', 'Certificate Sign'], ['cRLSign', 'CRL Sign'],
];

const EXT_LABELS: Record<string, string> = {
  [OID.bc]: 'Basic Constraints', [OID.ku]: 'Key Usage', [OID.eku]: 'Extended Key Usage', [OID.san]: 'Subject Alt. Names',
  [OID.ski]: 'Subject Key ID', [OID.aki]: 'Authority Key ID',
};

function describeExtensions(extSeq: Tlv): SummaryRow[] {
  const rows: SummaryRow[] = [];
  for (const e of tlvChildren(extSeq)) {
    const k = tlvChildren(e);
    const oid = decodeOidContent(tlvContent(k[0] ?? e));
    const critical = k[1] !== undefined && isUniv(k[1], 1) && (tlvContent(k[1])[0] ?? 0) !== 0;
    const valT = k[k.length - 1];
    if (!valT) continue;
    const v = parseSingle(tlvContent(valT));
    let text = '';
    if (oid === OID.san) text = tlvChildren(v).map(generalNameText).join(', ');
    else if (oid === OID.bc) {
      const bk = tlvChildren(v);
      const ca = bk.some((x) => isUniv(x, 1) && (tlvContent(x)[0] ?? 0) !== 0);
      const pl = bk.find((x) => isUniv(x, 2));
      text = `CA:${ca ? 'TRUE' : 'FALSE'}${pl ? `, pathlen:${bytesToBigInt(tlvContent(pl))}` : ''}`;
    } else if (oid === OID.ku) {
      const c = tlvContent(v);
      const b = c[1] ?? 0;
      text = KU_TEXT.filter((_, i) => (b & (0x80 >> i)) !== 0).map(([, t]) => t).join(', ');
    } else if (oid === OID.eku) {
      text = tlvChildren(v).map((o) => oidName(decodeOidContent(tlvContent(o))) || decodeOidContent(tlvContent(o))).join(', ');
    } else if (oid === OID.ski) text = colonHex(tlvContent(v));
    else if (oid === OID.aki) {
      const f = tlvChildren(v).find((x) => isCtx(x, 0));
      text = f ? colonHex(tlvContent(f)) : '';
    } else text = `${tlvContent(v).length} bytes`;
    rows.push({ label: `${EXT_LABELS[oid] ?? (oidName(oid) || oid)}${critical ? ' (critical)' : ''}`, value: text });
  }
  return rows;
}

function timeText(t: Tlv | undefined): string {
  if (!t) return '';
  const s = utf8Decode(tlvContent(t));
  let y: number;
  let rest: string;
  if (t.tag === 23) {
    const yy = Number(s.slice(0, 2));
    y = yy >= 50 ? 1900 + yy : 2000 + yy;
    rest = s.slice(2);
  } else {
    y = Number(s.slice(0, 4));
    rest = s.slice(4);
  }
  return `${String(y).padStart(4, '0')}-${rest.slice(0, 2)}-${rest.slice(2, 4)}T${rest.slice(4, 6)}:${rest.slice(6, 8)}:${rest.slice(8, 10)}Z`;
}

/** Re-reads the generated certificate and reports exactly what is inside it. */
export async function summarizeCertificate(der: Uint8Array, title: string): Promise<ObjectSummary> {
  const top = parseSingle(der);
  const c = tlvChildren(top);
  const tbs = tlvChildren(c[0] ?? top);
  let i = 0;
  let version = 1;
  if (isCtx(tbs[0], 0)) {
    version = Number(bytesToBigInt(tlvContent(tlvChildren(tbs[0] as Tlv)[0] ?? top))) + 1;
    i = 1;
  }
  const serial = tbs[i];
  const sigAlgOid = decodeOidContent(tlvContent(tlvChildren(c[1] ?? top)[0] ?? top));
  const issuer = tbs[i + 2];
  const validity = tlvChildren(tbs[i + 3] ?? top);
  const subject = tbs[i + 4];
  const spki = tbs[i + 5];
  const rows: SummaryRow[] = [
    { label: 'Version', value: `v${version}` },
    { label: 'Serial', value: serial ? colonHex(intMagnitude(tlvContent(serial))) : '' },
    { label: 'Signature algorithm', value: oidName(sigAlgOid) || sigAlgOid },
    { label: 'Issuer', value: issuer ? dnToString(issuer) : '' },
    { label: 'Subject', value: subject ? dnToString(subject) : '' },
    { label: 'Not before', value: timeText(validity[0]) },
    { label: 'Not after', value: timeText(validity[1]) },
    { label: 'Public key', value: spki ? describeSpki(tlvRaw(spki)) : '' },
  ];
  const ext = tbs.slice(i + 6).find((x) => isCtx(x, 3));
  const eseq = ext ? tlvChildren(ext)[0] : undefined;
  if (eseq) rows.push(...describeExtensions(eseq));
  const fp = colonHex(await digest('SHA-256', der));
  return { title, rows, fingerprint: fp };
}

export async function summarizeCsr(der: Uint8Array, title: string): Promise<ObjectSummary> {
  const top = parseSingle(der);
  const c = tlvChildren(top);
  const info = tlvChildren(c[0] ?? top);
  const sigAlgOid = decodeOidContent(tlvContent(tlvChildren(c[1] ?? top)[0] ?? top));
  const rows: SummaryRow[] = [
    { label: 'Version', value: `v${Number(bytesToBigInt(tlvContent(info[0] ?? top))) + 1}` },
    { label: 'Subject', value: info[1] ? dnToString(info[1]) : '' },
    { label: 'Public key', value: info[2] ? describeSpki(tlvRaw(info[2])) : '' },
    { label: 'Signature algorithm', value: oidName(sigAlgOid) || sigAlgOid },
  ];
  const attr = info[3];
  if (attr) {
    for (const a of tlvChildren(attr)) {
      const ak = tlvChildren(a);
      const oid = decodeOidContent(tlvContent(ak[0] ?? a));
      if (oid === OID.extReq) {
        const eseq = ak[1] ? tlvChildren(ak[1])[0] : undefined;
        if (eseq) rows.push(...describeExtensions(eseq).map((r) => ({ label: `Requested: ${r.label}`, value: r.value })));
      }
    }
  }
  return { title, rows, fingerprint: colonHex(await digest('SHA-256', der)) };
}

/* ================================ openssl commands ================================ */

function shq(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function subjSlash(dn: DnInput): string {
  const esc = (v: string) => v.replace(/([\\/])/g, '\\$1');
  const parts: string[] = [];
  if (dn.c) parts.push(`C=${esc(dn.c)}`);
  if (dn.st) parts.push(`ST=${esc(dn.st)}`);
  if (dn.l) parts.push(`L=${esc(dn.l)}`);
  if (dn.o) parts.push(`O=${esc(dn.o)}`);
  if (dn.ou) parts.push(`OU=${esc(dn.ou)}`);
  if (dn.cn) parts.push(`CN=${esc(dn.cn)}`);
  return `/${parts.join('/')}`;
}

function newKeyArg(kt: KeyType): string {
  if (kt === 'ec-p256') return '-newkey ec -pkeyopt ec_paramgen_curve:prime256v1';
  if (kt === 'ec-p384') return '-newkey ec -pkeyopt ec_paramgen_curve:secp384r1';
  if (kt === 'ec-p521') return '-newkey ec -pkeyopt ec_paramgen_curve:secp521r1';
  if (kt === 'ed25519') return '-newkey ed25519';
  return `-newkey rsa:${kt.slice(4)}`;
}

function extLines(opts: GenOptions, v: Validation): string[] {
  const out: string[] = [];
  const isCa = opts.profile === 'ca';
  out.push(`basicConstraints=critical,${isCa ? `CA:TRUE${opts.pathLen !== null ? `,pathlen:${opts.pathLen}` : ''}` : 'CA:FALSE'}`);
  const ku = kuForProfile(opts.profile, opts.keyType);
  out.push(`keyUsage=critical,${ku.join(',')}`);
  if (!isCa && opts.eku.length) out.push(`extendedKeyUsage=${opts.eku.join(',')}`);
  if (v.sans.length) {
    const t: Record<SanEntry['type'], string> = { dns: 'DNS', ip: 'IP', email: 'email', uri: 'URI' };
    out.push(`subjectAltName=${v.sans.map((s) => `${t[s.type]}:${s.value}`).join(',')}`);
  }
  return out;
}

function buildCommands(opts: GenOptions, v: Validation, names: { cert: string; key: string; csr: string; ca: string; caKey: string }): string {
  const hashFlag = opts.keyType === 'ed25519' ? '' : ` -${opts.hash.toLowerCase().replace('-', '')}`;
  const lines: string[] = [];
  const addexts = (exts: string[]) => exts.map((e) => `  -addext ${shq(e)}`);
  if (opts.mode === 'self-signed') {
    lines.push('# self-signed certificate + private key');
    lines.push(
      [`openssl req -x509 ${newKeyArg(opts.keyType)} -nodes${hashFlag} \\`, `  -keyout ${names.key} -out ${names.cert} -days ${opts.days} \\`, `  -subj ${shq(subjSlash(v.dn))} \\`, ...addexts(extLines(opts, v)).map((l, i, a) => (i < a.length - 1 ? `${l} \\` : l))].join('\n')
    );
  } else if (opts.mode === 'csr') {
    lines.push('# certificate signing request + private key');
    lines.push(
      [`openssl req -new ${newKeyArg(opts.keyType)} -nodes${hashFlag} \\`, `  -keyout ${names.key} -out ${names.csr} \\`, `  -subj ${shq(subjSlash(v.dn))} \\`, ...addexts(extLines(opts, v)).map((l, i, a) => (i < a.length - 1 ? `${l} \\` : l))].join('\n')
    );
    lines.push('', '# verify the request', `openssl req -in ${names.csr} -noout -verify -text`);
  } else {
    const caDn: DnInput = { ...v.dn, cn: opts.caCn.trim(), ou: '' };
    const caOpts: GenOptions = { ...opts, profile: 'ca', keyType: opts.keyType };
    lines.push('# 1) local CA (root) certificate + key');
    lines.push(
      [`openssl req -x509 ${newKeyArg(opts.keyType)} -nodes${hashFlag} \\`, `  -keyout ${names.caKey} -out ${names.ca} -days ${opts.caDays} \\`, `  -subj ${shq(subjSlash(caDn))} \\`, ...addexts(extLines(caOpts, { ...v, sans: [] })).map((l, i, a) => (i < a.length - 1 ? `${l} \\` : l))].join('\n')
    );
    lines.push('', '# 2) leaf key + CSR');
    lines.push([`openssl req -new ${newKeyArg(opts.keyType)} -nodes${hashFlag} \\`, `  -keyout ${names.key} -out ${names.csr} \\`, `  -subj ${shq(subjSlash(v.dn))}`].join('\n'));
    lines.push('', '# 3) sign the CSR with the CA');
    const ext = extLines(opts, v);
    lines.push(`printf '%s\\n' ${ext.map(shq).join(' ')} > leaf.ext`);
    lines.push(`openssl x509 -req -in ${names.csr} -CA ${names.ca} -CAkey ${names.caKey} -CAcreateserial \\\n  -out ${names.cert} -days ${opts.days}${hashFlag} -extfile leaf.ext`);
    lines.push('', '# 4) chain + verify', `cat ${names.cert} ${names.ca} > fullchain.pem`, `openssl verify -CAfile ${names.ca} ${names.cert}`);
  }
  return lines.join('\n');
}

/* ================================= orchestration ================================= */

function baseName(cn: string): string {
  const t = cn.trim().toLowerCase().replace(/^\*\./, '_wildcard.').replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return t || 'certificate';
}

const PROFILE_TITLES: Record<Profile, string> = {
  'tls-server': 'TLS server',
  'tls-client': 'TLS client',
  ca: 'CA',
  'code-signing': 'code signing',
};

export async function generate(opts: GenOptions): Promise<GenerationResult> {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const v = validateOptions(opts);
  if (v.errors.length > 0) throw new Error(v.errors[0]);
  const now = secs(opts.now ?? new Date());
  const notBefore = new Date(now.getTime() - 60_000);
  const files: GeneratedFile[] = [];
  const summaries: ObjectSummary[] = [];
  const stem = baseName(v.dn.cn);
  const names = {
    cert: opts.mode === 'ca-leaf' ? `${stem}.pem` : 'cert.pem',
    key: opts.mode === 'ca-leaf' ? `${stem}-key.pem` : 'key.pem',
    csr: 'csr.pem',
    ca: 'ca.pem',
    caKey: 'ca-key.pem',
  };
  const keyFile = (kp: KeyPair, name: string, title: string, description: string): GeneratedFile => ({
    id: name, name, title, description, pem: toPem(kp.pkcs8, 'PRIVATE KEY'), kind: 'private-key', der: kp.pkcs8,
  });
  const profLabel = PROFILE_TITLES[opts.profile];
  const warnings = [...v.warnings];
  let trustNote: string | undefined;

  const kp = await generateKeyPair(opts.keyType, opts.hash);
  const subjectName = buildName(v.dn);

  if (opts.mode === 'self-signed') {
    const ski = await subjectKeyId(kp.spki);
    const cert = await buildCertificate({
      subjectName, issuerName: subjectName, spki: kp.spki, signer: kp, notBefore, notAfter: new Date(now.getTime() + opts.days * 86400_000),
      extensions: extensionList(opts, v, ski, ski),
    });
    files.push({ id: 'cert', name: names.cert, title: 'Certificate', description: `Self-signed ${profLabel} certificate (PEM)`, pem: toPem(cert, 'CERTIFICATE'), kind: 'certificate', der: cert });
    files.push(keyFile(kp, names.key, 'Private key', 'PKCS#8 private key (PEM) - keep it secret'));
    summaries.push(await summarizeCertificate(cert, 'Certificate'));
    trustNote = opts.profile === 'ca'
      ? "Browsers and operating systems won't trust this CA until you import it into their trust store (keychain / certificate manager / NSS)."
      : "Browsers won't trust a self-signed certificate until you install and trust it (or the CA that signed it). Expect a warning page otherwise.";
  } else if (opts.mode === 'csr') {
    const csr = await buildCsr({ subjectName, spki: kp.spki, signer: kp, extensions: extensionList(opts, v, undefined, undefined, true) });
    files.push({ id: 'csr', name: names.csr, title: 'Certificate signing request', description: 'PKCS#10 CSR (PEM) to send to a CA', pem: toPem(csr, 'CERTIFICATE REQUEST'), kind: 'csr', der: csr });
    files.push(keyFile(kp, names.key, 'Private key', 'PKCS#8 private key (PEM) - keep it secret, never send it to the CA'));
    summaries.push(await summarizeCsr(csr, 'Certificate signing request'));
  } else {
    const caKp = await generateKeyPair(opts.keyType, opts.hash);
    const caDn: DnInput = { ...v.dn, cn: opts.caCn.trim(), ou: '' };
    const caName = buildName(caDn);
    const caSki = await subjectKeyId(caKp.spki);
    const caNotAfter = new Date(now.getTime() + opts.caDays * 86400_000);
    const caOpts: GenOptions = { ...opts, profile: 'ca', eku: [] };
    const caVal: Validation = { ...v, sans: [] };
    const caCert = await buildCertificate({
      subjectName: caName, issuerName: caName, spki: caKp.spki, signer: caKp, notBefore, notAfter: caNotAfter,
      extensions: extensionList(caOpts, caVal, caSki, caSki),
    });
    const leafSki = await subjectKeyId(kp.spki);
    const leaf = await buildCertificate({
      subjectName, issuerName: caName, spki: kp.spki, signer: caKp, notBefore, notAfter: new Date(now.getTime() + opts.days * 86400_000),
      extensions: extensionList(opts, v, leafSki, caSki),
    });
    const leafPem = toPem(leaf, 'CERTIFICATE');
    const caPem = toPem(caCert, 'CERTIFICATE');
    files.push({ id: 'cert', name: names.cert, title: 'Leaf certificate', description: `${profLabel} certificate signed by your local CA (PEM)`, pem: leafPem, kind: 'certificate', der: leaf });
    files.push(keyFile(kp, names.key, 'Leaf private key', 'PKCS#8 private key for the leaf certificate (PEM)'));
    files.push({ id: 'ca', name: names.ca, title: 'CA certificate', description: 'Root certificate: import this into browsers / OS trust stores', pem: caPem, kind: 'certificate', der: caCert });
    files.push(keyFile(caKp, names.caKey, 'CA private key', 'PKCS#8 private key of the CA - anyone holding it can mint certificates your devices trust'));
    files.push({ id: 'fullchain', name: 'fullchain.pem', title: 'Full chain', description: 'Leaf certificate followed by the CA certificate (what most servers want)', pem: leafPem + caPem, kind: 'chain' });
    summaries.push(await summarizeCertificate(leaf, 'Leaf certificate'));
    summaries.push(await summarizeCertificate(caCert, 'CA certificate'));
    trustNote = "Browsers won't trust the leaf certificate until the CA certificate (ca.pem) is installed in the trust store of every device or browser that should accept it. Keep ca-key.pem private - delete it if you only needed one leaf.";
  }

  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    mode: opts.mode,
    files,
    summaries,
    commands: buildCommands(opts, v, names),
    warnings,
    trustNote,
    elapsedMs: Math.round(t1 - t0),
  };
}

/** Verifies a generated chain in-process via WebCrypto (used by the UI for the "signature verified" badge and by tests). */
export async function verifyCertSignature(certDer: Uint8Array, issuerSpki: Uint8Array): Promise<boolean> {
  const top = parseSingle(certDer);
  const c = tlvChildren(top);
  const tbsT = c[0];
  const sigAlg = tlvChildren(c[1] ?? top);
  const bits = c[2];
  if (!tbsT || !bits) return false;
  const oid = decodeOidContent(tlvContent(sigAlg[0] ?? top));
  const sig = tlvContent(bits).subarray(1);
  const data = tlvRaw(tbsT);
  const spki = tlvChildren(parseSingle(issuerSpki));
  const keyAlg = tlvChildren(spki[0] ?? top);
  const keyOid = decodeOidContent(tlvContent(keyAlg[0] ?? top));
  const hashOf = (o: string): HashAlg => (o.endsWith('.2') || o.endsWith('.11') ? 'SHA-256' : o.endsWith('.3') || o.endsWith('.12') ? 'SHA-384' : 'SHA-512');
  try {
    if (keyOid === OID.rsa) {
      const hash = hashOf(oid);
      const key = await wc.subtle.importKey('spki', bs(issuerSpki), { name: 'RSASSA-PKCS1-v1_5', hash }, false, ['verify']);
      return await wc.subtle.verify('RSASSA-PKCS1-v1_5', key, bs(sig), bs(data));
    }
    if (keyOid === OID.ecPublicKey) {
      const curveOid = keyAlg[1] ? decodeOidContent(tlvContent(keyAlg[1])) : '';
      const curve = curveOid === '1.2.840.10045.3.1.7' ? 'P-256' : curveOid === '1.3.132.0.34' ? 'P-384' : 'P-521';
      const size = curve === 'P-256' ? 32 : curve === 'P-384' ? 48 : 66;
      const key = await wc.subtle.importKey('spki', bs(issuerSpki), { name: 'ECDSA', namedCurve: curve }, false, ['verify']);
      return await wc.subtle.verify({ name: 'ECDSA', hash: hashOf(oid) }, key, bs(ecdsaDerToRaw(sig, size)), bs(data));
    }
    if (keyOid === OID.ed25519) {
      const key = await wc.subtle.importKey('spki', bs(issuerSpki), { name: 'Ed25519' }, false, ['verify']);
      return await wc.subtle.verify({ name: 'Ed25519' }, key, bs(sig), bs(data));
    }
  } catch {
    return false;
  }
  return false;
}
