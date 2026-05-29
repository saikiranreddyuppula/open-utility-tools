/**
 * Typed, ergonomic wrapper around the `core` wasm crate (hashing + encoding),
 * executed off the UI thread via the worker pool.
 *
 * Note: Uint8Array args are transferred (zero-copy) to the worker, which detaches
 * the buffer on this thread. Callers should pass freshly-created arrays.
 */
import { runWasm, type RunOptions } from '@/lib/worker/client';

const CRATE = 'core';

const enc = new TextEncoder();
function bytes(input: string | Uint8Array): Uint8Array {
  return typeof input === 'string' ? enc.encode(input) : input;
}
function buf(u: Uint8Array): Transferable[] {
  return [u.buffer as ArrayBuffer];
}

export type HashAlgo =
  | 'md5'
  | 'sha1'
  | 'sha224'
  | 'sha256'
  | 'sha384'
  | 'sha512'
  | 'sha3-224'
  | 'sha3-256'
  | 'sha3-384'
  | 'sha3-512'
  | 'blake3'
  | 'crc32';

export type HmacAlgo = 'sha1' | 'sha256' | 'sha384' | 'sha512';

export const HASH_ALGOS: HashAlgo[] = [
  'md5',
  'sha1',
  'sha256',
  'sha384',
  'sha512',
  'sha3-256',
  'sha3-512',
  'blake3',
  'crc32',
];

/** Smoke-test: returns "core@<version>". */
export function version(): Promise<string> {
  return runWasm<string>(CRATE, 'version', []);
}

export function hashHex(
  algo: HashAlgo,
  data: string | Uint8Array,
  opts?: RunOptions
): Promise<string> {
  const b = bytes(data);
  return runWasm<string>(CRATE, 'hash_hex', [algo, b], { transfer: buf(b), ...opts });
}

export function hmacHex(
  algo: HmacAlgo,
  key: string | Uint8Array,
  data: string | Uint8Array
): Promise<string> {
  const k = bytes(key);
  const d = bytes(data);
  return runWasm<string>(CRATE, 'hmac_hex', [algo, k, d], {
    transfer: [k.buffer as ArrayBuffer, d.buffer as ArrayBuffer],
  });
}

export function base64Encode(
  data: string | Uint8Array,
  urlSafe = false,
  pad = true
): Promise<string> {
  const b = bytes(data);
  return runWasm<string>(CRATE, 'base64_encode', [b, urlSafe, pad], { transfer: buf(b) });
}

export function base64Decode(text: string): Promise<Uint8Array> {
  return runWasm<Uint8Array>(CRATE, 'base64_decode', [text]);
}

export function base32Encode(data: string | Uint8Array, pad = true): Promise<string> {
  const b = bytes(data);
  return runWasm<string>(CRATE, 'base32_encode', [b, pad], { transfer: buf(b) });
}

export function base32Decode(text: string): Promise<Uint8Array> {
  return runWasm<Uint8Array>(CRATE, 'base32_decode', [text]);
}

export function hexEncode(data: string | Uint8Array, upper = false): Promise<string> {
  const b = bytes(data);
  return runWasm<string>(CRATE, 'hex_encode', [b, upper], { transfer: buf(b) });
}

export function hexDecode(text: string): Promise<Uint8Array> {
  return runWasm<Uint8Array>(CRATE, 'hex_decode', [text]);
}
