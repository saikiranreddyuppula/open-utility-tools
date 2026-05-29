'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ScaleMode = 'decimal' | 'binary';

// Each unit stores: whether it is bits or bytes, and its multiplier (in the
// chosen prefix scale). We convert everything through bits-per-second (bps).
interface RateUnit {
  id: string;
  label: string;
  /** number of base units (bits) per one of this unit, before prefix scaling */
  bitsPerBase: number; // 1 for bit units, 8 for byte units
  /** prefix exponent: 0 = none, 1 = K, 2 = M, 3 = G, 4 = T */
  prefix: number;
}

const UNITS: RateUnit[] = [
  { id: 'bps', label: 'bit/s (bps)', bitsPerBase: 1, prefix: 0 },
  { id: 'kbps', label: 'Kbit/s (Kbps)', bitsPerBase: 1, prefix: 1 },
  { id: 'mbps', label: 'Mbit/s (Mbps)', bitsPerBase: 1, prefix: 2 },
  { id: 'gbps', label: 'Gbit/s (Gbps)', bitsPerBase: 1, prefix: 3 },
  { id: 'tbps', label: 'Tbit/s (Tbps)', bitsPerBase: 1, prefix: 4 },
  { id: 'Bps', label: 'Byte/s (B/s)', bitsPerBase: 8, prefix: 0 },
  { id: 'KBps', label: 'KByte/s (KB/s)', bitsPerBase: 8, prefix: 1 },
  { id: 'MBps', label: 'MByte/s (MB/s)', bitsPerBase: 8, prefix: 2 },
  { id: 'GBps', label: 'GByte/s (GB/s)', bitsPerBase: 8, prefix: 3 },
  { id: 'TBps', label: 'TByte/s (TB/s)', bitsPerBase: 8, prefix: 4 },
];

function unitById(id: string): RateUnit {
  return UNITS.find((u) => u.id === id) ?? (UNITS[0] as RateUnit);
}

function prefixFactor(prefix: number, scale: ScaleMode): number {
  const radix = scale === 'binary' ? 1024 : 1000;
  return Math.pow(radix, prefix);
}

/** Convert a value of `from` unit to bits per second. */
function toBps(value: number, from: RateUnit, scale: ScaleMode): number {
  return value * prefixFactor(from.prefix, scale) * from.bitsPerBase;
}

/** Convert bits per second into the `to` unit. */
function fromBps(bps: number, to: RateUnit, scale: ScaleMode): number {
  return bps / (prefixFactor(to.prefix, scale) * to.bitsPerBase);
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e-4 && abs < 1e15) {
    // Show up to 6 significant digits, then trim trailing zeros.
    const fixed = n.toFixed(6);
    return fixed.replace(/\.?0+$/, '');
  }
  return n.toExponential(6).replace(/\.?0+e/, 'e');
}

export default function DataRateConverterTool() {
  const [valueText, setValueText] = useState('100');
  const [from, setFrom] = useState('mbps');
  const [scale, setScale] = useState<ScaleMode>('decimal');

  const parsed = useMemo(() => {
    const trimmed = valueText.trim();
    if (trimmed === '') return { value: null as number | null, error: null as string | null };
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return { value: null, error: 'Enter a valid number.' };
    if (n < 0) return { value: null, error: 'Value must be zero or positive.' };
    return { value: n, error: null };
  }, [valueText]);

  const results = useMemo(() => {
    if (parsed.value === null) return [];
    const fromUnit = unitById(from);
    const bps = toBps(parsed.value, fromUnit, scale);
    return UNITS.map((u) => ({ unit: u, value: fromBps(bps, u, scale) }));
  }, [parsed.value, from, scale]);

  const fromUnit = unitById(from);
  const baseBps = parsed.value === null ? null : toBps(parsed.value, fromUnit, scale);

  const copyText = useMemo(() => {
    if (results.length === 0) return '';
    return results.map((r) => `${formatNumber(r.value)} ${r.unit.label}`).join('\n');
  }, [results]);

  return (
    <Panel>
      <PanelHeader title="Data Transfer Rate Converter">
        {copyText !== '' && <CopyButton value={copyText} />}
      </PanelHeader>

      <OptionsBar>
        <Field label="Prefix scale" hint={scale === 'binary' ? '1 KB = 1024 bytes' : '1 KB = 1000 bytes'}>
          <Tabs value={scale} onValueChange={(v) => setScale(v as ScaleMode)}>
            <TabsList>
              <TabsTrigger value="decimal">Decimal (1000)</TabsTrigger>
              <TabsTrigger value="binary">Binary (1024)</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      </OptionsBar>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Value">
          <Input
            inputMode="decimal"
            value={valueText}
            onChange={(e) => setValueText(e.target.value)}
            placeholder="e.g. 100"
          />
        </Field>
        <Field label="From unit">
          <Select value={from} onValueChange={(v) => setFrom(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <ErrorBanner error={parsed.error} />

      {results.length > 0 && (
        <div className="mt-2 overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <tbody>
              {results.map((r) => (
                <tr key={r.unit.id} className="border-b last:border-b-0">
                  <td className="px-3 py-2 text-muted-foreground">{r.unit.label}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatNumber(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <StatBar
        items={[
          parsed.value !== null && `Input: ${formatNumber(parsed.value)} ${fromUnit.label}`,
          baseBps !== null && `= ${formatNumber(baseBps)} bit/s`,
        ]}
      />
    </Panel>
  );
}
