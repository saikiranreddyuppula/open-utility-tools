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
  // Becquerels (decays per second) in one of this unit.
  base: number;
}

// Base unit: becquerel (one decay per second).
const UNITS: UnitDef[] = [
  { id: 'bq', name: 'Becquerel', symbol: 'Bq', base: 1 },
  { id: 'kbq', name: 'Kilobecquerel', symbol: 'kBq', base: 1e3 },
  { id: 'mbq', name: 'Megabecquerel', symbol: 'MBq', base: 1e6 },
  { id: 'gbq', name: 'Gigabecquerel', symbol: 'GBq', base: 1e9 },
  { id: 'ci', name: 'Curie', symbol: 'Ci', base: 3.7e10 },
  { id: 'mci', name: 'Millicurie', symbol: 'mCi', base: 3.7e7 },
  { id: 'uci', name: 'Microcurie', symbol: 'µCi', base: 3.7e4 },
  { id: 'rd', name: 'Rutherford', symbol: 'Rd', base: 1e6 },
  { id: 'dpm', name: 'Disintegrations per minute', symbol: 'dpm', base: 1 / 60 },
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

export default function RadioactivityConverterTool() {
  const [raw, setRaw] = useState('1');
  const [from, setFrom] = useState<string>('ci');
  const [precision, setPrecision] = useState(4);
  const [sci, setSci] = useState(true);

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
      value: format(baseValue / u.base, precision, sci),
    }));
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
              placeholder="Enter an activity"
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
          <Field label="Scientific notation">
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
                baseValue !== null && `Base: ${format(baseValue, precision, sci)} Bq`,
              ]}
            />
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
