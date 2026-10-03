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

const OID_TEXT = `
2.5.4.0 objectClass
2.5.4.1 aliasedEntryName
2.5.4.3 commonName (CN)
2.5.4.4 surname (SN)
2.5.4.5 serialNumber
2.5.4.6 countryName (C)
2.5.4.7 localityName (L)
2.5.4.8 stateOrProvinceName (ST)
2.5.4.9 streetAddress (STREET)
2.5.4.10 organizationName (O)
2.5.4.11 organizationalUnitName (OU)
2.5.4.12 title
2.5.4.13 description
2.5.4.15 businessCategory
2.5.4.16 postalAddress
2.5.4.17 postalCode
2.5.4.18 postOfficeBox
2.5.4.20 telephoneNumber
2.5.4.41 name
2.5.4.42 givenName (GN)
2.5.4.43 initials
2.5.4.44 generationQualifier
2.5.4.45 x500UniqueIdentifier
2.5.4.46 dnQualifier
2.5.4.49 distinguishedName
2.5.4.51 houseIdentifier
2.5.4.65 pseudonym
2.5.4.97 organizationIdentifier
0.9.2342.19200300.100.1.1 userId (UID)
0.9.2342.19200300.100.1.25 domainComponent (DC)
1.3.6.1.4.1.311.60.2.1.1 jurisdictionLocalityName
1.3.6.1.4.1.311.60.2.1.2 jurisdictionStateOrProvinceName
1.3.6.1.4.1.311.60.2.1.3 jurisdictionCountryName
1.2.840.113549.1.1.1 rsaEncryption
1.2.840.113549.1.1.2 md2WithRSAEncryption
1.2.840.113549.1.1.3 md4WithRSAEncryption
1.2.840.113549.1.1.4 md5WithRSAEncryption
1.2.840.113549.1.1.5 sha1WithRSAEncryption
1.2.840.113549.1.1.7 rsaesOaep
1.2.840.113549.1.1.8 mgf1
1.2.840.113549.1.1.9 pSpecified
1.2.840.113549.1.1.10 rsassaPss
1.2.840.113549.1.1.11 sha256WithRSAEncryption
1.2.840.113549.1.1.12 sha384WithRSAEncryption
1.2.840.113549.1.1.13 sha512WithRSAEncryption
1.2.840.113549.1.1.14 sha224WithRSAEncryption
1.2.840.113549.1.1.15 sha512-224WithRSAEncryption
1.2.840.113549.1.1.16 sha512-256WithRSAEncryption
1.2.840.113549.1.3.1 dhKeyAgreement
1.2.840.113549.1.5.1 pbeWithMD2AndDES-CBC
1.2.840.113549.1.5.3 pbeWithMD5AndDES-CBC
1.2.840.113549.1.5.4 pbeWithMD2AndRC2-CBC
1.2.840.113549.1.5.6 pbeWithMD5AndRC2-CBC
1.2.840.113549.1.5.10 pbeWithSHA1AndDES-CBC
1.2.840.113549.1.5.11 pbeWithSHA1AndRC2-CBC
1.2.840.113549.1.5.12 pbkdf2
1.2.840.113549.1.5.13 pbes2
1.2.840.113549.1.5.14 pbmac1
1.3.6.1.4.1.11591.4.11 scrypt
1.2.840.113549.1.7.1 data (PKCS#7)
1.2.840.113549.1.7.2 signedData (PKCS#7)
1.2.840.113549.1.7.3 envelopedData (PKCS#7)
1.2.840.113549.1.7.4 signedAndEnvelopedData (PKCS#7)
1.2.840.113549.1.7.5 digestedData (PKCS#7)
1.2.840.113549.1.7.6 encryptedData (PKCS#7)
1.2.840.113549.1.9.1 emailAddress
1.2.840.113549.1.9.2 unstructuredName
1.2.840.113549.1.9.3 contentType
1.2.840.113549.1.9.4 messageDigest
1.2.840.113549.1.9.5 signingTime
1.2.840.113549.1.9.6 counterSignature
1.2.840.113549.1.9.7 challengePassword
1.2.840.113549.1.9.8 unstructuredAddress
1.2.840.113549.1.9.9 extendedCertificateAttributes
1.2.840.113549.1.9.14 extensionRequest
1.2.840.113549.1.9.15 smimeCapabilities
1.2.840.113549.1.9.16.1.4 id-ct-TSTInfo
1.2.840.113549.1.9.16.2.12 id-aa-signingCertificate
1.2.840.113549.1.9.16.2.14 id-aa-timeStampToken
1.2.840.113549.1.9.16.2.47 id-aa-signingCertificateV2
1.2.840.113549.1.9.20 friendlyName
1.2.840.113549.1.9.21 localKeyId
1.2.840.113549.1.9.22.1 x509Certificate (PKCS#12)
1.2.840.113549.1.9.22.2 sdsiCertificate
1.2.840.113549.1.9.23.1 x509Crl
1.2.840.113549.1.12.1.1 pbeWithSHAAnd128BitRC4
1.2.840.113549.1.12.1.2 pbeWithSHAAnd40BitRC4
1.2.840.113549.1.12.1.3 pbeWithSHAAnd3-KeyTripleDES-CBC
1.2.840.113549.1.12.1.4 pbeWithSHAAnd2-KeyTripleDES-CBC
1.2.840.113549.1.12.1.5 pbeWithSHAAnd128BitRC2-CBC
1.2.840.113549.1.12.1.6 pbeWithSHAAnd40BitRC2-CBC
1.2.840.113549.1.12.10.1.1 keyBag
1.2.840.113549.1.12.10.1.2 pkcs8ShroudedKeyBag
1.2.840.113549.1.12.10.1.3 certBag
1.2.840.113549.1.12.10.1.4 crlBag
1.2.840.113549.1.12.10.1.5 secretBag
1.2.840.113549.1.12.10.1.6 safeContentsBag
1.2.840.113549.2.2 md2
1.2.840.113549.2.4 md4
1.2.840.113549.2.5 md5
1.2.840.113549.2.7 hmacWithSHA1
1.2.840.113549.2.8 hmacWithSHA224
1.2.840.113549.2.9 hmacWithSHA256
1.2.840.113549.2.10 hmacWithSHA384
1.2.840.113549.2.11 hmacWithSHA512
1.2.840.113549.2.12 hmacWithSHA512-224
1.2.840.113549.2.13 hmacWithSHA512-256
1.2.840.113549.3.2 rc2-cbc
1.2.840.113549.3.4 rc4
1.2.840.113549.3.7 des-ede3-cbc
1.3.14.3.2.7 des-cbc
1.3.14.3.2.26 sha1
1.3.14.3.2.29 sha1WithRSASignature
1.3.36.3.2.1 ripemd160
1.3.36.3.3.1.2 ripemd160WithRSA
2.16.840.1.101.3.4.2.1 sha256
2.16.840.1.101.3.4.2.2 sha384
2.16.840.1.101.3.4.2.3 sha512
2.16.840.1.101.3.4.2.4 sha224
2.16.840.1.101.3.4.2.5 sha512-224
2.16.840.1.101.3.4.2.6 sha512-256
2.16.840.1.101.3.4.2.7 sha3-224
2.16.840.1.101.3.4.2.8 sha3-256
2.16.840.1.101.3.4.2.9 sha3-384
2.16.840.1.101.3.4.2.10 sha3-512
2.16.840.1.101.3.4.2.11 shake128
2.16.840.1.101.3.4.2.12 shake256
2.16.840.1.101.3.4.1.1 aes128-ECB
2.16.840.1.101.3.4.1.2 aes128-CBC
2.16.840.1.101.3.4.1.3 aes128-OFB
2.16.840.1.101.3.4.1.4 aes128-CFB
2.16.840.1.101.3.4.1.5 aes128-wrap
2.16.840.1.101.3.4.1.6 aes128-GCM
2.16.840.1.101.3.4.1.7 aes128-CCM
2.16.840.1.101.3.4.1.21 aes192-ECB
2.16.840.1.101.3.4.1.22 aes192-CBC
2.16.840.1.101.3.4.1.25 aes192-wrap
2.16.840.1.101.3.4.1.26 aes192-GCM
2.16.840.1.101.3.4.1.27 aes192-CCM
2.16.840.1.101.3.4.1.41 aes256-ECB
2.16.840.1.101.3.4.1.42 aes256-CBC
2.16.840.1.101.3.4.1.43 aes256-OFB
2.16.840.1.101.3.4.1.44 aes256-CFB
2.16.840.1.101.3.4.1.45 aes256-wrap
2.16.840.1.101.3.4.1.46 aes256-GCM
2.16.840.1.101.3.4.1.47 aes256-CCM
1.2.840.10040.4.1 dsa
1.2.840.10040.4.3 dsa-with-sha1
2.16.840.1.101.3.4.3.1 dsa-with-sha224
2.16.840.1.101.3.4.3.2 dsa-with-sha256
2.16.840.1.101.3.4.3.3 dsa-with-sha384
2.16.840.1.101.3.4.3.4 dsa-with-sha512
2.16.840.1.101.3.4.3.17 ML-DSA-44
2.16.840.1.101.3.4.3.18 ML-DSA-65
2.16.840.1.101.3.4.3.19 ML-DSA-87
2.16.840.1.101.3.4.4.1 ML-KEM-512
2.16.840.1.101.3.4.4.2 ML-KEM-768
2.16.840.1.101.3.4.4.3 ML-KEM-1024
1.2.840.10046.2.1 dhpublicnumber
1.2.840.10045.2.1 ecPublicKey
1.2.840.10045.4.1 ecdsa-with-SHA1
1.2.840.10045.4.3.1 ecdsa-with-SHA224
1.2.840.10045.4.3.2 ecdsa-with-SHA256
1.2.840.10045.4.3.3 ecdsa-with-SHA384
1.2.840.10045.4.3.4 ecdsa-with-SHA512
1.2.840.10045.3.1.1 prime192v1 (secp192r1, P-192)
1.2.840.10045.3.1.7 prime256v1 (secp256r1, P-256)
1.3.132.0.10 secp256k1
1.3.132.0.31 secp192k1
1.3.132.0.32 secp224k1
1.3.132.0.33 secp224r1 (P-224)
1.3.132.0.34 secp384r1 (P-384)
1.3.132.0.35 secp521r1 (P-521)
1.3.36.3.3.2.8.1.1.7 brainpoolP256r1
1.3.36.3.3.2.8.1.1.9 brainpoolP320r1
1.3.36.3.3.2.8.1.1.11 brainpoolP384r1
1.3.36.3.3.2.8.1.1.13 brainpoolP512r1
1.3.101.110 X25519
1.3.101.111 X448
1.3.101.112 Ed25519
1.3.101.113 Ed448
1.2.156.10197.1.301 sm2
1.2.156.10197.1.401 sm3
1.2.156.10197.1.501 SM2-with-SM3
2.5.29.9 subjectDirectoryAttributes
2.5.29.14 subjectKeyIdentifier
2.5.29.15 keyUsage
2.5.29.16 privateKeyUsagePeriod
2.5.29.17 subjectAltName
2.5.29.18 issuerAltName
2.5.29.19 basicConstraints
2.5.29.20 cRLNumber
2.5.29.21 cRLReason
2.5.29.23 holdInstructionCode
2.5.29.24 invalidityDate
2.5.29.27 deltaCRLIndicator
2.5.29.28 issuingDistributionPoint
2.5.29.29 certificateIssuer
2.5.29.30 nameConstraints
2.5.29.31 cRLDistributionPoints
2.5.29.32 certificatePolicies
2.5.29.32.0 anyPolicy
2.5.29.33 policyMappings
2.5.29.35 authorityKeyIdentifier
2.5.29.36 policyConstraints
2.5.29.37 extendedKeyUsage
2.5.29.37.0 anyExtendedKeyUsage
2.5.29.46 freshestCRL
2.5.29.54 inhibitAnyPolicy
1.3.6.1.5.5.7.1.1 authorityInfoAccess
1.3.6.1.5.5.7.1.3 qcStatements
1.3.6.1.5.5.7.1.11 subjectInfoAccess
1.3.6.1.5.5.7.1.24 tlsFeature (OCSP Must-Staple)
1.3.6.1.5.5.7.2.1 cps (CPS qualifier)
1.3.6.1.5.5.7.2.2 unotice (user notice)
1.3.6.1.5.5.7.3.1 serverAuth
1.3.6.1.5.5.7.3.2 clientAuth
1.3.6.1.5.5.7.3.3 codeSigning
1.3.6.1.5.5.7.3.4 emailProtection
1.3.6.1.5.5.7.3.5 ipsecEndSystem
1.3.6.1.5.5.7.3.6 ipsecTunnel
1.3.6.1.5.5.7.3.7 ipsecUser
1.3.6.1.5.5.7.3.8 timeStamping
1.3.6.1.5.5.7.3.9 OCSPSigning
1.3.6.1.5.5.7.3.10 dvcs
1.3.6.1.5.5.7.3.17 ipsecIKE
1.3.6.1.5.5.7.3.21 sshClient
1.3.6.1.5.5.7.3.22 sshServer
1.3.6.1.5.5.7.8.5 id-on-xmppAddr
1.3.6.1.5.5.7.48.1 ocsp (OCSP responder)
1.3.6.1.5.5.7.48.1.1 ocspBasic
1.3.6.1.5.5.7.48.1.2 ocspNonce
1.3.6.1.5.5.7.48.1.5 ocspNoCheck
1.3.6.1.5.5.7.48.2 caIssuers
1.3.6.1.5.5.7.48.3 timeStamping (AIA)
1.3.6.1.5.5.7.48.5 caRepository
1.3.6.1.5.2.2 id-pkinit-san (Kerberos principal)
1.3.6.1.5.2.3.4 id-pkinit-KPClientAuth
1.3.6.1.5.2.3.5 id-pkinit-KPKdc
1.3.6.1.4.1.11129.2.4.2 ctPrecertificateSCTs (Signed Certificate Timestamp list)
1.3.6.1.4.1.11129.2.4.3 ctPrecertificatePoison
1.3.6.1.4.1.11129.2.4.4 ctPrecertificateSigning
1.3.6.1.4.1.311.2.1.4 spcIndirectDataContext (Authenticode)
1.3.6.1.4.1.311.2.1.12 spcSpOpusInfo (Authenticode)
1.3.6.1.4.1.311.2.1.21 msCodeInd (individual code signing)
1.3.6.1.4.1.311.2.1.22 msCodeCom (commercial code signing)
1.3.6.1.4.1.311.3.3.1 msCounterSign (Authenticode timestamp)
1.3.6.1.4.1.311.10.3.1 msCTLSign
1.3.6.1.4.1.311.10.3.2 msTimeStamping
1.3.6.1.4.1.311.10.3.3 msSGC (Server Gated Crypto)
1.3.6.1.4.1.311.10.3.4 msEFS (Encrypting File System)
1.3.6.1.4.1.311.10.3.12 msDocumentSigning
1.3.6.1.4.1.311.13.2.1 enrollmentNameValuePair
1.3.6.1.4.1.311.13.2.2 enrollmentCSP
1.3.6.1.4.1.311.13.2.3 osVersion
1.3.6.1.4.1.311.20.2 microsoftCertificateTemplateName
1.3.6.1.4.1.311.20.2.2 msSmartcardLogon
1.3.6.1.4.1.311.20.2.3 msUserPrincipalName (UPN)
1.3.6.1.4.1.311.21.1 msCaVersion
1.3.6.1.4.1.311.21.7 microsoftCertificateTemplate
1.3.6.1.4.1.311.21.10 msApplicationPolicies
1.3.6.1.4.1.311.25.2 msNtdsCaSecurity (SID)
2.16.840.1.113730.1.1 netscapeCertType
2.16.840.1.113730.1.2 netscapeBaseUrl
2.16.840.1.113730.1.3 netscapeRevocationUrl
2.16.840.1.113730.1.4 netscapeCaRevocationUrl
2.16.840.1.113730.1.7 netscapeCertRenewalUrl
2.16.840.1.113730.1.8 netscapeCaPolicyUrl
2.16.840.1.113730.1.12 netscapeSslServerName
2.16.840.1.113730.1.13 netscapeComment
2.16.840.1.113730.4.1 nsServerGatedCrypto
2.23.140.1.1 cabf-ev-guidelines (Extended Validation)
2.23.140.1.2.1 cabf-domain-validated (DV)
2.23.140.1.2.2 cabf-organization-validated (OV)
2.23.140.1.2.3 cabf-individual-validated (IV)
2.23.140.1.3 cabf-ev-code-signing
2.23.140.1.31 cabf-onion-ev
2.23.140.3.1 cabf-ev-guidelines (legacy)
`;

