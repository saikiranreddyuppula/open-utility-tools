'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

function isGregorianLeap(y: number): boolean {
  if (y % 4 !== 0) return false;
  if (y % 100 !== 0) return true;
  return y % 400 === 0;
}

function gregorianReason(y: number): string {
  if (y % 4 !== 0) return `${y} is not divisible by 4 → common year.`;
  if (y % 100 !== 0) return `${y} is divisible by 4 and not by 100 → leap year.`;
  if (y % 400 !== 0) return `${y} is divisible by 100 but not by 400 → common year (century exception).`;
  return `${y} is divisible by 400 → leap year (century exception override).`;
}

function nextLeap(from: number, dir: 1 | -1): number {
  let y = from + dir;
  while (!isGregorianLeap(y) && Math.abs(y - from) < 16) y += dir;
  return y;
}

type Result =
  | { error: string }
  | {
      year: number;
      leap: boolean;
      reason: string;
      days: number;
      febDays: number;
      next: number;
      prev: number;
      julianLeap: boolean;
      rangeLeaps: number[] | null;
      rangeEnd: number | null;
    };

function compute(yearStr: string, useRange: boolean, endStr: string): Result {
  const y = Number(yearStr.trim());
  if (!Number.isInteger(y)) return { error: 'Enter a whole-number year.' };
  if (Math.abs(y) > 9999999) return { error: 'Year is unreasonably large.' };

  let rangeLeaps: number[] | null = null;
  let rangeEnd: number | null = null;
  if (useRange) {
    const end = Number(endStr.trim());
    if (!Number.isInteger(end)) return { error: 'Enter a whole-number end year for the range.' };
    const lo = Math.min(y, end);
    const hi = Math.max(y, end);
    if (hi - lo > 2000) return { error: 'Range is too large (max 2000 years).' };
    rangeEnd = end;
    rangeLeaps = [];
    for (let v = lo; v <= hi; v++) {
      if (isGregorianLeap(v)) rangeLeaps.push(v);
    }
  }

  const leap = isGregorianLeap(y);
  return {
    year: y,
    leap,
    reason: gregorianReason(y),
    days: leap ? 366 : 365,
    febDays: leap ? 29 : 28,
    next: nextLeap(y, 1),
    prev: nextLeap(y, -1),
    julianLeap: y % 4 === 0,
    rangeLeaps,
    rangeEnd,
  };
}

export default function LeapYearCheckerTool() {
  const [yearStr, setYearStr] = useState('2024');
  const [useRange, setUseRange] = useState(false);
  const [endStr, setEndStr] = useState('2050');

  const result = useMemo(() => compute(yearStr, useRange, endStr), [yearStr, useRange, endStr]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label={useRange ? 'Start year' : 'Year'}>
            <Input value={yearStr} onChange={(e) => setYearStr(e.target.value)} inputMode="numeric" className="w-32 font-mono" />
          </Field>
          {useRange && (
            <Field label="End year">
              <Input value={endStr} onChange={(e) => setEndStr(e.target.value)} inputMode="numeric" className="w-32 font-mono" />
            </Field>
          )}
          <Field label="Range mode">
            <Switch checked={useRange} onCheckedChange={setUseRange} />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title={`${result.year}`}>
            <CopyButton
              value={() =>
                `${result.year} is ${result.leap ? 'a leap year' : 'not a leap year'}. ${result.reason}`
              }
            />
          </PanelHeader>
          <div className="flex flex-col items-center gap-2 rounded-lg border bg-card p-5 text-center">
            <Badge variant={result.leap ? 'default' : 'secondary'} className="text-base">
              {result.leap ? 'Leap year — 366 days' : 'Common year — 365 days'}
            </Badge>
            <div className="max-w-md text-sm text-muted-foreground">{result.reason}</div>
          </div>
          <div className="divide-y">
            {[
              ['Days in year', String(result.days)],
              ['Days in February', String(result.febDays)],
              ['Previous leap year', String(result.prev)],
              ['Next leap year', String(result.next)],
              ['Julian-calendar rule (÷4)', result.julianLeap ? 'leap' : 'common'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-3 py-2">
                <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{k}</span>
                <span className="font-mono text-sm font-semibold">{v}</span>
              </div>
            ))}
          </div>
          {result.rangeLeaps && (
            <div className="border-t p-3">
              <div className="mb-2 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                Leap years in range ({result.rangeLeaps.length})
              </div>
              {result.rangeLeaps.length === 0 ? (
                <div className="text-sm text-muted-foreground">None in this range.</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {result.rangeLeaps.map((v) => (
                    <code key={v} className="rounded border bg-muted/40 px-1.5 py-0.5 font-mono text-xs">{v}</code>
                  ))}
                </div>
              )}
            </div>
          )}
          <StatBar items={result.rangeEnd !== null ? [`Range ${Math.min(result.year, result.rangeEnd)}–${Math.max(result.year, result.rangeEnd)}`] : ['Gregorian calendar']} />
        </Panel>
      )}
    </div>
  );
}
