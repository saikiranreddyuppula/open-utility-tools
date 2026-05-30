'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'encode' | 'decode';
type DataMode = 'integer' | 'bytes';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const VALUE: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i++) {
  const ch = ALPHABET[i];
  if (ch !== undefined) VALUE[ch] = i;
}

function bigintToBase36(n: bigint): string {
  if (n === 0n) return '0';
  let v = n;
  let out = '';
  const base = 36n;
  while (v > 0n) {
    const digit = Number(v % base);
    out = (ALPHABET[digit] ?? '0') + out;
    v /= base;
  }
  return out;
}

function base36ToBigint(s: string): bigint {
  let v = 0n;
  for (const ch of s) {
    const d = VALUE[ch];
    if (d === undefined) {
      throw new Error(`Invalid Base36 character "${ch}" (allowed: 0-9 a-z).`);
    }
    v = v * 36n + BigInt(d);
  }
  return v;
}

export default function Base36Tool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [dataMode, setDataMode] = useState<DataMode>('integer');
  const [upper, setUpper] = useState(false);
  const [stripZeros, setStripZeros] = useState(true);

  const transform = useCallback(
    (input: string) => {
      const trimmed = input.trim();
      if (!trimmed) return '';

      if (dataMode === 'integer') {
        if (mode === 'encode') {
          if (!/^[0-9]+$/.test(trimmed)) {
            throw new Error('Enter a non-negative decimal integer to encode.');
          }
          const result = bigintToBase36(BigInt(trimmed));
          return upper ? result.toUpperCase() : result;
        }
        const v = base36ToBigint(trimmed.toLowerCase());
        return v.toString(10);
      }

      // Byte mode: treat UTF-8 bytes as a big-endian BigInt.
      if (mode === 'encode') {
        const bytes = new TextEncoder().encode(input);
        let n = 0n;
        let leading = 0;
        let counting = true;
        for (let i = 0; i < bytes.length; i++) {
          const b = bytes[i] ?? 0;
          if (counting && b === 0) leading++;
          else counting = false;
          n = (n << 8n) | BigInt(b);
        }
        let result = bigintToBase36(n);
        if (!stripZeros) result = '0'.repeat(leading) + result;
        return upper ? result.toUpperCase() : result;
      }
      // Decode bytes: Base36 string -> BigInt -> bytes -> UTF-8.
      const n = base36ToBigint(trimmed.toLowerCase());
      const out: number[] = [];
      let v = n;
      while (v > 0n) {
        out.unshift(Number(v & 0xffn));
        v >>= 8n;
      }
      return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(out));
    },
    [mode, dataMode, upper, stripZeros],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, dataMode, upper, stripZeros]}
      inputLabel={
        mode === 'encode'
          ? dataMode === 'integer'
            ? 'Decimal integer'
            : 'Text'
          : 'Base36'
      }
      outputLabel={
        mode === 'encode' ? 'Base36' : dataMode === 'integer' ? 'Decimal integer' : 'Text'
      }
      sample={mode === 'encode' ? (dataMode === 'integer' ? '1000000' : 'Hello') : 'lfls'}
      downloadName="base36.txt"
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="encode">Encode</TabsTrigger>
                <TabsTrigger value="decode">Decode</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Data">
            <Select value={dataMode} onValueChange={(v) => setDataMode(v as DataMode)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="integer">Integer</SelectItem>
                <SelectItem value="bytes">Text (bytes)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Uppercase">
            <Switch checked={upper} onCheckedChange={setUpper} />
          </Field>
          <Field label="Strip leading zeros">
            <Switch checked={stripZeros} onCheckedChange={setStripZeros} />
          </Field>
        </>
      }
    />
  );
}
