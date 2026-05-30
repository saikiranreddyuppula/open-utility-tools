'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'encode' | 'decode';

// RFC 4648 Section 7 — Base32hex (extended hex) alphabet.
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUV';

const VALUE: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i++) {
  const ch = ALPHABET[i];
  if (ch !== undefined) VALUE[ch] = i;
}

function encodeBase32hex(bytes: Uint8Array, pad: boolean, lower: boolean): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | (bytes[i] ?? 0);
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHABET[(value >>> bits) & 31] ?? '';
    }
  }
  if (bits > 0) {
    out += ALPHABET[(value << (5 - bits)) & 31] ?? '';
  }
  if (pad) {
    while (out.length % 8 !== 0) out += '=';
  }
  return lower ? out.toLowerCase() : out;
}

function decodeBase32hex(text: string): Uint8Array {
  const cleaned = text.replace(/[\s=]+/g, '').toUpperCase();
  if (cleaned.length === 0) return new Uint8Array(0);
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of cleaned) {
    const v = VALUE[ch];
    if (v === undefined) {
      throw new Error(`Invalid Base32hex character "${ch}" (alphabet is 0-9 A-V).`);
    }
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

export default function Base32hexTool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [pad, setPad] = useState(true);
  const [lower, setLower] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      if (mode === 'encode') {
        const bytes = new TextEncoder().encode(input);
        return encodeBase32hex(bytes, pad, lower);
      }
      const bytes = decodeBase32hex(input);
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    },
    [mode, pad, lower],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, pad, lower]}
      inputLabel={mode === 'encode' ? 'Text' : 'Base32hex'}
      outputLabel={mode === 'encode' ? 'Base32hex' : 'Text'}
      sample={mode === 'encode' ? 'foobar' : 'CPNMUOJ1E8======'}
      downloadName={mode === 'encode' ? 'encoded.b32hex.txt' : 'decoded.txt'}
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
          {mode === 'encode' && (
            <>
              <Field label="Padding (=)">
                <Switch checked={pad} onCheckedChange={setPad} />
              </Field>
              <Field label="Lowercase output">
                <Switch checked={lower} onCheckedChange={setLower} />
              </Field>
            </>
          )}
        </>
      }
    />
  );
}
