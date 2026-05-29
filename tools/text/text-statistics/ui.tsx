'use client';

import { useMemo, useState } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { Panel, PanelHeader } from '@/components/tools/panel';

export default function TextStatisticsTool() {
  const [input, setInput] = useState('');

  const { words, chars } = useMemo(() => {
    const wordList = input.toLowerCase().match(/[a-z0-9']+/g) ?? [];
    const wf = new Map<string, number>();
    for (const w of wordList) wf.set(w, (wf.get(w) ?? 0) + 1);
    const cf = new Map<string, number>();
    for (const c of input.replace(/\s/g, '')) cf.set(c.toLowerCase(), (cf.get(c.toLowerCase()) ?? 0) + 1);
    const top = (m: Map<string, number>, n: number) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
    return { words: top(wf, 15), chars: top(cf, 15) };
  }, [input]);

  const maxW = words[0]?.[1] ?? 1;
  const maxC = chars[0]?.[1] ?? 1;

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <PanelHeader title="Text" />
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste text to analyze frequency…"
          spellCheck={false}
          className="min-h-32 resize-y rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>

      {words.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Panel>
            <PanelHeader title="Top words" />
            <div className="divide-y">
              {words.map(([w, n]) => (
                <div key={w} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="w-28 shrink-0 truncate font-mono text-xs">{w}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-sm bg-muted">
                    <div className="h-full bg-primary/60" style={{ width: `${(n / maxW) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right font-mono text-2xs tabular text-muted-foreground">{n}</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel>
            <PanelHeader title="Top characters" />
            <div className="divide-y">
              {chars.map(([c, n]) => (
                <div key={c} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="w-28 shrink-0 font-mono text-xs">{c === ' ' ? '␣' : c}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-sm bg-muted">
                    <div className="h-full bg-primary/60" style={{ width: `${(n / maxC) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right font-mono text-2xs tabular text-muted-foreground">{n}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
