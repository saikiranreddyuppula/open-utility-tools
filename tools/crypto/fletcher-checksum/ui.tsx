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
type Variant = 'f16' | 'f32' | 'f64';

const enc = new TextEncoder();

function parseHex(input: string): Uint8Array {
  const clean = input.replace(/0x/gi, '').replace(/[\s:,-]/g, '');
  if (clean.length === 0) return new Uint8Array(0);
  if (!/^[0-9a-fA-F]*$/.test(clean)) throw new Error('Hex input contains non-hex characters.');
  if (clean.length % 2 !== 0) throw new Error('Hex input must have an even number of digits.');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

interface Result {
  sum1: bigint;
  sum2: bigint;
  checksum: bigint;
  hexDigits: number;
  blockBits: bigint;
}

// Fletcher-16: byte data words, sums mod 255. Defer mod every 5802 iterations.
function fletcher16(bytes: Uint8Array): Result {
  let s1 = 0;
  let s2 = 0;
  let i = 0;
  const n = bytes.length;
  while (i < n) {
    let block = Math.min(5802, n - i);
    while (block-- > 0) {
      s1 += bytes[i++] ?? 0;
      s2 += s1;
    }
    s1 %= 255;
    s2 %= 255;
  }
  s1 %= 255;
  s2 %= 255;
  return {
    sum1: BigInt(s1),
    sum2: BigInt(s2),
    checksum: (BigInt(s2) << 8n) | BigInt(s1),
    hexDigits: 4,
    blockBits: 8n,
  };
}

// Fletcher-32: 16-bit little-endian words, sums mod 65535. Defer mod every 359 words.
function fletcher32(bytes: Uint8Array): Result {
  let s1 = 0;
  let s2 = 0;
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i += 2) {
    const lo = bytes[i] ?? 0;
    const hi = i + 1 < bytes.length ? (bytes[i + 1] ?? 0) : 0;
    words.push((lo | (hi << 8)) & 0xffff);
  }
  let i = 0;
  const n = words.length;
  while (i < n) {
    let block = Math.min(359, n - i);
    while (block-- > 0) {
      s1 += words[i++] ?? 0;
      s2 += s1;
    }
    s1 %= 65535;
    s2 %= 65535;
  }
  s1 %= 65535;
  s2 %= 65535;
  return {
    sum1: BigInt(s1),
    sum2: BigInt(s2),
    checksum: (BigInt(s2) << 16n) | BigInt(s1),
    hexDigits: 8,
    blockBits: 16n,
  };
}

// Fletcher-64: 32-bit little-endian words, sums mod 4294967295. BigInt for safety.
function fletcher64(bytes: Uint8Array): Result {
  const MOD = 4294967295n;
  let s1 = 0n;
  let s2 = 0n;
  for (let i = 0; i < bytes.length; i += 4) {
    const b0 = bytes[i] ?? 0;
    const b1 = i + 1 < bytes.length ? (bytes[i + 1] ?? 0) : 0;
    const b2 = i + 2 < bytes.length ? (bytes[i + 2] ?? 0) : 0;
    const b3 = i + 3 < bytes.length ? (bytes[i + 3] ?? 0) : 0;
    const word = BigInt((b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)) >>> 0);
    s1 = (s1 + word) % MOD;
    s2 = (s2 + s1) % MOD;
  }
  return {
    sum1: s1,
    sum2: s2,
    checksum: (s2 << 32n) | s1,
    hexDigits: 16,
    blockBits: 32n,
  };
}

export default function FletcherChecksumTool() {
  const [inputEnc, setInputEnc] = useState<InputEnc>('utf8');
  const [variant, setVariant] = useState<Variant>('f16');
  const [upper, setUpper] = useState(false);

  const label = variant === 'f16' ? 'Fletcher-16' : variant === 'f32' ? 'Fletcher-32' : 'Fletcher-64';

  return (
    <TextToolLayout
      deps={[inputEnc, variant, upper]}
      transform={(input) => {
        if (!input) return '';
        const bytes = inputEnc === 'hex' ? parseHex(input) : enc.encode(input);
        const r = variant === 'f16' ? fletcher16(bytes) : variant === 'f32' ? fletcher32(bytes) : fletcher64(bytes);
        let hex = r.checksum.toString(16).padStart(r.hexDigits, '0');
        if (upper) hex = hex.toUpperCase();
        const sub = Number(r.blockBits) / 4;
        let s1h = r.sum1.toString(16).padStart(sub, '0');
        let s2h = r.sum2.toString(16).padStart(sub, '0');
        if (upper) {
          s1h = s1h.toUpperCase();
          s2h = s2h.toUpperCase();
        }
        return [
          `${label} checksum`,
          `  hex      0x${hex}`,
          `  decimal  ${r.checksum.toString()}`,
          '',
          'Running sums',
          `  sum1     0x${s1h}  (${r.sum1.toString()})`,
          `  sum2     0x${s2h}  (${r.sum2.toString()})`,
        ].join('\n');
      }}
      inputLabel={inputEnc === 'hex' ? 'Input (hex bytes)' : 'Input (UTF-8 text)'}
      outputLabel="Fletcher checksum"
      sample="abcde"
      downloadName="fletcher.txt"
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
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="f16">Fletcher-16</SelectItem>
                <SelectItem value="f32">Fletcher-32</SelectItem>
                <SelectItem value="f64">Fletcher-64</SelectItem>
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
