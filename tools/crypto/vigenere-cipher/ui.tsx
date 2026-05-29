'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'encrypt' | 'decrypt';

const A = 'a'.charCodeAt(0);
const Z = 'z'.charCodeAt(0);
const UA = 'A'.charCodeAt(0);
const UZ = 'Z'.charCodeAt(0);

function isUpper(code: number): boolean {
  return code >= UA && code <= UZ;
}
function isLower(code: number): boolean {
  return code >= A && code <= Z;
}

export default function VigenereCipherTool() {
  const [mode, setMode] = useState<Mode>('encrypt');
  const [key, setKey] = useState('LEMON');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      const cleanKey = key.replace(/[^a-zA-Z]/g, '');
      if (cleanKey.length === 0) {
        throw new Error('Key must contain at least one letter (A-Z)');
      }
      const keyOffsets = cleanKey
        .toLowerCase()
        .split('')
        .map((c) => c.charCodeAt(0) - A);

      let keyIndex = 0;
      let out = '';
      for (let i = 0; i < input.length; i++) {
        const code = input.charCodeAt(i);
        const shift = keyOffsets[keyIndex % keyOffsets.length] ?? 0;
        const effective = mode === 'encrypt' ? shift : 26 - shift;
        if (isUpper(code)) {
          out += String.fromCharCode(((code - UA + effective) % 26) + UA);
          keyIndex++;
        } else if (isLower(code)) {
          out += String.fromCharCode(((code - A + effective) % 26) + A);
          keyIndex++;
        } else {
          out += input[i] ?? '';
        }
      }
      return out;
    },
    [mode, key],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, key]}
      inputLabel="Text"
      outputLabel={mode === 'encrypt' ? 'Ciphertext' : 'Plaintext'}
      inputPlaceholder="Enter text to transform"
      sample="Attack at dawn"
      downloadName="vigenere.txt"
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="encrypt">Encrypt</TabsTrigger>
                <TabsTrigger value="decrypt">Decrypt</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Keyword" hint="Letters only; non-letters ignored">
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="LEMON"
            />
          </Field>
        </>
      }
    />
  );
}
