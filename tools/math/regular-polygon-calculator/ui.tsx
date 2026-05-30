'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Known = 'side' | 'circumradius' | 'apothem';

const KNOWN_LABELS: Record<Known, string> = {
  side: 'Side length (s)',
  circumradius: 'Circumradius (R)',
  apothem: 'Apothem (a)',
};

function num(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export default function RegularPolygonCalculatorTool() {
  const [sides, setSides] = useState('6');
  const [known, setKnown] = useState<Known>('side');
  const [value, setValue] = useState('10');

  const result = useMemo(() => {
    const n = Number(sides);
    const x = Number(value);

    if (!Number.isFinite(n)) return { error: 'Enter a valid number of sides.' };
    if (!Number.isInteger(n) || n < 3) {
      return { error: 'A polygon needs at least 3 whole sides.' };
    }
    if (n > 100000) return { error: 'Keep the number of sides under 100,000.' };
    if (!Number.isFinite(x) || x <= 0) {
      return { error: 'Enter a value greater than zero.' };
    }

    const piN = Math.PI / n;

    // Derive the side length s from whichever dimension is known.
    let s: number;
    switch (known) {
      case 'side':
        s = x;
        break;
      case 'circumradius':
        s = 2 * x * Math.sin(piN);
        break;
      case 'apothem':
        s = 2 * x * Math.tan(piN);
        break;
      default:
        return { error: 'Unknown input type.' };
    }

    const apothem = s / (2 * Math.tan(piN));
    const circumradius = s / (2 * Math.sin(piN));
    const perimeter = n * s;
    const area = 0.5 * perimeter * apothem;
    const interiorAngle = ((n - 2) * 180) / n;
    const exteriorAngle = 360 / n;

    const rows: { label: string; value: string }[] = [
      { label: 'Area', value: num(area) },
      { label: 'Perimeter', value: num(perimeter) },
      { label: 'Side length (s)', value: num(s) },
      { label: 'Apothem (a)', value: num(apothem) },
      { label: 'Circumradius (R)', value: num(circumradius) },
      { label: 'Interior angle', value: `${num(interiorAngle)}°` },
      { label: 'Exterior angle', value: `${num(exteriorAngle)}°` },
      { label: 'Sum of interior angles', value: `${num((n - 2) * 180)}°` },
    ];

    return { rows, n };
  }, [sides, known, value]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Number of sides (n)">
            <Input
              value={sides}
              onChange={(e) => setSides(e.target.value)}
              inputMode="numeric"
              className="w-24 font-mono"
            />
          </Field>
          <Field label="Known dimension">
            <Select value={known} onValueChange={(v) => setKnown(v as Known)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(KNOWN_LABELS) as Known[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {KNOWN_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Value">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode="decimal"
              className="w-28 font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title={`Regular ${result.n}-gon`}>
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
          <StatBar items={[`Sides: ${result.n}`, `Known: ${KNOWN_LABELS[known]}`]} />
        </Panel>
      )}
    </div>
  );
}
