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
  // Meters in one of this unit.
  m: number;
}

const LIGHT_SEC = 299792458; // meters light travels per second
const AU = 1.495978707e11;
const LY = 9.4607304725808e15;
const PC = 3.0856775814913673e16;

const UNITS: UnitDef[] = [
  { id: 'km', name: 'Kilometer', symbol: 'km', m: 1000 },
  { id: 'lunar', name: 'Lunar distance', symbol: 'LD', m: 3.844e8 },
  { id: 'rsun', name: 'Solar radius', symbol: 'R☉', m: 6.957e8 },
  { id: 'rearth', name: 'Earth radius', symbol: 'R⊕', m: 6371000 },
  { id: 'lsec', name: 'Light-second', symbol: 'ls', m: LIGHT_SEC },
  { id: 'lmin', name: 'Light-minute', symbol: 'lm', m: LIGHT_SEC * 60 },
  { id: 'au', name: 'Astronomical unit', symbol: 'AU', m: AU },
  { id: 'ly', name: 'Light-year', symbol: 'ly', m: LY },
  { id: 'pc', name: 'Parsec', symbol: 'pc', m: PC },
  { id: 'kpc', name: 'Kiloparsec', symbol: 'kpc', m: PC * 1e3 },
  { id: 'mpc', name: 'Megaparsec', symbol: 'Mpc', m: PC * 1e6 },
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

export default function AstronomicalDistanceConverterTool() {
  const [raw, setRaw] = useState('1');
  const [from, setFrom] = useState<string>('pc');
  const [precision, setPrecision] = useState(4);
  const [sci, setSci] = useState(true);

  const parsed = useMemo(() => {
    const trimmed = raw.trim();
    if (trimmed === '') return { value: null as number | null, error: null as string | null };
    const value = Number(trimmed);
    if (!Number.isFinite(value)) return { value: null, error: 'Enter a valid number.' };
    if (value < 0) return { value: null, error: 'Distance cannot be negative.' };
    return { value, error: null };
  }, [raw]);

  const baseM = useMemo(() => {
    if (parsed.value === null) return null;
    const unit = UNIT_BY_ID[from];
    if (!unit) return null;
    return parsed.value * unit.m;
  }, [parsed.value, from]);

  const results = useMemo(() => {
    if (baseM === null) return [];
    return UNITS.map((u) => ({ ...u, value: format(baseM / u.m, precision, sci) }));
  }, [baseM, precision, sci]);

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
              placeholder="Enter a distance"
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
              baseM !== null && `Base: ${format(baseM, precision, true)} m`,
            ]}
          />
        </Panel>
      ) : null}
    </div>
  );
}
