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
/* ------------------------- tolerant PEM parsing ------------------------- */

export interface PemBlock {
  label: string;
  /** DER (or ciphertext, when `legacyEncrypted`) bytes; empty when the body is not valid Base64. */
  der: Uint8Array;
  /** RFC 1421 "Proc-Type: 4,ENCRYPTED" header present. */
  legacyEncrypted: boolean;
  dekInfo?: { cipher: string; iv: string };
  /** Set when the Base64 body could not be decoded. */
  error?: string;
  /** Raw text between the BEGIN and END lines (headers included). */
  body: string;
  /** Label found on the END line (empty when identical to the BEGIN label). */
  endLabel: string;
}

/**
 * Finds every `-----BEGIN X-----` … `-----END X-----` block. Tolerant of CRLF, spaces
 * instead of newlines, missing wrapping, and of RFC 1421 encapsulation headers.
 */
export function parsePemBlocks(text: string): PemBlock[] {
  const out: PemBlock[] = [];
  const re = /-----BEGIN ([^-\r\n]+?)-----([\s\S]*?)-----END ([^-\r\n]+?)-----/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const label = (m[1] ?? '').trim().toUpperCase();
    let body = m[2] ?? '';
    let legacyEncrypted = false;
    let dekInfo: { cipher: string; iv: string } | undefined;
    const proc = /Proc-Type:\s*\d+\s*,\s*([A-Z-]+)/i.exec(body);
    if (proc) {
      legacyEncrypted = /ENCRYPTED/i.test(proc[1] ?? '');
      body = body.replace(proc[0], ' ');
    }
    const dek = /DEK-Info:\s*([A-Za-z0-9-]+)\s*,\s*([0-9A-Fa-f]+)/i.exec(body);
    if (dek) {
      dekInfo = { cipher: (dek[1] ?? '').toUpperCase(), iv: (dek[2] ?? '').toUpperCase() };
      body = body.replace(dek[0], ' ');
    }
    body = body.replace(/^[ \t]*[A-Za-z][A-Za-z0-9-]*:[^\r\n]*$/gm, ' ');
    const b64 = body.replace(/\s+/g, '');
    let der: Uint8Array = new Uint8Array(0);
    let error: string | undefined;
    if (b64.length === 0) error = 'The block has no Base64 content.';
    else {
      try {
        der = b64Decode(b64);
      } catch {
        error = 'The block body is not valid Base64.';
      }
    }
    const endLabel = (m[3] ?? '').trim().toUpperCase();
    out.push({ label, der, legacyEncrypted, dekInfo, error, body: m[2] ?? '', endLabel: endLabel === label ? '' : endLabel });
  }
  return out;
}

/* ------------------------------- OID names ------------------------------- */

const OID_NAMES: Record<string, string> = parseOidTable(`
1.2.840.113549.1.1.1 rsaEncryption
1.2.840.113549.1.1.10 rsassaPss
1.2.840.10045.2.1 ecPublicKey
1.3.101.110 X25519
1.3.101.111 X448
1.3.101.112 Ed25519
1.3.101.113 Ed448
1.2.840.10040.4.1 dsa
1.2.840.113549.1.5.12 pbkdf2
1.2.840.113549.1.5.13 pbes2
1.3.6.1.4.1.11591.4.11 scrypt
1.2.840.113549.1.5.3 pbeWithMD5AndDES-CBC
1.2.840.113549.1.5.10 pbeWithSHA1AndDES-CBC
1.2.840.113549.1.12.1.3 pbeWithSHAAnd3-KeyTripleDES-CBC
1.2.840.113549.1.12.1.6 pbeWithSHAAnd40BitRC2-CBC
1.2.840.113549.2.7 hmacWithSHA1
1.2.840.113549.2.8 hmacWithSHA224
1.2.840.113549.2.9 hmacWithSHA256
1.2.840.113549.2.10 hmacWithSHA384
1.2.840.113549.2.11 hmacWithSHA512
1.2.840.113549.3.7 des-ede3-cbc
1.3.14.3.2.7 des-cbc
2.16.840.1.101.3.4.1.2 aes128-CBC
2.16.840.1.101.3.4.1.22 aes192-CBC
2.16.840.1.101.3.4.1.42 aes256-CBC
2.16.840.1.101.3.4.1.6 aes128-GCM
2.16.840.1.101.3.4.1.46 aes256-GCM
1.2.840.10045.3.1.1 prime192v1
1.2.840.10045.3.1.7 prime256v1 (P-256)
1.3.132.0.10 secp256k1
1.3.132.0.33 secp224r1 (P-224)
1.3.132.0.34 secp384r1 (P-384)
1.3.132.0.35 secp521r1 (P-521)
1.3.36.3.3.2.8.1.1.7 brainpoolP256r1
1.3.36.3.3.2.8.1.1.11 brainpoolP384r1
1.3.36.3.3.2.8.1.1.13 brainpoolP512r1
`);

export function oidName(oid: string): string {
  return OID_NAMES[oid] ?? '';
}

/* =========================== MD5 (for legacy PEM + modulus hash) =========================== */

const MD5_S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
const MD5_K: number[] = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0);

/** MD5 digest (WebCrypto has no MD5; needed for OpenSSL's legacy key derivation and `openssl md5` parity). */
export function md5(data: Uint8Array): Uint8Array {
  const len = data.length;
  const total = (((len + 8) >> 6) + 1) << 6;
  const buf = new Uint8Array(total);
  buf.set(data);
  buf[len] = 0x80;
  const bitLen = len * 8;
  const dv = new DataView(buf.buffer);
  dv.setUint32(total - 8, bitLen >>> 0, true);
  dv.setUint32(total - 4, Math.floor(bitLen / 4294967296), true);
  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;
  const M = new Uint32Array(16);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) M[i] = dv.getUint32(off + i * 4, true);
    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;
    for (let i = 0; i < 64; i++) {
      let F: number;
      let g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + (MD5_K[i] ?? 0) + (M[g] ?? 0)) >>> 0;
      A = D;
      D = C;
      C = B;
      const s = MD5_S[i] ?? 0;
      B = (B + ((F << s) | (F >>> (32 - s)))) >>> 0;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }
  const out = new Uint8Array(16);
  const odv = new DataView(out.buffer);
  odv.setUint32(0, a0, true);
  odv.setUint32(4, b0, true);
  odv.setUint32(8, c0, true);
  odv.setUint32(12, d0, true);
  return out;
}

/* ================================== curves ================================== */

export interface CurveInfo {
  name: string;
  oid: string;
  /** Field size in bytes. */
  size: number;
  /** WebCrypto / JWK curve name when supported. */
  jwk?: 'P-256' | 'P-384' | 'P-521';
  /** JWK `crv` value (includes secp256k1, which WebCrypto cannot use). */
  crv?: string;
  /** OpenSSH curve identifier. */
  ssh?: string;
}

export const CURVES: CurveInfo[] = [
  { name: 'P-256 (prime256v1)', oid: '1.2.840.10045.3.1.7', size: 32, jwk: 'P-256', crv: 'P-256', ssh: 'nistp256' },
  { name: 'P-384 (secp384r1)', oid: '1.3.132.0.34', size: 48, jwk: 'P-384', crv: 'P-384', ssh: 'nistp384' },
  { name: 'P-521 (secp521r1)', oid: '1.3.132.0.35', size: 66, jwk: 'P-521', crv: 'P-521', ssh: 'nistp521' },
  { name: 'secp256k1', oid: '1.3.132.0.10', size: 32, crv: 'secp256k1' },
  { name: 'P-224 (secp224r1)', oid: '1.3.132.0.33', size: 28 },
  { name: 'P-192 (prime192v1)', oid: '1.2.840.10045.3.1.1', size: 24 },
  { name: 'brainpoolP256r1', oid: '1.3.36.3.3.2.8.1.1.7', size: 32 },
  { name: 'brainpoolP384r1', oid: '1.3.36.3.3.2.8.1.1.11', size: 48 },
  { name: 'brainpoolP512r1', oid: '1.3.36.3.3.2.8.1.1.13', size: 64 },
];

export function curveByOid(oid: string): CurveInfo | undefined {
  return CURVES.find((c) => c.oid === oid);
}

/* ============================ key material model ============================ */

export type KeyAlg = 'rsa' | 'ec' | 'ed25519' | 'ed448' | 'x25519' | 'x448' | 'unknown';

export interface KeyMaterial {
  alg: KeyAlg;
  isPrivate: boolean;
  rsa?: {
    n: Uint8Array;
    e: Uint8Array;
    d?: Uint8Array;
    p?: Uint8Array;
    q?: Uint8Array;
    dp?: Uint8Array;
    dq?: Uint8Array;
    qi?: Uint8Array;
    /** Original PKCS#1 RSAPrivateKey DER when known (kept so conversions stay byte-exact). */
    pkcs1?: Uint8Array;
  };
  ec?: { curveOid: string; curve?: CurveInfo; point?: Uint8Array; d?: Uint8Array };
  okp?: { pub?: Uint8Array; priv?: Uint8Array };
  /** Algorithm OID for algorithms we do not model (kept for error messages). */
  algOid?: string;
}

