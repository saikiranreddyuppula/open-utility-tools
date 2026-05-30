'use client';

import { useMemo, useState } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

const SAMPLE = `4 7 2
3 6 1
2 5 9`;

function parseMatrix(text: string): { error: string } | { matrix: number[][] } {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { error: 'Enter a square matrix, one row per line.' };

  const matrix: number[][] = [];
  for (const line of lines) {
    const parts = line.split(/[\s,]+/).filter((p) => p.length > 0);
    const row: number[] = [];
    for (const p of parts) {
      const n = Number(p);
      if (!Number.isFinite(n)) return { error: `Not a number: "${p}"` };
      row.push(n);
    }
    matrix.push(row);
  }

  const n = matrix.length;
  for (const row of matrix) {
    if (row.length !== n) {
      return { error: `Matrix must be square: ${n} rows but a row has ${row.length} columns.` };
    }
  }
  if (n > 10) return { error: 'Matrix too large (max 10x10).' };
  return { matrix };
}

// Determinant via Gaussian elimination with partial pivoting.
function determinant(m: number[][]): number {
  const n = m.length;
  const a = m.map((r) => [...r]);
  let det = 1;
  for (let col = 0; col < n; col++) {
    // find pivot
    let pivot = col;
    let maxVal = Math.abs(a[col]?.[col] ?? 0);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(a[r]?.[col] ?? 0);
      if (v > maxVal) {
        maxVal = v;
        pivot = r;
      }
    }
    if (maxVal < 1e-14) return 0;
    if (pivot !== col) {
      const tmp = a[pivot];
      const cur = a[col];
      if (tmp && cur) {
        a[pivot] = cur;
        a[col] = tmp;
      }
      det = -det;
    }
    const pivRow = a[col];
    const pivVal = pivRow?.[col] ?? 0;
    det *= pivVal;
    for (let r = col + 1; r < n; r++) {
      const curRow = a[r];
      if (!curRow || !pivRow) continue;
      const f = (curRow[col] ?? 0) / pivVal;
      for (let c = col; c < n; c++) {
        curRow[c] = (curRow[c] ?? 0) - f * (pivRow[c] ?? 0);
      }
    }
  }
  return det;
}

// Inverse via Gauss-Jordan. Returns null if singular.
function inverse(m: number[][]): number[][] | null {
  const n = m.length;
  // augmented [m | I]
  const a: number[][] = m.map((row, i) =>
    [...row].concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)))
  );

  for (let col = 0; col < n; col++) {
    let pivot = col;
    let maxVal = Math.abs(a[col]?.[col] ?? 0);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(a[r]?.[col] ?? 0);
      if (v > maxVal) {
        maxVal = v;
        pivot = r;
      }
    }
    if (maxVal < 1e-12) return null;
    if (pivot !== col) {
      const tmp = a[pivot];
      const cur = a[col];
      if (tmp && cur) {
        a[pivot] = cur;
        a[col] = tmp;
      }
    }
    const pivRow = a[col];
    if (!pivRow) return null;
    const pivVal = pivRow[col] ?? 0;
    for (let c = 0; c < 2 * n; c++) {
      pivRow[c] = (pivRow[c] ?? 0) / pivVal;
    }
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const curRow = a[r];
      if (!curRow) continue;
      const f = curRow[col] ?? 0;
      for (let c = 0; c < 2 * n; c++) {
        curRow[c] = (curRow[c] ?? 0) - f * (pivRow[c] ?? 0);
      }
    }
  }

  return a.map((row) => row.slice(n));
}

