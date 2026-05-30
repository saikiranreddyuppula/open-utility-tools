'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = '2d' | '3d';

function num(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

function round(n: number): string {
  return Number(n.toFixed(6)).toString();
}

type Result =
  | { error: string }
  | { rows: { label: string; value: string }[] };

export default function Distance2d3d() {
  const [mode, setMode] = useState<Mode>('2d');
  const [x1, setX1] = useState('0');
  const [y1, setY1] = useState('0');
  const [z1, setZ1] = useState('0');
  const [x2, setX2] = useState('3');
  const [y2, setY2] = useState('4');
  const [z2, setZ2] = useState('0');

  const result = useMemo<Result>(() => {
    const is3d = mode === '3d';
    const px1 = num(x1);
    const py1 = num(y1);
    const px2 = num(x2);
    const py2 = num(y2);
    if (px1 === null || py1 === null || px2 === null || py2 === null) {
      return { error: 'Enter valid numbers for all coordinates.' };
    }
    let pz1 = 0;
    let pz2 = 0;
    if (is3d) {
      const a = num(z1);
      const b = num(z2);
      if (a === null || b === null) return { error: 'Enter valid Z coordinates.' };
      pz1 = a;
      pz2 = b;
    }

    const dx = px2 - px1;
    const dy = py2 - py1;
    const dz = pz2 - pz1;

    const euclid = Math.sqrt(dx * dx + dy * dy + (is3d ? dz * dz : 0));
    const manhattan = Math.abs(dx) + Math.abs(dy) + (is3d ? Math.abs(dz) : 0);
    const chebyshev = Math.max(Math.abs(dx), Math.abs(dy), is3d ? Math.abs(dz) : 0);

    const delta = is3d ? `(${round(dx)}, ${round(dy)}, ${round(dz)})` : `(${round(dx)}, ${round(dy)})`;
    const mid = is3d
      ? `(${round((px1 + px2) / 2)}, ${round((py1 + py2) / 2)}, ${round((pz1 + pz2) / 2)})`
      : `(${round((px1 + px2) / 2)}, ${round((py1 + py2) / 2)})`;

    return {
      rows: [
        { label: 'Euclidean distance', value: round(euclid) },
        { label: 'Manhattan distance', value: round(manhattan) },
        { label: 'Chebyshev distance', value: round(chebyshev) },
        { label: 'Delta vector (P2 − P1)', value: delta },
        { label: 'Midpoint', value: mid },
      ],
    };
  }, [mode, x1, y1, z1, x2, y2, z2]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="2d">2D</TabsTrigger>
                <TabsTrigger value="3d">3D</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>
        <div className="grid grid-cols-1 gap-4 p-3 sm:grid-cols-2">
          <div>
            <div className="mb-2 text-2xs font-medium text-muted-foreground">Point 1</div>
            <div className="flex gap-2">
              <Field label="x1"><Input value={x1} onChange={(e) => setX1(e.target.value)} inputMode="decimal" /></Field>
              <Field label="y1"><Input value={y1} onChange={(e) => setY1(e.target.value)} inputMode="decimal" /></Field>
              {mode === '3d' && (
                <Field label="z1"><Input value={z1} onChange={(e) => setZ1(e.target.value)} inputMode="decimal" /></Field>
              )}
            </div>
          </div>
          <div>
            <div className="mb-2 text-2xs font-medium text-muted-foreground">Point 2</div>
            <div className="flex gap-2">
              <Field label="x2"><Input value={x2} onChange={(e) => setX2(e.target.value)} inputMode="decimal" /></Field>
              <Field label="y2"><Input value={y2} onChange={(e) => setY2(e.target.value)} inputMode="decimal" /></Field>
              {mode === '3d' && (
                <Field label="z2"><Input value={z2} onChange={(e) => setZ2(e.target.value)} inputMode="decimal" /></Field>
              )}
            </div>
          </div>
        </div>
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
                  <span>{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar items={[mode === '3d' ? '3D space' : '2D plane', 'Pure coordinate math']} />
        </Panel>
      )}
    </div>
  );
}
