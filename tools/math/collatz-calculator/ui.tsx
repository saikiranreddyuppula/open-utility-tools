'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

interface CollatzResult {
  seq: bigint[];
  steps: number;
  shortcutSteps: number;
  peak: bigint;
  oddSteps: number;
  evenSteps: number;
  tailPowers: number;
}

function computeCollatz(start: bigint): CollatzResult {
  const seq: bigint[] = [start];
  let n = start;
  let oddSteps = 0;
  let evenSteps = 0;
  let shortcutSteps = 0;
  let peak = start;
  // Hard cap to avoid runaway loops on (hypothetical) non-terminating inputs.
  const MAX = 100000;
  while (n !== 1n && seq.length <= MAX) {
    if (n % 2n === 0n) {
      n = n / 2n;
      evenSteps += 1;
    } else {
      n = 3n * n + 1n;
      oddSteps += 1;
    }
    if (n > peak) peak = n;
    seq.push(n);
  }
  // Shortcut steps: fuse "3n+1 then /2" into one step.
  let m = start;
  while (m !== 1n && shortcutSteps < MAX) {
    if (m % 2n === 0n) {
      m = m / 2n;
    } else {
      m = (3n * m + 1n) / 2n;
    }
    shortcutSteps += 1;
  }
  // Powers-of-two tail: from the first power-of-two term onward, the sequence is a
  // pure run of halvings down to 1. Find that first power-of-two index.
  let tailPowers = 0;
  let firstPow = -1;
  for (let i = 0; i < seq.length; i++) {
    const v = seq[i];
    if (v === undefined) continue;
    if (v > 0n && (v & (v - 1n)) === 0n) {
      firstPow = i;
      break;
    }
  }
  if (firstPow >= 0) {
    tailPowers = seq.length - firstPow;
  }
  return {
    seq,
    steps: seq.length - 1,
    shortcutSteps,
    peak,
    oddSteps,
    evenSteps,
    tailPowers,
  };
}

function sparkline(seq: bigint[]): string {
  const bars = '▁▂▃▄▅▆▇█';
  if (seq.length === 0) return '';
  // Use log magnitude so huge peaks don't flatten the line.
  const logs = seq.map((v) => Math.log10(Number(v < 1n ? 1n : v) + 1));
  let min = Infinity;
  let max = -Infinity;
  for (const l of logs) {
    if (l < min) min = l;
    if (l > max) max = l;
  }
  const span = max - min || 1;
  return logs
    .map((l) => {
      const idx = Math.min(bars.length - 1, Math.max(0, Math.round(((l - min) / span) * (bars.length - 1))));
      return bars[idx] ?? '▁';
    })
    .join('');
}

export default function CollatzCalculatorTool() {
  const [start, setStart] = useState('27');
  const [showSpark, setShowSpark] = useState(true);

  const result = useMemo(() => {
    const trimmed = start.trim();
    if (!trimmed) return { error: 'Enter a positive integer.' as string };
    if (!/^[0-9]+$/.test(trimmed)) return { error: 'Enter a positive whole number (digits only).' };
    let n: bigint;
    try {
      n = BigInt(trimmed);
    } catch {
      return { error: 'Could not parse the number.' };
    }
    if (n < 1n) return { error: 'Start value must be at least 1.' };
    if (n > 10n ** 18n) return { error: 'Keep the start value below 10^18 for responsiveness.' };
    const r = computeCollatz(n);
    if (r.seq.length > 100000) return { error: 'Sequence exceeded 100,000 terms (unexpected).' };
    return { r };
  }, [start]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Start value (n)" className="min-w-[200px] flex-1">
            <Input
              value={start}
              onChange={(e) => setStart(e.target.value)}
              inputMode="numeric"
              placeholder="27"
            />
          </Field>
          <Field label="Show sparkline">
            <Switch checked={showSpark} onCheckedChange={setShowSpark} />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="Statistics">
              <CopyButton
                value={() =>
                  [
                    `Start: ${start.trim()}`,
                    `Steps (stopping time): ${result.r.steps}`,
                    `Shortcut steps: ${result.r.shortcutSteps}`,
                    `Peak value: ${result.r.peak.toString()}`,
                    `Odd steps: ${result.r.oddSteps}`,
                    `Even steps: ${result.r.evenSteps}`,
                    `Powers-of-two tail length: ${result.r.tailPowers}`,
                  ].join('\n')
                }
              />
            </PanelHeader>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
              {[
                { label: 'Total stopping time (steps)', value: result.r.steps.toString() },
                { label: 'Shortcut steps (n/2 fused)', value: result.r.shortcutSteps.toString() },
                { label: 'Peak value reached', value: result.r.peak.toString() },
                { label: 'Odd (3n+1) steps', value: result.r.oddSteps.toString() },
                { label: 'Even (n/2) steps', value: result.r.evenSteps.toString() },
                { label: 'Powers-of-two tail length', value: result.r.tailPowers.toString() },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
                >
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className="flex items-center gap-2 font-mono text-sm">
                    <span className="break-all text-right">{row.value}</span>
                    <CopyButton value={row.value} size="icon-sm" />
                  </span>
                </div>
              ))}
            </div>
            <StatBar items={[`${result.r.seq.length} terms`, `peaks at ${result.r.peak.toString()}`]} />
          </Panel>

          {showSpark && (
            <Panel>
              <PanelHeader title="Magnitude sparkline (log scale)" />
              <div className="overflow-x-auto p-3">
                <pre className="whitespace-pre font-mono text-sm leading-none">{sparkline(result.r.seq)}</pre>
              </div>
            </Panel>
          )}

          <Panel>
            <PanelHeader title="Trajectory sequence">
              <CopyButton value={() => result.r.seq.map((v) => v.toString()).join(', ')} />
            </PanelHeader>
            <div className="max-h-[360px] overflow-auto p-3">
              <p className="break-all font-mono text-xs leading-relaxed text-muted-foreground">
                {result.r.seq.map((v) => v.toString()).join(' → ')}
              </p>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
