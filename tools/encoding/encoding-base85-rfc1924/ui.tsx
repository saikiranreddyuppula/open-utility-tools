'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'encode' | 'decode';
type Variant = 'ascii85' | 'rfc1924' | 'z85';
type InputEnc = 'text' | 'hex';

// Z85 alphabet (ZeroMQ RFC 32).
const Z85 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#';
// RFC 1924 alphabet.
const RFC1924 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~';

function alphabetFor(v: Variant): string | null {
  if (v === 'z85') return Z85;
  if (v === 'rfc1924') return RFC1924;
  return null; // ascii85 uses charcode 33 + value
}

function hexToBytes(text: string): Uint8Array {
  const cleaned = text.replace(/[\s:_-]+/g, '');
  if (cleaned.length % 2 !== 0) throw new Error('Hex input needs an even number of digits.');
  if (!/^[0-9a-fA-F]*$/.test(cleaned)) throw new Error('Hex input has invalid characters.');
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i++) parts.push((bytes[i] ?? 0).toString(16).padStart(2, '0'));
  return parts.join('');
}

function encode85(bytes: Uint8Array, variant: Variant, useZ: boolean): string {
  const alpha = alphabetFor(variant);
  let out = '';
  for (let i = 0; i < bytes.length; i += 4) {
    const len = Math.min(4, bytes.length - i);
    let n = 0;
    for (let j = 0; j < 4; j++) n = (n * 256 + (bytes[i + j] ?? 0)) >>> 0;
    if (variant === 'ascii85' && useZ && len === 4 && n === 0) {
      out += 'z';
      continue;
    }
    const group: string[] = [];
    let acc = n;
    for (let j = 0; j < 5; j++) {
      const d = acc % 85;
      acc = Math.floor(acc / 85);
      group.unshift(alpha === null ? String.fromCharCode(d + 33) : (alpha[d] ?? ''));
    }
    out += group.slice(0, len + 1).join('');
  }
  return out;
}

function decode85(text: string, variant: Variant): Uint8Array {
  const alpha = alphabetFor(variant);
  let s = text.replace(/^\s*<~/, '').replace(/~>\s*$/, '');
  s = s.replace(/\s+/g, '');
  const valueMap: Record<string, number> = {};
  if (alpha !== null) {
    for (let i = 0; i < alpha.length; i++) {
      const ch = alpha[i];
      if (ch !== undefined) valueMap[ch] = i;
    }
  }
  const out: number[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (variant === 'ascii85' && ch === 'z') {
      out.push(0, 0, 0, 0);
      i++;
      continue;
    }
    const group = s.slice(i, i + 5);
    const len = group.length;
    if (len < 2) throw new Error('Invalid Base85 group (a final group must be at least 2 chars).');
    let n = 0;
    for (let j = 0; j < 5; j++) {
      let c: number;
      if (j < len) {
        const gch = group[j] ?? '';
        if (alpha === null) {
          c = gch.charCodeAt(0) - 33;
        } else {
          const v = valueMap[gch];
          if (v === undefined) throw new Error(`Invalid Base85 character "${gch}".`);
          c = v;
        }
        if (c < 0 || c > 84) throw new Error(`Invalid Base85 character "${gch}".`);
      } else {
        c = 84; // pad with max value
      }
      n = (n * 85 + c) >>> 0;
    }
    const b = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    for (let j = 0; j < len - 1; j++) out.push(b[j] ?? 0);
    i += 5;
  }
  return new Uint8Array(out);
}

export default function Base85Tool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [variant, setVariant] = useState<Variant>('ascii85');
  const [inputEnc, setInputEnc] = useState<InputEnc>('text');
  const [outputHex, setOutputHex] = useState(false);
  const [delimiters, setDelimiters] = useState(false);
  const [useZ, setUseZ] = useState(true);
  const [wrap, setWrap] = useState('0');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim() && mode === 'encode') return '';
      if (mode === 'encode') {
        const bytes = inputEnc === 'hex' ? hexToBytes(input) : new TextEncoder().encode(input);
        let out = encode85(bytes, variant, useZ);
        if (variant === 'ascii85' && delimiters) out = `<~${out}~>`;
        const w = Number(wrap);
        if (Number.isFinite(w) && w > 0) {
          const lines: string[] = [];
          for (let k = 0; k < out.length; k += w) lines.push(out.slice(k, k + w));
          out = lines.join('\n');
        }
        return out;
      }
      const bytes = decode85(input, variant);
      if (outputHex) return bytesToHex(bytes);
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    },
    [mode, variant, inputEnc, outputHex, delimiters, useZ, wrap],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, variant, inputEnc, outputHex, delimiters, useZ, wrap]}
      inputLabel={mode === 'encode' ? (inputEnc === 'hex' ? 'Hex bytes' : 'Text') : 'Base85'}
      outputLabel={mode === 'encode' ? 'Base85' : outputHex ? 'Hex bytes' : 'Text'}
      sample={mode === 'encode' ? 'Hello, world!' : '87cURD]j7BEbo80'}
      downloadName="base85.txt"
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
          <Field label="Alphabet">
            <Tabs value={variant} onValueChange={(v) => setVariant(v as Variant)}>
              <TabsList>
                <TabsTrigger value="ascii85">ASCII85</TabsTrigger>
                <TabsTrigger value="rfc1924">RFC 1924</TabsTrigger>
                <TabsTrigger value="z85">Z85</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === 'encode' && (
            <>
              <Field label="Input encoding">
                <Select value={inputEnc} onValueChange={(v) => setInputEnc(v as InputEnc)}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text (UTF-8)</SelectItem>
                    <SelectItem value="hex">Hex</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Wrap width (0 = off)">
                <Input
                  value={wrap}
                  onChange={(e) => setWrap(e.target.value)}
                  inputMode="numeric"
                  className="w-24"
                />
              </Field>
            </>
          )}
          {mode === 'decode' && (
            <Field label="Output as hex">
              <Switch checked={outputHex} onCheckedChange={setOutputHex} />
            </Field>
          )}
          {variant === 'ascii85' && (
            <>
              <Field label="<~ ~> delimiters" hint="encode only">
                <Switch checked={delimiters} onCheckedChange={setDelimiters} />
              </Field>
              <Field label="z shorthand for zeros">
                <Switch checked={useZ} onCheckedChange={setUseZ} />
              </Field>
            </>
          )}
        </>
      }
    />
  );
}
