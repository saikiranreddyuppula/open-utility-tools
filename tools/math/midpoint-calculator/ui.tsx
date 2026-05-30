'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

type Dim = '2d' | '3d';
type Division = 'internal' | 'external';

function num(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmt(n: number, precision = 4): string {
  if (Object.is(n, -0)) n = 0;
  const rounded = Math.round(n);
  if (Math.abs(n - rounded) < 1e-12) return String(rounded);
  return n.toFixed(precision);
}

function point(coords: number[]): string {
  return `(${coords.map((c) => fmt(c)).join(', ')})`;
}

export default function MidpointCalculatorTool() {
  const [dim, setDim] = useState<Dim>('2d');
  const [division, setDivision] = useState<Division>('internal');

  const [x1, setX1] = useState('2');
  const [y1, setY1] = useState('3');
  const [z1, setZ1] = useState('0');
  const [x2, setX2] = useState('8');
  const [y2, setY2] = useState('11');
  const [z2, setZ2] = useState('6');

  const [m, setM] = useState('1');
  const [n, setN] = useState('1');

  const result = useMemo(() => {
    const is3d = dim === '3d';
    const p1: (number | null)[] = [num(x1), num(y1), is3d ? num(z1) : 0];
    const p2: (number | null)[] = [num(x2), num(y2), is3d ? num(z2) : 0];
    if (p1.some((c) => c == null) || p2.some((c) => c == null)) {
      return { error: 'Enter valid numbers for all point coordinates.' };
    }
    const a = p1 as number[];
    const b = p2 as number[];

    const mv = num(m);
    const nv = num(n);
    if (mv == null || nv == null) return { error: 'Enter valid ratio values m and n.' };
    if (mv < 0 || nv < 0) return { error: 'Ratio values must be non-negative.' };
    if (mv === 0 && nv === 0) return { error: 'Ratio cannot be 0:0.' };

    const count = is3d ? 3 : 2;

    // midpoint
    const mid: number[] = [];
    for (let i = 0; i < count; i++) {
      mid.push(((a[i] ?? 0) + (b[i] ?? 0)) / 2);
    }

    // section formula
    let section: number[] | null = null;
    let sectionError: string | null = null;
    if (division === 'internal') {
      const denom = mv + nv;
      if (denom === 0) {
        sectionError = 'Internal division needs m + n ≠ 0.';
      } else {
        section = [];
        for (let i = 0; i < count; i++) {
          section.push((mv * (b[i] ?? 0) + nv * (a[i] ?? 0)) / denom);
        }
      }
    } else {
      const denom = mv - nv;
      if (denom === 0) {
        sectionError = 'External division needs m ≠ n.';
      } else {
        section = [];
        for (let i = 0; i < count; i++) {
          section.push((mv * (b[i] ?? 0) - nv * (a[i] ?? 0)) / denom);
        }
      }
    }

    // length
    let sq = 0;
    for (let i = 0; i < count; i++) {
      const d = (b[i] ?? 0) - (a[i] ?? 0);
      sq += d * d;
    }
    const length = Math.sqrt(sq);

    return { mid, section, sectionError, length, count };
  }, [dim, division, x1, y1, z1, x2, y2, z2, m, n]);

  const is3d = dim === '3d';

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Dimensions">
          <Tabs value={dim} onValueChange={(v) => setDim(v as Dim)}>
            <TabsList>
              <TabsTrigger value="2d">2D</TabsTrigger>
              <TabsTrigger value="3d">3D</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label="Division">
          <Select value={division} onValueChange={(v) => setDivision(v as Division)}>
            <SelectTrigger className="h-8 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="internal">Internal</SelectItem>
              <SelectItem value="external">External</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Ratio m" htmlFor="mp-m">
          <Input
            id="mp-m"
            value={m}
            onChange={(e) => setM(e.target.value)}
            type="number"
            className="h-8 w-20 font-mono"
          />
        </Field>
        <Field label="Ratio n" htmlFor="mp-n">
          <Input
            id="mp-n"
            value={n}
            onChange={(e) => setN(e.target.value)}
            type="number"
            className="h-8 w-20 font-mono"
          />
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Points" />
        <div className="flex flex-wrap items-end gap-4 p-3">
          <div className="flex items-end gap-2">
            <span className="pb-1.5 text-sm font-medium text-muted-foreground">P1</span>
            <Field label="x₁" htmlFor="mp-x1">
              <Input id="mp-x1" value={x1} onChange={(e) => setX1(e.target.value)} type="number" className="h-8 w-20 font-mono" />
            </Field>
            <Field label="y₁" htmlFor="mp-y1">
              <Input id="mp-y1" value={y1} onChange={(e) => setY1(e.target.value)} type="number" className="h-8 w-20 font-mono" />
            </Field>
            {is3d && (
              <Field label="z₁" htmlFor="mp-z1">
                <Input id="mp-z1" value={z1} onChange={(e) => setZ1(e.target.value)} type="number" className="h-8 w-20 font-mono" />
              </Field>
            )}
          </div>
          <div className="flex items-end gap-2">
            <span className="pb-1.5 text-sm font-medium text-muted-foreground">P2</span>
            <Field label="x₂" htmlFor="mp-x2">
              <Input id="mp-x2" value={x2} onChange={(e) => setX2(e.target.value)} type="number" className="h-8 w-20 font-mono" />
            </Field>
            <Field label="y₂" htmlFor="mp-y2">
              <Input id="mp-y2" value={y2} onChange={(e) => setY2(e.target.value)} type="number" className="h-8 w-20 font-mono" />
            </Field>
            {is3d && (
              <Field label="z₂" htmlFor="mp-z2">
                <Input id="mp-z2" value={z2} onChange={(e) => setZ2(e.target.value)} type="number" className="h-8 w-20 font-mono" />
              </Field>
            )}
          </div>
        </div>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Panel>
            <PanelHeader title="Midpoint">
              <CopyButton value={() => point(result.mid)} />
            </PanelHeader>
            <div className="px-3 py-4 font-mono text-xl font-semibold text-primary">
              {point(result.mid)}
            </div>
          </Panel>
          <Panel>
            <PanelHeader title={`Section point (${division} ${m}:${n})`}>
              {result.section && <CopyButton value={() => point(result.section as number[])} />}
            </PanelHeader>
            <div className="px-3 py-4 font-mono text-xl font-semibold">
              {result.section ? point(result.section) : (result.sectionError ?? '—')}
            </div>
          </Panel>
          <Panel>
            <PanelHeader title="Segment length">
              <CopyButton value={() => fmt(result.length)} />
            </PanelHeader>
            <div className="px-3 py-4 font-mono text-xl font-semibold">
              {fmt(result.length)}
            </div>
            <StatBar items={[is3d ? '3D' : '2D']} />
          </Panel>
        </div>
      )}
    </div>
  );
}
