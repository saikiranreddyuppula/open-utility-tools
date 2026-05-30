'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SAMPLE = `{"id":1,"name":"Alice","city":"NYC"}
{"id":2,"name":"Bob","city":"LA"}
{"id":1,"name":"Alice","city":"NYC"}
{"id":3,"name":"Carol","city":"LA"}
{"id":2,"name":"Bob","city":"SF"}`;

type Mode = 'full' | 'keys';

// Canonical JSON: recursively sort object keys so semantically equal objects
// produce an identical signature regardless of original key order.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) {
      out[k] = canonical(obj[k]);
    }
    return out;
  }
  return value;
}

export default function JsonlDeduplicateTool() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<Mode>('full');
  const [keys, setKeys] = useState('');

  const result = useMemo<{ output: string; error: string | null; kept: number; removed: number }>(() => {
    if (!input.trim()) return { output: '', error: null, kept: 0, removed: 0 };

    const lines = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const records: Array<{ raw: string; obj: Record<string, unknown> }> = [];
    let lineNo = 0;
    for (const line of lines) {
      lineNo++;
      const trimmed = line.trim();
      if (trimmed === '') continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        return { output: '', error: `Invalid JSON on line ${lineNo}.`, kept: 0, removed: 0 };
      }
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { output: '', error: `Line ${lineNo} is not a JSON object.`, kept: 0, removed: 0 };
      }
      records.push({ raw: trimmed, obj: parsed as Record<string, unknown> });
    }

    let keyFields: string[] | null = null;
    if (mode === 'keys') {
      keyFields = keys.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
      if (keyFields.length === 0) {
        return { output: '', error: 'Enter at least one key field.', kept: 0, removed: 0 };
      }
    }

    const seen = new Set<string>();
    const unique: string[] = [];
    let removed = 0;
    for (const rec of records) {
      let sig: string;
      if (keyFields) {
        const sub: Record<string, unknown> = {};
        for (const f of keyFields) sub[f] = rec.obj[f];
        sig = JSON.stringify(canonical(sub));
      } else {
        sig = JSON.stringify(canonical(rec.obj));
      }
      if (seen.has(sig)) {
        removed++;
        continue;
      }
      seen.add(sig);
      unique.push(rec.raw);
    }

    return { output: unique.join('\n'), error: null, kept: unique.length, removed };
  }, [input, mode, keys]);

  return (
    <div className="flex flex-col gap-4">
      <OptionsBar>
        <Field label="Dedupe on" hint="Whole record or selected key fields">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="full">Whole record</TabsTrigger>
              <TabsTrigger value="keys">Key fields</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        {mode === 'keys' && (
          <Field label="Key fields" hint="Comma-separated top-level field names" className="flex-1">
            <Input value={keys} onChange={(e) => setKeys(e.target.value)} placeholder="id, name" />
          </Field>
        )}
      </OptionsBar>

      <ErrorBanner error={result.error} />

      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <PanelHeader title="JSONL Input">
            <Button variant="ghost" size="sm" onClick={() => setInput(SAMPLE)}>Load sample</Button>
          </PanelHeader>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='{"id":1,...}\n{"id":2,...}'
            spellCheck={false}
            className="min-h-[280px] font-mono text-sm"
          />
        </Panel>
        <Panel>
          <PanelHeader title="Deduplicated JSONL">
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
          result.output ? `${result.kept} unique records` : false,
          result.removed > 0 && `${result.removed} duplicate${result.removed === 1 ? '' : 's'} removed`,
        ]}
      />
    </div>
  );
}
