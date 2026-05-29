'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Op = 'add' | 'sub' | 'mul' | 'transpose' | 'det' | 'inv';

type Matrix = number[][];

const BINARY: Op[] = ['add', 'sub', 'mul'];

function parseMatrix(raw: string, name: string): Matrix {
  const rows = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (rows.length === 0) throw new Error(`Matrix ${name} is empty.`);

  const matrix: Matrix = [];
  let width = -1;
  for (let i = 0; i < rows.length; i++) {
    const line = rows[i] ?? '';
    const cells = line
      .split(/[\s,]+/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (width === -1) width = cells.length;
    else if (cells.length !== width) {
      throw new Error(`Matrix ${name}: row ${i + 1} has ${cells.length} values, expected ${width}.`);
    }
    const numRow: number[] = [];
    for (let j = 0; j < cells.length; j++) {
      const n = Number(cells[j]);
      if (!Number.isFinite(n)) {
        throw new Error(`Matrix ${name}: "${cells[j] ?? ''}" at row ${i + 1} is not a number.`);
      }
      numRow.push(n);
    }
    matrix.push(numRow);
  }
  return matrix;
}

function dims(m: Matrix): [number, number] {
  return [m.length, m[0]?.length ?? 0];
}

function addSub(a: Matrix, b: Matrix, sign: 1 | -1): Matrix {
  const [ra, ca] = dims(a);
  const [rb, cb] = dims(b);
  if (ra !== rb || ca !== cb) {
    throw new Error(`Dimension mismatch: A is ${ra}×${ca}, B is ${rb}×${cb}. They must match.`);
  }
  const out: Matrix = [];
  for (let i = 0; i < ra; i++) {
    const ar = a[i] ?? [];
    const br = b[i] ?? [];
    const row: number[] = [];
    for (let j = 0; j < ca; j++) row.push((ar[j] ?? 0) + sign * (br[j] ?? 0));
    out.push(row);
  }
  return out;
}

function multiply(a: Matrix, b: Matrix): Matrix {
  const [ra, ca] = dims(a);
  const [rb, cb] = dims(b);
  if (ca !== rb) {
    throw new Error(
      `Dimension mismatch: A is ${ra}×${ca}, B is ${rb}×${cb}. Columns of A must equal rows of B.`,
    );
  }
  const out: Matrix = [];
  for (let i = 0; i < ra; i++) {
    const ar = a[i] ?? [];
    const row: number[] = [];
    for (let j = 0; j < cb; j++) {
      let sum = 0;
      for (let k = 0; k < ca; k++) sum += (ar[k] ?? 0) * (b[k]?.[j] ?? 0);
      row.push(sum);
    }
    out.push(row);
  }
  return out;
}

function transpose(a: Matrix): Matrix {
  const [r, c] = dims(a);
  const out: Matrix = [];
  for (let j = 0; j < c; j++) {
    const row: number[] = [];
    for (let i = 0; i < r; i++) row.push(a[i]?.[j] ?? 0);
    out.push(row);
  }
  return out;
}

function requireSquare(a: Matrix): number {
  const [r, c] = dims(a);
  if (r !== c) throw new Error(`Matrix must be square; got ${r}×${c}.`);
  if (r === 0) throw new Error('Matrix is empty.');
  return r;
}

/** Determinant via Gaussian elimination with partial pivoting. */
function determinant(a: Matrix): number {
  const n = requireSquare(a);
  const m: Matrix = a.map((row) => row.slice());
  let det = 1;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    let max = Math.abs(m[col]?.[col] ?? 0);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(m[r]?.[col] ?? 0);
      if (v > max) {
        max = v;
        pivot = r;
      }
    }
    if (max < 1e-12) return 0;
    if (pivot !== col) {
      const tmp = m[col]!;
      m[col] = m[pivot]!;
      m[pivot] = tmp;
      det = -det;
    }
    const pivotRow = m[col]!;
    const pivotVal = pivotRow[col] ?? 0;
    det *= pivotVal;
    for (let r = col + 1; r < n; r++) {
      const curRow = m[r]!;
      const factor = (curRow[col] ?? 0) / pivotVal;
      if (factor === 0) continue;
      for (let c = col; c < n; c++) {
        curRow[c] = (curRow[c] ?? 0) - factor * (pivotRow[c] ?? 0);
      }
    }
  }
  return det;
}

