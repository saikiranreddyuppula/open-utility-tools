'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Mode = 'toDms' | 'toDecimal';
type Axis = 'lat' | 'lng';

type Out =
  | { error: string }
  | { decimal: number; dms: string; axis: Axis };

function decimalToDms(dec: number, axis: Axis): string {
  const positive = dec >= 0;
  const abs = Math.abs(dec);
  let deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  let min = Math.floor(minFloat);
  let sec = (minFloat - min) * 60;
  // Handle rounding spill-over at 60 seconds / 60 minutes.
  sec = Math.round(sec * 1000) / 1000;
  if (sec >= 60) {
    sec -= 60;
    min += 1;
  }
  if (min >= 60) {
    min -= 60;
    deg += 1;
  }
  const hemi = axis === 'lat' ? (positive ? 'N' : 'S') : positive ? 'E' : 'W';
  return `${deg}°${min}'${sec.toFixed(3).replace(/\.?0+$/, '')}"${hemi}`;
}

function parseDms(str: string, axis: Axis): { ok: true; value: number } | { ok: false; error: string } {
  const s = str.trim();
  if (s === '') return { ok: false, error: 'Enter a DMS coordinate.' };
  // Extract hemisphere letter if present.
  const hemiMatch = s.match(/([NSEW])\s*$/i) ?? s.match(/^\s*([NSEW])/i);
  const hemi = hemiMatch?.[1]?.toUpperCase() ?? '';
  // Pull all numeric groups.
  const nums = s.match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length === 0) return { ok: false, error: 'Could not find degrees in the DMS value.' };
  const deg = Number(nums[0] ?? '0');
  const min = nums.length > 1 ? Number(nums[1] ?? '0') : 0;
  const sec = nums.length > 2 ? Number(nums[2] ?? '0') : 0;
  if (!Number.isFinite(deg) || !Number.isFinite(min) || !Number.isFinite(sec)) {
    return { ok: false, error: 'DMS components must be numbers.' };
  }
  if (min < 0 || min >= 60) return { ok: false, error: 'Minutes must be in 0..59.' };
  if (sec < 0 || sec >= 60) return { ok: false, error: 'Seconds must be in 0..59.' };

  let value = Math.abs(deg) + min / 60 + sec / 3600;
  const negative = deg < 0 || hemi === 'S' || hemi === 'W';
  if (negative) value = -value;

  const limit = axis === 'lat' ? 90 : 180;
  if (Math.abs(value) > limit) {
    return { ok: false, error: `${axis === 'lat' ? 'Latitude' : 'Longitude'} must be within ±${limit}°.` };
  }
  return { ok: true, value };
}

export default function DmsDecimalConverter() {
  const [mode, setMode] = useState<Mode>('toDms');
  const [axis, setAxis] = useState<Axis>('lat');
  const [decimal, setDecimal] = useState('40.446195');
  const [dms, setDms] = useState("40°26'46.3\"N");

  const result = useMemo<Out>(() => {
    if (mode === 'toDms') {
      const d = Number(decimal);
      if (!Number.isFinite(d)) return { error: 'Enter a valid decimal degree value.' };
      const limit = axis === 'lat' ? 90 : 180;
      if (Math.abs(d) > limit) {
        return { error: `${axis === 'lat' ? 'Latitude' : 'Longitude'} must be within ±${limit}°.` };
      }
      return { decimal: d, dms: decimalToDms(d, axis), axis };
    }
    const parsed = parseDms(dms, axis);
    if (!parsed.ok) return { error: parsed.error };
    return { decimal: parsed.value, dms: decimalToDms(parsed.value, axis), axis };
  }, [mode, axis, decimal, dms]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Direction">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="toDms">Decimal → DMS</TabsTrigger>
                <TabsTrigger value="toDecimal">DMS → Decimal</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Axis">
            <Select value={axis} onValueChange={(v) => setAxis(v as Axis)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lat">Latitude (±90)</SelectItem>
                <SelectItem value="lng">Longitude (±180)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {mode === 'toDms' ? (
            <Field label="Decimal degrees">
              <Input value={decimal} onChange={(e) => setDecimal(e.target.value)} inputMode="decimal" className="font-mono" />
            </Field>
          ) : (
            <Field label="DMS coordinate" hint={`e.g. 40°26'46"N`}>
              <Input value={dms} onChange={(e) => setDms(e.target.value)} className="font-mono w-56" />
            </Field>
          )}
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton value={() => `${result.decimal}, ${result.dms}`} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1 rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-2xs text-muted-foreground">Decimal degrees</span>
              <span className="flex items-center gap-2 font-mono text-lg font-semibold">
                <span>{result.decimal.toFixed(6).replace(/\.?0+$/, '')}</span>
                <CopyButton value={result.decimal.toFixed(6).replace(/\.?0+$/, '')} size="icon-sm" />
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-2xs text-muted-foreground">Degrees-minutes-seconds</span>
              <span className="flex items-center gap-2 font-mono text-lg font-semibold">
                <span>{result.dms}</span>
                <CopyButton value={result.dms} size="icon-sm" />
              </span>
            </div>
          </div>
          <StatBar
            items={[
              `Axis: ${result.axis === 'lat' ? 'latitude' : 'longitude'}`,
              `Decimal = deg + min/60 + sec/3600`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
