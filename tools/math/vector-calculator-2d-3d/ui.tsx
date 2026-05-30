'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Dim = '2' | '3';
type Op = 'add' | 'sub' | 'dot' | 'cross' | 'angle' | 'project';

const OP_LABEL: Record<Op, string> = {
  add: 'a + b',
  sub: 'a − b',
  dot: 'a · b (dot)',
  cross: 'a × b (cross)',
  angle: 'Angle between',
  project: 'Project a onto b',
};

function parseVec(x: string, y: string, z: string, dim: Dim): number[] | null {
  const nx = Number(x.trim());
  const ny = Number(y.trim());
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;
  if (dim === '2') return [nx, ny];
  const nz = Number(z.trim());
  if (!Number.isFinite(nz)) return null;
  return [nx, ny, nz];
}

function mag(v: number[]): number {
  return Math.sqrt(v.reduce((s, c) => s + c * c, 0));
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] ?? 0) * (b[i] ?? 0);
  return s;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const r = Math.round(n * 1e6) / 1e6;
  return Object.is(r, -0) ? '0' : String(r);
}

function vecStr(v: number[]): string {
  return `(${v.map(fmt).join(', ')})`;
}

export default function VectorCalculatorTool() {
  const [dim, setDim] = useState<Dim>('3');
  const [op, setOp] = useState<Op>('add');
  const [ax, setAx] = useState('1');
  const [ay, setAy] = useState('2');
  const [az, setAz] = useState('3');
  const [bx, setBx] = useState('4');
  const [by, setBy] = useState('5');
  const [bz, setBz] = useState('6');

  const result = useMemo(() => {
    const a = parseVec(ax, ay, az, dim);
    const b = parseVec(bx, by, bz, dim);
    if (!a) return { error: 'Vector a has invalid components.' as string };
    if (!b) return { error: 'Vector b has invalid components.' };

    const magA = mag(a);
    const magB = mag(b);
    const rows: { label: string; value: string }[] = [];

    switch (op) {
      case 'add': {
        const r = a.map((c, i) => c + (b[i] ?? 0));
        rows.push({ label: 'a + b', value: vecStr(r) });
        rows.push({ label: '|a + b|', value: fmt(mag(r)) });
        break;
      }
      case 'sub': {
        const r = a.map((c, i) => c - (b[i] ?? 0));
        rows.push({ label: 'a − b', value: vecStr(r) });
        rows.push({ label: '|a − b|', value: fmt(mag(r)) });
        break;
      }
      case 'dot': {
        rows.push({ label: 'a · b', value: fmt(dot(a, b)) });
        break;
      }
      case 'cross': {
        if (dim === '2') {
          const ax0 = a[0] ?? 0;
          const ay0 = a[1] ?? 0;
          const bx0 = b[0] ?? 0;
          const by0 = b[1] ?? 0;
          rows.push({ label: 'a × b (z-component)', value: fmt(ax0 * by0 - ay0 * bx0) });
        } else {
          const a0 = a[0] ?? 0;
          const a1 = a[1] ?? 0;
          const a2 = a[2] ?? 0;
          const b0 = b[0] ?? 0;
          const b1 = b[1] ?? 0;
          const b2 = b[2] ?? 0;
          const cr = [a1 * b2 - a2 * b1, a2 * b0 - a0 * b2, a0 * b1 - a1 * b0];
          rows.push({ label: 'a × b', value: vecStr(cr) });
          rows.push({ label: '|a × b|', value: fmt(mag(cr)) });
        }
        break;
      }
      case 'angle': {
        if (magA === 0 || magB === 0) {
          return { error: 'Angle is undefined for a zero-length vector.' };
        }
        let cos = dot(a, b) / (magA * magB);
        cos = Math.max(-1, Math.min(1, cos));
        const deg = (Math.acos(cos) * 180) / Math.PI;
        rows.push({ label: 'Angle', value: `${fmt(deg)}°` });
        rows.push({ label: 'cos θ', value: fmt(cos) });
        rows.push({ label: 'Radians', value: fmt(Math.acos(cos)) });
        break;
      }
      case 'project': {
        if (magB === 0) {
          return { error: 'Cannot project onto a zero-length vector b.' };
        }
        const scalar = dot(a, b) / magB; // scalar projection
        const factor = dot(a, b) / (magB * magB);
        const proj = b.map((c) => c * factor); // vector projection
        rows.push({ label: 'Scalar projection', value: fmt(scalar) });
        rows.push({ label: 'Vector projection', value: vecStr(proj) });
        break;
      }
      default: {
        return { error: 'Unknown operation.' };
      }
    }

    const unitA = magA === 0 ? null : a.map((c) => c / magA);
    const unitB = magB === 0 ? null : b.map((c) => c / magB);

    return { rows, magA, magB, unitA, unitB };
  }, [ax, ay, az, bx, by, bz, dim, op]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Dimensions">
            <Tabs value={dim} onValueChange={(v) => setDim(v as Dim)}>
              <TabsList>
                <TabsTrigger value="2">2D</TabsTrigger>
                <TabsTrigger value="3">3D</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Operation" className="min-w-[180px]">
            <Select value={op} onValueChange={(v) => setOp(v as Op)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(OP_LABEL) as Op[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {OP_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </OptionsBar>
        <div className="space-y-3 p-3">
          <OptionsBar>
            <span className="self-end pb-2 font-mono text-sm text-muted-foreground">a =</span>
            <Field label="x">
              <Input value={ax} onChange={(e) => setAx(e.target.value)} inputMode="decimal" className="w-20 font-mono" />
            </Field>
            <Field label="y">
              <Input value={ay} onChange={(e) => setAy(e.target.value)} inputMode="decimal" className="w-20 font-mono" />
            </Field>
            {dim === '3' && (
              <Field label="z">
                <Input value={az} onChange={(e) => setAz(e.target.value)} inputMode="decimal" className="w-20 font-mono" />
              </Field>
            )}
          </OptionsBar>
          <OptionsBar>
            <span className="self-end pb-2 font-mono text-sm text-muted-foreground">b =</span>
            <Field label="x">
              <Input value={bx} onChange={(e) => setBx(e.target.value)} inputMode="decimal" className="w-20 font-mono" />
            </Field>
            <Field label="y">
              <Input value={by} onChange={(e) => setBy(e.target.value)} inputMode="decimal" className="w-20 font-mono" />
            </Field>
            {dim === '3' && (
              <Field label="z">
                <Input value={bz} onChange={(e) => setBz(e.target.value)} inputMode="decimal" className="w-20 font-mono" />
              </Field>
            )}
          </OptionsBar>
        </div>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title={OP_LABEL[op]}>
            <CopyButton
              value={() => result.rows.map((r) => `${r.label}: ${r.value}`).join('\n')}
            />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
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
          <StatBar
            items={[
              `|a| = ${fmt(result.magA)}`,
              `|b| = ${fmt(result.magB)}`,
              result.unitA ? `â = ${vecStr(result.unitA)}` : 'â undefined (|a|=0)',
              result.unitB ? `b̂ = ${vecStr(result.unitB)}` : 'b̂ undefined (|b|=0)',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
