'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type Direction = 'next' | 'previous';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function fmtIso(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

interface Occurrence {
  iso: string;
  weekday: string;
  daysFromStart: number;
}

type Result =
  | { error: string }
  | {
      target: Occurrence;
      list: Occurrence[];
      startWeekday: string;
    };

function compute(
  startStr: string,
  targetDow: number,
  direction: Direction,
  n: number,
  includeStart: boolean,
): Result {
  const text = startStr.trim();
  if (!text) return { error: 'Pick a start date.' };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return { error: 'Start date must be YYYY-MM-DD.' };
  const y = Number(m[1] ?? '');
  const mo = Number(m[2] ?? '');
  const da = Number(m[3] ?? '');
  if (![y, mo, da].every(Number.isFinite)) return { error: 'Invalid start date.' };
  if (!Number.isInteger(n) || n < 1) return { error: 'Occurrence N must be a positive integer.' };
  if (n > 520) return { error: 'Occurrence N is too large (max 520).' };

  const startMs = Date.UTC(y, mo - 1, da);
  const start = new Date(startMs);
  if (Number.isNaN(start.getTime()) || start.getUTCMonth() !== mo - 1 || start.getUTCDate() !== da) {
    return { error: 'That start date does not exist.' };
  }
  const startDow = start.getUTCDay();

  // Days to the first occurrence in the chosen direction.
  let firstDelta: number;
  if (direction === 'next') {
    firstDelta = ((targetDow - startDow + 7) % 7);
    if (firstDelta === 0 && !includeStart) firstDelta = 7;
  } else {
    firstDelta = -((startDow - targetDow + 7) % 7);
    if (firstDelta === 0 && !includeStart) firstDelta = -7;
  }

  const step = direction === 'next' ? 7 : -7;

  const makeOcc = (k: number): Occurrence => {
    const delta = firstDelta + step * k;
    const d = new Date(startMs + delta * 86400000);
    return {
      iso: fmtIso(d),
      weekday: WEEKDAYS[d.getUTCDay()] ?? '',
      daysFromStart: delta,
    };
  };

  const target = makeOcc(n - 1);
  const list: Occurrence[] = [];
  for (let k = 0; k < 8; k++) list.push(makeOcc(k));

  return { target, list, startWeekday: WEEKDAYS[startDow] ?? '' };
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export default function NextWeekdayOccurrenceTool() {
  const [startStr, setStartStr] = useState(todayStr());
  const [targetDow, setTargetDow] = useState('1');
  const [direction, setDirection] = useState<Direction>('next');
  const [nStr, setNStr] = useState('1');
  const [includeStart, setIncludeStart] = useState(false);

  const result = useMemo(
    () => compute(startStr, Number(targetDow), direction, Number(nStr), includeStart),
    [startStr, targetDow, direction, nStr, includeStart],
  );

  const ordinal = (k: number): string => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = k % 100;
    const suffix = s[(v - 20) % 10] ?? s[v] ?? 'th';
    return `${k}${suffix}`;
  };

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Start date">
            <Input type="date" value={startStr} onChange={(e) => setStartStr(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Target weekday">
            <Select value={targetDow} onValueChange={setTargetDow}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map((name, i) => (
                  <SelectItem key={name} value={String(i)}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Direction">
            <Tabs value={direction} onValueChange={(v) => setDirection(v as Direction)}>
              <TabsList>
                <TabsTrigger value="next">Next</TabsTrigger>
                <TabsTrigger value="previous">Previous</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Occurrence (N)">
            <Input value={nStr} onChange={(e) => setNStr(e.target.value)} inputMode="numeric" className="w-20 font-mono" />
          </Field>
          <Field label="Include start date">
            <Switch checked={includeStart} onCheckedChange={setIncludeStart} />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton value={result.target.iso} />
          </PanelHeader>
          <div className="rounded-lg border bg-card p-5 text-center">
            <div className="font-mono text-3xl font-semibold">{result.target.iso}</div>
            <div className="text-2xs text-muted-foreground">
              {ordinal(Number(nStr) || 1)} {direction === 'next' ? 'upcoming' : 'previous'} {result.target.weekday}
              {' · '}{result.target.daysFromStart >= 0 ? '+' : ''}{result.target.daysFromStart} days from start
            </div>
          </div>
          <div className="border-t">
            <div className="px-3 pt-2 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              {direction === 'next' ? 'Upcoming' : 'Preceding'} occurrences
            </div>
            <div className="divide-y">
              {result.list.map((o, i) => (
                <div key={`${o.iso}-${i}`} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-6 shrink-0 text-2xs text-muted-foreground">{i + 1}.</span>
                  <code className="w-28 shrink-0 font-mono text-sm">{o.iso}</code>
                  <span className="min-w-0 flex-1 text-sm">{o.weekday}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{o.daysFromStart >= 0 ? '+' : ''}{o.daysFromStart}d</span>
                  <CopyButton value={o.iso} size="icon-sm" />
                </div>
              ))}
            </div>
          </div>
          <StatBar items={[`Start was a ${result.startWeekday}`, includeStart ? 'including start date' : 'excluding start date']} />
        </Panel>
      )}
    </div>
  );
}
