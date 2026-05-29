'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';

export interface GeneratorListProps {
  /** Produce one item. Called `count` times per regeneration. */
  generate: () => string;
  /** Extra deps that should trigger regeneration. */
  deps?: unknown[];
  defaultCount?: number;
  maxCount?: number;
  options?: React.ReactNode;
  downloadName?: string;
  label?: string;
}

/** Generic "generate N values" UI: count control, regenerate, copy-all, download. */
export function GeneratorList({
  generate,
  deps = [],
  defaultCount = 5,
  maxCount = 1000,
  options,
  downloadName = 'generated.txt',
  label = 'Output',
}: GeneratorListProps) {
  const [count, setCount] = useState(defaultCount);
  const [items, setItems] = useState<string[]>([]);

  const regen = useCallback(() => {
    const n = Math.max(1, Math.min(count, maxCount));
    setItems(Array.from({ length: n }, () => generate()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, maxCount, generate, ...deps]);

  useEffect(() => {
    regen();
  }, [regen]);

  const text = items.join('\n');

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Count">
          <Input
            type="number"
            min={1}
            max={maxCount}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(Number(e.target.value) || 1, maxCount)))}
            className="w-24 font-mono"
          />
        </Field>
        {options}
        <div className="ml-auto flex items-end">
          <Button variant="secondary" size="sm" onClick={regen}>
            <RefreshCw className="size-3.5" />
            Regenerate
          </Button>
        </div>
      </OptionsBar>

      <Panel>
        <PanelHeader title={label}>
          <CopyButton value={() => text} label="Copy all" disabled={!text} />
          <DownloadButton data={() => text} filename={downloadName} disabled={!text} />
        </PanelHeader>
        <div className="max-h-[420px] divide-y overflow-auto">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-1.5">
              <span className="w-8 shrink-0 text-right font-mono text-2xs text-muted-foreground tabular">
                {i + 1}
              </span>
              <code className="min-w-0 flex-1 truncate font-mono text-xs">{item}</code>
              <CopyButton value={item} size="icon-sm" />
            </div>
          ))}
        </div>
        <StatBar items={[`${items.length.toLocaleString()} generated`]} />
      </Panel>
    </div>
  );
}
