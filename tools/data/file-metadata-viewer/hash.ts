/** SHA-256 / SHA-1 of a Blob: WebCrypto for normal files, incremental pure-TS for huge ones. */
import type { Hashes } from './types';
import { toHex } from './util';

export const HASH_AUTO_LIMIT = 200 * 1024 * 1024;

const K256 = new Int32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** Incremental hash with a 64-byte block function (SHA-256 or SHA-1). */
class BlockHash {
  private h: Int32Array;
  private buf = new Uint8Array(64);
  private bufLen = 0;
  private total = 0;
  private w: Int32Array;
  constructor(private readonly algo: 'sha256' | 'sha1') {
    this.h =
      algo === 'sha256'
        ? new Int32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19])
        : new Int32Array([0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0]);
    this.w = new Int32Array(algo === 'sha256' ? 64 : 80);
  }

  private block(b: Uint8Array, o: number): void {
    const w = this.w;
    const h = this.h;
    for (let i = 0; i < 16; i++) {
      const j = o + i * 4;
      w[i] = (b[j]! << 24) | (b[j + 1]! << 16) | (b[j + 2]! << 8) | b[j + 3]!;
    }
    if (this.algo === 'sha256') {
      for (let i = 16; i < 64; i++) {
        const w15 = w[i - 15]!;
        const w2 = w[i - 2]!;
        const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
        const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
        w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) | 0;
      }
      let a = h[0]! | 0, bb = h[1]! | 0, c = h[2]! | 0, d = h[3]! | 0, e = h[4]! | 0, f = h[5]! | 0, g = h[6]! | 0, hh = h[7]! | 0;
      for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const ch = (e & f) ^ (~e & g);
        const t1 = (hh + S1 + ch + K256[i]! + w[i]!) | 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const maj = (a & bb) ^ (a & c) ^ (bb & c);
        const t2 = (S0 + maj) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0]! + a) | 0; h[1] = (h[1]! + bb) | 0; h[2] = (h[2]! + c) | 0; h[3] = (h[3]! + d) | 0;
      h[4] = (h[4]! + e) | 0; h[5] = (h[5]! + f) | 0; h[6] = (h[6]! + g) | 0; h[7] = (h[7]! + hh) | 0;
    } else {
      for (let i = 16; i < 80; i++) {
        const x = w[i - 3]! ^ w[i - 8]! ^ w[i - 14]! ^ w[i - 16]!;
        w[i] = (x << 1) | (x >>> 31);
      }
      let a = h[0]! | 0, bb = h[1]! | 0, c = h[2]! | 0, d = h[3]! | 0, e = h[4]! | 0;
      for (let i = 0; i < 20; i++) {
        const t = (((a << 5) | (a >>> 27)) + ((bb & c) | (~bb & d)) + e + 0x5a827999 + w[i]!) | 0;
        e = d; d = c; c = (bb << 30) | (bb >>> 2); bb = a; a = t;
      }
      for (let i = 20; i < 40; i++) {
        const t = (((a << 5) | (a >>> 27)) + (bb ^ c ^ d) + e + 0x6ed9eba1 + w[i]!) | 0;
        e = d; d = c; c = (bb << 30) | (bb >>> 2); bb = a; a = t;
      }
      for (let i = 40; i < 60; i++) {
        const t = (((a << 5) | (a >>> 27)) + ((bb & c) | (bb & d) | (c & d)) + e + 0x8f1bbcdc + w[i]!) | 0;
        e = d; d = c; c = (bb << 30) | (bb >>> 2); bb = a; a = t;
      }
      for (let i = 60; i < 80; i++) {
        const t = (((a << 5) | (a >>> 27)) + (bb ^ c ^ d) + e + 0xca62c1d6 + w[i]!) | 0;
        e = d; d = c; c = (bb << 30) | (bb >>> 2); bb = a; a = t;
      }
      h[0] = (h[0]! + a) | 0; h[1] = (h[1]! + bb) | 0; h[2] = (h[2]! + c) | 0; h[3] = (h[3]! + d) | 0; h[4] = (h[4]! + e) | 0;
    }
  }

  update(data: Uint8Array): void {
    this.total += data.length;
    let i = 0;
    if (this.bufLen > 0) {
      const need = 64 - this.bufLen;
      const take = Math.min(need, data.length);
      this.buf.set(data.subarray(0, take), this.bufLen);
      this.bufLen += take;
      i = take;
      if (this.bufLen === 64) {
        this.block(this.buf, 0);
        this.bufLen = 0;
      }
    }
    for (; i + 64 <= data.length; i += 64) this.block(data, i);
    if (i < data.length) {
      this.buf.set(data.subarray(i), 0);
      this.bufLen = data.length - i;
    }
  }

  digest(): string {
    const bits = this.total * 8;
    const pad = new Uint8Array(((this.bufLen + 9 + 63) >> 6) << 6);
    pad.set(this.buf.subarray(0, this.bufLen), 0);
    pad[this.bufLen] = 0x80;
    const dv = new DataView(pad.buffer);
    dv.setUint32(pad.length - 8, Math.floor(bits / 4294967296), false);
    dv.setUint32(pad.length - 4, bits >>> 0, false);
    this.bufLen = 0;
    for (let o = 0; o < pad.length; o += 64) this.block(pad, o);
    const out = new Uint8Array(this.h.length * 4);
    const odv = new DataView(out.buffer);
    for (let i = 0; i < this.h.length; i++) odv.setUint32(i * 4, (this.h[i] ?? 0) >>> 0, false);
    return toHex(out);
  }
}

export function sha256Hex(data: Uint8Array): string {
  const h = new BlockHash('sha256');
  h.update(data);
  return h.digest();
}

export function sha1Hex(data: Uint8Array): string {
  const h = new BlockHash('sha1');
  h.update(data);
  return h.digest();
}

const wc = (globalThis as unknown as { crypto?: Crypto }).crypto;

async function subtleHex(algo: 'SHA-256' | 'SHA-1', buf: ArrayBuffer): Promise<string> {
  const d = await (wc as Crypto).subtle.digest(algo, buf);
  return toHex(new Uint8Array(d));
}

export interface HashOptions {
  onProgress?: (fraction: number) => void;
  signal?: { cancelled: boolean };
}

/**
 * Hash a Blob. Files up to HASH_AUTO_LIMIT use WebCrypto; anything larger is
 * streamed in 8 MiB slices through an incremental JS implementation so the whole
 * file never has to sit in memory.
 */
export async function hashBlob(blob: Blob, opts: HashOptions = {}): Promise<Hashes> {
  if (blob.size <= HASH_AUTO_LIMIT && wc?.subtle) {
    const buf = await blob.arrayBuffer();
    const [sha256, sha1] = await Promise.all([subtleHex('SHA-256', buf), subtleHex('SHA-1', buf)]);
    opts.onProgress?.(1);
    return { sha256, sha1 };
  }
  const a = new BlockHash('sha256');
  const b = new BlockHash('sha1');
  const CHUNK = 8 * 1024 * 1024;
  for (let off = 0; off < blob.size; off += CHUNK) {
    if (opts.signal?.cancelled) throw new Error('cancelled');
    const chunk = new Uint8Array(await blob.slice(off, Math.min(blob.size, off + CHUNK)).arrayBuffer());
    a.update(chunk);
    b.update(chunk);
    opts.onProgress?.(Math.min(1, (off + chunk.length) / blob.size));
    await new Promise((r) => setTimeout(r, 0));
  }
  return { sha256: a.digest(), sha1: b.digest() };
}
