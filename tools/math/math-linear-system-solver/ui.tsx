'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

type Result =
  | { error: string }
  | {
      kind: 'unique';
      solution: number[];
      residual: number;
      steps: string[];
    }
  | { kind: 'singular'; message: string; steps: string[] };

const SAMPLE = `2 1 -1 | 8
-3 -1 2 | -11
-2 1 2 | -3`;

/** Parse rows of "a b c | d" (or "a b c d") into A (n x n) and b (n). */
function parseSystem(
  text: string
): { ok: true; A: number[][]; b: number[]; n: number } | { ok: false; error: string } {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { ok: false, error: 'Enter at least one equation.' };

  const A: number[][] = [];
  const b: number[] = [];
  const n = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const sideSplit = line.split('|');
    let coeffStr: string;
    let rhsStr: string | null;
    if (sideSplit.length === 2) {
      coeffStr = sideSplit[0] ?? '';
      rhsStr = sideSplit[1] ?? '';
    } else if (sideSplit.length === 1) {
      coeffStr = sideSplit[0] ?? '';
      rhsStr = null;
    } else {
      return { ok: false, error: `Row ${i + 1}: use at most one "|" to separate the constant.` };
    }

    const coeffs = coeffStr
      .split(/[\s,]+/)
      .filter((s) => s.length > 0)
      .map(Number);

    let rowCoeffs: number[];
    let rhs: number;

    if (rhsStr !== null) {
      const r = Number(rhsStr.trim());
      if (!Number.isFinite(r)) return { ok: false, error: `Row ${i + 1}: invalid constant after "|".` };
      rowCoeffs = coeffs;
      rhs = r;
    } else {
      // last number is the RHS
      if (coeffs.length < 2) return { ok: false, error: `Row ${i + 1}: need coefficients and a constant.` };
      rhs = coeffs[coeffs.length - 1] ?? 0;
      rowCoeffs = coeffs.slice(0, -1);
    }

    if (rowCoeffs.some((c) => !Number.isFinite(c))) {
      return { ok: false, error: `Row ${i + 1}: all coefficients must be numbers.` };
    }
    if (rowCoeffs.length !== n) {
      return {
        ok: false,
        error: `Row ${i + 1} has ${rowCoeffs.length} coefficients but the system has ${n} equations (must be square).`,
      };
    }
    A.push(rowCoeffs);
    b.push(rhs);
  }
  return { ok: true, A, b, n };
}

function solve(A0: number[][], b0: number[], n: number, showSteps: boolean): Result {
  // Build augmented matrix copy.
  const M: number[][] = A0.map((row, i) => [...row, b0[i] ?? 0]);
  const steps: string[] = [];
  const fmtRow = (r: number[]) => r.map((v) => v.toFixed(3)).join('  ');
  if (showSteps) steps.push('Augmented matrix:\n' + M.map(fmtRow).join('\n'));

  for (let col = 0; col < n; col++) {
    // Partial pivot: find max abs in this column at/below current row.
    let pivotRow = col;
    let maxAbs = Math.abs(M[col]?.[col] ?? 0);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(M[r]?.[col] ?? 0);
      if (v > maxAbs) {
        maxAbs = v;
        pivotRow = r;
      }
    }
    if (maxAbs < 1e-12) {
      // Zero pivot column: singular. Distinguish no-solution vs infinite later.
      return finishSingular(M, n, steps);
    }
    if (pivotRow !== col) {
      const tmp = M[col];
      const other = M[pivotRow];
      if (tmp && other) {
        M[col] = other;
        M[pivotRow] = tmp;
      }
      if (showSteps) steps.push(`Swap row ${col + 1} ↔ row ${pivotRow + 1}`);
    }
    const pivot = M[col]?.[col] ?? 0;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const rowR = M[r];
      const rowC = M[col];
      if (!rowR || !rowC) continue;
      const factor = (rowR[col] ?? 0) / pivot;
      if (factor === 0) continue;
      for (let k = col; k <= n; k++) {
        rowR[k] = (rowR[k] ?? 0) - factor * (rowC[k] ?? 0);
      }
    }
    if (showSteps) steps.push(`Eliminate column ${col + 1}:\n` + M.map(fmtRow).join('\n'));
  }

  // Back out solution (matrix is now diagonal-ish; divide by pivot).
  const solution: number[] = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const piv = M[i]?.[i] ?? 0;
    if (Math.abs(piv) < 1e-12) return finishSingular(M, n, steps);
    solution[i] = (M[i]?.[n] ?? 0) / piv;
  }

  // Residual norm ||A x - b||.
  let res = 0;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) sum += (A0[i]?.[j] ?? 0) * (solution[j] ?? 0);
    const diff = sum - (b0[i] ?? 0);
    res += diff * diff;
  }
  return { kind: 'unique', solution, residual: Math.sqrt(res), steps };
}

