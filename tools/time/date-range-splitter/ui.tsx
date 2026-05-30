'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type Mode = 'equal' | 'fixed';
type Unit = 'days' | 'weeks' | 'months';

const DAY = 86400000;

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d.getTime());
  const targetMonth = r.getMonth() + n;
  r.setDate(1);
  r.setMonth(targetMonth);
  // clamp day to month length
  const lastDay = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(d.getDate(), lastDay));
  return r;
}

interface Chunk {
  start: string;
  end: string;
  days: number;
}

function compute(
  startStr: string,
  endStr: string,
  mode: Mode,
  nStr: string,
  kStr: string,
  unit: Unit,
): { chunks: Chunk[]; total: number } | { error: string } {
  const sMs = Date.parse(startStr);
  const eMs = Date.parse(endStr);
  if (!Number.isFinite(sMs)) return { error: 'Enter a valid start date.' };
  if (!Number.isFinite(eMs)) return { error: 'Enter a valid end date.' };
  if (eMs <= sMs) return { error: 'End date must be after start date.' };

  const start = new Date(sMs);
  const end = new Date(eMs);
  const totalDays = Math.round((eMs - sMs) / DAY);
  const chunks: Chunk[] = [];

  if (mode === 'equal') {
    const n = Math.floor(Number(nStr));
    if (!Number.isFinite(n) || n < 1) return { error: 'Enter a chunk count of at least 1.' };
    if (n > 1000) return { error: 'Chunk count too large (max 1000).' };
    const span = eMs - sMs;
    for (let i = 0; i < n; i++) {
      const cs = new Date(sMs + Math.round((span * i) / n));
      const ce = new Date(sMs + Math.round((span * (i + 1)) / n));
      chunks.push({ start: fmt(cs), end: fmt(ce), days: Math.round((ce.getTime() - cs.getTime()) / DAY) });
    }
    return { chunks, total: totalDays };
  }

  // fixed buckets
  const k = Math.floor(Number(kStr));
  if (!Number.isFinite(k) || k < 1) return { error: 'Enter a bucket length of at least 1.' };
  let cursor = new Date(start.getTime());
  let guard = 0;
  while (cursor.getTime() < end.getTime() && guard < 10000) {
    let next: Date;
    if (unit === 'days') next = new Date(cursor.getTime() + k * DAY);
    else if (unit === 'weeks') next = new Date(cursor.getTime() + k * 7 * DAY);
    else next = addMonths(cursor, k);
    if (next.getTime() > end.getTime()) next = new Date(end.getTime());
    chunks.push({
      start: fmt(cursor),
      end: fmt(next),
      days: Math.round((next.getTime() - cursor.getTime()) / DAY),
    });
    cursor = next;
    guard++;
  }
  if (guard >= 10000) return { error: 'Too many buckets — increase the bucket length.' };
  return { chunks, total: totalDays };
}

function defaultStart(): string {
  return fmt(new Date());
}
function defaultEnd(): string {
  return fmt(new Date(Date.now() + 90 * DAY));
}

export default function DateRangeSplitter() {
  const [start, setStart] = useState(defaultStart());
  const [end, setEnd] = useState(defaultEnd());
  const [mode, setMode] = useState<Mode>('fixed');
  const [n, setN] = useState('4');
  const [k, setK] = useState('1');
  const [unit, setUnit] = useState<Unit>('weeks');

  const result = useMemo(
    () => compute(start, end, mode, n, k, unit),
    [start, end, mode, n, k, unit],
  );

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Start date">
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="End date">
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="equal">N equal</TabsTrigger>
                <TabsTrigger value="fixed">Fixed length</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === 'equal' ? (
            <Field label="Number of chunks">
              <Input type="number" value={n} onChange={(e) => setN(e.target.value)} className="w-28" />
            </Field>
          ) : (
            <>
              <Field label="Bucket length">
                <Input type="number" value={k} onChange={(e) => setK(e.target.value)} className="w-24" />
              </Field>
              <Field label="Unit">
                <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">days</SelectItem>
                    <SelectItem value="weeks">weeks</SelectItem>
                    <SelectItem value="months">months</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Sub-ranges">
            <CopyButton value={() => result.chunks.map((c) => `${c.start}\t${c.end}\t${c.days}d`).join('\n')} />
          </PanelHeader>
          <div className="max-h-[480px] divide-y overflow-auto">
            <div className="flex items-center gap-3 bg-muted/40 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span className="w-8 shrink-0 text-right">#</span>
              <span className="w-32 shrink-0">Start</span>
              <span className="w-32 shrink-0">End</span>
              <span className="flex-1">Length</span>
            </div>
            {result.chunks.map((c, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2">
                <span className="w-8 shrink-0 text-right font-mono text-2xs text-muted-foreground">{i + 1}</span>
                <code className="w-32 shrink-0 font-mono text-sm">{c.start}</code>
                <code className="w-32 shrink-0 font-mono text-sm">{c.end}</code>
                <span className="flex-1 font-mono text-xs text-muted-foreground">{c.days} days</span>
              </div>
            ))}
          </div>
          <StatBar items={[`${result.chunks.length} sub-ranges`, `${result.total} days total`]} />
        </Panel>
      )}
    </div>
  );
}
