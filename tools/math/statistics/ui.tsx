'use client';

import { useMemo, useState } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { Panel, PanelHeader } from '@/components/tools/panel';
import { statistics } from '@/lib/math/numbers';

const fmt = (n: number) => (Math.round(n * 1e6) / 1e6).toLocaleString();

export default function StatisticsTool() {
  const [input, setInput] = useState('4, 8, 15, 16, 23, 42');

  const stats = useMemo(() => {
    const values = input
      .split(/[\s,;]+/)
      .filter(Boolean)
      .map(Number)
      .filter((n) => Number.isFinite(n));
    return statistics(values);
  }, [input]);

  const cells = stats
    ? [
        ['Count', stats.count],
        ['Sum', stats.sum],
        ['Mean', stats.mean],
        ['Median', stats.median],
        ['Min', stats.min],
        ['Max', stats.max],
        ['Range', stats.range],
        ['Variance', stats.variance],
        ['Std dev (σ)', stats.stddev],
      ]
    : [];

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <PanelHeader title="Numbers (comma, space or newline separated)" />
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          className="min-h-24 resize-y rounded-none border-0 bg-transparent font-mono shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>
      {stats && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {cells.map(([label, value]) => (
            <div key={label} className="rounded-lg border bg-card p-3">
              <div className="font-mono text-lg font-semibold tabular">{fmt(value as number)}</div>
              <div className="text-2xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
