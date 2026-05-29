/** Client-side ID generators using the Web Crypto API (no network). */

// Minimal Web Crypto surface we use. We cast globalThis to this shape rather
// than relying on the ambient `crypto`/`Crypto` types: recent @types/node declare
// `var crypto` with a self-referential conditional that TS can collapse to
// `never`, which would otherwise poison every `.getRandomValues` call here.
interface RandomSource {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
  randomUUID(): string;
}
const webcrypto = (globalThis as unknown as { crypto: RandomSource }).crypto;

const hex: string[] = [];
for (let i = 0; i < 256; i++) hex.push((i + 0x100).toString(16).slice(1));

function fmt(b: Uint8Array): string {
  return (
    hex[b[0]!]! + hex[b[1]!]! + hex[b[2]!]! + hex[b[3]!]! + '-' +
    hex[b[4]!]! + hex[b[5]!]! + '-' +
    hex[b[6]!]! + hex[b[7]!]! + '-' +
    hex[b[8]!]! + hex[b[9]!]! + '-' +
    hex[b[10]!]! + hex[b[11]!]! + hex[b[12]!]! + hex[b[13]!]! + hex[b[14]!]! + hex[b[15]!]!
  );
}

/** RFC 4122 v4 UUID (random). Uses native crypto.randomUUID when available. */
export function uuidV4(): string {
  if (typeof webcrypto.randomUUID === 'function') {
    return webcrypto.randomUUID();
  }
  const b = new Uint8Array(16);
  webcrypto.getRandomValues(b);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  return fmt(b);
}

/** UUID v7 — time-ordered (48-bit ms timestamp + random). */
export function uuidV7(): string {
  const ts = Date.now();
  const b = new Uint8Array(16);
  webcrypto.getRandomValues(b);
  b[0] = Math.floor(ts / 2 ** 40) & 0xff;
  b[1] = Math.floor(ts / 2 ** 32) & 0xff;
  b[2] = Math.floor(ts / 2 ** 24) & 0xff;
  b[3] = Math.floor(ts / 2 ** 16) & 0xff;
  b[4] = Math.floor(ts / 2 ** 8) & 0xff;
  b[5] = ts & 0xff;
  b[6] = (b[6]! & 0x0f) | 0x70; // version 7
  b[8] = (b[8]! & 0x3f) | 0x80; // variant
  return fmt(b);
}

// Crockford base32 for ULID.
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** ULID — 26-char lexicographically-sortable identifier. */
export function ulid(): string {
  const time = Date.now();
  let ts = '';
  let t = time;
  for (let i = 0; i < 10; i++) {
    ts = ENCODING[t % 32] + ts;
    t = Math.floor(t / 32);
  }
  const rand = new Uint8Array(16);
  webcrypto.getRandomValues(rand);
  let r = '';
  for (let i = 0; i < 16; i++) r += ENCODING[rand[i]! % 32];
  return ts + r;
}

const NANO_ALPHABET = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';

/** nanoid — compact, URL-safe random id (default 21 chars). */
export function nanoid(size = 21): string {
  const bytes = new Uint8Array(size);
  webcrypto.getRandomValues(bytes);
  let id = '';
  for (let i = 0; i < size; i++) id += NANO_ALPHABET[bytes[i]! & 63];
  return id;
}
