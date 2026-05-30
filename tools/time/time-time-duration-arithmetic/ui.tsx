'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type OutFormat = 'hms' | 'seconds' | 'decimal';

/** Parse a single signed duration line. Returns null on syntax error. */
function parseLine(raw: string): number | null {
  let text = raw.trim();
  if (!text) return null;

  let sign = 1;
  if (text.startsWith('+')) {
    text = text.slice(1).trim();
  } else if (text.startsWith('-')) {
    sign = -1;
    text = text.slice(1).trim();
  }
  if (!text) return null;

  // Colon-separated form: HH:MM:SS or MM:SS (also H:MM)
  if (text.includes(':')) {
    const parts = text.split(':');
    if (parts.length < 2 || parts.length > 3) return null;
    const nums = parts.map((p) => Number(p));
    for (const n of nums) {
      if (!Number.isFinite(n) || n < 0) return null;
    }
    let h = 0;
    let m = 0;
    let s = 0;
    if (parts.length === 3) {
      h = nums[0] ?? 0;
      m = nums[1] ?? 0;
      s = nums[2] ?? 0;
    } else {
      m = nums[0] ?? 0;
      s = nums[1] ?? 0;
    }
    return sign * (h * 3600 + m * 60 + s);
  }

  // Unit form: 1h2m3s (any subset). Require at least one unit token.
  const unitRe = /(\d+(?:\.\d+)?)\s*([hms])/gi;
  let total = 0;
  let matchedAny = false;
  let consumed = 0;
  let mt: RegExpExecArray | null = unitRe.exec(text);
  while (mt !== null) {
    matchedAny = true;
    consumed += (mt[0] ?? '').replace(/\s+/g, '').length;
    const val = Number(mt[1] ?? '');
    const unit = (mt[2] ?? '').toLowerCase();
    if (!Number.isFinite(val)) return null;
    if (unit === 'h') total += val * 3600;
    else if (unit === 'm') total += val * 60;
    else total += val;
    mt = unitRe.exec(text);
  }

  if (matchedAny) {
    // Reject lines with stray non-unit characters (anything but the matched units).
    if (text.replace(/\s+/g, '').length !== consumed) return null;
    return sign * total;
  }

  // Bare number with no unit and no colon → treat as seconds.
  const n = Number(text);
  if (!Number.isFinite(n)) return null;
  return sign * n;
}

function formatHMS(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? '-' : '';
  const abs = Math.abs(Math.round(totalSeconds * 1000) / 1000);
  const whole = Math.floor(abs);
  const frac = abs - whole;
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const secStr =
    frac > 0
      ? (s + frac).toFixed(3).replace(/\.?0+$/, '')
      : String(s);
  const sPad = secStr.padStart(2, '0');
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${sPad}`;
}

function formatValue(totalSeconds: number, fmt: OutFormat): string {
  if (fmt === 'seconds') return `${Math.round(totalSeconds * 1000) / 1000} s`;
  if (fmt === 'decimal') return `${(totalSeconds / 3600).toFixed(4)} h`;
  return formatHMS(totalSeconds);
}

export default function TimeDurationArithmetic() {
  const [input, setInput] = useState('+01:30:00\n+0:45:30\n-00:15:00\n+90m');
  const [fmt, setFmt] = useState<OutFormat>('hms');
  const [allowNegative, setAllowNegative] = useState(true);
  const [roundMinute, setRoundMinute] = useState(false);

  const result = useMemo(() => {
    const lines = input.split('\n');
    const tape: Array<{ line: string; secs: number; running: number; bad: boolean }> = [];
    let running = 0;
    let anyValue = false;

    for (const line of lines) {
      if (!line.trim()) continue;
      const parsed = parseLine(line);
      if (parsed === null) {
        tape.push({ line: line.trim(), secs: 0, running, bad: true });
        continue;
      }
      anyValue = true;
      running += parsed;
      tape.push({ line: line.trim(), secs: parsed, running, bad: false });
    }

    if (!anyValue) {
      return { error: 'Enter at least one valid duration line (e.g. +01:30:00, -15m, 1h2m3s).' };
    }

    let total = running;
    if (roundMinute) total = Math.round(total / 60) * 60;
    if (!allowNegative && total < 0) total = 0;

    return {
      tape,
      total,
      totalSeconds: total,
      decimalHours: total / 3600,
    };
  }, [input, fmt, allowNegative, roundMinute]);

  const isError = 'error' in result;

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Output format">
            <Tabs value={fmt} onValueChange={(v) => setFmt(v as OutFormat)}>
              <TabsList>
                <TabsTrigger value="hms">HH:MM:SS</TabsTrigger>
                <TabsTrigger value="seconds">Seconds</TabsTrigger>
                <TabsTrigger value="decimal">Decimal h</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Allow negative total">
            <Switch checked={allowNegative} onCheckedChange={setAllowNegative} />
          </Field>
          <Field label="Round to minute">
            <Switch checked={roundMinute} onCheckedChange={setRoundMinute} />
          </Field>
        </OptionsBar>
        <div className="p-3">
          <Field label="Durations" hint="One signed duration per line: HH:MM:SS, MM:SS, or 1h2m3s">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
              rows={6}
              className="font-mono"
            />
          </Field>
        </div>
      </Panel>

      {isError ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Running tape">
            <CopyButton value={() => formatValue(result.totalSeconds, fmt)} />
          </PanelHeader>
          <div className="max-h-[320px] divide-y overflow-auto">
            {result.tape.map((row, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                <code className="w-40 shrink-0 truncate font-mono text-xs text-muted-foreground">
                  {row.line}
                </code>
                {row.bad ? (
                  <span className="text-xs text-amber-600 dark:text-amber-400">ignored (unparseable)</span>
                ) : (
                  <>
                    <span className="w-28 shrink-0 font-mono text-xs">
                      {row.secs >= 0 ? '+' : ''}
                      {formatHMS(row.secs)}
                    </span>
                    <span className="ml-auto font-mono text-sm font-medium tabular">
                      {formatValue(row.running, fmt)}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
            {[
              { label: 'Total', value: formatHMS(result.totalSeconds) },
              { label: 'Total seconds', value: `${Math.round(result.totalSeconds * 1000) / 1000}` },
              { label: 'Decimal hours', value: result.decimalHours.toFixed(4) },
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
          <StatBar
            items={[
              `${result.tape.filter((t) => !t.bad).length} entries`,
              roundMinute && 'rounded to minute',
              !allowNegative && 'negatives clamped',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
