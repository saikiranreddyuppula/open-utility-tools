'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};
const DOW: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface FieldDef {
  min: number;
  max: number;
  names?: Record<string, number>;
}

function expandField(token: string, def: FieldDef): Set<number> {
  const out = new Set<number>();
  const resolve = (raw: string): number => {
    const upper = raw.toUpperCase();
    if (def.names && upper in def.names) {
      const v = def.names[upper];
      if (v === undefined) throw new Error(`Unknown name "${raw}"`);
      return v;
    }
    const n = Number(raw);
    if (!Number.isInteger(n)) throw new Error(`Invalid value "${raw}"`);
    return n;
  };

  for (const rawPart of token.split(',')) {
    const part = rawPart.trim();
    if (part === '') throw new Error('Empty list item');
    if (part === '*' || part === '?') {
      for (let i = def.min; i <= def.max; i++) out.add(i);
      continue;
    }
    let base = part;
    let step = 1;
    const slash = part.indexOf('/');
    if (slash >= 0) {
      base = part.slice(0, slash);
      const s = Number(part.slice(slash + 1));
      if (!Number.isInteger(s) || s <= 0) throw new Error('Invalid step');
      step = s;
    }
    let lo: number;
    let hi: number;
    if (base === '*' || base === '') {
      lo = def.min;
      hi = def.max;
    } else if (base.includes('-')) {
      const dash = base.indexOf('-');
      lo = resolve(base.slice(0, dash));
      hi = resolve(base.slice(dash + 1));
    } else {
      lo = resolve(base);
      hi = slash >= 0 ? def.max : lo;
    }
    if (lo < def.min || lo > def.max || hi < def.min || hi > def.max) {
      throw new Error(`Value out of range (${def.min}-${def.max})`);
    }
    if (lo > hi) throw new Error('Range start greater than end');
    for (let i = lo; i <= hi; i += step) out.add(i);
  }
  return out;
}

interface Parsed {
  minute: Set<number>;
  hour: Set<number>;
  dom: Set<number>;
  month: Set<number>;
  dow: Set<number>;
  domRestricted: boolean;
  dowRestricted: boolean;
}

function parseCron(expr: string): Parsed {
  const t = expr.trim().split(/\s+/).filter(Boolean);
  if (t.length !== 5) throw new Error('Enter exactly 5 fields: minute hour day-of-month month day-of-week.');
  const [m, h, dom, mon, dow] = t;
  if (m === undefined || h === undefined || dom === undefined || mon === undefined || dow === undefined) {
    throw new Error('Missing field.');
  }
  const parsed: Parsed = {
    minute: expandField(m, { min: 0, max: 59 }),
    hour: expandField(h, { min: 0, max: 23 }),
    dom: expandField(dom, { min: 1, max: 31 }),
    month: expandField(mon, { min: 1, max: 12, names: MONTHS }),
    dow: expandField(dow, { min: 0, max: 6, names: DOW }),
    domRestricted: dom !== '*' && dom !== '?',
    dowRestricted: dow !== '*' && dow !== '?',
  };
  if (parsed.dow.has(7)) {
    parsed.dow.delete(7);
    parsed.dow.add(0);
  }
  return parsed;
}

function matches(d: Date, p: Parsed): boolean {
  if (!p.minute.has(d.getUTCMinutes())) return false;
  if (!p.hour.has(d.getUTCHours())) return false;
  if (!p.month.has(d.getUTCMonth() + 1)) return false;
  const domOk = p.dom.has(d.getUTCDate());
  const dowOk = p.dow.has(d.getUTCDay());
  // Standard cron: when both restricted, OR them; otherwise AND with the unrestricted side passing.
  if (p.domRestricted && p.dowRestricted) return domOk || dowOk;
  if (p.domRestricted) return domOk;
  if (p.dowRestricted) return dowOk;
  return true;
}

interface Run {
  iso: string;
  weekday: string;
  gap: string;
}

function fmtGap(ms: number): string {
  if (ms <= 0) return '—';
  const totalMin = Math.round(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m || parts.length === 0) parts.push(`${m}m`);
  return parts.join(' ');
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function fmtDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function compute(
  expr: string,
  startStr: string,
  count: number,
  offsetMin: number,
): { runs: Run[] } | { error: string } {
  let parsed: Parsed;
  try {
    parsed = parseCron(expr);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Parse error.' };
  }
  const startMs = Date.parse(startStr);
  if (!Number.isFinite(startMs)) return { error: 'Enter a valid start datetime.' };
  if (!Number.isFinite(offsetMin)) return { error: 'Enter a valid timezone offset (minutes).' };
  const n = Math.max(1, Math.min(100, Math.floor(count)));

  // Work in "wall clock" space by shifting the UTC accessor to the target offset.
  // We treat the wall time = startMs + offset, step minute by minute on that wall clock.
  let cursorMs = startMs + offsetMin * 60000;
  // round up to the next whole minute
  cursorMs = Math.ceil(cursorMs / 60000) * 60000;

  const runs: Run[] = [];
  let prevMs: number | null = null;
  const limit = 366 * 24 * 60 + 10; // ~1 year of minutes safety bound
  let steps = 0;
  while (runs.length < n && steps < limit) {
    const wall = new Date(cursorMs);
    if (matches(wall, parsed)) {
      const gap = prevMs === null ? '—' : fmtGap(cursorMs - prevMs);
      runs.push({
        iso: fmtDate(wall),
        weekday: WEEKDAY_NAMES[wall.getUTCDay()] ?? '',
        gap,
      });
      prevMs = cursorMs;
    }
    cursorMs += 60000;
    steps++;
  }
  if (runs.length === 0) return { error: 'No matching runs found within one year of the start time.' };
  return { runs };
}

function defaultStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CronNextRunsPreview() {
  const [expr, setExpr] = useState('0 9 * * MON-FRI');
  const [start, setStart] = useState(defaultStart());
  const [count, setCount] = useState('10');
  const [offset, setOffset] = useState('0');

  const result = useMemo(
    () => compute(expr, start, Number(count), Number(offset)),
    [expr, start, count, offset],
  );

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Cron expression" className="min-w-[220px] flex-1">
            <Input value={expr} onChange={(e) => setExpr(e.target.value)} className="font-mono" placeholder="0 9 * * MON-FRI" />
          </Field>
          <Field label="Start datetime">
            <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Count (1-100)">
            <Input type="number" value={count} onChange={(e) => setCount(e.target.value)} className="w-24" />
          </Field>
          <Field label="TZ offset (min)">
            <Input type="number" value={offset} onChange={(e) => setOffset(e.target.value)} className="w-28" />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Next runs">
            <CopyButton value={() => result.runs.map((r) => `${r.iso} (${r.weekday})`).join('\n')} />
          </PanelHeader>
          <div className="max-h-[480px] divide-y overflow-auto">
            {result.runs.map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2">
                <span className="w-8 shrink-0 text-right font-mono text-2xs text-muted-foreground">{i + 1}</span>
                <code className="w-44 shrink-0 font-mono text-sm">{r.iso}</code>
                <span className="w-12 shrink-0 text-sm text-muted-foreground">{r.weekday}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-2xs text-muted-foreground">+{r.gap}</span>
                <CopyButton value={r.iso} size="icon-sm" />
              </div>
            ))}
          </div>
          <StatBar items={[`${result.runs.length} runs`, 'wall clock at given offset']} />
        </Panel>
      )}
    </div>
  );
}
