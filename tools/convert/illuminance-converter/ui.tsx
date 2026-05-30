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
  // Lux in one of this unit.
  lux: number;
}

// Base unit: lux (lumen per square meter).
const UNITS: UnitDef[] = [
  { id: 'lx', name: 'Lux', symbol: 'lx', lux: 1 },
  { id: 'klx', name: 'Kilolux', symbol: 'klx', lux: 1000 },
  { id: 'fc', name: 'Foot-candle', symbol: 'fc', lux: 10.763910417 },
  { id: 'phot', name: 'Phot', symbol: 'ph', lux: 10000 },
  { id: 'nox', name: 'Nox', symbol: 'nox', lux: 0.001 },
  { id: 'lmin2', name: 'Lumen per square inch', symbol: 'lm/in²', lux: 1550.0031 },
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

export default function IlluminanceConverterTool() {
  const [raw, setRaw] = useState('500');
  const [from, setFrom] = useState<string>('lx');
  const [precision, setPrecision] = useState(6);
  const [sci, setSci] = useState(false);

  const parsed = useMemo(() => {
    const trimmed = raw.trim();
    if (trimmed === '') return { value: null as number | null, error: null as string | null };
    const value = Number(trimmed);
    if (!Number.isFinite(value)) return { value: null, error: 'Enter a valid number.' };
    if (value < 0) return { value: null, error: 'Illuminance cannot be negative.' };
    return { value, error: null };
  }, [raw]);

  const baseLux = useMemo(() => {
    if (parsed.value === null) return null;
    const unit = UNIT_BY_ID[from];
    if (!unit) return null;
    return parsed.value * unit.lux;
  }, [parsed.value, from]);

  const results = useMemo(() => {
    if (baseLux === null) return [];
    return UNITS.map((u) => ({ ...u, value: format(baseLux / u.lux, precision, sci) }));
  }, [baseLux, precision, sci]);

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
              placeholder="Enter an illuminance"
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
              baseLux !== null && `Base: ${format(baseLux, precision, sci)} lx`,
            ]}
          />
        </Panel>
      ) : null}
    </div>
  );
}