const OID_NAMES: Record<string, string> = parseOidTable(OID_TEXT);

/** Name for an OID (empty string when unknown). */
export function oidName(oid: string): string {
  return OID_NAMES[oid] ?? '';
}

export function oidLabel(oid: string): string {
  const n = OID_NAMES[oid];
  return n ? `${n} (${oid})` : oid;
}

export const OID_COUNT = Object.keys(OID_NAMES).length;

export const OID_LIST: string[] = Object.keys(OID_NAMES);

/* ============================ input detection ============================ */

export interface InputItem {
  label: string;
  der: Uint8Array;
  /** True when the PEM body is RFC 1421-encrypted (the bytes are ciphertext, not DER). */
  legacyEncrypted?: boolean;
  dekInfo?: { cipher: string; iv: string };
}

export interface DecodedInput {
  items: InputItem[];
  format: 'pem' | 'base64' | 'hex' | 'binary';
  warnings: string[];
}

function parsesCompletely(bytes: Uint8Array): boolean {
  if (bytes.length < 2) return false;
  try {
    let p = 0;
    while (p < bytes.length) p = readTlv(bytes, p).end;
    return p === bytes.length;
  } catch {
    return false;
  }
}

function looksLikeText(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 512);
  for (let i = 0; i < n; i++) {
    const b = bytes[i] ?? 0;
    if (!(b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127))) return false;
  }
  return n > 0;
}

/** Auto-detects PEM (any label, several blocks), Base64 or hex text. */
export function decodeInputText(text: string): DecodedInput {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Nothing to decode - paste PEM, Base64 or hex, or drop a file.');
  const warnings: string[] = [];

  if (/-----BEGIN /.test(trimmed)) {
    const blocks = parsePemBlocks(trimmed);
    if (blocks.length === 0)
      throw new Error('Found a "-----BEGIN" line but no matching "-----END" line.');
    const items: InputItem[] = [];
    blocks.forEach((b, i) => {
      if (b.error) {
        warnings.push(`Block ${i + 1} (${b.label}): ${b.error}`);
        return;
      }
      items.push({ label: b.label, der: b.der, legacyEncrypted: b.legacyEncrypted, dekInfo: b.dekInfo });
    });
    if (items.length === 0) throw new Error(warnings.join(' ') || 'No decodable PEM block found.');
    return { items, format: 'pem', warnings };
  }

  const compact = trimmed.replace(/^0x/i, '').replace(/[\s:,]|0x/gi, '');
  const hexOk = compact.length >= 4 && compact.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(compact);
  const b64Ok = /^[A-Za-z0-9+/_-]+={0,2}$/.test(trimmed.replace(/\s+/g, ''));
  let hexBytes: Uint8Array | null = null;
  let b64Bytes: Uint8Array | null = null;
  if (hexOk) hexBytes = fromHex(compact);
  if (b64Ok) {
    try {
      b64Bytes = b64Decode(trimmed);
    } catch {
      b64Bytes = null;
    }
  }
  const hexGood = hexBytes !== null && parsesCompletely(hexBytes);
  const b64Good = b64Bytes !== null && parsesCompletely(b64Bytes);
  if (hexGood && hexBytes) return { items: [{ label: 'DATA', der: hexBytes }], format: 'hex', warnings };
  if (b64Good && b64Bytes) return { items: [{ label: 'DATA', der: b64Bytes }], format: 'base64', warnings };
  if (hexBytes && (!b64Bytes || /^[0-9a-fA-F\s:]+$/.test(trimmed) && /[\s:]/.test(trimmed))) {
    warnings.push('Hex decoded, but the bytes are not a complete, valid ASN.1 structure.');
    return { items: [{ label: 'DATA', der: hexBytes }], format: 'hex', warnings };
  }
  if (b64Bytes) {
    warnings.push('Base64 decoded, but the bytes are not a complete, valid ASN.1 structure.');
    return { items: [{ label: 'DATA', der: b64Bytes }], format: 'base64', warnings };
  }
  throw new Error('Could not detect the input format. Paste PEM, Base64 or hex (or drop a DER file).');
}

/** Bytes from a dropped file: text (PEM/Base64/hex) or raw binary DER/BER. */
export function decodeInputBytes(bytes: Uint8Array): DecodedInput {
  if (bytes.length === 0) throw new Error('The file is empty.');
  if (looksLikeText(bytes)) {
    try {
      return decodeInputText(utf8Decode(bytes));
    } catch (e) {
      if (parsesCompletely(bytes)) return { items: [{ label: 'DATA', der: bytes }], format: 'binary', warnings: [] };
      throw e;
    }
  }
  const warnings: string[] = [];
  if (!parsesCompletely(bytes)) warnings.push('The file is not a complete, valid DER/BER structure; showing what could be parsed.');
  return { items: [{ label: 'DATA', der: bytes }], format: 'binary', warnings };
}

/* ============================= ASN.1 tree ============================= */

const UNIVERSAL_NAMES: Record<number, string> = {
  0: 'EOC', 1: 'BOOLEAN', 2: 'INTEGER', 3: 'BIT STRING', 4: 'OCTET STRING', 5: 'NULL',
  6: 'OBJECT IDENTIFIER', 7: 'ObjectDescriptor', 8: 'EXTERNAL', 9: 'REAL', 10: 'ENUMERATED',
  11: 'EMBEDDED PDV', 12: 'UTF8String', 13: 'RELATIVE-OID', 14: 'TIME', 16: 'SEQUENCE', 17: 'SET',
  18: 'NumericString', 19: 'PrintableString', 20: 'TeletexString', 21: 'VideotexString',
  22: 'IA5String', 23: 'UTCTime', 24: 'GeneralizedTime', 25: 'GraphicString', 26: 'VisibleString',
  27: 'GeneralString', 28: 'UniversalString', 29: 'CHARACTER STRING', 30: 'BMPString',
  31: 'DATE', 32: 'TIME-OF-DAY', 33: 'DATE-TIME', 34: 'DURATION',
};

export function tagName(cls: number, tag: number): string {
  if (cls === 0) return UNIVERSAL_NAMES[tag] ?? `UNIVERSAL ${tag}`;
  if (cls === 2) return `[${tag}]`;
  if (cls === 1) return `APPLICATION ${tag}`;
  return `PRIVATE ${tag}`;
}

export const CLASS_NAMES = ['universal', 'application', 'context-specific', 'private'] as const;

export interface Asn1Node {
  id: number;
  depth: number;
  /** Absolute byte offset of the identifier octet. */
  offset: number;
  headerLen: number;
  /** Content length in bytes. */
  len: number;
  /** Offset just past this element. */
  end: number;
  cls: number;
  tag: number;
  constructed: boolean;
  indef: boolean;
  name: string;
  /** Short decoded value for the tree row. */
  value: string;
  /** Untruncated decoded value (for copy / detail pane). */
  full: string;
  oid?: string;
  oidName?: string;
  /** BIT STRING unused-bit count. */
  unused?: number;
  /** Children came from re-parsing an OCTET/BIT STRING's content as DER. */
  nested?: 'octet' | 'bit';
  error?: string;
  children: Asn1Node[];
}

export interface TreeOptions {
  expandNested: boolean;
  maxDepth: number;
  maxNodes: number;
}

export interface TreeResult {
  roots: Asn1Node[];
  count: number;
  errors: string[];
  /** True when the node cap was hit. */
  truncated: boolean;
}

const PRINTABLE_RE = /^[A-Za-z0-9 '()+,\-./:=?]*$/;
const NUMERIC_RE = /^[0-9 ]*$/;

export interface ParsedTime {
  date: Date;
  iso: string;
}

/** UTCTime / GeneralizedTime → Date (null when malformed). */
export function parseAsnTime(kind: 'utc' | 'gen', s: string): ParsedTime | null {
  let y: number;
  let mo: number;
  let d: number;
  let h: number;
  let mi: number;
  let sec: number;
  let frac = '';
  let tz = 'Z';
  if (kind === 'utc') {
    const m = /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?(Z|[+-]\d{4})$/.exec(s);
    if (!m) return null;
    const yy = Number(m[1]);
    y = yy >= 50 ? 1900 + yy : 2000 + yy;
    mo = Number(m[2]);
    d = Number(m[3]);
    h = Number(m[4]);
    mi = Number(m[5]);
    sec = Number(m[6] ?? '0');
    tz = m[7] ?? 'Z';
  } else {
    const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})?(\d{2})?(?:[.,](\d+))?(Z|[+-]\d{2}(?:\d{2})?)?$/.exec(s);
    if (!m) return null;
    y = Number(m[1]);
    mo = Number(m[2]);
    d = Number(m[3]);
    h = Number(m[4]);
    mi = Number(m[5] ?? '0');
    sec = Number(m[6] ?? '0');
    frac = m[7] ?? '';
    tz = m[8] ?? 'Z';
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || sec > 60) return null;
  const dt = new Date(0);
  dt.setUTCFullYear(y, mo - 1, d);
  dt.setUTCHours(h, mi, Math.min(sec, 59), 0);
  let ms = dt.getTime();
  if (frac) ms += Math.round(Number(`0.${frac}`) * 1000);
  if (tz !== 'Z') {
    const sign = tz.startsWith('-') ? -1 : 1;
    const hh = Number(tz.slice(1, 3));
    const mm = Number(tz.slice(3, 5) || '0');
    ms -= sign * (hh * 60 + mm) * 60000;
  }
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  const iso = date.toISOString().replace('.000Z', 'Z');
  return { date, iso };
}

const latin1 = (c: Uint8Array): string => {
  let s = '';
  for (const b of c) s += String.fromCharCode(b);
  return s;
};

