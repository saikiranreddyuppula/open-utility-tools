'use client';

import { useCallback, useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

type PropMode = 'required' | 'all';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

interface Opts {
  propMode: PropMode;
  arrayFill: number;
  useExamples: boolean;
}

function resolveRef(ref: string, root: Record<string, unknown>): Record<string, unknown> {
  if (!ref.startsWith('#/')) {
    throw new Error(`Only local "#/..." $ref is supported (got "${ref}").`);
  }
  const tokens = ref
    .slice(2)
    .split('/')
    .map((t) => t.replace(/~1/g, '/').replace(/~0/g, '~'));
  let node: unknown = root;
  for (const token of tokens) {
    if (!isPlainObject(node) || !(token in node)) {
      throw new Error(`Cannot resolve $ref "${ref}".`);
    }
    node = node[token];
  }
  if (!isPlainObject(node)) {
    throw new Error(`$ref "${ref}" did not resolve to a schema object.`);
  }
  return node;
}

function placeholderForString(schema: Record<string, unknown>): string {
  const fmt = typeof schema.format === 'string' ? schema.format : '';
  switch (fmt) {
    case 'email':
      return 'user@example.com';
    case 'date':
      return '2024-01-01';
    case 'date-time':
      return '2024-01-01T00:00:00Z';
    case 'time':
      return '00:00:00';
    case 'uri':
    case 'url':
      return 'https://example.com';
    case 'uuid':
      return '00000000-0000-4000-8000-000000000000';
    case 'hostname':
      return 'example.com';
    case 'ipv4':
      return '192.0.2.1';
    case 'ipv6':
      return '2001:db8::1';
    default: {
      const min = typeof schema.minLength === 'number' ? schema.minLength : 0;
      const base = 'string';
      return base.length >= min ? base : base.padEnd(min, 'x');
    }
  }
}

function sampleFor(
  schema: unknown,
  root: Record<string, unknown>,
  opts: Opts,
  depth: number,
): unknown {
  if (depth > 40) return null;
  if (typeof schema === 'boolean') return schema ? {} : null;
  if (!isPlainObject(schema)) return null;

  if (typeof schema.$ref === 'string') {
    return sampleFor(resolveRef(schema.$ref, root), root, opts, depth + 1);
  }

  // Explicit fixed values take precedence.
  if ('const' in schema) return schema.const;
  if ('default' in schema) return schema.default;
  if (opts.useExamples && Array.isArray(schema.examples) && schema.examples.length > 0) {
    return schema.examples[0];
  }
  if ('example' in schema) return schema.example;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];

  // Composition keywords: take the first usable subschema.
  for (const key of ['allOf', 'anyOf', 'oneOf'] as const) {
    const branch = schema[key];
    if (Array.isArray(branch) && branch.length > 0) {
      if (key === 'allOf') {
        const merged: unknown[] = [];
        for (const sub of branch) merged.push(sampleFor(sub, root, opts, depth + 1));
        // For allOf, prefer the object-merge if all parts are objects.
        const objs = merged.filter(isPlainObject);
        if (objs.length === merged.length && objs.length > 0) {
          return Object.assign({}, ...objs);
        }
        return merged[0] ?? null;
      }
      return sampleFor(branch[0], root, opts, depth + 1);
    }
  }

  const type = Array.isArray(schema.type)
    ? (schema.type.find((t) => typeof t === 'string') as string | undefined)
    : typeof schema.type === 'string'
      ? schema.type
      : undefined;

  const effectiveType =
    type ?? (isPlainObject(schema.properties) ? 'object' : schema.items != null ? 'array' : 'string');

  switch (effectiveType) {
    case 'object': {
      const props = isPlainObject(schema.properties) ? schema.properties : {};
      const required = Array.isArray(schema.required)
        ? schema.required.filter((r): r is string => typeof r === 'string')
        : [];
      const out: Record<string, unknown> = {};
      const keys = opts.propMode === 'all' ? Object.keys(props) : required;
      for (const key of keys) {
        const propSchema = props[key];
        if (propSchema === undefined) {
          // Required key without a defined schema: emit null.
          out[key] = null;
        } else {
          out[key] = sampleFor(propSchema, root, opts, depth + 1);
        }
      }
      return out;
    }
    case 'array': {
      const itemSchema = isPlainObject(schema.items) || typeof schema.items === 'boolean' ? schema.items : {};
      const minItems = typeof schema.minItems === 'number' ? schema.minItems : 0;
      const count = Math.max(minItems, opts.arrayFill);
      const arr: unknown[] = [];
      for (let i = 0; i < count; i++) {
        arr.push(sampleFor(itemSchema, root, opts, depth + 1));
      }
      return arr;
    }
    case 'string':
      return placeholderForString(schema);
    case 'integer': {
      if (typeof schema.minimum === 'number') return Math.ceil(schema.minimum);
      if (typeof schema.exclusiveMinimum === 'number') return Math.floor(schema.exclusiveMinimum) + 1;
      return 0;
    }
    case 'number': {
      if (typeof schema.minimum === 'number') return schema.minimum;
      if (typeof schema.exclusiveMinimum === 'number') return schema.exclusiveMinimum + 1;
      return 0;
    }
    case 'boolean':
      return true;
    case 'null':
      return null;
    default:
      return null;
  }
}

