'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Unit = 'ms' | 's' | 'min' | 'h' | 'd' | 'wk';

const UNITS: { id: Unit; label: string; seconds: number }[] = [
  { id: 'ms', label: 'Milliseconds', seconds: 0.001 },
  { id: 's', label: 'Seconds', seconds: 1 },
  { id: 'min', label: 'Minutes', seconds: 60 },
  { id: 'h', label: 'Hours', seconds: 3600 },
  { id: 'd', label: 'Days', seconds: 86400 },
  { id: 'wk', label: 'Weeks', seconds: 604800 },
];

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e-4 && abs < 1e15) {
    return Number(n.toFixed(6)).toLocaleString('en-US', { maximumFractionDigits: 6 });
  }
  return n.toExponential(6);
}

export default function DurationConverterTool() {
  const [value, setValue] = useState('90');
  const [unit, setUnit] = useState<Unit>('min');

  const seconds = useMemo(() => {
    const v = Number(value);
    if (value.trim() === '' || !Number.isFinite(v)) return null;
    const src = UNITS.find((u) => u.id === unit) ?? UNITS[1]!;
    return v * src.seconds;
  }, [value, unit]);

  return (
    <Panel>
      <PanelHeader title="Time Duration Converter" />
      <div className="space-y-4 p-4">
        <OptionsBar>
          <Field label="Value">
            <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="90" />
          </Field>
          <Field label="From unit">
            <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
              <SelectTrigger className="w-44">
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

        {seconds === null ? (
          <ErrorBanner error="Enter a numeric duration value." />
        ) : (
          <div className="overflow-hidden rounded-md border">
            {UNITS.map((u, i) => {
              const out = fmt(seconds / u.seconds);
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
