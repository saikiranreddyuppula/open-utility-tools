'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

function parseCoef(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return n;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) < 1e-12) return '0';
  const rounded = Math.round(n * 1e6) / 1e6;
  return String(rounded);
}

interface Solution {
  error: string | null;
  data:
    | {
        a: number;
        b: number;
        c: number;
        discriminant: number;
        kind: 'two-real' | 'one-real' | 'complex' | 'linear' | 'degenerate';
        rootsText: string[];
        vertexX: number;
        vertexY: number;
      }
    | null;
}

export default function QuadraticEquationSolverTool() {
  const [aText, setAText] = useState('1');
  const [bText, setBText] = useState('-3');
  const [cText, setCText] = useState('2');

  const result = useMemo<Solution>(() => {
    const a = parseCoef(aText);
    const b = parseCoef(bText);
    const c = parseCoef(cText);

    if (a === null || b === null || c === null) {
      return { error: 'Enter numeric values for a, b, and c.', data: null };
    }

    // Linear / degenerate handling when a === 0.
    if (a === 0) {
      if (b === 0) {
        if (c === 0) {
          return {
            error: null,
            data: {
              a, b, c,
              discriminant: 0,
              kind: 'degenerate',
              rootsText: ['Infinitely many solutions (0 = 0)'],
              vertexX: NaN,
              vertexY: NaN,
            },
          };
        }
        return {
          error: null,
          data: {
            a, b, c,
            discriminant: 0,
            kind: 'degenerate',
            rootsText: ['No solution (contradiction)'],
            vertexX: NaN,
            vertexY: NaN,
          },
        };
      }
      // Linear: bx + c = 0
      const x = -c / b;
      return {
        error: null,
        data: {
          a, b, c,
          discriminant: 0,
          kind: 'linear',
          rootsText: [`x = ${fmt(x)}`],
          vertexX: NaN,
          vertexY: NaN,
        },
      };
    }

    const discriminant = b * b - 4 * a * c;
    const vertexX = -b / (2 * a);
    const vertexY = a * vertexX * vertexX + b * vertexX + c;

    let kind: 'two-real' | 'one-real' | 'complex';
    let rootsText: string[];

    if (discriminant > 0) {
      kind = 'two-real';
      const sq = Math.sqrt(discriminant);
      const x1 = (-b + sq) / (2 * a);
      const x2 = (-b - sq) / (2 * a);
      rootsText = [`x₁ = ${fmt(x1)}`, `x₂ = ${fmt(x2)}`];
    } else if (discriminant === 0) {
      kind = 'one-real';
      const x = -b / (2 * a);
      rootsText = [`x = ${fmt(x)} (double root)`];
    } else {
      kind = 'complex';
      const real = -b / (2 * a);
      const imag = Math.sqrt(-discriminant) / (2 * a);
      const absImag = Math.abs(imag);
      rootsText = [
        `x₁ = ${fmt(real)} + ${fmt(absImag)}i`,
        `x₂ = ${fmt(real)} − ${fmt(absImag)}i`,
      ];
    }

    return {
      error: null,
      data: { a, b, c, discriminant, kind, rootsText, vertexX, vertexY },
    };
  }, [aText, bText, cText]);

  const data = result.data;

  const copyText = useMemo(() => {
    if (!data) return '';
    const lines: string[] = [
      `Equation: ${fmt(data.a)}x² + ${fmt(data.b)}x + ${fmt(data.c)} = 0`,
      `Discriminant: ${fmt(data.discriminant)}`,
      ...data.rootsText,
    ];
    if (Number.isFinite(data.vertexX)) {
      lines.push(`Vertex: (${fmt(data.vertexX)}, ${fmt(data.vertexY)})`);
    }
    return lines.join('\n');
  }, [data]);

  const kindLabel: Record<string, string> = {
    'two-real': 'Two distinct real roots',
    'one-real': 'One repeated real root',
    complex: 'Two complex conjugate roots',
    linear: 'Linear equation (a = 0)',
    degenerate: 'Degenerate equation',
  };

  return (
    <Panel>
      <PanelHeader title="Quadratic Equation Solver">
        {copyText !== '' && <CopyButton value={copyText} />}
      </PanelHeader>

      <p className="text-sm text-muted-foreground">
        Solve <span className="font-mono">ax² + bx + c = 0</span>
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="a">
          <Input inputMode="decimal" value={aText} onChange={(e) => setAText(e.target.value)} placeholder="1" />
        </Field>
        <Field label="b">
          <Input inputMode="decimal" value={bText} onChange={(e) => setBText(e.target.value)} placeholder="-3" />
        </Field>
        <Field label="c">
          <Input inputMode="decimal" value={cText} onChange={(e) => setCText(e.target.value)} placeholder="2" />
        </Field>
      </div>

      <ErrorBanner error={result.error} />

      {data && (
        <div className="mt-2 space-y-3">
          <div className="rounded-md border p-4">
            <div className="text-xs text-muted-foreground">{kindLabel[data.kind] ?? 'Result'}</div>
            <div className="mt-2 space-y-1 font-mono text-lg">
              {data.rootsText.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      <StatBar
        items={[
          data && `Discriminant = ${fmt(data.discriminant)}`,
          data && Number.isFinite(data.vertexX) && `Vertex (${fmt(data.vertexX)}, ${fmt(data.vertexY)})`,
        ]}
      />
    </Panel>
  );
}
