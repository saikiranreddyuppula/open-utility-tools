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
  // Square meters in one of this unit.
  m2: number;
}

const UNITS: UnitDef[] = [
  { id: 'mm2', name: 'Square millimeter', symbol: 'mm²', m2: 1e-6 },
  { id: 'cm2', name: 'Square centimeter', symbol: 'cm²', m2: 1e-4 },
  { id: 'm2', name: 'Square meter', symbol: 'm²', m2: 1 },
  { id: 'are', name: 'Are', symbol: 'a', m2: 100 },
  { id: 'ha', name: 'Hectare', symbol: 'ha', m2: 10000 },
  { id: 'km2', name: 'Square kilometer', symbol: 'km²', m2: 1e6 },
  { id: 'in2', name: 'Square inch', symbol: 'in²', m2: 0.00064516 },
  { id: 'ft2', name: 'Square foot', symbol: 'ft²', m2: 0.09290304 },
  { id: 'yd2', name: 'Square yard', symbol: 'yd²', m2: 0.83612736 },
  { id: 'acre', name: 'Acre', symbol: 'ac', m2: 4046.8564224 },
  { id: 'mi2', name: 'Square mile', symbol: 'mi²', m2: 2589988.110336 },
];

const UNIT_BY_ID: Record<string, UnitDef> = Object.fromEntries(UNITS.map((u) => [u.id, u]));

function format(n: number, precision: number, sci: boolean): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  if (sci) return n.toExponential(precision);
  const factor = 10 ** precision;
  const rounded = Math.round(n * factor) / factor;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  const fixed = normalized.toFixed(precision);
  if (precision === 0) return fixed;
  return fixed.replace(/\.?0+$/, '');
}

export default function AreaConverterTool() {
  const [raw, setRaw] = useState('1');
  const [from, setFrom] = useState<string>('ha');
  const [precision, setPrecision] = useState(4);
  const [sci, setSci] = useState(false);

  const parsed = useMemo(() => {
    const trimmed = raw.trim();
    if (trimmed === '') return { value: null as number | null, error: null as string | null };
    const value = Number(trimmed);
    if (!Number.isFinite(value)) return { value: null, error: 'Enter a valid number.' };
    if (value < 0) return { value: null, error: 'Area cannot be negative.' };
    return { value, error: null };
  }, [raw]);

  const baseM2 = useMemo(() => {
    if (parsed.value === null) return null;
    const unit = UNIT_BY_ID[from];
    if (!unit) return null;
    return parsed.value * unit.m2;
  }, [parsed.value, from]);

  const results = useMemo(() => {
    if (baseM2 === null) return [];
    return UNITS.map((u) => ({ ...u, value: format(baseM2 / u.m2, precision, sci) }));
  }, [baseM2, precision, sci]);

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
              placeholder="Enter an area"
            />
          </Field>
          <Field label="From unit" className="min-w-[12rem]">
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
          <Field label="Scientific" hint="Exponential notation">
            <Switch checked={sci} onCheckedChange={setSci} />
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
          <StatBar
            items={[
              fromUnit && `Input: ${parsed.value} ${fromUnit.symbol}`,
              baseM2 !== null && `Base: ${format(baseM2, precision, sci)} m²`,
            ]}
          />
        </Panel>
      ) : null}
    </div>
  );
}
