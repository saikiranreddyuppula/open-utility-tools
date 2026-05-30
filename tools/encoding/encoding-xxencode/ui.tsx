'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// XXencode 64-character alphabet (a permutation safer than classic uuencode's +32 offset).
const ALPHABET = '+-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

const INDEX: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i += 1) {
  const ch = ALPHABET[i];
  if (ch !== undefined) INDEX[ch] = i;
}

function enc(n: number): string {
  return ALPHABET[n & 0x3f] ?? '+';
}

function encodeXX(bytes: Uint8Array, name: string): string {
  const lines: string[] = [`begin 644 ${name || 'file'}`];
  for (let off = 0; off < bytes.length; off += 45) {
    const chunk = bytes.subarray(off, Math.min(off + 45, bytes.length));
    let line = enc(chunk.length); // length indicator for this line
    for (let i = 0; i < chunk.length; i += 3) {
      const b0 = chunk[i] ?? 0;
      const b1 = chunk[i + 1] ?? 0;
      const b2 = chunk[i + 2] ?? 0;
      line += enc(b0 >> 2);
      line += enc(((b0 << 4) | (b1 >> 4)) & 0x3f);
      line += enc(((b1 << 2) | (b2 >> 6)) & 0x3f);
      line += enc(b2 & 0x3f);
    }
    lines.push(line);
  }
  lines.push(enc(0)); // zero-length terminator line
  lines.push('end');
  return lines.join('\n');
}

function val(ch: string): number {
  const v = INDEX[ch];
  if (v === undefined) {
    throw new Error(`Invalid XXencode character: "${ch}"`);
  }
  return v;
}

function decodeXX(text: string): Uint8Array {
  const rawLines = text.split(/\r?\n/);
  const out: number[] = [];
  let sawBegin = false;
  let started = false;

  for (const raw of rawLines) {
    const line = raw.replace(/\s+$/, '');
    if (!started) {
      if (/^begin\s+/i.test(line.trim())) {
        sawBegin = true;
        started = true;
      }
      continue;
    }
    const trimmed = line.trim();
    if (trimmed === '' ) continue;
    if (/^end$/i.test(trimmed)) break;

    const first = line[0] ?? '';
    const count = val(first);
    if (count === 0) break; // terminator line
    const body = line.slice(1);
    const needGroups = Math.ceil(count / 3);
    if (body.length < needGroups * 4) {
      throw new Error('Truncated XXencode data line.');
    }
    let produced = 0;
    for (let i = 0; i + 4 <= body.length && produced < count; i += 4) {
      const c0 = val(body[i] ?? '');
      const c1 = val(body[i + 1] ?? '');
      const c2 = val(body[i + 2] ?? '');
      const c3 = val(body[i + 3] ?? '');
      if (produced < count) {
        out.push(((c0 << 2) | (c1 >> 4)) & 0xff);
        produced += 1;
      }
      if (produced < count) {
        out.push(((c1 << 4) | (c2 >> 2)) & 0xff);
        produced += 1;
      }
      if (produced < count) {
        out.push(((c2 << 6) | c3) & 0xff);
        produced += 1;
      }
    }
  }

  if (!sawBegin) {
    throw new Error('No "begin" line found. XXencode data starts with "begin 644 name".');
  }
  return new Uint8Array(out);
}

export default function XXencodeTool() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      if (mode === 'encode') {
        const bytes = new TextEncoder().encode(input);
        return encodeXX(bytes, 'file');
      }
      const bytes = decodeXX(input);
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    },
    [mode],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode]}
      inputLabel={mode === 'encode' ? 'Text' : 'XXencoded'}
      outputLabel={mode === 'encode' ? 'XXencoded' : 'Text'}
      inputPlaceholder={mode === 'encode' ? 'Type text to XXencode…' : 'Paste XXencoded data (begin … end)…'}
      sample={mode === 'encode' ? 'Hello, World!' : 'begin 644 file\nBG4JgP4wg63RjQalY6E++\n+\nend'}
      downloadName={mode === 'encode' ? 'encoded.xxe.txt' : 'decoded.txt'}
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
