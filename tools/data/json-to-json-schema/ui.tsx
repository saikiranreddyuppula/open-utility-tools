'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { TextToolLayout } from '@/components/tools/text-tool';

type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  [key: string]: unknown;
};

const SAMPLE = JSON.stringify(
  {
    id: 42,
    name: 'Widget',
    inStock: true,
    price: 9.99,
    tags: ['new', 'featured'],
    dimensions: { width: 10, height: 20 },
  },
  null,
  2,
);

function jsonType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function mergeSchemas(a: JsonSchema, b: JsonSchema): JsonSchema {
  // Used to combine schemas of array elements. Falls back to a permissive
  // schema when element shapes diverge.
  if (JSON.stringify(a) === JSON.stringify(b)) return a;
  const ta = a.type;
  const tb = b.type;
  // integer + number -> number
  if ((ta === 'integer' && tb === 'number') || (ta === 'number' && tb === 'integer')) {
    return { type: 'number' };
  }
  if (ta === 'object' && tb === 'object') {
    const props: Record<string, JsonSchema> = {};
    const aProps = a.properties ?? {};
    const bProps = b.properties ?? {};
    const keys = new Set([...Object.keys(aProps), ...Object.keys(bProps)]);
    for (const k of keys) {
      const av = aProps[k];
      const bv = bProps[k];
      if (av && bv) props[k] = mergeSchemas(av, bv);
      else props[k] = (av ?? bv) as JsonSchema;
    }
    const aReq = a.required ?? [];
    const bReq = b.required ?? [];
    const required = aReq.filter((k) => bReq.includes(k));
    const merged: JsonSchema = { type: 'object', properties: props };
    if (required.length > 0) merged.required = required.sort();
    return merged;
  }
  if (ta === 'array' && tb === 'array' && a.items && b.items) {
    return { type: 'array', items: mergeSchemas(a.items, b.items) };
  }
  if (ta && tb && ta !== tb) {
    const flat = new Set<string>();
    for (const t of [ta, tb]) {
      if (Array.isArray(t)) for (const x of t) flat.add(x);
      else flat.add(t);
    }
    return { type: [...flat].sort() };
  }
  return a;
}

function infer(value: unknown, includeRequired: boolean): JsonSchema {
  const t = jsonType(value);
  if (t === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    const properties: Record<string, JsonSchema> = {};
    for (const k of keys) {
      properties[k] = infer(obj[k], includeRequired);
    }
    const schema: JsonSchema = { type: 'object', properties };
    if (includeRequired && keys.length > 0) schema.required = [...keys].sort();
    return schema;
  }
  if (t === 'array') {
    const arr = value as unknown[];
    if (arr.length === 0) return { type: 'array', items: {} };
    let itemSchema = infer(arr[0], includeRequired);
    for (let i = 1; i < arr.length; i++) {
      itemSchema = mergeSchemas(itemSchema, infer(arr[i], includeRequired));
    }
    return { type: 'array', items: itemSchema };
  }
  return { type: t };
}

export default function JsonToJsonSchemaTool() {
  const [includeRequired, setIncludeRequired] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (input.trim() === '') return '';
      let parsed: unknown;
      try {
        parsed = JSON.parse(input);
      } catch (e) {
        throw new Error(`Invalid JSON: ${(e as Error).message}`);
      }
      const schema: JsonSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        ...infer(parsed, includeRequired),
      };
      return JSON.stringify(schema, null, 2);
    },
    [includeRequired],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[includeRequired]}
      inputLabel="Sample JSON"
      outputLabel="JSON Schema (draft-07)"
      inputPlaceholder='{ "id": 1, "name": "example" }'
      sample={SAMPLE}
      downloadName="schema.json"
      downloadMime="application/json"
      options={
        <Field label="Required fields" hint="Mark all present keys as required">
          <Switch checked={includeRequired} onCheckedChange={setIncludeRequired} />
        </Field>
      }
    />
  );
}
