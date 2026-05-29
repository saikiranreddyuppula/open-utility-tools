'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Solve = 'pace' | 'time' | 'distance';
type DistUnit = 'km' | 'mi';

const KM_PER_MILE = 1.609344;

/** Parse "HH:MM:SS", "MM:SS", or plain seconds / minutes into total seconds. */
function parseTime(raw: string): number {
  const s = raw.trim();
  if (s === '') throw new Error('Time is required.');
  if (s.includes(':')) {
    const parts = s.split(':').map((p) => p.trim());
    if (parts.length > 3) throw new Error('Time has too many ":" segments. Use HH:MM:SS.');
    let total = 0;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i] ?? '';
      const n = Number(part);
      if (part === '' || !Number.isFinite(n) || n < 0) {
        throw new Error(`Invalid time segment "${part}".`);
      }
      total = total * 60 + n;
    }
    return total;
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) throw new Error(`"${raw}" is not a valid time.`);
  return n;
}

/** Parse a "MM:SS" pace (or decimal minutes) into seconds. */
function parsePace(raw: string): number {
  const s = raw.trim();
  if (s === '') throw new Error('Pace is required.');
  if (s.includes(':')) {
    const parts = s.split(':').map((p) => p.trim());
    if (parts.length !== 2) throw new Error('Pace must be MM:SS.');
    const mins = Number(parts[0] ?? '');
    const secs = Number(parts[1] ?? '');
    if (!Number.isFinite(mins) || mins < 0) throw new Error('Invalid pace minutes.');
    if (!Number.isFinite(secs) || secs < 0 || secs >= 60) {
      throw new Error('Pace seconds must be between 0 and 59.');
    }
    return mins * 60 + secs;
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) throw new Error(`"${raw}" is not a valid pace.`);
  return n * 60; // treat plain number as minutes
}

function parseDistance(raw: string): number {
  const s = raw.trim();
  if (s === '') throw new Error('Distance is required.');
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Distance must be greater than 0.');
  return n;
}

/** Format seconds as HH:MM:SS (drops the hour segment when zero). */
function fmtTime(totalSec: number): string {
  const t = Math.round(totalSec);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

/** Format pace seconds-per-unit as M:SS. */
function fmtPace(secPerUnit: number): string {
  const t = Math.round(secPerUnit);
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function round2(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

export default function PaceCalculatorTool() {
  const [solve, setSolve] = useState<Solve>('pace');
  const [distUnit, setDistUnit] = useState<DistUnit>('km');

  const [distance, setDistance] = useState('5');
  const [time, setTime] = useState('25:00');
  const [pace, setPace] = useState('5:00');

  const result = useMemo(() => {
    try {
      // canonical: distance in km, time in seconds
      let distKm: number;
      let timeSec: number;

      if (solve === 'pace') {
        const d = parseDistance(distance);
        distKm = distUnit === 'km' ? d : d * KM_PER_MILE;
        timeSec = parseTime(time);
      } else if (solve === 'time') {
        const d = parseDistance(distance);
        distKm = distUnit === 'km' ? d : d * KM_PER_MILE;
        const paceSec = parsePace(pace); // per selected unit
        const paceSecPerKm = distUnit === 'km' ? paceSec : paceSec / KM_PER_MILE;
        timeSec = paceSecPerKm * distKm;
      } else {
        // distance
        timeSec = parseTime(time);
        const paceSec = parsePace(pace);
        const paceSecPerKm = distUnit === 'km' ? paceSec : paceSec / KM_PER_MILE;
        if (paceSecPerKm <= 0) throw new Error('Pace must be greater than 0.');
        distKm = timeSec / paceSecPerKm;
      }

      if (distKm <= 0) throw new Error('Distance must be greater than 0.');
      if (timeSec <= 0) throw new Error('Time must be greater than 0.');

      const distMi = distKm / KM_PER_MILE;
      const secPerKm = timeSec / distKm;
      const secPerMi = timeSec / distMi;
      const kmh = distKm / (timeSec / 3600);
      const mph = distMi / (timeSec / 3600);

      return {
        error: null as string | null,
        rows: [
          { label: 'Distance', value: `${round2(distKm)} km  /  ${round2(distMi)} mi` },
          { label: 'Time', value: fmtTime(timeSec) },
          { label: 'Pace (per km)', value: `${fmtPace(secPerKm)} /km` },
          { label: 'Pace (per mile)', value: `${fmtPace(secPerMi)} /mi` },
          { label: 'Speed', value: `${round2(kmh)} km/h  /  ${round2(mph)} mph` },
        ],
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err), rows: [] as { label: string; value: string }[] };
    }
  }, [solve, distUnit, distance, time, pace]);

  const showDistance = solve !== 'distance';
  const showTime = solve !== 'time';
  const showPace = solve !== 'pace';

  const copyValue = result.rows.map((r) => `${r.label}: ${r.value}`).join('\n');

  return (
    <Panel>
      <PanelHeader title="Pace & Speed Calculator" />

      <OptionsBar>
        <Field label="Solve for">
          <Tabs value={solve} onValueChange={(v) => setSolve(v as Solve)}>
            <TabsList>
              <TabsTrigger value="pace">Pace</TabsTrigger>
              <TabsTrigger value="time">Time</TabsTrigger>
              <TabsTrigger value="distance">Distance</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label="Distance unit">
          <Select value={distUnit} onValueChange={(v) => setDistUnit(v as DistUnit)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="km">km</SelectItem>
              <SelectItem value="mi">miles</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </OptionsBar>

      <div className="grid gap-4 sm:grid-cols-3">
        {showDistance && (
          <div className="space-y-1.5">
            <Label htmlFor="pace-dist">Distance ({distUnit})</Label>
            <Input
              id="pace-dist"
              inputMode="decimal"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              placeholder="e.g. 5"
            />
          </div>
        )}
        {showTime && (
          <div className="space-y-1.5">
            <Label htmlFor="pace-time">Time (HH:MM:SS)</Label>
            <Input
              id="pace-time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="e.g. 25:00"
            />
          </div>
        )}
        {showPace && (
          <div className="space-y-1.5">
            <Label htmlFor="pace-pace">Pace (M:SS per {distUnit})</Label>
            <Input
              id="pace-pace"
              value={pace}
              onChange={(e) => setPace(e.target.value)}
              placeholder="e.g. 5:00"
            />
          </div>
        )}
      </div>

      <ErrorBanner error={result.error} />

      {!result.error && result.rows.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label>Results</Label>
            <CopyButton value={copyValue} />
          </div>
          <div className="overflow-hidden rounded-md border">
            {result.rows.map((r, i) => (
              <div
                key={r.label}
                className={
                  'flex items-center justify-between gap-3 px-4 py-3 ' +
                  (i % 2 === 1 ? 'bg-muted/40' : '')
                }
              >
                <span className="text-sm text-muted-foreground">{r.label}</span>
                <span className="font-mono tabular-nums">{r.value}</span>
              </div>
            ))}
          </div>
          <StatBar items={[`solving for: ${solve}`, 'enter time as HH:MM:SS or MM:SS']} />
        </div>
      )}
    </Panel>
  );
}