export const ALG_OIDS: Record<string, KeyAlg> = {
  '1.2.840.113549.1.1.1': 'rsa',
  '1.2.840.10045.2.1': 'ec',
  '1.3.101.112': 'ed25519',
  '1.3.101.113': 'ed448',
  '1.3.101.110': 'x25519',
  '1.3.101.111': 'x448',
};
const OKP_OIDS: Record<string, string> = {
  ed25519: '1.3.101.112',
  ed448: '1.3.101.113',
  x25519: '1.3.101.110',
  x448: '1.3.101.111',
};

const RSA_OID = '1.2.840.113549.1.1.1';
const EC_OID = '1.2.840.10045.2.1';

function need<T>(v: T | undefined, what: string): T {
  if (v === undefined) throw new Error(`Malformed structure: missing ${what}`);
  return v;
}

function oidOf(t: Tlv | undefined): string {
  if (!isUniv(t, 6)) throw new Error('Malformed structure: expected an OBJECT IDENTIFIER');
  return decodeOidContent(tlvContent(t));
}

const mag = (t: Tlv | undefined, what: string): Uint8Array => {
  if (!isUniv(t, 2)) throw new Error(`Malformed structure: ${what} is not an INTEGER`);
  return intMagnitude(tlvContent(t)).slice();
};

/* --------------------------- DER → KeyMaterial --------------------------- */

export function parsePkcs1Private(der: Uint8Array): KeyMaterial {
  const k = tlvChildren(parseSingle(der));
  if (k.length < 9) throw new Error('RSAPrivateKey must contain 9 INTEGERs');
  return {
    alg: 'rsa',
    isPrivate: true,
    rsa: {
      n: mag(k[1], 'modulus'), e: mag(k[2], 'publicExponent'), d: mag(k[3], 'privateExponent'),
      p: mag(k[4], 'prime1'), q: mag(k[5], 'prime2'), dp: mag(k[6], 'exponent1'), dq: mag(k[7], 'exponent2'),
      qi: mag(k[8], 'coefficient'), pkcs1: der,
    },
  };
}

export function parsePkcs1Public(der: Uint8Array): KeyMaterial {
  const k = tlvChildren(parseSingle(der));
  return { alg: 'rsa', isPrivate: false, rsa: { n: mag(k[0], 'modulus'), e: mag(k[1], 'publicExponent') } };
}

export function parseSec1(der: Uint8Array, algCurveOid?: string): KeyMaterial {
  const k = tlvChildren(parseSingle(der));
  if (!isUniv(k[1], 4)) throw new Error('ECPrivateKey: missing privateKey OCTET STRING');
  let curveOid = algCurveOid ?? '';
  let point: Uint8Array | undefined;
  for (const f of k.slice(2)) {
    if (isCtx(f, 0)) {
      const o = tlvChildren(f)[0];
      if (o && isUniv(o, 6)) curveOid = decodeOidContent(tlvContent(o));
    } else if (isCtx(f, 1)) {
      const b = tlvChildren(f)[0];
      if (b && isUniv(b, 3)) point = tlvContent(b).slice(1);
    }
  }
  if (!curveOid) throw new Error('ECPrivateKey has no curve parameters (and no enclosing PKCS#8 to supply them)');
  return { alg: 'ec', isPrivate: true, ec: { curveOid, curve: curveByOid(curveOid), point, d: tlvContent(k[1]).slice() } };
}

/** Splits SubjectPublicKeyInfo into (alg OID, parameters, key bits). */
function splitSpki(spki: Tlv): { algOid: string; params: Tlv | undefined; key: Uint8Array } {
  const k = tlvChildren(spki);
  const alg = tlvChildren(need(k[0], 'algorithm'));
  const bits = need(k[1], 'subjectPublicKey');
  if (!isUniv(bits, 3)) throw new Error('Malformed SubjectPublicKeyInfo: key is not a BIT STRING');
  return { algOid: oidOf(alg[0]), params: alg[1], key: tlvContent(bits).slice(1) };
}

export function parseSpki(der: Uint8Array): KeyMaterial {
  const { algOid, params, key } = splitSpki(parseSingle(der));
  const alg = ALG_OIDS[algOid];
  if (alg === 'rsa') {
    const m = parsePkcs1Public(key);
    return m;
  }
  if (alg === 'ec') {
    const curveOid = params && isUniv(params, 6) ? decodeOidContent(tlvContent(params)) : '';
    if (!curveOid) throw new Error('EC public key without named-curve parameters is not supported');
    return { alg: 'ec', isPrivate: false, ec: { curveOid, curve: curveByOid(curveOid), point: key } };
  }
  if (alg === 'ed25519' || alg === 'ed448' || alg === 'x25519' || alg === 'x448') {
    return { alg, isPrivate: false, okp: { pub: key } };
  }
  return { alg: 'unknown', isPrivate: false, algOid };
}

export function parsePkcs8(der: Uint8Array): KeyMaterial {
  const k = tlvChildren(parseSingle(der));
  const algId = tlvChildren(need(k[1], 'privateKeyAlgorithm'));
  const algOid = oidOf(algId[0]);
  const inner = tlvContent(need(k[2], 'privateKey'));
  const alg = ALG_OIDS[algOid];
  if (alg === 'rsa') return parsePkcs1Private(inner);
  if (alg === 'ec') {
    const p = algId[1];
    return parseSec1(inner, p && isUniv(p, 6) ? decodeOidContent(tlvContent(p)) : undefined);
  }
  if (alg === 'ed25519' || alg === 'ed448' || alg === 'x25519' || alg === 'x448') {
    const t = parseSingle(inner);
    if (!isUniv(t, 4)) throw new Error('Expected CurvePrivateKey OCTET STRING');
    let pub: Uint8Array | undefined;
    for (const f of k.slice(3)) if (isCtx(f, 1)) pub = tlvContent(f).slice(1);
    return { alg, isPrivate: true, okp: { priv: tlvContent(t).slice(), pub } };
  }
  return { alg: 'unknown', isPrivate: true, algOid };
}

/* ------------------------------ DER builders ------------------------------ */

const RSA_ALG_ID = (): Uint8Array => seq(derOid(RSA_OID), derNull());

export function buildPkcs1Public(n: Uint8Array, e: Uint8Array): Uint8Array {
  return seq(derInteger(n), derInteger(e));
}

export function buildPkcs1Private(r: NonNullable<KeyMaterial['rsa']>): Uint8Array {
  if (r.pkcs1) return r.pkcs1;
  const z = (x: Uint8Array | undefined, what: string): Uint8Array => {
    if (!x) throw new Error(`The RSA private key has no ${what} - PKCS#1/PKCS#8 need all CRT parameters (p, q, dP, dQ, qInv); a JWK with only n, e and d cannot be converted.`);
    return derInteger(x);
  };
  return seq(derInteger(0), derInteger(r.n), derInteger(r.e), z(r.d, 'd'), z(r.p, 'p'), z(r.q, 'q'), z(r.dp, 'dP'), z(r.dq, 'dQ'), z(r.qi, 'qInv'));
}

export function spkiFromParts(algId: Uint8Array, keyBits: Uint8Array): Uint8Array {
  return seq(algId, bitString(keyBits));
}

/** Canonical SubjectPublicKeyInfo for public material (RSA/EC/OKP). */
export function buildSpki(m: KeyMaterial): Uint8Array {
  if (m.alg === 'rsa' && m.rsa) return spkiFromParts(RSA_ALG_ID(), buildPkcs1Public(m.rsa.n, m.rsa.e));
  if (m.alg === 'ec' && m.ec?.point) return spkiFromParts(seq(derOid(EC_OID), derOid(m.ec.curveOid)), m.ec.point);
  const oid = OKP_OIDS[m.alg];
  if (oid && m.okp?.pub) return spkiFromParts(seq(derOid(oid)), m.okp.pub);
  throw new Error('This key has no public part that can be encoded');
}

/** ECPrivateKey (RFC 5915). `withParams` adds [0] namedCurve (the classic "EC PRIVATE KEY" form). */
export function buildSec1(m: KeyMaterial, withParams: boolean): Uint8Array {
  const ec = m.ec;
  if (!ec?.d) throw new Error('No EC private scalar available');
  const parts: Uint8Array[] = [derInteger(1), octetString(ec.d)];
  if (withParams) parts.push(ctx(0, true, derOid(ec.curveOid)));
  if (ec.point) parts.push(ctx(1, true, bitString(ec.point)));
  return seq(...parts);
}

export function buildPkcs8(m: KeyMaterial): Uint8Array {
  if (m.alg === 'rsa' && m.rsa) return seq(derInteger(0), RSA_ALG_ID(), octetString(buildPkcs1Private(m.rsa)));
  if (m.alg === 'ec' && m.ec) {
    return seq(derInteger(0), seq(derOid(EC_OID), derOid(m.ec.curveOid)), octetString(buildSec1(m, false)));
  }
  const oid = OKP_OIDS[m.alg];
  if (oid && m.okp?.priv) return seq(derInteger(0), seq(derOid(oid)), octetString(octetString(m.okp.priv)));
  throw new Error('Cannot encode this key as PKCS#8');
}

/* ============================== input parsing ============================== */

