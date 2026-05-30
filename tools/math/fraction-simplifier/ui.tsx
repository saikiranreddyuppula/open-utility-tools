'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'fraction' | 'decimal';

function bigAbs(x: bigint): bigint {
  return x < 0n ? -x : x;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = bigAbs(a);
  let y = bigAbs(b);
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

// Long division detecting a terminating or repeating decimal with the repetend.
function decimalForm(num: bigint, den: bigint): { text: string; repeating: boolean } {
  const sign = (num < 0n) !== (den < 0n) ? '-' : '';
  let n = bigAbs(num);
  const d = bigAbs(den);
  const intPart = n / d;
  let rem = n % d;
  if (rem === 0n) return { text: `${sign}${intPart}`, repeating: false };

  const seen = new Map<string, number>();
  const digits: string[] = [];
  let repeatStart = -1;
  while (rem !== 0n) {
    const key = rem.toString();
    const prev = seen.get(key);
    if (prev !== undefined) {
      repeatStart = prev;
      break;
    }
    seen.set(key, digits.length);
    rem *= 10n;
    digits.push((rem / d).toString());
    rem %= d;
    if (digits.length > 4000) break; // safety cap
  }

  if (repeatStart === -1) {
    return { text: `${sign}${intPart}.${digits.join('')}`, repeating: false };
  }
  const nonRep = digits.slice(0, repeatStart).join('');
  const rep = digits.slice(repeatStart).join('');
  return { text: `${sign}${intPart}.${nonRep}(${rep})`, repeating: true };
}

function toMixed(num: bigint, den: bigint): string {
  if (den === 1n) return num.toString();
  const whole = num / den;
  const rem = bigAbs(num % den);
  if (whole === 0n) return `${num}/${den}`;
  if (rem === 0n) return whole.toString();
  return `${whole} ${rem}/${den}`;
}

// Parse a decimal string into an exact fraction (num/den) by powers of ten.
function decimalToFraction(raw: string): { num: bigint; den: bigint } | null {
  const s = raw.trim();
  const m = s.match(/^([+-]?)(\d*)\.(\d+)$/);
  if (m) {
    const sign = m[1] === '-' ? -1n : 1n;
    const intPart = m[2] ?? '';
    const fracPart = m[3] ?? '';
    const den = 10n ** BigInt(fracPart.length);
    const num = BigInt((intPart || '0') + fracPart);
    return { num: sign * num, den };
  }
  if (/^[+-]?\d+$/.test(s)) return { num: BigInt(s), den: 1n };
  return null;
}

export default function FractionSimplifier() {
  const [mode, setMode] = useState<Mode>('fraction');
  const [numStr, setNumStr] = useState('48');
  const [denStr, setDenStr] = useState('36');
  const [decStr, setDecStr] = useState('0.75');

  const result = useMemo(() => {
    let num: bigint;
    let den: bigint;

    if (mode === 'fraction') {
      if (!/^[+-]?\d+$/.test(numStr.trim())) return { error: 'Numerator must be an integer.' };
      if (!/^[+-]?\d+$/.test(denStr.trim())) return { error: 'Denominator must be an integer.' };
      num = BigInt(numStr.trim());
      den = BigInt(denStr.trim());
      if (den === 0n) return { error: 'Denominator cannot be zero.' };
    } else {
      const parsed = decimalToFraction(decStr);
      if (!parsed) return { error: 'Enter a valid decimal number (e.g. 0.75).' };
      num = parsed.num;
      den = parsed.den;
    }

    // Move sign to numerator.
    if (den < 0n) {
      num = -num;
      den = -den;
    }
    const g = gcd(num, den);
    const rNum = g === 0n ? num : num / g;
    const rDen = g === 0n ? den : den / g;

    const dec = decimalForm(rNum, rDen);

    const steps =
      mode === 'decimal'
        ? `${decStr.trim()} = ${num}/${den}, gcd = ${g === 0n ? 1n : g}, → ${rNum}/${rDen}`
        : `gcd(${bigAbs(num)}, ${den}) = ${g === 0n ? 1n : g}; divide both → ${rNum}/${rDen}`;

    const rows = [
      { label: 'Original', value: `${num}/${den}` },
      { label: 'GCD', value: (g === 0n ? 1n : g).toString() },
      { label: 'Reduced fraction', value: `${rNum}/${rDen}` },
      { label: 'Mixed number', value: toMixed(rNum, rDen) },
      { label: `Decimal (${dec.repeating ? 'repeating' : 'terminating'})`, value: dec.text },
    ];
    return { rows, steps, copy: `${rNum}/${rDen}` };
  }, [mode, numStr, denStr, decStr]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Input type">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="fraction">Fraction</TabsTrigger>
                <TabsTrigger value="decimal">Decimal</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === 'fraction' ? (
            <>
              <Field label="Numerator">
                <Input value={numStr} onChange={(e) => setNumStr(e.target.value)} inputMode="numeric" className="w-28" />
              </Field>
              <Field label="Denominator">
                <Input value={denStr} onChange={(e) => setDenStr(e.target.value)} inputMode="numeric" className="w-28" />
              </Field>
            </>
          ) : (
            <Field label="Decimal">
              <Input value={decStr} onChange={(e) => setDecStr(e.target.value)} inputMode="decimal" className="w-40" />
            </Field>
          )}
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton value={() => result.copy} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3">
            {result.rows.map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="shrink-0 text-sm text-muted-foreground">{r.label}</span>
                <span className="flex min-w-0 items-center gap-2 font-mono text-sm">
                  <span className="break-all text-right">{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <div className="border-t p-3">
            <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground">Steps</p>
            <code className="block break-all font-mono text-sm">{result.steps}</code>
          </div>
          <StatBar items={['Repeating decimals shown as 0.(3) form']} />
        </Panel>
      )}
    </div>
  );
}