/** Decodes the character string types; returns null for non-string tags. */
export function decodeAsnString(t: Tlv): string | null {
  if (t.cls !== 0) return null;
  const c = tlvContent(t);
  switch (t.tag) {
    case 12:
      return utf8Decode(c, false);
    case 19:
    case 22:
    case 26:
    case 18:
    case 20:
    case 21:
    case 25:
    case 27: {
      let s = '';
      for (const b of c) s += String.fromCharCode(b);
      return s;
    }
    case 30: {
      let s = '';
      for (let i = 0; i + 1 < c.length; i += 2) s += String.fromCharCode(((c[i] ?? 0) << 8) | (c[i + 1] ?? 0));
      return s;
    }
    case 28: {
      let s = '';
      for (let i = 0; i + 3 < c.length; i += 4) {
        const cp = (((c[i] ?? 0) << 24) | ((c[i + 1] ?? 0) << 16) | ((c[i + 2] ?? 0) << 8) | (c[i + 3] ?? 0)) >>> 0;
        s += cp <= 0x10ffff ? String.fromCodePoint(cp) : '�';
      }
      return s;
    }
    default:
      return null;
  }
}

function asciiPreview(c: Uint8Array): string | null {
  if (c.length === 0) return null;
  let printable = 0;
  for (const b of c) if (b >= 32 && b < 127) printable++;
  if (printable / c.length < 0.85) return null;
  let s = '';
  for (const b of c) s += b >= 32 && b < 127 ? String.fromCharCode(b) : '.';
  return s;
}

function hexShort(c: Uint8Array, max = 24): string {
  if (c.length <= max) return toHex(c);
  return `${toHex(c.subarray(0, max))}… (${c.length} bytes)`;
}

/** True when every character of a primitive string type is valid for its tag. */
function primitiveContentOk(t: Tlv): boolean {
  const c = tlvContent(t);
  if (t.cls !== 0) return true;
  switch (t.tag) {
    case 1:
      return c.length === 1;
    case 2:
      return c.length >= 1 && (c.length === 1 || !((c[0] === 0 && ((c[1] ?? 0) & 0x80) === 0) || (c[0] === 0xff && ((c[1] ?? 0) & 0x80) !== 0)));
    case 3:
      return c.length >= 1 && (c[0] ?? 0) <= 7 && (c.length > 1 || c[0] === 0);
    case 5:
      return c.length === 0;
    case 6:
      try {
        decodeOidContent(c);
        return true;
      } catch {
        return false;
      }
    case 10:
      return c.length >= 1 && c.length <= 8;
    case 12:
      try {
        utf8Decode(c, true);
        return true;
      } catch {
        return false;
      }
    case 19:
      return PRINTABLE_RE.test(decodeAsnString(t) ?? '\0');
    case 18:
      return NUMERIC_RE.test(decodeAsnString(t) ?? '\0');
    case 22:
    case 26:
      return c.every((b) => b >= 32 && b < 127);
    case 23:
      return parseAsnTime('utc', latin1(c)) !== null;
    case 24:
      return parseAsnTime('gen', latin1(c)) !== null;
    case 30:
      return c.length % 2 === 0;
    default:
      return true;
  }
}

/** Recursively checks that `t` is a strict, plausible DER structure. */
function plausibleDer(t: Tlv, depth = 0): boolean {
  if (depth > 32) return false;
  if (t.cls === 0) {
    if (t.tag === 0) return false;
    if (t.constructed) {
      if (t.tag !== 16 && t.tag !== 17) return false;
    } else {
      const allowed = [1, 2, 3, 4, 5, 6, 10, 12, 18, 19, 22, 23, 24, 26, 30];
      if (!allowed.includes(t.tag)) return false;
      if (!primitiveContentOk(t)) return false;
    }
  } else if (t.cls === 2) {
    // context-specific content cannot be validated without the schema
  } else {
    return false;
  }
  if (t.constructed) {
    try {
      const end = t.contentStart + t.len;
      let p = t.contentStart;
      while (p < end) {
        const c = readTlv(t.buf, p, end, true);
        if (!plausibleDer(c, depth + 1)) return false;
        p = c.end;
      }
      return p === end;
    } catch {
      return false;
    }
  }
  return true;
}

/** If buf[start,end) is exactly one plausible DER element, returns it. */
function nestedDer(buf: Uint8Array, start: number, end: number, kind: 'octet' | 'bit'): Tlv | null {
  if (end - start < 2) return null;
  try {
    const t = readTlv(buf, start, end, true);
    if (t.end !== end) return null;
    if (kind === 'bit' && !(t.cls === 0 && (t.tag === 16 || t.tag === 17))) return null;
    if (kind === 'octet' && t.cls === 0 && t.tag === 5) return null;
    return plausibleDer(t) ? t : null;
  } catch {
    return null;
  }
}

function formatInteger(c: Uint8Array): { value: string; full: string } {
  if (c.length === 0) return { value: '(empty)', full: '(empty INTEGER)' };
  const v = signedToBigInt(c);
  const hex = toHex(c);
  const bits = v < 0n ? (-v).toString(2).length : v.toString(2).length;
  if (c.length <= 8) {
    return { value: `${v.toString()} (0x${hex})`, full: `${v.toString()}\n0x${hex}` };
  }
  const dec = c.length <= 1024 ? v.toString() : `(${bits}-bit number)`;
  const shortHex = c.length > 20 ? `${toHex(c.subarray(0, 8))}…${toHex(c.subarray(c.length - 4))}` : hex;
  return {
    value: `0x${shortHex} (${bits} bits)`,
    full: `0x${hex}\n${dec}\n${bits} bits`,
  };
}

interface Described {
  value: string;
  full: string;
  oid?: string;
  oidName?: string;
  unused?: number;
}

function describe(t: Tlv): Described {
  const c = tlvContent(t);
  if (t.cls !== 0) {
    if (t.constructed) return { value: '', full: '' };
    const a = asciiPreview(c);
    const hex = toHex(c);
    return {
      value: a ? `"${a.length > 80 ? a.slice(0, 80) + '…' : a}"  ${hexShort(c, 12)}` : hexShort(c),
      full: a ? `${a}\n${hex}` : hex,
    };
  }
  switch (t.tag) {
    case 1: {
      if (c.length !== 1) return { value: `invalid BOOLEAN (${c.length} bytes)`, full: toHex(c) };
      const v = (c[0] ?? 0) !== 0 ? 'TRUE' : 'FALSE';
      return { value: v, full: v };
    }
    case 2:
    case 10: {
      const r = formatInteger(c);
      return r;
    }
    case 3: {
      if (c.length === 0) return { value: 'invalid (empty)', full: '' };
      const unused = c[0] ?? 0;
      const body = c.subarray(1);
      const nbits = body.length * 8 - unused;
      let bits = '';
      if (nbits > 0 && nbits <= 32) {
        for (const b of body) bits += b.toString(2).padStart(8, '0');
        bits = ` ${bits.slice(0, nbits)}b`;
      }
      return {
        value: `${nbits} bits${unused ? ` (${unused} unused)` : ''}${bits} ${nbits > 32 ? hexShort(body, 16) : ''}`.trim(),
        full: toHex(body),
        unused,
      };
    }
    case 4: {
      const a = asciiPreview(c);
      return {
        value: `${c.length} bytes  ${hexShort(c, 20)}${a && c.length > 0 ? `  "${a.length > 40 ? a.slice(0, 40) + '…' : a}"` : ''}`,
        full: toHex(c) + (a ? `\n${a}` : ''),
      };
    }
    case 5:
      return { value: '', full: 'NULL' };
    case 6: {
      let oid: string;
      try {
        oid = decodeOidContent(c);
      } catch {
        return { value: `invalid OID ${toHex(c)}`, full: toHex(c) };
      }
      const n = oidName(oid);
      return { value: n ? `${oid}  (${n})` : oid, full: n ? `${oid}\n${n}` : oid, oid, oidName: n };
    }
    case 13:
      return { value: toHex(c), full: toHex(c) };
    case 23:
    case 24: {
      const raw = latin1(c);
      const p = parseAsnTime(t.tag === 23 ? 'utc' : 'gen', raw);
      return p
        ? { value: `${p.iso}  (${raw})`, full: `${p.iso}\n${raw}` }
        : { value: `invalid time "${raw}"`, full: raw };
    }
    case 9:
      return { value: hexShort(c), full: toHex(c) };
    case 12:
    case 18:
    case 19:
    case 20:
    case 21:
    case 22:
    case 25:
    case 26:
    case 27:
    case 28:
    case 30: {
      const s = decodeAsnString(t) ?? '';
      return { value: `"${s.length > 120 ? s.slice(0, 120) + '…' : s}"`, full: s };
    }
    default:
      if (t.constructed) return { value: '', full: '' };
      return { value: hexShort(c), full: toHex(c) };
  }
}

interface BuildCtx {
  buf: Uint8Array;
  opts: TreeOptions;
  nextId: number;
  errors: string[];
  truncated: boolean;
}

function hexOff(n: number): string {
  return `0x${n.toString(16)}`;
}

function buildLevel(bc: BuildCtx, start: number, end: number, depth: number): Asn1Node[] {
  const out: Asn1Node[] = [];
  let p = start;
  while (p < end) {
    if (bc.nextId >= bc.opts.maxNodes) {
      bc.truncated = true;
      break;
    }
    let t: Tlv;
    try {
      t = readTlv(bc.buf, p, end);
    } catch (e) {
      const msg = e instanceof Asn1Error ? e.message : String(e);
      const off = e instanceof Asn1Error ? e.offset : p;
      const full = `${msg} (at offset ${off} / ${hexOff(off)})`;
      bc.errors.push(full);
      out.push({
        id: bc.nextId++, depth, offset: p, headerLen: 0, len: end - p, end, cls: 0, tag: -1,
        constructed: false, indef: false, name: 'INVALID', value: msg, full, error: full, children: [],
      });
      break;
    }
    const node: Asn1Node = {
      id: bc.nextId++, depth, offset: t.start, headerLen: t.headerLen, len: t.len, end: t.end,
      cls: t.cls, tag: t.tag, constructed: t.constructed, indef: t.indef,
      name: tagName(t.cls, t.tag), value: '', full: '', children: [],
    };
    if (t.constructed) {
      if (depth + 1 >= bc.opts.maxDepth) {
        node.error = `Maximum nesting depth (${bc.opts.maxDepth}) reached - children not shown`;
        bc.errors.push(`${node.error} at offset ${t.start}`);
      } else {
        node.children = buildLevel(bc, t.contentStart, t.contentStart + t.len, depth + 1);
      }
      node.value = `(${node.children.length} elem)`;
      node.full = node.value;
      if (t.indef) node.value += '  indefinite length';
    } else {
      const d = describe(t);
      node.value = d.value;
      node.full = d.full;
      node.oid = d.oid;
      node.oidName = d.oidName;
      node.unused = d.unused;
      if (bc.opts.expandNested && t.cls === 0 && depth + 1 < bc.opts.maxDepth) {
        if (t.tag === 4) {
          const inner = nestedDer(bc.buf, t.contentStart, t.contentStart + t.len, 'octet');
          if (inner) {
            node.nested = 'octet';
            node.children = buildLevel(bc, t.contentStart, t.contentStart + t.len, depth + 1);
          }
        } else if (t.tag === 3 && t.len > 2 && (bc.buf[t.contentStart] ?? 1) === 0) {
          const inner = nestedDer(bc.buf, t.contentStart + 1, t.contentStart + t.len, 'bit');
          if (inner) {
            node.nested = 'bit';
            node.children = buildLevel(bc, t.contentStart + 1, t.contentStart + t.len, depth + 1);
          }
        }
      }
    }
    out.push(node);
    p = t.end;
  }
  return out;
}

/** Parses BER/DER into a displayable tree. Never throws; problems are reported per node. */
export function parseTree(buf: Uint8Array, options?: Partial<TreeOptions>): TreeResult {
  const opts: TreeOptions = { expandNested: true, maxDepth: MAX_DEPTH, maxNodes: 20000, ...options };
  const bc: BuildCtx = { buf, opts, nextId: 0, errors: [], truncated: false };
  const roots = buildLevel(bc, 0, buf.length, 0);
  if (bc.truncated) bc.errors.push(`Node limit reached (${opts.maxNodes}); the rest is not shown.`);
  return { roots, count: bc.nextId, errors: bc.errors, truncated: bc.truncated };
}

export function flattenNodes(roots: Asn1Node[]): Asn1Node[] {
  const out: Asn1Node[] = [];
  const walk = (n: Asn1Node) => {
    out.push(n);
    n.children.forEach(walk);
  };
  roots.forEach(walk);
  return out;
}

export interface NodeJson {
  offset: number;
  headerLength: number;
  length: number;
  class: string;
  tag: number;
  type: string;
  constructed: boolean;
  indefinite?: boolean;
  oid?: string;
  oidName?: string;
  value?: string;
  hex?: string;
  error?: string;
  nested?: string;
  children?: NodeJson[];
}

export function treeToJson(buf: Uint8Array, roots: Asn1Node[]): NodeJson[] {
  const conv = (n: Asn1Node): NodeJson => {
    const j: NodeJson = {
      offset: n.offset,
      headerLength: n.headerLen,
      length: n.len,
      class: CLASS_NAMES[n.cls] ?? 'universal',
      tag: n.tag,
      type: n.name,
      constructed: n.constructed,
    };
    if (n.indef) j.indefinite = true;
    if (n.oid) {
      j.oid = n.oid;
      if (n.oidName) j.oidName = n.oidName;
    } else if (!n.constructed && n.full) {
      j.value = n.full.split('\n')[0];
    }
    if (!n.constructed && !n.nested && n.len <= 4096 && n.tag !== 5)
      j.hex = toHex(buf.subarray(n.offset + n.headerLen, n.offset + n.headerLen + n.len));
    if (n.nested) j.nested = n.nested === 'octet' ? 'DER inside OCTET STRING' : 'DER inside BIT STRING';
    if (n.error) j.error = n.error;
    if (n.children.length) j.children = n.children.map(conv);
    return j;
  };
  return roots.map(conv);
}

