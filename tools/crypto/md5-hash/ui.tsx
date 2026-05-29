'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Case = 'lower' | 'upper';

/* ----------------------------------------------------------------------------
 * Pure-TypeScript MD5 (RFC 1321). Web Crypto does not provide MD5.
 * Operates on a byte array and returns 16 raw digest bytes.
 * ------------------------------------------------------------------------- */

function rotl(x: number, c: number): number {
  return (x << c) | (x >>> (32 - c));
}

function md5Bytes(input: Uint8Array): Uint8Array {
  // Per-round shift amounts.
  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9,
    14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  // Precomputed constants K[i] = floor(abs(sin(i+1)) * 2^32).
  const K: number[] = [];
  for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0;
  }

  const originalLenBits = input.length * 8;

  // Padding: append 0x80, then zeros until length ≡ 56 (mod 64), then 64-bit length.
  const withOne = input.length + 1;
  const paddedLen = withOne + ((56 - (withOne % 64) + 64) % 64) + 8;
  const msg = new Uint8Array(paddedLen);
  msg.set(input);
  msg[input.length] = 0x80;

  // 64-bit little-endian length in bits (low 32 bits then high 32 bits).
  const lenLow = originalLenBits >>> 0;
  const lenHigh = Math.floor(originalLenBits / 0x100000000) >>> 0;
  msg[paddedLen - 8] = lenLow & 0xff;
  msg[paddedLen - 7] = (lenLow >>> 8) & 0xff;
  msg[paddedLen - 6] = (lenLow >>> 16) & 0xff;
  msg[paddedLen - 5] = (lenLow >>> 24) & 0xff;
  msg[paddedLen - 4] = lenHigh & 0xff;
  msg[paddedLen - 3] = (lenHigh >>> 8) & 0xff;
  msg[paddedLen - 2] = (lenHigh >>> 16) & 0xff;
  msg[paddedLen - 1] = (lenHigh >>> 24) & 0xff;

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const M = new Array<number>(16);

  for (let chunk = 0; chunk < paddedLen; chunk += 64) {
    for (let j = 0; j < 16; j++) {
      const o = chunk + j * 4;
      M[j] =
        ((msg[o] ?? 0) |
          ((msg[o + 1] ?? 0) << 8) |
          ((msg[o + 2] ?? 0) << 16) |
          ((msg[o + 3] ?? 0) << 24)) >>>
        0;
    }

    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      f = (f + a + (K[i] ?? 0) + (M[g] ?? 0)) >>> 0;
      a = d;
      d = c;
      c = b;
      b = (b + rotl(f, s[i] ?? 0)) >>> 0;
    }

    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  const out = new Uint8Array(16);
  const words = [a0, b0, c0, d0];
  for (let i = 0; i < 4; i++) {
    const w = words[i] ?? 0;
    out[i * 4] = w & 0xff;
    out[i * 4 + 1] = (w >>> 8) & 0xff;
    out[i * 4 + 2] = (w >>> 16) & 0xff;
    out[i * 4 + 3] = (w >>> 24) & 0xff;
  }
  return out;
}

function toHex(bytes: Uint8Array, upper: boolean): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += (bytes[i] ?? 0).toString(16).padStart(2, '0');
  }
  return upper ? hex.toUpperCase() : hex;
}

export default function Md5HashTool() {
  const [casing, setCasing] = useState<Case>('lower');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      const bytes = new TextEncoder().encode(input);
      return toHex(md5Bytes(bytes), casing === 'upper');
    },
    [casing],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[casing]}
      inputLabel="Text"
      outputLabel="MD5 hash"
      inputPlaceholder="Type or paste text to hash…"
      sample="The quick brown fox jumps over the lazy dog"
      downloadName="md5.txt"
      options={
        <Field label="Hex case">
          <Tabs value={casing} onValueChange={(v) => setCasing(v as Case)}>
            <TabsList>
              <TabsTrigger value="lower">lowercase</TabsTrigger>
              <TabsTrigger value="upper">UPPERCASE</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
