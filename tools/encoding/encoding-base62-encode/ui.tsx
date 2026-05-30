'use client';

import { useCallback, useMemo, useState } from 'react';

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

// GMP order: digits, then uppercase, then lowercase.
const GMP = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
// Alternate order used by some libraries: digits, lowercase, uppercase.
const INVERTED = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function valueMap(alphabet: string): Record<string, number> {
  const m: Record<string, number> = {};
  for (let i = 0; i < alphabet.length; i++) {
    const ch = alphabet[i];
    if (ch !== undefined) m[ch] = i;
  }
  return m;
}

function bigintToBase62(n: bigint, alphabet: string): string {
  if (n === 0n) return alphabet[0] ?? '0';
  let v = n;
  let out = '';
  const base = 62n;
  while (v > 0n) {
    const d = Number(v % base);
    out = (alphabet[d] ?? '0') + out;
    v /= base;
  }
  return out;
}

function base62ToBigint(s: string, value: Record<string, number>): bigint {
  let v = 0n;
  for (const ch of s) {
    const d = value[ch];
    if (d === undefined) {
      throw new Error(`Invalid Base62 character "${ch}" for the chosen alphabet.`);
    }
    v = v * 62n + BigInt(d);
  }
  return v;
}

export default function Base62Tool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [dataMode, setDataMode] = useState<DataMode>('integer');
  const [inverted, setInverted] = useState(false);

  const alphabet = inverted ? INVERTED : GMP;
  const value = useMemo(() => valueMap(alphabet), [alphabet]);

  const transform = useCallback(
    (input: string) => {
      const trimmed = input.trim();
      if (!trimmed) return '';

      if (dataMode === 'integer') {
        if (mode === 'encode') {
          if (!/^[0-9]+$/.test(trimmed)) {
            throw new Error('Enter a non-negative decimal integer to encode.');
          }
          return bigintToBase62(BigInt(trimmed), alphabet);
        }
        return base62ToBigint(trimmed, value).toString(10);
      }

      // Byte mode: UTF-8 bytes as big-endian BigInt.
      if (mode === 'encode') {
        const bytes = new TextEncoder().encode(input);
        if (bytes.length === 0) return '';
        let n = 0n;
        for (let i = 0; i < bytes.length; i++) {
          n = (n << 8n) | BigInt(bytes[i] ?? 0);
        }
        return bigintToBase62(n, alphabet);
      }
      const n = base62ToBigint(trimmed, value);
      const out: number[] = [];
      let v = n;
      while (v > 0n) {
        out.unshift(Number(v & 0xffn));
        v >>= 8n;
      }
      return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(out));
    },
    [mode, dataMode, alphabet, value],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, dataMode, inverted]}
      inputLabel={
        mode === 'encode'
          ? dataMode === 'integer'
            ? 'Decimal integer'
            : 'Text'
          : 'Base62'
      }
      outputLabel={
        mode === 'encode' ? 'Base62' : dataMode === 'integer' ? 'Decimal integer' : 'Text'
      }
      sample={mode === 'encode' ? (dataMode === 'integer' ? '125731' : 'short') : 'W38'}
      downloadName="base62.txt"
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
          <Field label="Lowercase-first alphabet" hint="0-9 a-z A-Z">
            <Switch checked={inverted} onCheckedChange={setInverted} />
          </Field>
        </>
      }
    />
  );
}