/** Inverse via Gauss-Jordan elimination on [A | I]. */
function inverse(a: Matrix): Matrix {
  const n = requireSquare(a);
  const aug: Matrix = [];
  for (let i = 0; i < n; i++) {
    const src = a[i] ?? [];
    const row: number[] = [];
    for (let j = 0; j < n; j++) row.push(src[j] ?? 0);
    for (let j = 0; j < n; j++) row.push(i === j ? 1 : 0);
    aug.push(row);
  }

  for (let col = 0; col < n; col++) {
    let pivot = col;
    let max = Math.abs(aug[col]?.[col] ?? 0);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(aug[r]?.[col] ?? 0);
      if (v > max) {
        max = v;
        pivot = r;
      }
    }
    if (max < 1e-12) throw new Error('Matrix is singular (determinant 0); no inverse exists.');
    if (pivot !== col) {
      const tmp = aug[col]!;
      aug[col] = aug[pivot]!;
      aug[pivot] = tmp;
    }
    const pivotRow = aug[col]!;
    const pivotVal = pivotRow[col] ?? 0;
    for (let c = 0; c < 2 * n; c++) pivotRow[c] = (pivotRow[c] ?? 0) / pivotVal;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const curRow = aug[r]!;
      const factor = curRow[col] ?? 0;
      if (factor === 0) continue;
      for (let c = 0; c < 2 * n; c++) {
        curRow[c] = (curRow[c] ?? 0) - factor * (pivotRow[c] ?? 0);
      }
    }
  }

  const out: Matrix = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    const src = aug[i] ?? [];
    for (let j = 0; j < n; j++) row.push(src[n + j] ?? 0);
    out.push(row);
  }
  return out;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const rounded = Math.round(n * 1e10) / 1e10;
  if (Object.is(rounded, -0)) return '0';
  return String(rounded);
}

function matrixToString(m: Matrix): string {
  const cols = m[0]?.length ?? 0;
  const widths: number[] = [];
  for (let j = 0; j < cols; j++) {
    let w = 0;
    for (let i = 0; i < m.length; i++) w = Math.max(w, fmt(m[i]?.[j] ?? 0).length);
    widths.push(w);
  }
  return m
    .map((row) => row.map((v, j) => fmt(v).padStart(widths[j] ?? 0, ' ')).join('  '))
    .join('\n');
}

export default function MatrixCalculatorTool() {
  const [op, setOp] = useState<Op>('mul');
  const [aText, setAText] = useState('1 2\n3 4');
  const [bText, setBText] = useState('5 6\n7 8');

  const showB = BINARY.includes(op);

  const result = useMemo<{ text: string; error: string | null }>(() => {
    try {
      const a = parseMatrix(aText, 'A');
      if (op === 'transpose') return { text: matrixToString(transpose(a)), error: null };
      if (op === 'det') return { text: fmt(determinant(a)), error: null };
      if (op === 'inv') return { text: matrixToString(inverse(a)), error: null };

      const b = parseMatrix(bText, 'B');
      if (op === 'add') return { text: matrixToString(addSub(a, b, 1)), error: null };
      if (op === 'sub') return { text: matrixToString(addSub(a, b, -1)), error: null };
      return { text: matrixToString(multiply(a, b)), error: null };
    } catch (err) {
      return { text: '', error: err instanceof Error ? err.message : String(err) };
    }
  }, [op, aText, bText]);

  return (
    <Panel>
      <PanelHeader title="Matrix Calculator" />

      <OptionsBar>
        <Field
          label="Operation"
          hint="Enter rows on separate lines, values separated by spaces or commas."
        >
          <Tabs value={op} onValueChange={(v) => setOp(v as Op)}>
            <TabsList>
              <TabsTrigger value="add">A + B</TabsTrigger>
              <TabsTrigger value="sub">A − B</TabsTrigger>
              <TabsTrigger value="mul">A × B</TabsTrigger>
              <TabsTrigger value="transpose">Aᵀ</TabsTrigger>
              <TabsTrigger value="det">det(A)</TabsTrigger>
              <TabsTrigger value="inv">A⁻¹</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      </OptionsBar>

      <div className={showB ? 'grid gap-4 sm:grid-cols-2' : 'grid gap-4'}>
        <div className="space-y-1.5">
          <Label htmlFor="mat-a">Matrix A</Label>
          <Textarea
            id="mat-a"
            value={aText}
            onChange={(e) => setAText(e.target.value)}
            rows={6}
            className="font-mono"
            placeholder={'1 2\n3 4'}
          />
        </div>
        {showB && (
          <div className="space-y-1.5">
            <Label htmlFor="mat-b">Matrix B</Label>
            <Textarea
              id="mat-b"
              value={bText}
              onChange={(e) => setBText(e.target.value)}
              rows={6}
              className="font-mono"
              placeholder={'5 6\n7 8'}
            />
          </div>
        )}
      </div>

      <ErrorBanner error={result.error} />

      {!result.error && result.text !== '' && (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <Label>Result</Label>
            <CopyButton value={result.text} />
          </div>
          <pre className="overflow-x-auto rounded-md border bg-muted/40 p-4 font-mono text-sm tabular-nums">
            {result.text}
          </pre>
          <StatBar items={['operation: ' + op]} />
        </div>
      )}
    </Panel>
  );
}