export type ItemFormat =
  | 'rsa-private' | 'rsa-public' | 'pkcs8' | 'pkcs8-encrypted' | 'ec-private' | 'spki'
  | 'certificate' | 'csr' | 'openssh-public' | 'openssh-private' | 'legacy-encrypted' | 'jwk' | 'unknown';

export interface ParsedItem {
  format: ItemFormat;
  /** Normalised PEM label found in the input ('' if none). */
  label: string;
  /** DER bytes (ciphertext for `legacy-encrypted`). */
  der: Uint8Array;
  sourceFormat: 'pem' | 'base64' | 'hex' | 'binary' | 'openssh';
  /** Things the parser fixed or tolerated (shown to the user). */
  repairs: string[];
  legacy?: { cipher: string; iv: string };
  /** Pre-parsed key (OpenSSH inputs). */
  material?: KeyMaterial;
  comment?: string;
}

export interface ParseResult {
  items: ParsedItem[];
  sourceFormat: ParsedItem['sourceFormat'];
  warnings: string[];
}

export const FORMAT_LABELS: Record<ItemFormat, string> = {
  'rsa-private': 'RSA private key (PKCS#1)',
  'rsa-public': 'RSA public key (PKCS#1)',
  pkcs8: 'Private key (PKCS#8)',
  'pkcs8-encrypted': 'Encrypted private key (PKCS#8)',
  'ec-private': 'EC private key (SEC1)',
  spki: 'Public key (SPKI)',
  certificate: 'X.509 certificate',
  csr: 'Certificate request (PKCS#10)',
  'openssh-public': 'OpenSSH public key',
  'openssh-private': 'OpenSSH private key',
  'legacy-encrypted': 'Encrypted private key (legacy PEM)',
  jwk: 'JSON Web Key (JWK)',
  unknown: 'Unknown',
};