const SAMPLE = JSON.stringify(
  {
    type: 'object',
    required: ['id', 'name', 'email'],
    properties: {
      id: { type: 'integer', minimum: 1 },
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      role: { type: 'string', enum: ['admin', 'user'] },
      active: { type: 'boolean', default: true },
      tags: { type: 'array', items: { type: 'string' }, minItems: 2 },
      profile: { $ref: '#/definitions/Profile' },
    },
    definitions: {
      Profile: {
        type: 'object',
        required: ['bio'],
        properties: { bio: { type: 'string' }, since: { type: 'string', format: 'date' } },
      },
    },
  },
  null,
  2,
);

export default function JsonSchemaSampleGeneratorTool() {
  const [propMode, setPropMode] = useState<PropMode>('all');
  const [arrayFill, setArrayFill] = useState('1');
  const [useExamples, setUseExamples] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let schema: unknown;
      try {
        schema = JSON.parse(input);
      } catch (e) {
        throw new Error(`Invalid JSON Schema: ${e instanceof Error ? e.message : String(e)}`);
      }
      if (!isPlainObject(schema) && typeof schema !== 'boolean') {
        throw new Error('Schema must be a JSON object (or boolean).');
      }
      const fillNum = Number(arrayFill);
      const fill = Number.isFinite(fillNum) && fillNum >= 0 ? Math.min(50, Math.floor(fillNum)) : 1;
      const root = isPlainObject(schema) ? schema : {};
      const result = sampleFor(schema, root, { propMode, arrayFill: fill, useExamples }, 0);
      return JSON.stringify(result, null, 2);
    },
    [propMode, arrayFill, useExamples],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[propMode, arrayFill, useExamples]}
      inputLabel="JSON Schema (draft-07)"
      outputLabel="Sample instance"
      sample={SAMPLE}
      downloadName="sample.json"
      downloadMime="application/json"
      options={
        <>
          <Field label="Properties" hint="Include only required props, or every property.">
            <Tabs value={propMode} onValueChange={(v) => setPropMode(v as PropMode)}>
              <TabsList>
                <TabsTrigger value="required">Required only</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Array fill">
            <Input
              value={arrayFill}
              onChange={(e) => setArrayFill(e.target.value)}
              inputMode="numeric"
              className="w-20"
            />
          </Field>
          <Field label="Use examples">
            <Switch checked={useExamples} onCheckedChange={setUseExamples} />
          </Field>
        </>
      }
    />
  );
}
