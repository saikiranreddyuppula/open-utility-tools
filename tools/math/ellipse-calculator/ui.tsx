'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

function fmt(n: number): string {
  return Number(n.toFixed(6)).toString();
}

type Result =
  | { error: string }
  | { rows: { label: string; value: string }[] };

export default function EllipseCalculator() {
  const [aStr, setAStr] = useState('5');
  const [bStr, setBStr] = useState('3');

  const result = useMemo<Result>(() => {
    const a0 = Number(aStr);
    const b0 = Number(bStr);
    if (!Number.isFinite(a0) || !Number.isFinite(b0)) return { error: 'Enter valid numbers for both axes.' };
    if (a0 <= 0 || b0 <= 0) return { error: 'Both semi-axes must be positive.' };

    // Treat the larger value as the semi-major axis (a), smaller as semi-minor (b).
    const a = Math.max(a0, b0);
    const b = Math.min(a0, b0);
    const majorIsX = a0 >= b0;

    const area = Math.PI * a * b;
    const perimeter = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
    const eccentricity = Math.sqrt(1 - (b * b) / (a * a));
    const c = Math.sqrt(a * a - b * b);

    const foci = majorIsX
      ? `(±${fmt(c)}, 0)`
      : `(0, ±${fmt(c)})`;

    return {
      rows: [
        { label: 'Semi-major axis a', value: fmt(a) },
        { label: 'Semi-minor axis b', value: fmt(b) },
        { label: 'Area (π·a·b)', value: fmt(area) },
        { label: 'Perimeter (Ramanujan ≈)', value: fmt(perimeter) },
        { label: 'Eccentricity e', value: fmt(eccentricity) },
        { label: 'Focal distance c', value: fmt(c) },
        { label: 'Foci (center at origin)', value: foci },
      ],
    };
  }, [aStr, bStr]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Axis a">
            <Input value={aStr} onChange={(e) => setAStr(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Axis b">
            <Input value={bStr} onChange={(e) => setBStr(e.target.value)} inputMode="decimal" />
          </Field>
        </OptionsBar>
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
          <StatBar items={['Perimeter uses Ramanujan approximation', 'Larger axis taken as semi-major']} />
        </Panel>
      )}
    </div>
  );
}
