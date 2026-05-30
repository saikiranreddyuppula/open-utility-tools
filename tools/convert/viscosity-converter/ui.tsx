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

type Kind = 'dynamic' | 'kinematic';

interface UnitDef {
  id: string;
  name: string;
  symbol: string;
  // Base-unit value of one of this unit.
  // Dynamic base = pascal-second (Pa·s); kinematic base = m²/s.
  base: number;
}

const DYNAMIC: UnitDef[] = [
  { id: 'pas', name: 'Pascal-second', symbol: 'Pa·s', base: 1 },
  { id: 'mpas', name: 'Millipascal-second', symbol: 'mPa·s', base: 0.001 },
  { id: 'p', name: 'Poise', symbol: 'P', base: 0.1 },
  { id: 'cp', name: 'Centipoise', symbol: 'cP', base: 0.001 },
  { id: 'lbfsft2', name: 'Pound-force second / ft²', symbol: 'lbf·s/ft²', base: 47.880259 },
];

const KINEMATIC: UnitDef[] = [
  { id: 'm2s', name: 'Square meter / second', symbol: 'm²/s', base: 1 },
  { id: 'st', name: 'Stokes', symbol: 'St', base: 1e-4 },
  { id: 'cst', name: 'Centistokes', symbol: 'cSt', base: 1e-6 },
  { id: 'ft2s', name: 'Square foot / second', symbol: 'ft²/s', base: 0.092903 },
];

function unitsFor(kind: Kind): UnitDef[] {
  return kind === 'dynamic' ? DYNAMIC : KINEMATIC;
}

function format(n: number, precision: number, sci: boolean): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (sci || (abs !== 0 && (abs < 1e-6 || abs >= 1e12))) return n.toExponential(precision);
  const factor = 10 ** precision;
  const rounded = Math.round(n * factor) / factor;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  const fixed = normalized.toFixed(precision);
  if (precision === 0) return fixed;
  return fixed.replace(/\.?0+$/, '');
}

export default function ViscosityConverterTool() {
  const [kind, setKind] = useState<Kind>('dynamic');
  const [raw, setRaw] = useState('1');
  const [fromDynamic, setFromDynamic] = useState<string>('pas');
  const [fromKinematic, setFromKinematic] = useState<string>('cst');
  const [precision, setPrecision] = useState(6);
  const [sci, setSci] = useState(false);

  const units = unitsFor(kind);
  const from = kind === 'dynamic' ? fromDynamic : fromKinematic;
  const setFrom = kind === 'dynamic' ? setFromDynamic : setFromKinematic;
  const unitById: Record<string, UnitDef> = useMemo(
    () => Object.fromEntries(units.map((u) => [u.id, u])),
    [units]
  );

  const parsed = useMemo(() => {
    const trimmed = raw.trim();
    if (trimmed === '') return { value: null as number | null, error: null as string | null };
    const value = Number(trimmed);
    if (!Number.isFinite(value)) return { value: null, error: 'Enter a valid number.' };
    if (value < 0) return { value: null, error: 'Viscosity cannot be negative.' };
    return { value, error: null };
  }, [raw]);

  const baseVal = useMemo(() => {
    if (parsed.value === null) return null;
    const unit = unitById[from];
    if (!unit) return null;
    return parsed.value * unit.base;
  }, [parsed.value, from, unitById]);

  const results = useMemo(() => {
    if (baseVal === null) return [];
    return units.map((u) => ({ ...u, value: format(baseVal / u.base, precision, sci) }));
  }, [baseVal, units, precision, sci]);

  const fromUnit = unitById[from];
  const baseSymbol = kind === 'dynamic' ? 'Pa·s' : 'm²/s';

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Quantity" className="min-w-[14rem]">
            <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
              <TabsList>
                <TabsTrigger value="dynamic">Dynamic</TabsTrigger>
                <TabsTrigger value="kinematic">Kinematic</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Value" className="min-w-[10rem] flex-1">
            <Input
              type="text"
              inputMode="decimal"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="Enter a viscosity"
            />
          </Field>
          <Field label="From unit" className="min-w-[12rem]">
            <Select value={from} onValueChange={(v) => setFrom(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {units.map((u) => (
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

      <p className="text-xs text-muted-foreground">
        Dynamic (absolute) and kinematic viscosity are different physical quantities. Kinematic = dynamic ÷
        density, so values are only convertible within the same table.
      </p>

      {results.length > 0 ? (
        <Panel>
          <PanelHeader title={`${kind === 'dynamic' ? 'Dynamic' : 'Kinematic'} results`}>
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
              baseVal !== null && `Base: ${format(baseVal, precision, sci)} ${baseSymbol}`,
            ]}
          />
        </Panel>
      ) : null}
    </div>
  );
}
