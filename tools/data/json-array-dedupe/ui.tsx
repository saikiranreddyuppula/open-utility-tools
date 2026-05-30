'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Keep = 'first' | 'last';

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Produce a canonical, comparison-stable JSON string for a value. */
function canonical(value: unknown, sortKeys: boolean, ciStrings: boolean): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(ciStrings ? value.toLowerCase() : value);
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map((v) => canonical(v, sortKeys, ciStrings)).join(',') + ']';
  }
  if (isObject(value)) {
    const keys = Object.keys(value);
    if (sortKeys) keys.sort();
    return (
      '{' +
      keys.map((k) => JSON.stringify(k) + ':' + canonical(value[k], sortKeys, ciStrings)).join(',') +
      '}'
    );
  }
  return JSON.stringify(value ?? null);
}

/** Resolve a dot path into an element (no bracket support; arrays via numeric segment). */
function getByPath(value: unknown, path: string): unknown {
  let cur: unknown = value;
  for (const seg of path.split('.')) {
    if (seg === '') continue;
    if (isObject(cur)) {
      cur = cur[seg];
    } else if (Array.isArray(cur)) {
      const idx = Number(seg);
      cur = Number.isInteger(idx) ? cur[idx] : undefined;
    } else {
      return undefined;
    }
  }
  return cur;
}

export default function JsonArrayDedupeTool() {
  const [keyPath, setKeyPath] = useState('');
  const [keep, setKeep] = useState<Keep>('first');
  const [ciStrings, setCiStrings] = useState(false);
  const [sortKeys, setSortKeys] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let doc: unknown;
      try {
        doc = JSON.parse(input);
      } catch (e) {
        throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
      }
      if (!Array.isArray(doc)) throw new Error('Input must be a JSON array.');

      const path = keyPath.trim();
      const seen = new Set<string>();
      const order: string[] = [];
      const picked = new Map<string, unknown>();

      for (const el of doc) {
        const target = path === '' ? el : getByPath(el, path);
        const sig =
          path === ''
            ? canonical(el, sortKeys, ciStrings)
            : canonical(target, sortKeys, ciStrings);

        if (!seen.has(sig)) {
          seen.add(sig);
          order.push(sig);
          picked.set(sig, el);
        } else if (keep === 'last') {
          picked.set(sig, el);
        }
      }

      const out = order.map((sig) => picked.get(sig));
      const removed = doc.length - out.length;
      const body = JSON.stringify(out, null, 2);
      return `// ${removed} duplicate${removed === 1 ? '' : 's'} removed (${doc.length} → ${out.length})\n${body}`;
    },
    [keyPath, keep, ciStrings, sortKeys],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[keyPath, keep, ciStrings, sortKeys]}
      inputLabel="JSON array"
      outputLabel="Deduplicated"
      inputPlaceholder='[{"id": 1}, {"id": 1}]'
      sample={
        '[\n' +
        '  {"id": 1, "name": "Ada"},\n' +
        '  {"id": 2, "name": "Linus"},\n' +
        '  {"id": 1, "name": "ADA"},\n' +
        '  {"id": 3, "name": "Grace"}\n' +
        ']'
      }
      downloadName="deduped.json"
      downloadMime="application/json"
      options={
        <>
          <Field
            label="Dedupe by key (optional)"
            hint="Dot path; empty = compare whole element"
            className="min-w-[220px]"
          >
            <Input
              value={keyPath}
              onChange={(e) => setKeyPath(e.target.value)}
              placeholder="e.g. id or user.email"
              spellCheck={false}
              className="font-mono"
            />
          </Field>
          <Field label="Keep">
            <Tabs value={keep} onValueChange={(v) => setKeep(v as Keep)}>
              <TabsList>
                <TabsTrigger value="first">First</TabsTrigger>
                <TabsTrigger value="last">Last</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Ignore string case">
            <Switch checked={ciStrings} onCheckedChange={setCiStrings} />
          </Field>
          <Field label="Ignore object key order">
            <Switch checked={sortKeys} onCheckedChange={setSortKeys} />
          </Field>
        </>
      }
    />
  );
}
