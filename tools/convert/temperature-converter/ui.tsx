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

type Scale = 'C' | 'F' | 'K' | 'R';

const SCALES: { id: Scale; name: string; symbol: string }[] = [
  { id: 'C', name: 'Celsius', symbol: '°C' },
  { id: 'F', name: 'Fahrenheit', symbol: '°F' },
  { id: 'K', name: 'Kelvin', symbol: 'K' },
  { id: 'R', name: 'Rankine', symbol: '°R' },
];

// Absolute zero in each scale, used to flag physically impossible values.
const ABS_ZERO: Record<Scale, number> = { C: -273.15, F: -459.67, K: 0, R: 0 };

function toCelsius(value: number, from: Scale): number {
  switch (from) {
    case 'C':
      return value;
    case 'F':
      return (value - 32) * (5 / 9);
    case 'K':
      return value - 273.15;
    case 'R':
      return (value - 491.67) * (5 / 9);
  }
}

function fromCelsius(c: number, to: Scale): number {
  switch (to) {
    case 'C':
      return c;
    case 'F':
      return c * (9 / 5) + 32;
    case 'K':
      return c + 273.15;
    case 'R':
      return (c + 273.15) * (9 / 5);
  }
}

function round(n: number, precision: number): string {
  if (!Number.isFinite(n)) return '—';
  const factor = 10 ** precision;
  const rounded = Math.round(n * factor) / factor;
  // Avoid showing "-0".
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  return normalized.toFixed(precision);
}

export default function TemperatureConverterTool() {
  const [raw, setRaw] = useState('100');
  const [from, setFrom] = useState<Scale>('C');
  const [precision, setPrecision] = useState(2);

  const parsed = useMemo(() => {
    const trimmed = raw.trim();
    if (trimmed === '') return { value: null as number | null, error: null as string | null };
    const value = Number(trimmed);
    if (!Number.isFinite(value)) {
      return { value: null, error: 'Enter a valid number.' };
    }
    return { value, error: null };
  }, [raw]);

  const celsius = useMemo(() => {
    if (parsed.value === null) return null;
    return toCelsius(parsed.value, from);
  }, [parsed.value, from]);

  const belowAbsoluteZero = useMemo(() => {
    if (parsed.value === null) return false;
    return parsed.value < ABS_ZERO[from] - 1e-9;
  }, [parsed.value, from]);

  const results = useMemo(() => {
    if (celsius === null) return [];
    return SCALES.map((s) => ({
      ...s,
      value: round(fromCelsius(celsius, s.id), precision),
    }));
  }, [celsius, precision]);

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
              placeholder="Enter a temperature"
            />
          </Field>
          <Field label="From scale" className="min-w-[10rem]">
            <Select value={from} onValueChange={(v) => setFrom(v as Scale)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCALES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.symbol})
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
              max={6}
              step={1}
              value={[precision]}
              onValueChange={(v) => setPrecision(v[0] ?? 2)}
            />
          </Field>
        </OptionsBar>
      </Panel>

      <ErrorBanner error={parsed.error} />
      {belowAbsoluteZero && parsed.error === null ? (
        <ErrorBanner error="This value is below absolute zero, which is physically impossible." />
      ) : null}

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
                <span className="text-sm text-muted-foreground">{r.name}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span>
                    {r.value} {r.symbol}
                  </span>
                  <CopyButton value={`${r.value} ${r.symbol}`} />
                </span>
              </div>
            ))}
          </div>
          <div className="pt-3">
            <StatBar
              items={[
                `Input: ${parsed.value} ${SCALES.find((s) => s.id === from)?.symbol ?? ''}`,
                celsius !== null && `Celsius: ${round(celsius, precision)} °C`,
              ]}
            />
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
