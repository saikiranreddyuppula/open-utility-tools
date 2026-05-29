'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Target = 'decimal' | 'scientific' | 'engineering';

// Parse a single token that may be plain decimal or E-notation (e.g. 1.5e-3, 1.5 x 10^3, 1.5*10^3).
function parseNumber(token: string): number {
  let s = token.trim();
  if (!s) throw new Error('Enter a number to convert.');
  // Normalize common "× 10^n" forms into E-notation.
  s = s.replace(/\s+/g, '');
  s = s.replace(/[×x*]10\^?/i, 'e');
  s = s.replace(/·10\^?/i, 'e');
  // Allow a leading + and unicode minus.
  s = s.replace(/−/g, '-');
  const n = Number(s);
  if (!Number.isFinite(n)) {
    throw new Error(`"${token.trim()}" is not a valid number.`);
  }
  return n;
}

function toPlainDecimal(n: number): string {
  if (n === 0) return '0';
  // toExponential gives a clean mantissa/exponent we can expand without float artifacts for typical inputs.
  const str = n.toString();
  if (!/e/i.test(str)) return str;
  // Expand exponential string manually.
  const exp = n.toExponential();
  const m = /^(-?)(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(exp);
  if (!m) return str;
  const sign = m[1] ?? '';
  const intPart = m[2] ?? '0';
  const frac = m[3] ?? '';
  const e = Number(m[4] ?? '0');
  const digits = intPart + frac;
  const pointPos = 1 + e; // position of decimal point within `digits` from the left
  if (pointPos <= 0) {
    return `${sign}0.${'0'.repeat(-pointPos)}${digits}`;
  }
  if (pointPos >= digits.length) {
    return `${sign}${digits}${'0'.repeat(pointPos - digits.length)}`;
  }
  return `${sign}${digits.slice(0, pointPos)}.${digits.slice(pointPos)}`;
}

function toScientific(n: number, sig: number): string {
  if (n === 0) return '0e+0';
  const fixed = sig > 0 ? n.toExponential(sig - 1) : n.toExponential();
  // Trim trailing zeros in mantissa when no explicit precision desired.
  return fixed.replace(/e([+-])(\d+)/, (_full, s: string, d: string) => `e${s}${d}`);
}

function toEngineering(n: number, sig: number): string {
  if (n === 0) return '0e+0';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  let exp = Math.floor(Math.log10(abs));
  // Snap exponent down to nearest multiple of 3.
  let engExp = exp - ((exp % 3) + 3) % 3;
  let mantissa = abs / Math.pow(10, engExp);
  // Guard against floating rounding pushing mantissa to 1000.
  if (mantissa >= 1000) {
    mantissa /= 1000;
    engExp += 3;
  }
  const mStr = sig > 0 ? mantissa.toPrecision(Math.max(sig, 1)) : String(mantissa);
  const cleaned = mStr.includes('.') ? mStr.replace(/0+$/, '').replace(/\.$/, '') : mStr;
  const sgn = engExp >= 0 ? '+' : '-';
  void exp;
  return `${sign}${cleaned}e${sgn}${Math.abs(engExp)}`;
}

export default function ScientificNotationTool() {
  const [target, setTarget] = useState<Target>('scientific');
  const [sig, setSig] = useState<'auto' | '3' | '4' | '6'>('auto');

  const transform = useCallback(
    (input: string) => {
      const lines = input.split(/\r?\n/);
      const sigDigits = sig === 'auto' ? 0 : Number(sig);
      const out: string[] = [];
      let any = false;
      for (const line of lines) {
        if (!line.trim()) {
          out.push('');
          continue;
        }
        any = true;
        const n = parseNumber(line);
        if (target === 'decimal') out.push(toPlainDecimal(n));
        else if (target === 'scientific') out.push(toScientific(n, sigDigits));
        else out.push(toEngineering(n, sigDigits));
      }
      if (!any) return '';
      return out.join('\n');
    },
    [target, sig],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[target, sig]}
      inputLabel="Numbers (one per line)"
      outputLabel="Converted"
      inputPlaceholder={'1500000\n0.0000423\n6.022e23'}
      sample={'1500000\n0.0000423\n6.022e23'}
      downloadName="converted.txt"
      options={
        <>
          <Field label="Convert to">
            <Tabs value={target} onValueChange={(v) => setTarget(v as Target)}>
              <TabsList>
                <TabsTrigger value="decimal">Decimal</TabsTrigger>
                <TabsTrigger value="scientific">Scientific</TabsTrigger>
                <TabsTrigger value="engineering">Engineering</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Significant figures">
            <Tabs value={sig} onValueChange={(v) => setSig(v as 'auto' | '3' | '4' | '6')}>
              <TabsList>
                <TabsTrigger value="auto">Auto</TabsTrigger>
                <TabsTrigger value="3">3</TabsTrigger>
                <TabsTrigger value="4">4</TabsTrigger>
                <TabsTrigger value="6">6</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </>
      }
    />
  );
}
