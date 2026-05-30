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

type Solve = 'I' | 'P' | 'r' | 't';

const SOLVE_LABELS: Record<Solve, string> = {
  I: 'Interest (I)',
  P: 'Principal (P)',
  r: 'Annual rate (r %)',
  t: 'Time (t, years)',
};

function num(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function money(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SimpleInterestCalculatorTool() {
  // Solve for interest by default; user supplies the other three.
  const [solveFor, setSolveFor] = useState<Solve>('I');
  const [P, setP] = useState('1000');
  const [r, setR] = useState('5');
  const [t, setT] = useState('3');
  const [I, setI] = useState('150');

  const result = useMemo(() => {
    const get = (s: string): number => Number(s.trim());

    // Validate the three required inputs depending on the unknown.
    const needs: { key: Solve; label: string; raw: string }[] = (
      ['I', 'P', 'r', 't'] as Solve[]
    )
      .filter((k) => k !== solveFor)
      .map((k) => ({
        key: k,
        label: SOLVE_LABELS[k],
        raw: k === 'I' ? I : k === 'P' ? P : k === 'r' ? r : t,
      }));

    for (const n of needs) {
      const v = get(n.raw);
      if (n.raw.trim() === '' || !Number.isFinite(v)) {
        return { error: `Enter a valid number for ${n.label}.` };
      }
    }

    const Pv = get(P);
    const rv = get(r);
    const tv = get(t);
    const Iv = get(I);

    let solved: number;
    switch (solveFor) {
      case 'I':
        solved = (Pv * rv * tv) / 100;
        break;
      case 'P':
        if (rv === 0 || tv === 0) return { error: 'Rate and time must be non-zero to solve for principal.' };
        solved = (100 * Iv) / (rv * tv);
        break;
      case 'r':
        if (Pv === 0 || tv === 0) return { error: 'Principal and time must be non-zero to solve for rate.' };
        solved = (100 * Iv) / (Pv * tv);
        break;
      case 't':
        if (Pv === 0 || rv === 0) return { error: 'Principal and rate must be non-zero to solve for time.' };
        solved = (100 * Iv) / (Pv * rv);
        break;
      default:
        return { error: 'Unknown variable.' };
    }

    // Resolve the full set after solving.
    const finalP = solveFor === 'P' ? solved : Pv;
    const finalR = solveFor === 'r' ? solved : rv;
    const finalT = solveFor === 't' ? solved : tv;
    const finalI = solveFor === 'I' ? solved : (finalP * finalR * finalT) / 100;
    const total = finalP + finalI;

    const rows: { label: string; value: string }[] = [
      { label: `Solved: ${SOLVE_LABELS[solveFor]}`, value: solveFor === 'r' ? `${num(solved)} %` : num(solved) },
      { label: 'Principal (P)', value: money(finalP) },
      { label: 'Annual rate (r)', value: `${num(finalR)} %` },
      { label: 'Time (t)', value: `${num(finalT)} yr` },
      { label: 'Interest (I)', value: money(finalI) },
      { label: 'Total amount (A = P + I)', value: money(total) },
    ];

    return { rows, total };
  }, [solveFor, P, r, t, I]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Solve for">
            <Select value={solveFor} onValueChange={(v) => setSolveFor(v as Solve)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SOLVE_LABELS) as Solve[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {SOLVE_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {solveFor !== 'P' && (
            <Field label="Principal (P)">
              <Input value={P} onChange={(e) => setP(e.target.value)} inputMode="decimal" className="w-32 font-mono" />
            </Field>
          )}
          {solveFor !== 'r' && (
            <Field label="Annual rate (r %)">
              <Input value={r} onChange={(e) => setR(e.target.value)} inputMode="decimal" className="w-28 font-mono" />
            </Field>
          )}
          {solveFor !== 't' && (
            <Field label="Time (t, years)">
              <Input value={t} onChange={(e) => setT(e.target.value)} inputMode="decimal" className="w-28 font-mono" />
            </Field>
          )}
          {solveFor !== 'I' && (
            <Field label="Interest (I)">
              <Input value={I} onChange={(e) => setI(e.target.value)} inputMode="decimal" className="w-32 font-mono" />
            </Field>
          )}
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton value={() => result.rows.map((row) => `${row.label}: ${row.value}`).join('\n')} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {result.rows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span>{row.value}</span>
                  <CopyButton value={row.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar items={['Formula: I = P · r · t / 100', 'Simple (non-compounding)']} />
        </Panel>
      )}
    </div>
  );
}
