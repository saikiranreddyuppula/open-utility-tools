'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type ArrayStrategy = 'replace' | 'concat';

const SAMPLE_A = `{
  "name": "app",
  "version": "1.0.0",
  "settings": { "theme": "light", "fontSize": 12 },
  "tags": ["a", "b"]
}`;

const SAMPLE_B = `{
  "version": "1.1.0",
  "settings": { "theme": "dark", "compact": true },
  "tags": ["c"]
}`;

function isPlainObject(v: Json): v is { [key: string]: Json } {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function deepMerge(a: Json, b: Json, arrays: ArrayStrategy): Json {
  if (isPlainObject(a) && isPlainObject(b)) {
    const out: { [key: string]: Json } = { ...a };
    for (const key of Object.keys(b)) {
      const bv = b[key];
      if (bv === undefined) continue;
      if (key in out) {
        const av = out[key];
        out[key] = av === undefined ? bv : deepMerge(av, bv, arrays);
      } else {
        out[key] = bv;
      }
    }
    return out;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return arrays === 'concat' ? [...a, ...b] : b;
  }
  // Scalars or type mismatch: second value wins.
  return b;
}

export default function JsonMergeTool() {
  const [inputA, setInputA] = useState('');
  const [inputB, setInputB] = useState('');
  const [arrays, setArrays] = useState<ArrayStrategy>('replace');

  const result = useMemo<{ output: string; error: string | null }>(() => {
    if (!inputA.trim() && !inputB.trim()) return { output: '', error: null };
    if (!inputA.trim()) return { output: '', error: 'Enter the first JSON object.' };
    if (!inputB.trim()) return { output: '', error: 'Enter the second JSON object.' };

    let a: Json;
    let b: Json;
    try {
      a = JSON.parse(inputA) as Json;
    } catch (e) {
      return { output: '', error: `First JSON is invalid: ${(e as Error).message}` };
    }
    try {
      b = JSON.parse(inputB) as Json;
    } catch (e) {
      return { output: '', error: `Second JSON is invalid: ${(e as Error).message}` };
    }

    const merged = deepMerge(a, b, arrays);
    return { output: JSON.stringify(merged, null, 2), error: null };
  }, [inputA, inputB, arrays]);

  return (
    <div className="flex flex-col gap-4">
      <OptionsBar>
        <Field
          label="Array conflicts"
          hint="When both sides have an array at the same key"
        >
          <Tabs value={arrays} onValueChange={(v) => setArrays(v as ArrayStrategy)}>
            <TabsList>
              <TabsTrigger value="replace">Replace (B wins)</TabsTrigger>
              <TabsTrigger value="concat">Concatenate</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      </OptionsBar>

      <ErrorBanner error={result.error} />

      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <PanelHeader title="JSON A (base)">
            <Button variant="ghost" size="sm" onClick={() => setInputA(SAMPLE_A)}>
              Load sample
            </Button>
          </PanelHeader>
          <Textarea
            value={inputA}
            onChange={(e) => setInputA(e.target.value)}
            placeholder="Paste the base JSON object..."
            className="min-h-[200px] font-mono text-sm"
          />
        </Panel>

        <Panel>
          <PanelHeader title="JSON B (overrides A)">
            <Button variant="ghost" size="sm" onClick={() => setInputB(SAMPLE_B)}>
              Load sample
            </Button>
          </PanelHeader>
          <Textarea
            value={inputB}
            onChange={(e) => setInputB(e.target.value)}
            placeholder="Paste the JSON object to merge in..."
            className="min-h-[200px] font-mono text-sm"
          />
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Merged JSON">
          <CopyButton value={result.output} />
        </PanelHeader>
        <Textarea
          value={result.output}
          readOnly
          placeholder="Result appears here..."
          className="min-h-[220px] font-mono text-sm"
        />
      </Panel>

      <StatBar items={[result.output && `${result.output.length} characters`]} />
    </div>
  );
}