/* ============================ X.509 / key decoding ============================ */

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'muted';

export interface SummaryRow {
  label: string;
  value: string;
  mono?: boolean;
  tone?: Tone;
}
export interface SummarySection {
  title: string;
  rows: SummaryRow[];
}
export interface Summary {
  kind: string;
  title: string;
  badges: { text: string; tone: Tone }[];
  sections: SummarySection[];
  children: Summary[];
}

const DN_SHORT: Record<string, string> = {
  '2.5.4.3': 'CN', '2.5.4.4': 'SN', '2.5.4.5': 'serialNumber', '2.5.4.6': 'C', '2.5.4.7': 'L',
  '2.5.4.8': 'ST', '2.5.4.9': 'STREET', '2.5.4.10': 'O', '2.5.4.11': 'OU', '2.5.4.12': 'title',
  '2.5.4.13': 'description', '2.5.4.15': 'businessCategory', '2.5.4.17': 'postalCode',
  '2.5.4.41': 'name', '2.5.4.42': 'GN', '2.5.4.43': 'initials', '2.5.4.44': 'generationQualifier',
  '2.5.4.46': 'dnQualifier', '2.5.4.65': 'pseudonym', '2.5.4.97': 'organizationIdentifier',
  '0.9.2342.19200300.100.1.25': 'DC', '0.9.2342.19200300.100.1.1': 'UID',
  '1.2.840.113549.1.9.1': 'emailAddress', '1.3.6.1.4.1.311.60.2.1.1': 'jurisdictionL',
  '1.3.6.1.4.1.311.60.2.1.2': 'jurisdictionST', '1.3.6.1.4.1.311.60.2.1.3': 'jurisdictionC',
};

export interface RdnAttr {
  oid: string;
  short: string;
  value: string;
}

function oidOf(t: Tlv | undefined): string {
  if (!isUniv(t, 6)) throw new Asn1Error('Expected an OBJECT IDENTIFIER', 0);
  return decodeOidContent(tlvContent(t));
}

function need<T>(v: T | undefined, what: string): T {
  if (v === undefined) throw new Error(`Malformed structure: missing ${what}`);
  return v;
}

/** Parses a Name into RDNs (in encoded order, each a list of attributes). */
export function parseName(name: Tlv): RdnAttr[][] {
  return tlvChildren(name).map((rdn) =>
    tlvChildren(rdn).map((ava) => {
      const k = tlvChildren(ava);
      const oid = oidOf(k[0]);
      const v = need(k[1], 'attribute value');
      const s = decodeAsnString(v);
      return {
        oid,
        short: DN_SHORT[oid] ?? oid,
        value: s !== null ? s : `#${toHex(tlvRaw(v))}`,
      };
    })
  );
}

