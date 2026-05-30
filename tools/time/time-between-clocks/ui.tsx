'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

function parseClock(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const segs = trimmed.split(':');
  if (segs.length < 2 || segs.length > 3) return null;
  const h = Number(segs[0]);
  const m = Number(segs[1]);
  const s = segs[2] === undefined ? 0 : Number(segs[2]);
  if (!Number.isInteger(h) || !Number.isInteger(m) || !Number.isInteger(s)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return null;
  return h * 3600 + m * 60 + s;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function fmtHMS(totalSec: number): string {
  const hh = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

type Row = { label: string; value: string };

type Result = { error: string } | { rows: Row[]; copy: string; wrapped: boolean };

export default function TimeBetweenClocks() {
  const [start, setStart] = useState<string>('22:30');
  const [end, setEnd] = useState<string>('06:15');
  const [wrap, setWrap] = useState<boolean>(true);

  const result = useMemo<Result>(() => {
    const startSec = parseClock(start);
    const endSec = parseClock(end);
    if (startSec === null) return { error: 'Enter a valid start time (HH:MM or HH:MM:SS).' };
    if (endSec === null) return { error: 'Enter a valid end time (HH:MM or HH:MM:SS).' };

    let diff = endSec - startSec;
    let wrapped = false;
    if (diff < 0) {
      if (wrap) {
        diff += 86400;
        wrapped = true;
      } else {
        return {
          error:
            'End time is before start time. Enable "Crosses midnight" to wrap to the next day.',
        };
      }
    } else if (diff === 0) {
      // Exactly equal: zero duration (could also be a full day, but we treat as 0).
      diff = 0;
    }

    const totalMinutes = diff / 60;
    const totalHours = diff / 3600;

    return {
      wrapped,
      copy: fmtHMS(diff),
      rows: [
        { label: 'Duration (HH:MM:SS)', value: fmtHMS(diff) },
        { label: 'Total hours (decimal)', value: totalHours.toFixed(4) },
        { label: 'Total minutes', value: totalMinutes.toFixed(2) },
        { label: 'Total seconds', value: String(diff) },
        { label: 'Crosses midnight', value: wrapped ? 'Yes (next day)' : 'No' },
      ],
    };
  }, [start, end, wrap]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Clock Time Difference" />
        <OptionsBar>
          <Field label="Start time">
            <Input
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-32 font-mono"
              placeholder="HH:MM"
            />
          </Field>
          <Field label="End time">
            <Input
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-32 font-mono"
              placeholder="HH:MM"
            />
          </Field>
          <Field label="Crosses midnight" hint="Wrap when end is before start">
            <Switch checked={wrap} onCheckedChange={setWrap} />
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
            items={[result.wrapped ? 'Wrapped past midnight' : 'Same day', 'Pure clock math']}
          />
        </Panel>
      )}
    </div>
  );
}
