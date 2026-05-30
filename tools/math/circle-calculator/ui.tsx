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

type Known = 'radius' | 'diameter' | 'circumference' | 'area';

const KNOWN_LABELS: Record<Known, string> = {
  radius: 'Radius (r)',
  diameter: 'Diameter (d)',
  circumference: 'Circumference (C)',
  area: 'Area (A)',
};

function num(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export default function CircleCalculatorTool() {
  const [known, setKnown] = useState<Known>('radius');
  const [value, setValue] = useState('5');
  const [angle, setAngle] = useState('90');

  const result = useMemo(() => {
    const x = Number(value);
    if (!Number.isFinite(x)) return { error: 'Enter a valid number for the known value.' };
    if (x <= 0) return { error: 'The value must be greater than zero.' };

    let r: number;
    switch (known) {
      case 'radius':
        r = x;
        break;
      case 'diameter':
        r = x / 2;
        break;
      case 'circumference':
        r = x / (2 * Math.PI);
        break;
      case 'area':
        r = Math.sqrt(x / Math.PI);
        break;
      default:
        return { error: 'Unknown input type.' };
    }

    const diameter = 2 * r;
    const circumference = 2 * Math.PI * r;
    const area = Math.PI * r * r;

    const rows: { label: string; value: string }[] = [
      { label: 'Radius (r)', value: num(r) },
      { label: 'Diameter (d)', value: num(diameter) },
      { label: 'Circumference (C)', value: num(circumference) },
      { label: 'Area (A)', value: num(area) },
    ];

    // Arc / sector / chord when an angle is supplied.
    const deg = Number(angle);
    let arcRows: { label: string; value: string }[] = [];
    if (angle.trim() !== '' && Number.isFinite(deg) && deg > 0) {
      const clamped = Math.min(deg, 360);
      const rad = (clamped * Math.PI) / 180;
      const arcLength = r * rad;
      const sectorArea = 0.5 * r * r * rad;
      const chord = 2 * r * Math.sin(rad / 2);
      arcRows = [
        { label: `Arc length (θ=${clamped}°)`, value: num(arcLength) },
        { label: 'Sector area', value: num(sectorArea) },
        { label: 'Chord length', value: num(chord) },
      ];
    }

    return { rows, arcRows };
  }, [known, value, angle]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Known value">
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
              className="w-32 font-mono"
            />
          </Field>
          <Field label="Central angle (° — optional)">
            <Input
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              inputMode="decimal"
              className="w-32 font-mono"
              placeholder="e.g. 90"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="Circle properties">
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
            <StatBar items={[`Known: ${KNOWN_LABELS[known]}`, 'π = Math.PI']} />
          </Panel>

          {result.arcRows.length > 0 && (
            <Panel>
              <PanelHeader title="Arc, sector & chord">
                <CopyButton
                  value={() => result.arcRows.map((r) => `${r.label}: ${r.value}`).join('\n')}
                />
              </PanelHeader>
              <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
                {result.arcRows.map((r) => (
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
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
