'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

const WEEKDAY_FULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_FULL = [
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
const MONTH_ABBR = [
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

const DIRECTIVE_DESC: Record<string, string> = {
  Y: 'Year with century',
  y: 'Year without century (00-99)',
  m: 'Month as zero-padded number (01-12)',
  d: 'Day of month, zero-padded (01-31)',
  e: 'Day of month, space-padded',
  H: 'Hour, 24-hour, zero-padded (00-23)',
  I: 'Hour, 12-hour, zero-padded (01-12)',
  M: 'Minute, zero-padded (00-59)',
  S: 'Second, zero-padded (00-59)',
  p: 'AM or PM',
  a: 'Abbreviated weekday name',
  A: 'Full weekday name',
  b: 'Abbreviated month name',
  B: 'Full month name',
  j: 'Day of year, zero-padded (001-366)',
  w: 'Weekday as number (0=Sunday..6)',
  u: 'ISO weekday (1=Monday..7)',
  U: 'Week of year, Sunday first (00-53)',
  W: 'Week of year, Monday first (00-53)',
  Z: 'Time zone offset name (UTC±HH:MM)',
  z: 'UTC offset (+HHMM)',
  '%': 'Literal percent sign',
};

function pad(n: number, width: number, ch = '0'): string {
  return n.toString().padStart(width, ch);
}

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const current = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((current - start) / 86400000) + 1;
}

// Week of year. Sunday-first (%U) or Monday-first (%W).
function weekOfYear(date: Date, mondayFirst: boolean): number {
  const doy = dayOfYear(date);
  const jan1 = new Date(Date.UTC(date.getUTCFullYear(), 0, 1)).getUTCDay();
  // Offset of week start relative to Jan 1.
  const startDow = mondayFirst ? (jan1 + 6) % 7 : jan1; // days before first full week
  return Math.floor((doy + startDow - 1) / 7);
}

function offsetString(offsetMinutes: number, colon: boolean): string {
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hh = pad(Math.floor(abs / 60), 2);
  const mm = pad(abs % 60, 2);
  return colon ? `${sign}${hh}:${mm}` : `${sign}${hh}${mm}`;
}

interface RenderResult {
  output: string;
  legend: { token: string; produced: string; desc: string }[];
}

function applyStrftime(date: Date, pattern: string, offsetMinutes: number): RenderResult {
  const dow = date.getUTCDay();
  const month = date.getUTCMonth();
  const hours24 = date.getUTCHours();
  const hours12raw = hours24 % 12;
  const hours12 = hours12raw === 0 ? 12 : hours12raw;
  const legend: { token: string; produced: string; desc: string }[] = [];

  const directive = (ch: string): string => {
    switch (ch) {
      case 'Y':
        return pad(date.getUTCFullYear(), 4);
      case 'y':
        return pad(date.getUTCFullYear() % 100, 2);
      case 'm':
        return pad(month + 1, 2);
      case 'd':
        return pad(date.getUTCDate(), 2);
      case 'e':
        return pad(date.getUTCDate(), 2, ' ');
      case 'H':
        return pad(hours24, 2);
      case 'I':
        return pad(hours12, 2);
      case 'M':
        return pad(date.getUTCMinutes(), 2);
      case 'S':
        return pad(date.getUTCSeconds(), 2);
      case 'p':
        return hours24 < 12 ? 'AM' : 'PM';
      case 'a':
        return WEEKDAY_ABBR[dow] ?? '';
      case 'A':
        return WEEKDAY_FULL[dow] ?? '';
      case 'b':
        return MONTH_ABBR[month] ?? '';
      case 'B':
        return MONTH_FULL[month] ?? '';
      case 'j':
        return pad(dayOfYear(date), 3);
      case 'w':
        return String(dow);
      case 'u':
        return String(dow === 0 ? 7 : dow);
      case 'U':
        return pad(weekOfYear(date, false), 2);
      case 'W':
        return pad(weekOfYear(date, true), 2);
      case 'Z':
        return `UTC${offsetString(offsetMinutes, true)}`;
      case 'z':
        return offsetString(offsetMinutes, false);
      case '%':
        return '%';
      default:
        return `%${ch}`;
    }
  };

  let output = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '%') {
      const next = pattern[i + 1];
      if (next === undefined) {
        output += '%';
        break;
      }
      const produced = directive(next);
      output += produced;
      const desc = DIRECTIVE_DESC[next] ?? `Unknown directive %${next} (kept literally)`;
      legend.push({ token: `%${next}`, produced, desc });
      i++;
    } else {
      output += ch ?? '';
    }
  }
  return { output, legend };
}

function toDatetimeLocal(d: Date): string {
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}T${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}`;
}

export default function StrftimePlayground() {
  const [dt, setDt] = useState<string>(toDatetimeLocal(new Date()));
  const [pattern, setPattern] = useState<string>('%A, %B %d, %Y at %I:%M %p');

  const result = useMemo<{ error: string } | RenderResult>(() => {
    if (!dt) return { error: 'Choose a date and time.' };
    const parts = dt.split('T');
    const datePart = parts[0];
    const timePart = parts[1] ?? '00:00';
    if (!datePart) return { error: 'Choose a valid date and time.' };
    const dParts = datePart.split('-');
    const tParts = timePart.split(':');
    const y = Number(dParts[0]);
    const mo = Number(dParts[1]);
    const da = Number(dParts[2]);
    const hh = Number(tParts[0]);
    const mi = Number(tParts[1]);
    const ss = Number(tParts[2] ?? '0');
    if (
      !Number.isFinite(y) ||
      !Number.isFinite(mo) ||
      !Number.isFinite(da) ||
      !Number.isFinite(hh) ||
      !Number.isFinite(mi) ||
      !Number.isFinite(ss)
    ) {
      return { error: 'Choose a valid date and time.' };
    }
    // Interpret the picked wall-clock time as UTC for deterministic, offline output,
    // and report the user's actual UTC offset for %z / %Z.
    const utc = new Date(Date.UTC(y, mo - 1, da, hh, mi, ss));
    const offsetMinutes = -new Date(y, mo - 1, da, hh, mi, ss).getTimezoneOffset();
    return applyStrftime(utc, pattern, offsetMinutes);
  }, [dt, pattern]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="strftime Playground" />
        <OptionsBar>
          <Field label="Date & time">
            <Input
              type="datetime-local"
              value={dt}
              onChange={(e) => setDt(e.target.value)}
            />
          </Field>
          <Field label="Format pattern" className="min-w-[280px] flex-1">
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              spellCheck={false}
              className="font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="Output">
              <CopyButton value={() => result.output} />
            </PanelHeader>
            <div className="p-4">
              <span className="font-mono text-lg break-words">{result.output || '(empty)'}</span>
            </div>
            <StatBar items={[`${result.output.length} chars`, 'Time treated as UTC']} />
          </Panel>

          <Panel>
            <PanelHeader title="Token legend" />
            {result.legend.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">
                No directives in the pattern. Add tokens like %Y, %m, %d, %H, %M.
              </div>
            ) : (
              <div className="max-h-[360px] divide-y overflow-auto">
                {result.legend.map((l, i) => (
                  <div key={`${l.token}-${i}`} className="flex items-center gap-3 px-3 py-2">
                    <code className="w-12 shrink-0 font-mono text-xs">{l.token}</code>
                    <span className="w-32 shrink-0 truncate font-mono text-sm">
                      {l.produced}
                    </span>
                    <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                      {l.desc}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
