'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'table' | 'stream' | 'decode';
type Radix = 'dec' | 'bin' | 'oct' | 'hex';
type Basis = 'char' | 'byte';

const RADIX_NUM: Record<Radix, number> = { dec: 10, bin: 2, oct: 8, hex: 16 };

function fmt(n: number, radix: Radix, pad: number, upper: boolean): string {
  let s = n.toString(RADIX_NUM[radix]);
  if (radix === 'hex' && upper) s = s.toUpperCase();
  return pad > 0 ? s.padStart(pad, '0') : s;
}

function table(input: string, basis: Basis, upper: boolean): string {
  const lines: string[] = ['glyph  cp(U+)   dec   binary    octal  hex'];
  const enc = new TextEncoder();
  for (const ch of input) {
    if (ch === '\n') continue;
    const cp = ch.codePointAt(0) ?? 0;
    lines.push(
      `${ch.padEnd(4)}  ${('U+' + cp.toString(16).toUpperCase().padStart(4, '0')).padEnd(7)}` +
        ` ${String(cp).padStart(5)}  ${fmt(cp, 'bin', 8, upper).padStart(8)}  ${fmt(cp, 'oct', 0, upper).padStart(5)}  ${fmt(cp, 'hex', 0, upper)}`,
    );
    if (basis === 'byte') {
      const bytes = Array.from(enc.encode(ch));
      const hexBytes = bytes.map((b) => fmt(b, 'hex', 2, upper)).join(' ');
      const decBytes = bytes.map((b) => String(b)).join(' ');
      lines.push(`        UTF-8 bytes: hex ${hexBytes}  dec ${decBytes}`);
    }
  }
  return lines.join('\n');
}

function stream(
  input: string,
  basis: Basis,
  radix: Radix,
  sep: string,
  pad: number,
  upper: boolean,
): string {
  const values: number[] = [];
  if (basis === 'char') {
    for (const ch of input) {
      const cp = ch.codePointAt(0);
      if (cp !== undefined) values.push(cp);
    }
  } else {
    for (const b of new TextEncoder().encode(input)) values.push(b);
  }
  return values.map((v) => fmt(v, radix, pad, upper)).join(sep);
}

function decodeStream(input: string, radix: Radix, basis: Basis): string {
  const tokens = input.split(/[\s,]+/).filter(Boolean);
  const values: number[] = [];
  for (const tok of tokens) {
    const clean = tok.replace(/^0x/i, '').replace(/^0b/i, '').replace(/^0o/i, '');
    const v = Number.parseInt(clean, RADIX_NUM[radix]);
    if (!Number.isFinite(v) || v < 0) throw new Error(`Invalid value for radix: "${tok}"`);
    values.push(v);
  }
  if (basis === 'byte') {
    const bytes = Uint8Array.from(values.map((v) => v & 0xff));
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
  return values
    .map((v) => {
      if (v > 0x10ffff) throw new Error(`Code point out of range: ${v}`);
      return String.fromCodePoint(v);
    })
    .join('');
}

export default function MultiRadixTool() {
  const [mode, setMode] = useState<Mode>('table');
  const [basis, setBasis] = useState<Basis>('char');
  const [radix, setRadix] = useState<Radix>('hex');
  const [sep, setSep] = useState(' ');
  const [pad, setPad] = useState('2');
  const [upper, setUpper] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      const padN = (() => {
        const n = Number.parseInt(pad, 10);
        return Number.isFinite(n) && n >= 0 ? n : 0;
      })();
      if (mode === 'table') return table(input, basis, upper);
      if (mode === 'stream') return stream(input, basis, radix, sep || ' ', padN, upper);
      return decodeStream(input, radix, basis);
    },
    [mode, basis, radix, sep, pad, upper],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, basis, radix, sep, pad, upper]}
      inputLabel={mode === 'decode' ? `Values (${radix})` : 'Text'}
      outputLabel={mode === 'table' ? 'All bases' : mode === 'stream' ? 'Stream' : 'Text'}
      inputPlaceholder={mode === 'decode' ? '48 69 21' : 'Hi!'}
      sample={mode === 'decode' ? '48 69 21 20 AC' : 'Hi! €'}
      downloadName="radix.txt"
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="table">All bases</TabsTrigger>
                <TabsTrigger value="stream">Stream</TabsTrigger>
                <TabsTrigger value="decode">Decode</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Basis">
            <Tabs value={basis} onValueChange={(v) => setBasis(v as Basis)}>
              <TabsList>
                <TabsTrigger value="char">Code point</TabsTrigger>
                <TabsTrigger value="byte">UTF-8 byte</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {(mode === 'stream' || mode === 'decode') && (
            <Field label="Radix">
              <Tabs value={radix} onValueChange={(v) => setRadix(v as Radix)}>
                <TabsList>
                  <TabsTrigger value="dec">Dec</TabsTrigger>
                  <TabsTrigger value="bin">Bin</TabsTrigger>
                  <TabsTrigger value="oct">Oct</TabsTrigger>
                  <TabsTrigger value="hex">Hex</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
          )}
          {mode === 'stream' && (
            <>
              <Field label="Separator" className="w-24">
                <Input value={sep} onChange={(e) => setSep(e.target.value)} placeholder="space" />
              </Field>
              <Field label="Pad width" className="w-24">
                <Input
                  value={pad}
                  onChange={(e) => setPad(e.target.value)}
                  inputMode="numeric"
                  placeholder="0"
                />
              </Field>
            </>
          )}
          {(mode !== 'decode') && (
            <Field label="Hex case">
              <div className="flex items-center gap-2">
                <Checkbox id="rx-up" checked={upper} onCheckedChange={(c) => setUpper(c === true)} />
                <Label htmlFor="rx-up">Uppercase hex</Label>
              </div>
            </Field>
          )}
        </>
      }
    />
  );
}
