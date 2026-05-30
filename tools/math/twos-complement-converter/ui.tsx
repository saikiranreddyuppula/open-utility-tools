'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Width = 8 | 16 | 32 | 64;
type Dir = 'encode' | 'decode';
type InFormat = 'binary' | 'hex';

const WIDTHS: Width[] = [8, 16, 32, 64];

function groupBinary(bits: string): string {
  // Group into nibbles of 4 for readability.
  const groups: string[] = [];
  for (let i = bits.length; i > 0; i -= 4) {
    groups.unshift(bits.slice(Math.max(0, i - 4), i));
  }
  return groups.join(' ');
}

type Result =
  | { error: string }
  | {
      rows: { label: string; value: string }[];
      steps: { label: string; value: string }[];
      signBit: string;
    };

export default function TwosComplementConverterTool() {
  const [dir, setDir] = useState<Dir>('encode');
  const [width, setWidth] = useState<Width>(8);
  const [decInput, setDecInput] = useState('-42');
  const [patInput, setPatInput] = useState('11010110');
  const [inFmt, setInFmt] = useState<InFormat>('binary');

  const result = useMemo<Result>(() => {
    const n = BigInt(width);
    const mod = 1n << n; // 2^width
    const min = -(1n << (n - 1n));
    const max = (1n << (n - 1n)) - 1n;

    if (dir === 'encode') {
      const raw = decInput.trim();
      if (raw === '' || !/^[+-]?\d+$/.test(raw)) {
        return { error: 'Enter a valid signed decimal integer.' };
      }
      let value: bigint;
      try {
        value = BigInt(raw);
      } catch {
        return { error: 'Could not parse the integer.' };
      }
      if (value < min || value > max) {
        return {
          error: `${value} is out of range for ${width}-bit two's complement [${min}, ${max}].`,
        };
      }
      const unsigned = value < 0n ? value + mod : value;
      const bin = unsigned.toString(2).padStart(width, '0');
      const hex = unsigned.toString(16).toUpperCase().padStart(width / 4, '0');
      const signBit = bin.charAt(0);

      const steps: { label: string; value: string }[] = [];
      if (value < 0n) {
        const magnitude = -value;
        const magBin = magnitude.toString(2).padStart(width, '0');
        const inverted = magBin
          .split('')
          .map((c) => (c === '0' ? '1' : '0'))
          .join('');
        steps.push({ label: `1. |value| = ${magnitude} in binary`, value: groupBinary(magBin) });
        steps.push({ label: '2. Invert all bits', value: groupBinary(inverted) });
        steps.push({ label: '3. Add 1', value: groupBinary(bin) });
      } else {
        steps.push({ label: 'Non-negative — pattern is the plain binary', value: groupBinary(bin) });
      }

      const rows: { label: string; value: string }[] = [
        { label: 'Signed decimal', value: value.toString() },
        { label: `Binary (${width}-bit)`, value: groupBinary(bin) },
        { label: 'Hexadecimal', value: `0x${hex}` },
        { label: 'Unsigned decimal', value: unsigned.toString() },
        { label: 'Sign bit', value: signBit },
        { label: 'Range', value: `[${min}, ${max}]` },
      ];
      return { rows, steps, signBit };
    }

    // decode
    const raw = patInput.trim().replace(/\s+/g, '');
    if (raw === '') return { error: 'Enter a bit pattern to decode.' };

    let unsigned: bigint;
    if (inFmt === 'binary') {
      if (!/^[01]+$/.test(raw)) return { error: 'Binary input may contain only 0 and 1.' };
      if (raw.length > width) {
        return { error: `Pattern is ${raw.length} bits — too long for a ${width}-bit width.` };
      }
      unsigned = BigInt('0b' + raw.padStart(width, '0'));
    } else {
      const cleaned = raw.replace(/^0[xX]/, '');
      if (!/^[0-9a-fA-F]+$/.test(cleaned)) return { error: 'Hex input may contain only 0-9 and A-F.' };
      if (cleaned.length > width / 4) {
        return { error: `Hex value is too wide for a ${width}-bit width.` };
      }
      unsigned = BigInt('0x' + cleaned);
    }

    if (unsigned >= mod) {
      return { error: `Value exceeds the ${width}-bit range.` };
    }

    const bin = unsigned.toString(2).padStart(width, '0');
    const hex = unsigned.toString(16).toUpperCase().padStart(width / 4, '0');
    const signBit = bin.charAt(0);
    const signed = signBit === '1' ? unsigned - mod : unsigned;

    const steps: { label: string; value: string }[] = [];
    steps.push({ label: 'Pattern', value: groupBinary(bin) });
    if (signBit === '1') {
      steps.push({ label: 'Sign bit is 1 → negative', value: 'subtract 2^width' });
      steps.push({ label: `${unsigned} − ${mod}`, value: signed.toString() });
    } else {
      steps.push({ label: 'Sign bit is 0 → non-negative', value: signed.toString() });
    }

    const rows: { label: string; value: string }[] = [
      { label: 'Signed decimal', value: signed.toString() },
      { label: 'Unsigned decimal', value: unsigned.toString() },
      { label: `Binary (${width}-bit)`, value: groupBinary(bin) },
      { label: 'Hexadecimal', value: `0x${hex}` },
      { label: 'Sign bit', value: signBit },
      { label: 'Range', value: `[${min}, ${max}]` },
    ];
    return { rows, steps, signBit };
  }, [dir, width, decInput, patInput, inFmt]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Direction">
            <Tabs value={dir} onValueChange={(v) => setDir(v as Dir)}>
              <TabsList>
                <TabsTrigger value="encode">Encode (dec → bits)</TabsTrigger>
                <TabsTrigger value="decode">Decode (bits → dec)</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Bit width">
            <Select value={String(width)} onValueChange={(v) => setWidth(Number(v) as Width)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WIDTHS.map((w) => (
                  <SelectItem key={w} value={String(w)}>
                    {w}-bit
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {dir === 'encode' ? (
            <Field label="Signed decimal integer">
              <Input
                value={decInput}
                onChange={(e) => setDecInput(e.target.value)}
                inputMode="numeric"
                className="w-40 font-mono"
                placeholder="e.g. -42"
              />
            </Field>
          ) : (
            <>
              <Field label="Input format">
                <Tabs value={inFmt} onValueChange={(v) => setInFmt(v as InFormat)}>
                  <TabsList>
                    <TabsTrigger value="binary">Binary</TabsTrigger>
                    <TabsTrigger value="hex">Hex</TabsTrigger>
                  </TabsList>
                </Tabs>
              </Field>
              <Field label="Bit pattern">
                <Input
                  value={patInput}
                  onChange={(e) => setPatInput(e.target.value)}
                  className="w-56 font-mono"
                  placeholder={inFmt === 'binary' ? '11010110' : 'D6'}
                />
              </Field>
            </>
          )}
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="Result">
              <CopyButton value={() => result.rows.map((r) => `${r.label}: ${r.value}`).join('\n')} />
            </PanelHeader>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
              {result.rows.map((r) => (
                <div
                  key={r.label}
                  className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
                >
                  <span className="shrink-0 text-sm text-muted-foreground">{r.label}</span>
                  <span className="flex items-center gap-2 font-mono text-sm">
                    <span className="break-all text-right">{r.value}</span>
                    <CopyButton value={r.value} size="icon-sm" />
                  </span>
                </div>
              ))}
            </div>
            <StatBar items={[`${width}-bit`, `Sign bit = ${result.signBit}`]} />
          </Panel>

          <Panel>
            <PanelHeader title="Steps" />
            <div className="divide-y">
              {result.steps.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-sm text-muted-foreground">{s.label}</span>
                  <span className="break-all text-right font-mono text-sm">{s.value}</span>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
