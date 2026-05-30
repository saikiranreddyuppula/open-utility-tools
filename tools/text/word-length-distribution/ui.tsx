'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';

const SAMPLE =
  'Short words help. Longer, more elaborate constructions occasionally challenge the reader. ' +
  'Vary your sentence length deliberately. A sudden short sentence lands. Then a longer, flowing ' +
  'passage carries the idea forward with rhythm and momentum, building toward a conclusion that ' +
  'feels earned rather than abrupt.';

interface Stats {
  mean: number;
  median: number;
  mode: number;
  min: number;
  max: number;
  sd: number;
  n: number;
}

function computeStats(values: number[]): Stats | null {
  const n = values.length;
  if (n === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const mid = Math.floor(n / 2);
  const median =
    n % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0);

  const freq = new Map<number, number>();
  for (const v of sorted) freq.set(v, (freq.get(v) ?? 0) + 1);
  let mode = sorted[0] ?? 0;
  let best = -1;
  for (const [v, c] of freq) {
    if (c > best) {
      best = c;
      mode = v;
    }
  }

  const variance = sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
  const sd = Math.sqrt(variance);
  return { mean, median, mode, min: sorted[0] ?? 0, max: sorted[n - 1] ?? 0, sd, n };
}

function histogram(values: number[]): { bucket: number; count: number }[] {
  if (values.length === 0) return [];
  const max = Math.max(...values);
  const out: { bucket: number; count: number }[] = [];
  for (let b = 1; b <= max; b++) {
    out.push({ bucket: b, count: values.filter((v) => v === b).length });
  }
  return out;
}

function bar(count: number, maxCount: number): string {
  if (maxCount === 0) return '';
  const width = Math.round((count / maxCount) * 24);
  return '█'.repeat(width);
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && /[a-zA-Z0-9]/.test(s));
}

export default function WordLengthDistribution() {
  const [text, setText] = useState(SAMPLE);

  const result = useMemo(() => {
    const wordMatches = text.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) ?? [];
    if (wordMatches.length === 0) return { error: 'Enter some text to analyze.' };

    const wordLengths = wordMatches.map((w) => w.replace(/['’]/g, '').length);

    const sentences = splitSentences(text);
    const sentLengths = sentences.map((s) => (s.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) ?? []).length);

    const wordStats = computeStats(wordLengths);
    const sentStats = computeStats(sentLengths.filter((n) => n > 0));
    if (!wordStats) return { error: 'No words found.' };

    return {
      wordHist: histogram(wordLengths),
      sentHist: histogram(sentLengths.filter((n) => n > 0)),
      wordStats,
      sentStats,
    };
  }, [text]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Text" />
        <div className="p-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            rows={6}
            placeholder="Paste prose to chart its length distributions…"
          />
        </div>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DistPanel
            title="Word length (characters)"
            hist={result.wordHist}
            stats={result.wordStats}
            unit="chars"
          />
          {result.sentStats && (
            <DistPanel
              title="Sentence length (words)"
              hist={result.sentHist}
              stats={result.sentStats}
              unit="words"
            />
          )}
        </div>
      )}
    </div>
  );
}

function DistPanel({
  title,
  hist,
  stats,
  unit,
}: {
  title: string;
  hist: { bucket: number; count: number }[];
  stats: Stats;
  unit: string;
}) {
  const maxCount = hist.reduce((m, h) => Math.max(m, h.count), 0);
  const statRows: { label: string; value: string }[] = [
    { label: 'Mean', value: stats.mean.toFixed(2) },
    { label: 'Median', value: stats.median.toFixed(1) },
    { label: 'Mode', value: String(stats.mode) },
    { label: 'Min', value: String(stats.min) },
    { label: 'Max', value: String(stats.max) },
    { label: 'Std dev', value: stats.sd.toFixed(2) },
  ];

  return (
    <Panel>
      <PanelHeader title={title}>
        <CopyButton
          value={() =>
            [
              ...hist.map((h) => `${String(h.bucket).padStart(3)} ${unit}: ${h.count}`),
              ...statRows.map((r) => `${r.label}: ${r.value}`),
            ].join('\n')
          }
        />
      </PanelHeader>
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
        {statRows.map((r) => (
          <div key={r.label} className="rounded-md border bg-muted/30 px-2 py-1.5">
            <div className="text-2xs uppercase tracking-wide text-muted-foreground">{r.label}</div>
            <div className="font-mono text-sm font-semibold">{r.value}</div>
          </div>
        ))}
      </div>
      <div className="max-h-[300px] overflow-auto px-3 pb-3">
        <div className="space-y-0.5 font-mono text-xs">
          {hist.map((h) => (
            <div key={h.bucket} className="flex items-center gap-2">
              <span className="w-8 shrink-0 text-right text-muted-foreground">{h.bucket}</span>
              <span className="min-w-0 flex-1 truncate text-primary/70">
                {bar(h.count, maxCount)}
              </span>
              <span className="w-8 shrink-0 text-right">{h.count}</span>
            </div>
          ))}
        </div>
      </div>
      <StatBar items={[`n = ${stats.n}`, `range = ${stats.min}–${stats.max} ${unit}`]} />
    </Panel>
  );
}