/** Structural classification of a DER blob. */
export function classifyDer(der: Uint8Array): ItemFormat {
  try {
    const top = readTlv(der, 0);
    if (!isUniv(top, 16) || top.end !== der.length) return 'unknown';
    const k = tlvChildren(top);
    const isInt = (t: Tlv | undefined) => isUniv(t, 2);
    if (k.length === 3 && isUniv(k[0], 16) && isUniv(k[1], 16) && isUniv(k[2], 3)) {
      const t = tlvChildren(k[0] as Tlv);
      if (t.length === 4 && isInt(t[0]) && isUniv(t[1], 16) && isUniv(t[2], 16) && isCtx(t[3], 0)) return 'csr';
      if (t.length >= 6) return 'certificate';
    }
    if (k.length >= 9 && k.every(isInt)) return 'rsa-private';
    if (k.length === 2 && isInt(k[0]) && isInt(k[1])) return 'rsa-public';
    if (k.length === 2 && isUniv(k[0], 16) && isUniv(k[1], 4) && isUniv(tlvChildren(k[0] as Tlv)[0], 6)) return 'pkcs8-encrypted';
    if (k.length >= 3 && isInt(k[0]) && isUniv(k[1], 16) && isUniv(k[2], 4)) return 'pkcs8';
    if (k.length >= 2 && isInt(k[0]) && isUniv(k[1], 4)) return 'ec-private';
    if (k.length === 2 && isUniv(k[0], 16) && isUniv(k[1], 3)) return 'spki';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

const LABEL_FOR: Record<ItemFormat, string> = {
  'rsa-private': 'RSA PRIVATE KEY',
  'rsa-public': 'RSA PUBLIC KEY',
  pkcs8: 'PRIVATE KEY',
  'pkcs8-encrypted': 'ENCRYPTED PRIVATE KEY',
  'ec-private': 'EC PRIVATE KEY',
  spki: 'PUBLIC KEY',
  certificate: 'CERTIFICATE',
  csr: 'CERTIFICATE REQUEST',
  'openssh-public': 'PUBLIC KEY',
  'openssh-private': 'OPENSSH PRIVATE KEY',
  'legacy-encrypted': 'RSA PRIVATE KEY',
  jwk: 'JWK',
  unknown: 'DATA',
};
export const pemLabelFor = (f: ItemFormat): string => LABEL_FOR[f];

const KNOWN_LABELS = new Set([
  'RSA PRIVATE KEY', 'RSA PUBLIC KEY', 'PRIVATE KEY', 'ENCRYPTED PRIVATE KEY', 'EC PRIVATE KEY', 'PUBLIC KEY',
  'CERTIFICATE', 'TRUSTED CERTIFICATE', 'X509 CERTIFICATE', 'CERTIFICATE REQUEST', 'NEW CERTIFICATE REQUEST', 'OPENSSH PRIVATE KEY',
  'DSA PRIVATE KEY', 'EC PARAMETERS',
]);

/* ---------------------------- SSH wire helpers ---------------------------- */

class SshReader {
  pos = 0;
  constructor(private b: Uint8Array) {}
  u32(): number {
    if (this.pos + 4 > this.b.length) throw new Error('Truncated OpenSSH data');
    const v = ((this.b[this.pos] ?? 0) * 16777216) + (((this.b[this.pos + 1] ?? 0) << 16) | ((this.b[this.pos + 2] ?? 0) << 8) | (this.b[this.pos + 3] ?? 0));
    this.pos += 4;
    return v;
  }
  string(): Uint8Array {
    const n = this.u32();
    if (this.pos + n > this.b.length) throw new Error('Truncated OpenSSH data');
    const out = this.b.slice(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }
  text(): string {
    return utf8Decode(this.string());
  }
  mpint(): Uint8Array {
    return intMagnitude(this.string()).slice();
  }
  raw(n: number): Uint8Array {
    if (this.pos + n > this.b.length) throw new Error('Truncated OpenSSH data');
    const out = this.b.slice(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }
}

function sshString(b: Uint8Array): Uint8Array {
  const l = new Uint8Array(4);
  new DataView(l.buffer).setUint32(0, b.length);
  return concatBytes(l, b);
}
const sshText = (s: string): Uint8Array => sshString(utf8Encode(s));
function sshMpint(magnitude: Uint8Array): Uint8Array {
  const m = intMagnitude(magnitude);
  const body = m.length === 0 || (m.length === 1 && m[0] === 0) ? new Uint8Array(0) : ((m[0] ?? 0) & 0x80) !== 0 ? concatBytes(Uint8Array.of(0), m) : m;
  return sshString(body);
}

/** Decodes an OpenSSH public key blob (the Base64 part of an `ssh-...` line). */
export function parseSshPublicBlob(blob: Uint8Array): KeyMaterial {
  const r = new SshReader(blob);
  const type = r.text();
  if (type === 'ssh-rsa') {
    const e = r.mpint();
    const n = r.mpint();
    return { alg: 'rsa', isPrivate: false, rsa: { n, e } };
  }
  if (type.startsWith('ecdsa-sha2-')) {
    const ident = r.text();
    const point = r.string();
    const curve = CURVES.find((c) => c.ssh === ident);
    if (!curve) throw new Error(`Unsupported ECDSA curve "${ident}"`);
    return { alg: 'ec', isPrivate: false, ec: { curveOid: curve.oid, curve, point } };
  }
  if (type === 'ssh-ed25519') {
    return { alg: 'ed25519', isPrivate: false, okp: { pub: r.string() } };
  }
  throw new Error(`Unsupported OpenSSH key type "${type}" (supported: ssh-rsa, ecdsa-sha2-nistp256/384/521, ssh-ed25519)`);
}

const SSH_TYPE_RE = /^(ssh-rsa|ssh-ed25519|ssh-dss|ecdsa-sha2-nistp(?:256|384|521)|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp256@openssh\.com)$/;

/** Parses one authorized_keys / `.pub` style line. Returns null if the line is not an OpenSSH public key. */
export function parseOpenSshPublicLine(line: string): { material: KeyMaterial; comment: string; blob: Uint8Array } | null {
  const tokens = line.trim().split(/\s+/);
  const idx = tokens.findIndex((t) => SSH_TYPE_RE.test(t));
  if (idx < 0 || !tokens[idx + 1]) return null;
  let blob: Uint8Array;
  try {
    blob = b64Decode(tokens[idx + 1] ?? '');
  } catch {
    return null;
  }
  const material = parseSshPublicBlob(blob);
  return { material, comment: tokens.slice(idx + 2).join(' '), blob };
}

/** `-----BEGIN OPENSSH PRIVATE KEY-----` (openssh-key-v1), unencrypted keys only. */
export function parseOpenSshPrivate(der: Uint8Array): KeyMaterial {
  const magic = utf8Encode('openssh-key-v1\0');
  for (let i = 0; i < magic.length; i++) if (der[i] !== magic[i]) throw new Error('Not an openssh-key-v1 file');
  const r = new SshReader(der.subarray(magic.length));
  const cipher = r.text();
  const kdf = r.text();
  r.string();
  const nkeys = r.u32();
  if (cipher !== 'none' || kdf !== 'none') {
    throw new Error(`This OpenSSH private key is encrypted (${cipher}, kdf ${kdf}). Remove the passphrase first: ssh-keygen -p -f <key> -N ""`);
  }
  if (nkeys !== 1) throw new Error(`OpenSSH files with ${nkeys} keys are not supported`);
  r.string();
  const priv = new SshReader(r.string());
  const c1 = priv.u32();
  const c2 = priv.u32();
  if (c1 !== c2) throw new Error('OpenSSH check integers differ - the key is corrupt or encrypted');
  const type = priv.text();
  if (type === 'ssh-rsa') {
    const n = priv.mpint();
    const e = priv.mpint();
    const d = priv.mpint();
    const qi = priv.mpint();
    const p = priv.mpint();
    const q = priv.mpint();
    const D = bytesToBigInt(d);
    const toBytes = (v: bigint): Uint8Array => {
      const hex = v.toString(16);
      return fromHex(hex.length % 2 ? `0${hex}` : hex);
    };
    const dp = toBytes(D % (bytesToBigInt(p) - 1n));
    const dq = toBytes(D % (bytesToBigInt(q) - 1n));
    return { alg: 'rsa', isPrivate: true, rsa: { n, e, d, p, q, dp, dq, qi } };
  }
  if (type.startsWith('ecdsa-sha2-')) {
    const ident = priv.text();
    const point = priv.string();
    const d = priv.mpint();
    const curve = CURVES.find((c) => c.ssh === ident);
    if (!curve) throw new Error(`Unsupported ECDSA curve "${ident}"`);
    const padded = new Uint8Array(curve.size);
    padded.set(d, curve.size - d.length);
    return { alg: 'ec', isPrivate: true, ec: { curveOid: curve.oid, curve, point, d: padded } };
  }
  if (type === 'ssh-ed25519') {
    const pub = priv.string();
    const full = priv.string();
    return { alg: 'ed25519', isPrivate: true, okp: { pub, priv: full.slice(0, 32) } };
  }
  throw new Error(`Unsupported OpenSSH key type "${type}"`);
}

/* ---------------------------- text → ParsedItem[] ---------------------------- */

function detectBodyRepairs(body: string): string[] {
  const out: string[] = [];
  const cleaned = body
    .replace(/(Proc-Type|DEK-Info):[^\r\n]*/g, '')
    .replace(/^[ \t]*[A-Za-z][A-Za-z0-9-]*:[^\r\n]*$/gm, '');
  if (/\r/.test(body)) out.push('Normalised Windows (CRLF) line endings to LF');
  const lines = cleaned.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const bad = lines.some((l, i) => /\s/.test(l) || (i < lines.length - 1 && l.length !== 64) || l.length > 64);
  if (bad) out.push('Re-wrapped the Base64 body at 64 characters per line');
  return out;
}

function itemFromDer(der: Uint8Array, label: string, source: ParsedItem['sourceFormat'], repairs: string[]): ParsedItem {
  const lbl = label.replace(/^X509 /, '').replace(/^TRUSTED /, '');
  let format: ItemFormat;
  if (lbl === 'OPENSSH PRIVATE KEY' || (der.length > 15 && utf8Decode(der.subarray(0, 14)) === 'openssh-key-v1')) format = 'openssh-private';
  else format = classifyDer(der);
  const expected = LABEL_FOR[format];
  const out = [...repairs];
  if (label && format !== 'unknown' && format !== 'openssh-private' && KNOWN_LABELS.has(label) && label !== expected && !(label === 'NEW CERTIFICATE REQUEST' && format === 'csr') && !(label.endsWith('CERTIFICATE') && format === 'certificate')) {
    out.push(`The PEM label says "${label}" but the data is actually ${FORMAT_LABELS[format]} ("${expected}")`);
  }
  return { format, label, der, sourceFormat: source, repairs: out };
}

/** Parses any supported text input. Throws a readable Error if nothing usable is found. */
export function parseInput(text: string): ParseResult {
  const src = text.replace(/^﻿/, '').trim();
  if (!src) throw new Error('Paste a PEM block, Base64, hex or an OpenSSH public key, or drop a key file.');
  const warnings: string[] = [];
  const items: ParsedItem[] = [];

  // RFC 4716 "---- BEGIN SSH2 PUBLIC KEY ----"
  const rfc4716 = /-{3,}\s*BEGIN SSH2 PUBLIC KEY\s*-{3,}([\s\S]*?)-{3,}\s*END SSH2 PUBLIC KEY\s*-{3,}/i.exec(src);
  if (rfc4716) {
    const lines = (rfc4716[1] ?? '').split(/\r?\n/);
    const comment = lines.map((l) => /^Comment:\s*"?(.*?)"?\s*$/i.exec(l)?.[1]).find((c) => c);
    const b64 = lines.filter((l) => !/^[A-Za-z-]+:/.test(l.trim())).join('').replace(/\s+/g, '');
    const material = parseSshPublicBlob(b64Decode(b64));
    items.push({ format: 'openssh-public', label: '', der: new Uint8Array(0), sourceFormat: 'openssh', repairs: ['Converted RFC 4716 (SSH2) public key format'], material, comment });
    return { items, sourceFormat: 'openssh', warnings };
  }

  if (/-----BEGIN /.test(src)) {
    const blocks = parsePemBlocks(src);
    if (blocks.length === 0) {
      const m = /-----BEGIN ([^-\r\n]+?)-----([\s\S]*)$/.exec(src);
      if (!m) throw new Error('Found "-----BEGIN" but could not read the block.');
      const label = (m[1] ?? '').trim().toUpperCase();
      const b64 = (m[2] ?? '').replace(/-----.*$/s, '').replace(/\s+/g, '');
      let der: Uint8Array;
      try {
        der = b64Decode(b64);
      } catch {
        throw new Error('The PEM body is not valid Base64.');
      }
      items.push(itemFromDer(der, label, 'pem', ['The END line was missing - treated everything after BEGIN as the body']));
      return { items, sourceFormat: 'pem', warnings };
    }
    for (const [i, b] of blocks.entries()) {
      if (b.error) {
        warnings.push(`Block ${i + 1} (${b.label}): ${b.error}`);
        continue;
      }
      const repairs = detectBodyRepairs(b.body);
      if (b.endLabel) repairs.push(`END line said "${b.endLabel}" but BEGIN said "${b.label}" - used the BEGIN label`);
      if (b.legacyEncrypted) {
        items.push({
          format: 'legacy-encrypted', label: b.label, der: b.der, sourceFormat: 'pem', repairs,
          legacy: b.dekInfo ?? { cipher: 'UNKNOWN', iv: '' },
        });
      } else {
        items.push(itemFromDer(b.der, b.label, 'pem', repairs));
      }
    }
    // Text outside the blocks that is not whitespace/commentary
    if (items.length === 0) throw new Error(warnings.join(' ') || 'No decodable PEM block found.');
    return { items, sourceFormat: 'pem', warnings };
  }

  // JSON Web Key
  if (src.startsWith('{')) {
    let obj: unknown;
    try {
      obj = JSON.parse(src);
    } catch {
      throw new Error('The input looks like JSON but is not valid JSON.');
    }
    const keys = obj && typeof obj === 'object' && Array.isArray((obj as { keys?: unknown }).keys) ? ((obj as { keys: unknown[] }).keys) : [obj];
    for (const k of keys) {
      if (!k || typeof k !== 'object') continue;
      const material = fromJwk(k as Record<string, unknown>);
      items.push({ format: 'jwk', label: 'JWK', der: new Uint8Array(0), sourceFormat: 'base64', repairs: keys.length > 1 ? [] : [], material });
    }
    if (items.length === 0) throw new Error('No JWK found in the JSON.');
    return { items, sourceFormat: 'base64', warnings };
  }

  // OpenSSH public key lines (possibly several, authorized_keys style)
  const sshItems: ParsedItem[] = [];
  for (const line of src.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    let parsed: ReturnType<typeof parseOpenSshPublicLine> = null;
    try {
      parsed = parseOpenSshPublicLine(line);
    } catch (e) {
      throw e instanceof Error ? e : new Error(String(e));
    }
    if (parsed) sshItems.push({ format: 'openssh-public', label: '', der: new Uint8Array(0), sourceFormat: 'openssh', repairs: [], material: parsed.material, comment: parsed.comment });
  }
  if (sshItems.length > 0) return { items: sshItems, sourceFormat: 'openssh', warnings };

  // Raw Base64 or hex
  const compact = src.replace(/[\s:]/g, '');
  if (/^(0x)?[0-9a-fA-F]+$/.test(compact) && compact.replace(/^0x/i, '').length % 2 === 0 && compact.length >= 8) {
    const bytes = fromHex(compact);
    if (classifyDer(bytes) !== 'unknown') {
      return { items: [itemFromDer(bytes, '', 'hex', ['Added missing BEGIN/END lines'])], sourceFormat: 'hex', warnings };
    }
  }
  if (/^[A-Za-z0-9+/_-]+={0,2}$/.test(compact)) {
    const bytes = b64Decode(compact);
    const it = itemFromDer(bytes, '', 'base64', ['Added missing BEGIN/END lines']);
    if (it.format === 'unknown') {
      throw new Error('That is valid Base64, but the decoded bytes are not a recognised key, certificate or request structure.');
    }
    return { items: [it], sourceFormat: 'base64', warnings };
  }
  throw new Error('Could not recognise the input. Expected PEM, Base64/hex of a DER structure, or an OpenSSH public key line.');
}

export function parseInputBytes(bytes: Uint8Array): ParseResult {
  if (bytes.length === 0) throw new Error('The file is empty.');
  let texty = true;
  for (let i = 0; i < Math.min(bytes.length, 512); i++) {
    const b = bytes[i] ?? 0;
    if (!(b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127))) {
      texty = false;
      break;
    }
  }
  if (texty) return parseInput(utf8Decode(bytes));
  const it = itemFromDer(bytes, '', 'binary', []);
  if (it.format === 'unknown') throw new Error('The file is not a recognised DER key, certificate or request (is it encrypted or a different format such as PKCS#12?).');
  return { items: [it], sourceFormat: 'binary', warnings: [] };
}

/** Normalised PEM text for an item (headers preserved for legacy-encrypted blocks). */
export function normalizedPem(item: ParsedItem): string {
  if (item.format === 'jwk' && item.material) return `${JSON.stringify(toJwk(item.material, true), null, 2)}\n`;
  if (item.format === 'openssh-public' && item.material) {
    return `${sshLine(item.material, item.comment ?? '')}\n`;
  }
  const label = item.label || LABEL_FOR[item.format];
  if (item.format === 'legacy-encrypted') {
    const hdr = `Proc-Type: 4,ENCRYPTED\nDEK-Info: ${item.legacy?.cipher ?? ''},${item.legacy?.iv ?? ''}\n\n`;
    return `-----BEGIN ${label}-----\n${hdr}${wrapLines(b64Encode(item.der))}\n-----END ${label}-----\n`;
  }
  return toPem(item.der, label);
}

/* -------------------------------- OpenSSH out -------------------------------- */

export function sshPublicBlob(m: KeyMaterial): Uint8Array {
  if (m.alg === 'rsa' && m.rsa) return concatBytes(sshText('ssh-rsa'), sshMpint(m.rsa.e), sshMpint(m.rsa.n));
  if (m.alg === 'ec' && m.ec?.point) {
    const ident = m.ec.curve?.ssh;
    if (!ident) throw new Error(`OpenSSH supports only NIST P-256/384/521 curves (this key uses ${m.ec.curve?.name ?? m.ec.curveOid})`);
    return concatBytes(sshText(`ecdsa-sha2-${ident}`), sshText(ident), sshString(m.ec.point));
  }
  if (m.alg === 'ed25519' && m.okp?.pub) return concatBytes(sshText('ssh-ed25519'), sshString(m.okp.pub));
  throw new Error('This key type cannot be written as an OpenSSH public key (supported: RSA, ECDSA P-256/384/521, Ed25519)');
}

export function sshKeyType(m: KeyMaterial): string {
  if (m.alg === 'rsa') return 'ssh-rsa';
  if (m.alg === 'ed25519') return 'ssh-ed25519';
  return `ecdsa-sha2-${m.ec?.curve?.ssh ?? '?'}`;
}

export function sshLine(m: KeyMaterial, comment: string): string {
  const blob = sshPublicBlob(m);
  return `${sshKeyType(m)} ${b64Encode(blob)}${comment ? ` ${comment}` : ''}`;
}

/** `ssh-keygen -lf` style fingerprint: SHA256:<base64 without padding>. */
export async function sshFingerprint(m: KeyMaterial): Promise<string> {
  const h = await digest('SHA-256', sshPublicBlob(m));
  return `SHA256:${b64Encode(h).replace(/=+$/, '')}`;
}

/* ================================ JWK output ================================ */

const b64u = (b: Uint8Array): string => b64Encode(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uDecode = (s: string): Uint8Array => b64Decode(s);

function padTo(b: Uint8Array, size: number): Uint8Array {
  if (b.length === size) return b;
  if (b.length > size) {
    let i = 0;
    while (i < b.length - size && b[i] === 0) i++;
    return b.slice(i);
  }
  const out = new Uint8Array(size);
  out.set(b, size - b.length);
  return out;
}

export type Jwk = Record<string, string>;

/** Builds a JWK by hand (works for secp256k1 and Ed25519 too, unlike WebCrypto export). */
export function toJwk(m: KeyMaterial, includePrivate: boolean): Jwk {
  if (m.alg === 'rsa' && m.rsa) {
    const r = m.rsa;
    const jwk: Jwk = { kty: 'RSA', n: b64u(r.n), e: b64u(r.e) };
    if (includePrivate && m.isPrivate && r.d && r.p && r.q && r.dp && r.dq && r.qi) {
      Object.assign(jwk, { d: b64u(r.d), p: b64u(r.p), q: b64u(r.q), dp: b64u(r.dp), dq: b64u(r.dq), qi: b64u(r.qi) });
    }
    return jwk;
  }
  if (m.alg === 'ec' && m.ec) {
    const c = m.ec.curve;
    if (!c?.crv) throw new Error(`JWK has no registered curve name for ${c?.name ?? m.ec.curveOid}`);
    const pt = m.ec.point;
    if (!pt || pt[0] !== 4 || pt.length !== 1 + 2 * c.size) throw new Error('Only uncompressed EC points can be converted to JWK');
    const jwk: Jwk = { kty: 'EC', crv: c.crv, x: b64u(pt.slice(1, 1 + c.size)), y: b64u(pt.slice(1 + c.size)) };
    if (includePrivate && m.isPrivate && m.ec.d) jwk.d = b64u(padTo(m.ec.d, c.size));
    return jwk;
  }
  if ((m.alg === 'ed25519' || m.alg === 'ed448' || m.alg === 'x25519' || m.alg === 'x448') && m.okp) {
    const names: Record<string, string> = { ed25519: 'Ed25519', ed448: 'Ed448', x25519: 'X25519', x448: 'X448' };
    if (!m.okp.pub) throw new Error('The public half is needed for JWK (derive it first)');
    const jwk: Jwk = { kty: 'OKP', crv: names[m.alg] ?? m.alg, x: b64u(m.okp.pub) };
    if (includePrivate && m.isPrivate && m.okp.priv) jwk.d = b64u(m.okp.priv);
    return jwk;
  }
  throw new Error('This key type cannot be expressed as a JWK here');
}

/** Parses an RSA/EC/OKP JWK (public or private) into key material. */
export function fromJwk(j: Record<string, unknown>): KeyMaterial {
  const s = (k: string): Uint8Array | undefined => (typeof j[k] === 'string' ? b64uDecode(j[k] as string) : undefined);
  if (j.kty === 'RSA') {
    const n = s('n');
    const e = s('e');
    if (!n || !e) throw new Error('RSA JWK needs "n" and "e"');
    const d = s('d');
    return { alg: 'rsa', isPrivate: !!d, rsa: { n: intMagnitude(n).slice(), e: intMagnitude(e).slice(), d, p: s('p'), q: s('q'), dp: s('dp'), dq: s('dq'), qi: s('qi') } };
  }
  if (j.kty === 'EC') {
    const c = CURVES.find((x) => x.crv === j.crv);
    if (!c) throw new Error(`Unsupported JWK curve "${String(j.crv)}"`);
    const x = s('x');
    const y = s('y');
    if (!x || !y) throw new Error('EC JWK needs "x" and "y"');
    return { alg: 'ec', isPrivate: !!s('d'), ec: { curveOid: c.oid, curve: c, point: concatBytes(Uint8Array.of(4), padTo(x, c.size), padTo(y, c.size)), d: s('d') } };
  }
  if (j.kty === 'OKP') {
    const alg = String(j.crv).toLowerCase();
    if (alg !== 'ed25519' && alg !== 'ed448' && alg !== 'x25519' && alg !== 'x448') throw new Error(`Unsupported OKP curve "${String(j.crv)}"`);
    return { alg, isPrivate: !!s('d'), okp: { pub: s('x'), priv: s('d') } };
  }
  throw new Error('Unsupported JWK "kty" (supported: RSA, EC, OKP)');
}

/* =============================== derive public =============================== */

export type DeriveMethod = 'rsa-fields' | 'webcrypto' | 'embedded' | 'public-input';

/** Derives the public key (as SPKI-capable material) from private material. */
export async function derivePublic(m: KeyMaterial): Promise<{ material: KeyMaterial; method: DeriveMethod }> {
  if (!m.isPrivate) return { material: m, method: 'public-input' };
  if (m.alg === 'rsa' && m.rsa) {
    return { material: { alg: 'rsa', isPrivate: false, rsa: { n: m.rsa.n, e: m.rsa.e } }, method: 'rsa-fields' };
  }
  if (m.alg === 'ec' && m.ec) {
    const embedded = m.ec.point;
    const jwkCurve = m.ec.curve?.jwk;
    if (jwkCurve) {
      try {
        const pk = await wc.subtle.importKey('pkcs8', bs(buildPkcs8(m)), { name: 'ECDSA', namedCurve: jwkCurve }, true, ['sign']);
        const jwk = await wc.subtle.exportKey('jwk', pk);
        delete jwk.d;
        jwk.key_ops = ['verify'];
        const pub = await wc.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: jwkCurve }, true, ['verify']);
        const spki = new Uint8Array(await wc.subtle.exportKey('spki', pub));
        const dm = parseSpki(spki);
        return { material: dm, method: 'webcrypto' };
      } catch {
        /* fall through to the embedded public key */
      }
    }
    if (embedded) return { material: { alg: 'ec', isPrivate: false, ec: { curveOid: m.ec.curveOid, curve: m.ec.curve, point: embedded } }, method: 'embedded' };
    throw new Error(
      `Cannot derive the public key for ${m.ec.curve?.name ?? m.ec.curveOid}: the file has no embedded public key and this curve is not supported by WebCrypto.`
    );
  }
  if ((m.alg === 'ed25519' || m.alg === 'x25519') && m.okp) {
    const name = m.alg === 'ed25519' ? 'Ed25519' : 'X25519';
    try {
      const pk = await wc.subtle.importKey('pkcs8', bs(buildPkcs8(m)), { name }, true, m.alg === 'ed25519' ? ['sign'] : ['deriveBits']);
      const jwk = await wc.subtle.exportKey('jwk', pk);
      if (typeof jwk.x === 'string') {
        return { material: { alg: m.alg, isPrivate: false, okp: { pub: b64uDecode(jwk.x) } }, method: 'webcrypto' };
      }
    } catch {
      /* fall through */
    }
    if (m.okp.pub) return { material: { alg: m.alg, isPrivate: false, okp: { pub: m.okp.pub } }, method: 'embedded' };
    throw new Error(`Deriving ${name} public keys needs a browser with WebCrypto ${name} support (Chrome 137+, Firefox 129+, Safari 17+).`);
  }
  throw new Error('Public key derivation is not supported for this key type');
}

/* ================================ encryption ================================ */

export class UnsupportedError extends Error {}

export interface EncryptionInfo {
  scheme: 'PBES2' | 'PBES1' | 'unknown';
  schemeOid: string;
  kdf?: string;
  kdfOid?: string;
  salt?: string;
  iterations?: number;
  keyLength?: number;
  prf?: string;
  prfOid?: string;
  cipher?: string;
  cipherOid?: string;
  iv?: string;
}

export function parseEncryptionInfo(algId: Tlv): EncryptionInfo {
  const k = tlvChildren(algId);
  const schemeOid = oidOf(k[0]);
  if (schemeOid === '1.2.840.113549.1.5.13' && k[1]) {
    const p = tlvChildren(k[1]);
    const kdfAlg = tlvChildren(need(p[0], 'key derivation function'));
    const encAlg = tlvChildren(need(p[1], 'encryption scheme'));
    const kdfOid = oidOf(kdfAlg[0]);
    const cipherOid = oidOf(encAlg[0]);
    const info: EncryptionInfo = { scheme: 'PBES2', schemeOid, kdfOid, kdf: oidName(kdfOid) || kdfOid, cipherOid, cipher: oidName(cipherOid) || cipherOid };
    const ivT = encAlg[1];
    if (ivT && isUniv(ivT, 4)) info.iv = toHex(tlvContent(ivT));
    const kp = kdfAlg[1] ? tlvChildren(kdfAlg[1]) : [];
    if (kdfOid === '1.2.840.113549.1.5.12') {
      info.salt = kp[0] && isUniv(kp[0], 4) ? toHex(tlvContent(kp[0])) : undefined;
      info.iterations = kp[1] ? Number(signedToBigInt(tlvContent(kp[1]))) : undefined;
      let idx = 2;
      if (kp[idx] && isUniv(kp[idx], 2)) {
        info.keyLength = Number(signedToBigInt(tlvContent(need(kp[idx], 'key length'))));
        idx++;
      }
      const prfAlg = kp[idx];
      info.prfOid = prfAlg && isUniv(prfAlg, 16) ? oidOf(tlvChildren(prfAlg)[0]) : '1.2.840.113549.2.7';
      info.prf = oidName(info.prfOid) || info.prfOid;
    }
    return info;
  }
  const info: EncryptionInfo = { scheme: schemeOid.startsWith('1.2.840.113549.1.12.1.') || schemeOid.startsWith('1.2.840.113549.1.5.') ? 'PBES1' : 'unknown', schemeOid, cipher: oidName(schemeOid) || schemeOid };
  const pp = k[1] && k[1].constructed ? tlvChildren(k[1]) : [];
  if (pp[0] && isUniv(pp[0], 4)) info.salt = toHex(tlvContent(pp[0]));
  if (pp[1] && isUniv(pp[1], 2)) info.iterations = Number(signedToBigInt(tlvContent(pp[1])));
  return info;
}

const PRF_HASH: Record<string, HashName> = {
  '1.2.840.113549.2.7': 'SHA-1',
  '1.2.840.113549.2.9': 'SHA-256',
  '1.2.840.113549.2.10': 'SHA-384',
  '1.2.840.113549.2.11': 'SHA-512',
};
const AES_CBC: Record<string, number> = {
  '2.16.840.1.101.3.4.1.2': 16,
  '2.16.840.1.101.3.4.1.22': 24,
  '2.16.840.1.101.3.4.1.42': 32,
};

async function aesCbcDecrypt(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await wc.subtle.importKey('raw', bs(key), { name: 'AES-CBC' }, false, ['decrypt']);
  try {
    return new Uint8Array(await wc.subtle.decrypt({ name: 'AES-CBC', iv: bs(iv) }, k, bs(data)));
  } catch {
    throw new Error('Decryption failed - wrong password, or the file is corrupt.');
  }
}

/** Decrypts an EncryptedPrivateKeyInfo (PBES2: PBKDF2 + AES-CBC) and returns the PrivateKeyInfo DER. */
export async function decryptPkcs8(der: Uint8Array, password: string): Promise<Uint8Array> {
  const k = tlvChildren(parseSingle(der));
  const algId = need(k[0], 'encryptionAlgorithm');
  const ct = tlvContent(need(k[1], 'encryptedData'));
  const info = parseEncryptionInfo(algId);
  if (info.scheme !== 'PBES2') {
    throw new UnsupportedError(`This key uses the legacy PKCS#12/PKCS#5 v1.5 scheme "${info.cipher}", which WebCrypto cannot run. Decrypt with: openssl pkcs8 -in key.pem -out plain.pem`);
  }
  if (info.kdfOid === '1.3.6.1.4.1.11591.4.11') {
    throw new UnsupportedError('This key was encrypted with scrypt, which this tool cannot run in the browser. Decrypt with: openssl pkcs8 -in key.pem -out plain.pem');
  }
  if (info.kdfOid !== '1.2.840.113549.1.5.12' || !info.salt || !info.iterations) {
    throw new UnsupportedError(`Unsupported key derivation function "${info.kdf}".`);
  }
  const keyLen = AES_CBC[info.cipherOid ?? ''];
  if (!keyLen) {
    throw new UnsupportedError(
      `The cipher "${info.cipher}" is not available in WebCrypto (only AES-128/192/256-CBC are supported; 3DES is not). Decrypt with: openssl pkcs8 -in key.pem -out plain.pem`
    );
  }
  const hash = PRF_HASH[info.prfOid ?? ''];
  if (!hash) throw new UnsupportedError(`Unsupported PBKDF2 PRF "${info.prf}" (supported: HMAC-SHA1/256/384/512).`);
  if (!password) throw new Error('Enter the password to decrypt this key.');
  if (info.keyLength !== undefined && info.keyLength !== keyLen) throw new UnsupportedError('PBKDF2 key length does not match the cipher.');
  const base = await wc.subtle.importKey('raw', bs(utf8Encode(password)), 'PBKDF2', false, ['deriveBits']);
  const bits = await wc.subtle.deriveBits({ name: 'PBKDF2', hash, salt: bs(fromHex(info.salt)), iterations: info.iterations }, base, keyLen * 8);
  const plain = await aesCbcDecrypt(new Uint8Array(bits), fromHex(info.iv ?? ''), ct);
  if (classifyDer(plain) !== 'pkcs8') throw new Error('Decryption produced garbage - wrong password?');
  return plain;
}

/** OpenSSL EVP_BytesToKey with MD5, one iteration (legacy PEM encryption). */
export function evpBytesToKey(password: Uint8Array, salt: Uint8Array, keyLen: number): Uint8Array {
  const out: number[] = [];
  let prev: Uint8Array = new Uint8Array(0);
  while (out.length < keyLen) {
    prev = md5(concatBytes(prev, password, salt));
    out.push(...prev);
  }
  return Uint8Array.from(out.slice(0, keyLen));
}

/** Decrypts an RFC 1421 / "Proc-Type: 4,ENCRYPTED" PEM body (AES-CBC only). */
export async function decryptLegacy(ciphertext: Uint8Array, cipher: string, ivHex: string, password: string): Promise<Uint8Array> {
  const m = /^AES-(128|192|256)-CBC$/.exec(cipher);
  if (!m) {
    throw new UnsupportedError(
      `The cipher ${cipher} cannot be decrypted in the browser (WebCrypto has no DES/3DES). Decrypt with OpenSSL: openssl rsa -in key.pem -out plain.pem (or "openssl ec" for EC keys).`
    );
  }
  if (!password) throw new Error('Enter the password to decrypt this key.');
  const iv = fromHex(ivHex);
  if (iv.length !== 16) throw new Error('Invalid DEK-Info initialisation vector.');
  const key = evpBytesToKey(utf8Encode(password), iv.subarray(0, 8), Number(m[1]) / 8);
  const plain = await aesCbcDecrypt(key, iv, ciphertext);
  const f = classifyDer(plain);
  if (f !== 'rsa-private' && f !== 'ec-private' && f !== 'pkcs8') throw new Error('Decryption produced garbage - wrong password?');
  return plain;
}

/* ================================== analysis ================================== */

export interface Row {
  label: string;
  value: string;
}

export interface OutputBlock {
  id: string;
  group: 'private' | 'public' | 'encodings';
  title: string;
  subtitle?: string;
  text: string;
  filename: string;
  mime?: string;
  /** Binary download (DER) in addition to the text, when relevant. */
  der?: Uint8Array;
  derFilename?: string;
  command?: string;
  sensitive?: boolean;
}

export interface Analysis {
  title: string;
  rows: Row[];
  outputs: OutputBlock[];
  notes: string[];
  /** Encrypted input that still needs a (correct) password. */
  needsPassword: boolean;
  material?: KeyMaterial;
  format: ItemFormat;
}

export function describeMaterial(m: KeyMaterial): { title: string; rows: Row[] } {
  const priv = m.isPrivate ? 'private key' : 'public key';
  if (m.alg === 'rsa' && m.rsa) {
    const bits = bitLength(m.rsa.n);
    return {
      title: `RSA ${bits}-bit ${priv}`,
      rows: [
        { label: 'Algorithm', value: 'RSA' },
        { label: 'Modulus size', value: `${bits} bits` },
        { label: 'Public exponent', value: bytesToBigInt(m.rsa.e).toString() },
        { label: 'Contains private key', value: m.isPrivate ? 'Yes' : 'No' },
      ],
    };
  }
  if (m.alg === 'ec' && m.ec) {
    const cn = m.ec.curve?.name ?? m.ec.curveOid;
    return {
      title: `EC ${cn} ${priv}`,
      rows: [
        { label: 'Algorithm', value: 'Elliptic curve (ECDSA / ECDH)' },
        { label: 'Curve', value: `${cn}  (${m.ec.curveOid})` },
        { label: 'Contains private key', value: m.isPrivate ? 'Yes' : 'No' },
        ...(m.isPrivate ? [{ label: 'Public point embedded', value: m.ec.point ? 'Yes' : 'No' }] : []),
      ],
    };
  }
  const names: Record<string, string> = { ed25519: 'Ed25519', ed448: 'Ed448', x25519: 'X25519', x448: 'X448' };
  if (names[m.alg]) {
    return {
      title: `${names[m.alg]} ${priv}`,
      rows: [
        { label: 'Algorithm', value: names[m.alg] ?? m.alg },
        { label: 'Contains private key', value: m.isPrivate ? 'Yes' : 'No' },
      ],
    };
  }
  return { title: `Unsupported ${priv}`, rows: [{ label: 'Algorithm OID', value: m.algOid ?? 'unknown' }] };
}

function spkiRawFromCertificate(der: Uint8Array): Uint8Array {
  const top = readTlv(der, 0);
  const tbs = need(tlvChildren(top)[0], 'tbsCertificate');
  const k = tlvChildren(tbs);
  const i = isCtx(k[0], 0) ? 1 : 0;
  return tlvRaw(need(k[i + 5], 'subjectPublicKeyInfo')).slice();
}

function spkiRawFromCsr(der: Uint8Array): Uint8Array {
  const top = readTlv(der, 0);
  const info = need(tlvChildren(top)[0], 'certificationRequestInfo');
  return tlvRaw(need(tlvChildren(info)[2], 'subjectPKInfo')).slice();
}

const ONE_LINE = (s: string): string => s.replace(/\s+/g, ' ');

function pemBlock(der: Uint8Array, label: string): string {
  return toPem(der, label);
}

function jsonText(j: Jwk): string {
  return JSON.stringify(j, null, 2);
}

/** Resolves any item to key material (decrypting if possible). Returns reasons it could not. */
async function resolveMaterial(
  item: ParsedItem,
  password: string
): Promise<{ material?: KeyMaterial; spkiRaw?: Uint8Array; effective: ItemFormat; plainDer?: Uint8Array; decrypted?: boolean; needsPassword?: boolean; notes: string[]; encInfo?: EncryptionInfo }> {
  const notes: string[] = [];
  let format = item.format;
  let der = item.der;
  let decrypted = false;
  let encInfo: EncryptionInfo | undefined;
  if (format === 'pkcs8-encrypted') {
    const k = tlvChildren(parseSingle(der));
    encInfo = parseEncryptionInfo(need(k[0], 'encryptionAlgorithm'));
    if (!password) return { effective: format, needsPassword: true, notes, encInfo };
    try {
      der = await decryptPkcs8(der, password);
    } catch (e) {
      if (e instanceof UnsupportedError) {
        notes.push(e.message);
        return { effective: format, notes, encInfo };
      }
      notes.push(e instanceof Error ? e.message : String(e));
      return { effective: format, needsPassword: true, notes, encInfo };
    }
    decrypted = true;
    format = 'pkcs8';
  } else if (format === 'legacy-encrypted') {
    const cipher = item.legacy?.cipher ?? '';
    if (!password && /^AES-/.test(cipher)) return { effective: format, needsPassword: true, notes };
    try {
      der = await decryptLegacy(der, cipher, item.legacy?.iv ?? '', password);
    } catch (e) {
      if (e instanceof UnsupportedError) {
        notes.push(e.message);
        return { effective: format, notes };
      }
      notes.push(e instanceof Error ? e.message : String(e));
      return { effective: format, needsPassword: true, notes };
    }
    decrypted = true;
    format = classifyDer(der);
  }
  switch (format) {
    case 'rsa-private':
      return { material: parsePkcs1Private(der), effective: format, plainDer: der, decrypted, notes, encInfo };
    case 'rsa-public':
      return { material: parsePkcs1Public(der), effective: format, plainDer: der, decrypted, notes, encInfo };
    case 'ec-private':
      return { material: parseSec1(der), effective: format, plainDer: der, decrypted, notes, encInfo };
    case 'pkcs8':
      return { material: parsePkcs8(der), effective: format, plainDer: der, decrypted, notes, encInfo };
    case 'spki':
      return { material: parseSpki(der), effective: format, plainDer: der, decrypted, notes, encInfo };
    case 'certificate': {
      const raw = spkiRawFromCertificate(der);
      return { material: parseSpki(raw), spkiRaw: raw, effective: format, plainDer: der, notes };
    }
    case 'csr': {
      const raw = spkiRawFromCsr(der);
      return { material: parseSpki(raw), spkiRaw: raw, effective: format, plainDer: der, notes };
    }
    case 'openssh-public':
      return { material: item.material, effective: format, notes };
    case 'openssh-private':
      return { material: parseOpenSshPrivate(der), effective: format, plainDer: der, notes };
    case 'jwk':
      return { material: item.material, effective: format, notes };
    default:
      return { effective: format, notes: ['This data is not a recognised key, certificate or request structure.'] };
  }
}

/** Builds every conversion available for the item. */
export async function analyzeItem(item: ParsedItem, password = ''): Promise<Analysis> {
  const base = FORMAT_LABELS[item.format];
  const res = await resolveMaterial(item, password);
  const notes = [...res.notes];
  const rows: Row[] = [{ label: 'Detected as', value: base }];
  if (item.label) rows.push({ label: 'PEM label', value: item.label });

  if (item.format === 'pkcs8-encrypted' || item.format === 'legacy-encrypted') {
    if (res.encInfo) {
      const e = res.encInfo;
      rows.push({ label: 'Scheme', value: e.scheme === 'PBES2' ? 'PBES2 (PKCS#5 v2.x)' : `${e.cipher ?? e.schemeOid}` });
      if (e.kdf) rows.push({ label: 'Key derivation', value: e.kdf });
      if (e.iterations !== undefined) rows.push({ label: 'Iterations', value: e.iterations.toLocaleString('en-US') });
      if (e.prf) rows.push({ label: 'PRF', value: e.prf });
      if (e.cipher && e.scheme === 'PBES2') rows.push({ label: 'Cipher', value: e.cipher });
    } else if (item.legacy) {
      rows.push({ label: 'Cipher (DEK-Info)', value: item.legacy.cipher });
      rows.push({ label: 'Key derivation', value: 'OpenSSL EVP_BytesToKey (MD5, 1 iteration)' });
    }
  }
  if (!res.material) {
    return { title: res.needsPassword ? 'Encrypted private key' : base, rows, outputs: [], notes, needsPassword: !!res.needsPassword, format: item.format };
  }

  const m = res.material;
  const desc = describeMaterial(m);
  rows.push(...desc.rows);
  if (res.decrypted) notes.push('Decrypted locally in your browser; the password never leaves this page.');
  const outputs: OutputBlock[] = [];
  const isCertLike = res.effective === 'certificate' || res.effective === 'csr';
  const src = isCertLike ? (res.effective === 'certificate' ? 'cert.pem' : 'csr.pem') : m.isPrivate ? 'key.pem' : 'public.pem';

  // ---- private-key formats
  if (m.isPrivate) {
    let full = m;
    if ((m.alg === 'ec' && !m.ec?.point) || ((m.alg === 'ed25519' || m.alg === 'x25519') && !m.okp?.pub)) {
      try {
        const d = await derivePublic(m);
        full = { ...m, ec: m.ec ? { ...m.ec, point: d.material.ec?.point } : undefined, okp: m.okp ? { ...m.okp, pub: d.material.okp?.pub } : undefined };
      } catch (e) {
        notes.push(e instanceof Error ? e.message : String(e));
      }
    }
    const pkcs8 = buildPkcs8(full);
    outputs.push({
      id: 'pkcs8', group: 'private', title: 'PKCS#8 private key', subtitle: '-----BEGIN PRIVATE KEY-----',
      text: pemBlock(pkcs8, 'PRIVATE KEY'), filename: 'private-pkcs8.pem', der: pkcs8, derFilename: 'private-pkcs8.der', sensitive: true,
      command: m.alg === 'rsa' || m.alg === 'ec' ? `openssl pkcs8 -topk8 -nocrypt -in ${src} -out private-pkcs8.pem` : `openssl pkey -in ${src} -out private-pkcs8.pem`,
    });
    if (m.alg === 'rsa' && full.rsa) {
      const p1 = buildPkcs1Private(full.rsa);
      outputs.push({
        id: 'pkcs1', group: 'private', title: 'PKCS#1 RSA private key', subtitle: '-----BEGIN RSA PRIVATE KEY-----',
        text: pemBlock(p1, 'RSA PRIVATE KEY'), filename: 'private-pkcs1.pem', der: p1, derFilename: 'private-pkcs1.der', sensitive: true,
        command: `openssl rsa -in ${src} -traditional -out private-pkcs1.pem`,
      });
    }
    if (m.alg === 'ec' && full.ec) {
      const s1 = buildSec1(full, true);
      outputs.push({
        id: 'sec1', group: 'private', title: 'SEC1 EC private key', subtitle: '-----BEGIN EC PRIVATE KEY----- (with curve OID parameter)',
        text: pemBlock(s1, 'EC PRIVATE KEY'), filename: 'private-sec1.pem', der: s1, derFilename: 'private-sec1.der', sensitive: true,
        command: `openssl ec -in ${src} -out private-sec1.pem`,
      });
    }
    // JWK private
    try {
      outputs.push({
        id: 'jwk-private', group: 'encodings', title: 'JWK (private)', subtitle: 'RFC 7517 JSON Web Key including the private parameters',
        text: jsonText(toJwk(full, true)), filename: 'private.jwk.json', mime: 'application/json', sensitive: true,
        command: 'step crypto key format --jwk private-pkcs8.pem   # no plain openssl equivalent',
      });
    } catch (e) {
      notes.push(`JWK (private): ${e instanceof Error ? e.message : String(e)}`);
    }
    outputs.push({
      id: 'b64-private', group: 'encodings', title: 'Base64 (PKCS#8 DER, single line)', subtitle: 'The PEM body without BEGIN/END lines',
      text: b64Encode(pkcs8), filename: 'private-pkcs8.b64', sensitive: true,
      command: `openssl pkcs8 -topk8 -nocrypt -in ${src} -outform DER | base64 -w0`,
    });
  }

  // ---- public-key formats
  let pub: KeyMaterial | undefined;
  let pubMethod: DeriveMethod = 'public-input';
  try {
    const d = await derivePublic(m);
    pub = d.material;
    pubMethod = d.method;
  } catch (e) {
    notes.push(e instanceof Error ? e.message : String(e));
  }
  if (pub) {
    const spki = res.spkiRaw && !m.isPrivate ? res.spkiRaw : buildSpki(pub);
    const fromPriv = m.isPrivate;
    const pubCmd = res.effective === 'certificate'
      ? 'openssl x509 -in cert.pem -pubkey -noout -out public.pem'
      : res.effective === 'csr'
        ? 'openssl req -in csr.pem -pubkey -noout -out public.pem'
        : res.effective === 'openssh-public'
          ? 'ssh-keygen -e -m PKCS8 -f key.pub > public.pem'
          : fromPriv
            ? `openssl pkey -in ${src} -pubout -out public.pem`
            : res.effective === 'rsa-public'
              ? 'openssl rsa -RSAPublicKey_in -in public-pkcs1.pem -pubout -out public.pem'
              : 'openssl pkey -pubin -in public.pem -out public.pem';
    outputs.push({
      id: 'spki', group: 'public', title: 'Public key (SPKI)', subtitle: `-----BEGIN PUBLIC KEY-----${fromPriv ? ` - derived via ${pubMethod === 'webcrypto' ? 'WebCrypto' : pubMethod === 'rsa-fields' ? 'the RSA modulus/exponent' : 'the embedded public key'}` : ''}`,
      text: pemBlock(spki, 'PUBLIC KEY'), filename: 'public.pem', der: spki, derFilename: 'public.der', command: pubCmd,
    });
    if (pub.alg === 'rsa' && pub.rsa) {
      const p1 = buildPkcs1Public(pub.rsa.n, pub.rsa.e);
      outputs.push({
        id: 'pkcs1-pub', group: 'public', title: 'PKCS#1 RSA public key', subtitle: '-----BEGIN RSA PUBLIC KEY-----',
        text: pemBlock(p1, 'RSA PUBLIC KEY'), filename: 'public-pkcs1.pem', der: p1, derFilename: 'public-pkcs1.der',
        command: fromPriv ? `openssl rsa -in ${src} -RSAPublicKey_out -out public-pkcs1.pem` : 'openssl rsa -pubin -in public.pem -RSAPublicKey_out -out public-pkcs1.pem',
      });
    }
    try {
      const line = sshLine(pub, item.comment ?? '');
      const fp = await sshFingerprint(pub);
      outputs.push({
        id: 'openssh', group: 'public', title: 'OpenSSH public key', subtitle: `one line for authorized_keys - ${fp}`,
        text: line, filename: 'id.pub',
        command: fromPriv ? `ssh-keygen -y -f ${src} > id.pub` : 'ssh-keygen -i -m PKCS8 -f public.pem > id.pub',
      });
    } catch (e) {
      notes.push(`OpenSSH: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
      outputs.push({
        id: 'jwk-public', group: 'encodings', title: 'JWK (public)', subtitle: 'RFC 7517 JSON Web Key',
        text: jsonText(toJwk(pub, false)), filename: 'public.jwk.json', mime: 'application/json',
        command: 'step crypto key format --jwk public.pem   # no plain openssl equivalent',
      });
    } catch (e) {
      notes.push(`JWK (public): ${e instanceof Error ? e.message : String(e)}`);
    }
    outputs.push({
      id: 'b64-public', group: 'encodings', title: 'Base64 (SPKI DER, single line)', subtitle: 'The PEM body without BEGIN/END lines',
      text: b64Encode(spki), filename: 'public.b64',
      command: 'openssl pkey -pubin -in public.pem -outform DER | base64 -w0',
    });
  }

  // ---- the certificate / CSR itself
  if (isCertLike && res.plainDer) {
    const label = res.effective === 'certificate' ? 'CERTIFICATE' : 'CERTIFICATE REQUEST';
    outputs.unshift({
      id: 'self', group: 'encodings', title: res.effective === 'certificate' ? 'Certificate (PEM)' : 'Certificate request (PEM)', subtitle: `normalised, 64-column PEM / binary DER`,
      text: pemBlock(res.plainDer, label), filename: res.effective === 'certificate' ? 'cert.pem' : 'csr.pem', der: res.plainDer,
      derFilename: res.effective === 'certificate' ? 'cert.der' : 'csr.der',
      command: res.effective === 'certificate' ? 'openssl x509 -in cert.pem -outform DER -out cert.der' : 'openssl req -in csr.pem -outform DER -out csr.der',
    });
  }
  void ONE_LINE;
  return { title: desc.title, rows, outputs, notes, needsPassword: false, material: m, format: item.format };
}

/* ================================== matching ================================== */

export interface KeyFingerprint {
  spki: Uint8Array;
  sha256: string;
  alg: KeyAlg;
  description: string;
  /** `openssl ... -modulus | openssl md5` equivalent (RSA only). */
  modulusMd5?: string;
  modulusHex?: string;
  format: ItemFormat;
}

/** Canonical SPKI fingerprint of the *public* key behind a certificate, CSR, key or OpenSSH line. */
export async function fingerprintItem(item: ParsedItem, password = ''): Promise<KeyFingerprint> {
  const res = await resolveMaterial(item, password);
  if (!res.material) {
    if (res.needsPassword) throw new Error(res.notes[0] ?? 'This key is encrypted - enter its password.');
    throw new Error(res.notes[0] ?? 'Could not read a key from this input.');
  }
  const pub = (await derivePublic(res.material)).material;
  let spki: Uint8Array;
  if (pub.alg === 'unknown') {
    if (!res.spkiRaw) throw new Error('Unsupported key algorithm.');
    spki = res.spkiRaw;
  } else spki = buildSpki(pub);
  const sha = toHex(await digest('SHA-256', spki), ':').toUpperCase();
  const fp: KeyFingerprint = { spki, sha256: sha, alg: pub.alg, description: describeMaterial(pub).title, format: item.format };
  if (pub.alg === 'rsa' && pub.rsa) {
    const hex = toHex(intMagnitude(pub.rsa.n)).toUpperCase();
    fp.modulusHex = hex;
    fp.modulusMd5 = toHex(md5(utf8Encode(`Modulus=${hex}\n`)));
  }
  return fp;
}
