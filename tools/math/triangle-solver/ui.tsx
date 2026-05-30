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

type ModeKey = 'SSS' | 'SAS' | 'ASA' | 'AAS' | 'SSA';
type Unit = 'deg' | 'rad';

const MODE_LABELS: Record<ModeKey, string> = {
  SSS: 'SSS — three sides',
  SAS: 'SAS — two sides + included angle',
  ASA: 'ASA — two angles + included side',
  AAS: 'AAS — two angles + a side',
  SSA: 'SSA — two sides + non-included angle',
};

interface Solution {
  a: number;
  b: number;
  c: number;
  A: number; // radians
  B: number;
  C: number;
}

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

function num(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 5 });
}

function fmtAngle(rad: number, unit: Unit): string {
  if (unit === 'rad') return `${num(rad)} rad`;
  return `${num(rad * R2D)}°`;
}

type Result =
  | { error: string }
  | { solutions: Solution[]; note: string };

export default function TriangleSolverTool() {
  const [mode, setMode] = useState<ModeKey>('SSS');
  const [unit, setUnit] = useState<Unit>('deg');
  // generic six fields
  const [a, setA] = useState('3');
  const [b, setB] = useState('4');
  const [c, setC] = useState('5');
  const [A, setAA] = useState('40');
  const [B, setBB] = useState('60');
  const [C, setCC] = useState('80');

  const result = useMemo<Result>(() => {
    const ang = (s: string): number => {
      const v = Number(s);
      if (!Number.isFinite(v)) return NaN;
      return unit === 'deg' ? v * D2R : v;
    };
    const side = (s: string): number => Number(s);

    const finalize = (sol: Solution): Solution | null => {
      // validate
      if (![sol.a, sol.b, sol.c].every((x) => Number.isFinite(x) && x > 0)) return null;
      if (![sol.A, sol.B, sol.C].every((x) => Number.isFinite(x) && x > 0)) return null;
      const sum = sol.A + sol.B + sol.C;
      if (Math.abs(sum - Math.PI) > 1e-6) return null;
      return sol;
    };

    let solutions: Solution[] = [];
    let note = '';

    switch (mode) {
      case 'SSS': {
        const sa = side(a);
        const sb = side(b);
        const sc = side(c);
        if (![sa, sb, sc].every((x) => Number.isFinite(x) && x > 0)) {
          return { error: 'Enter three positive side lengths.' };
        }
        if (sa + sb <= sc || sa + sc <= sb || sb + sc <= sa) {
          return { error: 'These sides violate the triangle inequality.' };
        }
        const angA = Math.acos((sb * sb + sc * sc - sa * sa) / (2 * sb * sc));
        const angB = Math.acos((sa * sa + sc * sc - sb * sb) / (2 * sa * sc));
        const angC = Math.PI - angA - angB;
        const s = finalize({ a: sa, b: sb, c: sc, A: angA, B: angB, C: angC });
        if (s) solutions = [s];
        break;
      }
      case 'SAS': {
        // sides a, b and included angle C
        const sa = side(a);
        const sb = side(b);
        const angC = ang(C);
        if (![sa, sb].every((x) => Number.isFinite(x) && x > 0)) {
          return { error: 'Enter sides a and b as positive numbers.' };
        }
        if (!Number.isFinite(angC) || angC <= 0 || angC >= Math.PI) {
          return { error: 'Included angle C must be between 0 and 180°.' };
        }
        const sc = Math.sqrt(sa * sa + sb * sb - 2 * sa * sb * Math.cos(angC));
        const angA = Math.acos((sb * sb + sc * sc - sa * sa) / (2 * sb * sc));
        const angB = Math.PI - angA - angC;
        const s = finalize({ a: sa, b: sb, c: sc, A: angA, B: angB, C: angC });
        if (s) solutions = [s];
        break;
      }
      case 'ASA': {
        // angles A, B and included side c
        const angA = ang(A);
        const angB = ang(B);
        const sc = side(c);
        if (!Number.isFinite(angA) || !Number.isFinite(angB) || angA <= 0 || angB <= 0) {
          return { error: 'Enter valid positive angles A and B.' };
        }
        if (angA + angB >= Math.PI) {
          return { error: 'Angles A and B must sum to less than 180°.' };
        }
        if (!Number.isFinite(sc) || sc <= 0) {
          return { error: 'Enter included side c as a positive number.' };
        }
        const angC = Math.PI - angA - angB;
        const sa = (sc * Math.sin(angA)) / Math.sin(angC);
        const sb = (sc * Math.sin(angB)) / Math.sin(angC);
        const s = finalize({ a: sa, b: sb, c: sc, A: angA, B: angB, C: angC });
        if (s) solutions = [s];
        break;
      }
      case 'AAS': {
        // angles A, B and side a (opposite A)
        const angA = ang(A);
        const angB = ang(B);
        const sa = side(a);
        if (!Number.isFinite(angA) || !Number.isFinite(angB) || angA <= 0 || angB <= 0) {
          return { error: 'Enter valid positive angles A and B.' };
        }
        if (angA + angB >= Math.PI) {
          return { error: 'Angles A and B must sum to less than 180°.' };
        }
        if (!Number.isFinite(sa) || sa <= 0) {
          return { error: 'Enter side a (opposite angle A) as a positive number.' };
        }
        const angC = Math.PI - angA - angB;
        const sb = (sa * Math.sin(angB)) / Math.sin(angA);
        const sc = (sa * Math.sin(angC)) / Math.sin(angA);
        const s = finalize({ a: sa, b: sb, c: sc, A: angA, B: angB, C: angC });
        if (s) solutions = [s];
        break;
      }
      case 'SSA': {
        // sides a, b and angle A (opposite a) — ambiguous case
        const sa = side(a);
        const sb = side(b);
        const angA = ang(A);
        if (![sa, sb].every((x) => Number.isFinite(x) && x > 0)) {
          return { error: 'Enter sides a and b as positive numbers.' };
        }
        if (!Number.isFinite(angA) || angA <= 0 || angA >= Math.PI) {
          return { error: 'Angle A must be between 0 and 180°.' };
        }
        const sinB = (sb * Math.sin(angA)) / sa;
        if (sinB > 1 + 1e-9) {
          return { error: 'No triangle exists for these values (no solution).' };
        }
        const candidates: number[] = [];
        const b1 = Math.asin(Math.min(1, Math.max(-1, sinB)));
        candidates.push(b1);
        const b2 = Math.PI - b1;
        // The obtuse alternative is valid only if A + B2 < 180.
        if (Math.abs(b2 - b1) > 1e-9 && angA + b2 < Math.PI) {
          candidates.push(b2);
        }
        for (const angB of candidates) {
          const angC = Math.PI - angA - angB;
          if (angC <= 1e-9) continue;
          const sc = (sa * Math.sin(angC)) / Math.sin(angA);
          const s = finalize({ a: sa, b: sb, c: sc, A: angA, B: angB, C: angC });
          if (s) solutions.push(s);
        }
        if (solutions.length === 0) {
          return { error: 'No valid triangle exists for these values.' };
        }
        note = solutions.length === 2 ? 'Ambiguous case — two triangles satisfy the inputs.' : '';
        break;
      }
      default:
        return { error: 'Unknown mode.' };
    }

    if (solutions.length === 0) {
      return { error: 'No valid triangle could be solved from these inputs.' };
    }
    return { solutions, note };
  }, [mode, unit, a, b, c, A, B, C]);

  // Which fields are relevant for the current mode.
  const fields: { show: ('a' | 'b' | 'c' | 'A' | 'B' | 'C')[] } = {
    show:
      mode === 'SSS'
        ? ['a', 'b', 'c']
        : mode === 'SAS'
          ? ['a', 'b', 'C']
          : mode === 'ASA'
            ? ['A', 'B', 'c']
            : mode === 'AAS'
              ? ['A', 'B', 'a']
              : ['a', 'b', 'A'],
  };

  const fieldProps: Record<
    'a' | 'b' | 'c' | 'A' | 'B' | 'C',
    { label: string; value: string; set: (s: string) => void; isAngle: boolean }
  > = {
    a: { label: 'Side a', value: a, set: setA, isAngle: false },
    b: { label: 'Side b', value: b, set: setB, isAngle: false },
    c: { label: 'Side c', value: c, set: setC, isAngle: false },
    A: { label: `Angle A (${unit})`, value: A, set: setAA, isAngle: true },
    B: { label: `Angle B (${unit})`, value: B, set: setBB, isAngle: true },
    C: { label: `Angle C (${unit})`, value: C, set: setCC, isAngle: true },
  };

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Known parameters">
            <Select value={mode} onValueChange={(v) => setMode(v as ModeKey)}>
              <SelectTrigger className="w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MODE_LABELS) as ModeKey[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {MODE_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Angle unit">
            <Tabs value={unit} onValueChange={(v) => setUnit(v as Unit)}>
              <TabsList>
                <TabsTrigger value="deg">Degrees</TabsTrigger>
                <TabsTrigger value="rad">Radians</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {fields.show.map((key) => {
            const f = fieldProps[key];
            return (
              <Field key={key} label={f.label}>
                <Input
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  inputMode="decimal"
                  className="w-28 font-mono"
                />
              </Field>
            );
          })}
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          {result.note !== '' && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
              {result.note}
            </div>
          )}
          {result.solutions.map((sol, idx) => {
            const area = 0.5 * sol.a * sol.b * Math.sin(sol.C);
            const perimeter = sol.a + sol.b + sol.c;
            const sHalf = perimeter / 2;
            const inradius = area / sHalf;
            const circumradius = (sol.a * sol.b * sol.c) / (4 * area);
            const rows: { label: string; value: string }[] = [
              { label: 'Side a', value: num(sol.a) },
              { label: 'Side b', value: num(sol.b) },
              { label: 'Side c', value: num(sol.c) },
              { label: 'Angle A', value: fmtAngle(sol.A, unit) },
              { label: 'Angle B', value: fmtAngle(sol.B, unit) },
              { label: 'Angle C', value: fmtAngle(sol.C, unit) },
              { label: 'Area', value: num(area) },
              { label: 'Perimeter', value: num(perimeter) },
              { label: 'Inradius', value: num(inradius) },
              { label: 'Circumradius', value: num(circumradius) },
            ];
            return (
              <Panel key={idx}>
                <PanelHeader
                  title={result.solutions.length > 1 ? `Triangle ${idx + 1}` : 'Solved triangle'}
                >
                  <CopyButton value={() => rows.map((r) => `${r.label}: ${r.value}`).join('\n')} />
                </PanelHeader>
                <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
                  {rows.map((r) => (
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
                <StatBar items={[`Mode: ${mode}`, 'Laws of sines & cosines']} />
              </Panel>
            );
          })}
        </>
      )}
    </div>
  );
}
