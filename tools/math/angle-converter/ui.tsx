'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Unit = 'deg' | 'rad' | 'grad' | 'turn' | 'arcmin' | 'arcsec';

const UNITS: { id: Unit; label: string; perRadian: number }[] = [
  { id: 'deg', label: 'Degrees (°)', perRadian: 180 / Math.PI },
  { id: 'rad', label: 'Radians (rad)', perRadian: 1 },
  { id: 'grad', label: 'Gradians (gon)', perRadian: 200 / Math.PI },
  { id: 'turn', label: 'Turns (rev)', perRadian: 1 / (2 * Math.PI) },
  { id: 'arcmin', label: 'Arcminutes (′)', perRadian: (180 / Math.PI) * 60 },
  { id: 'arcsec', label: 'Arcseconds (″)', perRadian: (180 / Math.PI) * 3600 },
];

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e-4 && abs < 1e12) {
    return Number(n.toFixed(8)).toString();
  }
  return n.toExponential(6);
}

export default function AngleConverterTool() {
  const [value, setValue] = useState('90');
  const [unit, setUnit] = useState<Unit>('deg');

  const radians = useMemo(() => {
    const v = Number(value);
    if (value.trim() === '' || !Number.isFinite(v)) return null;
    const src = UNITS.find((u) => u.id === unit) ?? UNITS[0]!;
    return v / src.perRadian;
  }, [value, unit]);

  return (
    <Panel>
      <PanelHeader title="Angle Converter" />
      <div className="space-y-4 p-4">
        <OptionsBar>
          <Field label="Value">
            <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="90" />
          </Field>
          <Field label="From unit">
            <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </OptionsBar>

        {radians === null ? (
          <ErrorBanner error="Enter a numeric angle value." />
        ) : (
          <div className="overflow-hidden rounded-md border">
            {UNITS.map((u, i) => {
              const out = fmt(radians * u.perRadian);
              return (
                <div
                  key={u.id}
                  className={
                    'flex items-center justify-between gap-3 px-4 py-2.5 ' +
                    (i % 2 ? 'bg-muted/30' : '')
                  }
                >
                  <span className="text-sm text-muted-foreground">{u.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm tabular-nums">{out}</span>
                    <CopyButton value={out} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}
