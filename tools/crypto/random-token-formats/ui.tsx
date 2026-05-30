'use client';

import { useMemo, useState } from 'react';
import { GeneratorList } from '@/components/tools/generator-list';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

type Format =
  | 'hex'
  | 'base64'
  | 'base64url'
  | 'base32'
  | 'alphanumeric'
  | 'urlsafe';

// Whether a format is sized by raw bytes or by output characters.
const BYTE_BASED: Record<Format, boolean> = {
  hex: true,
  base64: true,
  base64url: true,
  base32: true,
  alphanumeric: false,
  urlsafe: false,
};

const B32_CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const URLSAFE = ALPHANUM + '-_';

function randomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  wc.getRandomValues(buf);
  return buf;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
  return btoa(bin);
}

function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function toBase32Crockford(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | (bytes[i] ?? 0);
    bits += 8;
    while (bits >= 5) {
      out += B32_CROCKFORD.charAt((value >>> (bits - 5)) & 31);
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_CROCKFORD.charAt((value << (5 - bits)) & 31);
  return out;
}

// Unbiased character selection from an arbitrary alphabet via rejection sampling.
function fromAlphabet(alphabet: string, count: number): string {
  const n = alphabet.length;
  const max = Math.floor(256 / n) * n;
  let out = '';
  while (out.length < count) {
    const buf = randomBytes(Math.max(16, count - out.length));
    for (let i = 0; i < buf.length && out.length < count; i++) {
      const b = buf[i] ?? 0;
      if (b < max) out += alphabet.charAt(b % n);
    }
  }
  return out;
}

function group(s: string, size: number): string {
  if (size <= 0) return s;
  const parts: string[] = [];
  for (let i = 0; i < s.length; i += size) parts.push(s.slice(i, i + size));
  return parts.join('-');
}

export default function RandomTokenFormats() {
  const [format, setFormat] = useState<Format>('base64url');
  const [size, setSize] = useState(32);
  const [prefix, setPrefix] = useState('');
  const [grouping, setGrouping] = useState(0);

  const isByteBased = BYTE_BASED[format];

  // Entropy: byte-based = 8 bits/byte; char-based = log2(alphabet)/char.
  const entropy = useMemo(() => {
    if (isByteBased) return Math.round(size * 8 * 10) / 10;
    const alphabet = format === 'alphanumeric' ? ALPHANUM.length : URLSAFE.length;
    return Math.round(size * Math.log2(alphabet) * 10) / 10;
  }, [format, size, isByteBased]);

  const generate = () => {
    let core: string;
    switch (format) {
      case 'hex':
        core = toHex(randomBytes(size));
        break;
      case 'base64':
        core = toBase64(randomBytes(size));
        break;
      case 'base64url':
        core = toBase64Url(randomBytes(size));
        break;
      case 'base32':
        core = toBase32Crockford(randomBytes(size));
        break;
      case 'alphanumeric':
        core = fromAlphabet(ALPHANUM, size);
        break;
      case 'urlsafe':
        core = fromAlphabet(URLSAFE, size);
        break;
      default:
        core = toHex(randomBytes(size));
        break;
    }
    if (grouping > 0) core = group(core, grouping);
    return `${prefix}${core}`;
  };

  return (
    <GeneratorList
      generate={generate}
      deps={[format, size, prefix, grouping]}
      defaultCount={5}
      maxCount={500}
      downloadName="tokens.txt"
      label={`Tokens · ~${entropy} bits each`}
      options={
        <>
          <Field label="Format">
            <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hex">Hex (bytes)</SelectItem>
                <SelectItem value="base64">Base64 (bytes)</SelectItem>
                <SelectItem value="base64url">Base64url (bytes)</SelectItem>
                <SelectItem value="base32">Base32 Crockford (bytes)</SelectItem>
                <SelectItem value="alphanumeric">Alphanumeric (chars)</SelectItem>
                <SelectItem value="urlsafe">URL-safe (chars)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field
            label={`${isByteBased ? 'Bytes' : 'Characters'} · ${size}`}
            className="min-w-48"
          >
            <Slider
              value={[size]}
              min={4}
              max={isByteBased ? 128 : 256}
              step={1}
              onValueChange={(v) => setSize(v[0] ?? 32)}
              className="mt-2.5"
            />
          </Field>
          <Field label="Prefix" hint="e.g. sk_live_">
            <Input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="(none)"
              className="w-36 font-mono"
            />
          </Field>
          <Field label={`Group every · ${grouping || 'off'}`} className="min-w-40">
            <Slider
              value={[grouping]}
              min={0}
              max={8}
              step={1}
              onValueChange={(v) => setGrouping(v[0] ?? 0)}
              className="mt-2.5"
            />
          </Field>
        </>
      }
    />
  );
}
