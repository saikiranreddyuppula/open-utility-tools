'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'power' | 'root' | 'solve';

function fmt(n: number): string {
  if (!Number.isFinite(n)) return n > 0 ? '∞' : '−∞';
  const r = Number(n.toPrecision(12));
  return r.toString();
}

function sci(n: number): string {
  if (!Number.isFinite(n) || n === 0) return fmt(n);
  return n.toExponential(6).replace('e', '×10^');
}

// Exact integer-exponent power, including negative bases.
function intPow(base: number, exp: number): number {
  let result = 1;
  const e = Math.abs(exp);
  for (let i = 0; i < e; i++) result *= base;
  return exp < 0 ? 1 / result : result;
}

type Result =
  | { error: string }
  | { rows: { label: string; value: string }[]; expansion: string | null };

export default function ExponentPowerCalculator() {
  const [mode, setMode] = useState<Mode>('power');
  const [base, setBase] = useState('2');
  const [exp, setExp] = useState('10');
  const [root, setRoot] = useState('3');
  const [radicand, setRadicand] = useState('27');
  const [solveBase, setSolveBase] = useState('2');
  const [target, setTarget] = useState('256');

  const result = useMemo<Result>(() => {
    if (mode === 'power') {
      const b = Number(base);
      const e = Number(exp);
      if (!Number.isFinite(b) || !Number.isFinite(e)) return { error: 'Enter valid base and exponent.' };
      if (b < 0 && !Number.isInteger(e)) {
        return { error: 'A negative base with a non-integer exponent is not real.' };
      }
      const value = Number.isInteger(e) ? intPow(b, e) : Math.pow(b, e);

      let expansion: string | null = null;
      if (Number.isInteger(e) && e >= 0 && e <= 8) {
        if (e === 0) expansion = `${b}^0 = 1`;
        else expansion = `${b}^${e} = ${Array(e).fill(b).join(' × ')} = ${fmt(value)}`;
      }

      return {
        rows: [
          { label: `${base} ^ ${exp}`, value: fmt(value) },
          { label: 'Scientific notation', value: sci(value) },
          { label: 'Reciprocal (x⁻¹)', value: value === 0 ? '—' : fmt(1 / value) },
        ],
        expansion,
      };
    }

    if (mode === 'root') {
      const n = Number(root);
      const x = Number(radicand);
      if (!Number.isFinite(n) || !Number.isFinite(x)) return { error: 'Enter a valid root index and radicand.' };
      if (n === 0) return { error: 'Root index cannot be zero.' };
      let value: number;
      if (x < 0) {
        // Real odd root of a negative number.
        if (Number.isInteger(n) && Math.abs(n) % 2 === 1) {
          value = -Math.pow(-x, 1 / n);
        } else {
          return { error: 'Even/fractional root of a negative number is not real.' };
        }
      } else {
        value = Math.pow(x, 1 / n);
      }
      return {
        rows: [
          { label: `${n}-th root of ${x}`, value: fmt(value) },
          { label: 'As exponent', value: `${x}^(1/${n})` },
          { label: 'Check (value^n)', value: fmt(Math.pow(value, n)) },
          { label: 'Scientific notation', value: sci(value) },
        ],
        expansion: null,
      };
    }

    // solve: find x such that base^x = target
    const b = Number(solveBase);
    const tgt = Number(target);
    if (!Number.isFinite(b) || !Number.isFinite(tgt)) return { error: 'Enter a valid base and target.' };
    if (b <= 0 || b === 1) return { error: 'Base must be positive and not equal to 1.' };
    if (tgt <= 0) return { error: 'Target must be positive (real logarithm).' };
    const x = Math.log(tgt) / Math.log(b);
    return {
      rows: [
        { label: `x where ${b}^x = ${tgt}`, value: fmt(x) },
        { label: 'Formula', value: `ln(${tgt}) / ln(${b})` },
        { label: 'Check (base^x)', value: fmt(Math.pow(b, x)) },
      ],
      expansion: null,
    };
  }, [mode, base, exp, root, radicand, solveBase, target]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="power">Power</TabsTrigger>
                <TabsTrigger value="root">Nth root</TabsTrigger>
                <TabsTrigger value="solve">Solve exponent</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>

        {mode === 'power' && (
          <OptionsBar>
            <Field label="Base"><Input value={base} onChange={(e) => setBase(e.target.value)} inputMode="decimal" /></Field>
            <Field label="Exponent"><Input value={exp} onChange={(e) => setExp(e.target.value)} inputMode="decimal" /></Field>
          </OptionsBar>
        )}
        {mode === 'root' && (
          <OptionsBar>
            <Field label="Root index n"><Input value={root} onChange={(e) => setRoot(e.target.value)} inputMode="decimal" /></Field>
            <Field label="Radicand"><Input value={radicand} onChange={(e) => setRadicand(e.target.value)} inputMode="decimal" /></Field>
          </OptionsBar>
        )}
        {mode === 'solve' && (
          <OptionsBar>
            <Field label="Base"><Input value={solveBase} onChange={(e) => setSolveBase(e.target.value)} inputMode="decimal" /></Field>
            <Field label="Target"><Input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" /></Field>
          </OptionsBar>
        )}
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton value={() => result.rows.map((r) => `${r.label}: ${r.value}`).join('\n')} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {result.rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">{r.label}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span className="break-all">{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          {result.expansion && <StatBar items={[result.expansion]} />}
        </Panel>
      )}
    </div>
  );
}
