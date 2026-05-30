'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type System = 'metric' | 'us' | 'imperial';

interface UnitDef {
  id: string;
  name: string;
  symbol: string;
  system: System;
  // Liters in one of this unit.
  liters: number;
}

const UNITS: UnitDef[] = [
  { id: 'ml', name: 'Milliliter', symbol: 'mL', system: 'metric', liters: 0.001 },
  { id: 'cc', name: 'Cubic centimeter', symbol: 'cm³', system: 'metric', liters: 0.001 },
  { id: 'l', name: 'Liter', symbol: 'L', system: 'metric', liters: 1 },
  { id: 'm3', name: 'Cubic meter', symbol: 'm³', system: 'metric', liters: 1000 },
  { id: 'in3', name: 'Cubic inch', symbol: 'in³', system: 'metric', liters: 0.016387064 },
  { id: 'ft3', name: 'Cubic foot', symbol: 'ft³', system: 'metric', liters: 28.316846592 },
  { id: 'usfloz', name: 'US fluid ounce', symbol: 'US fl oz', system: 'us', liters: 0.0295735295625 },
  { id: 'uscup', name: 'US cup', symbol: 'US cup', system: 'us', liters: 0.2365882365 },
  { id: 'uspt', name: 'US pint', symbol: 'US pt', system: 'us', liters: 0.473176473 },
  { id: 'usqt', name: 'US quart', symbol: 'US qt', system: 'us', liters: 0.946352946 },
  { id: 'usgal', name: 'US gallon', symbol: 'US gal', system: 'us', liters: 3.785411784 },
  { id: 'impfloz', name: 'Imperial fluid ounce', symbol: 'imp fl oz', system: 'imperial', liters: 0.0284130625 },
  { id: 'imppt', name: 'Imperial pint', symbol: 'imp pt', system: 'imperial', liters: 0.56826125 },
  { id: 'impgal', name: 'Imperial gallon', symbol: 'imp gal', system: 'imperial', liters: 4.54609 },
];

const UNIT_BY_ID: Record<string, UnitDef> = Object.fromEntries(UNITS.map((u) => [u.id, u]));

function format(n: number, precision: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs !== 0 && (abs < 1e-9 || abs >= 1e15)) return n.toExponential(precision);
  const factor = 10 ** precision;
  const rounded = Math.round(n * factor) / factor;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  const fixed = normalized.toFixed(precision);
  if (precision === 0) return fixed;
  return fixed.replace(/\.?0+$/, '');
}

export default function VolumeConverterTool() {
  const [raw, setRaw] = useState('1');
  const [from, setFrom] = useState<string>('usgal');
  const [precision, setPrecision] = useState(5);
  const [highlight, setHighlight] = useState(true);

  const parsed = useMemo(() => {
    const trimmed = raw.trim();
    if (trimmed === '') return { value: null as number | null, error: null as string | null };
    const value = Number(trimmed);
    if (!Number.isFinite(value)) return { value: null, error: 'Enter a valid number.' };
    if (value < 0) return { value: null, error: 'Volume cannot be negative.' };
    return { value, error: null };
  }, [raw]);

  const baseLiters = useMemo(() => {
    if (parsed.value === null) return null;
    const unit = UNIT_BY_ID[from];
    if (!unit) return null;
    return parsed.value * unit.liters;
  }, [parsed.value, from]);

  const results = useMemo(() => {
    if (baseLiters === null) return [];
    return UNITS.map((u) => ({ ...u, value: format(baseLiters / u.liters, precision) }));
  }, [baseLiters, precision]);

  const fromUnit = UNIT_BY_ID[from];

  const systemBg: Record<System, string> = {
    metric: 'border-sky-500/40 bg-sky-500/10',
    us: 'border-amber-500/40 bg-amber-500/10',
    imperial: 'border-emerald-500/40 bg-emerald-500/10',
  };

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
              placeholder="Enter a volume"
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
              max={9}
              step={1}
              value={[precision]}
              onValueChange={(v) => setPrecision(v[0] ?? 5)}
            />
          </Field>
          <Field label="System colors" hint="US vs Imperial">
            <Switch checked={highlight} onCheckedChange={setHighlight} />
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
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {results.map((r) => (
              <div
                key={r.id}
                className={cn(
                  'flex items-center justify-between rounded-md border px-3 py-2',
                  highlight ? systemBg[r.system] : 'bg-muted/30'
                )}
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
          <StatBar
            items={[
              fromUnit && `Input: ${parsed.value} ${fromUnit.symbol}`,
              baseLiters !== null && `Base: ${format(baseLiters, precision)} L`,
              highlight && 'Metric · US · Imperial',
            ]}
          />
        </Panel>
      ) : null}
    </div>
  );
}
