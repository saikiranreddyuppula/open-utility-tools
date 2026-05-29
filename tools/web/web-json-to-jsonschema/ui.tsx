'use client';

import { useCallback, useMemo, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Switch } from '@/components/ui/switch';

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type Schema = { [key: string]: unknown };

const SAMPLE = JSON.stringify(
  {
    id: 42,
    name: 'Ada',
    active: true,
    score: 9.5,
    tags: ['admin', 'editor'],
    address: { city: 'London', zip: null },
    roles: [{ name: 'owner', level: 3 }],
  },
  null,
  2,
);

function typeOf(value: JsonValue): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'number';
  }
  return typeof value; // 'string' | 'boolean' | 'object'
}

/** Merge two inferred schemas describing items of the same array. */
function mergeSchemas(a: Schema | null, b: Schema): Schema {
  if (a === null) return b;

  const aType = a['type'];
  const bType = b['type'];

  // Both objects: merge property maps and intersect required lists.
  if (aType === 'object' && bType === 'object') {
    const aProps = (a['properties'] as Record<string, Schema>) ?? {};
    const bProps = (b['properties'] as Record<string, Schema>) ?? {};
    const props: Record<string, Schema> = {};
    const keys = new Set([...Object.keys(aProps), ...Object.keys(bProps)]);
    for (const key of keys) {
      const av = aProps[key];
      const bv = bProps[key];
      if (av && bv) props[key] = mergeSchemas(av, bv);
      else props[key] = (av ?? bv) as Schema;
    }
    const aReq = (a['required'] as string[]) ?? [];
    const bReq = (b['required'] as string[]) ?? [];
    const required = aReq.filter((k) => bReq.includes(k));
    const merged: Schema = { type: 'object', properties: props };
    if (required.length > 0) merged['required'] = required;
    return merged;
  }

  // Both arrays: merge their item schemas.
  if (aType === 'array' && bType === 'array') {
    const aItems = (a['items'] as Schema) ?? {};
    const bItems = (b['items'] as Schema) ?? {};
    return { type: 'array', items: mergeSchemas(aItems, bItems) };
  }

  if (aType === bType) return a;

  // Differing scalar types -> union via "type" array.
  const types = new Set<string>();
  const collect = (t: unknown) => {
    if (Array.isArray(t)) for (const x of t) types.add(String(x));
    else if (typeof t === 'string') types.add(t);
  };
  collect(aType);
  collect(bType);
  return { type: Array.from(types).sort() };
}

function infer(value: JsonValue): Schema {
  const t = typeOf(value);

  if (t === 'object') {
    const obj = value as { [key: string]: JsonValue };
    const properties: Record<string, Schema> = {};
    const required: string[] = [];
    for (const key of Object.keys(obj)) {
      const child = obj[key];
      properties[key] = infer(child as JsonValue);
      required.push(key);
    }
    const schema: Schema = { type: 'object', properties };
    if (required.length > 0) schema['required'] = required;
    return schema;
  }

  if (t === 'array') {
    const arr = value as JsonValue[];
    let items: Schema | null = null;
    for (const el of arr) {
      items = mergeSchemas(items, infer(el));
    }
    return { type: 'array', items: items ?? {} };
  }

  return { type: t };
}

export default function JsonToJsonSchemaTool() {
  const [includeId, setIncludeId] = useState(true);

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

      const root: Schema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
      };
      if (includeId) root['$id'] = 'https://example.com/schema.json';
      Object.assign(root, infer(parsed));
      return JSON.stringify(root, null, 2);
    },
    [includeId],
  );

  const options = useMemo(
    () => (
      <Field label="Include $id" hint="placeholder schema identifier">
        <Switch checked={includeId} onCheckedChange={setIncludeId} />
      </Field>
    ),
    [includeId],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[includeId]}
      inputLabel="JSON"
      outputLabel="JSON Schema (draft-07)"
      inputPlaceholder="Paste a JSON document…"
      sample={SAMPLE}
      downloadName="schema.json"
      downloadMime="application/json"
      options={options}
    />
  );
}
