'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Op = 'add' | 'subtract' | 'multiply' | 'divide' | 'power';

interface Complex {
  re: number;
  im: number;
}

const OP_LABEL: Record<Op, string> = {
  add: 'Add (a + b)',
  subtract: 'Subtract (a − b)',
  multiply: 'Multiply (a × b)',
  divide: 'Divide (a ÷ b)',
  power: 'Power (aⁿ)',
};

// Parse "a+bi", "a-bi", "bi", "a", "r∠θ" (theta in degrees), with flexible spacing.
function parseComplex(raw: string): Complex | null {
  const s = raw.trim().replace(/\s+/g, '').replace(/j/gi, 'i');
  if (!s) return null;

  // Polar: r∠θ  or  r<θ  or  r@θ  (theta degrees)
  const polarMatch = s.match(/^(-?\d*\.?\d+(?:e-?\d+)?)(?:∠|<|@)(-?\d*\.?\d+(?:e-?\d+)?)$/i);
  if (polarMatch) {
    const r = Number(polarMatch[1]);
    const degStr = polarMatch[2];
    if (degStr === undefined) return null;
    const deg = Number(degStr);
    if (!Number.isFinite(r) || !Number.isFinite(deg)) return null;
    const rad = (deg * Math.PI) / 180;
    return { re: r * Math.cos(rad), im: r * Math.sin(rad) };
  }

  // Pure imaginary like "i", "-i", "2i", "+3.5i"
  // Rectangular general: optional real, optional imaginary.
  // Replace standalone "i" with "1i" / "-i" -> "-1i" to ease matching.
  let work = s;
  work = work.replace(/(^|[+\-])i/g, (_m, sign: string) => `${sign}1i`);

  // Try full a+bi
  const rect = work.match(/^([+-]?\d*\.?\d+(?:e[+-]?\d+)?)?([+-]\d*\.?\d+(?:e[+-]?\d+)?)i$/i);
  if (rect) {
    const reStr = rect[1];
    const imStr = rect[2];
    const re = reStr === undefined || reStr === '' ? 0 : Number(reStr);
    const im = imStr === undefined ? 0 : Number(imStr);
    if (!Number.isFinite(re) || !Number.isFinite(im)) return null;
    return { re, im };
  }

  // Pure imaginary leading term: "bi" with no real part (e.g. "2i")
  const imOnly = work.match(/^([+-]?\d*\.?\d+(?:e[+-]?\d+)?)i$/i);
  if (imOnly) {
    const imStr = imOnly[1];
    const im = imStr === undefined ? 0 : Number(imStr);
    if (!Number.isFinite(im)) return null;
    return { re: 0, im };
  }

  // Pure real
  const reOnly = work.match(/^([+-]?\d*\.?\d+(?:e[+-]?\d+)?)$/i);
  if (reOnly) {
    const reStr = reOnly[1];
    const re = reStr === undefined ? 0 : Number(reStr);
    if (!Number.isFinite(re)) return null;
    return { re, im: 0 };
  }

  return null;
}

function modulus(c: Complex): number {
  return Math.hypot(c.re, c.im);
}

function argument(c: Complex): number {
  return Math.atan2(c.im, c.re);
}

const round = (n: number) => {
  const r = Math.round(n * 1e10) / 1e10;
  return Object.is(r, -0) ? 0 : r;
};

function fmtRect(c: Complex): string {
  const re = round(c.re);
  const im = round(c.im);
  if (im === 0) return `${re}`;
  if (re === 0) return `${im}i`;
  const sign = im < 0 ? '−' : '+';
  return `${re} ${sign} ${Math.abs(im)}i`;
}

function fmtPolarDeg(c: Complex): string {
  const r = round(modulus(c));
  const deg = round((argument(c) * 180) / Math.PI);
  return `${r} ∠ ${deg}°`;
}

function fmtPolarRad(c: Complex): string {
  const r = round(modulus(c));
  const rad = round(argument(c));
  return `${r} ∠ ${rad} rad`;
}

function divide(a: Complex, b: Complex): Complex | null {
  const denom = b.re * b.re + b.im * b.im;
  if (denom === 0) return null;
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom,
  };
}

