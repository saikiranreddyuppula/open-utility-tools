'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type Op = 'add' | 'sub' | 'mul' | 'div';

interface Frac {
  num: bigint;
  den: bigint;
}

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

function reduce(f: Frac): Frac {
  if (f.den === 0n) return f;
  let { num, den } = f;
  if (den < 0n) {
    num = -num;
    den = -den;
  }
  const g = gcd(num, den);
  if (g > 1n) {
    num /= g;
    den /= g;
  }
  return { num, den };
}

// Parse '3/4', '1 2/3', '-5', '2.5'.
function parseFrac(raw: string): Frac | null {
  const s = raw.trim();
  if (!s) return null;

  // Mixed number: 'a b/c'
  const mixed = s.match(/^([+-]?\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const whole = BigInt(mixed[1] ?? '0');
    const n = BigInt(mixed[2] ?? '0');
    const d = BigInt(mixed[3] ?? '1');
    if (d === 0n) return null;
    const sign = whole < 0n ? -1n : 1n;
    return { num: whole * d + sign * n, den: d };
  }

  // Simple fraction 'a/b'
  const frac = s.match(/^([+-]?\d+)\/(\d+)$/);
  if (frac) {
    const n = BigInt(frac[1] ?? '0');
    const d = BigInt(frac[2] ?? '1');
    if (d === 0n) return null;
    return { num: n, den: d };
  }

  // Plain integer
  if (/^[+-]?\d+$/.test(s)) return { num: BigInt(s), den: 1n };

  // Decimal '2.5'
  const dec = s.match(/^([+-]?)(\d*)\.(\d+)$/);
  if (dec) {
    const sign = dec[1] === '-' ? -1n : 1n;
    const intPart = dec[2] ?? '';
    const fracPart = dec[3] ?? '';
    const den = 10n ** BigInt(fracPart.length);
    const num = BigInt((intPart || '0') + fracPart);
    return { num: sign * num, den };
  }

  return null;
}

function toMixed(f: Frac): string {
  if (f.den === 1n) return f.num.toString();
  const whole = f.num / f.den;
  const rem = bigAbs(f.num % f.den);
  if (whole === 0n) return `${f.num}/${f.den}`;
  if (rem === 0n) return whole.toString();
  return `${whole} ${rem}/${f.den}`;
}

function toDecimal(f: Frac): string {
  // Long division to 20 fractional digits, flagging non-terminating.
  const sign = (f.num < 0n) !== (f.den < 0n) ? '-' : '';
  let n = bigAbs(f.num);
  const d = bigAbs(f.den);
  const intPart = n / d;
  let rem = n % d;
  if (rem === 0n) return `${sign}${intPart.toString()}`;
  let frac = '';
  for (let i = 0; i < 20 && rem !== 0n; i++) {
    rem *= 10n;
    frac += (rem / d).toString();
    rem %= d;
  }
  const ellipsis = rem !== 0n ? '…' : '';
  return `${sign}${intPart.toString()}.${frac}${ellipsis}`;
}

export default function FractionArithmetic() {
  const [aStr, setAStr] = useState('1 2/3');
  const [bStr, setBStr] = useState('3/4');
  const [op, setOp] = useState<Op>('add');

  const result = useMemo(() => {
    const a = parseFrac(aStr);
    const b = parseFrac(bStr);
    if (!a) return { error: 'First operand is not a valid fraction or mixed number.' };
    if (!b) return { error: 'Second operand is not a valid fraction or mixed number.' };

    let out: Frac;
    let step: string | null = null;
    if (op === 'add' || op === 'sub') {
      const commonNumA = a.num * b.den;
      const commonNumB = b.num * a.den;
      const den = a.den * b.den;
      const num = op === 'add' ? commonNumA + commonNumB : commonNumA - commonNumB;
      out = { num, den };
      const sign = op === 'add' ? '+' : '−';
      step = `${commonNumA}/${den} ${sign} ${commonNumB}/${den} = ${num}/${den}`;
    } else if (op === 'mul') {
      out = { num: a.num * b.num, den: a.den * b.den };
    } else {
      if (b.num === 0n) return { error: 'Cannot divide by zero (second operand is 0).' };
      out = { num: a.num * b.den, den: a.den * b.num };
    }

    const reduced = reduce(out);
    const opSym = op === 'add' ? '+' : op === 'sub' ? '−' : op === 'mul' ? '×' : '÷';
    const expr = `${toMixed(a)} ${opSym} ${toMixed(b)}`;

    const rows = [
      { label: 'Expression', value: expr },
      { label: 'Simplified fraction', value: `${reduced.num}/${reduced.den}` },
      { label: 'Mixed number', value: toMixed(reduced) },
      { label: 'Decimal', value: toDecimal(reduced) },
    ];
    return { rows, step, copy: `${reduced.num}/${reduced.den}` };
  }, [aStr, bStr, op]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Fraction A">
            <Input value={aStr} onChange={(e) => setAStr(e.target.value)} placeholder="1 2/3" className="font-mono" />
          </Field>
          <Field label="Operation">
            <Select value={op} onValueChange={(v) => setOp(v as Op)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="add">Add (+)</SelectItem>
                <SelectItem value="sub">Subtract (−)</SelectItem>
                <SelectItem value="mul">Multiply (×)</SelectItem>
                <SelectItem value="div">Divide (÷)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Fraction B">
            <Input value={bStr} onChange={(e) => setBStr(e.target.value)} placeholder="3/4" className="font-mono" />
          </Field>
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
          {result.step && (
            <div className="border-t p-3">
              <p className="mb-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                Common-denominator step
              </p>
              <code className="block break-all font-mono text-sm">{result.step}</code>
            </div>
          )}
          <StatBar items={['Accepts a/b, mixed (1 2/3), integers, decimals']} />
        </Panel>
      )}
    </div>
  );
}
