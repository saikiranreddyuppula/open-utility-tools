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
  // Number of bits in one of this unit.
  bits: number;
  group: 'base' | 'si' | 'iec';
}

const BYTE = 8;
const UNITS: UnitDef[] = [
  { id: 'bit', name: 'Bit', symbol: 'b', bits: 1, group: 'base' },
  { id: 'byte', name: 'Byte', symbol: 'B', bits: BYTE, group: 'base' },
  // Decimal SI (powers of 1000).
  { id: 'kb', name: 'Kilobyte', symbol: 'KB', bits: BYTE * 1e3, group: 'si' },
  { id: 'mb', name: 'Megabyte', symbol: 'MB', bits: BYTE * 1e6, group: 'si' },
  { id: 'gb', name: 'Gigabyte', symbol: 'GB', bits: BYTE * 1e9, group: 'si' },
  { id: 'tb', name: 'Terabyte', symbol: 'TB', bits: BYTE * 1e12, group: 'si' },
  { id: 'pb', name: 'Petabyte', symbol: 'PB', bits: BYTE * 1e15, group: 'si' },
  // Binary IEC (powers of 1024).
  { id: 'kib', name: 'Kibibyte', symbol: 'KiB', bits: BYTE * 1024, group: 'iec' },
  { id: 'mib', name: 'Mebibyte', symbol: 'MiB', bits: BYTE * 1024 ** 2, group: 'iec' },
  { id: 'gib', name: 'Gibibyte', symbol: 'GiB', bits: BYTE * 1024 ** 3, group: 'iec' },
  { id: 'tib', name: 'Tebibyte', symbol: 'TiB', bits: BYTE * 1024 ** 4, group: 'iec' },
  { id: 'pib', name: 'Pebibyte', symbol: 'PiB', bits: BYTE * 1024 ** 5, group: 'iec' },
];

const UNIT_BY_ID: Record<string, UnitDef> = Object.fromEntries(UNITS.map((u) => [u.id, u]));

const GROUPS: { id: UnitDef['group']; label: string }[] = [
  { id: 'base', label: 'Base units' },
  { id: 'si', label: 'Decimal (SI, ×1000)' },
  { id: 'iec', label: 'Binary (IEC, ×1024)' },
];

function format(n: number, precision: number): string {
  if (!Number.isFinite(n)) return '—';
  const factor = 10 ** precision;
  const rounded = Math.round(n * factor) / factor;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  const fixed = normalized.toFixed(precision);
  if (precision === 0) return fixed;
  return fixed.replace(/\.?0+$/, '');
}

export default function DataSizeConverterTool() {
  const [raw, setRaw] = useState('1');
  const [from, setFrom] = useState<string>('mb');
  const [precision, setPrecision] = useState(4);

  const parsed = useMemo(() => {
    const trimmed = raw.trim();
    if (trimmed === '') return { value: null as number | null, error: null as string | null };
    const value = Number(trimmed);
    if (!Number.isFinite(value)) {
      return { value: null, error: 'Enter a valid number.' };
    }
    if (value < 0) {
      return { value: null, error: 'Data size cannot be negative.' };
    }
    return { value, error: null };
  }, [raw]);

  const bits = useMemo(() => {
    if (parsed.value === null) return null;
    const unit = UNIT_BY_ID[from];
    if (!unit) return null;
    return parsed.value * unit.bits;
  }, [parsed.value, from]);

  const results = useMemo(() => {
    if (bits === null) return [];
    return UNITS.map((u) => ({
      ...u,
      value: format(bits / u.bits, precision),
    }));
  }, [bits, precision]);

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
              placeholder="Enter a size"
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
          <Field
            label={`Precision: ${precision}`}
            hint="Decimal places"
            className="min-w-[10rem]"
          >
            <Slider
              min={0}
              max={10}
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
          <div className="space-y-4 pt-3">
            {GROUPS.map((g) => {
              const items = results.filter((r) => r.group === g.id);
              return (
                <div key={g.id} className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.label}
                  </h4>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {items.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
                      >
                        <span className="text-sm text-muted-foreground">
                          {r.name} ({r.symbol})
                        </span>
                        <span className="flex items-center gap-2 font-mono text-sm">
                          <span>{r.value}</span>
                          <CopyButton value={`${r.value} ${r.symbol}`} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pt-3">
            <StatBar
              items={[
                fromUnit && `Input: ${parsed.value} ${fromUnit.symbol}`,
                bits !== null && `Total bits: ${format(bits, 0)}`,
                bits !== null && `Total bytes: ${format(bits / BYTE, precision)}`,
              ]}
            />
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
