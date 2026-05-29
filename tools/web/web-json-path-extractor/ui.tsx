'use client';

import { useCallback, useMemo, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const SAMPLE = JSON.stringify(
  {
    data: {
      items: [
        { name: 'Ada', tags: ['admin'] },
        { name: 'Linus', tags: ['kernel', 'git'] },
      ],
      count: 2,
    },
  },
  null,
  2,
);

type Segment =
  | { kind: 'key'; value: string }
  | { kind: 'index'; value: number }
  | { kind: 'wildcard' };

/** Parse "data.items[0].name" / "items[*].name" into segments. */
function parsePath(path: string): Segment[] {
  const segments: Segment[] = [];
  let i = 0;
  const trimmed = path.trim().replace(/^\$\.?/, ''); // allow leading $ or $.

  const len = trimmed.length;
  while (i < len) {
    const ch = trimmed[i];
    if (ch === '.') {
      i += 1;
      continue;
    }
    if (ch === '[') {
      const close = trimmed.indexOf(']', i);
      if (close === -1) throw new Error('Unclosed "[" in path.');
      const inner = trimmed.slice(i + 1, close).trim();
      i = close + 1;
      if (inner === '*') {
        segments.push({ kind: 'wildcard' });
      } else if (/^-?\d+$/.test(inner)) {
        segments.push({ kind: 'index', value: Number(inner) });
      } else {
        // Bracketed quoted key, e.g. ['some.key']
        const key = inner.replace(/^['"]|['"]$/g, '');
        segments.push({ kind: 'key', value: key });
      }
      continue;
    }
    if (ch === '*') {
      segments.push({ kind: 'wildcard' });
      i += 1;
      continue;
    }
    // Read a bare key up to the next delimiter.
    let key = '';
    while (i < len) {
      const c = trimmed[i];
      if (c === '.' || c === '[' || c === undefined) break;
      key += c;
      i += 1;
    }
    if (key.length > 0) segments.push({ kind: 'key', value: key });
  }
  return segments;
}

function applySegment(current: JsonValue[], seg: Segment): JsonValue[] {
  const out: JsonValue[] = [];
  for (const node of current) {
    if (seg.kind === 'key') {
      if (node !== null && typeof node === 'object' && !Array.isArray(node)) {
        if (Object.prototype.hasOwnProperty.call(node, seg.value)) {
          out.push((node as { [key: string]: JsonValue })[seg.value] as JsonValue);
        }
      }
    } else if (seg.kind === 'index') {
      if (Array.isArray(node)) {
        const idx = seg.value < 0 ? node.length + seg.value : seg.value;
        const v = node[idx];
        if (v !== undefined) out.push(v);
      }
    } else {
      // wildcard
      if (Array.isArray(node)) {
        for (const v of node) out.push(v);
      } else if (node !== null && typeof node === 'object') {
        const obj = node as { [key: string]: JsonValue };
        for (const k of Object.keys(obj)) {
          const v = obj[k];
          if (v !== undefined) out.push(v);
        }
      }
    }
  }
  return out;
}

export default function JsonPathExtractorTool() {
  const [path, setPath] = useState('data.items[*].name');
  const [wrapArray, setWrapArray] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';

      let parsed: JsonValue;
      try {
        parsed = JSON.parse(input) as JsonValue;
      } catch (err) {
        throw new Error(
          `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      const segments = parsePath(path);
      let current: JsonValue[] = [parsed];
      for (const seg of segments) {
        current = applySegment(current, seg);
      }

      if (current.length === 0) {
        throw new Error('No matches for that path.');
      }

      // A single non-wildcard match returns the bare value; multiple matches
      // (or wrap enabled) return a JSON array.
      const hasWildcard = segments.some((s) => s.kind === 'wildcard');
      if (current.length === 1 && !hasWildcard && !wrapArray) {
        return JSON.stringify(current[0] ?? null, null, 2);
      }
      return JSON.stringify(current, null, 2);
    },
    [path, wrapArray],
  );

  const options = useMemo(
    () => (
      <div className="flex flex-wrap items-end gap-4">
        <Field
          label="Path"
          hint="e.g. data.items[0].name or items[*].name"
          className="min-w-[260px] flex-1"
        >
          <Input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="data.items[*].name"
            className="font-mono"
          />
        </Field>
        <Field label="Always wrap in array">
          <Switch checked={wrapArray} onCheckedChange={setWrapArray} />
        </Field>
      </div>
    ),
    [path, wrapArray],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[path, wrapArray]}
      inputLabel="JSON"
      outputLabel="Matches"
      inputPlaceholder="Paste a JSON document…"
      sample={SAMPLE}
      downloadName="matches.json"
      downloadMime="application/json"
      options={options}
    />
  );
}
