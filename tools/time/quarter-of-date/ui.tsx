'use client';

import { useMemo, useState } from 'react';
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

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

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

function todayISO(): string {
  const now = new Date();
  return formatISO(now.getFullYear(), now.getMonth(), now.getDate());
}

type Row = { label: string; value: string };

type Result = { error: string } | { rows: Row[]; copy: string };

export default function QuarterOfDate() {
  const [dateValue, setDateValue] = useState<string>(todayISO());
  const [fyStart, setFyStart] = useState<string>('0'); // 0-based month, default January

  const result = useMemo<Result>(() => {
    const parsed = parseISODate(dateValue);
    if (!parsed) return { error: 'Enter a valid date.' };
    const { y, m, d } = parsed;
    const fy = Number(fyStart);
    if (!Number.isFinite(fy) || fy < 0 || fy > 11) {
      return { error: 'Choose a valid fiscal-year start month.' };
    }

    // Offset of this month within the fiscal year (0..11).
    const offset = (m - fy + 12) % 12;
    const quarterIndex = Math.floor(offset / 3); // 0..3
    const halfIndex = Math.floor(offset / 6); // 0..1
    const quarterLabel = `Q${quarterIndex + 1}`;
    const halfLabel = `H${halfIndex + 1}`;

    // Fiscal year that contains this date. A fiscal year named by the calendar
    // year in which it ends is a common convention; we label it by start year.
    const fyStartYear = m >= fy ? y : y - 1;

    // Quarter start month (calendar month index) and its calendar year.
    const qStartOffset = quarterIndex * 3;
    const qStartMonthAbs = fy + qStartOffset; // may exceed 11
    const qStartYear = fyStartYear + Math.floor(qStartMonthAbs / 12);
    const qStartMonth = qStartMonthAbs % 12;
    const quarterStart = new Date(Date.UTC(qStartYear, qStartMonth, 1));
    const quarterEnd = new Date(Date.UTC(qStartYear, qStartMonth + 3, 0)); // last day of quarter

    // Fiscal year start and end.
    const fyStartDate = new Date(Date.UTC(fyStartYear, fy, 1));
    const fyEndDate = new Date(Date.UTC(fyStartYear, fy + 12, 0));

    const today = new Date(Date.UTC(y, m, d));
    const qStartMs = quarterStart.getTime();
    const qEndMs = quarterEnd.getTime();
    const totalDays = Math.round((qEndMs - qStartMs) / 86400000) + 1;
    const elapsed = Math.round((today.getTime() - qStartMs) / 86400000) + 1;
    const remaining = totalDays - elapsed;
    const percent = ((elapsed / totalDays) * 100).toFixed(1);

    const fyLabel =
      fy === 0
        ? `${fyStartYear}`
        : `FY ${fyStartYear}-${(fyStartYear + 1).toString().slice(-2)}`;

    const qFull =
      fy === 0 ? `${quarterLabel} ${fyStartYear}` : `${quarterLabel} ${fyLabel}`;

    return {
      copy: `${qFull} — ${formatISO(quarterStart.getUTCFullYear(), quarterStart.getUTCMonth(), quarterStart.getUTCDate())} to ${formatISO(quarterEnd.getUTCFullYear(), quarterEnd.getUTCMonth(), quarterEnd.getUTCDate())}`,
      rows: [
        { label: 'Quarter', value: qFull },
        { label: 'Half', value: `${halfLabel} ${fy === 0 ? fyStartYear : fyLabel}` },
        { label: 'Fiscal year', value: fyLabel },
        {
          label: 'Quarter start',
          value: formatISO(
            quarterStart.getUTCFullYear(),
            quarterStart.getUTCMonth(),
            quarterStart.getUTCDate(),
          ),
        },
        {
          label: 'Quarter end',
          value: formatISO(
            quarterEnd.getUTCFullYear(),
            quarterEnd.getUTCMonth(),
            quarterEnd.getUTCDate(),
          ),
        },
        {
          label: 'Fiscal year start',
          value: formatISO(
            fyStartDate.getUTCFullYear(),
            fyStartDate.getUTCMonth(),
            fyStartDate.getUTCDate(),
          ),
        },
        {
          label: 'Fiscal year end',
          value: formatISO(
            fyEndDate.getUTCFullYear(),
            fyEndDate.getUTCMonth(),
            fyEndDate.getUTCDate(),
          ),
        },
        { label: 'Days elapsed in quarter', value: String(elapsed) },
        { label: 'Days remaining in quarter', value: String(remaining) },
        { label: 'Quarter complete', value: `${percent}%` },
      ],
    };
  }, [dateValue, fyStart]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Quarter & Fiscal Period Finder" />
        <OptionsBar>
          <Field label="Date">
            <Input
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
            />
          </Field>
          <Field label="Fiscal year starts" hint="January = calendar quarters">
            <Select value={fyStart} onValueChange={setFyStart}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, i) => (
                  <SelectItem key={name} value={String(i)}>
                    {name}
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
        </Panel>
      )}
    </div>
  );
}
