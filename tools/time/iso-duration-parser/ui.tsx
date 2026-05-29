'use client';

import { useCallback } from 'react';

import { TextToolLayout } from '@/components/tools/text-tool';

// ISO 8601 duration: PnYnMnWnDTnHnMnS (weeks are mutually exclusive in spec,
// but we accept and combine them for convenience).
const DURATION_RE =
  /^(?<sign>[+-])?P(?=\d|T\d)(?:(?<years>\d+(?:\.\d+)?)Y)?(?:(?<months>\d+(?:\.\d+)?)M)?(?:(?<weeks>\d+(?:\.\d+)?)W)?(?:(?<days>\d+(?:\.\d+)?)D)?(?:T(?=\d)(?:(?<hours>\d+(?:\.\d+)?)H)?(?:(?<minutes>\d+(?:\.\d+)?)M)?(?:(?<seconds>\d+(?:\.\d+)?)S)?)?$/;

// Approximate seconds-per-unit for the calendar-based components.
const SECONDS = {
  year: 365.2425 * 86400,
  month: (365.2425 / 12) * 86400,
  week: 7 * 86400,
  day: 86400,
  hour: 3600,
  minute: 60,
  second: 1,
};

function n(v: string | undefined): number {
  if (v == null) return 0;
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function plural(value: number, unit: string): string {
  const rounded = Math.round(value * 1e6) / 1e6;
  return `${rounded} ${unit}${rounded === 1 ? '' : 's'}`;
}

export default function IsoDurationParserTool() {
  const transform = useCallback((input: string) => {
    const trimmed = input.trim().toUpperCase();
    if (!trimmed) return '';

    const match = DURATION_RE.exec(trimmed);
    if (!match || !match.groups) {
      throw new Error(
        'Not a valid ISO 8601 duration. Expected e.g. P1Y2M10DT2H30M, PT45M, P3W, or P0D.'
      );
    }

    const g = match.groups;
    const sign = g['sign'] === '-' ? -1 : 1;
    const years = n(g['years']);
    const months = n(g['months']);
    const weeks = n(g['weeks']);
    const days = n(g['days']);
    const hours = n(g['hours']);
    const minutes = n(g['minutes']);
    const seconds = n(g['seconds']);

    const totalSeconds =
      sign *
      (years * SECONDS.year +
        months * SECONDS.month +
        weeks * SECONDS.week +
        days * SECONDS.day +
        hours * SECONDS.hour +
        minutes * SECONDS.minute +
        seconds * SECONDS.second);

    // Build a human-readable breakdown of only the present components.
    const present: string[] = [];
    if (years) present.push(plural(years, 'year'));
    if (months) present.push(plural(months, 'month'));
    if (weeks) present.push(plural(weeks, 'week'));
    if (days) present.push(plural(days, 'day'));
    if (hours) present.push(plural(hours, 'hour'));
    if (minutes) present.push(plural(minutes, 'minute'));
    if (seconds) present.push(plural(seconds, 'second'));
    const human =
      present.length === 0
        ? 'zero duration'
        : `${sign < 0 ? 'minus ' : ''}${present.join(', ')}`;

    const rows: [string, string][] = [
      ['Years', String(years)],
      ['Months', String(months)],
      ['Weeks', String(weeks)],
      ['Days', String(days)],
      ['Hours', String(hours)],
      ['Minutes', String(minutes)],
      ['Seconds', String(seconds)],
      ['Sign', sign < 0 ? 'negative' : 'positive'],
      ['—', ''],
      ['Human readable', human],
      ['Total seconds (approx)', String(Math.round(totalSeconds))],
      ['Total minutes (approx)', (totalSeconds / 60).toFixed(2)],
      ['Total hours (approx)', (totalSeconds / 3600).toFixed(2)],
      ['Total days (approx)', (totalSeconds / 86400).toFixed(2)],
    ];

    // A precise time-only total (hours/minutes/seconds + exact days) is exact;
    // year/month vary by calendar, so we flag the approximation.
    const exactPart =
      sign *
      (weeks * SECONDS.week +
        days * SECONDS.day +
        hours * SECONDS.hour +
        minutes * SECONDS.minute +
        seconds * SECONDS.second);
    if (years === 0 && months === 0) {
      rows.push(['Total seconds (exact)', String(exactPart)]);
    } else {
      rows.push([
        'Note',
        'Years/months use average lengths (365.2425 days/yr) — exact length depends on the start date.',
      ]);
    }

    const labelWidth = Math.max(...rows.map(([l]) => l.length));
    return rows
      .map(([label, value]) =>
        label === '—' ? '' : `${label.padEnd(labelWidth)}  ${value}`
      )
      .join('\n');
  }, []);

  return (
    <TextToolLayout
      transform={transform}
      inputLabel="ISO 8601 duration"
      outputLabel="Breakdown"
      inputPlaceholder="P1Y2M10DT2H30M"
      sample="P1Y2M10DT2H30M"
      downloadName="iso-duration.txt"
    />
  );
}
