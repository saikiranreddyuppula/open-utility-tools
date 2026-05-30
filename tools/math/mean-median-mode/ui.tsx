'use client';

import { useMemo, useState } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

const SAMPLE = '4, 8, 15, 16, 23, 42, 8, 16, 16';

function parseNumbers(text: string): { error: string } | { values: number[] } {
  const tokens = text.split(/[\s,]+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return { error: 'Enter at least one number.' };
  const values: number[] = [];
  for (const t of tokens) {
    const n = Number(t);
    if (!Number.isFinite(n)) return { error: `Not a number: "${t}"` };
    values.push(n);
  }
  return { values };
}

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid] ?? 0;
  const a = sorted[mid - 1] ?? 0;
  const b = sorted[mid] ?? 0;
  return (a + b) / 2;
}

function modes(values: number[]): { values: number[]; freq: number } {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let maxFreq = 0;
  for (const c of counts.values()) if (c > maxFreq) maxFreq = c;
  if (maxFreq <= 1) return { values: [], freq: maxFreq };
  const result: number[] = [];
  for (const [val, c] of counts) if (c === maxFreq) result.push(val);
  result.sort((a, b) => a - b);
  return { values: result, freq: maxFreq };
}

export default function MeanMedianModeTool() {
  const [text, setText] = useState(SAMPLE);
  const [precision, setPrecision] = useState(4);

  const result = useMemo(() => {
    const parsed = parseNumbers(text);
    if ('error' in parsed) return parsed;
    const values = parsed.values;
    const n = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const sorted = [...values].sort((a, b) => a - b);
    const med = median(sorted);
    const min = sorted[0] ?? 0;
    const max = sorted[n - 1] ?? 0;
    const range = max - min;
    const m = modes(values);

    const allPositive = values.every((v) => v > 0);
    let geometric: number | null = null;
    let harmonic: number | null = null;
    if (allPositive) {
      const logSum = values.reduce((a, b) => a + Math.log(b), 0);
      geometric = Math.exp(logSum / n);
      const recipSum = values.reduce((a, b) => a + 1 / b, 0);
      harmonic = n / recipSum;
    }

    return { n, sum, mean, median: med, min, max, range, modes: m, geometric, harmonic };
  }, [text]);

  const fmt = (n: number) => {
    if (Object.is(n, -0)) n = 0;
    const rounded = Math.round(n);
    if (Math.abs(n - rounded) < 1e-12) return String(rounded);
    return n.toFixed(precision);
  };

  const rows = useMemo(() => {
    if ('error' in result) return [];
    const modeText =
      result.modes.values.length === 0
        ? 'No mode (all unique)'
        : `${result.modes.values.map((v) => fmt(v)).join(', ')} (×${result.modes.freq})`;
    const r: { label: string; value: string }[] = [
      { label: 'Count', value: String(result.n) },
      { label: 'Sum', value: fmt(result.sum) },
      { label: 'Mean (arithmetic)', value: fmt(result.mean) },
      { label: 'Median', value: fmt(result.median) },
      { label: 'Mode(s)', value: modeText },
      { label: 'Range', value: fmt(result.range) },
      { label: 'Min', value: fmt(result.min) },
      { label: 'Max', value: fmt(result.max) },
    ];
    if (result.geometric != null) r.push({ label: 'Geometric mean', value: fmt(result.geometric) });
    if (result.harmonic != null) r.push({ label: 'Harmonic mean', value: fmt(result.harmonic) });
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, precision]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label={`Decimal precision: ${precision}`} className="min-w-[220px]">
          <Slider
            value={[precision]}
            min={0}
            max={10}
            step={1}
            onValueChange={(v) => setPrecision(v[0] ?? 4)}
          />
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Numbers (comma, space, or newline separated)" />
        <div className="p-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            rows={4}
            className="font-mono text-sm"
          />
        </div>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Results">
            <CopyButton value={() => rows.map((r) => `${r.label}: ${r.value}`).join('\n')} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {rows.map((r) => (
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
          <StatBar items={[`${result.n} value${result.n === 1 ? '' : 's'}`]} />
        </Panel>
      )}
    </div>
  );
}
