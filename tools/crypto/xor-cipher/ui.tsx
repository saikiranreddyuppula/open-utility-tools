'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/tools/panel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'encrypt' | 'decrypt';
type Encoding = 'hex' | 'base64';

function xorBytes(data: Uint8Array, key: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = (data[i] ?? 0) ^ (key[i % key.length] ?? 0);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(input: string): Uint8Array {
  const clean = input.replace(/\s+/g, '');
  if (clean.length === 0) return new Uint8Array(0);
  if (clean.length % 2 !== 0 || /[^0-9a-fA-F]/.test(clean)) {
    throw new Error('Input is not valid hexadecimal');
  }
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
  return btoa(bin);
}

function base64ToBytes(input: string): Uint8Array {
  const clean = input.replace(/\s+/g, '');
  if (clean.length === 0) return new Uint8Array(0);
  let bin: string;
  try {
    bin = atob(clean);
  } catch {
    throw new Error('Input is not valid Base64');
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export default function XorCipherTool() {
  const [mode, setMode] = useState<Mode>('encrypt');
  const [encoding, setEncoding] = useState<Encoding>('hex');
  const [key, setKey] = useState('secret');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      const keyBytes = new TextEncoder().encode(key);
      if (keyBytes.length === 0) {
        throw new Error('Key must not be empty');
      }

      if (mode === 'encrypt') {
        const data = new TextEncoder().encode(input);
        const result = xorBytes(data, keyBytes);
        return encoding === 'hex' ? bytesToHex(result) : bytesToBase64(result);
      }

      const data = encoding === 'hex' ? hexToBytes(input) : base64ToBytes(input);
      const result = xorBytes(data, keyBytes);
      return new TextDecoder().decode(result);
    },
    [mode, encoding, key],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, encoding, key]}
      inputLabel={mode === 'encrypt' ? 'Plaintext' : `Encoded (${encoding})`}
      outputLabel={mode === 'encrypt' ? `Encoded (${encoding})` : 'Plaintext'}
      inputPlaceholder={mode === 'encrypt' ? 'Enter text to encrypt' : 'Paste encoded text'}
      sample={mode === 'encrypt' ? 'Hello, world!' : ''}
      downloadName="xor-output.txt"
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
          <Field label="Key">
            <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="secret" />
          </Field>
          <Field label="Encoding">
            <Select value={encoding} onValueChange={(v) => setEncoding(v as Encoding)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hex">Hex</SelectItem>
                <SelectItem value="base64">Base64</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      }
    />
  );
}
