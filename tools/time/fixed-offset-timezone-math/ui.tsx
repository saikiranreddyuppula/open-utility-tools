'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

// Parse a signed UTC offset like "+05:30", "-8", "+0545", "0" into minutes.
function parseOffset(raw: string): number | null {
  const text = raw.trim();
  if (text === '' ) return null;
  const m = /^([+-]?)(\d{1,2})(?::?(\d{2}))?$/.exec(text.replace(/^utc|^gmt/i, '').trim());
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  const hours = Number(m[2] ?? '');
  const mins = Number(m[3] ?? '0');
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null;
  if (hours > 14 || mins > 59) return null;
  return sign * (hours * 60 + mins);
}

function fmtOffset(min: number): string {
  const sign = min < 0 ? '-' : '+';
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

interface TargetRow {
  offsetLabel: string;
  datetime: string;
  hourDiff: string;
  dayShift: string;
}

type Result =
  | { error: string }
  | {
      utcIso: string;
      sourceLabel: string;
      rows: TargetRow[];
    };

function compute(dt: string, srcOff: string, targets: string): Result {
  const text = dt.trim();
  if (!text) return { error: 'Enter a source datetime.' };

  // Parse the local datetime as plain wall-clock components (no zone applied yet).
  const m = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text);
  if (!m) return { error: 'Datetime must look like 2026-05-30T14:30 (YYYY-MM-DDTHH:MM).' };
  const year = Number(m[1] ?? '');
  const month = Number(m[2] ?? '');
  const day = Number(m[3] ?? '');
  const hour = Number(m[4] ?? '');
  const minute = Number(m[5] ?? '');
  const second = Number(m[6] ?? '0');
  if (![year, month, day, hour, minute, second].every(Number.isFinite)) {
    return { error: 'Could not parse the datetime fields.' };
  }

  const srcMin = parseOffset(srcOff);
  if (srcMin === null) return { error: 'Source offset is invalid. Use a form like +05:30 or -8.' };

  // Wall-clock as if UTC, then subtract the source offset to get the true UTC instant.
  const wallUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  if (Number.isNaN(wallUtcMs)) return { error: 'Datetime is out of range.' };
  const trueUtcMs = wallUtcMs - srcMin * 60000;
  const utcDate = new Date(trueUtcMs);

  const targetLines = targets
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (targetLines.length === 0) return { error: 'Add at least one target offset (one per line).' };

  const rows: TargetRow[] = [];
  for (const line of targetLines) {
    const tMin = parseOffset(line);
    if (tMin === null) {
      rows.push({ offsetLabel: line, datetime: 'invalid offset', hourDiff: '—', dayShift: '—' });
      continue;
    }
    const localMs = trueUtcMs + tMin * 60000;
    const ld = new Date(localMs);
    const localStr =
      `${ld.getUTCFullYear()}-${pad2(ld.getUTCMonth() + 1)}-${pad2(ld.getUTCDate())} ` +
      `${pad2(ld.getUTCHours())}:${pad2(ld.getUTCMinutes())}:${pad2(ld.getUTCSeconds())}`;

    const diffMin = tMin - srcMin;
    const diffH = diffMin / 60;
    const diffLabel = `${diffMin >= 0 ? '+' : ''}${Number(diffH.toFixed(2))} h`;

    // Compare calendar day vs source wall-clock day.
    const srcDayMs = Date.UTC(year, month - 1, day);
    const tgtDayMs = Date.UTC(ld.getUTCFullYear(), ld.getUTCMonth(), ld.getUTCDate());
    const dayDelta = Math.round((tgtDayMs - srcDayMs) / 86400000);
    let dayShift = 'same day';
    if (dayDelta === 1) dayShift = 'next day (+1)';
    else if (dayDelta === -1) dayShift = 'previous day (-1)';
    else if (dayDelta > 1) dayShift = `+${dayDelta} days`;
    else if (dayDelta < -1) dayShift = `${dayDelta} days`;

    rows.push({ offsetLabel: fmtOffset(tMin), datetime: localStr, hourDiff: diffLabel, dayShift });
  }

  return {
    utcIso: utcDate.toISOString(),
    sourceLabel: `${year}-${pad2(month)}-${pad2(day)} ${pad2(hour)}:${pad2(minute)}:${pad2(second)} (${fmtOffset(srcMin)})`,
    rows,
  };
}

export default function FixedOffsetTimezoneMathTool() {
  const [dt, setDt] = useState('2026-05-30T14:30');
  const [srcOff, setSrcOff] = useState('+05:30');
  const [targets, setTargets] = useState('-08:00\n+00:00\n+09:00');

  const result = useMemo(() => compute(dt, srcOff, targets), [dt, srcOff, targets]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Source datetime" className="min-w-[200px]">
            <Input
              value={dt}
              onChange={(e) => setDt(e.target.value)}
              placeholder="2026-05-30T14:30"
              className="font-mono"
            />
          </Field>
          <Field label="Source offset">
            <Input
              value={srcOff}
              onChange={(e) => setSrcOff(e.target.value)}
              placeholder="+05:30"
              className="w-28 font-mono"
            />
          </Field>
          <Field label="Target offsets (one per line)" className="min-w-[200px] flex-1">
            <Textarea
              value={targets}
              onChange={(e) => setTargets(e.target.value)}
              spellCheck={false}
              rows={3}
              className="font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Converted datetimes">
            <CopyButton
              value={() =>
                [
                  `UTC: ${result.utcIso}`,
                  ...result.rows.map((r) => `${r.offsetLabel}: ${r.datetime} (${r.dayShift}, ${r.hourDiff})`),
                ].join('\n')
              }
            />
          </PanelHeader>
          <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
            <span className="text-sm text-muted-foreground">UTC instant</span>
            <span className="flex items-center gap-2 font-mono text-sm">
              <span>{result.utcIso}</span>
              <CopyButton value={result.utcIso} size="icon-sm" />
            </span>
          </div>
          <div className="divide-y">
            {result.rows.map((r, i) => (
              <div key={`${r.offsetLabel}-${i}`} className="flex items-center gap-3 px-3 py-2">
                <code className="w-20 shrink-0 font-mono text-xs">{r.offsetLabel}</code>
                <span className="min-w-0 flex-1 font-mono text-sm">{r.datetime}</span>
                <span className="hidden w-28 shrink-0 text-xs text-muted-foreground sm:block">{r.dayShift}</span>
                <span className="hidden w-20 shrink-0 text-right text-xs text-muted-foreground sm:block">{r.hourDiff}</span>
                <CopyButton value={r.datetime} size="icon-sm" />
              </div>
            ))}
          </div>
          <StatBar items={[`Source ${result.sourceLabel}`, `${result.rows.length} target${result.rows.length === 1 ? '' : 's'}`, 'Fixed offsets — no DST']} />
        </Panel>
      )}
    </div>
  );
}
