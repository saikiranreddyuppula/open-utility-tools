'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

interface UnitDef {
  seconds: number;
  canonical: string;
}

const UNITS: Record<string, UnitDef> = {
  w: { seconds: 604800, canonical: 'w' },
  week: { seconds: 604800, canonical: 'w' },
  weeks: { seconds: 604800, canonical: 'w' },
  d: { seconds: 86400, canonical: 'd' },
  day: { seconds: 86400, canonical: 'd' },
  days: { seconds: 86400, canonical: 'd' },
  h: { seconds: 3600, canonical: 'h' },
  hr: { seconds: 3600, canonical: 'h' },
  hrs: { seconds: 3600, canonical: 'h' },
  hour: { seconds: 3600, canonical: 'h' },
  hours: { seconds: 3600, canonical: 'h' },
  // 'm' is treated as minutes (the common convention for duration strings)
  m: { seconds: 60, canonical: 'm' },
  min: { seconds: 60, canonical: 'm' },
  mins: { seconds: 60, canonical: 'm' },
  minute: { seconds: 60, canonical: 'm' },
  minutes: { seconds: 60, canonical: 'm' },
  s: { seconds: 1, canonical: 's' },
  sec: { seconds: 1, canonical: 's' },
  secs: { seconds: 1, canonical: 's' },
  second: { seconds: 1, canonical: 's' },
  seconds: { seconds: 1, canonical: 's' },
  ms: { seconds: 0.001, canonical: 'ms' },
  msec: { seconds: 0.001, canonical: 'ms' },
  millisecond: { seconds: 0.001, canonical: 'ms' },
  milliseconds: { seconds: 0.001, canonical: 'ms' },
};

const CANON_ORDER: Array<{ key: string; seconds: number }> = [
  { key: 'w', seconds: 604800 },
  { key: 'd', seconds: 86400 },
  { key: 'h', seconds: 3600 },
  { key: 'm', seconds: 60 },
  { key: 's', seconds: 1 },
  { key: 'ms', seconds: 0.001 },
];

type ParseResult =
  | { error: string }
  | {
      totalSeconds: number;
      totalMs: number;
      totalMinutes: number;
      totalHours: number;
      canonical: string;
      matched: Array<{ raw: string; seconds: number }>;
      unknown: string[];
    };

function parseDuration(input: string): ParseResult {
  const text = input.trim();
  if (!text) return { error: 'Enter a duration string, e.g. "1h30m" or "2 days 4 hours".' };

  // Match number (with optional decimal) followed by an alphabetic unit.
  const tokenRe = /([0-9]*\.?[0-9]+)\s*([a-zA-Z]+)/g;
  let totalSeconds = 0;
  const matched: Array<{ raw: string; seconds: number }> = [];
  const unknown: string[] = [];

  let m: RegExpExecArray | null = tokenRe.exec(text);
  while (m !== null) {
    const numStr = m[1] ?? '';
    const unitStr = (m[2] ?? '').toLowerCase();
    const num = Number(numStr);
    const def = UNITS[unitStr];
    if (def && Number.isFinite(num)) {
      const secs = num * def.seconds;
      totalSeconds += secs;
      matched.push({ raw: m[0] ?? '', seconds: secs });
    } else {
      unknown.push(m[0] ?? unitStr);
    }
    m = tokenRe.exec(text);
  }

  // Find stray tokens that are not number+unit pairs (e.g. lone words).
  const leftover = text.replace(tokenRe, ' ').trim();
  if (leftover) {
    for (const piece of leftover.split(/\s+/)) {
      if (piece && !/^[,;:.\-+]+$/.test(piece)) unknown.push(piece);
    }
  }

  if (matched.length === 0) {
    return { error: `No recognizable number+unit pairs found. Use units like w, d, h, m, s, ms.` };
  }

  // Build canonical normalized form from the total.
  let remainder = Math.round(totalSeconds * 1000); // work in integer ms
  const parts: string[] = [];
  for (const { key, seconds } of CANON_ORDER) {
    const unitMs = seconds * 1000;
    if (unitMs < 1) {
      // ms unit: take whatever is left
      if (remainder > 0) parts.push(`${remainder}${key}`);
      remainder = 0;
      break;
    }
    const count = Math.floor(remainder / unitMs);
    if (count > 0) {
      parts.push(`${count}${key}`);
      remainder -= count * unitMs;
    }
  }
  const canonical = parts.length > 0 ? parts.join(' ') : '0s';

  return {
    totalSeconds,
    totalMs: totalSeconds * 1000,
    totalMinutes: totalSeconds / 60,
    totalHours: totalSeconds / 3600,
    canonical,
    matched,
    unknown,
  };
}

function trimNum(n: number, digits = 6): string {
  if (Number.isInteger(n)) return n.toString();
  return Number(n.toFixed(digits)).toString();
}

export default function DurationParserTool() {
  const [input, setInput] = useState('1h 30m 15s');

  const result = useMemo(() => parseDuration(input), [input]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Duration" className="min-w-[260px] flex-1">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. 1h30m, 2 days 4 hours, 90s"
              className="font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Parsed duration">
            <CopyButton
              value={() =>
                [
                  `Total seconds: ${trimNum(result.totalSeconds)}`,
                  `Total milliseconds: ${trimNum(result.totalMs)}`,
                  `Total minutes: ${trimNum(result.totalMinutes)}`,
                  `Normalized: ${result.canonical}`,
                ].join('\n')
              }
            />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {[
              { label: 'Total seconds', value: trimNum(result.totalSeconds) },
              { label: 'Total milliseconds', value: trimNum(result.totalMs) },
              { label: 'Total minutes', value: trimNum(result.totalMinutes) },
              { label: 'Total hours', value: trimNum(result.totalHours) },
              { label: 'Normalized', value: result.canonical },
            ].map((r) => (
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
          {result.unknown.length > 0 && (
            <div className="px-3 pb-3 text-xs text-amber-600 dark:text-amber-400">
              Ignored unrecognized token{result.unknown.length > 1 ? 's' : ''}:{' '}
              <span className="font-mono">{result.unknown.join(', ')}</span>
            </div>
          )}
          <StatBar
            items={[
              `${result.matched.length} pair${result.matched.length === 1 ? '' : 's'} matched`,
              `${result.unknown.length} ignored`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
