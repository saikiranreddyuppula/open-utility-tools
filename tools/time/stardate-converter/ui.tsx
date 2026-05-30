'use client';

import { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

type Mode = 'dateToStardate' | 'stardateToDate';

const EPOCH_YEAR = 2323; // 2323-01-01 = stardate 0 in the popular TNG film-era convention

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

function pad(n: number, width: number): string {
  return n.toString().padStart(width, '0');
}

function formatISO(y: number, m: number, d: number): string {
  return `${pad(y, 4)}-${pad(m + 1, 2)}-${pad(d, 2)}`;
}

function parseISODate(value: string): { y: number; m: number; d: number } | null {
  if (!value) return null;
  const parts = value.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return { y, m, d };
}

function dayOfYear(y: number, m: number, d: number): number {
  const start = Date.UTC(y, 0, 1);
  const current = Date.UTC(y, m, d);
  return Math.floor((current - start) / 86400000); // 0-based fraction of the year
}

type Row = { label: string; value: string };

type Result = { error: string } | { rows: Row[]; copy: string };

export default function StardateConverter() {
  const [mode, setMode] = useState<Mode>('dateToStardate');
  const [dateValue, setDateValue] = useState<string>('2364-01-01');
  const [stardate, setStardate] = useState<string>('41000.0');

  const result = useMemo<Result>(() => {
    if (mode === 'dateToStardate') {
      const parsed = parseISODate(dateValue);
      if (!parsed) return { error: 'Enter a valid date.' };
      const { y, m, d } = parsed;
      // Use 0-based month index for arithmetic.
      const doy = dayOfYear(y, m - 1, d);
      const frac = doy / daysInYear(y);
      const sd = 1000 * (y - EPOCH_YEAR) + frac * 1000;
      return {
        copy: sd.toFixed(1),
        rows: [
          { label: 'Stardate', value: sd.toFixed(1) },
          { label: 'Year offset (×1000)', value: String(y - EPOCH_YEAR) },
          { label: 'Day-of-year fraction', value: `${(frac * 1000).toFixed(1)}` },
          { label: 'Gregorian date', value: formatISO(y, m - 1, d) },
        ],
      };
    }
    const sd = Number(stardate);
    if (!Number.isFinite(sd)) return { error: 'Enter a valid stardate number.' };
    if (sd < 0) return { error: 'This convention only supports stardates >= 0 (year 2323+).' };
    const yearOffset = Math.floor(sd / 1000);
    const year = EPOCH_YEAR + yearOffset;
    const frac = (sd - yearOffset * 1000) / 1000; // 0..1
    const total = daysInYear(year);
    let doy = Math.round(frac * total); // 0-based
    if (doy >= total) doy = total - 1;
    const date = new Date(Date.UTC(year, 0, 1));
    date.setUTCDate(date.getUTCDate() + doy);
    const iso = formatISO(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    return {
      copy: iso,
      rows: [
        { label: 'Gregorian date', value: iso },
        { label: 'Year', value: String(year) },
        { label: 'Day of year', value: String(doy + 1) },
        { label: 'Stardate', value: sd.toFixed(1) },
      ],
    };
  }, [mode, dateValue, stardate]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Stardate Converter" />
        <OptionsBar>
          <Field label="Direction">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="dateToStardate">Date to stardate</TabsTrigger>
                <TabsTrigger value="stardateToDate">Stardate to date</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>
        {mode === 'dateToStardate' ? (
          <OptionsBar>
            <Field label="Gregorian date">
              <Input
                type="date"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
              />
            </Field>
          </OptionsBar>
        ) : (
          <OptionsBar>
            <Field label="Stardate">
              <Input
                value={stardate}
                onChange={(e) => setStardate(e.target.value)}
                inputMode="decimal"
                className="w-40"
              />
            </Field>
          </OptionsBar>
        )}
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
              'Popular TNG film-era approximation: SD = 1000×(year−2323) + (dayOfYear/daysInYear)×1000',
              'Multiple stardate systems exist; this is a fan convention.',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
