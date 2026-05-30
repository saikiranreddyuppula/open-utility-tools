'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ZeroMQ RFC 32 / Z85 alphabet (85 printable characters, source-code safe).
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#';

const DECODE: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i += 1) {
  const ch = ALPHABET[i];
  if (ch !== undefined) DECODE[ch] = i;
}

function encodeZ85(bytes: Uint8Array): string {
  if (bytes.length % 4 !== 0) {
    throw new Error('Z85 requires the byte length to be a multiple of 4. Enable zero-padding.');
  }
  let out = '';
  for (let i = 0; i < bytes.length; i += 4) {
    // big-endian uint32
    let n =
      (bytes[i] ?? 0) * 0x1000000 +
      (bytes[i + 1] ?? 0) * 0x10000 +
      (bytes[i + 2] ?? 0) * 0x100 +
      (bytes[i + 3] ?? 0);
    const chars: string[] = [];
    for (let k = 0; k < 5; k += 1) {
      chars.push(ALPHABET[n % 85] ?? '0');
      n = Math.floor(n / 85);
    }
    chars.reverse();
    out += chars.join('');
  }
  return out;
}

function decodeZ85(text: string): Uint8Array {
  const s = text.replace(/\s+/g, '');
  if (s.length % 5 !== 0) {
    throw new Error('Z85 input length must be a multiple of 5.');
  }
  const out = new Uint8Array((s.length / 5) * 4);
  let oi = 0;
  for (let i = 0; i < s.length; i += 5) {
    let n = 0;
    for (let k = 0; k < 5; k += 1) {
      const ch = s[i + k] ?? '';
      const v = DECODE[ch];
      if (v === undefined) {
        throw new Error(`Invalid Z85 character: "${ch}"`);
      }
      n = n * 85 + v;
    }
    if (n > 0xffffffff) {
      throw new Error('Z85 group exceeds 32-bit range (invalid data).');
    }
    out[oi++] = (n >>> 24) & 0xff;
    out[oi++] = (n >>> 16) & 0xff;
    out[oi++] = (n >>> 8) & 0xff;
    out[oi++] = n & 0xff;
  }
  return out;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');
}

export default function Z85Tool() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [pad, setPad] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      if (mode === 'encode') {
        let bytes = new TextEncoder().encode(input);
        const orig = bytes.length;
        if (bytes.length % 4 !== 0) {
          if (!pad) {
            throw new Error(
              `Input is ${orig} bytes, not a multiple of 4. Enable zero-padding to encode.`,
            );
          }
          const padded = new Uint8Array(Math.ceil(orig / 4) * 4);
          padded.set(bytes);
          bytes = padded;
        }
        const z85 = encodeZ85(bytes);
        const note =
          pad && bytes.length !== orig
            ? `\n\n# original-length: ${orig} bytes (${bytes.length - orig} zero byte(s) appended)`
            : '';
        return z85 + note;
      }
      // decode: strip an optional original-length comment line if present
      let original: number | null = null;
      let payload = input;
      const m = input.match(/#\s*original-length:\s*(\d+)/i);
      if (m && m[1] !== undefined) {
        original = Number(m[1]);
        payload = input.slice(0, m.index ?? input.length);
      }
      let bytes = decodeZ85(payload);
      if (original !== null && Number.isFinite(original) && original >= 0 && original <= bytes.length) {
        bytes = bytes.subarray(0, original);
      }
      const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      return `Text (UTF-8):\n${utf8}\n\nHex:\n${toHex(bytes)}`;
    },
    [mode, pad],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, pad]}
      inputLabel={mode === 'encode' ? 'Text' : 'Z85'}
      outputLabel={mode === 'encode' ? 'Z85' : 'Decoded bytes'}
      inputPlaceholder={mode === 'encode' ? 'Type text to encode…' : 'Paste Z85 to decode…'}
      sample={mode === 'encode' ? 'Hello, Z85!' : 'HelloWorld'}
      downloadName={mode === 'encode' ? 'encoded.z85.txt' : 'decoded.txt'}
      options={
        <>
          <Field label="Direction">
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'encode' | 'decode')}>
              <TabsList>
                <TabsTrigger value="encode">Encode</TabsTrigger>
                <TabsTrigger value="decode">Decode</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === 'encode' && (
            <Field label="Zero-pad to multiple of 4" hint="records original length">
              <Switch checked={pad} onCheckedChange={setPad} />
            </Field>
          )}
        </>
      }
    />
  );
}
