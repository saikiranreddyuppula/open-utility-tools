/** Thin helpers over the native Web Crypto SubtleCrypto API (no wasm, no deps). */

interface SubtleHost {
  subtle: SubtleCrypto;
  getRandomValues<T extends ArrayBufferView>(a: T): T;
}
const wc = (globalThis as unknown as { crypto: SubtleHost }).crypto;

const enc = new TextEncoder();

export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export type HsAlg = 'HS256' | 'HS384' | 'HS512';

const HASH: Record<HsAlg, string> = { HS256: 'SHA-256', HS384: 'SHA-384', HS512: 'SHA-512' };

/** Sign a JWT (HMAC) with the given secret. */
export async function signJwt(
  header: object,
  payload: object,
  secret: string,
  alg: HsAlg
): Promise<string> {
  const h = b64url(enc.encode(JSON.stringify({ ...header, alg, typ: 'JWT' })));
  const p = b64url(enc.encode(JSON.stringify(payload)));
  const data = `${h}.${p}`;
  const key = await wc.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: HASH[alg] },
    false,
    ['sign']
  );
  const sig = await wc.subtle.sign('HMAC', key, enc.encode(data));
  return `${data}.${b64url(sig)}`;
}

/** Compute an HOTP/TOTP code using WebCrypto HMAC. */
export async function hotp(
  secretBytes: Uint8Array,
  counter: number,
  digits: number,
  hash: 'SHA-1' | 'SHA-256' | 'SHA-512'
): Promise<string> {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  // 64-bit counter, big-endian.
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);
  const key = await wc.subtle.importKey('raw', secretBytes as BufferSource, { name: 'HMAC', hash }, false, ['sign']);
  const hmac = new Uint8Array(await wc.subtle.sign('HMAC', key, buf));
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return (code % 10 ** digits).toString().padStart(digits, '0');
}

/** Decode a Base32 (RFC 4648) secret to bytes — used for TOTP seeds. */
export function base32Decode(input: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) throw new Error(`Invalid base32 character: ${ch}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}
