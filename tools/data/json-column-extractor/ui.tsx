'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

type Missing = 'null' | 'omit';

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function getByPath(value: unknown, path: string): unknown {
  let cur: unknown = value;
  for (const seg of path.split('.')) {
    if (seg === '') continue;
    if (isObject(cur)) cur = cur[seg];
    else if (Array.isArray(cur)) {
      const idx = Number(seg);
      cur = Number.isInteger(idx) ? cur[idx] : undefined;
    } else return undefined;
  }
  return cur;
}

function stableKey(v: unknown): string {
  return typeof v === 'object' ? JSON.stringify(v) : `${typeof v}:${String(v)}`;
}

export default function JsonColumnExtractorTool() {
  const [fields, setFields] = useState('name');
  const [unique, setUnique] = useState(false);
  const [missing, setMissing] = useState<Missing>('null');
  const [asColumns, setAsColumns] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let doc: unknown;
      try {
        doc = JSON.parse(input);
      } catch (e) {
        throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
      }
      if (!Array.isArray(doc)) throw new Error('Input must be a JSON array of objects.');

      const paths = fields
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (paths.length === 0) throw new Error('Provide at least one field path.');

      // Multiple fields, columns mode: parallel arrays keyed by path.
      if (paths.length > 1 && asColumns) {
        const columns: Record<string, unknown[]> = {};
        for (const p of paths) columns[p] = [];
        for (const el of doc) {
          for (const p of paths) {
            const v = getByPath(el, p);
            const col = columns[p];
            if (col) col.push(v === undefined ? null : v);
          }
        }
        return JSON.stringify(columns, null, 2);
      }

      // Single field: flat array of that field's values.
      if (paths.length === 1) {
        const p = paths[0] ?? '';
        const out: unknown[] = [];
        for (const el of doc) {
          const v = getByPath(el, p);
          if (v === undefined) {
            if (missing === 'omit') continue;
            out.push(null);
          } else {
            out.push(v);
          }
        }
        const final = unique
          ? out.filter((v, i, arr) => arr.findIndex((x) => stableKey(x) === stableKey(v)) === i)
          : out;
        return JSON.stringify(final, null, 2);
      }

      // Multiple fields: array of slimmed objects.
      const out: Record<string, unknown>[] = [];
      for (const el of doc) {
        const slim: Record<string, unknown> = {};
        for (const p of paths) {
          const v = getByPath(el, p);
          if (v === undefined) {
            if (missing === 'omit') continue;
            slim[p] = null;
          } else {
            slim[p] = v;
          }
        }
        out.push(slim);
      }
      return JSON.stringify(out, null, 2);
    },
    [fields, unique, missing, asColumns],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[fields, unique, missing, asColumns]}
      inputLabel="JSON array"
      outputLabel="Plucked"
      inputPlaceholder='[{"id":1,"name":"a","tag":"x"}]'
      sample={
        '[\n' +
        '  {"id": 1, "name": "Ada", "team": "core"},\n' +
        '  {"id": 2, "name": "Linus", "team": "core"},\n' +
        '  {"id": 3, "name": "Grace", "team": "ops"}\n' +
        ']'
      }
      downloadName="plucked.json"
      downloadMime="application/json"
      options={
        <>
          <Field
            label="Field path(s)"
            hint="Comma-separated dot paths, e.g. name, team"
            className="min-w-[240px] flex-1"
          >
            <Input
              value={fields}
              onChange={(e) => setFields(e.target.value)}
              placeholder="name, team"
              spellCheck={false}
              className="font-mono"
            />
          </Field>
          <Field label="Unique" hint="Single-field mode only">
            <Switch checked={unique} onCheckedChange={setUnique} />
          </Field>
          <Field label="Omit missing" hint="Off = use null">
            <Switch checked={missing === 'omit'} onCheckedChange={(c) => setMissing(c ? 'omit' : 'null')} />
          </Field>
          <Field label="Columns" hint="Parallel arrays (multi-field)">
            <Switch checked={asColumns} onCheckedChange={setAsColumns} />
          </Field>
        </>
      }
    />
  );
}
