'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'decimal' | 'fraction' | 'percent';

interface Frac {
  num: bigint;
  den: bigint;
}

function bgcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) {
    [x, y] = [y, x % y];
  }
  return x;
}

function reduce(f: Frac): Frac {
  if (f.den === 0n) return f;
  let { num, den } = f;
  if (den < 0n) {
    num = -num;
    den = -den;
  }
  const g = bgcd(num, den);
  if (g === 0n) return { num, den };
  return { num: num / g, den: den / g };
}

// Parse a decimal string into an exact fraction, detecting a repeating block in parentheses
// e.g. "0.1(6)" -> 1/6, or via the explicit "..." trailing.
function decimalToFraction(raw: string): { frac: Frac; repeating: boolean; repBlock: string } | null {
  let s = raw.trim();
  let sign = 1n;
  if (s.startsWith('-')) {
    sign = -1n;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }

  // Repeating notation: integer.nonRep(rep)
  const repMatch = s.match(/^(\d*)\.(\d*)\((\d+)\)$/);
  if (repMatch) {
    const intPart = repMatch[1] ?? '0';
    const nonRep = repMatch[2] ?? '';
    const rep = repMatch[3] ?? '';
    if (!rep) return null;
    const a = intPart + nonRep + rep; // whole shifted
    const b = intPart + nonRep;
    const numerator = BigInt(a || '0') - BigInt(b || '0');
    const denominator = BigInt('9'.repeat(rep.length) + '0'.repeat(nonRep.length));
    if (denominator === 0n) return null;
    return { frac: reduce({ num: sign * numerator, den: denominator }), repeating: true, repBlock: rep };
  }

  // Finite decimal
  const finMatch = s.match(/^(\d*)(?:\.(\d*))?$/);
  if (!finMatch) return null;
  const intPart = finMatch[1] ?? '';
  const decPart = finMatch[2] ?? '';
  if (intPart === '' && decPart === '') return null;
  const digits = (intPart || '0') + decPart;
  const num = BigInt(digits || '0');
  const den = 10n ** BigInt(decPart.length);
  return { frac: reduce({ num: sign * num, den }), repeating: false, repBlock: '' };
}

// Convert a fraction to a decimal string, marking a repeating block with parentheses.
function fractionToDecimalString(f: Frac, maxDigits = 30): { text: string; repeating: boolean; repBlock: string } {
  const reduced = reduce(f);
  let num = reduced.num;
  const den = reduced.den;
  if (den === 0n) return { text: 'NaN', repeating: false, repBlock: '' };
  const neg = num < 0n;
  if (neg) num = -num;
  const intPart = num / den;
  let rem = num % den;
  if (rem === 0n) {
    return { text: `${neg ? '-' : ''}${intPart.toString()}`, repeating: false, repBlock: '' };
  }
  const digits: string[] = [];
  const seen = new Map<string, number>();
  let repStart = -1;
  while (rem !== 0n && digits.length < maxDigits) {
    const key = rem.toString();
    if (seen.has(key)) {
      repStart = seen.get(key) ?? -1;
      break;
    }
    seen.set(key, digits.length);
    rem *= 10n;
    const d = rem / den;
    digits.push(d.toString());
    rem = rem % den;
  }
  let frac: string;
  let repeating = false;
  let repBlock = '';
  if (repStart >= 0) {
    repeating = true;
    const nonRep = digits.slice(0, repStart).join('');
    repBlock = digits.slice(repStart).join('');
    frac = `${nonRep}(${repBlock})`;
  } else {
    frac = digits.join('');
  }
  return { text: `${neg ? '-' : ''}${intPart.toString()}.${frac}`, repeating, repBlock };
}

function parsePQ(raw: string): Frac | null {
  const m = raw.trim().match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
  if (!m) return null;
  const pStr = m[1];
  const qStr = m[2];
  if (pStr === undefined || qStr === undefined) return null;
  try {
    const num = BigInt(pStr);
    const den = BigInt(qStr);
    if (den === 0n) return null;
    return reduce({ num, den });
  } catch {
    return null;
  }
}

export default function DecimalFractionPercentTool() {
  const [mode, setMode] = useState<Mode>('decimal');
  const [value, setValue] = useState('0.75');

  const result = useMemo(() => {
    const v = value.trim();
    if (!v) return { error: 'Enter a value.' as string };

    let frac: Frac;
    let repeating = false;
    let repBlock = '';

    if (mode === 'fraction') {
      const f = parsePQ(v);
      if (!f) return { error: 'Enter a fraction as p/q (e.g. 3/4).' };
      frac = f;
      const dec = fractionToDecimalString(f);
      repeating = dec.repeating;
      repBlock = dec.repBlock;
    } else if (mode === 'decimal') {
      const parsed = decimalToFraction(v);
      if (!parsed) return { error: 'Enter a decimal. Use parentheses for repeats, e.g. 0.1(6).' };
      frac = parsed.frac;
      repeating = parsed.repeating;
      repBlock = parsed.repBlock;
    } else {
      // percent: strip trailing %
      const cleaned = v.replace(/%$/, '').trim();
      const parsed = decimalToFraction(cleaned);
      if (!parsed) return { error: 'Enter a percent value, e.g. 75 or 33.(3).' };
      // divide by 100
      frac = reduce({ num: parsed.frac.num, den: parsed.frac.den * 100n });
      const dec = fractionToDecimalString(frac);
      repeating = dec.repeating;
      repBlock = dec.repBlock;
    }

    const decStr = fractionToDecimalString(frac);
    const percentFrac = reduce({ num: frac.num * 100n, den: frac.den });
    const percentStr = fractionToDecimalString(percentFrac);

    return {
      frac,
      decimalText: decStr.text,
      percentText: percentStr.text,
      repeating: decStr.repeating || repeating,
      repBlock: decStr.repBlock || repBlock,
    };
  }, [mode, value]);

  const placeholder =
    mode === 'fraction' ? '3/4' : mode === 'percent' ? '75' : '0.75 (or 0.1(6) for repeats)';

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Input type">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="decimal">Decimal</TabsTrigger>
                <TabsTrigger value="fraction">Fraction</TabsTrigger>
                <TabsTrigger value="percent">Percent</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Value" className="min-w-[200px] flex-1">
            <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="All three forms">
            <CopyButton
              value={() =>
                [
                  `Decimal: ${result.decimalText}`,
                  `Fraction: ${result.frac.num.toString()}/${result.frac.den.toString()}`,
                  `Percent: ${result.percentText}%`,
                ].join('\n')
              }
            />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
            {[
              { label: 'Decimal', value: result.decimalText },
              { label: 'Fraction (reduced)', value: `${result.frac.num.toString()}/${result.frac.den.toString()}` },
              { label: 'Percent', value: `${result.percentText}%` },
            ].map((row) => (
              <div key={row.label} className="rounded-md border bg-muted/30 p-3 text-center">
                <div className="break-all font-mono text-lg font-semibold">{row.value}</div>
                <div className="mt-1 flex items-center justify-center gap-2 text-2xs text-muted-foreground">
                  <span>{row.label}</span>
                  <CopyButton value={row.value} size="icon-sm" />
                </div>
              </div>
            ))}
          </div>
          <StatBar
            items={[
              result.repeating
                ? `Repeating decimal (block: ${result.repBlock})`
                : 'Terminating decimal',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
