'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Direction = 'auto' | 'toDecimal' | 'toFraction';

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) {
    [x, y] = [y, x % y];
  }
  return x;
}

// Long-division decimal expansion of num/den, detecting a repeating cycle.
function fractionToDecimalString(numIn: bigint, denIn: bigint, maxDigits = 80): string {
  if (denIn === 0n) throw new Error('Denominator cannot be zero.');
  let num = numIn;
  let den = denIn;
  const negative = num < 0n !== den < 0n;
  if (num < 0n) num = -num;
  if (den < 0n) den = -den;

  const intPart = num / den;
  let rem = num % den;
  const sign = negative && (intPart !== 0n || rem !== 0n) ? '-' : '';
  if (rem === 0n) return `${sign}${intPart.toString()}`;

  const digits: string[] = [];
  const seen = new Map<string, number>();
  let repeatStart = -1;
  while (rem !== 0n) {
    const key = rem.toString();
    const existing = seen.get(key);
    if (existing !== undefined) {
      repeatStart = existing;
      break;
    }
    seen.set(key, digits.length);
    rem *= 10n;
    digits.push((rem / den).toString());
    rem %= den;
    if (digits.length > maxDigits && repeatStart === -1) {
      return `${sign}${intPart.toString()}.${digits.join('')}…`;
    }
  }

  if (repeatStart === -1) {
    return `${sign}${intPart.toString()}.${digits.join('')}`;
  }
  const nonRepeating = digits.slice(0, repeatStart).join('');
  const repeating = digits.slice(repeatStart).join('');
  return `${sign}${intPart.toString()}.${nonRepeating}(${repeating})`;
}

function simplify(num: bigint, den: bigint): { num: bigint; den: bigint } {
  if (den === 0n) throw new Error('Denominator cannot be zero.');
  let n = num;
  let d = den;
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || 1n;
  return { num: n / g, den: d / g };
}

// Parse an exact decimal string (optionally with a (repeating) group) into a fraction.
function decimalToFraction(input: string): { num: bigint; den: bigint } {
  const s = input.trim().replace(/−/g, '-');
  // Repeating form: e.g. 0.1(6) or -3.(142857)
  const rep = /^([+-]?)(\d*)\.(\d*)\((\d+)\)$/.exec(s);
  if (rep) {
    const sign = rep[1] === '-' ? -1n : 1n;
    const intPart = rep[2] ?? '';
    const nonRep = rep[3] ?? '';
    const repeat = rep[4] ?? '';
    const a = BigInt((intPart || '0') + nonRep + repeat);
    const b = BigInt((intPart || '0') + (nonRep || ''));
    const denom = BigInt('9'.repeat(repeat.length) + '0'.repeat(nonRep.length));
    return simplify(sign * (a - b), denom);
  }
  // Plain decimal / integer.
  const m = /^([+-]?)(\d*)(?:\.(\d+))?$/.exec(s);
  if (!m || (m[2] === '' && (m[3] ?? '') === '')) {
    throw new Error(`"${input.trim()}" is not a valid decimal.`);
  }
  const sign = m[1] === '-' ? -1n : 1n;
  const intPart = m[2] ?? '';
  const frac = m[3] ?? '';
  const num = BigInt((intPart || '0') + frac);
  const den = BigInt('1' + '0'.repeat(frac.length));
  return simplify(sign * num, den);
}

function parseFraction(input: string): { num: bigint; den: bigint } {
  const s = input.trim().replace(/−/g, '-');
  const m = /^([+-]?\d+)\s*\/\s*([+-]?\d+)$/.exec(s);
  if (!m) throw new Error(`"${input.trim()}" is not a valid fraction (use a/b).`);
  const num = BigInt(m[1] ?? '0');
  const den = BigInt(m[2] ?? '1');
  if (den === 0n) throw new Error('Denominator cannot be zero.');
  return { num, den };
}

function processLine(line: string, direction: Direction): string {
  const trimmed = line.trim();
  if (!trimmed) return '';
  const isFraction = trimmed.includes('/');

  if (direction === 'toDecimal' || (direction === 'auto' && isFraction)) {
    const { num, den } = parseFraction(trimmed);
    const simplified = simplify(num, den);
    const dec = fractionToDecimalString(num, den);
    return `${trimmed} = ${dec}  (simplified: ${simplified.num.toString()}/${simplified.den.toString()})`;
  }

  // Decimal -> fraction.
  const { num, den } = decimalToFraction(trimmed);
  if (den === 1n) {
    return `${trimmed} = ${num.toString()}/1 (= ${num.toString()})`;
  }
  return `${trimmed} = ${num.toString()}/${den.toString()}`;
}

export default function FractionDecimalTool() {
  const [direction, setDirection] = useState<Direction>('auto');

  const transform = useCallback(
    (input: string) => {
      const lines = input.split(/\r?\n/);
      const out: string[] = [];
      let any = false;
      for (const line of lines) {
        if (!line.trim()) {
          out.push('');
          continue;
        }
        any = true;
        out.push(processLine(line, direction));
      }
      if (!any) return '';
      return out.join('\n');
    },
    [direction],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[direction]}
      inputLabel="Fractions or decimals (one per line)"
      outputLabel="Result"
      inputPlaceholder={'3/4\n22/7\n0.375\n0.(3)'}
      sample={'3/4\n22/7\n0.375\n0.(3)'}
      downloadName="fractions.txt"
      options={
        <Field label="Direction" hint="Auto detects fractions by the / character.">
          <Tabs value={direction} onValueChange={(v) => setDirection(v as Direction)}>
            <TabsList>
              <TabsTrigger value="auto">Auto</TabsTrigger>
              <TabsTrigger value="toDecimal">Fraction to decimal</TabsTrigger>
              <TabsTrigger value="toFraction">Decimal to fraction</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