function finishSingular(M: number[][], n: number, steps: string[]): Result {
  // Check each row: all-zero coefficients with nonzero RHS => inconsistent.
  for (let i = 0; i < n; i++) {
    const row = M[i];
    if (!row) continue;
    let allZero = true;
    for (let j = 0; j < n; j++) {
      if (Math.abs(row[j] ?? 0) > 1e-9) {
        allZero = false;
        break;
      }
    }
    if (allZero && Math.abs(row[n] ?? 0) > 1e-9) {
      return { kind: 'singular', message: 'No solution: the system is inconsistent (e.g. 0 = nonzero).', steps };
    }
  }
  return {
    kind: 'singular',
    message: 'Infinitely many solutions: the coefficient matrix is singular (rank deficient).',
    steps,
  };
}

export default function LinearSystemSolver() {
  const [text, setText] = useState(SAMPLE);
  const [precision, setPrecision] = useState('6');
  const [showSteps, setShowSteps] = useState(false);

  const result = useMemo<Result>(() => {
    const parsed = parseSystem(text);
    if (!parsed.ok) return { error: parsed.error };
    if (parsed.n > 8) return { error: 'Limited to 8 equations for performance.' };
    return solve(parsed.A, parsed.b, parsed.n, showSteps);
  }, [text, showSteps]);

  const prec = useMemo(() => {
    const p = Number(precision);
    return Number.isInteger(p) && p >= 0 && p <= 12 ? p : 6;
  }, [precision]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="System (one equation per line: coefficients | constant)" />
        <div className="p-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            rows={6}
            className="font-mono text-sm"
            placeholder={SAMPLE}
          />
        </div>
        <OptionsBar>
          <Field label="Decimal places (0-12)">
            <Input value={precision} onChange={(e) => setPrecision(e.target.value)} inputMode="numeric" className="w-24" />
          </Field>
          <Field label="Show elimination steps">
            <Switch checked={showSteps} onCheckedChange={setShowSteps} />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : result.kind === 'singular' ? (
        <Panel>
          <PanelHeader title="No unique solution" />
          <div className="p-4 text-sm">{result.message}</div>
        </Panel>
      ) : (
        <Panel>
          <PanelHeader title="Solution vector">
            <CopyButton
              value={() => result.solution.map((v, i) => `x${i + 1} = ${v.toFixed(prec)}`).join('\n')}
            />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 md:grid-cols-3">
            {result.solution.map((v, i) => (
              <div key={i} className="flex flex-col gap-1 rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-2xs text-muted-foreground">{`x${i + 1}`}</span>
                <span className="flex items-center gap-2 font-mono text-lg font-semibold">
                  <span>{v.toFixed(prec)}</span>
                  <CopyButton value={v.toFixed(prec)} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar
            items={[
              `${result.solution.length} unknowns`,
              `Residual ||Ax−b|| = ${result.residual.toExponential(2)}`,
              'Gaussian elimination with partial pivoting',
            ]}
          />
        </Panel>
      )}

      {showSteps && !('error' in result) && result.steps.length > 0 && (
        <Panel>
          <PanelHeader title="Elimination steps" />
          <div className="space-y-2 p-3 font-mono text-xs">
            {result.steps.map((s, i) => (
              <pre key={i} className="whitespace-pre-wrap text-muted-foreground">
                {s}
              </pre>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
