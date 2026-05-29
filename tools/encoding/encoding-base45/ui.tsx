'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// RFC 9285 Base45 alphabet (45 characters).
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

const VALUE: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i++) {
  const ch = ALPHABET[i];
  if (ch !== undefined) VALUE[ch] = i;
}

function encodeBase45(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 1 < bytes.length; i += 2) {
    const hi = bytes[i] ?? 0;
    const lo = bytes[i + 1] ?? 0;
    const n = hi * 256 + lo;
    const c = n % 45;
    const d = Math.floor(n / 45) % 45;
    const e = Math.floor(n / (45 * 45));
    out += (ALPHABET[c] ?? '') + (ALPHABET[d] ?? '') + (ALPHABET[e] ?? '');
  }
  // Odd trailing byte -> two characters.
  if (i < bytes.length) {
    const n = bytes[i] ?? 0;
    const c = n % 45;
    const d = Math.floor(n / 45);
    out += (ALPHABET[c] ?? '') + (ALPHABET[d] ?? '');
  }
  return out;
}

function decodeBase45(text: string): Uint8Array {
  // Base45 has no padding/whitespace; strip surrounding whitespace only.
  const s = text.replace(/[\r\n]+/g, '');
  if (s.length % 3 === 1) {
    throw new Error('Invalid Base45 length (a group cannot be a single character).');
  }
  const bytes: number[] = [];
  let i = 0;
  for (; i + 3 <= s.length; i += 3) {
    const c = VALUE[s[i] ?? ''];
    const d = VALUE[s[i + 1] ?? ''];
    const e = VALUE[s[i + 2] ?? ''];
    if (c === undefined || d === undefined || e === undefined) {
      throw new Error('Invalid Base45 character in input.');
    }
    const n = c + d * 45 + e * 45 * 45;
    if (n > 0xffff) {
      throw new Error('Invalid Base45 group (value exceeds 65535).');
    }
    bytes.push(Math.floor(n / 256));
    bytes.push(n % 256);
  }
  // Trailing 2-character group -> one byte.
  if (i < s.length) {
    const c = VALUE[s[i] ?? ''];
    const d = VALUE[s[i + 1] ?? ''];
    if (c === undefined || d === undefined) {
      throw new Error('Invalid Base45 character in input.');
    }
    const n = c + d * 45;
    if (n > 0xff) {
      throw new Error('Invalid Base45 group (trailing value exceeds 255).');
    }
    bytes.push(n);
  }
  return new Uint8Array(bytes);
}

export default function Base45Tool() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      if (mode === 'encode') {
        const bytes = new TextEncoder().encode(input);
        return encodeBase45(bytes);
      }
      const bytes = decodeBase45(input);
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    },
    [mode],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode]}
      inputLabel={mode === 'encode' ? 'Text' : 'Base45'}
      outputLabel={mode === 'encode' ? 'Base45' : 'Text'}
      inputPlaceholder={mode === 'encode' ? 'Type text to encode…' : 'Paste Base45 to decode…'}
      sample={mode === 'encode' ? 'Hello!!' : '%69 VD92EX0'}
      downloadName={mode === 'encode' ? 'encoded.base45.txt' : 'decoded.txt'}
      options={
        <Field label="Direction">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'encode' | 'decode')}>
            <TabsList>
              <TabsTrigger value="encode">Encode</TabsTrigger>
              <TabsTrigger value="decode">Decode</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
