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

interface UnitDef {
  id: string;
  name: string;
  symbol: string;
  // Newton-meters in one of this unit.
  nm: number;
}

const UNITS: UnitDef[] = [
  { id: 'nm', name: 'Newton-meter', symbol: 'N·m', nm: 1 },
  { id: 'ncm', name: 'Newton-centimeter', symbol: 'N·cm', nm: 0.01 },
  { id: 'knm', name: 'Kilonewton-meter', symbol: 'kN·m', nm: 1000 },
  { id: 'lbft', name: 'Pound-foot', symbol: 'lbf·ft', nm: 1.3558179483 },
  { id: 'lbin', name: 'Pound-inch', symbol: 'lbf·in', nm: 0.1129848 },
  { id: 'ozin', name: 'Ounce-inch', symbol: 'ozf·in', nm: 0.00706155 },
  { id: 'kgfm', name: 'Kilogram-force meter', symbol: 'kgf·m', nm: 9.80665 },
  { id: 'dyncm', name: 'Dyne-centimeter', symbol: 'dyn·cm', nm: 1e-7 },
];

const UNIT_BY_ID: Record<string, UnitDef> = Object.fromEntries(UNITS.map((u) => [u.id, u]));

function format(n: number, precision: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs !== 0 && (abs < 1e-6 || abs >= 1e15)) return n.toExponential(precision);
  const factor = 10 ** precision;
  const rounded = Math.round(n * factor) / factor;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  const fixed = normalized.toFixed(precision);
  if (precision === 0) return fixed;
  return fixed.replace(/\.?0+$/, '');
}

export default function TorqueConverterTool() {
  const [raw, setRaw] = useState('100');
  const [from, setFrom] = useState<string>('nm');
  const [precision, setPrecision] = useState(4);

  const parsed = useMemo(() => {
    const trimmed = raw.trim();
    if (trimmed === '') return { value: null as number | null, error: null as string | null };
    const value = Number(trimmed);
    if (!Number.isFinite(value)) return { value: null, error: 'Enter a valid number.' };
    return { value, error: null };
  }, [raw]);

  const baseNm = useMemo(() => {
    if (parsed.value === null) return null;
    const unit = UNIT_BY_ID[from];
    if (!unit) return null;
    return parsed.value * unit.nm;
  }, [parsed.value, from]);

  const results = useMemo(() => {
    if (baseNm === null) return [];
    return UNITS.map((u) => ({ ...u, value: format(baseNm / u.nm, precision) }));
  }, [baseNm, precision]);

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
              placeholder="Enter a torque"
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
              max={6}
              step={1}
              value={[precision]}
              onValueChange={(v) => setPrecision(v[0] ?? 4)}
            />
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
              baseNm !== null && `Base: ${format(baseNm, precision)} N·m`,
            ]}
          />
        </Panel>
      ) : null}
    </div>
  );
}
