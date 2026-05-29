'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Panel, PanelHeader } from '@/components/tools/panel';
import { ErrorBanner } from '@/components/tools/error-banner';
import { explainCron, nextRuns } from '@/lib/time/cron';

const EXAMPLES = [
  ['*/15 * * * *', 'Every 15 minutes'],
  ['0 9 * * 1-5', 'Weekdays at 9am'],
  ['0 0 1 * *', 'Monthly'],
  ['@daily', 'Daily at midnight'],
];

export default function CronParserTool() {
  const [expr, setExpr] = useState('0 9 * * 1-5');

  const { explanation, runs, error } = useMemo(() => {
    if (!expr.trim()) return { explanation: '', runs: [], error: null };
    try {
      return { explanation: explainCron(expr), runs: nextRuns(expr, 6), error: null };
    } catch (e) {
      return { explanation: '', runs: [], error: e instanceof Error ? e.message : 'Invalid cron' };
    }
  }, [expr]);

  return (
    <div className="flex flex-col gap-3">
      <Input
        value={expr}
        onChange={(e) => setExpr(e.target.value)}
        placeholder="*/15 9-17 * * 1-5"
        className="h-10 font-mono text-base"
        spellCheck={false}
      />
      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map(([ex, label]) => (
          <button
            key={ex}
            onClick={() => setExpr(ex!)}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          >
            <code className="font-mono">{ex}</code>
            <span className="text-2xs opacity-70">{label}</span>
          </button>
        ))}
      </div>

      {error && <ErrorBanner error={error} />}

      {explanation && (
        <>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">Meaning</p>
            <p className="mt-1 text-sm">“{explanation}”</p>
          </div>
          <Panel>
            <PanelHeader title="Next runs" />
            <div className="divide-y">
              {runs.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-1.5 font-mono text-xs">
                  <span>{r.toLocaleString()}</span>
                  <span className="text-muted-foreground">{r.toISOString()}</span>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
      <p className="px-1 text-2xs text-muted-foreground">
        Standard 5-field cron (minute hour day-of-month month day-of-week). Next-run times use your local timezone.
      </p>
    </div>
  );
}
