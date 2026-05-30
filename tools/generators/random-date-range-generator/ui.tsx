'use client';

import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

type Format = 'iso' | 'unix-s' | 'unix-ms' | 'date' | 'custom';

function rand(): number {
  const a = new Uint32Array(1);
  wc.getRandomValues(a);
  return (a[0] ?? 0) / 4294967296;
}

function pad(n: number, w: number): string {
  return String(n).padStart(w, '0');
}

function applyTokens(d: Date, fmt: string): string {
  const map: Record<string, string> = {
    YYYY: pad(d.getFullYear(), 4),
    MM: pad(d.getMonth() + 1, 2),
    DD: pad(d.getDate(), 2),
    HH: pad(d.getHours(), 2),
    mm: pad(d.getMinutes(), 2),
    ss: pad(d.getSeconds(), 2),
  };
  return fmt.replace(/YYYY|MM|DD|HH|mm|ss/g, (t) => map[t] ?? t);
}

function formatOne(ms: number, fmt: Format, custom: string, withTime: boolean): string {
  const d = new Date(ms);
  switch (fmt) {
    case 'iso':
      return withTime ? d.toISOString() : `${d.toISOString().slice(0, 10)}`;
    case 'unix-s':
      return String(Math.floor(ms / 1000));
    case 'unix-ms':
      return String(ms);
    case 'date':
      return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`;
    case 'custom':
      return applyTokens(d, custom || 'YYYY-MM-DD HH:mm:ss');
    default:
      return d.toISOString();
  }
}

function isWeekday(ms: number): boolean {
  const day = new Date(ms).getDay();
  return day !== 0 && day !== 6;
}

export default function RandomDatetimeGenerator() {
  const [start, setStart] = useState('2020-01-01T00:00');
  const [end, setEnd] = useState('2025-12-31T23:59');
  const [count, setCount] = useState('10');
  const [format, setFormat] = useState<Format>('iso');
  const [custom, setCustom] = useState('YYYY/MM/DD HH:mm:ss');
  const [withTime, setWithTime] = useState(true);
  const [sortAsc, setSortAsc] = useState(false);
  const [weekdaysOnly, setWeekdaysOnly] = useState(false);
  const [seed, setSeed] = useState(0);

  const result = useMemo(() => {
    void seed;
    const startMs = Date.parse(start);
    const endMs = Date.parse(end);
    if (!Number.isFinite(startMs)) return { error: 'Invalid start datetime.' };
    if (!Number.isFinite(endMs)) return { error: 'Invalid end datetime.' };
    if (endMs <= startMs) return { error: 'End must be after start.' };
    const n = Math.min(1000, Math.max(1, Math.round(Number(count) || 1)));

    const values: number[] = [];
    let attempts = 0;
    const maxAttempts = n * 200 + 1000;
    while (values.length < n && attempts < maxAttempts) {
      attempts += 1;
      let ms = startMs + Math.floor(rand() * (endMs - startMs));
      if (!withTime) {
        const d = new Date(ms);
        d.setHours(0, 0, 0, 0);
        ms = d.getTime();
        if (ms < startMs) ms = startMs;
      }
      if (weekdaysOnly && !isWeekday(ms)) continue;
      values.push(ms);
    }
    if (values.length === 0) {
      return { error: 'No matching dates (range may contain no weekdays).' };
    }
    if (sortAsc) values.sort((a, b) => a - b);
    const lines = values.map((ms) => formatOne(ms, format, custom, withTime));
    return { lines };
  }, [start, end, count, format, custom, withTime, sortAsc, weekdaysOnly, seed]);

  const text = 'lines' in result && result.lines ? result.lines.join('\n') : '';

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Start">
          <Input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="font-mono"
          />
        </Field>
        <Field label="End">
          <Input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="font-mono"
          />
        </Field>
        <Field label="Count" className="w-24">
          <Input
            type="number"
            min={1}
            max={1000}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="font-mono"
          />
        </Field>
        <Field label="Format">
          <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="iso">ISO 8601</SelectItem>
              <SelectItem value="unix-s">Unix (seconds)</SelectItem>
              <SelectItem value="unix-ms">Unix (milliseconds)</SelectItem>
              <SelectItem value="date">YYYY-MM-DD</SelectItem>
              <SelectItem value="custom">Custom tokens</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {format === 'custom' && (
          <Field label="Token format" hint="YYYY MM DD HH mm ss">
            <Input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              className="w-48 font-mono"
            />
          </Field>
        )}
        <Field label="Time of day">
          <div className="flex h-9 items-center gap-2">
            <Switch id="rd-time" checked={withTime} onCheckedChange={setWithTime} />
            <Label htmlFor="rd-time" className="text-xs">
              {withTime ? 'Include' : 'Midnight'}
            </Label>
          </div>
        </Field>
        <Field label="Sort">
          <div className="flex h-9 items-center gap-2">
            <Switch id="rd-sort" checked={sortAsc} onCheckedChange={setSortAsc} />
            <Label htmlFor="rd-sort" className="text-xs">
              Ascending
            </Label>
          </div>
        </Field>
        <Field label="Weekdays">
          <div className="flex h-9 items-center gap-2">
            <Switch
              id="rd-weekday"
              checked={weekdaysOnly}
              onCheckedChange={setWeekdaysOnly}
            />
            <Label htmlFor="rd-weekday" className="text-xs">
              Business only
            </Label>
          </div>
        </Field>
        <div className="ml-auto flex items-end">
          <Button variant="secondary" size="sm" onClick={() => setSeed((s) => s + 1)}>
            <RefreshCw className="size-3.5" />
            Regenerate
          </Button>
        </div>
      </OptionsBar>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Datetimes">
            <CopyButton value={() => text} label="Copy all" disabled={!text} />
            <DownloadButton data={() => text} filename="datetimes.txt" disabled={!text} />
          </PanelHeader>
          <div className="max-h-[420px] divide-y overflow-auto">
            {result.lines.map((line, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-1.5">
                <span className="w-8 shrink-0 text-right font-mono text-2xs text-muted-foreground tabular">
                  {i + 1}
                </span>
                <code className="min-w-0 flex-1 truncate font-mono text-xs">{line}</code>
                <CopyButton value={line} size="icon-sm" />
              </div>
            ))}
          </div>
          <StatBar items={[`${result.lines.length} generated`, `format: ${format}`]} />
        </Panel>
      )}
    </div>
  );
}
