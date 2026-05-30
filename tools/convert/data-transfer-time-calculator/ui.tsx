'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Size units expressed in bytes, with both SI and IEC variants chosen by the toggle.
interface SizeUnit {
  id: string;
  label: string;
  si: number; // bytes (base 1000)
  iec: number; // bytes (base 1024)
}
const SIZE_UNITS: SizeUnit[] = [
  { id: 'mb', label: 'MB / MiB', si: 1e6, iec: 1024 ** 2 },
  { id: 'gb', label: 'GB / GiB', si: 1e9, iec: 1024 ** 3 },
  { id: 'tb', label: 'TB / TiB', si: 1e12, iec: 1024 ** 4 },
];
const SIZE_BY_ID: Record<string, SizeUnit> = Object.fromEntries(SIZE_UNITS.map((u) => [u.id, u]));

// Speed units expressed in bits per second (byte units multiply by 8).
interface SpeedUnit {
  id: string;
  label: string;
  bps: number; // bits per second per 1 unit
}
const SPEED_UNITS: SpeedUnit[] = [
  { id: 'kbps', label: 'Kbps (kilobit/s)', bps: 1e3 },
  { id: 'mbps', label: 'Mbps (megabit/s)', bps: 1e6 },
  { id: 'gbps', label: 'Gbps (gigabit/s)', bps: 1e9 },
  { id: 'mbyteps', label: 'MB/s (megabyte/s)', bps: 8e6 },
  { id: 'gbyteps', label: 'GB/s (gigabyte/s)', bps: 8e9 },
];
const SPEED_BY_ID: Record<string, SpeedUnit> = Object.fromEntries(SPEED_UNITS.map((u) => [u.id, u]));

function clock(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (x: number) => x.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function phrase(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  if (seconds < 1) return 'less than a second';
  const units: { s: number; one: string; many: string }[] = [
    { s: 86400, one: 'day', many: 'days' },
    { s: 3600, one: 'hour', many: 'hours' },
    { s: 60, one: 'minute', many: 'minutes' },
    { s: 1, one: 'second', many: 'seconds' },
  ];
  for (const u of units) {
    if (seconds >= u.s) {
      const v = Math.round(seconds / u.s);
      return `about ${v} ${v === 1 ? u.one : u.many}`;
    }
  }
  return 'less than a second';
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return (Math.round(n * 1000) / 1000).toString();
}

export default function DataTransferTimeCalculatorTool() {
  const [sizeRaw, setSizeRaw] = useState('5');
  const [sizeUnit, setSizeUnit] = useState<string>('gb');
  const [speedRaw, setSpeedRaw] = useState('100');
  const [speedUnit, setSpeedUnit] = useState<string>('mbps');
  const [overheadRaw, setOverheadRaw] = useState('0');
  const [iec, setIec] = useState(false);

  const result = useMemo(() => {
    const size = Number(sizeRaw.trim());
    const speed = Number(speedRaw.trim());
    const overhead = Number(overheadRaw.trim());
    if (sizeRaw.trim() === '' || !Number.isFinite(size) || size < 0) {
      return { error: 'Enter a valid, non-negative file size.' };
    }
    if (speedRaw.trim() === '' || !Number.isFinite(speed) || speed <= 0) {
      return { error: 'Enter a valid connection speed greater than zero.' };
    }
    if (!Number.isFinite(overhead) || overhead < 0 || overhead >= 100) {
      return { error: 'Overhead must be between 0 and 99 percent.' };
    }
    const su = SIZE_BY_ID[sizeUnit];
    const spu = SPEED_BY_ID[speedUnit];
    if (!su || !spu) return { error: 'Pick valid units.' };

    const bytes = size * (iec ? su.iec : su.si);
    const totalBits = bytes * 8;
    const effectiveBps = spu.bps * (1 - overhead / 100);
    const seconds = totalBits / effectiveBps;
    return {
      seconds,
      bytes,
      totalBits,
      effectiveBps,
      effectiveMbps: effectiveBps / 1e6,
    };
  }, [sizeRaw, sizeUnit, speedRaw, speedUnit, overheadRaw, iec]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="File size" className="min-w-[8rem] flex-1">
            <Input
              type="text"
              inputMode="decimal"
              value={sizeRaw}
              onChange={(e) => setSizeRaw(e.target.value)}
            />
          </Field>
          <Field label="Size unit" className="min-w-[9rem]">
            <Select value={sizeUnit} onValueChange={(v) => setSizeUnit(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIZE_UNITS.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Speed" className="min-w-[8rem] flex-1">
            <Input
              type="text"
              inputMode="decimal"
              value={speedRaw}
              onChange={(e) => setSpeedRaw(e.target.value)}
            />
          </Field>
          <Field label="Speed unit" className="min-w-[11rem]">
            <Select value={speedUnit} onValueChange={(v) => setSpeedUnit(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPEED_UNITS.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Overhead %" hint="Protocol loss" className="min-w-[7rem]">
            <Input
              type="text"
              inputMode="decimal"
              value={overheadRaw}
              onChange={(e) => setOverheadRaw(e.target.value)}
            />
          </Field>
          <Field label={iec ? 'Binary (IEC)' : 'Decimal (SI)'} hint="Size base">
            <Switch checked={iec} onCheckedChange={setIec} />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Estimated transfer time">
            <CopyButton value={() => `${clock(result.seconds)} (${phrase(result.seconds)})`} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">Time (hh:mm:ss)</span>
              <span className="flex items-center gap-2 font-mono text-sm font-semibold">
                <span>{clock(result.seconds)}</span>
                <CopyButton value={clock(result.seconds)} size="icon-sm" />
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">In words</span>
              <span className="font-mono text-sm">{phrase(result.seconds)}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">Total seconds</span>
              <span className="font-mono text-sm">{fmt(result.seconds)} s</span>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">Effective throughput</span>
              <span className="font-mono text-sm">{fmt(result.effectiveMbps)} Mbps</span>
            </div>
          </div>
          <StatBar
            items={[
              `Bytes: ${Math.round(result.bytes).toLocaleString()}`,
              `Bits: ${Math.round(result.totalBits).toLocaleString()}`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
