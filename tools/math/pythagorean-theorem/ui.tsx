'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

// Parse: blank => unknown (null); else a positive finite number.
function parseSide(s: string): { unknown: boolean; value: number; bad: boolean } {
  const t = s.trim();
  if (t === '') return { unknown: true, value: NaN, bad: false };
  const v = Number(t);
  if (!Number.isFinite(v) || v <= 0) return { unknown: false, value: NaN, bad: true };
  return { unknown: false, value: v, bad: false };
}

function isPerfectSquare(n: number): boolean {
  if (n <= 0) return false;
  const r = Math.round(Math.sqrt(n));
  return r * r === n;
}

export default function PythagoreanTheorem() {
  // Leg a, leg b, hypotenuse c. Leave the unknown blank.
  const [a, setA] = useState('3');
  const [b, setB] = useState('4');
  const [c, setC] = useState('');

  const result = useMemo(() => {
    const pa = parseSide(a);
    const pb = parseSide(b);
    const pc = parseSide(c);

    if (pa.bad || pb.bad || pc.bad) {
      return { error: 'Sides must be positive numbers. Leave exactly one blank for the unknown.' };
    }
    const unknowns = [pa.unknown, pb.unknown, pc.unknown].filter(Boolean).length;
    if (unknowns !== 1) {
      return { error: 'Leave exactly one of a, b, c blank to mark the unknown side.' };
    }

    let av = pa.value;
    let bv = pb.value;
    let cv = pc.value;
    let solvedLabel: string;

    if (pc.unknown) {
      cv = Math.sqrt(av * av + bv * bv);
      solvedLabel = 'c (hypotenuse)';
    } else if (pa.unknown) {
      if (cv <= bv) return { error: 'The hypotenuse c must be larger than leg b.' };
      av = Math.sqrt(cv * cv - bv * bv);
      solvedLabel = 'a (leg)';
    } else {
      // pb unknown
      if (cv <= av) return { error: 'The hypotenuse c must be larger than leg a.' };
      bv = Math.sqrt(cv * cv - av * av);
      solvedLabel = 'b (leg)';
    }

    // Angles (degrees): angle opposite a, opposite b; right angle = 90.
    const angleA = (Math.atan2(av, bv) * 180) / Math.PI; // opposite leg a
    const angleB = (Math.atan2(bv, av) * 180) / Math.PI; // opposite leg b
    const area = (av * bv) / 2;
    const perimeter = av + bv + cv;

    // Exact form when c² is a perfect square (only when solving for c with integer legs).
    let exact: string | null = null;
    if (pc.unknown && Number.isInteger(av) && Number.isInteger(bv)) {
      const c2 = av * av + bv * bv;
      if (isPerfectSquare(c2)) {
        exact = `c = √(${av}² + ${bv}²) = √${c2} = ${Math.round(Math.sqrt(c2))}`;
      } else {
        exact = `c = √(${av}² + ${bv}²) = √${c2}`;
      }
    }

    return {
      solvedLabel,
      a: av,
      b: bv,
      c: cv,
      angleA,
      angleB,
      area,
      perimeter,
      exact,
    };
  }, [a, b, c]);

  if ('error' in result) {
    return (
      <div className="space-y-4">
        <Panel>
          <OptionsBar>
            <Field label="Leg a">
              <Input value={a} onChange={(e) => setA(e.target.value)} inputMode="decimal" className="w-24 font-mono" placeholder="leg" />
            </Field>
            <Field label="Leg b">
              <Input value={b} onChange={(e) => setB(e.target.value)} inputMode="decimal" className="w-24 font-mono" placeholder="leg" />
            </Field>
            <Field label="Hypotenuse c">
              <Input value={c} onChange={(e) => setC(e.target.value)} inputMode="decimal" className="w-24 font-mono" placeholder="leave blank" />
            </Field>
          </OptionsBar>
        </Panel>
        <ErrorBanner error={result.error} />
      </div>
    );
  }

  const rows = [
    { label: `Missing side: ${result.solvedLabel}`, value: fmt(
      result.solvedLabel.startsWith('c') ? result.c : result.solvedLabel.startsWith('a') ? result.a : result.b,
    ) },
    { label: 'Leg a', value: fmt(result.a) },
    { label: 'Leg b', value: fmt(result.b) },
    { label: 'Hypotenuse c', value: fmt(result.c) },
    { label: 'Angle opposite a', value: `${fmt(result.angleA)}°` },
    { label: 'Angle opposite b', value: `${fmt(result.angleB)}°` },
    { label: 'Right angle', value: '90°' },
    { label: 'Area', value: fmt(result.area) },
    { label: 'Perimeter', value: fmt(result.perimeter) },
  ];

  const copy = rows.map((r) => `${r.label}: ${r.value}`).join('\n');

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Leg a">
            <Input value={a} onChange={(e) => setA(e.target.value)} inputMode="decimal" className="w-24 font-mono" placeholder="leg" />
          </Field>
          <Field label="Leg b">
            <Input value={b} onChange={(e) => setB(e.target.value)} inputMode="decimal" className="w-24 font-mono" placeholder="leg" />
          </Field>
          <Field label="Hypotenuse c">
            <Input value={c} onChange={(e) => setC(e.target.value)} inputMode="decimal" className="w-24 font-mono" placeholder="leave blank" />
          </Field>
        </OptionsBar>
      </Panel>
      <p className="px-1 text-xs text-muted-foreground">
        a² + b² = c². Leave exactly one of a, b, c blank to solve for it.
      </p>

      <Panel>
        <PanelHeader title="Right triangle">
          <CopyButton value={() => copy} />
        </PanelHeader>
        {result.exact && (
          <div className="mx-3 mt-3 rounded-md border bg-muted/30 px-3 py-2 font-mono text-sm">
            {result.exact}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
          {rows.map((row) => (
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
        <StatBar
          items={[`Solved for ${result.solvedLabel}`, `c = ${fmt(result.c)}`]}
        />
      </Panel>
    </div>
  );
}
