'use client';

import { useMemo, useState } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { diffLines, diffStats } from '@/lib/text/diff';
import { cn } from '@/lib/utils';

export default function TextDiffTool() {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [ignoreWs, setIgnoreWs] = useState(false);

  const { lines, stats } = useMemo(() => {
    const norm = (s: string) => (ignoreWs ? s.replace(/[ \t]+/g, ' ').replace(/[ \t]+$/gm, '') : s);
    const result = diffLines(norm(a), norm(b));
    return { lines: result, stats: diffStats(result) };
  }, [a, b, ignoreWs]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Options">
          <div className="flex h-8 items-center gap-2">
            <Switch id="iws" checked={ignoreWs} onCheckedChange={setIgnoreWs} />
            <Label htmlFor="iws" className="text-xs text-muted-foreground">
              ignore whitespace
            </Label>
          </div>
        </Field>
      </OptionsBar>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Original" />
          <Textarea
            value={a}
            onChange={(e) => setA(e.target.value)}
            placeholder="Paste the original text…"
            spellCheck={false}
            className="min-h-40 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </Panel>
        <Panel>
          <PanelHeader title="Changed" />
          <Textarea
            value={b}
            onChange={(e) => setB(e.target.value)}
            placeholder="Paste the changed text…"
            spellCheck={false}
            className="min-h-40 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Diff" />
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
                <span className="whitespace-pre-wrap break-all">{l.text || ' '}</span>
              </div>
            ))
          ) : (
            <p className="p-3 text-muted-foreground">Enter text in both panes to compare.</p>
          )}
        </div>
        <StatBar
          items={[
            `+${stats.added} added`,
            `−${stats.removed} removed`,
            `${stats.unchanged} unchanged`,
          ]}
        />
      </Panel>
    </div>
  );
}
