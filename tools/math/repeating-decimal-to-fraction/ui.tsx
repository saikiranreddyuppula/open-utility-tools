'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

interface Parsed {
  sign: number;
  intPart: string;
  nonRep: string;
  rep: string;
}

function bigAbs(n: bigint): bigint {
  return n < 0n ? -n : n;
}

function bigGcd(a: bigint, b: bigint): bigint {
  let x = bigAbs(a);
  let y = bigAbs(b);
  while (y) {
    [x, y] = [y, x % y];
  }
  return x;
}

// Accepts: 0.1(6) | 0.16~6 | 0.1\overline{6} | plain 0.5 (no repeat)
function parseInput(raw: string): Parsed | { error: string } {
  let s = raw.trim();
  if (!s) return { error: 'Enter a repeating decimal, e.g. 0.1(6).' };

  let sign = 1;
  if (s.startsWith('-')) {
    sign = -1;
    s = s.slice(1).trim();
  } else if (s.startsWith('+')) {
    s = s.slice(1).trim();
  }

  // Normalise the various repeat notations into parentheses: digits(rep)
  // \overline{rep}
  s = s.replace(/\\overline\{([0-9]+)\}/g, '($1)');
  // a~b  ->  a(b)   (tilde marks the start of the repeating block)
  if (s.includes('~')) {
    const parts = s.split('~');
    if (parts.length !== 2) return { error: 'Use a single ~ before the repeating digits.' };
    const head = parts[0] ?? '';
    const tail = parts[1] ?? '';
    if (!/^[0-9]+$/.test(tail)) return { error: 'The repeating part after ~ must be digits.' };
    s = `${head}(${tail})`;
  }

  const m = /^([0-9]*)(?:\.([0-9]*))?(?:\(([0-9]+)\))?$/.exec(s);
  if (!m) return { error: 'Could not parse. Try formats like 0.1(6), 0.16~6, or 0.1\\overline{6}.' };

  const intPart = m[1] ?? '';
  const decPart = m[2] ?? '';
  const rep = m[3] ?? '';

  if (intPart === '' && decPart === '' && rep === '') {
    return { error: 'No digits found.' };
  }

  return {
    sign,
    intPart: intPart === '' ? '0' : intPart,
    nonRep: decPart,
    rep,
  };
}

export default function RepeatingDecimalToFractionTool() {
  const [input, setInput] = useState('0.1(6)');

  const result = useMemo(() => {
    const parsed = parseInput(input);
    if ('error' in parsed) return parsed;

    const { sign, intPart, nonRep, rep } = parsed;
    const j = nonRep.length; // non-repeating fraction length
    const k = rep.length; // repeating block length

    // Numerator/denominator via the standard 9s/0s method.
    // entire = intPart + nonRep + rep  (all digits)
    // base   = intPart + nonRep        (digits before the repeat)
    let numerator: bigint;
    let denominator: bigint;

    try {
      if (k === 0) {
        // Terminating decimal: value = (intPart.nonRep) = (intPart*10^j + nonRep) / 10^j
        const digits = intPart + nonRep;
        numerator = BigInt(digits === '' ? '0' : digits);
        denominator = 10n ** BigInt(j);
      } else {
        const entire = BigInt((intPart + nonRep + rep) || '0');
        const base = BigInt((intPart + nonRep) || '0');
        numerator = entire - base;
        // denominator = (k nines)(j zeros)
        const nines = k > 0 ? BigInt('9'.repeat(k)) : 0n;
        denominator = nines * 10n ** BigInt(j);
      }
    } catch {
      return { error: 'Number is too large to convert exactly.' };
    }

    if (denominator === 0n) return { error: 'Invalid input — zero denominator.' };

    const g = bigGcd(numerator, denominator) || 1n;
    let rn = numerator / g;
    let rd = denominator / g;
    if (sign < 0) rn = -rn;
    if (rd < 0n) {
      rd = -rd;
      rn = -rn;
    }

    const fraction = rd === 1n ? rn.toString() : `${rn.toString()}/${rd.toString()}`;

    // Algebraic derivation (only meaningful when there is a repeat).
    let derivation: string[];
    const original = (sign < 0 ? '-' : '') + (j > 0 || k > 0 ? `${intPart}.${nonRep}${k > 0 ? `(${rep})` : ''}` : intPart);
    if (k === 0) {
      derivation = [
        `x = ${original}`,
        `Multiply by 10^${j}: ${10n ** BigInt(j)}·x = ${intPart}${nonRep}`,
        `x = ${numerator}/${denominator} = ${fraction}`,
      ];
    } else {
      const mExp = j + k;
      const nExp = j;
      const hi = 10n ** BigInt(mExp);
      const lo = 10n ** BigInt(nExp);
      derivation = [
        `Let x = ${original}`,
        `10^${mExp}·x = ${intPart}${nonRep}${rep}.${rep}${rep}…`,
        `10^${nExp}·x = ${intPart}${nonRep}.${rep}${rep}…`,
        `Subtract: (${hi} − ${lo})·x = ${numerator}`,
        `${denominator}·x = ${numerator}`,
        `x = ${numerator}/${denominator} = ${fraction}`,
      ];
    }

    // Verification: long-division of rn/rd back to a decimal string.
    const verify = longDivision(rn, rd, Math.max(k * 2 + j + 2, 12));

    const decimalValue = Number(rn) / Number(rd);

    return {
      fraction,
      numerator: rn.toString(),
      denominator: rd.toString(),
      derivation,
      verify,
      decimalValue,
    };
  }, [input]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Repeating decimal">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-64 font-mono"
              placeholder="0.1(6)"
              spellCheck={false}
            />
          </Field>
        </OptionsBar>
        <StatBar items={['Notations: 0.1(6) · 0.16~6 · 0.1\\overline{6} · plain 0.75']} />
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="Exact fraction">
              <CopyButton value={() => result.fraction} />
            </PanelHeader>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
              <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 sm:col-span-1">
                <span className="text-sm text-muted-foreground">Fraction</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span>{result.fraction}</span>
                  <CopyButton value={result.fraction} size="icon-sm" />
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">Numerator</span>
                <span className="font-mono text-sm">{result.numerator}</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">Denominator</span>
                <span className="font-mono text-sm">{result.denominator}</span>
              </div>
            </div>
            <StatBar
              items={[
                `≈ ${result.decimalValue.toLocaleString(undefined, { maximumFractionDigits: 10 })}`,
                `Verify ÷: ${result.verify}`,
              ]}
            />
          </Panel>

          <Panel>
            <PanelHeader title="Algebraic derivation">
              <CopyButton value={() => result.derivation.join('\n')} />
            </PanelHeader>
            <div className="space-y-1 p-3 font-mono text-sm">
              {result.derivation.map((line, i) => (
                <div key={i} className="text-muted-foreground">
                  {line}
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

// Reproduce the decimal expansion of n/d to `places` fractional digits.
function longDivision(n: bigint, d: bigint, places: number): string {
  if (d === 0n) return '—';
  const neg = n < 0n;
  const num = bigAbs(n);
  const den = bigAbs(d);
  const intDigits = (num / den).toString();
  let rem = num % den;
  if (rem === 0n) return (neg ? '-' : '') + intDigits;
  let frac = '';
  for (let i = 0; i < places && rem !== 0n; i++) {
    rem *= 10n;
    frac += (rem / den).toString();
    rem %= den;
  }
  // mark truncation with an ellipsis if a remainder is still left
  const suffix = rem !== 0n ? '…' : '';
  return `${neg ? '-' : ''}${intDigits}.${frac}${suffix}`;
}
