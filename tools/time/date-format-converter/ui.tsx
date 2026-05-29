'use client';

import { useCallback } from 'react';

import { TextToolLayout } from '@/components/tools/text-tool';

function pad(n: number, width = 2): string {
  return Math.abs(n).toString().padStart(width, '0');
}

/** Local timezone offset like "+05:30" for the given date. */
function offsetString(d: Date): string {
  const mins = -d.getTimezoneOffset();
  const sign = mins >= 0 ? '+' : '-';
  const abs = Math.abs(mins);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

const RFC2822_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const RFC2822_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function rfc2822(d: Date): string {
  const day = RFC2822_DAYS[d.getDay()] ?? '???';
  const month = RFC2822_MONTHS[d.getMonth()] ?? '???';
  const off = offsetString(d).replace(':', '');
  return `${day}, ${pad(d.getDate())} ${month} ${d.getFullYear()} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${off}`;
}

function localIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${offsetString(d)}`;
}

function safeIntl(opts: Intl.DateTimeFormatOptions, d: Date): string {
  try {
    return new Intl.DateTimeFormat(undefined, opts).format(d);
  } catch {
    return '(unavailable)';
  }
}

export default function DateFormatConverterTool() {
  const transform = useCallback((input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return '';

    // Accept a bare Unix timestamp (seconds or milliseconds) too.
    let d: Date;
    if (/^-?\d{1,}$/.test(trimmed)) {
      const n = Number(trimmed);
      // Heuristic: 10-digit (or fewer) => seconds, otherwise milliseconds.
      const asMs = Math.abs(n) < 1e12 ? n * 1000 : n;
      d = new Date(asMs);
    } else {
      d = new Date(trimmed);
    }

    if (Number.isNaN(d.getTime())) {
      throw new Error(
        `Could not parse "${trimmed}" as a date. Try ISO 8601 (2024-01-31T10:00:00Z), RFC 2822, a locale date, or a Unix timestamp.`
      );
    }

    const lines: [string, string][] = [
      ['ISO 8601 (UTC)', d.toISOString()],
      ['ISO 8601 (local)', localIso(d)],
      ['ISO date only', d.toISOString().slice(0, 10)],
      ['ISO time only', d.toISOString().slice(11, 23)],
      ['RFC 2822', rfc2822(d)],
      ['Unix seconds', Math.floor(d.getTime() / 1000).toString()],
      ['Unix milliseconds', d.getTime().toString()],
      [
        'US (MM/DD/YYYY)',
        `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`,
      ],
      [
        'EU (DD/MM/YYYY)',
        `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
      ],
      ['UTC string', d.toUTCString()],
      ['Locale string', d.toLocaleString()],
      ['Locale date', d.toLocaleDateString()],
      ['Locale time', d.toLocaleTimeString()],
      [
        'Long date',
        safeIntl(
          { dateStyle: 'full', timeStyle: 'long' },
          d
        ),
      ],
      [
        'Day of week',
        safeIntl({ weekday: 'long' }, d),
      ],
    ];

    const labelWidth = Math.max(...lines.map(([l]) => l.length));
    return lines
      .map(([label, value]) => `${label.padEnd(labelWidth)}  ${value}`)
      .join('\n');
  }, []);

  return (
    <TextToolLayout
      transform={transform}
      inputLabel="Date input"
      outputLabel="Formats"
      inputPlaceholder="2024-01-31T10:30:00Z, Jan 31 2024, 1706697000, …"
      sample="2024-01-31T10:30:00Z"
      downloadName="date-formats.txt"
    />
  );
}
