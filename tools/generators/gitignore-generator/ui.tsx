'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { GITIGNORE_TEMPLATES } from '@/lib/generators/gitignore';
import { cn } from '@/lib/utils';

export default function GitignoreGeneratorTool() {
  const names = Object.keys(GITIGNORE_TEMPLATES);
  const [selected, setSelected] = useState<string[]>(['Node', 'macOS']);

  const output = useMemo(
    () =>
      selected
        .map((n) => `# ${'='.repeat(8)} ${n} ${'='.repeat(8)}\n${GITIGNORE_TEMPLATES[n]}`)
        .join('\n\n') + (selected.length ? '\n' : ''),
    [selected]
  );

  const toggle = (n: string) =>
    setSelected((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {names.map((n) => (
          <button
            key={n}
            onClick={() => toggle(n)}
            className={cn(
              'inline-flex h-7 items-center rounded-md border px-2.5 text-xs transition-colors',
              selected.includes(n)
                ? 'border-primary/40 bg-primary/10 text-foreground'
                : 'border-border text-muted-foreground hover:bg-accent/60 hover:text-foreground'
            )}
          >
            {n}
          </button>
        ))}
      </div>

      <Panel>
        <PanelHeader title=".gitignore">
          <CopyButton value={() => output} disabled={!output} />
          <DownloadButton data={() => output} filename=".gitignore" disabled={!output} />
        </PanelHeader>
        <pre className="min-h-48 overflow-auto p-3 font-mono text-xs whitespace-pre-wrap">
          {output || <span className="text-muted-foreground">Select one or more templates…</span>}
        </pre>
      </Panel>
    </div>
  );
}
