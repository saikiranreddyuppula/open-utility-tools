'use client';

import { useCallback, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Field } from '@/components/tools/panel';
import { GeneratorList } from '@/components/tools/generator-list';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

type Encoding = 'hex' | 'base64' | 'base64url' | 'base62';

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Base62 by treating the byte array as a big-endian big integer.
function toBase62(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  const digits: number[] = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      const cur = (digits[i] ?? 0) * 256 + carry;
      digits[i] = cur % 62;
      carry = Math.floor(cur / 62);
    }
    while (carry > 0) {
      digits.push(carry % 62);
      carry = Math.floor(carry / 62);
    }
  }
  // Preserve leading zero bytes as leading '0' chars.
  let leading = 0;
  for (const byte of bytes) {
    if (byte === 0) leading++;
    else break;
  }
  let out = '';
  for (let i = digits.length - 1; i >= 0; i--) out += BASE62[digits[i] ?? 0] ?? '0';
  return '0'.repeat(leading) + out;
}

function encode(bytes: Uint8Array, enc: Encoding): string {
  switch (enc) {
    case 'hex':
      return toHex(bytes);
    case 'base64':
      return toBase64(bytes);
    case 'base64url':
      return toBase64Url(bytes);
    case 'base62':
      return toBase62(bytes);
    default:
      return toHex(bytes);
  }
}

export default function BearerTokenGeneratorTool() {
  const [bytesLen, setBytesLen] = useState(32);
  const [enc, setEnc] = useState<Encoding>('base64url');

  const generate = useCallback(() => {
    const n = Math.max(8, Math.min(bytesLen, 128));
    const bytes = new Uint8Array(n);
    wc.getRandomValues(bytes);
    const token = encode(bytes, enc);
    const bits = n * 8;
    return `${token}    (${token.length} chars · ${bits} bits)`;
  }, [bytesLen, enc]);

  return (
    <GeneratorList
      generate={generate}
      deps={[bytesLen, enc]}
      defaultCount={5}
      maxCount={200}
      downloadName="tokens.txt"
      label="Random tokens"
      options={
        <>
          <Field label={`Byte length · ${bytesLen}`}>
            <Input
              type="number"
              min={8}
              max={128}
              value={bytesLen}
              onChange={(e) => setBytesLen(Math.max(8, Math.min(Number(e.target.value) || 32, 128)))}
              className="w-24 font-mono"
            />
          </Field>
          <Field label="Encoding">
            <Select value={enc} onValueChange={(v) => setEnc(v as Encoding)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hex">Hex (lowercase)</SelectItem>
                <SelectItem value="base64">Base64</SelectItem>
                <SelectItem value="base64url">Base64URL (no pad)</SelectItem>
                <SelectItem value="base62">Base62</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      }
    />
  );
}
