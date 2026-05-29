'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'encode' | 'decode';

const A = 65;
const a = 97;

function shiftText(text: string, shift: number): string {
  // Normalise shift into 0..25
  const k = ((shift % 26) + 26) % 26;
  if (k === 0) return text;
  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= A && code <= A + 25) {
      out += String.fromCharCode(((code - A + k) % 26) + A);
    } else if (code >= a && code <= a + 25) {
      out += String.fromCharCode(((code - a + k) % 26) + a);
    } else {
      out += ch;
    }
  }
  return out;
}

export default function CaesarCipherTool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [shift, setShift] = useState(3);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      const effective = mode === 'encode' ? shift : -shift;
      return shiftText(input, effective);
    },
    [mode, shift],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, shift]}
      inputLabel={mode === 'encode' ? 'Plain text' : 'Cipher text'}
      outputLabel={mode === 'encode' ? 'Cipher text' : 'Plain text'}
      sample="The quick brown fox jumps over the lazy dog."
      downloadName="caesar.txt"
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
          <Field label={`Shift: ${shift}`} hint="13 = ROT13">
            <Slider
              min={0}
              max={25}
              step={1}
              value={[shift]}
              onValueChange={(v) => setShift(v[0] ?? 0)}
              className="w-48"
            />
          </Field>
        </>
      }
    />
  );
}
