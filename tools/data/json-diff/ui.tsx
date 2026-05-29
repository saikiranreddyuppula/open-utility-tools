'use client';

import { useMemo, useState } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { ErrorBanner } from '@/components/tools/error-banner';
import { diffLines, diffStats } from '@/lib/text/diff';
import { cn } from '@/lib/utils';

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortDeep(v)])
    );
  }
  return value;
}

function normalize(input: string): string {
  if (!input.trim()) return '';
  return JSON.stringify(sortDeep(JSON.parse(input)), null, 2);
}

export default function JsonDiffTool() {
  const [a, setA] = useState('');
  const [b, setB] = useState('');

  const { lines, stats, error } = useMemo(() => {
    try {
      const na = normalize(a);
      const nb = normalize(b);
      const result = diffLines(na, nb);
      return { lines: result, stats: diffStats(result), error: null as string | null };
    } catch (e) {
      return { lines: [], stats: null, error: e instanceof Error ? e.message : 'Invalid JSON' };
    }
  }, [a, b]);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="JSON A" />
          <Textarea
            value={a}
            onChange={(e) => setA(e.target.value)}
            placeholder='{ "a": 1 }'
            spellCheck={false}
            className="min-h-40 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </Panel>
        <Panel>
          <PanelHeader title="JSON B" />
          <Textarea
            value={b}
            onChange={(e) => setB(e.target.value)}
            placeholder='{ "a": 2 }'
            spellCheck={false}
            className="min-h-40 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </Panel>
      </div>

      {error && (a || b) ? (
        <ErrorBanner error={error} />
      ) : (
        <Panel>
          <PanelHeader title="Diff (keys sorted)" />
          <div className="max-h-[480px] overflow-auto font-mono text-xs">
            {a || b ? (
              lines.map((l, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex gap-2 px-3 py-0.5',
                    l.op === 'add' && 'bg-[color-mix(in_oklch,var(--success)_14%,transparent)]',
                    l.op === 'del' && 'bg-destructive/10'
                  )}
                >
                  <span className="w-4 shrink-0 select-none text-muted-foreground">
                    {l.op === 'add' ? '+' : l.op === 'del' ? '−' : ' '}
                  </span>
                  <span className="whitespace-pre-wrap break-all">{l.text || ' '}</span>
                </div>
              ))
            ) : (
              <p className="p-3 text-muted-foreground">Enter JSON in both panes to compare.</p>
            )}
          </div>
          {stats && (
            <StatBar
              items={[`+${stats.added} added`, `−${stats.removed} removed`, `${stats.unchanged} unchanged`]}
            />
          )}
        </Panel>
      )}
    </div>
  );
}
