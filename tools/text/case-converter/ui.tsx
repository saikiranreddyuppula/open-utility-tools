'use client';

import { useState } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { cases, CASE_LABELS, type CaseName } from '@/lib/text/case';

const ORDER: CaseName[] = [
  'lower',
  'upper',
  'title',
  'sentence',
  'camel',
  'pascal',
  'snake',
  'constant',
  'kebab',
  'train',
  'dot',
  'path',
];

const SAMPLE = 'the quick brown_fox JumpsOver-the lazyDog';

export default function CaseConverterTool() {
  const [input, setInput] = useState('');

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <PanelHeader title="Input">
          <button
            className="rounded px-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setInput(SAMPLE)}
          >
            Sample
          </button>
          <button
            className="rounded px-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setInput('')}
          >
            Clear
          </button>
        </PanelHeader>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type or paste text…"
          spellCheck={false}
          className="min-h-24 resize-y rounded-none border-0 bg-transparent font-mono shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <StatBar items={[`${input.length.toLocaleString()} chars`]} />
      </Panel>

      <Panel>
        <PanelHeader title="Cases" />
        <div className="divide-y">
          {ORDER.map((name) => {
            const value = input ? cases[name](input) : '';
            return (
              <div key={name} className="flex items-center gap-3 px-3 py-2">
                <span className="w-32 shrink-0 font-mono text-2xs font-medium text-muted-foreground">
                  {CASE_LABELS[name]}
                </span>
                <code className="min-w-0 flex-1 truncate font-mono text-xs">
                  {value || <span className="text-muted-foreground">—</span>}
                </code>
                <CopyButton value={value} size="icon-sm" disabled={!value} />
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
