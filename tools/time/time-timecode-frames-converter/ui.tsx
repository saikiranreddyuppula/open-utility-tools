'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Direction = 'tc2frames' | 'frames2tc';
type RatePreset = '24' | '25' | '30' | '60' | '29.97';

interface RateInfo {
  fps: number; // nominal frames per second used for the integer frame grid
  dropCapable: boolean;
}

const RATES: Record<RatePreset, RateInfo> = {
  '24': { fps: 24, dropCapable: false },
  '25': { fps: 25, dropCapable: false },
  '30': { fps: 30, dropCapable: false },
  '60': { fps: 60, dropCapable: false },
  '29.97': { fps: 30, dropCapable: true },
};

/** Frames-per-frame-grid for drop-frame (29.97 → 30 grid, drops 2 frames/min except every 10th). */
function framesToTimecode(
  frames: number,
  fps: number,
  drop: boolean,
  sep: string,
): string {
  let f = frames;
  if (drop) {
    // 29.97: drop 2 frame numbers each minute except minutes divisible by 10.
    const dropFrames = 2;
    const framesPer10Min = 17982; // 10 * 60 * 30 - 9 * 2
    const framesPerMin = 1798; // 60 * 30 - 2
    const d = Math.floor(f / framesPer10Min);
    const m = f % framesPer10Min;
    if (m < dropFrames) {
      f += dropFrames * 9 * d;
    } else {
      f += dropFrames * 9 * d + dropFrames * Math.floor((m - dropFrames) / framesPerMin);
    }
  }
  const ff = f % fps;
  const totalSeconds = Math.floor(f / fps);
  const ss = totalSeconds % 60;
  const mm = Math.floor(totalSeconds / 60) % 60;
  const hh = Math.floor(totalSeconds / 3600) % 24;
  const frameSep = drop ? sep : ':';
  return (
    `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:` +
    `${String(ss).padStart(2, '0')}${frameSep}${String(ff).padStart(2, '0')}`
  );
}

function timecodeToFrames(
  tc: string,
  fps: number,
  drop: boolean,
): number | { error: string } {
  const m = tc.trim().match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})[:;.](\d{1,2})$/);
  if (!m) return { error: 'Timecode must look like HH:MM:SS:FF (or HH:MM:SS;FF for drop-frame).' };
  const hh = Number(m[1] ?? '');
  const mm = Number(m[2] ?? '');
  const ss = Number(m[3] ?? '');
  const ff = Number(m[4] ?? '');
  if (![hh, mm, ss, ff].every((n) => Number.isFinite(n))) {
    return { error: 'Timecode contains a non-numeric field.' };
  }
  if (mm > 59 || ss > 59) return { error: 'Minutes and seconds must be 0–59.' };
  if (ff >= fps) return { error: `Frame field must be 0–${fps - 1} at this rate.` };

  const totalMinutes = hh * 60 + mm;
  if (drop && ss === 0 && mm % 10 !== 0 && ff < 2) {
    return { error: `Frames 00–01 are dropped at minute boundaries in drop-frame (got ${String(ff).padStart(2, '0')}).` };
  }
  let frames = (hh * 3600 + mm * 60 + ss) * fps + ff;
  if (drop) {
    const dropFrames = 2;
    frames -= dropFrames * (totalMinutes - Math.floor(totalMinutes / 10));
  }
  return frames;
}

export default function TimecodeFramesConverter() {
  const [direction, setDirection] = useState<Direction>('tc2frames');
  const [preset, setPreset] = useState<RatePreset>('29.97');
  const [drop, setDrop] = useState(true);
  const [tcInput, setTcInput] = useState('01:00:00;00');
  const [framesInput, setFramesInput] = useState('107892');

  const rate = RATES[preset];
  const dropActive = rate.dropCapable && drop;
  const effFps = dropActive ? 30 / 1.001 : rate.fps; // true playback fps for seconds calc

  const result = useMemo(() => {
    const sep = ';';
    if (direction === 'tc2frames') {
      const r = timecodeToFrames(tcInput, rate.fps, dropActive);
      if (typeof r !== 'number') return { error: r.error };
      const seconds = r / effFps;
      return {
        primary: `${r} frames`,
        primaryRaw: String(r),
        seconds,
        roundTrip: framesToTimecode(r, rate.fps, dropActive, sep),
      };
    }
    const n = Number(framesInput);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      return { error: 'Enter a non-negative whole frame count.' };
    }
    const tc = framesToTimecode(n, rate.fps, dropActive, sep);
    const seconds = n / effFps;
    return {
      primary: tc,
      primaryRaw: tc,
      seconds,
      roundTrip: tc,
    };
  }, [direction, tcInput, framesInput, rate.fps, dropActive, effFps]);

  const isError = 'error' in result;

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Direction">
            <Tabs value={direction} onValueChange={(v) => setDirection(v as Direction)}>
              <TabsList>
                <TabsTrigger value="tc2frames">Timecode → Frames</TabsTrigger>
                <TabsTrigger value="frames2tc">Frames → Timecode</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Frame rate">
            <Select value={preset} onValueChange={(v) => setPreset(v as RatePreset)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">24 fps</SelectItem>
                <SelectItem value="25">25 fps (PAL)</SelectItem>
                <SelectItem value="30">30 fps</SelectItem>
                <SelectItem value="60">60 fps</SelectItem>
                <SelectItem value="29.97">29.97 fps (NTSC)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Drop-frame" hint={rate.dropCapable ? 'Semicolon separator' : 'Only for 29.97'}>
            <Switch checked={dropActive} disabled={!rate.dropCapable} onCheckedChange={setDrop} />
          </Field>
        </OptionsBar>
        <OptionsBar>
          {direction === 'tc2frames' ? (
            <Field label="Timecode" className="min-w-[220px] flex-1">
              <Input
                value={tcInput}
                onChange={(e) => setTcInput(e.target.value)}
                placeholder="HH:MM:SS:FF"
                className="font-mono"
              />
            </Field>
          ) : (
            <Field label="Total frames" className="min-w-[220px] flex-1">
              <Input
                value={framesInput}
                onChange={(e) => setFramesInput(e.target.value)}
                inputMode="numeric"
                className="font-mono"
              />
            </Field>
          )}
        </OptionsBar>
      </Panel>

      {isError ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Converted">
            <CopyButton value={result.primaryRaw} />
          </PanelHeader>
          <div className="rounded-lg p-5 text-center">
            <div className="font-mono text-3xl font-semibold">{result.primary}</div>
          </div>
          <div className="grid grid-cols-1 gap-3 px-3 pb-3 sm:grid-cols-3">
            {[
              { label: 'Result', value: result.primary },
              { label: 'Real-time seconds', value: result.seconds.toFixed(3) },
              { label: 'Round-trip timecode', value: result.roundTrip },
            ].map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="text-sm text-muted-foreground">{r.label}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span>{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar
            items={[
              `${preset} fps`,
              dropActive ? 'drop-frame' : 'non-drop',
              `grid ${rate.fps} f/s`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
