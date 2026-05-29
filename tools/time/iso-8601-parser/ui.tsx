'use client';

import { useCallback } from 'react';

import { TextToolLayout } from '@/components/tools/text-tool';

const ISO_RE =
  /^(?<year>[+-]?\d{4,6})-(?<month>\d{2})-(?<day>\d{2})(?:[T ](?<hour>\d{2}):(?<minute>\d{2})(?::(?<second>\d{2})(?:[.,](?<fraction>\d+))?)?\s*(?<offset>Z|[+-]\d{2}(?::?\d{2})?)?)?$/;

function isoWeek(d: Date): { week: number; weekYear: number } {
  // ISO week date: Thursday-based.
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // nearest Thursday
  const weekYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week =
    1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return { week, weekYear };
}

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export default function Iso8601ParserTool() {
  const transform = useCallback((input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return '';

    const match = ISO_RE.exec(trimmed);
    if (!match || !match.groups) {
      throw new Error(
        'Not a recognized ISO 8601 date-time. Expected e.g. 2024-01-31, 2024-01-31T10:30:00Z, or 2024-01-31T10:30:00.500+05:30'
      );
    }

    const g = match.groups;
    const yearStr = g['year'] ?? '';
    const monthStr = g['month'] ?? '';
    const dayStr = g['day'] ?? '';
    const hourStr = g['hour'];
    const minuteStr = g['minute'];
    const secondStr = g['second'];
    const fractionStr = g['fraction'];
    const offsetStr = g['offset'];

    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);

    const issues: string[] = [];
    if (month < 1 || month > 12) issues.push(`month ${month} out of range (1-12)`);
    if (day < 1 || day > 31) issues.push(`day ${day} out of range (1-31)`);

    let hour: number | null = null;
    let minute: number | null = null;
    let second: number | null = null;
    if (hourStr != null) {
      hour = Number(hourStr);
      if (hour > 24) issues.push(`hour ${hour} out of range (0-24)`);
    }
    if (minuteStr != null) {
      minute = Number(minuteStr);
      if (minute > 59) issues.push(`minute ${minute} out of range (0-59)`);
    }
    if (secondStr != null) {
      second = Number(secondStr);
      if (second > 60) issues.push(`second ${second} out of range (0-60)`);
    }

    // Build a Date to validate the calendar date and compute derived fields.
    const isoForDate =
      hourStr != null
        ? trimmed.replace(' ', 'T')
        : `${yearStr}-${monthStr}-${dayStr}T00:00:00Z`;
    const d = new Date(isoForDate);
    const valid = !Number.isNaN(d.getTime());
    if (!valid) issues.push('value is not a valid calendar date/time');

    // Calendar-day round-trip check (catches things like Feb 30).
    if (valid && hourStr == null) {
      if (
        d.getUTCFullYear() !== year ||
        d.getUTCMonth() + 1 !== month ||
        d.getUTCDate() !== day
      ) {
        issues.push(`${yearStr}-${monthStr}-${dayStr} does not exist on the calendar`);
      }
    }

    let offsetLabel = 'none (local / unspecified)';
    let offsetMinutes: number | null = null;
    if (offsetStr === 'Z') {
      offsetLabel = 'Z (UTC, +00:00)';
      offsetMinutes = 0;
    } else if (offsetStr) {
      const sign = offsetStr.startsWith('-') ? -1 : 1;
      const body = offsetStr.slice(1).replace(':', '');
      const oh = Number(body.slice(0, 2));
      const om = Number(body.slice(2, 4) || '0');
      offsetMinutes = sign * (oh * 60 + om);
      offsetLabel = `${offsetStr} (${oh}h ${om}m)`;
    }

    const rows: [string, string][] = [
      ['Year', yearStr],
      ['Month', `${monthStr} (${month})`],
      ['Day', `${dayStr} (${day})`],
    ];
    if (hour != null) rows.push(['Hour', String(hour)]);
    if (minute != null) rows.push(['Minute', String(minute)]);
    if (second != null) rows.push(['Second', String(second)]);
    if (fractionStr != null) {
      const millis = Math.round(Number(`0.${fractionStr}`) * 1000);
      rows.push(['Fractional sec', `.${fractionStr} (${millis} ms)`]);
    }
    rows.push(['Offset', offsetLabel]);
    if (offsetMinutes != null) {
      rows.push(['Offset minutes', String(offsetMinutes)]);
    }

    if (valid) {
      const { week, weekYear } = isoWeek(d);
      const weekday = WEEKDAYS[d.getUTCDay()] ?? '?';
      const dayOfYear =
        Math.floor(
          (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
            Date.UTC(d.getUTCFullYear(), 0, 0)) /
            86400000
        );
      rows.push(['Weekday', weekday]);
      rows.push(['Day of year', String(dayOfYear)]);
      rows.push(['ISO week', `${weekYear}-W${String(week).padStart(2, '0')}`]);
      rows.push(['Unix seconds', String(Math.floor(d.getTime() / 1000))]);
      rows.push(['Unix milliseconds', String(d.getTime())]);
      rows.push(['Normalized (UTC)', d.toISOString()]);
    }

    rows.push([
      'Valid',
      issues.length === 0 ? 'yes' : `no — ${issues.join('; ')}`,
    ]);

    const labelWidth = Math.max(...rows.map(([l]) => l.length));
    return rows
      .map(([label, value]) => `${label.padEnd(labelWidth)}  ${value}`)
      .join('\n');
  }, []);

  return (
    <TextToolLayout
      transform={transform}
      inputLabel="ISO 8601 string"
      outputLabel="Components"
      inputPlaceholder="2024-01-31T10:30:00.500+05:30"
      sample="2024-01-31T10:30:00.500+05:30"
      downloadName="iso8601-parsed.txt"
    />
  );
}
