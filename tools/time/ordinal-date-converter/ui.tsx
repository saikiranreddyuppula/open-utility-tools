'use client';

import { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

type Mode = 'dateToOrdinal' | 'ordinalToDate';

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

function pad(n: number, width: number): string {
  return n.toString().padStart(width, '0');
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
  const current = Date.UTC(y, m - 1, d);
  return Math.floor((current - start) / 86400000) + 1;
}

function todayISO(): string {
  const now = new Date();
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1, 2)}-${pad(now.getDate(), 2)}`;
}

type DateRow = { label: string; value: string };

type Result = { error: string } | { rows: DateRow[]; copy: string };

export default function OrdinalDateConverter() {
  const [mode, setMode] = useState<Mode>('dateToOrdinal');
  const [dateValue, setDateValue] = useState<string>(todayISO());
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [ddd, setDdd] = useState<string>('001');

  const result = useMemo<Result>(() => {
    if (mode === 'dateToOrdinal') {
      const parsed = parseISODate(dateValue);
      if (!parsed) return { error: 'Enter a valid calendar date.' };
      const { y, m, d } = parsed;
      const doy = dayOfYear(y, m, d);
      const total = daysInYear(y);
      const ordinal = `${pad(y, 4)}-${pad(doy, 3)}`;
      return {
        copy: ordinal,
        rows: [
          { label: 'Ordinal date (YYYY-DDD)', value: ordinal },
          { label: 'Day of year', value: String(doy) },
          { label: 'Days remaining', value: String(total - doy) },
          { label: 'Days in year', value: String(total) },
          { label: 'Leap year', value: isLeapYear(y) ? 'Yes' : 'No' },
        ],
      };
    }
    const y = Number(year);
    const n = Number(ddd);
    if (!Number.isFinite(y) || !Number.isInteger(y)) {
      return { error: 'Enter a valid year.' };
    }
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return { error: 'Enter a valid day-of-year (DDD).' };
    }
    const total = daysInYear(y);
    if (n < 1 || n > total) {
      return { error: `Day-of-year must be between 1 and ${total} for ${y}.` };
    }
    const date = new Date(Date.UTC(y, 0, 1));
    date.setUTCDate(date.getUTCDate() + (n - 1));
    const iso = `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;
    return {
      copy: iso,
      rows: [
        { label: 'Calendar date', value: iso },
        { label: 'Ordinal date (YYYY-DDD)', value: `${pad(y, 4)}-${pad(n, 3)}` },
        { label: 'Days remaining', value: String(total - n) },
        { label: 'Days in year', value: String(total) },
        { label: 'Leap year', value: isLeapYear(y) ? 'Yes' : 'No' },
      ],
    };
  }, [mode, dateValue, year, ddd]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Ordinal Date Converter" />
        <OptionsBar>
          <Field label="Direction">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="dateToOrdinal">Date to ordinal</TabsTrigger>
                <TabsTrigger value="ordinalToDate">Ordinal to date</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>
        {mode === 'dateToOrdinal' ? (
          <OptionsBar>
            <Field label="Calendar date">
              <Input
                type="date"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
              />
            </Field>
          </OptionsBar>
        ) : (
          <OptionsBar>
            <Field label="Year">
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-28"
              />
            </Field>
            <Field label="Day of year (DDD)">
              <Input
                type="number"
                value={ddd}
                onChange={(e) => setDdd(e.target.value)}
                className="w-28"
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
          <StatBar items={['ISO 8601 ordinal format: YYYY-DDD']} />
        </Panel>
      )}
    </div>
  );
}
