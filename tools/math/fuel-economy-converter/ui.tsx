'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Unit = 'mpgUS' | 'mpgUK' | 'kmL' | 'l100';

const UNIT_LABELS: Record<Unit, string> = {
  mpgUS: 'MPG (US)',
  mpgUK: 'MPG (UK / Imperial)',
  kmL: 'km/L',
  l100: 'L/100km',
};

// Liters per gallon and km per mile.
const L_PER_GAL_US = 3.785411784;
const L_PER_GAL_UK = 4.54609;
const KM_PER_MILE = 1.609344;

// Numerator for distance-per-volume → L/100km conversions.
const MPG_US_K = (L_PER_GAL_US * 100) / KM_PER_MILE; // ≈ 235.2146
const MPG_UK_K = (L_PER_GAL_UK * 100) / KM_PER_MILE; // ≈ 282.4809

/** Convert any supported unit value to L/100km (the base). */
function toL100(value: number, unit: Unit): number {
  switch (unit) {
    case 'l100':
      return value;
    case 'kmL':
      if (value <= 0) throw new Error('km/L must be greater than 0.');
      return 100 / value;
    case 'mpgUS':
      if (value <= 0) throw new Error('MPG (US) must be greater than 0.');
      return MPG_US_K / value;
    case 'mpgUK':
      if (value <= 0) throw new Error('MPG (UK) must be greater than 0.');
      return MPG_UK_K / value;
  }
}

/** Convert from L/100km (base) to any supported unit. */
function fromL100(l100: number, unit: Unit): number {
  switch (unit) {
    case 'l100':
      return l100;
    case 'kmL':
      if (l100 <= 0) throw new Error('Consumption must be greater than 0.');
      return 100 / l100;
    case 'mpgUS':
      if (l100 <= 0) throw new Error('Consumption must be greater than 0.');
      return MPG_US_K / l100;
    case 'mpgUK':
      if (l100 <= 0) throw new Error('Consumption must be greater than 0.');
      return MPG_UK_K / l100;
  }
}

function round(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return (Math.round(n * 1000) / 1000).toString();
}

const ALL_UNITS: Unit[] = ['mpgUS', 'mpgUK', 'kmL', 'l100'];

export default function FuelEconomyConverterTool() {
  const [unit, setUnit] = useState<Unit>('mpgUS');
  const [raw, setRaw] = useState('30');

  const result = useMemo<{ rows: { unit: Unit; value: string }[]; error: string | null }>(() => {
    const s = raw.trim();
    if (s === '') return { rows: [], error: null };
    const n = Number(s);
    if (!Number.isFinite(n)) return { rows: [], error: `"${raw}" is not a valid number.` };
    if (n <= 0) return { rows: [], error: 'Value must be greater than 0.' };
    try {
      const base = toL100(n, unit);
      const rows = ALL_UNITS.map((u) => ({ unit: u, value: round(fromL100(base, u)) }));
      return { rows, error: null };
    } catch (err) {
      return { rows: [], error: err instanceof Error ? err.message : String(err) };
    }
  }, [raw, unit]);

  const copyValue = result.rows
    .map((r) => `${UNIT_LABELS[r.unit]}: ${r.value}`)
    .join('\n');

  return (
    <Panel>
      <PanelHeader title="Fuel Economy Converter" />

      <OptionsBar>
        <Field label="From unit">
          <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_UNITS.map((u) => (
                <SelectItem key={u} value={u}>
                  {UNIT_LABELS[u]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </OptionsBar>

      <div className="space-y-1.5">
        <Label htmlFor="fuel-input">Value ({UNIT_LABELS[unit]})</Label>
        <Input
          id="fuel-input"
          inputMode="decimal"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="e.g. 30"
        />
      </div>

      <ErrorBanner error={result.error} />

      {!result.error && result.rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label>Converted values</Label>
            <CopyButton value={copyValue} />
          </div>
          <div className="overflow-hidden rounded-md border">
            {result.rows.map((r, i) => (
              <div
                key={r.unit}
                className={
                  'flex items-center justify-between gap-3 px-4 py-3 ' +
                  (i % 2 === 1 ? 'bg-muted/40' : '') +
                  (r.unit === unit ? ' font-semibold' : '')
                }
              >
                <span className="text-sm text-muted-foreground">{UNIT_LABELS[r.unit]}</span>
                <span className="font-mono tabular-nums">{r.value}</span>
              </div>
            ))}
          </div>
          <StatBar
            items={[
              `from: ${UNIT_LABELS[unit]}`,
              'lower L/100km = more efficient',
              'higher MPG / km/L = more efficient',
            ]}
          />
        </div>
      )}
    </Panel>
  );
}
