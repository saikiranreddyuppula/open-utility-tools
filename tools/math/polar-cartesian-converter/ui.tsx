'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Dir = 'toPolar' | 'toCartesian';
type Unit = 'deg' | 'rad';

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

// Normalize a radian angle into [0, 2π).
function normRad(a: number): number {
  const twoPi = 2 * Math.PI;
  let v = a % twoPi;
  if (v < 0) v += twoPi;
  return v;
}

function quadrant(x: number, y: number): string {
  if (x === 0 && y === 0) return 'Origin';
  if (x > 0 && y === 0) return 'Positive x-axis';
  if (x < 0 && y === 0) return 'Negative x-axis';
  if (x === 0 && y > 0) return 'Positive y-axis';
  if (x === 0 && y < 0) return 'Negative y-axis';
  if (x > 0 && y > 0) return 'Quadrant I';
  if (x < 0 && y > 0) return 'Quadrant II';
  if (x < 0 && y < 0) return 'Quadrant III';
  return 'Quadrant IV';
}

export default function PolarCartesianConverter() {
  const [dir, setDir] = useState<Dir>('toPolar');
  const [unit, setUnit] = useState<Unit>('deg');
  // For toPolar: x,y. For toCartesian: r, angle.
  const [a, setA] = useState('3');
  const [b, setB] = useState('4');

  const result = useMemo(() => {
    const va = Number(a.trim());
    const vb = Number(b.trim());
    if (a.trim() === '' || b.trim() === '' || !Number.isFinite(va) || !Number.isFinite(vb)) {
      return { error: 'Enter two valid numbers.' };
    }

    if (dir === 'toPolar') {
      const x = va;
      const y = vb;
      const r = Math.sqrt(x * x + y * y);
      const thetaRad = normRad(Math.atan2(y, x));
      const thetaDeg = (thetaRad * 180) / Math.PI;
      return {
        rows: [
          { label: 'r (radius)', value: fmt(r) },
          { label: 'θ (degrees)', value: `${fmt(thetaDeg)}°` },
          { label: 'θ (radians)', value: fmt(thetaRad) },
          { label: 'Quadrant', value: quadrant(x, y) },
        ],
        copy: `r = ${fmt(r)}\nθ = ${fmt(thetaDeg)}° = ${fmt(thetaRad)} rad\nQuadrant: ${quadrant(x, y)}`,
      };
    }

    // toCartesian: a = r, b = angle in current unit.
    const r = va;
    if (r < 0) return { error: 'Radius r must be non-negative.' };
    const angleRad = unit === 'deg' ? (vb * Math.PI) / 180 : vb;
    const x = r * Math.cos(angleRad);
    const y = r * Math.sin(angleRad);
    return {
      rows: [
        { label: 'x', value: fmt(x) },
        { label: 'y', value: fmt(y) },
        { label: 'Point', value: `(${fmt(x)}, ${fmt(y)})` },
        { label: 'Quadrant', value: quadrant(x, y) },
      ],
      copy: `x = ${fmt(x)}\ny = ${fmt(y)}\n(${fmt(x)}, ${fmt(y)})\nQuadrant: ${quadrant(x, y)}`,
    };
  }, [dir, unit, a, b]);

  const labelA = dir === 'toPolar' ? 'x' : 'r (radius)';
  const labelB =
    dir === 'toPolar' ? 'y' : `θ angle (${unit === 'deg' ? 'degrees' : 'radians'})`;

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Direction">
            <Tabs value={dir} onValueChange={(v) => setDir(v as Dir)}>
              <TabsList>
                <TabsTrigger value="toPolar">Cartesian → Polar</TabsTrigger>
                <TabsTrigger value="toCartesian">Polar → Cartesian</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Angle unit">
            <Tabs value={unit} onValueChange={(v) => setUnit(v as Unit)}>
              <TabsList>
                <TabsTrigger value="deg">Degrees</TabsTrigger>
                <TabsTrigger value="rad">Radians</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label={labelA}>
            <Input
              value={a}
              onChange={(e) => setA(e.target.value)}
              inputMode="decimal"
              className="w-28 font-mono"
            />
          </Field>
          <Field label={labelB}>
            <Input
              value={b}
              onChange={(e) => setB(e.target.value)}
              inputMode="decimal"
              className="w-32 font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Converted coordinates">
            <CopyButton value={() => result.copy} />
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
          <StatBar
            items={[
              dir === 'toPolar' ? 'Cartesian → Polar' : 'Polar → Cartesian',
              `θ normalized to [0, ${unit === 'deg' ? '360°' : '2π'})`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
