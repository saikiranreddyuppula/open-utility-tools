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
  // Cubic meters per second in one of this unit.
  base: number;
}

// Base unit: cubic meter per second.
const UNITS: UnitDef[] = [
  { id: 'm3s', name: 'Cubic meter per second', symbol: 'm³/s', base: 1 },
  { id: 'm3h', name: 'Cubic meter per hour', symbol: 'm³/h', base: 1 / 3600 },
  { id: 'ls', name: 'Liter per second', symbol: 'L/s', base: 1e-3 },
  { id: 'lmin', name: 'Liter per minute', symbol: 'L/min', base: 1e-3 / 60 },
  { id: 'lh', name: 'Liter per hour', symbol: 'L/h', base: 1e-3 / 3600 },
  { id: 'gpm', name: 'US gallon per minute', symbol: 'GPM', base: 6.30902e-5 },
  { id: 'gph', name: 'US gallon per hour', symbol: 'GPH', base: 6.30902e-5 / 60 },
  { id: 'igpm', name: 'Imperial gallon per minute', symbol: 'gpm (imp)', base: 7.57682e-5 },
  { id: 'cfm', name: 'Cubic foot per minute', symbol: 'CFM', base: 4.71947e-4 },
  { id: 'cfs', name: 'Cubic foot per second', symbol: 'ft³/s', base: 4.71947e-4 * 60 },
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

export default function FlowRateConverterTool() {
  const [raw, setRaw] = useState('1');
  const [from, setFrom] = useState<string>('ls');
  const [precision, setPrecision] = useState(6);
  const [sci, setSci] = useState(false);

  const parsed = useMemo(() => {
    const trimmed = raw.trim();
    if (trimmed === '') return { value: null as number | null, error: null as string | null };
    const value = Number(trimmed);
    if (!Number.isFinite(value)) return { value: null, error: 'Enter a valid number.' };
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
    return UNITS.map((u) => ({ ...u, value: format(baseValue / u.base, precision, sci) }));
  }, [baseValue, precision, sci]);

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
              placeholder="Enter a flow rate"
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
              max={10}
              step={1}
              value={[precision]}
              onValueChange={(v) => setPrecision(v[0] ?? 6)}
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
              baseValue !== null && `Base: ${format(baseValue, precision, sci)} m³/s`,
            ]}
          />
        </Panel>
      ) : null}
    </div>
  );
}
