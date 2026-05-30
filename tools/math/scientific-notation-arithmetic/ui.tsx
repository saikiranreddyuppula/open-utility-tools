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

type Op = 'add' | 'subtract' | 'multiply' | 'divide';

const OP_LABELS: Record<Op, string> = {
  add: 'Add (+)',
  subtract: 'Subtract (−)',
  multiply: 'Multiply (×)',
  divide: 'Divide (÷)',
};

interface Sci {
  mantissa: number;
  exponent: number;
}

// Normalise so 1 ≤ |mantissa| < 10 (or mantissa = 0).
function normalize(m: number, e: number): Sci {
  if (m === 0 || !Number.isFinite(m)) return { mantissa: 0, exponent: 0 };
  let mant = m;
  let exp = e;
  while (Math.abs(mant) >= 10) {
    mant /= 10;
    exp += 1;
  }
  while (Math.abs(mant) < 1) {
    mant *= 10;
    exp -= 1;
  }
  return { mantissa: mant, exponent: exp };
}

function toSciString(s: Sci): string {
  if (s.mantissa === 0) return '0';
  const m = Number(s.mantissa.toPrecision(10));
  return `${m} × 10^${s.exponent}`;
}

// Engineering notation: exponent forced to a multiple of 3.
function toEngString(s: Sci): string {
  if (s.mantissa === 0) return '0';
  const totalExp = s.exponent;
  const engExp = Math.floor(totalExp / 3) * 3;
  const shift = totalExp - engExp;
  const mant = s.mantissa * Math.pow(10, shift);
  const m = Number(mant.toPrecision(10));
  return `${m} × 10^${engExp}`;
}

function toDecimalString(s: Sci): string {
  if (s.mantissa === 0) return '0';
  const value = s.mantissa * Math.pow(10, s.exponent);
  if (!Number.isFinite(value)) return 'overflow';
  return Number(value.toPrecision(12)).toLocaleString(undefined, { maximumFractionDigits: 20 });
}

export default function ScientificNotationArithmeticTool() {
  const [m1, setM1] = useState('3');
  const [e1, setE1] = useState('8');
  const [m2, setM2] = useState('2');
  const [e2, setE2] = useState('5');
  const [op, setOp] = useState<Op>('multiply');

  const result = useMemo(() => {
    const a = Number(m1);
    const ea = Number(e1);
    const b = Number(m2);
    const eb = Number(e2);

    if (![a, ea, b, eb].every((v) => Number.isFinite(v))) {
      return { error: 'Enter valid numbers for both mantissas and exponents.' };
    }
    if (!Number.isInteger(ea) || !Number.isInteger(eb)) {
      return { error: 'Exponents must be whole numbers.' };
    }

    let res: Sci;
    switch (op) {
      case 'multiply':
        res = normalize(a * b, ea + eb);
        break;
      case 'divide': {
        if (b === 0) return { error: 'Cannot divide by zero.' };
        res = normalize(a / b, ea - eb);
        break;
      }
      case 'add':
      case 'subtract': {
        // Align to the larger exponent, combine mantissas, then normalize.
        const hi = Math.max(ea, eb);
        const aAligned = a * Math.pow(10, ea - hi);
        const bAligned = b * Math.pow(10, eb - hi);
        const combined = op === 'add' ? aAligned + bAligned : aAligned - bAligned;
        res = normalize(combined, hi);
        break;
      }
      default:
        return { error: 'Unknown operation.' };
    }

    const rows: { label: string; value: string }[] = [
      { label: 'Scientific', value: toSciString(res) },
      { label: 'Engineering', value: toEngString(res) },
      { label: 'Decimal', value: toDecimalString(res) },
    ];

    const a1 = `${a} × 10^${ea}`;
    const a2 = `${b} × 10^${eb}`;
    const symbol = op === 'add' ? '+' : op === 'subtract' ? '−' : op === 'multiply' ? '×' : '÷';

    return { rows, expr: `(${a1}) ${symbol} (${a2})` };
  }, [m1, e1, m2, e2, op]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="A — mantissa">
            <Input
              value={m1}
              onChange={(e) => setM1(e.target.value)}
              inputMode="decimal"
              className="w-24 font-mono"
            />
          </Field>
          <Field label="× 10^ (exp)">
            <Input
              value={e1}
              onChange={(e) => setE1(e.target.value)}
              inputMode="numeric"
              className="w-20 font-mono"
            />
          </Field>
          <Field label="Operation">
            <Select value={op} onValueChange={(v) => setOp(v as Op)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(OP_LABELS) as Op[]).map((o) => (
                  <SelectItem key={o} value={o}>
                    {OP_LABELS[o]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="B — mantissa">
            <Input
              value={m2}
              onChange={(e) => setM2(e.target.value)}
              inputMode="decimal"
              className="w-24 font-mono"
            />
          </Field>
          <Field label="× 10^ (exp)">
            <Input
              value={e2}
              onChange={(e) => setE2(e.target.value)}
              inputMode="numeric"
              className="w-20 font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton
              value={() => result.rows.map((r) => `${r.label}: ${r.value}`).join('\n')}
            />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
            {result.rows.map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="text-sm text-muted-foreground">{r.label}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span>{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar items={[result.expr]} />
        </Panel>
      )}
    </div>
  );
}