// Integer power via De Moivre (works for negative integers too).
function power(a: Complex, n: number): Complex | null {
  if (!Number.isInteger(n)) return null;
  if (n === 0) return { re: 1, im: 0 };
  const r = modulus(a);
  if (r === 0 && n < 0) return null;
  const theta = argument(a);
  const rp = Math.pow(r, n);
  return { re: rp * Math.cos(n * theta), im: rp * Math.sin(n * theta) };
}

export default function ComplexNumberCalculatorTool() {
  const [aRaw, setARaw] = useState('3+4i');
  const [bRaw, setBRaw] = useState('1-2i');
  const [op, setOp] = useState<Op>('multiply');
  const [exp, setExp] = useState('2');

  const result = useMemo(() => {
    const a = parseComplex(aRaw);
    if (!a) return { error: 'Could not parse the first number. Use a+bi or r∠θ (degrees).' as string };

    let res: Complex | null;
    let bForConj: Complex | null = null;

    if (op === 'power') {
      const n = Number(exp.trim());
      if (!Number.isFinite(n) || !Number.isInteger(n)) {
        return { error: 'Exponent must be an integer.' };
      }
      res = power(a, n);
      if (!res) return { error: 'Cannot raise zero to a negative power.' };
    } else {
      const b = parseComplex(bRaw);
      if (!b) return { error: 'Could not parse the second number. Use a+bi or r∠θ (degrees).' };
      bForConj = b;
      if (op === 'add') res = { re: a.re + b.re, im: a.im + b.im };
      else if (op === 'subtract') res = { re: a.re - b.re, im: a.im - b.im };
      else if (op === 'multiply') res = { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
      else {
        res = divide(a, b);
        if (!res) return { error: 'Division by zero (second number is 0).' };
      }
    }

    return { a, b: bForConj, res };
  }, [aRaw, bRaw, op, exp]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="First number (a)" className="min-w-[160px] flex-1">
            <Input value={aRaw} onChange={(e) => setARaw(e.target.value)} placeholder="3+4i" />
          </Field>
          <Field label="Operation" className="min-w-[160px]">
            <Select value={op} onValueChange={(v) => setOp(v as Op)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(OP_LABEL) as Op[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {OP_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {op === 'power' ? (
            <Field label="Exponent (integer)" className="min-w-[140px]">
              <Input value={exp} onChange={(e) => setExp(e.target.value)} inputMode="numeric" placeholder="2" />
            </Field>
          ) : (
            <Field label="Second number (b)" className="min-w-[160px] flex-1">
              <Input value={bRaw} onChange={(e) => setBRaw(e.target.value)} placeholder="1-2i" />
            </Field>
          )}
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton
              value={() =>
                [
                  `Rectangular: ${fmtRect(result.res)}`,
                  `Polar (deg): ${fmtPolarDeg(result.res)}`,
                  `Polar (rad): ${fmtPolarRad(result.res)}`,
                  `Modulus: ${round(modulus(result.res))}`,
                  `Argument: ${round((argument(result.res) * 180) / Math.PI)}°`,
                ].join('\n')
              }
            />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {[
              { label: 'Result (rectangular)', value: fmtRect(result.res) },
              { label: 'Result (polar, degrees)', value: fmtPolarDeg(result.res) },
              { label: 'Result (polar, radians)', value: fmtPolarRad(result.res) },
              { label: 'Modulus |z|', value: round(modulus(result.res)).toString() },
              { label: 'Argument (degrees)', value: `${round((argument(result.res) * 180) / Math.PI)}°` },
              { label: 'Argument (radians)', value: round(argument(result.res)).toString() },
              { label: 'Conjugate of a', value: fmtRect({ re: result.a.re, im: -result.a.im }) },
              ...(result.b
                ? [{ label: 'Conjugate of b', value: fmtRect({ re: result.b.re, im: -result.b.im }) }]
                : []),
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span className="break-all text-right">{row.value}</span>
                  <CopyButton value={row.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar items={[`a = ${fmtRect(result.a)}`, result.b ? `b = ${fmtRect(result.b)}` : `n = ${exp}`]} />
        </Panel>
      )}
    </div>
  );
}
