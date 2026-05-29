'use client';

import { useCallback, useState } from 'react';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field } from '@/components/tools/panel';
import { GeneratorList } from '@/components/tools/generator-list';

const ALPHABETS: Record<string, string> = {
  alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  hex: '0123456789abcdef',
  HEX: '0123456789ABCDEF',
  letters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  base58: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
};

interface RandomSource {
  getRandomValues<T extends ArrayBufferView>(a: T): T;
}
const webcrypto = (globalThis as unknown as { crypto: RandomSource }).crypto;

function randomString(alphabet: string, length: number): string {
  const bytes = new Uint8Array(length);
  webcrypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}

export default function RandomStringTool() {
  const [alphabetKey, setAlphabetKey] = useState('alphanumeric');
  const [custom, setCustom] = useState('');
  const [length, setLength] = useState(32);

  const generate = useCallback(() => {
    const alphabet = alphabetKey === 'custom' ? custom || 'abc' : ALPHABETS[alphabetKey]!;
    return randomString(alphabet, length);
  }, [alphabetKey, custom, length]);

  return (
    <GeneratorList
      generate={generate}
      deps={[alphabetKey, custom, length]}
      defaultCount={5}
      downloadName="random-strings.txt"
      label="Random strings"
      options={
        <>
          <Field label="Length">
            <Input
              type="number"
              min={1}
              max={512}
              value={length}
              onChange={(e) => setLength(Math.max(1, Math.min(Number(e.target.value) || 1, 512)))}
              className="w-24 font-mono"
            />
          </Field>
          <Field label="Alphabet">
            <Select value={alphabetKey} onValueChange={setAlphabetKey}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(ALPHABETS).map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
                <SelectItem value="custom">custom…</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {alphabetKey === 'custom' && (
            <Field label="Custom chars">
              <Input value={custom} onChange={(e) => setCustom(e.target.value)} className="w-48 font-mono" placeholder="abcXYZ123" />
            </Field>
          )}
        </>
      }
    />
  );
}
