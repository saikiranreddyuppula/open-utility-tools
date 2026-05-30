'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
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
  // Grams in one of this unit.
  grams: number;
}

// Base unit: grams.
const UNITS: UnitDef[] = [
  { id: 'mg', name: 'Milligram', symbol: 'mg', grams: 0.001 },
  { id: 'g', name: 'Gram', symbol: 'g', grams: 1 },
  { id: 'kg', name: 'Kilogram', symbol: 'kg', grams: 1000 },
  { id: 't', name: 'Metric tonne', symbol: 't', grams: 1_000_000 },
  { id: 'carat', name: 'Carat', symbol: 'ct', grams: 0.2 },
  { id: 'grain', name: 'Grain', symbol: 'gr', grams: 0.06479891 },
  { id: 'oz', name: 'Ounce', symbol: 'oz', grams: 28.349523125 },
  { id: 'lb', name: 'Pound', symbol: 'lb', grams: 453.59237 },
  { id: 'stone', name: 'Stone', symbol: 'st', grams: 6350.29318 },
  { id: 'uston', name: 'US ton (short)', symbol: 'ton (US)', grams: 907184.74 },
  { id: 'longton', name: 'Imperial ton (long)', symbol: 'ton (UK)', grams: 1016046.9088 },
];

const UNIT_BY_ID: Record<string, UnitDef> = Object.fromEntries(UNITS.map((u) => [u.id, u]));

function format(n: number, precision: number, sep: boolean): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const factor = 10 ** precision;
  const rounded = Math.round(n * factor) / factor;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  const fixed = normalized.toFixed(precision);
  const trimmed = precision === 0 ? fixed : fixed.replace(/\.?0+$/, '');
  if (!sep) return trimmed;
  const parts = trimmed.split('.');
  const intPart = parts[0] ?? '0';
  const sign = intPart.startsWith('-') ? '-' : '';
  const digits = sign ? intPart.slice(1) : intPart;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const frac = parts[1];
  return frac !== undefined ? `${sign}${grouped}.${frac}` : `${sign}${grouped}`;
}

export default function MassWeightConverterTool() {
  const [raw, setRaw] = useState('1');
  const [from, setFrom] = useState<string>('kg');
  const [precision, setPrecision] = useState(4);
  const [sep, setSep] = useState(true);

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
    return parsed.value * unit.grams;
  }, [parsed.value, from]);

  const results = useMemo(() => {
    if (baseValue === null) return [];
    return UNITS.map((u) => ({
      ...u,
      value: format(baseValue / u.grams, precision, sep),
    }));
  }, [baseValue, precision, sep]);

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
              placeholder="Enter a mass"
            />
          </Field>
          <Field label="From unit" className="min-w-[16rem]">
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
              max={8}
              step={1}
              value={[precision]}
              onValueChange={(v) => setPrecision(v[0] ?? 4)}
            />
          </Field>
          <Field label="Thousands separator">
            <Switch checked={sep} onCheckedChange={setSep} />
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
                baseValue !== null && `Base: ${format(baseValue, precision, sep)} g`,
              ]}
            />
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
