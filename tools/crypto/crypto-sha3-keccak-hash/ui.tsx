'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type InputEnc = 'utf8' | 'hex';
type Variant = 'all' | 'sha3-224' | 'sha3-256' | 'sha3-384' | 'sha3-512' | 'keccak-256';

const enc = new TextEncoder();

// Keccak-f[1600] round constants, split into high/low 32-bit halves.
const RC_HI: number[] = [
  0x00000000, 0x00000000, 0x80000000, 0x80000000, 0x00000000, 0x00000000, 0x80000000, 0x80000000,
  0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x80000000, 0x80000000, 0x80000000,
  0x80000000, 0x80000000, 0x00000000, 0x80000000, 0x80000000, 0x80000000, 0x00000000, 0x80000000,
];
const RC_LO: number[] = [
  0x00000001, 0x00008082, 0x0000808a, 0x80008000, 0x0000808b, 0x80000001, 0x80008081, 0x00008009,
  0x0000008a, 0x00000088, 0x80008009, 0x8000000a, 0x8000808b, 0x0000008b, 0x00008089, 0x00008003,
  0x00008002, 0x00000080, 0x0000800a, 0x8000000a, 0x80008081, 0x00008080, 0x80000001, 0x80008008,
];
const RHO: number[] = [
  0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14,
];
const PI: number[] = [
  0, 10, 20, 5, 15, 16, 1, 11, 21, 6, 7, 17, 2, 12, 22, 23, 8, 18, 3, 13, 14, 24, 9, 19, 4,
];

// 64-bit rotate-left of (hi,lo), result written into [outHi,outLo] tuple.
function rotl(hi: number, lo: number, n: number): [number, number] {
  if (n === 0) return [hi >>> 0, lo >>> 0];
  if (n === 32) return [lo >>> 0, hi >>> 0];
  if (n < 32) {
    const nh = ((hi << n) | (lo >>> (32 - n))) >>> 0;
    const nl = ((lo << n) | (hi >>> (32 - n))) >>> 0;
    return [nh, nl];
  }
  const m = n - 32;
  const nh = ((lo << m) | (hi >>> (32 - m))) >>> 0;
  const nl = ((hi << m) | (lo >>> (32 - m))) >>> 0;
  return [nh, nl];
}

function keccakF(sHi: number[], sLo: number[]): void {
  const bHi = new Array<number>(25).fill(0);
  const bLo = new Array<number>(25).fill(0);
  const cHi = new Array<number>(5).fill(0);
  const cLo = new Array<number>(5).fill(0);
  const dHi = new Array<number>(5).fill(0);
  const dLo = new Array<number>(5).fill(0);

  for (let round = 0; round < 24; round++) {
    // Theta
    for (let x = 0; x < 5; x++) {
      cHi[x] =
        (sHi[x] ?? 0) ^ (sHi[x + 5] ?? 0) ^ (sHi[x + 10] ?? 0) ^ (sHi[x + 15] ?? 0) ^ (sHi[x + 20] ?? 0);
      cLo[x] =
        (sLo[x] ?? 0) ^ (sLo[x + 5] ?? 0) ^ (sLo[x + 10] ?? 0) ^ (sLo[x + 15] ?? 0) ^ (sLo[x + 20] ?? 0);
    }
    for (let x = 0; x < 5; x++) {
      const [rHi, rLo] = rotl(cHi[(x + 1) % 5] ?? 0, cLo[(x + 1) % 5] ?? 0, 1);
      dHi[x] = (cHi[(x + 4) % 5] ?? 0) ^ rHi;
      dLo[x] = (cLo[(x + 4) % 5] ?? 0) ^ rLo;
    }
    for (let i = 0; i < 25; i++) {
      sHi[i] = (sHi[i] ?? 0) ^ (dHi[i % 5] ?? 0);
      sLo[i] = (sLo[i] ?? 0) ^ (dLo[i % 5] ?? 0);
    }

    // Rho + Pi
    for (let i = 0; i < 25; i++) {
      const dest = PI[i] ?? 0;
      const [rHi, rLo] = rotl(sHi[i] ?? 0, sLo[i] ?? 0, RHO[i] ?? 0);
      bHi[dest] = rHi;
      bLo[dest] = rLo;
    }

    // Chi
    for (let y = 0; y < 25; y += 5) {
      for (let x = 0; x < 5; x++) {
        const i = y + x;
        sHi[i] = (bHi[i] ?? 0) ^ (~(bHi[y + ((x + 1) % 5)] ?? 0) & (bHi[y + ((x + 2) % 5)] ?? 0));
        sLo[i] = (bLo[i] ?? 0) ^ (~(bLo[y + ((x + 1) % 5)] ?? 0) & (bLo[y + ((x + 2) % 5)] ?? 0));
      }
    }

    // Iota
    sHi[0] = (sHi[0] ?? 0) ^ (RC_HI[round] ?? 0);
    sLo[0] = (sLo[0] ?? 0) ^ (RC_LO[round] ?? 0);
  }
}

