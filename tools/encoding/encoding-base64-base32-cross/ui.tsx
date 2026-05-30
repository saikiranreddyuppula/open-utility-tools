'use client';

import { useCallback, useMemo, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TextToolLayout } from '@/components/tools/text-tool';

type Direction = '64to32' | '32to64';

const B32_STD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const B32_HEX = '0123456789ABCDEFGHIJKLMNOPQRSTUV';

// ---- Base64 (browser atob/btoa over Latin-1) ----
function base64ToBytes(input: string, urlSafe: boolean): Uint8Array {
  let s = input.replace(/\s+/g, '');
  if (urlSafe) s = s.replace(/-/g, '+').replace(/_/g, '/');
  // Tolerate missing padding.
  while (s.length % 4 !== 0) s += '=';
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) {
    throw new Error('Invalid Base64: unexpected characters for the chosen alphabet.');
  }
  let bin: string;
  try {
    bin = atob(s);
  } catch {
    throw new Error('Invalid Base64 string.');
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) & 0xff;
  return bytes;
}

function bytesToBase64(bytes: Uint8Array, urlSafe: boolean, pad: boolean): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
  let out = btoa(bin);
  if (urlSafe) out = out.replace(/\+/g, '-').replace(/\//g, '_');
  if (!pad) out = out.replace(/=+$/, '');
  return out;
}

// ---- Base32 (RFC 4648 standard or extended-hex) ----
function base32ToBytes(input: string, alphabet: string): Uint8Array {
  const cleaned = input.replace(/[\s=]+/g, '').toUpperCase();
  const valueMap: Record<string, number> = {};
  for (let i = 0; i < alphabet.length; i++) {
    const ch = alphabet[i];
    if (ch !== undefined) valueMap[ch] = i;
  }
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of cleaned) {
    const v = valueMap[ch];
    if (v === undefined) {
      throw new Error(`Invalid Base32 character "${ch}" for the chosen alphabet.`);
    }
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

function bytesToBase32(bytes: Uint8Array, alphabet: string, pad: boolean): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | (bytes[i] ?? 0);
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += alphabet[(value >>> bits) & 31] ?? '';
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31] ?? '';
  if (pad) {
    while (out.length % 8 !== 0) out += '=';
  }
  return out;
}

function toHexPreview(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    parts.push((bytes[i] ?? 0).toString(16).padStart(2, '0'));
  }
  return parts.join(' ');
}

export default function Base64Base32CrossTool() {
  const [dir, setDir] = useState<Direction>('64to32');
  const [urlSafe, setUrlSafe] = useState(false);
  const [b32hex, setB32hex] = useState(false);
  const [pad, setPad] = useState(true);

  const b32alphabet = b32hex ? B32_HEX : B32_STD;

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      if (dir === '64to32') {
        const bytes = base64ToBytes(input, urlSafe);
        const out = bytesToBase32(bytes, b32alphabet, pad);
        return `${out}\n\n— ${bytes.length} bytes — hex: ${toHexPreview(bytes)}`;
      }
      const bytes = base32ToBytes(input, b32alphabet);
      const out = bytesToBase64(bytes, urlSafe, pad);
      return `${out}\n\n— ${bytes.length} bytes — hex: ${toHexPreview(bytes)}`;
    },
    [dir, urlSafe, b32alphabet, pad],
  );

  const sample = useMemo(
    () => (dir === '64to32' ? 'SGVsbG8sIHdvcmxkIQ==' : 'JBSWY3DPFQQHO33SNRSCC==='),
    [dir],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[dir, urlSafe, b32hex, pad]}
      inputLabel={dir === '64to32' ? 'Base64 input' : 'Base32 input'}
      outputLabel={dir === '64to32' ? 'Base32 output' : 'Base64 output'}
      sample={sample}
      downloadName="transcoded.txt"
      options={
        <>
          <Field label="Direction">
            <Tabs value={dir} onValueChange={(v) => setDir(v as Direction)}>
              <TabsList>
                <TabsTrigger value="64to32">Base64 → Base32</TabsTrigger>
                <TabsTrigger value="32to64">Base32 → Base64</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="URL-safe Base64" hint="- _ instead of + /">
            <Switch checked={urlSafe} onCheckedChange={setUrlSafe} />
          </Field>
          <Field label="Base32hex alphabet" hint="0-9 A-V">
            <Switch checked={b32hex} onCheckedChange={setB32hex} />
          </Field>
          <Field label="Padding (=)">
            <Switch checked={pad} onCheckedChange={setPad} />
          </Field>
        </>
      }
    />
  );
}
