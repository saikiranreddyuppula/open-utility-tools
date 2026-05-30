'use client';

import { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

type Mode = 'timeToBeats' | 'beatsToTime';

// BMT = Biel Mean Time = UTC+1, no DST.
const BMT_OFFSET_MIN = 60;

function pad(n: number, width: number): string {
  return n.toString().padStart(width, '0');
}

function secondsToClock(sec: number): string {
  const s = ((sec % 86400) + 86400) % 86400;
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  return `${pad(hh, 2)}:${pad(mm, 2)}:${pad(ss, 2)}`;
}

const OFFSETS: { value: string; label: string }[] = [
  { value: '-720', label: 'UTC-12:00' },
  { value: '-600', label: 'UTC-10:00 (HST)' },
  { value: '-480', label: 'UTC-08:00 (PST)' },
  { value: '-420', label: 'UTC-07:00 (MST)' },
  { value: '-360', label: 'UTC-06:00 (CST)' },
  { value: '-300', label: 'UTC-05:00 (EST)' },
  { value: '0', label: 'UTC+00:00' },
  { value: '60', label: 'UTC+01:00 (BMT/CET)' },
  { value: '120', label: 'UTC+02:00' },
  { value: '330', label: 'UTC+05:30 (IST)' },
  { value: '480', label: 'UTC+08:00' },
  { value: '540', label: 'UTC+09:00 (JST)' },
  { value: '600', label: 'UTC+10:00' },
  { value: '780', label: 'UTC+13:00' },
];

type Row = { label: string; value: string };

type Result = { error: string } | { rows: Row[]; copy: string };

export default function SwatchInternetTime() {
  const [mode, setMode] = useState<Mode>('timeToBeats');
  const [localTime, setLocalTime] = useState<string>('12:00:00');
  const [offset, setOffset] = useState<string>('0');
  const [beats, setBeats] = useState<string>('500');

  const result = useMemo<Result>(() => {
    const off = Number(offset);
    if (!Number.isFinite(off)) return { error: 'Choose a valid UTC offset.' };

    if (mode === 'timeToBeats') {
      const parts = localTime.split(':');
      const hh = Number(parts[0]);
      const mm = Number(parts[1] ?? '0');
      const ss = Number(parts[2] ?? '0');
      if (
        !Number.isFinite(hh) ||
        !Number.isFinite(mm) ||
        !Number.isFinite(ss) ||
        hh < 0 ||
        hh > 23 ||
        mm < 0 ||
        mm > 59 ||
        ss < 0 ||
        ss > 59
      ) {
        return { error: 'Enter a valid time as HH:MM or HH:MM:SS.' };
      }
      const localSec = hh * 3600 + mm * 60 + ss;
      // Convert local time of day to BMT seconds since BMT midnight.
      const bmtSec = localSec - off * 60 + BMT_OFFSET_MIN * 60;
      const beatsVal = (((bmtSec % 86400) + 86400) % 86400) / 86.4;
      return {
        copy: `@${pad(Math.floor(beatsVal), 3)}`,
        rows: [
          { label: 'Beats (@)', value: `@${pad(Math.floor(beatsVal), 3)}` },
          { label: 'Beats (precise)', value: `@${beatsVal.toFixed(2)}` },
          { label: 'BMT clock (UTC+1)', value: secondsToClock(bmtSec) },
          { label: 'Local time', value: secondsToClock(localSec) },
        ],
      };
    }

    const b = Number(beats);
    if (!Number.isFinite(b)) return { error: 'Enter a valid beats value (0-999).' };
    const bmtSec = (((b % 1000) + 1000) % 1000) * 86.4;
    // Convert BMT seconds since BMT midnight to chosen offset local time.
    const localSec = bmtSec - BMT_OFFSET_MIN * 60 + off * 60;
    return {
      copy: secondsToClock(localSec),
      rows: [
        { label: 'Local time', value: secondsToClock(localSec) },
        { label: 'BMT clock (UTC+1)', value: secondsToClock(bmtSec) },
        { label: 'Beats (@)', value: `@${pad(Math.floor(((b % 1000) + 1000) % 1000), 3)}` },
      ],
    };
  }, [mode, localTime, offset, beats]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Swatch Internet Time" />
        <OptionsBar>
          <Field label="Direction">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="timeToBeats">Time to beats</TabsTrigger>
                <TabsTrigger value="beatsToTime">Beats to time</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>
        <OptionsBar>
          {mode === 'timeToBeats' ? (
            <Field label="Local time (HH:MM:SS)">
              <Input
                value={localTime}
                onChange={(e) => setLocalTime(e.target.value)}
                className="w-40 font-mono"
              />
            </Field>
          ) : (
            <Field label="Beats (0-999)">
              <Input
                value={beats}
                onChange={(e) => setBeats(e.target.value)}
                inputMode="decimal"
                className="w-32 font-mono"
              />
            </Field>
          )}
          <Field label="UTC offset for local time">
            <Select value={offset} onValueChange={setOffset}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OFFSETS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton value={() => result.copy} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {result.rows.map((r) => (
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
              '1 day = 1000 beats; 1 beat = 86.4 s',
              'Based on Biel Mean Time (UTC+1, no DST)',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
