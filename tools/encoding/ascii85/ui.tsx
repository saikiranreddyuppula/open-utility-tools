'use client';

import { useCallback, useState } from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: false });

function encode85(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 4) {
    const chunk = bytes.subarray(i, i + 4);
    const len = chunk.length;
    let n = 0;
    for (let j = 0; j < 4; j++) n = (n * 256 + (chunk[j] ?? 0)) >>> 0;
    if (len === 4 && n === 0) {
      out += 'z';
      continue;
    }
    const group: string[] = [];
    for (let j = 0; j < 5; j++) {
      group.unshift(String.fromCharCode((n % 85) + 33));
      n = Math.floor(n / 85);
    }
    out += group.slice(0, len + 1).join('');
  }
  return out;
}

function decode85(text: string): Uint8Array {
  const s = text.replace(/\s+/g, '').replace(/^<~|~>$/g, '');
  const out: number[] = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === 'z') {
      out.push(0, 0, 0, 0);
      i++;
      continue;
    }
    const group = s.slice(i, i + 5);
    const len = group.length;
    let n = 0;
    for (let j = 0; j < 5; j++) {
      const c = j < len ? group.charCodeAt(j) - 33 : 84;
      if (c < 0 || c > 84) throw new Error(`Invalid Ascii85 character`);
      n = n * 85 + c;
    }
    const bytes = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    for (let j = 0; j < len - 1; j++) out.push(bytes[j]!);
    i += 5;
  }
  return new Uint8Array(out);
}

export default function Ascii85Tool() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      return mode === 'encode' ? encode85(enc.encode(input)) : dec.decode(decode85(input));
    },
    [mode]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode]}
      inputLabel={mode === 'encode' ? 'Text' : 'Ascii85'}
      outputLabel={mode === 'encode' ? 'Ascii85' : 'Text'}
      sample={mode === 'encode' ? 'Hello, world!' : '87cURD]j7BEbo80'}
      downloadName="ascii85.txt"
      options={
        <Field label="Mode">
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
