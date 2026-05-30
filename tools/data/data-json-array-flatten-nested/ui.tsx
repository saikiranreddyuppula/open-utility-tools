'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

const SAMPLE = '[1, [2, 3, [4, 5]], [[6], 7], null, [8, [9, [10]]]]';

function flatten(arr: unknown[], depth: number): unknown[] {
  const out: unknown[] = [];
  for (const item of arr) {
    if (Array.isArray(item) && depth > 0) {
      const inner = flatten(item, depth - 1);
      for (const x of inner) out.push(x);
    } else {
      out.push(item);
    }
  }
  return out;
}

function isEmptyEntry(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'string') return v === '';
  return false;
}

export default function JsonArrayFlattenNestedTool() {
  const [input, setInput] = useState('');
  const [fullDepth, setFullDepth] = useState(true);
  const [depth, setDepth] = useState('1');
  const [indent, setIndent] = useState('2');
  const [dropEmpty, setDropEmpty] = useState(false);

  const result = useMemo<{ output: string; error: string | null; before: number; after: number }>(() => {
    if (!input.trim()) return { output: '', error: null, before: 0, after: 0 };
    let parsed: unknown;
    try {
      parsed = JSON.parse(input);
    } catch (e) {
      return { output: '', error: `Invalid JSON: ${(e as Error).message}`, before: 0, after: 0 };
    }
    if (!Array.isArray(parsed)) {
      return { output: '', error: 'Input must be a JSON array.', before: 0, after: 0 };
    }
    let d = Infinity;
    if (!fullDepth) {
      const dn = Number(depth);
      if (!Number.isFinite(dn) || !Number.isInteger(dn) || dn < 1) {
        return { output: '', error: 'Depth must be a positive integer.', before: 0, after: 0 };
      }
      d = dn;
    }
    const indN = Number(indent);
    if (!Number.isFinite(indN) || !Number.isInteger(indN) || indN < 0 || indN > 8) {
      return { output: '', error: 'Indent must be an integer from 0 to 8.', before: 0, after: 0 };
    }

    let flat = flatten(parsed, d);
    if (dropEmpty) flat = flat.filter((v) => !isEmptyEntry(v));

    return {
      output: JSON.stringify(flat, null, indN),
      error: null,
      before: parsed.length,
      after: flat.length,
    };
  }, [input, fullDepth, depth, indent, dropEmpty]);

  return (
    <div className="flex flex-col gap-4">
      <OptionsBar>
        <Field label="Flatten fully">
          <Switch checked={fullDepth} onCheckedChange={setFullDepth} />
        </Field>
        {!fullDepth && (
          <Field label="Depth">
            <Input value={depth} onChange={(e) => setDepth(e.target.value)} inputMode="numeric" className="w-20" />
          </Field>
        )}
        <Field label="Indent">
          <Input value={indent} onChange={(e) => setIndent(e.target.value)} inputMode="numeric" className="w-20" />
        </Field>
        <Field label="Drop null/empty">
          <Switch checked={dropEmpty} onCheckedChange={setDropEmpty} />
        </Field>
      </OptionsBar>

      <ErrorBanner error={result.error} />

      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <PanelHeader title="Nested Array">
            <Button variant="ghost" size="sm" onClick={() => setInput(SAMPLE)}>Load sample</Button>
          </PanelHeader>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="[1, [2, [3]], ...]"
            spellCheck={false}
            className="min-h-[280px] font-mono text-sm"
          />
        </Panel>
        <Panel>
          <PanelHeader title="Flattened Array">
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
          result.output ? `${result.before} → ${result.after} top-level items` : false,
        ]}
      />
    </div>
  );
}
