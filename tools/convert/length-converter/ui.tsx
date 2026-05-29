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
  // Number of meters in one of this unit.
  meters: number;
}

const UNITS: UnitDef[] = [
  { id: 'mm', name: 'Millimeter', symbol: 'mm', meters: 0.001 },
  { id: 'cm', name: 'Centimeter', symbol: 'cm', meters: 0.01 },
  { id: 'm', name: 'Meter', symbol: 'm', meters: 1 },
  { id: 'km', name: 'Kilometer', symbol: 'km', meters: 1000 },
  { id: 'in', name: 'Inch', symbol: 'in', meters: 0.0254 },
  { id: 'ft', name: 'Foot', symbol: 'ft', meters: 0.3048 },
  { id: 'yd', name: 'Yard', symbol: 'yd', meters: 0.9144 },
  { id: 'mi', name: 'Mile', symbol: 'mi', meters: 1609.344 },
  { id: 'nmi', name: 'Nautical mile', symbol: 'nmi', meters: 1852 },
];

const UNIT_BY_ID: Record<string, UnitDef> = Object.fromEntries(UNITS.map((u) => [u.id, u]));

function format(n: number, precision: number): string {
  if (!Number.isFinite(n)) return '—';
  const factor = 10 ** precision;
  const rounded = Math.round(n * factor) / factor;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  // Use a plain fixed representation; trim trailing zeros for readability.
  const fixed = normalized.toFixed(precision);
  if (precision === 0) return fixed;
  return fixed.replace(/\.?0+$/, '');
}

export default function LengthConverterTool() {
  const [raw, setRaw] = useState('1');
  const [from, setFrom] = useState<string>('m');
  const [precision, setPrecision] = useState(4);

  const parsed = useMemo(() => {
    const trimmed = raw.trim();
    if (trimmed === '') return { value: null as number | null, error: null as string | null };
    const value = Number(trimmed);
    if (!Number.isFinite(value)) {
      return { value: null, error: 'Enter a valid number.' };
    }
    return { value, error: null };
  }, [raw]);

  const meters = useMemo(() => {
    if (parsed.value === null) return null;
    const unit = UNIT_BY_ID[from];
    if (!unit) return null;
    return parsed.value * unit.meters;
  }, [parsed.value, from]);

  const results = useMemo(() => {
    if (meters === null) return [];
    return UNITS.map((u) => ({
      ...u,
      value: format(meters / u.meters, precision),
    }));
  }, [meters, precision]);

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
              placeholder="Enter a length"
            />
          </Field>
          <Field label="From unit" className="min-w-[11rem]">
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
          <Field
            label={`Precision: ${precision}`}
            hint="Decimal places"
            className="min-w-[10rem]"
          >
            <Slider
              min={0}
              max={10}
              step={1}
              value={[precision]}
              onValueChange={(v) => setPrecision(v[0] ?? 4)}
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
                  <CopyButton value={`${r.value} ${r.symbol}`} />
                </span>
              </div>
            ))}
          </div>
          <div className="pt-3">
            <StatBar
              items={[
                fromUnit && `Input: ${parsed.value} ${fromUnit.symbol}`,
                meters !== null && `Meters: ${format(meters, precision)} m`,
              ]}
            />
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
