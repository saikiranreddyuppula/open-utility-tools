/* tslint:disable */
/* eslint-disable */

/**
 * Base32 (RFC 4648) decode (case-insensitive, padding optional).
 */
export function base32_decode(text: string): Uint8Array;

/**
 * Base32 (RFC 4648) encode.
 */
export function base32_encode(data: Uint8Array, pad: boolean): string;

/**
 * Base64 decode. Accepts both standard and URL alphabets, padded or not.
 */
export function base64_decode(text: string): Uint8Array;

/**
 * Base64 encode. `url_safe` selects the URL/filename alphabet; `pad` toggles `=`.
 */
export function base64_encode(data: Uint8Array, url_safe: boolean, pad: boolean): string;

/**
 * Hash a password with bcrypt at the given cost (4..=31, typical 10-12).
 */
export function bcrypt_hash(password: string, cost: number): string;

/**
 * Verify a password against a bcrypt hash.
 */
export function bcrypt_verify(password: string, hash: string): boolean;

/**
 * Sum bytes mod 2^32 — a deterministic, dependency-free pipeline check.
 */
export function checksum(data: Uint8Array): number;

/**
 * Compute a digest over `data` and return lowercase hex.
 * Supported: md5, sha1, sha224, sha256, sha384, sha512,
 * sha3-224/256/384/512, blake3, crc32.
 */
export function hash_hex(algo: string, data: Uint8Array): string;

/**
 * Compute a digest and return raw bytes (e.g. for further encoding).
 */
export function hash_raw(algo: string, data: Uint8Array): Uint8Array;

/**
 * Hex decode, tolerating whitespace and an optional `0x` prefix.
 */
export function hex_decode(text: string): Uint8Array;

/**
 * Hex encode. `upper` selects uppercase output.
 */
export function hex_encode(data: Uint8Array, upper: boolean): string;

/**
 * HMAC of `data` with `key`, returned as lowercase hex.
 * Supported algos: sha1, sha256, sha384, sha512.
 */
export function hmac_hex(algo: string, key: Uint8Array, data: Uint8Array): string;

/**
 * Installs a panic hook that logs Rust panics to the browser console.
 */
export function start(): void;

/**
 * Trivial end-to-end smoke-test export — proves the worker → wasm pipeline.
 */
export function version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly base32_decode: (a: number, b: number, c: number) => void;
    readonly base32_encode: (a: number, b: number, c: number, d: number) => void;
    readonly base64_decode: (a: number, b: number, c: number) => void;
    readonly base64_encode: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly bcrypt_hash: (a: number, b: number, c: number, d: number) => void;
    readonly bcrypt_verify: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly checksum: (a: number, b: number) => number;
    readonly hash_hex: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly hash_raw: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly hex_decode: (a: number, b: number, c: number) => void;
    readonly hex_encode: (a: number, b: number, c: number, d: number) => void;
    readonly hmac_hex: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly version: (a: number) => void;
    readonly start: () => void;
    readonly __wbindgen_export: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export2: (a: number) => void;
    readonly __wbindgen_export3: (a: number, b: number) => number;
    readonly __wbindgen_export4: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
