'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  base: number;
}

type TableId = 'density' | 'flux';

// Flux density base unit: tesla.
const DENSITY_UNITS: UnitDef[] = [
  { id: 't', name: 'Tesla', symbol: 'T', base: 1 },
  { id: 'mt', name: 'Millitesla', symbol: 'mT', base: 1e-3 },
  { id: 'ut', name: 'Microtesla', symbol: 'µT', base: 1e-6 },
  { id: 'nt', name: 'Nanotesla', symbol: 'nT', base: 1e-9 },
  { id: 'kg', name: 'Kilogauss', symbol: 'kG', base: 0.1 },
  { id: 'g', name: 'Gauss', symbol: 'G', base: 1e-4 },
  { id: 'mg', name: 'Milligauss', symbol: 'mG', base: 1e-7 },
];

// Magnetic flux base unit: weber.
const FLUX_UNITS: UnitDef[] = [
  { id: 'wb', name: 'Weber', symbol: 'Wb', base: 1 },
  { id: 'mwb', name: 'Milliweber', symbol: 'mWb', base: 1e-3 },
  { id: 'uwb', name: 'Microweber', symbol: 'µWb', base: 1e-6 },
  { id: 'mx', name: 'Maxwell', symbol: 'Mx', base: 1e-8 },
];

const TABLES: Record<TableId, { units: UnitDef[]; baseSymbol: string; label: string }> = {
  density: { units: DENSITY_UNITS, baseSymbol: 'T', label: 'Flux density' },
  flux: { units: FLUX_UNITS, baseSymbol: 'Wb', label: 'Flux' },
};

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

export default function MagneticFieldConverterTool() {
  const [table, setTable] = useState<TableId>('density');
  const [raw, setRaw] = useState('1');
  const [from, setFrom] = useState<string>('t');
  const [precision, setPrecision] = useState(4);
  const [sci, setSci] = useState(true);

  const active = TABLES[table];
  const unitById = useMemo<Record<string, UnitDef>>(
    () => Object.fromEntries(active.units.map((u) => [u.id, u])),
    [active.units],
  );

  const fromUnit = unitById[from] ?? active.units[0];

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
    if (parsed.value === null || !fromUnit) return null;
    return parsed.value * fromUnit.base;
  }, [parsed.value, fromUnit]);

  const results = useMemo(() => {
    if (baseValue === null) return [];
    return active.units.map((u) => ({
      ...u,
      value: format(baseValue / u.base, precision, sci),
    }));
  }, [baseValue, precision, sci, active.units]);

  const switchTable = (next: TableId) => {
    setTable(next);
    const firstUnit = TABLES[next].units[0];
    if (firstUnit) setFrom(firstUnit.id);
  };

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Quantity" className="min-w-[14rem]">
            <Tabs value={table} onValueChange={(v) => switchTable(v as TableId)}>
              <TabsList>
                <TabsTrigger value="density">Flux density</TabsTrigger>
                <TabsTrigger value="flux">Flux</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Value" className="min-w-[12rem] flex-1">
            <Input
              type="text"
              inputMode="decimal"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="Enter a value"
            />
          </Field>
          <Field label="From unit" className="min-w-[16rem]">
            <Select value={fromUnit ? fromUnit.id : ''} onValueChange={(v) => setFrom(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {active.units.map((u) => (
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
          <PanelHeader title={`Results — ${active.label}`}>
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
                baseValue !== null && `Base: ${format(baseValue, precision, sci)} ${active.baseSymbol}`,
              ]}
            />
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