// Rank via row echelon (Gaussian elimination), counting nonzero pivot rows.
function rank(m: number[][]): number {
  const rows = m.length;
  const cols = m[0]?.length ?? 0;
  const a = m.map((r) => [...r]);
  let r = 0;
  for (let c = 0; c < cols && r < rows; c++) {
    let pivot = r;
    let maxVal = Math.abs(a[r]?.[c] ?? 0);
    for (let i = r + 1; i < rows; i++) {
      const v = Math.abs(a[i]?.[c] ?? 0);
      if (v > maxVal) {
        maxVal = v;
        pivot = i;
      }
    }
    if (maxVal < 1e-12) continue;
    const tmp = a[pivot];
    const cur = a[r];
    if (tmp && cur) {
      a[pivot] = cur;
      a[r] = tmp;
    }
    const pivRow = a[r];
    const pivVal = pivRow?.[c] ?? 0;
    for (let i = r + 1; i < rows; i++) {
      const curRow = a[i];
      if (!curRow || !pivRow) continue;
      const f = (curRow[c] ?? 0) / pivVal;
      for (let j = c; j < cols; j++) {
        curRow[j] = (curRow[j] ?? 0) - f * (pivRow[j] ?? 0);
      }
    }
    r++;
  }
  return r;
}

function fmt(n: number, precision: number): string {
  if (Object.is(n, -0)) n = 0;
  // clean near-integers
  const rounded = Math.round(n);
  if (Math.abs(n - rounded) < 1e-9) return String(rounded);
  return n.toFixed(precision);
}

export default function MatrixDeterminantInverseTool() {
  const [text, setText] = useState(SAMPLE);
  const [precision, setPrecision] = useState(4);

  const result = useMemo(() => {
    const parsed = parseMatrix(text);
    if ('error' in parsed) return parsed;
    const m = parsed.matrix;
    const det = determinant(m);
    const rk = rank(m);
    const inv = Math.abs(det) < 1e-12 ? null : inverse(m);
    return { matrix: m, det, rank: rk, inverse: inv };
  }, [text]);

  const invText = useMemo(() => {
    if ('error' in result || !result.inverse) return '';
    return result.inverse
      .map((row) => row.map((v) => fmt(v, precision)).join('\t'))
      .join('\n');
  }, [result, precision]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label={`Decimal precision: ${precision}`} className="min-w-[220px]">
          <Slider
            value={[precision]}
            min={0}
            max={10}
            step={1}
            onValueChange={(v) => setPrecision(v[0] ?? 4)}
          />
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Matrix (one row per line, space/comma separated)" />
        <div className="p-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            rows={6}
            className="font-mono text-sm"
          />
        </div>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Panel>
              <PanelHeader title="Determinant">
                <CopyButton value={() => fmt(result.det, precision)} />
              </PanelHeader>
              <div className="px-3 py-4 font-mono text-2xl font-semibold tabular text-primary">
                {fmt(result.det, precision)}
              </div>
            </Panel>
            <Panel>
              <PanelHeader title="Rank">
                <CopyButton value={() => String(result.rank)} />
              </PanelHeader>
              <div className="px-3 py-4 font-mono text-2xl font-semibold tabular">
                {result.rank} / {result.matrix.length}
              </div>
            </Panel>
          </div>

          <Panel>
            <PanelHeader title="Inverse matrix">
              {result.inverse && <CopyButton value={() => invText} label="Copy" size="sm" />}
            </PanelHeader>
            {result.inverse ? (
              <div className="overflow-x-auto p-3">
                <table className="font-mono text-sm tabular">
                  <tbody>
                    {result.inverse.map((row, i) => (
                      <tr key={i}>
                        {row.map((v, j) => (
                          <td
                            key={j}
                            className="border px-3 py-1.5 text-right"
                          >
                            {fmt(v, precision)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-3 py-4 text-sm text-muted-foreground">
                Matrix is singular (determinant is 0) — no inverse exists.
              </div>
            )}
            <StatBar
              items={[
                `${result.matrix.length}×${result.matrix.length} matrix`,
                Math.abs(result.det) < 1e-12 ? 'Singular' : 'Invertible',
              ]}
            />
          </Panel>
        </>
      )}
    </div>
  );
}
