'use client';

import { useCallback, useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const SAMPLE = `{
  "id": 1,
  "title": "Hello World",
  "rating": 4.5,
  "published": true,
  "summary": null,
  "tags": ["news", "tech"],
  "author": { "id": 7, "name": "Ada" }
}`;

function isPlainObject(v: Json): v is { [key: string]: Json } {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pascalCase(key: string): string {
  const parts = key.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (parts.length === 0) return 'Type';
  const out = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  return /^[0-9]/.test(out) ? `T${out}` : out;
}

interface Options {
  allNullable: boolean;
  rootName: string;
}

interface TypeDef {
  name: string;
  fields: { key: string; type: string }[];
}

function scalarName(v: Json): string {
  switch (typeof v) {
    case 'string':
      return 'String';
    case 'boolean':
      return 'Boolean';
    case 'number':
      return Number.isInteger(v) ? 'Int' : 'Float';
    default:
      return 'String';
  }
}

function isIdKey(key: string): boolean {
  return key === 'id' || key === '_id' || /(^|_)id$/i.test(key);
}

function build(
  obj: { [key: string]: Json },
  typeName: string,
  defs: TypeDef[],
  seen: Set<string>,
  opt: Options
): void {
  if (seen.has(typeName)) return;
  seen.add(typeName);
  const fields: { key: string; type: string }[] = [];

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value === undefined) continue;
    const present = value !== null;
    // non-null marker for present values unless allNullable is set
    const bang = !opt.allNullable && present ? '!' : '';

    if (value === null) {
      fields.push({ key, type: 'String' });
      continue;
    }

    if (isPlainObject(value)) {
      const nested = pascalCase(key);
      build(value, nested, defs, seen, opt);
      fields.push({ key, type: `${nested}${bang}` });
      continue;
    }

    if (Array.isArray(value)) {
      const first = value[0];
      let elem: string;
      if (first === undefined) {
        elem = 'String';
      } else if (isPlainObject(first)) {
        const nested = pascalCase(key.replace(/s$/, '') || key);
        build(first, nested, defs, seen, opt);
        elem = nested;
      } else {
        elem = scalarName(first);
      }
      const elemBang = opt.allNullable ? '' : '!';
      const listBang = opt.allNullable ? '' : '!';
      fields.push({ key, type: `[${elem}${elemBang}]${listBang}` });
      continue;
    }

    const base = isIdKey(key) ? 'ID' : scalarName(value);
    fields.push({ key, type: `${base}${bang}` });
  }

  defs.push({ name: typeName, fields });
}

function emit(def: TypeDef): string {
  const lines: string[] = [`type ${def.name} {`];
  for (const f of def.fields) {
    lines.push(`  ${f.key}: ${f.type}`);
  }
  lines.push('}');
  return lines.join('\n');
}

function generate(data: Json, opt: Options): string {
  const root = pascalCase(opt.rootName.trim() || 'Root');
  let obj: { [key: string]: Json };
  if (isPlainObject(data)) {
    obj = data;
  } else if (Array.isArray(data) && data[0] !== undefined && isPlainObject(data[0])) {
    obj = data[0];
  } else {
    throw new Error('Top-level JSON must be an object (or array of objects) to generate GraphQL types.');
  }
  const defs: TypeDef[] = [];
  build(obj, root, defs, new Set<string>(), opt);
  return defs.map(emit).join('\n\n') + '\n';
}

export default function JsonToGraphqlSdlTool() {
  const [allNullable, setAllNullable] = useState(false);
  const [rootName, setRootName] = useState('Root');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let parsed: Json;
      try {
        parsed = JSON.parse(input) as Json;
      } catch (e) {
        throw new Error(`Invalid JSON: ${(e as Error).message}`);
      }
      return generate(parsed, { allNullable, rootName });
    },
    [allNullable, rootName]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[allNullable, rootName]}
      inputLabel="JSON"
      outputLabel="GraphQL SDL"
      inputPlaceholder="Paste a JSON object..."
      sample={SAMPLE}
      downloadName="schema.graphql"
      downloadMime="text/plain"
      options={
        <>
          <Field label="Root type name" className="max-w-[180px]">
            <Input
              value={rootName}
              onChange={(e) => setRootName(e.target.value)}
              placeholder="Root"
              className="h-8 font-mono"
            />
          </Field>
          <Field label="All fields nullable">
            <Switch checked={allNullable} onCheckedChange={setAllNullable} />
          </Field>
        </>
      }
    />
  );
}
