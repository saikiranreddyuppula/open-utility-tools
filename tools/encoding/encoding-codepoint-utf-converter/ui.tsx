'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'cp-to-bytes' | 'bytes-to-cp';
type Endian = 'be' | 'le';

function hex(n: number, pad: number): string {
  return n.toString(16).toUpperCase().padStart(pad, '0');
}

function utf8Bytes(cp: number): number[] {
  if (cp <= 0x7f) return [cp];
  if (cp <= 0x7ff) return [0xc0 | (cp >> 6), 0x80 | (cp & 0x3f)];
  if (cp <= 0xffff) return [0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f)];
  return [
    0xf0 | (cp >> 18),
    0x80 | ((cp >> 12) & 0x3f),
    0x80 | ((cp >> 6) & 0x3f),
    0x80 | (cp & 0x3f),
  ];
}

function utf16Units(cp: number): number[] {
  if (cp <= 0xffff) return [cp];
  const v = cp - 0x10000;
  return [0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff)];
}

function parseCodePoint(token: string): number {
  const t = token.trim();
  let value: number;
  if (/^(U\+|0x)/i.test(t)) {
    value = Number.parseInt(t.replace(/^(U\+|0x)/i, ''), 16);
  } else if (/^[0-9]+$/.test(t)) {
    value = Number.parseInt(t, 10);
  } else if (/^[0-9a-f]+$/i.test(t)) {
    value = Number.parseInt(t, 16);
  } else {
    throw new Error(`Cannot parse code point: "${t}"`);
  }
  if (!Number.isFinite(value) || value < 0 || value > 0x10ffff) {
    throw new Error(`Code point out of range (0 – U+10FFFF): "${t}"`);
  }
  if (value >= 0xd800 && value <= 0xdfff) {
    throw new Error(`Lone surrogate is not a valid scalar value: "${t}"`);
  }
  return value;
}

function encode(input: string, endian: Endian, showSurrogate: boolean): string {
  const tokens = input.split(/[\s,]+/).filter(Boolean);
  if (tokens.length === 0) return '';
  const lines: string[] = [];
  for (const tok of tokens) {
    const cp = parseCodePoint(tok);
    const glyph = String.fromCodePoint(cp);
    const u8 = utf8Bytes(cp).map((b) => hex(b, 2)).join(' ');
    const units = utf16Units(cp);
    const u16 = units
      .map((u) => (endian === 'be' ? hex(u, 4) : hex(((u & 0xff) << 8) | (u >> 8), 4)))
      .join(' ');
    lines.push(`U+${hex(cp, 4)}  '${glyph}'`);
    lines.push(`  UTF-8 : ${u8}`);
    lines.push(`  UTF-16: ${u16} (${endian.toUpperCase()})`);
    if (showSurrogate && units.length === 2) {
      lines.push(`          high=${hex(units[0] ?? 0, 4)} low=${hex(units[1] ?? 0, 4)}`);
    }
    lines.push(`  UTF-32: ${hex(cp, 8)}  (dec ${cp})`);
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

function parseHexBytes(input: string): number[] {
  const tokens = input.split(/[\s,]+/).filter(Boolean);
  const bytes: number[] = [];
  for (const tok of tokens) {
    const clean = tok.replace(/^0x/i, '');
    if (!/^[0-9a-f]+$/i.test(clean)) throw new Error(`Invalid hex token: "${tok}"`);
    // Allow tokens of any even length; split into bytes.
    if (clean.length % 2 !== 0) throw new Error(`Hex token needs even digits: "${tok}"`);
    for (let i = 0; i < clean.length; i += 2) {
      bytes.push(Number.parseInt(clean.slice(i, i + 2), 16));
    }
  }
  return bytes;
}

function decodeUtf8(input: string): string {
  const bytes = Uint8Array.from(parseHexBytes(input));
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const lines: string[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    lines.push(`U+${hex(cp, 4)}  '${ch}'`);
  }
  return lines.join('\n');
}

function decodeUtf16(input: string, endian: Endian): string {
  const bytes = parseHexBytes(input);
  if (bytes.length % 2 !== 0) throw new Error('UTF-16 needs an even number of bytes.');
  const units: number[] = [];
  for (let i = 0; i < bytes.length; i += 2) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1] ?? 0;
    units.push(endian === 'be' ? (a << 8) | b : (b << 8) | a);
  }
  const text = String.fromCharCode(...units);
  const lines: string[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    lines.push(`U+${hex(cp, 4)}  '${ch}'`);
  }
  return lines.join('\n');
}

export default function CodePointUtfTool() {
  const [mode, setMode] = useState<Mode>('cp-to-bytes');
  const [endian, setEndian] = useState<Endian>('be');
  const [decodeAs, setDecodeAs] = useState<'utf8' | 'utf16'>('utf8');
  const [showSurrogate, setShowSurrogate] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      if (mode === 'cp-to-bytes') return encode(input, endian, showSurrogate);
      return decodeAs === 'utf8' ? decodeUtf8(input) : decodeUtf16(input, endian);
    },
    [mode, endian, decodeAs, showSurrogate],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, endian, decodeAs, showSurrogate]}
      inputLabel={mode === 'cp-to-bytes' ? 'Code points' : 'Bytes (hex)'}
      outputLabel={mode === 'cp-to-bytes' ? 'Encodings' : 'Code points'}
      inputPlaceholder={
        mode === 'cp-to-bytes' ? 'U+1F600, 0x20AC, 65' : 'F0 9F 98 80'
      }
      sample={mode === 'cp-to-bytes' ? 'U+1F600\n0x20AC\n65' : 'F0 9F 98 80'}
      downloadName="codepoints.txt"
      options={
        <>
          <Field label="Direction">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="cp-to-bytes">Code point → bytes</TabsTrigger>
                <TabsTrigger value="bytes-to-cp">Bytes → code point</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === 'bytes-to-cp' && (
            <Field label="Decode as">
              <Tabs value={decodeAs} onValueChange={(v) => setDecodeAs(v as 'utf8' | 'utf16')}>
                <TabsList>
                  <TabsTrigger value="utf8">UTF-8</TabsTrigger>
                  <TabsTrigger value="utf16">UTF-16</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
          )}
          {(mode === 'cp-to-bytes' || decodeAs === 'utf16') && (
            <Field label="UTF-16 endian">
              <Tabs value={endian} onValueChange={(v) => setEndian(v as Endian)}>
                <TabsList>
                  <TabsTrigger value="be">Big-endian</TabsTrigger>
                  <TabsTrigger value="le">Little-endian</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
          )}
          {mode === 'cp-to-bytes' && (
            <Field label="Detail">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="cp-surr"
                  checked={showSurrogate}
                  onCheckedChange={(c) => setShowSurrogate(c === true)}
                />
                <Label htmlFor="cp-surr">Surrogate breakdown</Label>
              </div>
            </Field>
          )}
        </>
      }
    />
  );
}
