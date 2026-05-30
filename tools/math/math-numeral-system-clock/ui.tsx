'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

// Parse an integer from a string honoring 0x / 0o / 0b prefixes, else decimal.
function parseInteger(raw: string): { error: string } | { value: bigint } {
  const s = raw.trim();
  if (s === '') return { error: 'Enter an integer.' };

  let neg = false;
  let body = s;
  if (body.startsWith('-')) {
    neg = true;
    body = body.slice(1);
  } else if (body.startsWith('+')) {
    body = body.slice(1);
  }

  let radix = 10;
  if (body.startsWith('0x') || body.startsWith('0X')) {
    radix = 16;
    body = body.slice(2);
  } else if (body.startsWith('0o') || body.startsWith('0O')) {
    radix = 8;
    body = body.slice(2);
  } else if (body.startsWith('0b') || body.startsWith('0B')) {
    radix = 2;
    body = body.slice(2);
  }

  body = body.replace(/_/g, '');
  if (body === '') return { error: 'No digits after prefix.' };

  const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
  let value = 0n;
  const big = BigInt(radix);
  for (const ch of body.toLowerCase()) {
    const d = digits.indexOf(ch);
    if (d < 0 || d >= radix) {
      return { error: `Invalid digit "${ch}" for base ${radix}.` };
    }
    value = value * big + BigInt(d);
  }
  if (neg) value = -value;
  return { value };
}

function toBaseString(value: bigint, base: number): string {
  if (base < 2 || base > 36) return '';
  const neg = value < 0n;
  let v = neg ? -value : value;
  if (v === 0n) return '0';
  const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
  const big = BigInt(base);
  let out = '';
  while (v > 0n) {
    const rem = Number(v % big);
    out = (digits[rem] ?? '?') + out;
    v = v / big;
  }
  return (neg ? '-' : '') + out;
}

function groupBinary(bin: string): string {
  const neg = bin.startsWith('-');
  let body = neg ? bin.slice(1) : bin;
  // pad left to a multiple of 4
  const pad = (4 - (body.length % 4)) % 4;
  body = '0'.repeat(pad) + body;
  const groups: string[] = [];
  for (let i = 0; i < body.length; i += 4) {
    groups.push(body.slice(i, i + 4));
  }
  return (neg ? '-' : '') + groups.join(' ');
}

// Two's complement of value at the given bit width, or null if it doesn't fit.
function twosComplement(value: bigint, bits: number): string | null {
  const mod = 1n << BigInt(bits);
  const min = -(1n << BigInt(bits - 1));
  const max = (1n << BigInt(bits - 1)) - 1n;
  if (value < min || value > max) return null;
  const unsigned = ((value % mod) + mod) % mod;
  return unsigned.toString(2).padStart(bits, '0');
}

export default function NumberSystemVisualizerTool() {
  const [input, setInput] = useState('255');
  const [base, setBase] = useState('36');

  const result = useMemo(() => {
    const parsed = parseInteger(input);
    if ('error' in parsed) return parsed;

    const b = Number(base);
    if (!Number.isInteger(b) || b < 2 || b > 36) {
      return { error: 'Custom base must be an integer from 2 to 36.' };
    }

    const value = parsed.value;
    const bin = toBaseString(value, 2);
    const bitLength = value === 0n ? 1 : (value < 0n ? -value : value).toString(2).length;

    const widths = [8, 16, 32, 64];
    const twos = widths.map((w) => ({ bits: w, repr: twosComplement(value, w) }));

    return {
      value,
      bin,
      grouped: groupBinary(bin),
      oct: toBaseString(value, 8),
      dec: value.toString(10),
      hex: toBaseString(value, 16),
      custom: toBaseString(value, b),
      base: b,
      bitLength,
      twos,
    };
  }, [input, base]);

  if ('error' in result) {
    return (
      <div className="flex flex-col gap-3">
        <OptionsBar>
          <Field label="Number (dec / 0x / 0o / 0b)" htmlFor="ns-input">
            <Input
              id="ns-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="h-8 w-48 font-mono"
            />
          </Field>
          <Field label="Custom base (2-36)" htmlFor="ns-base">
            <Input
              id="ns-base"
              value={base}
              onChange={(e) => setBase(e.target.value)}
              type="number"
              min="2"
              max="36"
              className="h-8 w-24 font-mono"
            />
          </Field>
        </OptionsBar>
        <ErrorBanner error={result.error} />
      </div>
    );
  }

  const rows: { label: string; value: string }[] = [
    { label: 'Binary (base 2)', value: result.grouped },
    { label: 'Octal (base 8)', value: result.oct },
    { label: 'Decimal (base 10)', value: result.dec },
    { label: 'Hex (base 16)', value: result.hex },
    { label: `Base ${result.base}`, value: result.custom },
  ];

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Number (dec / 0x / 0o / 0b)" htmlFor="ns-input">
          <Input
            id="ns-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="h-8 w-48 font-mono"
          />
        </Field>
        <Field label="Custom base (2-36)" htmlFor="ns-base">
          <Input
            id="ns-base"
            value={base}
            onChange={(e) => setBase(e.target.value)}
            type="number"
            min="2"
            max="36"
            className="h-8 w-24 font-mono"
          />
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Representations" />
        <div className="divide-y">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3 px-3 py-2">
              <span className="w-36 shrink-0 text-sm text-muted-foreground">
                {r.label}
              </span>
              <code className="min-w-0 flex-1 break-all font-mono text-sm">
                {r.value}
              </code>
              <CopyButton value={r.value} size="icon-sm" />
            </div>
          ))}
        </div>
        <StatBar items={[`Bit length ${result.bitLength}`]} />
      </Panel>

      <Panel>
        <PanelHeader title="Two's complement" />
        <div className="divide-y">
          {result.twos.map((t) => (
            <div key={t.bits} className="flex items-center gap-3 px-3 py-2">
              <span className="w-20 shrink-0 text-sm text-muted-foreground">
                {t.bits}-bit
              </span>
              <code className="min-w-0 flex-1 break-all font-mono text-xs">
                {t.repr ?? 'out of range'}
              </code>
              {t.repr && <CopyButton value={t.repr} size="icon-sm" />}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
