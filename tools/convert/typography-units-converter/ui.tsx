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
  // PostScript points in one of this unit. For em/rem this depends on the
  // base font size, so it is computed dynamically (set to null here).
  pt: number | null;
}

// Base unit: PostScript point = 1/72 inch.
const UNITS: UnitDef[] = [
  { id: 'pt', name: 'Point', symbol: 'pt', pt: 1 },
  { id: 'pica', name: 'Pica', symbol: 'pc', pt: 12 },
  { id: 'px', name: 'Pixel (CSS, 96/in)', symbol: 'px', pt: 0.75 },
  { id: 'in', name: 'Inch', symbol: 'in', pt: 72 },
  { id: 'mm', name: 'Millimeter', symbol: 'mm', pt: 72 / 25.4 },
  { id: 'cm', name: 'Centimeter', symbol: 'cm', pt: 720 / 25.4 },
  { id: 'em', name: 'Em (× base font)', symbol: 'em', pt: null },
  { id: 'rem', name: 'Rem (× base font)', symbol: 'rem', pt: null },
  { id: 'cicero', name: 'Cicero', symbol: 'cc', pt: 12.7872 },
  { id: 'didot', name: 'Didot point', symbol: 'dd', pt: 1.0656 },
];

function ptPerUnit(u: UnitDef, baseFontPx: number): number {
  // em/rem are measured relative to the base font size in px;
  // 1 px = 0.75 pt, so base in pt = baseFontPx * 0.75.
  if (u.pt === null) return baseFontPx * 0.75;
  return u.pt;
}

const UNIT_BY_ID: Record<string, UnitDef> = Object.fromEntries(UNITS.map((u) => [u.id, u]));

function format(n: number, precision: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs !== 0 && abs >= 1e15) return n.toExponential(precision);
  const factor = 10 ** precision;
  const rounded = Math.round(n * factor) / factor;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  const fixed = normalized.toFixed(precision);
  if (precision === 0) return fixed;
  return fixed.replace(/\.?0+$/, '');
}

export default function TypographyUnitsConverterTool() {
  const [raw, setRaw] = useState('12');
  const [from, setFrom] = useState<string>('pt');
  const [baseFontRaw, setBaseFontRaw] = useState('16');
  const [precision, setPrecision] = useState(4);

  const baseFontPx = useMemo(() => {
    const v = Number(baseFontRaw.trim());
    if (!Number.isFinite(v) || v <= 0) return 16;
    return v;
  }, [baseFontRaw]);

  const parsed = useMemo(() => {
    const trimmed = raw.trim();
    if (trimmed === '') return { value: null as number | null, error: null as string | null };
    const value = Number(trimmed);
    if (!Number.isFinite(value)) return { value: null, error: 'Enter a valid number.' };
    return { value, error: null };
  }, [raw]);

  const basePt = useMemo(() => {
    if (parsed.value === null) return null;
    const unit = UNIT_BY_ID[from];
    if (!unit) return null;
    return parsed.value * ptPerUnit(unit, baseFontPx);
  }, [parsed.value, from, baseFontPx]);

  const results = useMemo(() => {
    if (basePt === null) return [];
    return UNITS.map((u) => ({
      ...u,
      value: format(basePt / ptPerUnit(u, baseFontPx), precision),
    }));
  }, [basePt, precision, baseFontPx]);

  const fromUnit = UNIT_BY_ID[from];

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Value" className="min-w-[10rem] flex-1">
            <Input
              type="text"
              inputMode="decimal"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="Enter a length"
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
          <Field label="Base font (px)" hint="For em / rem" className="min-w-[8rem]">
            <Input
              type="text"
              inputMode="decimal"
              value={baseFontRaw}
              onChange={(e) => setBaseFontRaw(e.target.value)}
              placeholder="16"
            />
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
              basePt !== null && `Base: ${format(basePt, precision)} pt`,
              `Base font: ${baseFontPx} px`,
            ]}
          />
        </Panel>
      ) : null}
    </div>
  );
}
