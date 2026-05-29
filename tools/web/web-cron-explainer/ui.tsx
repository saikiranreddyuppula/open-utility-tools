'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

interface FieldSpec {
  name: string;
  min: number;
  max: number;
  names?: Record<string, number>;
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const DOW_NAMES: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const SPECS: FieldSpec[] = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'day of month', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12, names: MONTH_NAMES },
  { name: 'day of week', min: 0, max: 6, names: DOW_NAMES },
];

const MONTH_LABELS = [
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

const DOW_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface ParsedField {
  /** Sorted, deduped set of matching values. */
  values: number[];
  /** True if the original token was '*' (every value). */
  isStar: boolean;
  /** Original token, for summary phrasing. */
  raw: string;
}

function resolveName(token: string, spec: FieldSpec): number | null {
  if (spec.names) {
    const v = spec.names[token.toLowerCase()];
    if (v !== undefined) return v;
  }
  const n = Number(token);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}

function parseFieldPart(part: string, spec: FieldSpec): number[] {
  // Handle step: range/star "/" step.
  let stepStr: string | null = null;
  let base = part;
  const slash = part.indexOf('/');
  if (slash !== -1) {
    base = part.slice(0, slash);
    stepStr = part.slice(slash + 1);
  }

  let step = 1;
  if (stepStr !== null) {
    const s = Number(stepStr);
    if (!Number.isFinite(s) || !Number.isInteger(s) || s <= 0) {
      throw new Error(`Invalid step "${stepStr}" in ${spec.name} field.`);
    }
    step = s;
  }

  let rangeStart: number;
  let rangeEnd: number;

  if (base === '*' || base === '') {
    rangeStart = spec.min;
    rangeEnd = spec.max;
  } else if (base.includes('-')) {
    const dash = base.indexOf('-');
    const startTok = base.slice(0, dash);
    const endTok = base.slice(dash + 1);
    const s = resolveName(startTok, spec);
    const e = resolveName(endTok, spec);
    if (s === null || e === null) {
      throw new Error(`Invalid range "${base}" in ${spec.name} field.`);
    }
    rangeStart = s;
    rangeEnd = e;
  } else {
    const v = resolveName(base, spec);
    if (v === null) {
      throw new Error(`Invalid value "${base}" in ${spec.name} field.`);
    }
    if (stepStr === null) {
      if (v < spec.min || v > spec.max) {
        throw new Error(
          `Value ${v} out of range (${spec.min}-${spec.max}) in ${spec.name} field.`,
        );
      }
      return [v];
    }
    // "N/step" means from N to max.
    rangeStart = v;
    rangeEnd = spec.max;
  }

  if (rangeStart < spec.min || rangeEnd > spec.max || rangeStart > rangeEnd) {
    throw new Error(
      `Range ${rangeStart}-${rangeEnd} out of bounds (${spec.min}-${spec.max}) in ${spec.name} field.`,
    );
  }

  const out: number[] = [];
  for (let v = rangeStart; v <= rangeEnd; v += step) {
    out.push(v);
  }
  return out;
}

function parseField(token: string, spec: FieldSpec): ParsedField {
  const parts = token.split(',');
  const set = new Set<number>();
  for (const part of parts) {
    for (const v of parseFieldPart(part, spec)) {
      // Normalize day-of-week 7 -> 0 (Sunday).
      const norm = spec.name === 'day of week' && v === 7 ? 0 : v;
      set.add(norm);
    }
  }
  const values = Array.from(set).sort((a, b) => a - b);
  return { values, isStar: token === '*', raw: token };
}

interface Parsed {
  minute: ParsedField;
  hour: ParsedField;
  dom: ParsedField;
  month: ParsedField;
  dow: ParsedField;
}

function parseCron(expr: string): Parsed {
  const tokens = expr.trim().split(/\s+/).filter(Boolean);
  if (tokens.length !== 5) {
    throw new Error(
      `Expected 5 fields (minute hour day-of-month month day-of-week), got ${tokens.length}.`,
    );
  }
  const minSpec = SPECS[0]!;
  const hourSpec = SPECS[1]!;
  const domSpec = SPECS[2]!;
  const monthSpec = SPECS[3]!;
  const dowSpec = SPECS[4]!;

  return {
    minute: parseField(tokens[0]!, minSpec),
    hour: parseField(tokens[1]!, hourSpec),
    dom: parseField(tokens[2]!, domSpec),
    month: parseField(tokens[3]!, monthSpec),
    dow: parseField(tokens[4]!, dowSpec),
  };
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function joinHuman(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function describe(p: Parsed): string {
  const min = p.minute;
  const hour = p.hour;

  // Time portion.
  let timePart: string;
  if (min.isStar && hour.isStar) {
    timePart = 'every minute';
  } else if (min.values.length === 1 && hour.values.length === 1) {
    const h = hour.values[0]!;
    const m = min.values[0]!;
    timePart = `at ${pad2(h)}:${pad2(m)}`;
  } else if (min.isStar && !hour.isStar) {
    timePart = `every minute during hour ${joinHuman(hour.values.map((h) => pad2(h)))}`;
  } else if (!min.isStar && hour.isStar) {
    if (min.values.length === 1) {
      timePart = `at minute ${min.values[0]} of every hour`;
    } else {
      timePart = `at minutes ${joinHuman(min.values.map(String))} of every hour`;
    }
  } else {
    timePart = `at minute ${joinHuman(min.values.map(String))} past hour ${joinHuman(
      hour.values.map((h) => pad2(h)),
    )}`;
  }

  // Day-of-month / day-of-week.
  const domPart = p.dom.isStar
    ? ''
    : `on day-of-month ${joinHuman(p.dom.values.map(String))}`;

  const dowPart = p.dow.isStar
    ? ''
    : `on ${joinHuman(p.dow.values.map((d) => DOW_LABELS[d] ?? String(d)))}`;

  let dayPart = '';
  if (domPart && dowPart) {
    // Standard cron OR-semantics when both are restricted.
    dayPart = `${domPart} and ${dowPart}`;
  } else if (domPart) {
    dayPart = domPart;
  } else if (dowPart) {
    dayPart = dowPart;
  }

  const monthPart = p.month.isStar
    ? ''
    : `in ${joinHuman(p.month.values.map((m) => MONTH_LABELS[m - 1] ?? String(m)))}`;

  const segments = [timePart, dayPart, monthPart].filter(Boolean);
  const sentence = segments.join(', ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.';
}

/**
 * Does the cron expression fire at the given date? Implements standard cron
 * day matching: if both DOM and DOW are restricted, a match on EITHER fires.
 */
function matches(p: Parsed, d: Date): boolean {
  if (!p.minute.values.includes(d.getMinutes())) return false;
  if (!p.hour.values.includes(d.getHours())) return false;
  if (!p.month.values.includes(d.getMonth() + 1)) return false;

  const domRestricted = !p.dom.isStar;
  const dowRestricted = !p.dow.isStar;
  const domMatch = p.dom.values.includes(d.getDate());
  const dowMatch = p.dow.values.includes(d.getDay());

  if (domRestricted && dowRestricted) {
    return domMatch || dowMatch;
  }
  if (domRestricted) return domMatch;
  if (dowRestricted) return dowMatch;
  return true;
}

function nextRuns(p: Parsed, from: Date, count: number): Date[] {
  const results: Date[] = [];
  // Start from the next whole minute.
  const cursor = new Date(from.getTime());
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);

  // Cap iterations to avoid runaway loops (~4 years of minutes).
  const maxIterations = 366 * 4 * 24 * 60;
  let iterations = 0;
  while (results.length < count && iterations < maxIterations) {
    if (matches(p, cursor)) {
      results.push(new Date(cursor.getTime()));
    }
    cursor.setMinutes(cursor.getMinutes() + 1);
    iterations += 1;
  }
  return results;
}

function formatDate(d: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[d.getDay()]} ${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(
    d.getDate(),
  )} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

const PRESETS: Array<{ label: string; expr: string }> = [
  { label: 'Every minute', expr: '* * * * *' },
  { label: 'Hourly', expr: '0 * * * *' },
  { label: 'Daily 9am', expr: '0 9 * * *' },
  { label: 'Weekdays 8:30', expr: '30 8 * * 1-5' },
  { label: 'Every 15 min', expr: '*/15 * * * *' },
  { label: '1st of month', expr: '0 0 1 * *' },
];

export default function CronExplainerTool() {
  const [expr, setExpr] = useState('30 8 * * 1-5');

  const result = useMemo(() => {
    const trimmed = expr.trim();
    if (!trimmed) {
      return { error: null as string | null, summary: '', runs: [] as Date[] };
    }
    try {
      const parsed = parseCron(trimmed);
      const summary = describe(parsed);
      const runs = nextRuns(parsed, new Date(), 7);
      return { error: null, summary, runs };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : String(err),
        summary: '',
        runs: [] as Date[],
      };
    }
  }, [expr]);

  const copyText = useMemo(() => {
    if (result.error || !result.summary) return '';
    const lines = [result.summary, '', 'Next runs:'];
    for (const r of result.runs) lines.push(`  ${formatDate(r)}`);
    return lines.join('\n');
  }, [result]);

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader title="Cron expression" />
        <OptionsBar>
          <Field
            label="Expression"
            className="w-full"
            hint="Five fields: minute hour day-of-month month day-of-week"
          >
            <Input
              value={expr}
              onChange={(e) => setExpr(e.target.value)}
              placeholder="*/15 9-17 * * 1-5"
              className="font-mono"
            />
          </Field>
        </OptionsBar>
        <div className="flex flex-wrap gap-2 px-4 py-3">
          {PRESETS.map((preset) => (
            <Button
              key={preset.expr}
              variant="outline"
              size="sm"
              onClick={() => setExpr(preset.expr)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </Panel>

      <ErrorBanner error={result.error} />

      {!result.error && result.summary ? (
        <Panel>
          <PanelHeader title="Explanation">
            <CopyButton value={copyText} />
          </PanelHeader>
          <div className="px-4 py-4 text-sm">{result.summary}</div>
          <StatBar
            items={[
              `Next: ${result.runs[0] ? formatDate(result.runs[0]) : 'none within 4 years'}`,
            ]}
          />
        </Panel>
      ) : null}

      {!result.error && result.runs.length > 0 ? (
        <Panel>
          <PanelHeader title="Next 7 run times (local)" />
          <ul className="divide-y">
            {result.runs.map((r, i) => (
              <li
                key={i}
                className="flex items-center justify-between px-4 py-2 font-mono text-sm"
              >
                <span>{formatDate(r)}</span>
                <span className="text-xs text-muted-foreground">#{i + 1}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
