'use client';

import { useCallback, useState } from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: false });

function textToBinary(text: string): string {
  return Array.from(enc.encode(text))
    .map((b) => b.toString(2).padStart(8, '0'))
    .join(' ');
}

function binaryToText(bin: string): string {
  const groups = bin.trim().split(/\s+/).filter(Boolean);
  const bytes = new Uint8Array(groups.length);
  for (let i = 0; i < groups.length; i++) {
    const v = parseInt(groups[i]!, 2);
    if (isNaN(v) || v > 255) throw new Error(`"${groups[i]}" is not an 8-bit binary byte.`);
    bytes[i] = v;
  }
  return dec.decode(bytes);
}

export default function BinaryTextTool() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      return mode === 'encode' ? textToBinary(input) : binaryToText(input);
    },
    [mode]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode]}
      inputLabel={mode === 'encode' ? 'Text' : 'Binary'}
      outputLabel={mode === 'encode' ? 'Binary' : 'Text'}
      sample={mode === 'encode' ? 'Hi!' : '01001000 01101001 00100001'}
      downloadName="binary.txt"
      options={
        <Field label="Mode">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'encode' | 'decode')}>
            <TabsList>
              <TabsTrigger value="encode">Text → Binary</TabsTrigger>
              <TabsTrigger value="decode">Binary → Text</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
