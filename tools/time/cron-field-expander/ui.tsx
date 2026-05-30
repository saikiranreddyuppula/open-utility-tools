'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

interface FieldDef {
  name: string;
  min: number;
  max: number;
  names?: Record<string, number>;
  allowL?: boolean;
  allowQ?: boolean;
}

const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};
const DOW: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
};

// 5-field layout (no seconds)
const DEFS5: FieldDef[] = [
  { name: 'Minute', min: 0, max: 59 },
  { name: 'Hour', min: 0, max: 23 },
  { name: 'Day of month', min: 1, max: 31, allowL: true, allowQ: true },
  { name: 'Month', min: 1, max: 12, names: MONTHS },
  { name: 'Day of week', min: 0, max: 6, names: DOW, allowL: true, allowQ: true },
];

// 6-field layout (with seconds at the front)
const DEFS6: FieldDef[] = [
  { name: 'Second', min: 0, max: 59 },
  ...DEFS5,
];

interface ExpandedField {
  name: string;
  token: string;
  values: number[];
}

function expandToken(token: string, def: FieldDef): number[] {
  const out = new Set<number>();
  const resolve = (raw: string): number => {
    const upper = raw.toUpperCase();
    if (def.names && upper in def.names) {
      const v = def.names[upper];
      if (v === undefined) throw new Error(`Unknown name "${raw}" in ${def.name}`);
      return v;
    }
    const n = Number(raw);
    if (!Number.isInteger(n)) throw new Error(`Invalid value "${raw}" in ${def.name}`);
    return n;
  };

  const parts = token.split(',');
  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (part === '') throw new Error(`Empty list item in ${def.name}`);

    // ? and * mean "all" (or "no restriction" for ?)
    if (part === '*' || (part === '?' && def.allowQ)) {
      for (let i = def.min; i <= def.max; i++) out.add(i);
      continue;
    }
    if (part === '?') throw new Error(`"?" is not allowed in ${def.name}`);

    // L (last) — represent as the max for day-of-month, or treat as 7->0 last for DOW
    if ((part === 'L' || part === 'l') && def.allowL) {
      out.add(def.name === 'Day of month' ? 31 : def.max);
      continue;
    }

    // step: base/step
    let base = part;
    let step = 1;
    const slash = part.indexOf('/');
    if (slash >= 0) {
      base = part.slice(0, slash);
      const stepStr = part.slice(slash + 1);
      const s = Number(stepStr);
      if (!Number.isInteger(s) || s <= 0) throw new Error(`Invalid step "/${stepStr}" in ${def.name}`);
      step = s;
    }

    // range or single
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
      throw new Error(`Value out of range (${def.min}-${def.max}) in ${def.name}`);
    }
    if (lo > hi) throw new Error(`Range start greater than end in ${def.name}`);

    for (let i = lo; i <= hi; i += step) out.add(i);
  }

  // Normalise DOW 7 -> 0
  if (def.name === 'Day of week' && out.has(7)) {
    out.delete(7);
    out.add(0);
  }

  return Array.from(out).sort((a, b) => a - b);
}

function evaluate(expr: string): { fields: ExpandedField[]; perDay: number } | { error: string } {
  const tokens = expr.trim().split(/\s+/).filter(Boolean);
  if (tokens.length !== 5 && tokens.length !== 6) {
    return { error: 'Enter a 5-field (or 6-field with seconds) cron expression.' };
  }
  const defs = tokens.length === 6 ? DEFS6 : DEFS5;
  const fields: ExpandedField[] = [];
  try {
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i];
      const tok = tokens[i];
      if (!def || tok === undefined) continue;
      fields.push({ name: def.name, token: tok, values: expandToken(tok, def) });
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Parse error.' };
  }

  // distinct fire times per day = seconds(if any) * minutes * hours (time-of-day fields only)
  const byName = new Map(fields.map((f) => [f.name, f.values.length]));
  const sec = byName.get('Second') ?? 1;
  const min = byName.get('Minute') ?? 1;
  const hr = byName.get('Hour') ?? 1;
  const perDay = sec * min * hr;

  return { fields, perDay };
}

export default function CronFieldExpander() {
  const [expr, setExpr] = useState('*/15 9-17 * * MON-FRI');

  const result = useMemo(() => evaluate(expr), [expr]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Cron expression" className="min-w-[280px] flex-1">
            <Input
              value={expr}
              onChange={(e) => setExpr(e.target.value)}
              placeholder="*/15 9-17 * * MON-FRI"
              className="font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Expanded fields">
            <CopyButton
              value={() =>
                result.fields.map((f) => `${f.name} (${f.token}): ${f.values.join(',')}`).join('\n')
              }
            />
          </PanelHeader>
          <div className="divide-y">
            {result.fields.map((f) => (
              <div key={f.name} className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-start sm:gap-3">
                <span className="w-32 shrink-0 text-sm text-muted-foreground">{f.name}</span>
                <code className="w-24 shrink-0 font-mono text-xs">{f.token}</code>
                <span className="min-w-0 flex-1 break-words font-mono text-xs">
                  {f.values.join(', ') || '(none)'}
                </span>
                <span className="shrink-0 self-center font-mono text-2xs text-muted-foreground">
                  {f.values.length} val
                </span>
              </div>
            ))}
          </div>
          <StatBar
            items={[
              `${result.fields.length} fields`,
              `${result.perDay.toLocaleString()} fire times/day`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
