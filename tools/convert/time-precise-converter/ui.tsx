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
  // Seconds in one of this unit.
  seconds: number;
}

const UNITS: UnitDef[] = [
  { id: 'shake', name: 'Shake', symbol: 'shake', seconds: 1e-8 },
  { id: 'ns', name: 'Nanosecond', symbol: 'ns', seconds: 1e-9 },
  { id: 'us', name: 'Microsecond', symbol: 'µs', seconds: 1e-6 },
  { id: 'ms', name: 'Millisecond', symbol: 'ms', seconds: 1e-3 },
  { id: 'jiffy', name: 'Jiffy (1/60 s)', symbol: 'jiffy', seconds: 1 / 60 },
  { id: 's', name: 'Second', symbol: 's', seconds: 1 },
  { id: 'min', name: 'Minute', symbol: 'min', seconds: 60 },
  { id: 'hour', name: 'Hour', symbol: 'h', seconds: 3600 },
  { id: 'day', name: 'Day', symbol: 'd', seconds: 86400 },
  { id: 'week', name: 'Week', symbol: 'wk', seconds: 604800 },
  { id: 'fortnight', name: 'Fortnight', symbol: 'fn', seconds: 1209600 },
  { id: 'jyear', name: 'Julian year', symbol: 'yr', seconds: 31557600 },
  { id: 'decade', name: 'Decade (Julian)', symbol: 'dec', seconds: 315576000 },
  { id: 'century', name: 'Century (Julian)', symbol: 'c', seconds: 3155760000 },
];

const UNIT_BY_ID: Record<string, UnitDef> = Object.fromEntries(UNITS.map((u) => [u.id, u]));

function format(n: number, precision: number, sci: boolean): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  if (sci) return n.toExponential(precision);
  // Auto-fall back to exponential when the magnitude is too extreme to read.
  const abs = Math.abs(n);
  if (abs !== 0 && (abs < 1e-6 || abs >= 1e15)) return n.toExponential(precision);
  const factor = 10 ** precision;
  const rounded = Math.round(n * factor) / factor;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  const fixed = normalized.toFixed(precision);
  if (precision === 0) return fixed;
  return fixed.replace(/\.?0+$/, '');
}

export default function PreciseTimeConverterTool() {
  const [raw, setRaw] = useState('1');
  const [from, setFrom] = useState<string>('jyear');
  const [precision, setPrecision] = useState(6);
  const [sci, setSci] = useState(false);

  const parsed = useMemo(() => {
    const trimmed = raw.trim();
    if (trimmed === '') return { value: null as number | null, error: null as string | null };
    const value = Number(trimmed);
    if (!Number.isFinite(value)) return { value: null, error: 'Enter a valid number.' };
    if (value < 0) return { value: null, error: 'Time span cannot be negative.' };
    return { value, error: null };
  }, [raw]);

  const baseSeconds = useMemo(() => {
    if (parsed.value === null) return null;
    const unit = UNIT_BY_ID[from];
    if (!unit) return null;
    return parsed.value * unit.seconds;
  }, [parsed.value, from]);

  const results = useMemo(() => {
    if (baseSeconds === null) return [];
    return UNITS.map((u) => ({ ...u, value: format(baseSeconds / u.seconds, precision, sci) }));
  }, [baseSeconds, precision, sci]);

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
              placeholder="Enter a time span"
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
          <Field label={`Precision: ${precision}`} hint="Significant decimals" className="min-w-[10rem]">
            <Slider
              min={0}
              max={12}
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
              baseSeconds !== null && `Base: ${format(baseSeconds, precision, sci)} s`,
            ]}
          />
        </Panel>
      ) : null}
    </div>
  );
}