function escapeDn(s: string): string {
  let out = s.replace(/[\\",+;<>]/g, (m) => `\\${m}`).replace(/\0/g, '\\00');
  if (out.startsWith(' ') || out.startsWith('#')) out = `\\${out}`;
  if (out.endsWith(' ') && !out.endsWith('\\ ')) out = `${out.slice(0, -1)}\\ `;
  return out;
}

/** RFC 4514 string form (most-specific RDN first, i.e. reversed encoding order). */
export function nameToString(rdns: RdnAttr[][]): string {
  return rdns
    .slice()
    .reverse()
    .map((rdn) => rdn.map((a) => `${a.short}=${a.value.startsWith('#') && !DN_SHORT[a.oid] ? a.value : escapeDn(a.value)}`).join('+'))
    .join(',');
}

export function formatName(name: Tlv): string {
  return nameToString(parseName(name));
}

/* --------------------------- IP address helpers --------------------------- */

export function ipToString(c: Uint8Array): string {
  if (c.length === 4) return Array.from(c).join('.');
  if (c.length === 16) {
    const w: number[] = [];
    for (let i = 0; i < 16; i += 2) w.push(((c[i] ?? 0) << 8) | (c[i + 1] ?? 0));
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
    const left = w.slice(0, bestStart).map((x) => x.toString(16)).join(':');
    const right = w.slice(bestStart + bestLen).map((x) => x.toString(16)).join(':');
    return `${left}::${right}`;
  }
  if (c.length === 8 || c.length === 32) {
    const half = c.length / 2;
    return `${ipToString(c.subarray(0, half))}/${ipToString(c.subarray(half))}`;
  }
  return toHex(c, ':');
}

/* ------------------------------ GeneralName ------------------------------ */

function asciiOf(c: Uint8Array): string {
  return utf8Decode(c);
}

export function generalNameToString(t: Tlv): string {
  const c = tlvContent(t);
  if (t.cls !== 2) return `?${tagName(t.cls, t.tag)}:${toHex(c)}`;
  switch (t.tag) {
    case 0: {
      const k = tlvChildren(t);
      const oid = oidOf(k[0]);
      const holder = k[1] ? tlvChildren(k[1])[0] : undefined;
      const val = holder ? (decodeAsnString(holder) ?? toHex(tlvContent(holder))) : '';
      const nm = oidName(oid);
      return `othername:${nm || oid}::${val}`;
    }
    case 1:
      return `email:${asciiOf(c)}`;
    case 2:
      return `DNS:${asciiOf(c)}`;
    case 3:
      return `X400:${toHex(c)}`;
    case 4: {
      const nm = tlvChildren(t)[0];
      return `DirName:${nm ? formatName(nm) : ''}`;
    }
    case 5:
      return `EdiParty:${toHex(c)}`;
    case 6:
      return `URI:${asciiOf(c)}`;
    case 7:
      return `IP:${ipToString(c)}`;
    case 8:
      return `RID:${decodeOidContent(c)}`;
    default:
      return `?[${t.tag}]:${toHex(c)}`;
  }
}

function generalNames(t: Tlv): string[] {
  return tlvChildren(t).map(generalNameToString);
}

/* ------------------------------ public keys ------------------------------ */

export interface KeyInfo {
  type: string;
  algOid: string;
  algName: string;
  /** RSA/DSA modulus size, EC field size or fixed size of the EdDSA/XDH key. */
  bits?: number;
  exponent?: string;
  modulusHex?: string;
  curveOid?: string;
  curveName?: string;
  pointHex?: string;
  description: string;
}

const CURVE_BITS: Record<string, number> = {
  '1.2.840.10045.3.1.1': 192, '1.2.840.10045.3.1.7': 256, '1.3.132.0.10': 256, '1.3.132.0.31': 192,
  '1.3.132.0.32': 224, '1.3.132.0.33': 224, '1.3.132.0.34': 384, '1.3.132.0.35': 521,
  '1.3.36.3.3.2.8.1.1.7': 256, '1.3.36.3.3.2.8.1.1.9': 320, '1.3.36.3.3.2.8.1.1.11': 384,
  '1.3.36.3.3.2.8.1.1.13': 512,
};

export function curveShortName(oid: string): string {
  const n = oidName(oid);
  if (!n) return oid;
  const m = /\(([^)]+)\)/.exec(n);
  if (oid === '1.2.840.10045.3.1.7') return 'P-256 (prime256v1)';
  if (oid === '1.3.132.0.34') return 'P-384 (secp384r1)';
  if (oid === '1.3.132.0.35') return 'P-521 (secp521r1)';
  return m ? n.replace(/ \(.*/, '') : n;
}

/** Decodes SubjectPublicKeyInfo (or an AlgorithmIdentifier + key bits pair). */
export function describeSpki(spki: Tlv): KeyInfo {
  const k = tlvChildren(spki);
  const alg = tlvChildren(need(k[0], 'algorithm'));
  const algOid = oidOf(alg[0]);
  const algName = oidName(algOid) || algOid;
  const bits = need(k[1], 'subjectPublicKey');
  const keyBytes = tlvContent(bits).subarray(1);
  const params = alg[1];
  const base: KeyInfo = { type: algName, algOid, algName, description: algName };
  if (algOid === '1.2.840.113549.1.1.1' || algOid === '1.2.840.113549.1.1.10') {
    const rsa = parseSingle(keyBytes);
    const nums = tlvChildren(rsa);
    const n = intMagnitude(tlvContent(need(nums[0], 'modulus')));
    const e = intMagnitude(tlvContent(need(nums[1], 'exponent')));
    const nbits = bitLength(n);
    return {
      ...base,
      type: algOid === '1.2.840.113549.1.1.10' ? 'RSA-PSS' : 'RSA',
      bits: nbits,
      exponent: bytesToBigInt(e).toString(),
      modulusHex: toHex(n),
      description: `${algOid === '1.2.840.113549.1.1.10' ? 'RSA-PSS' : 'RSA'} ${nbits} bit, exponent ${bytesToBigInt(e).toString()}`,
    };
  }
  if (algOid === '1.2.840.10045.2.1') {
    const curveOid = params && isUniv(params, 6) ? decodeOidContent(tlvContent(params)) : '';
    const cb = CURVE_BITS[curveOid];
    const cn = curveOid ? curveShortName(curveOid) : 'unknown/explicit parameters';
    return {
      ...base,
      type: 'EC',
      bits: cb,
      curveOid,
      curveName: cn,
      pointHex: toHex(keyBytes),
      description: `EC ${cn}${cb ? `, ${cb} bit` : ''}`,
    };
  }
  const fixed: Record<string, [string, number]> = {
    '1.3.101.112': ['Ed25519', 256],
    '1.3.101.113': ['Ed448', 456],
    '1.3.101.110': ['X25519', 256],
    '1.3.101.111': ['X448', 448],
  };
  const f = fixed[algOid];
  if (f) {
    return { ...base, type: f[0], bits: f[1], pointHex: toHex(keyBytes), description: `${f[0]} (${keyBytes.length * 8}-bit key)` };
  }
  if (algOid === '1.2.840.10040.4.1') {
    let nb = 0;
    if (params && params.constructed) {
      const p = tlvChildren(params)[0];
      if (p) nb = bitLength(tlvContent(p));
    }
    return { ...base, type: 'DSA', bits: nb || undefined, description: `DSA${nb ? ` ${nb} bit` : ''}` };
  }
  return { ...base, pointHex: toHex(keyBytes.subarray(0, 64)), description: `${algName} (${keyBytes.length * 8}-bit key data)` };
}

/* ------------------------------- extensions ------------------------------- */

const KU_NAMES = [
  'Digital Signature', 'Non Repudiation', 'Key Encipherment', 'Data Encipherment', 'Key Agreement',
  'Certificate Sign', 'CRL Sign', 'Encipher Only', 'Decipher Only',
];
const NS_CERT_TYPE = [
  'SSL Client', 'SSL Server', 'S/MIME', 'Object Signing', 'Reserved', 'SSL CA', 'S/MIME CA', 'Object Signing CA',
];
const EKU_FRIENDLY: Record<string, string> = {
  '1.3.6.1.5.5.7.3.1': 'TLS Web Server Authentication',
  '1.3.6.1.5.5.7.3.2': 'TLS Web Client Authentication',
  '1.3.6.1.5.5.7.3.3': 'Code Signing',
  '1.3.6.1.5.5.7.3.4': 'E-mail Protection',
  '1.3.6.1.5.5.7.3.8': 'Time Stamping',
  '1.3.6.1.5.5.7.3.9': 'OCSP Signing',
  '2.5.29.37.0': 'Any Extended Key Usage',
};

export function bitStringFlags(t: Tlv): boolean[] {
  const c = tlvContent(t);
  const unused = c[0] ?? 0;
  const out: boolean[] = [];
  for (let i = 1; i < c.length; i++) {
    const b = c[i] ?? 0;
    for (let bit = 7; bit >= 0; bit--) out.push(((b >> bit) & 1) === 1);
  }
  return out.slice(0, Math.max(0, out.length - unused));
}

const EXT_TITLES: Record<string, string> = {
  '2.5.29.14': 'Subject Key Identifier', '2.5.29.15': 'Key Usage', '2.5.29.17': 'Subject Alternative Name',
  '2.5.29.18': 'Issuer Alternative Name', '2.5.29.19': 'Basic Constraints', '2.5.29.30': 'Name Constraints',
  '2.5.29.31': 'CRL Distribution Points', '2.5.29.32': 'Certificate Policies', '2.5.29.35': 'Authority Key Identifier',
  '2.5.29.37': 'Extended Key Usage', '2.5.29.46': 'Freshest CRL', '2.5.29.54': 'Inhibit anyPolicy',
  '1.3.6.1.5.5.7.1.1': 'Authority Information Access', '1.3.6.1.5.5.7.1.11': 'Subject Information Access',
  '1.3.6.1.5.5.7.1.24': 'TLS Feature', '1.3.6.1.4.1.11129.2.4.2': 'Signed Certificate Timestamps (SCT list)',
  '1.3.6.1.4.1.11129.2.4.3': 'CT Precertificate Poison', '1.3.6.1.5.5.7.48.1.5': 'OCSP No Check',
  '2.16.840.1.113730.1.1': 'Netscape Certificate Type', '2.16.840.1.113730.1.13': 'Netscape Comment',
  '1.3.6.1.4.1.311.20.2': 'Microsoft Certificate Template Name', '1.3.6.1.4.1.311.21.7': 'Microsoft Certificate Template',
  '2.5.29.20': 'CRL Number',
};

export function extTitle(e: { oid: string; name: string }): string {
  return EXT_TITLES[e.oid] ?? e.name;
}

export interface ExtInfo {
  oid: string;
  name: string;
  critical: boolean;
  lines: string[];
  /** Raw extnValue content (the DER inside the OCTET STRING). */
  value: Uint8Array;
}

function sctLines(ext: Uint8Array): string[] {
  const outer = parseSingle(ext);
  const list = tlvContent(outer);
  const lines: string[] = [];
  if (list.length < 2) return ['(empty SCT list)'];
  const total = ((list[0] ?? 0) << 8) | (list[1] ?? 0);
  let p = 2;
  let n = 0;
  while (p + 2 <= Math.min(list.length, 2 + total)) {
    const len = ((list[p] ?? 0) << 8) | (list[p + 1] ?? 0);
    const sct = list.subarray(p + 2, p + 2 + len);
    p += 2 + len;
    n++;
    if (sct.length < 41) {
      lines.push(`SCT #${n}: truncated`);
      continue;
    }
    const ver = (sct[0] ?? 0) + 1;
    const logId = toHex(sct.subarray(1, 33));
    let ts = 0;
    for (let i = 33; i < 41; i++) ts = ts * 256 + (sct[i] ?? 0);
    const when = new Date(ts).toISOString().replace('.000Z', 'Z');
    lines.push(`SCT #${n}: v${ver}, log ${logId.slice(0, 16)}…, ${when}`);
  }
  lines.unshift(`${n} Signed Certificate Timestamp${n === 1 ? '' : 's'}`);
  return lines;
}

function distributionPoints(t: Tlv): string[] {
  const lines: string[] = [];
  for (const dp of tlvChildren(t)) {
    for (const f of tlvChildren(dp)) {
      if (isCtx(f, 0)) {
        const inner = tlvChildren(f)[0];
        if (inner && isCtx(inner, 0)) lines.push(...generalNames(inner));
        else if (inner) lines.push('(relative name)');
      } else if (isCtx(f, 1)) lines.push('reasons: present');
      else if (isCtx(f, 2)) lines.push(...generalNames(f).map((s) => `CRL issuer ${s}`));
    }
  }
  return lines;
}

function policyLines(t: Tlv): string[] {
  const lines: string[] = [];
  for (const pi of tlvChildren(t)) {
    const k = tlvChildren(pi);
    const oid = oidOf(k[0]);
    lines.push(`Policy: ${oidName(oid) ? `${oidName(oid)} (${oid})` : oid}`);
    const quals = k[1];
    if (quals) {
      for (const q of tlvChildren(quals)) {
        const qk = tlvChildren(q);
        const qo = oidOf(qk[0]);
        const qv = qk[1];
        if (qo === '1.3.6.1.5.5.7.2.1' && qv) lines.push(`  CPS: ${decodeAsnString(qv) ?? ''}`);
        else if (qo === '1.3.6.1.5.5.7.2.2' && qv) {
          const texts = tlvChildren(qv).map((x) => decodeAsnString(x)).filter((x): x is string => !!x);
          lines.push(`  User Notice: ${texts.join(' ')}`);
        } else lines.push(`  Qualifier: ${oidName(qo) || qo}`);
      }
    }
  }
  return lines;
}

function subtreeLines(t: Tlv, label: string): string[] {
  return tlvChildren(t).map((st) => {
    const gn = tlvChildren(st)[0];
    return `${label}: ${gn ? generalNameToString(gn) : '?'}`;
  });
}

/** Human-readable lines for a known extension; unknown extensions yield a size note. */
export function decodeExtensionValue(oid: string, value: Uint8Array): string[] {
  switch (oid) {
    case '2.5.29.17':
    case '2.5.29.18': {
      return generalNames(parseSingle(value));
    }
    case '2.5.29.15': {
      const flags = bitStringFlags(parseSingle(value));
      const names = KU_NAMES.filter((_, i) => flags[i]);
      return names.length ? names : ['(none)'];
    }
    case '2.5.29.37': {
      return tlvChildren(parseSingle(value)).map((o) => {
        const id = oidOf(o);
        return EKU_FRIENDLY[id] ? `${EKU_FRIENDLY[id]} (${id})` : oidName(id) ? `${oidName(id)} (${id})` : id;
      });
    }
    case '2.5.29.19': {
      const k = tlvChildren(parseSingle(value));
      let ca = false;
      let path: bigint | null = null;
      for (const x of k) {
        if (isUniv(x, 1)) ca = (tlvContent(x)[0] ?? 0) !== 0;
        else if (isUniv(x, 2)) path = signedToBigInt(tlvContent(x));
      }
      return [`CA: ${ca ? 'TRUE' : 'FALSE'}`, ...(path !== null ? [`pathlen: ${path.toString()}`] : [])];
    }
    case '2.5.29.14': {
      const t = parseSingle(value);
      return [toHex(tlvContent(t), ':').toUpperCase()];
    }
    case '2.5.29.35': {
      const lines: string[] = [];
      for (const f of tlvChildren(parseSingle(value))) {
        if (isCtx(f, 0)) lines.push(`keyid: ${toHex(tlvContent(f), ':').toUpperCase()}`);
        else if (isCtx(f, 1)) lines.push(...generalNames(f).map((s) => `issuer: ${s}`));
        else if (isCtx(f, 2)) lines.push(`serial: ${toHex(tlvContent(f), ':').toUpperCase()}`);
      }
      return lines;
    }
    case '2.5.29.31':
    case '2.5.29.46':
      return distributionPoints(parseSingle(value));
    case '1.3.6.1.5.5.7.1.1':
    case '1.3.6.1.5.5.7.1.11': {
      return tlvChildren(parseSingle(value)).map((ad) => {
        const k = tlvChildren(ad);
        const m = oidOf(k[0]);
        const loc = k[1] ? generalNameToString(k[1]) : '';
        const label = m === '1.3.6.1.5.5.7.48.1' ? 'OCSP' : m === '1.3.6.1.5.5.7.48.2' ? 'CA Issuers' : oidName(m) || m;
        return `${label} - ${loc}`;
      });
    }
    case '2.5.29.32':
      return policyLines(parseSingle(value));
    case '2.5.29.30': {
      const lines: string[] = [];
      for (const f of tlvChildren(parseSingle(value))) {
        if (isCtx(f, 0)) lines.push(...subtreeLines(f, 'Permitted'));
        else if (isCtx(f, 1)) lines.push(...subtreeLines(f, 'Excluded'));
      }
      return lines;
    }
    case '1.3.6.1.4.1.11129.2.4.2':
      return sctLines(value);
    case '1.3.6.1.4.1.11129.2.4.3':
      return ['CT precertificate poison (critical marker)'];
    case '1.3.6.1.5.5.7.48.1.5':
      return ['OCSP No Check'];
    case '1.3.6.1.5.5.7.1.24': {
      return tlvChildren(parseSingle(value)).map((x) => {
        const n = Number(signedToBigInt(tlvContent(x)));
        return n === 5 ? 'status_request (OCSP Must-Staple)' : n === 17 ? 'status_request_v2' : `feature ${n}`;
      });
    }
    case '2.16.840.1.113730.1.1': {
      const flags = bitStringFlags(parseSingle(value));
      return NS_CERT_TYPE.filter((_, i) => flags[i]);
    }
    case '2.16.840.1.113730.1.13':
    case '2.16.840.1.113730.1.2':
    case '2.16.840.1.113730.1.3':
    case '2.16.840.1.113730.1.8':
    case '2.16.840.1.113730.1.12': {
      const t = parseSingle(value);
      return [decodeAsnString(t) ?? toHex(tlvContent(t))];
    }
    case '1.3.6.1.4.1.311.20.2': {
      const t = parseSingle(value);
      return [decodeAsnString(t) ?? toHex(tlvContent(t))];
    }
    case '1.3.6.1.4.1.311.21.7': {
      const k = tlvChildren(parseSingle(value));
      const o = oidOf(k[0]);
      return [`Template OID: ${o}`, `Version: ${k[1] ? signedToBigInt(tlvContent(k[1])).toString() : '?'}.${k[2] ? signedToBigInt(tlvContent(k[2])).toString() : '?'}`];
    }
    case '2.5.29.20':
    case '1.3.6.1.4.1.311.21.1': {
      const t = parseSingle(value);
      return [signedToBigInt(tlvContent(t)).toString()];
    }
    case '2.5.29.54': {
      const t = parseSingle(value);
      return [`skip certs: ${signedToBigInt(tlvContent(t)).toString()}`];
    }
    default:
      return [`${value.length} bytes: ${toHex(value.subarray(0, 32))}${value.length > 32 ? '…' : ''}`];
  }
}

export function parseExtensions(extsSeq: Tlv): ExtInfo[] {
  const out: ExtInfo[] = [];
  for (const e of tlvChildren(extsSeq)) {
    const k = tlvChildren(e);
    const oid = oidOf(k[0]);
    let critical = false;
    let idx = 1;
    if (k[1] && isUniv(k[1], 1)) {
      critical = (tlvContent(k[1])[0] ?? 0) !== 0;
      idx = 2;
    }
    const v = tlvContent(need(k[idx], 'extension value'));
    let lines: string[];
    try {
      lines = decodeExtensionValue(oid, v);
    } catch (err) {
      lines = [`(could not decode: ${err instanceof Error ? err.message : String(err)})`, `${v.length} bytes: ${toHex(v.subarray(0, 32))}`];
    }
    out.push({ oid, name: oidName(oid) || oid, critical, lines, value: v });
  }
  return out;
}

/* ------------------------------ signatures ------------------------------ */

const HASH_BY_OID: Record<string, HashName> = {
  '1.3.14.3.2.26': 'SHA-1',
  '2.16.840.1.101.3.4.2.1': 'SHA-256',
  '2.16.840.1.101.3.4.2.2': 'SHA-384',
  '2.16.840.1.101.3.4.2.3': 'SHA-512',
};

function derSigToRaw(sig: Uint8Array, size: number): Uint8Array | null {
  try {
    const k = tlvChildren(parseSingle(sig));
    const r = intMagnitude(tlvContent(need(k[0], 'r')));
    const s = intMagnitude(tlvContent(need(k[1], 's')));
    if (r.length > size || s.length > size) return null;
    const out = new Uint8Array(size * 2);
    out.set(r, size - r.length);
    out.set(s, size * 2 - s.length);
    return out;
  } catch {
    return null;
  }
}

export type SigCheck = 'valid' | 'invalid' | 'unsupported';

/** Verifies a signature with WebCrypto. `sigAlg` is the AlgorithmIdentifier element. */
export async function verifySignature(
  spkiDer: Uint8Array,
  sigAlg: Tlv,
  data: Uint8Array,
  signature: Uint8Array
): Promise<SigCheck> {
  try {
    const ak = tlvChildren(sigAlg);
    const oid = oidOf(ak[0]);
    const spki = describeSpki(parseSingle(spkiDer));
    const pkcs1: Record<string, HashName> = {
      '1.2.840.113549.1.1.5': 'SHA-1', '1.2.840.113549.1.1.11': 'SHA-256',
      '1.2.840.113549.1.1.12': 'SHA-384', '1.2.840.113549.1.1.13': 'SHA-512',
    };
    const ecdsa: Record<string, HashName> = {
      '1.2.840.10045.4.1': 'SHA-1', '1.2.840.10045.4.3.2': 'SHA-256',
      '1.2.840.10045.4.3.3': 'SHA-384', '1.2.840.10045.4.3.4': 'SHA-512',
    };
    const h1 = pkcs1[oid];
    if (h1 && spki.type === 'RSA') {
      const key = await wc.subtle.importKey('spki', bs(spkiDer), { name: 'RSASSA-PKCS1-v1_5', hash: h1 }, false, ['verify']);
      return (await wc.subtle.verify('RSASSA-PKCS1-v1_5', key, bs(signature), bs(data))) ? 'valid' : 'invalid';
    }
    if (oid === '1.2.840.113549.1.1.10') {
      let hash: HashName = 'SHA-1';
      let salt = 20;
      for (const f of tlvChildren(need(ak[1], 'PSS parameters'))) {
        if (isCtx(f, 0)) hash = HASH_BY_OID[oidOf(tlvChildren(tlvChildren(f)[0] ?? f)[0])] ?? hash;
        else if (isCtx(f, 2)) salt = Number(signedToBigInt(tlvContent(tlvChildren(f)[0] ?? f)));
      }
      const key = await wc.subtle.importKey('spki', bs(spkiDer), { name: 'RSA-PSS', hash }, false, ['verify']);
      return (await wc.subtle.verify({ name: 'RSA-PSS', saltLength: salt }, key, bs(signature), bs(data))) ? 'valid' : 'invalid';
    }
    const h2 = ecdsa[oid];
    if (h2 && spki.type === 'EC') {
      const curve = spki.curveOid === '1.2.840.10045.3.1.7' ? 'P-256' : spki.curveOid === '1.3.132.0.34' ? 'P-384' : spki.curveOid === '1.3.132.0.35' ? 'P-521' : '';
      if (!curve) return 'unsupported';
      const size = curve === 'P-256' ? 32 : curve === 'P-384' ? 48 : 66;
      const raw = derSigToRaw(signature, size);
      if (!raw) return 'invalid';
      const key = await wc.subtle.importKey('spki', bs(spkiDer), { name: 'ECDSA', namedCurve: curve }, false, ['verify']);
      return (await wc.subtle.verify({ name: 'ECDSA', hash: h2 }, key, bs(raw), bs(data))) ? 'valid' : 'invalid';
    }
    if (oid === '1.3.101.112' && spki.type === 'Ed25519') {
      const key = await wc.subtle.importKey('spki', bs(spkiDer), { name: 'Ed25519' }, false, ['verify']);
      return (await wc.subtle.verify({ name: 'Ed25519' }, key, bs(signature), bs(data))) ? 'valid' : 'invalid';
    }
    return 'unsupported';
  } catch {
    return 'unsupported';
  }
}

/* ------------------------------ certificates ------------------------------ */

export interface CertInfo {
  version: number;
  serialHex: string;
  serialDecimal: string;
  sigAlgOid: string;
  sigAlgName: string;
  issuer: string;
  subject: string;
  notBefore: ParsedTime;
  notAfter: ParsedTime;
  key: KeyInfo;
  extensions: ExtInfo[];
  selfSigned: boolean;
  isCa: boolean | null;
  sha1: string;
  sha256: string;
  spkiPin: string;
  signatureBits: number;
  signature: SigCheck | null;
  der: Uint8Array;
}

const colonUpper = (b: Uint8Array): string => toHex(b, ':').toUpperCase();

function timeOf(t: Tlv | undefined, what: string): ParsedTime {
  if (!t || t.cls !== 0 || (t.tag !== 23 && t.tag !== 24)) throw new Error(`Malformed certificate: ${what} is not a time`);
  const p = parseAsnTime(t.tag === 23 ? 'utc' : 'gen', latin1(tlvContent(t)));
  if (!p) throw new Error(`Malformed certificate: invalid ${what}`);
  return p;
}

export function serialHexOf(content: Uint8Array): string {
  return toHex(intMagnitude(content), ':');
}

export async function parseCertificate(input: Uint8Array): Promise<CertInfo> {
  const top = readTlv(input, 0);
  const der = input.subarray(0, top.end);
  if (!isUniv(top, 16)) throw new Error('Not a certificate: expected a SEQUENCE');
  const c = tlvChildren(top);
  const tbs = c[0];
  const sigAlgTlv = c[1];
  const sigBits = c[2];
  if (!tbs || !isUniv(tbs, 16) || !sigAlgTlv || !sigBits || !isUniv(sigBits, 3))
    throw new Error('Not a certificate: expected SEQUENCE { tbsCertificate, signatureAlgorithm, signature }');
  const k = tlvChildren(tbs);
  let i = 0;
  let version = 1;
  const v0 = k[0];
  if (isCtx(v0, 0)) {
    const vi = tlvChildren(v0)[0];
    version = Number(signedToBigInt(tlvContent(need(vi, 'version')))) + 1;
    i = 1;
  }
  const serial = need(k[i++], 'serial number');
  const tbsSigAlg = need(k[i++], 'signature algorithm');
  const issuer = need(k[i++], 'issuer');
  const validity = need(k[i++], 'validity');
  const subject = need(k[i++], 'subject');
  const spki = need(k[i++], 'subjectPublicKeyInfo');
  const sigAlgOid = oidOf(tlvChildren(sigAlgTlv)[0]);
  void tbsSigAlg;
  const vk = tlvChildren(validity);
  const key = describeSpki(spki);
  let extensions: ExtInfo[] = [];
  for (; i < k.length; i++) {
    const x = k[i];
    if (isCtx(x, 3)) {
      const eseq = tlvChildren(x)[0];
      if (eseq) extensions = parseExtensions(eseq);
    }
  }
  const sigContent = tlvContent(sigBits);
  const sigBytes = sigContent.subarray(1);
  const serialContent = tlvContent(serial);
  const bc = extensions.find((e) => e.oid === '2.5.29.19');
  const isCa = bc ? bc.lines.some((l) => l === 'CA: TRUE') : version >= 3 ? false : null;
  const selfSigned = bytesEqual(tlvRaw(issuer), tlvRaw(subject));
  const [sha1, sha256, pin] = await Promise.all([
    digest('SHA-1', der),
    digest('SHA-256', der),
    digest('SHA-256', tlvRaw(spki)),
  ]);
  let signature: SigCheck | null = null;
  if (selfSigned) signature = await verifySignature(tlvRaw(spki), sigAlgTlv, tlvRaw(tbs), sigBytes);
  const serialMag = intMagnitude(serialContent);
  return {
    version,
    serialHex: toHex(serialMag, ':'),
    serialDecimal: signedToBigInt(serialContent).toString(),
    sigAlgOid,
    sigAlgName: oidName(sigAlgOid) || sigAlgOid,
    issuer: formatName(issuer),
    subject: formatName(subject),
    notBefore: timeOf(vk[0], 'notBefore'),
    notAfter: timeOf(vk[1], 'notAfter'),
    key,
    extensions,
    selfSigned,
    isCa,
    sha1: colonUpper(sha1),
    sha256: colonUpper(sha256),
    spkiPin: b64Encode(pin),
    signatureBits: sigBytes.length * 8,
    signature,
    der,
  };
}

const DAY = 86400000;

export function validityStatus(nb: Date, na: Date, now: Date): { tone: Tone; text: string; state: 'valid' | 'expired' | 'not-yet' } {
  const t = now.getTime();
  if (t < nb.getTime()) {
    const d = Math.ceil((nb.getTime() - t) / DAY);
    return { tone: 'warn', state: 'not-yet', text: `Not yet valid - becomes valid in ${d} day${d === 1 ? '' : 's'}` };
  }
  if (t > na.getTime()) {
    const d = Math.floor((t - na.getTime()) / DAY);
    return { tone: 'bad', state: 'expired', text: d < 1 ? 'Expired less than a day ago' : `Expired ${d} day${d === 1 ? '' : 's'} ago` };
  }
  const d = Math.floor((na.getTime() - t) / DAY);
  const text = d < 1 ? 'Valid - expires in less than a day' : `Valid - expires in ${d} day${d === 1 ? '' : 's'}`;
  return { tone: d <= 30 ? 'warn' : 'ok', state: 'valid', text };
}

function keyWarnings(key: KeyInfo, sigAlgName: string): string[] {
  const w: string[] = [];
  if (key.type === 'RSA' && key.bits !== undefined && key.bits < 2048) w.push(`RSA key is only ${key.bits} bits - considered weak (2048+ recommended).`);
  if (/md2|md4|md5/i.test(sigAlgName)) w.push(`Signature uses ${sigAlgName}: broken hash, do not trust.`);
  else if (/sha1/i.test(sigAlgName)) w.push(`Signature uses ${sigAlgName}: SHA-1 is deprecated and rejected by browsers.`);
  return w;
}

function keyRows(key: KeyInfo): SummaryRow[] {
  const rows: SummaryRow[] = [{ label: 'Algorithm', value: key.description }];
  if (key.type === 'RSA' || key.type === 'RSA-PSS') {
    rows.push({ label: 'Modulus size', value: `${key.bits} bits` });
    rows.push({ label: 'Public exponent', value: key.exponent ?? '', mono: true });
    if (key.modulusHex) rows.push({ label: 'Modulus', value: key.modulusHex.replace(/(.{64})/g, '$1\n').trim(), mono: true });
  } else if (key.type === 'EC') {
    rows.push({ label: 'Curve', value: `${key.curveName ?? ''}${key.curveOid ? `  (${key.curveOid})` : ''}` });
    if (key.pointHex) rows.push({ label: 'Public point', value: key.pointHex.replace(/(.{64})/g, '$1\n').trim(), mono: true });
  } else if (key.pointHex) {
    rows.push({ label: 'Public key', value: key.pointHex.replace(/(.{64})/g, '$1\n').trim(), mono: true });
  }
  return rows;
}

export function certificateSummary(info: CertInfo, now: Date): Summary {
  const st = validityStatus(info.notBefore.date, info.notAfter.date, now);
  const days = Math.round((info.notAfter.date.getTime() - info.notBefore.date.getTime()) / DAY);
  const badges: Summary['badges'] = [
    { text: st.state === 'valid' ? 'Valid' : st.state === 'expired' ? 'Expired' : 'Not yet valid', tone: st.state === 'valid' ? 'ok' : st.state === 'expired' ? 'bad' : 'warn' },
    { text: info.isCa ? 'CA certificate' : 'End-entity', tone: 'info' },
  ];
  if (info.selfSigned) badges.push({ text: 'Self-signed', tone: 'info' });
  const sections: SummarySection[] = [];
  sections.push({
    title: 'Certificate',
    rows: [
      { label: 'Version', value: `v${info.version}` },
      { label: 'Serial number', value: info.serialHex, mono: true },
      ...(info.serialHex.replace(/:/g, '').length <= 16 ? [{ label: 'Serial (decimal)', value: info.serialDecimal, mono: true }] : []),
      { label: 'Signature algorithm', value: `${info.sigAlgName}  (${info.sigAlgOid})` },
      { label: 'Issuer', value: info.issuer, mono: true },
      { label: 'Subject', value: info.subject || '(empty)', mono: true },
      ...(info.selfSigned ? [{ label: 'Self-signed', value: 'Yes - issuer and subject are identical', tone: 'info' as Tone }] : []),
    ],
  });
  sections.push({
    title: 'Validity',
    rows: [
      { label: 'Not before', value: info.notBefore.iso, mono: true },
      { label: 'Not after', value: info.notAfter.iso, mono: true },
      { label: 'Lifetime', value: `${days} day${days === 1 ? '' : 's'}` },
      { label: 'Status', value: st.text, tone: st.tone },
    ],
  });
  sections.push({ title: 'Public key', rows: [...keyRows(info.key), { label: 'SPKI pin (sha256, base64)', value: info.spkiPin, mono: true }] });
  if (info.extensions.length) {
    sections.push({
      title: `Extensions (${info.extensions.length})`,
      rows: info.extensions.map((e) => ({
        label: `${extTitle(e)}${e.critical ? ' - critical' : ''}`,
        value: e.lines.join('\n'),
        mono: true,
        tone: e.critical ? ('warn' as Tone) : undefined,
      })),
    });
  } else if (info.version >= 3) {
    sections.push({ title: 'Extensions', rows: [{ label: 'Extensions', value: 'none', tone: 'muted' }] });
  }
  sections.push({
    title: 'Fingerprints',
    rows: [
      { label: 'SHA-256', value: info.sha256, mono: true },
      { label: 'SHA-1', value: info.sha1, mono: true },
    ],
  });
  const sigRows: SummaryRow[] = [{ label: 'Signature', value: `${info.signatureBits} bits` }];
  if (info.signature) {
    sigRows.push({
      label: 'Self-signature check',
      value: info.signature === 'valid' ? 'Valid - signature verifies with the certificate\'s own public key' : info.signature === 'invalid' ? 'INVALID - signature does not verify' : 'Not checked (algorithm not supported by this browser)',
      tone: info.signature === 'valid' ? 'ok' : info.signature === 'invalid' ? 'bad' : 'muted',
    });
  }
  sections.push({ title: 'Signature', rows: sigRows });
  const warnings = keyWarnings(info.key, info.sigAlgName);
  if (info.version >= 3 && !info.isCa && !info.extensions.some((e) => e.oid === '2.5.29.17') && /(^|,)CN=/.test(info.subject))
    warnings.push('No Subject Alternative Name: modern browsers ignore the Common Name for TLS host matching.');
  if (warnings.length) sections.unshift({ title: 'Warnings', rows: warnings.map((w) => ({ label: '!', value: w, tone: 'warn' as Tone })) });
  return {
    kind: 'X.509 certificate',
    title: info.subject || info.issuer || 'X.509 certificate',
    badges,
    sections,
    children: [],
  };
}

/* ----------------------------------- CSR ----------------------------------- */

export interface CsrInfo {
  version: number;
  subject: string;
  key: KeyInfo;
  sigAlgOid: string;
  sigAlgName: string;
  attributes: { oid: string; name: string; lines: string[] }[];
  extensions: ExtInfo[];
  signature: SigCheck;
  signatureBits: number;
  spkiPin: string;
}

export async function parseCsr(input: Uint8Array): Promise<CsrInfo> {
  const top = readTlv(input, 0);
  if (!isUniv(top, 16)) throw new Error('Not a CSR: expected a SEQUENCE');
  const c = tlvChildren(top);
  const info = c[0];
  const sigAlgTlv = c[1];
  const sigBits = c[2];
  if (!info || !sigAlgTlv || !sigBits || !isUniv(sigBits, 3)) throw new Error('Not a CSR: expected SEQUENCE { certificationRequestInfo, algorithm, signature }');
  const k = tlvChildren(info);
  const version = Number(signedToBigInt(tlvContent(need(k[0], 'version'))));
  const subject = need(k[1], 'subject');
  const spki = need(k[2], 'subjectPKInfo');
  const attrs: CsrInfo['attributes'] = [];
  let extensions: ExtInfo[] = [];
  const a0 = k[3];
  if (isCtx(a0, 0)) {
    for (const at of tlvChildren(a0)) {
      const ak = tlvChildren(at);
      const oid = oidOf(ak[0]);
      const vals = ak[1] ? tlvChildren(ak[1]) : [];
      if (oid === '1.2.840.113549.1.9.14' && vals[0]) {
        extensions = parseExtensions(vals[0]);
        attrs.push({ oid, name: oidName(oid), lines: [`${extensions.length} extension(s) - see below`] });
      } else {
        attrs.push({
          oid,
          name: oidName(oid) || oid,
          lines: vals.map((v) => decodeAsnString(v) ?? (v.constructed ? `(${tlvChildren(v).length} elements)` : toHex(tlvContent(v)))),
        });
      }
    }
  }
  const sigBytes = tlvContent(sigBits).subarray(1);
  const sigAlgOid = oidOf(tlvChildren(sigAlgTlv)[0]);
  const signature = await verifySignature(tlvRaw(spki), sigAlgTlv, tlvRaw(info), sigBytes);
  const pin = await digest('SHA-256', tlvRaw(spki));
  return {
    version: version + 1,
    subject: formatName(subject),
    key: describeSpki(spki),
    sigAlgOid,
    sigAlgName: oidName(sigAlgOid) || sigAlgOid,
    attributes: attrs,
    extensions,
    signature,
    signatureBits: sigBytes.length * 8,
    spkiPin: b64Encode(pin),
  };
}

export function csrSummary(info: CsrInfo): Summary {
  const sections: SummarySection[] = [];
  sections.push({
    title: 'Request',
    rows: [
      { label: 'Version', value: `v${info.version}` },
      { label: 'Subject', value: info.subject || '(empty)', mono: true },
      { label: 'Signature algorithm', value: `${info.sigAlgName}  (${info.sigAlgOid})` },
      {
        label: 'Signature check',
        value: info.signature === 'valid' ? 'Valid - the request is signed by the key it contains (proof of possession)' : info.signature === 'invalid' ? 'INVALID - signature does not verify' : 'Not checked (algorithm not supported by this browser)',
        tone: info.signature === 'valid' ? 'ok' : info.signature === 'invalid' ? 'bad' : 'muted',
      },
    ],
  });
  sections.push({ title: 'Public key', rows: [...keyRows(info.key), { label: 'SPKI pin (sha256, base64)', value: info.spkiPin, mono: true }] });
  const other = info.attributes.filter((a) => a.oid !== '1.2.840.113549.1.9.14');
  if (other.length)
    sections.push({ title: 'Attributes', rows: other.map((a) => ({ label: a.name, value: a.lines.join('\n'), mono: true })) });
  if (info.extensions.length)
    sections.push({
      title: `Requested extensions (${info.extensions.length})`,
      rows: info.extensions.map((e) => ({ label: `${extTitle(e)}${e.critical ? ' - critical' : ''}`, value: e.lines.join('\n'), mono: true })),
    });
  const warnings = keyWarnings(info.key, info.sigAlgName);
  if (warnings.length) sections.unshift({ title: 'Warnings', rows: warnings.map((w) => ({ label: '!', value: w, tone: 'warn' as Tone })) });
  return {
    kind: 'PKCS#10 certification request',
    title: info.subject || 'Certification request',
    badges: [{ text: 'CSR', tone: 'info' }, ...(info.signature === 'valid' ? [{ text: 'Signature OK', tone: 'ok' as Tone }] : info.signature === 'invalid' ? [{ text: 'Bad signature', tone: 'bad' as Tone }] : [])],
    sections,
    children: [],
  };
}

/* ---------------------------------- keys ---------------------------------- */

export interface Pbes2Info {
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
  scryptN?: string;
  scryptR?: number;
  scryptP?: number;
}

export function parseEncryptionAlgorithm(algId: Tlv): Pbes2Info {
  const k = tlvChildren(algId);
  const schemeOid = oidOf(k[0]);
  if (schemeOid === '1.2.840.113549.1.5.13' && k[1]) {
    const p = tlvChildren(k[1]);
    const kdfAlg = tlvChildren(need(p[0], 'key derivation function'));
    const encAlg = tlvChildren(need(p[1], 'encryption scheme'));
    const kdfOid = oidOf(kdfAlg[0]);
    const cipherOid = oidOf(encAlg[0]);
    const info: Pbes2Info = {
      scheme: 'PBES2', schemeOid, kdfOid, kdf: oidName(kdfOid) || kdfOid, cipherOid, cipher: oidName(cipherOid) || cipherOid,
    };
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
      if (prfAlg && isUniv(prfAlg, 16)) {
        info.prfOid = oidOf(tlvChildren(prfAlg)[0]);
      } else info.prfOid = '1.2.840.113549.2.7';
      info.prf = oidName(info.prfOid) || info.prfOid;
    } else if (kdfOid === '1.3.6.1.4.1.11591.4.11') {
      info.salt = kp[0] ? toHex(tlvContent(kp[0])) : undefined;
      info.scryptN = kp[1] ? signedToBigInt(tlvContent(kp[1])).toString() : undefined;
      info.scryptR = kp[2] ? Number(signedToBigInt(tlvContent(kp[2]))) : undefined;
      info.scryptP = kp[3] ? Number(signedToBigInt(tlvContent(kp[3]))) : undefined;
    }
    return info;
  }
  const info: Pbes2Info = { scheme: schemeOid.startsWith('1.2.840.113549.1.12.1.') || schemeOid.startsWith('1.2.840.113549.1.5.') ? 'PBES1' : 'unknown', schemeOid, cipher: oidName(schemeOid) || schemeOid };
  const pp = k[1] && k[1].constructed ? tlvChildren(k[1]) : [];
  if (pp[0] && isUniv(pp[0], 4)) info.salt = toHex(tlvContent(pp[0]));
  if (pp[1] && isUniv(pp[1], 2)) info.iterations = Number(signedToBigInt(tlvContent(pp[1])));
  return info;
}

export interface KeySummaryInfo {
  kind: 'rsa-private' | 'rsa-public' | 'pkcs8' | 'pkcs8-encrypted' | 'ec-private' | 'spki';
}

function privateWarning(): SummaryRow {
  return { label: 'Handle with care', value: 'This is a private key. Anything you paste stays in your browser, but never share a private key.', tone: 'warn' };
}

function rsaPrivateRows(rsaSeq: Tlv): SummaryRow[] {
  const k = tlvChildren(rsaSeq).map((x) => tlvContent(x));
  const get = (i: number): Uint8Array => intMagnitude(k[i] ?? new Uint8Array(0));
  const n = get(1);
  const rows: SummaryRow[] = [
    { label: 'Version', value: String(Number(signedToBigInt(k[0] ?? new Uint8Array(0)))) },
    { label: 'Modulus size', value: `${bitLength(n)} bits` },
    { label: 'Public exponent', value: bytesToBigInt(get(2)).toString(), mono: true },
    { label: 'Prime p', value: `${bitLength(get(4))} bits`, mono: true },
    { label: 'Prime q', value: `${bitLength(get(5))} bits`, mono: true },
    { label: 'CRT parameters', value: k.length >= 9 ? 'dP, dQ, qInv present' : 'missing', mono: true },
    { label: 'Modulus', value: toHex(n).replace(/(.{64})/g, '$1\n').trim(), mono: true },
  ];
  return rows;
}

function ecPrivateRows(ecSeq: Tlv, curveFromAlg?: string): { rows: SummaryRow[]; curveOid: string } {
  const k = tlvChildren(ecSeq);
  let curveOid = curveFromAlg ?? '';
  let pub = '';
  for (const f of k) {
    if (isCtx(f, 0)) {
      const o = tlvChildren(f)[0];
      if (o && isUniv(o, 6)) curveOid = decodeOidContent(tlvContent(o));
    } else if (isCtx(f, 1)) {
      const b = tlvChildren(f)[0];
      if (b && isUniv(b, 3)) pub = toHex(tlvContent(b).subarray(1));
    }
  }
  const priv = k[1] && isUniv(k[1], 4) ? tlvContent(k[1]).length : 0;
  const rows: SummaryRow[] = [
    { label: 'Version', value: String(k[0] ? Number(signedToBigInt(tlvContent(k[0]))) : '?') },
    { label: 'Curve', value: curveOid ? `${curveShortName(curveOid)}  (${curveOid})` : '(not embedded)' },
    { label: 'Private scalar', value: `${priv * 8} bits`, mono: true },
    { label: 'Public key embedded', value: pub ? 'Yes' : 'No' },
  ];
  if (pub) rows.push({ label: 'Public point', value: pub.replace(/(.{64})/g, '$1\n').trim(), mono: true });
  return { rows, curveOid };
}

/** Summarises PKCS#1/PKCS#8/SEC1/SPKI structures; null when the shape is not a key. */
async function keySummary(top: Tlv): Promise<Summary | null> {
  const k = tlvChildren(top);
  const isInt = (t: Tlv | undefined) => isUniv(t, 2);
  // PKCS#1 RSAPrivateKey
  if (k.length >= 9 && k.every(isInt)) {
    const sections: SummarySection[] = [{ title: 'RSA private key (PKCS#1)', rows: [privateWarning(), ...rsaPrivateRows(top)] }];
    const pubParts = [tlvRaw(k[1] as Tlv), tlvRaw(k[2] as Tlv)];
    const pkcs1Pub = seq(...pubParts);
    const spki = seq(seq(derOid('1.2.840.113549.1.1.1'), derNull()), bitString(pkcs1Pub));
    const pin = await digest('SHA-256', spki);
    sections.push({ title: 'Public half', rows: [{ label: 'SPKI pin (sha256, base64)', value: b64Encode(pin), mono: true }] });
    return { kind: 'RSA private key (PKCS#1)', title: `RSA ${bitLength(intMagnitude(tlvContent(k[1] as Tlv)))}-bit private key`, badges: [{ text: 'Private key', tone: 'warn' }], sections, children: [] };
  }
  // PKCS#1 RSAPublicKey
  if (k.length === 2 && isInt(k[0]) && isInt(k[1])) {
    const n = intMagnitude(tlvContent(k[0] as Tlv));
    const e = intMagnitude(tlvContent(k[1] as Tlv));
    const spki = seq(seq(derOid('1.2.840.113549.1.1.1'), derNull()), bitString(tlvRaw(top)));
    const pin = await digest('SHA-256', spki);
    return {
      kind: 'RSA public key (PKCS#1)',
      title: `RSA ${bitLength(n)}-bit public key`,
      badges: [{ text: 'Public key', tone: 'info' }],
      sections: [
        {
          title: 'RSA public key (PKCS#1)',
          rows: [
            { label: 'Modulus size', value: `${bitLength(n)} bits` },
            { label: 'Public exponent', value: bytesToBigInt(e).toString(), mono: true },
            { label: 'Modulus', value: toHex(n).replace(/(.{64})/g, '$1\n').trim(), mono: true },
            { label: 'SPKI pin (sha256, base64)', value: b64Encode(pin), mono: true },
          ],
        },
      ],
      children: [],
    };
  }
  // Encrypted PKCS#8
  if (k.length === 2 && isUniv(k[0], 16) && isUniv(k[1], 4) && isUniv(tlvChildren(k[0] as Tlv)[0], 6)) {
    const algOid = oidOf(tlvChildren(k[0] as Tlv)[0]);
    if (algOid.startsWith('1.2.840.113549.1.5.') || algOid.startsWith('1.2.840.113549.1.12.1.')) {
      const p = parseEncryptionAlgorithm(k[0] as Tlv);
      const rows: SummaryRow[] = [
        { label: 'Scheme', value: `${p.scheme === 'PBES2' ? 'PBES2 (PKCS#5 v2)' : oidName(p.schemeOid) || p.schemeOid}  (${p.schemeOid})` },
      ];
      if (p.scheme === 'PBES2') {
        rows.push({ label: 'Key derivation', value: `${p.kdf}${p.kdfOid ? `  (${p.kdfOid})` : ''}` });
        if (p.salt) rows.push({ label: 'Salt', value: p.salt, mono: true });
        if (p.iterations !== undefined) rows.push({ label: 'Iterations', value: p.iterations.toLocaleString('en-US') });
        if (p.keyLength !== undefined) rows.push({ label: 'Derived key length', value: `${p.keyLength} bytes` });
        if (p.prf) rows.push({ label: 'PRF', value: p.prf });
        if (p.scryptN) rows.push({ label: 'scrypt N / r / p', value: `${p.scryptN} / ${p.scryptR} / ${p.scryptP}`, mono: true });
        rows.push({ label: 'Cipher', value: `${p.cipher}${p.cipherOid ? `  (${p.cipherOid})` : ''}` });
        if (p.iv) rows.push({ label: 'IV', value: p.iv, mono: true });
      } else {
        if (p.salt) rows.push({ label: 'Salt', value: p.salt, mono: true });
        if (p.iterations !== undefined) rows.push({ label: 'Iterations', value: p.iterations.toLocaleString('en-US') });
      }
      rows.push({ label: 'Ciphertext', value: `${tlvContent(k[1] as Tlv).length} bytes` });
      rows.push({ label: 'Note', value: 'The key is encrypted - the algorithm inside is hidden until decrypted. Use the PEM Key Converter tool to decrypt PBES2 keys locally with the password.', tone: 'info' });
      return { kind: 'Encrypted private key (PKCS#8)', title: 'Encrypted PKCS#8 private key', badges: [{ text: 'Private key', tone: 'warn' }, { text: 'Encrypted', tone: 'info' }], sections: [{ title: 'EncryptedPrivateKeyInfo', rows }], children: [] };
    }
  }
  // PKCS#8 PrivateKeyInfo
  if (k.length >= 3 && isInt(k[0]) && isUniv(k[1], 16) && isUniv(k[2], 4)) {
    const alg = tlvChildren(k[1] as Tlv);
    const algOid = oidOf(alg[0]);
    const inner = tlvContent(k[2] as Tlv);
    const rows: SummaryRow[] = [privateWarning(), { label: 'Version', value: String(Number(signedToBigInt(tlvContent(k[0] as Tlv)))) }, { label: 'Algorithm', value: `${oidName(algOid) || algOid}  (${algOid})` }];
    let title = `${oidName(algOid) || algOid} private key`;
    if (algOid === '1.2.840.113549.1.1.1') {
      try {
        const rsa = parseSingle(inner);
        rows.push(...rsaPrivateRows(rsa));
        title = `RSA ${bitLength(intMagnitude(tlvContent(tlvChildren(rsa)[1] ?? rsa)))}-bit private key`;
      } catch {
        rows.push({ label: 'Key', value: 'Could not parse the embedded RSAPrivateKey', tone: 'bad' });
      }
    } else if (algOid === '1.2.840.10045.2.1') {
      try {
        const curve = alg[1] && isUniv(alg[1], 6) ? decodeOidContent(tlvContent(alg[1])) : undefined;
        const r = ecPrivateRows(parseSingle(inner), curve);
        rows.push(...r.rows);
        title = `EC ${curveShortName(r.curveOid)} private key`;
      } catch {
        rows.push({ label: 'Key', value: 'Could not parse the embedded ECPrivateKey', tone: 'bad' });
      }
    } else if (algOid === '1.3.101.112' || algOid === '1.3.101.113' || algOid === '1.3.101.110' || algOid === '1.3.101.111') {
      title = `${oidName(algOid)} private key`;
      rows.push({ label: 'Private key', value: `${(inner.length > 2 ? inner.length - 2 : inner.length) * 8} bits`, mono: true });
    }
    return { kind: 'Private key (PKCS#8)', title, badges: [{ text: 'Private key', tone: 'warn' }], sections: [{ title: 'PrivateKeyInfo (PKCS#8)', rows }], children: [] };
  }
  // SEC1 ECPrivateKey
  if (k.length >= 2 && isInt(k[0]) && isUniv(k[1], 4) && (k[2] === undefined || isCtx(k[2], 0) || isCtx(k[2], 1))) {
    const r = ecPrivateRows(top);
    return { kind: 'EC private key (SEC1)', title: `EC ${r.curveOid ? curveShortName(r.curveOid) : ''} private key`.replace('  ', ' '), badges: [{ text: 'Private key', tone: 'warn' }], sections: [{ title: 'ECPrivateKey (SEC1 / RFC 5915)', rows: [privateWarning(), ...r.rows] }], children: [] };
  }
  // SPKI
  if (k.length === 2 && isUniv(k[0], 16) && isUniv(k[1], 3) && isUniv(tlvChildren(k[0] as Tlv)[0], 6)) {
    const key = describeSpki(top);
    const pin = await digest('SHA-256', tlvRaw(top));
    return {
      kind: 'Public key (SPKI)',
      title: key.description,
      badges: [{ text: 'Public key', tone: 'info' }],
      sections: [{ title: 'SubjectPublicKeyInfo', rows: [...keyRows(key), { label: 'SPKI pin (sha256, base64)', value: b64Encode(pin), mono: true }] }],
      children: [],
    };
  }
  return null;
}

/* --------------------------- PKCS#7 / CMS / PKCS#12 --------------------------- */

export interface Pkcs7Info {
  contentType: string;
  certificates: Uint8Array[];
  crlCount: number;
  signerCount: number;
  digestAlgs: string[];
  version?: number;
}

export function parsePkcs7(input: Uint8Array): Pkcs7Info {
  const top = readTlv(input, 0);
  const k = tlvChildren(top);
  const ct = oidOf(k[0]);
  const info: Pkcs7Info = { contentType: ct, certificates: [], crlCount: 0, signerCount: 0, digestAlgs: [] };
  const wrapper = k[1];
  if (!wrapper || !isCtx(wrapper, 0)) return info;
  const body = tlvChildren(wrapper)[0];
  if (!body) return info;
  if (ct === '1.2.840.113549.1.7.2') {
    const sd = tlvChildren(body);
    info.version = sd[0] ? Number(signedToBigInt(tlvContent(sd[0]))) : undefined;
    if (sd[1] && isUniv(sd[1], 17)) info.digestAlgs = tlvChildren(sd[1]).map((a) => oidName(oidOf(tlvChildren(a)[0])) || oidOf(tlvChildren(a)[0]));
    for (const f of sd.slice(3)) {
      if (isCtx(f, 0)) {
        for (const cert of tlvChildren(f)) if (isUniv(cert, 16)) info.certificates.push(tlvRaw(cert).slice());
      } else if (isCtx(f, 1)) info.crlCount = tlvChildren(f).length;
      else if (isUniv(f, 17)) info.signerCount = tlvChildren(f).length;
    }
  }
  return info;
}

/* ------------------------------ identification ------------------------------ */

export type DerKind =
  | 'certificate' | 'csr' | 'crl' | 'rsa-private' | 'rsa-public' | 'pkcs8' | 'pkcs8-encrypted'
  | 'ec-private' | 'spki' | 'pkcs7' | 'pkcs12' | 'unknown';

export function identifyDer(input: Uint8Array): DerKind {
  try {
    const top = readTlv(input, 0);
    if (!isUniv(top, 16)) return 'unknown';
    const k = tlvChildren(top);
    const isInt = (t: Tlv | undefined) => isUniv(t, 2);
    if (k.length >= 1 && isUniv(k[0], 6)) {
      const o = decodeOidContent(tlvContent(k[0] as Tlv));
      if (o.startsWith('1.2.840.113549.1.7.')) return 'pkcs7';
      return 'unknown';
    }
    if (k.length >= 2 && isInt(k[0]) && Number(signedToBigInt(tlvContent(k[0] as Tlv))) === 3 && isUniv(k[1], 16) && isUniv(tlvChildren(k[1] as Tlv)[0], 6)) {
      const o = decodeOidContent(tlvContent(tlvChildren(k[1] as Tlv)[0] as Tlv));
      if (o.startsWith('1.2.840.113549.1.7.')) return 'pkcs12';
    }
    if (k.length === 3 && isUniv(k[0], 16) && isUniv(k[1], 16) && isUniv(k[2], 3)) {
      const t = tlvChildren(k[0] as Tlv);
      if (t.length === 4 && isInt(t[0]) && isUniv(t[1], 16) && isUniv(t[2], 16) && isCtx(t[3], 0)) return 'csr';
      if (t.length >= 6 && (isCtx(t[0], 0) || isInt(t[0]))) {
        const off = isCtx(t[0], 0) ? 1 : 0;
        if (isInt(t[off]) && isUniv(t[off + 1], 16) && isUniv(t[off + 2], 16) && isUniv(t[off + 3], 16)) return 'certificate';
      }
      if (isUniv(t[0], 16) || isInt(t[0])) {
        const off = isInt(t[0]) ? 1 : 0;
        const tt = t[off + 2];
        if (isUniv(t[off], 16) && isUniv(t[off + 1], 16) && tt && tt.cls === 0 && (tt.tag === 23 || tt.tag === 24)) return 'crl';
      }
      if (isUniv(tlvChildren(k[0] as Tlv)[0], 2) && t.length >= 6) return 'certificate';
    }
    if (k.length >= 9 && k.every(isInt)) return 'rsa-private';
    if (k.length === 2 && isInt(k[0]) && isInt(k[1])) return 'rsa-public';
    if (k.length === 2 && isUniv(k[0], 16) && isUniv(k[1], 4)) return 'pkcs8-encrypted';
    if (k.length >= 3 && isInt(k[0]) && isUniv(k[1], 16) && isUniv(k[2], 4)) return 'pkcs8';
    if (k.length >= 2 && isInt(k[0]) && isUniv(k[1], 4)) return 'ec-private';
    if (k.length === 2 && isUniv(k[0], 16) && isUniv(k[1], 3)) return 'spki';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export interface CrlInfo {
  issuer: string;
  thisUpdate: ParsedTime;
  nextUpdate: ParsedTime | null;
  revoked: number;
  sigAlgName: string;
}

function crlSummary(top: Tlv): Summary {
  const k = tlvChildren(top);
  const tbs = tlvChildren(need(k[0], 'tbsCertList'));
  let i = 0;
  if (isUniv(tbs[0], 2)) i = 1;
  const issuer = formatName(need(tbs[i + 1], 'issuer'));
  const sigOid = oidOf(tlvChildren(need(k[1], 'signature algorithm'))[0]);
  const tu = timeOf(tbs[i + 2], 'thisUpdate');
  const nxt = tbs[i + 3] && tbs[i + 3] && (tbs[i + 3] as Tlv).cls === 0 && ((tbs[i + 3] as Tlv).tag === 23 || (tbs[i + 3] as Tlv).tag === 24) ? timeOf(tbs[i + 3], 'nextUpdate') : null;
  const revIdx = nxt ? i + 4 : i + 3;
  const rv = tbs[revIdx];
  const revoked = rv && isUniv(rv, 16) ? tlvChildren(rv).length : 0;
  const rows: SummaryRow[] = [
    { label: 'Issuer', value: issuer, mono: true },
    { label: 'This update', value: tu.iso, mono: true },
    ...(nxt ? [{ label: 'Next update', value: nxt.iso, mono: true }] : []),
    { label: 'Revoked certificates', value: String(revoked) },
    { label: 'Signature algorithm', value: `${oidName(sigOid) || sigOid}  (${sigOid})` },
  ];
  return { kind: 'X.509 CRL', title: `CRL from ${issuer}`, badges: [{ text: `${revoked} revoked`, tone: 'info' }], sections: [{ title: 'Certificate revocation list', rows }], children: [] };
}

export async function summarizeDer(der: Uint8Array, now: Date = new Date()): Promise<Summary | null> {
  const kind = identifyDer(der);
  try {
    switch (kind) {
      case 'certificate':
        return certificateSummary(await parseCertificate(der), now);
      case 'csr':
        return csrSummary(await parseCsr(der));
      case 'crl':
        return crlSummary(readTlv(der, 0));
      case 'pkcs7': {
        const p = parsePkcs7(der);
        const children: Summary[] = [];
        for (const c of p.certificates) {
          try {
            children.push(certificateSummary(await parseCertificate(c), now));
          } catch {
            /* skip undecodable certificate */
          }
        }
        const rows: SummaryRow[] = [
          { label: 'Content type', value: `${oidName(p.contentType) || p.contentType}  (${p.contentType})` },
          { label: 'Certificates', value: String(p.certificates.length) },
        ];
        if (p.version !== undefined) rows.push({ label: 'Version', value: String(p.version) });
        if (p.digestAlgs.length) rows.push({ label: 'Digest algorithms', value: p.digestAlgs.join(', ') });
        if (p.crlCount) rows.push({ label: 'CRLs', value: String(p.crlCount) });
        rows.push({ label: 'Signers', value: String(p.signerCount) });
        if (p.certificates.length > 0 && p.signerCount === 0) rows.push({ label: 'Type', value: 'Certificates-only bundle (.p7b / .p7c): no signed content', tone: 'info' });
        return {
          kind: 'PKCS#7 / CMS',
          title: p.certificates.length ? `Certificate bundle (${p.certificates.length} certificate${p.certificates.length === 1 ? '' : 's'})` : 'PKCS#7 / CMS message',
          badges: [{ text: oidName(p.contentType) || 'CMS', tone: 'info' }],
          sections: [{ title: 'ContentInfo', rows }],
          children,
        };
      }
      case 'pkcs12': {
        const k = tlvChildren(readTlv(der, 0));
        const rows: SummaryRow[] = [
          { label: 'Version', value: '3' },
          { label: 'MAC present', value: k[2] ? 'Yes (integrity-protected with a password)' : 'No' },
          { label: 'Contents', value: 'Certificates and keys are inside encrypted SafeBags - this tool cannot open them. Use: openssl pkcs12 -in file.p12 -nodes', tone: 'info' },
        ];
        return { kind: 'PKCS#12', title: 'PKCS#12 / PFX container', badges: [{ text: 'PKCS#12', tone: 'info' }], sections: [{ title: 'PFX', rows }], children: [] };
      }
      case 'unknown':
        return null;
      default:
        return await keySummary(readTlv(der, 0));
    }
  } catch (e) {
    return {
      kind: 'Unrecognised',
      title: 'Could not summarise',
      badges: [{ text: 'Error', tone: 'bad' }],
      sections: [{ title: 'Problem', rows: [{ label: 'Error', value: e instanceof Error ? e.message : String(e), tone: 'bad' }] }],
      children: [],
    };
  }
}

export const KIND_LABELS: Record<DerKind, string> = {
  certificate: 'X.509 certificate',
  csr: 'PKCS#10 CSR',
  crl: 'X.509 CRL',
  'rsa-private': 'RSA private key (PKCS#1)',
  'rsa-public': 'RSA public key (PKCS#1)',
  pkcs8: 'Private key (PKCS#8)',
  'pkcs8-encrypted': 'Encrypted private key (PKCS#8)',
  'ec-private': 'EC private key (SEC1)',
  spki: 'Public key (SPKI)',
  pkcs7: 'PKCS#7 / CMS',
  pkcs12: 'PKCS#12',
  unknown: 'Unknown structure',
};
