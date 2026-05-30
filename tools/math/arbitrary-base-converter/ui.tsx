'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

function digitValue(ch: string): number {
  const idx = DIGITS.indexOf(ch.toLowerCase());
  return idx; // -1 if not a valid digit char
}

function encode(value: bigint, base: number): string {
  if (value === 0n) return '0';
  const neg = value < 0n;
  let v = neg ? -value : value;
  const big = BigInt(base);
  let out = '';
  while (v > 0n) {
    const rem = Number(v % big);
    out = (DIGITS[rem] ?? '?') + out;
    v = v / big;
  }
  return (neg ? '-' : '') + out;
}

function group(s: string, n: number, sep: string): string {
  if (n <= 0 || !sep) return s;
  const neg = s.startsWith('-');
  const body = neg ? s.slice(1) : s;
  const parts: string[] = [];
  for (let i = body.length; i > 0; i -= n) {
    parts.unshift(body.slice(Math.max(0, i - n), i));
  }
  return (neg ? '-' : '') + parts.join(sep);
}

const BASE_OPTIONS = Array.from({ length: 35 }, (_, i) => i + 2); // 2..36

export default function ArbitraryBaseConverterTool() {
  const [raw, setRaw] = useState('255');
  const [fromBase, setFromBase] = useState(10);
  const [toBase, setToBase] = useState(16);
  const [upper, setUpper] = useState(false);
  const [groupSize, setGroupSize] = useState('0');

  const result = useMemo(() => {
    const s = raw.trim();
    if (!s) return { empty: true as const };

    const neg = s.startsWith('-');
    const digits = (neg ? s.slice(1) : s).replace(/\s+/g, '');
    if (!digits) return { error: 'Enter a number to convert.' };

    let acc = 0n;
    const big = BigInt(fromBase);
    for (const ch of digits) {
      const d = digitValue(ch);
      if (d < 0) return { error: `"${ch}" is not a valid digit.` };
      if (d >= fromBase) {
        return { error: `Digit "${ch}" (value ${d}) is not valid in base ${fromBase}.` };
      }
      acc = acc * big + BigInt(d);
    }
    const value = neg ? -acc : acc;

    let converted = encode(value, toBase);
    if (upper) converted = converted.toUpperCase();

    const gN = Number(groupSize);
    if (Number.isFinite(gN) && gN > 0) {
      converted = group(converted, Math.floor(gN), ' ');
    }

    const bin = encode(value, 2);
    const oct = encode(value, 8);
    const dec = value.toString(10);
    const hex = (upper ? encode(value, 16).toUpperCase() : encode(value, 16));

    return {
      converted,
      bases: [
        { label: `Base 2`, value: bin },
        { label: `Base 8`, value: oct },
        { label: `Base 10`, value: dec },
        { label: `Base 16`, value: hex },
      ],
    };
  }, [raw, fromBase, toBase, upper, groupSize]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Number" className="min-w-[200px] flex-1">
            <Input
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="e.g. 255"
              spellCheck={false}
              className="font-mono"
            />
          </Field>
          <Field label="From base">
            <Select value={String(fromBase)} onValueChange={(v) => setFromBase(Number(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BASE_OPTIONS.map((b) => (
                  <SelectItem key={b} value={String(b)}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="To base">
            <Select value={String(toBase)} onValueChange={(v) => setToBase(Number(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BASE_OPTIONS.map((b) => (
                  <SelectItem key={b} value={String(b)}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Group every">
            <Input
              type="number"
              min={0}
              max={12}
              value={groupSize}
              onChange={(e) => setGroupSize(e.target.value)}
              className="w-20 font-mono"
            />
          </Field>
          <Field label="Uppercase">
            <Switch checked={upper} onCheckedChange={setUpper} />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : 'empty' in result ? (
        <p className="px-1 text-2xs text-muted-foreground">
          Enter an integer above to convert between bases 2–36 using arbitrary-precision BigInt.
        </p>
      ) : (
        <>
          <Panel>
            <PanelHeader title={`Result (base ${toBase})`}>
              <CopyButton value={result.converted} />
            </PanelHeader>
            <div className="break-all p-3 font-mono text-lg">{result.converted}</div>
          </Panel>

          <Panel>
            <PanelHeader title="Common bases" />
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
              {result.bases.map((b) => (
                <div
                  key={b.label}
                  className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
                >
                  <span className="shrink-0 text-sm text-muted-foreground">{b.label}</span>
                  <span className="flex min-w-0 items-center gap-2 font-mono text-sm">
                    <span className="truncate">{b.value}</span>
                    <CopyButton value={b.value} size="icon-sm" />
                  </span>
                </div>
              ))}
            </div>
            <StatBar items={[`From base ${fromBase}`, `To base ${toBase}`]} />
          </Panel>
        </>
      )}
    </div>
  );
}
