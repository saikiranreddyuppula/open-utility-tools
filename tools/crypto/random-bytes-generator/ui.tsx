'use client';

import { useState } from 'react';
import { GeneratorList } from '@/components/tools/generator-list';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const webcrypto = (
  globalThis as unknown as {
    crypto: {
      getRandomValues<T extends ArrayBufferView>(a: T): T;
      randomUUID(): string;
    };
  }
).crypto;

type Format = 'hex' | 'base64' | 'base64url' | 'carray';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(bin);
}

function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function toCArray(bytes: Uint8Array): string {
  const items = Array.from(bytes, (b) => `0x${b.toString(16).padStart(2, '0')}`);
  return `{ ${items.join(', ')} }`;
}

export default function RandomBytesGeneratorTool() {
  const [length, setLength] = useState(16);
  const [format, setFormat] = useState<Format>('hex');

  const safeLength = Number.isFinite(length) && length > 0 ? Math.min(Math.floor(length), 4096) : 1;

  const generate = () => {
    const buf = new Uint8Array(safeLength);
    webcrypto.getRandomValues(buf);
    switch (format) {
      case 'hex':
        return toHex(buf);
      case 'base64':
        return toBase64(buf);
      case 'base64url':
        return toBase64Url(buf);
      case 'carray':
        return toCArray(buf);
      default:
        return toHex(buf);
    }
  };

  return (
    <GeneratorList
      generate={generate}
      deps={[safeLength, format]}
      downloadName="random-bytes.txt"
      label="Random byte strings"
      options={
        <>
          <Field label="Byte length" hint="1 - 4096 bytes">
            <Input
              type="number"
              min={1}
              max={4096}
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
            />
          </Field>
          <Field label="Format">
            <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hex">Hex</SelectItem>
                <SelectItem value="base64">Base64</SelectItem>
                <SelectItem value="base64url">Base64URL</SelectItem>
                <SelectItem value="carray">C byte array</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      }
    />
  );
}
