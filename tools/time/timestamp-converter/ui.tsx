'use client';

import { useEffect, useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Panel, PanelHeader } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

function parseInput(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^-?\d+$/.test(s)) {
    const n = Number(s);
    // Heuristic: 13+ digits = ms, else seconds.
    const ms = s.replace('-', '').length >= 13 ? n : n * 1000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export default function TimestampConverterTool() {
  const [raw, setRaw] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const date = useMemo(() => parseInput(raw), [raw]);
  const error = raw.trim() && !date ? 'Could not parse that as a timestamp or date.' : null;

  const rows: { label: string; value: string }[] = date
    ? [
        { label: 'Unix (s)', value: String(Math.floor(date.getTime() / 1000)) },
        { label: 'Unix (ms)', value: String(date.getTime()) },
        { label: 'ISO 8601', value: date.toISOString() },
        { label: 'UTC', value: date.toUTCString() },
        { label: 'Local', value: date.toString() },
        {
          label: 'Relative',
          value: relative(date.getTime(), now),
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="1716239022, 1716239022000, or 2024-05-20T18:23:42Z"
          className="h-9 max-w-md flex-1 font-mono"
        />
        <Button variant="secondary" size="sm" onClick={() => setRaw(String(Math.floor(Date.now() / 1000)))}>
          Now
        </Button>
      </div>

      <div className="rounded-lg border bg-card px-3 py-2 font-mono text-2xs text-muted-foreground tabular">
        Current: {Math.floor(now / 1000)} s · {now} ms · {new Date(now).toISOString()}
      </div>

      {error && <ErrorBanner error={error} />}

      {date && (
        <Panel>
          <PanelHeader title="Converted" />
          <div className="divide-y">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center gap-3 px-3 py-1.5">
                <span className="w-24 shrink-0 font-mono text-2xs font-medium text-muted-foreground">
                  {r.label}
                </span>
                <code className="min-w-0 flex-1 truncate font-mono text-xs">{r.value}</code>
                <CopyButton value={r.value} size="icon-sm" />
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function relative(then: number, now: number): string {
  const diff = Math.round((then - now) / 1000);
  const abs = Math.abs(diff);
  const units: [number, string][] = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [30, 'day'],
    [12, 'month'],
    [Number.POSITIVE_INFINITY, 'year'],
  ];
  let value = abs;
  let unit = 'second';
  let acc = 1;
  for (const [size, name] of units) {
    if (value < size) {
      unit = name;
      break;
    }
    value = Math.floor(value / size);
    acc *= size;
    unit = name;
  }
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  return rtf.format(diff < 0 ? -value : value, unit as Intl.RelativeTimeFormatUnit);
}