// rate in bytes, output length in bytes, domain padding byte (0x06 SHA3, 0x01 Keccak).
function keccak(msg: Uint8Array, rateBytes: number, outBytes: number, pad: number): Uint8Array {
  const sHi = new Array<number>(25).fill(0);
  const sLo = new Array<number>(25).fill(0);

  // Absorb full blocks (and final padded block).
  const blockLanes = rateBytes / 8;
  let offset = 0;

  const absorbBlock = (block: Uint8Array) => {
    for (let lane = 0; lane < blockLanes; lane++) {
      const base = lane * 8;
      const lo =
        ((block[base] ?? 0) |
          ((block[base + 1] ?? 0) << 8) |
          ((block[base + 2] ?? 0) << 16) |
          ((block[base + 3] ?? 0) << 24)) >>>
        0;
      const hi =
        ((block[base + 4] ?? 0) |
          ((block[base + 5] ?? 0) << 8) |
          ((block[base + 6] ?? 0) << 16) |
          ((block[base + 7] ?? 0) << 24)) >>>
        0;
      sLo[lane] = (sLo[lane] ?? 0) ^ lo;
      sHi[lane] = (sHi[lane] ?? 0) ^ hi;
    }
    keccakF(sHi, sLo);
  };

  while (offset + rateBytes <= msg.length) {
    absorbBlock(msg.subarray(offset, offset + rateBytes));
    offset += rateBytes;
  }

  // Final padded block.
  const last = new Uint8Array(rateBytes);
  const rem = msg.length - offset;
  last.set(msg.subarray(offset), 0);
  last[rem] = pad;
  last[rateBytes - 1] = (last[rateBytes - 1] ?? 0) | 0x80;
  absorbBlock(last);

  // Squeeze (single block suffices for SHA-3/Keccak fixed digests under all our rates).
  const out = new Uint8Array(outBytes);
  let produced = 0;
  while (produced < outBytes) {
    for (let lane = 0; lane < blockLanes && produced < outBytes; lane++) {
      const lo = sLo[lane] ?? 0;
      const hi = sHi[lane] ?? 0;
      const laneBytes = [
        lo & 0xff,
        (lo >>> 8) & 0xff,
        (lo >>> 16) & 0xff,
        (lo >>> 24) & 0xff,
        hi & 0xff,
        (hi >>> 8) & 0xff,
        (hi >>> 16) & 0xff,
        (hi >>> 24) & 0xff,
      ];
      for (let k = 0; k < 8 && produced < outBytes; k++) {
        out[produced++] = laneBytes[k] ?? 0;
      }
    }
    if (produced < outBytes) keccakF(sHi, sLo);
  }
  return out;
}

function toHex(bytes: Uint8Array, upper: boolean): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += (bytes[i] ?? 0).toString(16).padStart(2, '0');
  return upper ? s.toUpperCase() : s;
}

function parseHex(input: string): Uint8Array {
  const clean = input.replace(/0x/gi, '').replace(/[\s:,-]/g, '');
  if (clean.length === 0) return new Uint8Array(0);
  if (!/^[0-9a-fA-F]*$/.test(clean)) throw new Error('Hex input contains non-hex characters.');
  if (clean.length % 2 !== 0) throw new Error('Hex input must have an even number of digits.');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// SHA-3 capacity = 2 * digest bits; rate = 1600 - capacity.
const SHA3: { id: Variant; label: string; bits: number; pad: number }[] = [
  { id: 'sha3-224', label: 'SHA3-224', bits: 224, pad: 0x06 },
  { id: 'sha3-256', label: 'SHA3-256', bits: 256, pad: 0x06 },
  { id: 'sha3-384', label: 'SHA3-384', bits: 384, pad: 0x06 },
  { id: 'sha3-512', label: 'SHA3-512', bits: 512, pad: 0x06 },
  { id: 'keccak-256', label: 'Keccak-256', bits: 256, pad: 0x01 },
];

function digest(variant: { bits: number; pad: number }, msg: Uint8Array): Uint8Array {
  const capacityBytes = (2 * variant.bits) / 8;
  const rateBytes = 200 - capacityBytes;
  return keccak(msg, rateBytes, variant.bits / 8, variant.pad);
}

export default function Sha3KeccakHashTool() {
  const [inputEnc, setInputEnc] = useState<InputEnc>('utf8');
  const [variant, setVariant] = useState<Variant>('all');
  const [upper, setUpper] = useState(false);

  return (
    <TextToolLayout
      deps={[inputEnc, variant, upper]}
      transform={(input) => {
        if (!input) return '';
        const bytes = inputEnc === 'hex' ? parseHex(input) : enc.encode(input);
        const chosen = variant === 'all' ? SHA3 : SHA3.filter((v) => v.id === variant);
        const lines = chosen.map((v) => {
          const hex = toHex(digest(v, bytes), upper);
          return variant === 'all' ? `${v.label.padEnd(11)} ${hex}` : hex;
        });
        return lines.join('\n');
      }}
      inputLabel={inputEnc === 'hex' ? 'Input (hex bytes)' : 'Input (UTF-8 text)'}
      outputLabel="Digest (hex)"
      sample="The quick brown fox jumps over the lazy dog"
      downloadName="sha3.txt"
      options={
        <>
          <Field label="Input encoding">
            <Tabs value={inputEnc} onValueChange={(v) => setInputEnc(v as InputEnc)}>
              <TabsList>
                <TabsTrigger value="utf8">UTF-8</TabsTrigger>
                <TabsTrigger value="hex">Hex</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Variant">
            <Select value={variant} onValueChange={(v) => setVariant(v as Variant)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All variants</SelectItem>
                <SelectItem value="sha3-224">SHA3-224</SelectItem>
                <SelectItem value="sha3-256">SHA3-256</SelectItem>
                <SelectItem value="sha3-384">SHA3-384</SelectItem>
                <SelectItem value="sha3-512">SHA3-512</SelectItem>
                <SelectItem value="keccak-256">Keccak-256</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Uppercase">
            <div className="flex h-8 items-center gap-2">
              <Switch id="upper" checked={upper} onCheckedChange={setUpper} />
              <Label htmlFor="upper" className="text-xs text-muted-foreground">
                Hex case
              </Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
