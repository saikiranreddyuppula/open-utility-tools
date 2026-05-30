'use client';

import { useCallback, useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

// Joachim Henke's basE91 alphabet (91 printable ASCII characters).
const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~"';

const DECODE_MAP: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (let i = 0; i < ALPHABET.length; i += 1) {
    const ch = ALPHABET[i];
    if (ch !== undefined) m[ch] = i;
  }
  return m;
})();

function encodeBytes(data: Uint8Array): string {
  let out = '';
  let b = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 1) {
    b |= (data[i] ?? 0) << n;
    n += 8;
    if (n > 13) {
      let v = b & 8191; // lower 13 bits
      if (v > 88) {
        b >>= 13;
        n -= 13;
      } else {
        v = b & 16383; // lower 14 bits
        b >>= 14;
        n -= 14;
      }
      // basE91 emits the low-order character first.
      const lo = ALPHABET[v % 91];
      const hi = ALPHABET[Math.floor(v / 91)];
      out += (lo ?? '') + (hi ?? '');
    }
  }
  if (n > 0) {
    const lo = ALPHABET[b % 91];
    out += lo ?? '';
    if (n > 7 || b > 90) {
      const hi = ALPHABET[Math.floor(b / 91)];
      out += hi ?? '';
    }
  }
  return out;
}

function decodeToBytes(text: string): Uint8Array {
  const bytes: number[] = [];
  let b = 0;
  let n = 0;
  let v = -1;
  for (const ch of text) {
    const d = DECODE_MAP[ch];
    if (d === undefined) {
      // Skip whitespace/newlines; reject any other stray character.
      if (/\s/.test(ch)) continue;
      throw new Error(`Invalid basE91 character: "${ch}"`);
    }
    if (v < 0) {
      v = d;
    } else {
      v += d * 91;
      b |= v << n;
      n += (v & 8191) > 88 ? 13 : 14;
      while (n > 7) {
        bytes.push(b & 255);
        b >>= 8;
        n -= 8;
      }
      v = -1;
    }
  }
  if (v >= 0) {
    bytes.push((b | (v << n)) & 255);
  }
  return Uint8Array.from(bytes);
}

export default function Base91Tool() {
  const [direction, setDirection] = useState<'encode' | 'decode'>('encode');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      if (direction === 'encode') {
        return encodeBytes(new TextEncoder().encode(input));
      }
      const bytes = decodeToBytes(input);
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    },
    [direction],
  );

  const sample = useMemo(
    () =>
      direction === 'encode'
        ? 'basE91 packs binary into 91 printable characters — denser than Base64.'
        : '>OwJh>}AQ;r@@Y?F',
    [direction],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[direction]}
      inputLabel={direction === 'encode' ? 'Text' : 'basE91'}
      outputLabel={direction === 'encode' ? 'basE91' : 'Text'}
      inputPlaceholder={direction === 'encode' ? 'Type text to encode…' : 'Paste basE91 to decode…'}
      sample={sample}
      downloadName="base91.txt"
      options={
        <>
          <Field label="Direction">
            <Tabs value={direction} onValueChange={(v) => setDirection(v as 'encode' | 'decode')}>
              <TabsList>
                <TabsTrigger value="encode">Encode</TabsTrigger>
                <TabsTrigger value="decode">Decode</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {direction === 'encode' && (
            <Field label="About" className="max-w-[260px]">
              <span className="text-2xs text-muted-foreground">
                basE91 averages ~14% overhead vs ~33% for Base64.
              </span>
            </Field>
          )}
        </>
      }
    />
  );
}
