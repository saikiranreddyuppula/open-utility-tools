'use client';

import { useCallback, useState } from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: false });

function b58encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j]! << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let str = '';
  for (let k = 0; bytes[k] === 0 && k < bytes.length - 1; k++) str += '1';
  for (let q = digits.length - 1; q >= 0; q--) str += ALPHABET[digits[q]!];
  return str;
}

function b58decode(s: string): Uint8Array {
  if (s === '') return new Uint8Array();
  const bytes = [0];
  for (const ch of s) {
    const value = ALPHABET.indexOf(ch);
    if (value === -1) throw new Error(`Invalid Base58 character: "${ch}"`);
    let carry = value;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j]! * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let k = 0; s[k] === '1' && k < s.length - 1; k++) bytes.push(0);
  return new Uint8Array(bytes.reverse());
}

export default function Base58Tool() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      return mode === 'encode' ? b58encode(enc.encode(input)) : dec.decode(b58decode(input.trim()));
    },
    [mode]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode]}
      inputLabel={mode === 'encode' ? 'Text' : 'Base58'}
      outputLabel={mode === 'encode' ? 'Base58' : 'Text'}
      sample={mode === 'encode' ? 'Hello, world!' : '72k1xXWG59fYdzSNoA'}
      downloadName="base58.txt"
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
