'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SAMPLE = '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]';

type OutMode = 'nested' | 'labeled';

export default function JsonArrayChunkTool() {
  const [input, setInput] = useState('');
  const [size, setSize] = useState('3');
  const [mode, setMode] = useState<OutMode>('nested');

  const result = useMemo<{ output: string; error: string | null; chunks: number; elements: number }>(() => {
    if (!input.trim()) return { output: '', error: null, chunks: 0, elements: 0 };
    const n = Number(size);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
      return { output: '', error: 'Chunk size must be a positive integer.', chunks: 0, elements: 0 };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(input);
    } catch (e) {
      return { output: '', error: `Invalid JSON: ${(e as Error).message}`, chunks: 0, elements: 0 };
    }
    if (!Array.isArray(parsed)) {
      return { output: '', error: 'Input must be a JSON array.', chunks: 0, elements: 0 };
    }
    const arr: unknown[] = parsed;
    const chunks: unknown[][] = [];
    for (let i = 0; i < arr.length; i += n) {
      chunks.push(arr.slice(i, i + n));
    }
    let output: string;
    if (mode === 'nested') {
      output = JSON.stringify(chunks, null, 2);
    } else {
      output = chunks
        .map((c, i) => `// chunk ${i + 1} (${c.length} item${c.length === 1 ? '' : 's'})\n${JSON.stringify(c, null, 2)}`)
        .join('\n\n');
    }
    return { output, error: null, chunks: chunks.length, elements: arr.length };
  }, [input, size, mode]);

  return (
    <div className="flex flex-col gap-4">
      <OptionsBar>
        <Field label="Chunk size">
          <Input value={size} onChange={(e) => setSize(e.target.value)} inputMode="numeric" className="w-24" />
        </Field>
        <Field label="Output format">
          <Tabs value={mode} onValueChange={(v) => setMode(v as OutMode)}>
            <TabsList>
              <TabsTrigger value="nested">Array of arrays</TabsTrigger>
              <TabsTrigger value="labeled">Labeled chunks</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      </OptionsBar>

      <ErrorBanner error={result.error} />

      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <PanelHeader title="JSON Array">
            <Button variant="ghost" size="sm" onClick={() => setInput(SAMPLE)}>Load sample</Button>
          </PanelHeader>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="[1, 2, 3, ...]"
            spellCheck={false}
            className="min-h-[280px] font-mono text-sm"
          />
        </Panel>
        <Panel>
          <PanelHeader title="Chunks">
            <CopyButton value={result.output} />
          </PanelHeader>
          <Textarea
            value={result.output}
            readOnly
            placeholder="Result appears here..."
            spellCheck={false}
            className="min-h-[280px] font-mono text-sm"
          />
        </Panel>
      </div>

      <StatBar
        items={[
          result.elements > 0 ? `${result.elements} elements` : false,
          result.chunks > 0 ? `${result.chunks} chunks` : false,
        ]}
      />
    </div>
  );
}
