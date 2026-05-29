'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

function encode(input: string, padded: boolean): string {
  const bytes = new TextEncoder().encode(input);
  const parts: string[] = [];
  for (const b of bytes) {
    const oct = b.toString(8);
    parts.push(padded ? oct.padStart(3, '0') : oct);
  }
  return parts.join(' ');
}

function decode(input: string): string {
  const tokens = input.trim().split(/[\s,]+/).filter(Boolean);
  if (tokens.length === 0) return '';
  const bytes: number[] = [];
  for (const token of tokens) {
    const cleaned = token.replace(/^(0o|\\)/i, '');
    if (!/^[0-7]+$/.test(cleaned)) {
      throw new Error(`Invalid octal value: "${token}"`);
    }
    const value = Number.parseInt(cleaned, 8);
    if (!Number.isFinite(value) || value < 0 || value > 0xff) {
      throw new Error(`Octal value out of byte range (0-377): "${token}"`);
    }
    bytes.push(value);
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
  } catch {
    throw new Error('Octal bytes are not valid UTF-8.');
  }
}

export default function OctalTextTool() {
  const [direction, setDirection] = useState<'encode' | 'decode'>('encode');
  const [padded, setPadded] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      return direction === 'encode' ? encode(input, padded) : decode(input);
    },
    [direction, padded],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[direction, padded]}
      inputLabel={direction === 'encode' ? 'Text' : 'Octal bytes'}
      outputLabel={direction === 'encode' ? 'Octal bytes' : 'Text'}
      inputPlaceholder={direction === 'encode' ? 'Hello' : '110 145 154 154 157'}
      sample={direction === 'encode' ? 'Hello, world!' : '110 145 154 154 157'}
      downloadName="octal.txt"
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
            <Field label="Format">
              <Tabs value={padded ? 'padded' : 'plain'} onValueChange={(v) => setPadded(v === 'padded')}>
                <TabsList>
                  <TabsTrigger value="padded">3-digit</TabsTrigger>
                  <TabsTrigger value="plain">Minimal</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
          )}
        </>
      }
    />
  );
}
