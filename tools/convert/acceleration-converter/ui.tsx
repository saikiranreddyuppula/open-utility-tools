'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface UnitDef {
  id: string;
  name: string;
  symbol: string;
  // Number of m/s^2 in one of this unit.
  base: number;
}

// Base unit: meters per second squared.
const UNITS: UnitDef[] = [
  { id: 'mps2', name: 'Meter per second²', symbol: 'm/s²', base: 1 },
  { id: 'g', name: 'Standard gravity', symbol: 'g', base: 9.80665 },
  { id: 'fps2', name: 'Foot per second²', symbol: 'ft/s²', base: 0.3048 },
  { id: 'ips2', name: 'Inch per second²', symbol: 'in/s²', base: 0.0254 },
  { id: 'gal', name: 'Gal (galileo)', symbol: 'Gal', base: 0.01 },
  { id: 'mgal', name: 'Milligal', symbol: 'mGal', base: 0.00001 },
  { id: 'kphs', name: 'km/h per second', symbol: 'km/h·s', base: 0.277778 },
  { id: 'mphs', name: 'mph per second', symbol: 'mph·s', base: 0.44704 },
];

const UNIT_BY_ID: Record<string, UnitDef> = Object.fromEntries(UNITS.map((u) => [u.id, u]));

function format(n: number, precision: number): string {
  if (!Number.isFinite(n)) return '—';
  const factor = 10 ** precision;
  const rounded = Math.round(n * factor) / factor;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  const fixed = normalized.toFixed(precision);
  if (precision === 0) return fixed;
  return fixed.replace(/\.?0+$/, '');
}

export default function AccelerationConverterTool() {
  const [raw, setRaw] = useState('1');
  const [from, setFrom] = useState<string>('g');
  const [precision, setPrecision] = useState(6);

  const parsed = useMemo(() => {
    const trimmed = raw.trim();
    if (trimmed === '') return { value: null as number | null, error: null as string | null };
    const value = Number(trimmed);
    if (!Number.isFinite(value)) {
      return { value: null, error: 'Enter a valid number.' };
    }
    return { value, error: null };
  }, [raw]);

  const baseValue = useMemo(() => {
    if (parsed.value === null) return null;
    const unit = UNIT_BY_ID[from];
    if (!unit) return null;
    return parsed.value * unit.base;
  }, [parsed.value, from]);

  const results = useMemo(() => {
    if (baseValue === null) return [];
    return UNITS.map((u) => ({
      ...u,
      value: format(baseValue / u.base, precision),
    }));
  }, [baseValue, precision]);

  const fromUnit = UNIT_BY_ID[from];

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Value" className="min-w-[12rem] flex-1">
            <Input
              type="text"
              inputMode="decimal"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="Enter an acceleration"
            />
          </Field>
          <Field label="From unit" className="min-w-[14rem]">
            <Select value={from} onValueChange={(v) => setFrom(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={`Precision: ${precision}`} hint="Decimal places" className="min-w-[10rem]">
            <Slider
              min={0}
              max={10}
              step={1}
              value={[precision]}
              onValueChange={(v) => setPrecision(v[0] ?? 6)}
            />
          </Field>
        </OptionsBar>
      </Panel>

      <ErrorBanner error={parsed.error} />

      {results.length > 0 ? (
        <Panel>
          <PanelHeader title="Results">
            <CopyButton
              value={() => results.map((r) => `${r.name}: ${r.value} ${r.symbol}`).join('\n')}
            />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 pt-3 sm:grid-cols-2">
            {results.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="text-sm text-muted-foreground">
                  {r.name} ({r.symbol})
                </span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span>{r.value}</span>
                  <CopyButton value={`${r.value} ${r.symbol}`} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <div className="pt-3">
            <StatBar
              items={[
                fromUnit && `Input: ${parsed.value} ${fromUnit.symbol}`,
                baseValue !== null && `Base: ${format(baseValue, precision)} m/s²`,
              ]}
            />
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
