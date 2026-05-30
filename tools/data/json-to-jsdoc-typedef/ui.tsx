'use client';

import { useCallback, useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const SAMPLE = `[
  { "id": 1, "name": "Ada", "score": 9.5, "active": true, "bio": null },
  { "id": 2, "name": "Bob", "score": 7.0, "active": false }
]`;

function isPlainObject(v: Json): v is { [key: string]: Json } {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pascalCase(key: string): string {
  const parts = key.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (parts.length === 0) return 'Item';
  const out = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  return /^[0-9]/.test(out) ? `T${out}` : out;
}

interface Options {
  arrayStyle: boolean; // true => type[], false => Array<T>
  markNullable: boolean; // append ? to nullable scalar types
  rootName: string;
}

interface Typedef {
  name: string;
  props: { key: string; type: string; optional: boolean }[];
}

function scalarType(v: Json): string {
  switch (typeof v) {
    case 'string':
      return 'string';
    case 'boolean':
      return 'boolean';
    case 'number':
      return 'number';
    default:
      return '*';
  }
}

function listType(elem: string, opt: Options): string {
  // wrap union element types in parens for type[] form
  if (opt.arrayStyle) {
    return /[|]/.test(elem) ? `(${elem})[]` : `${elem}[]`;
  }
  return `Array<${elem}>`;
}

// Collect keys and presence counts across an array of objects.
function mergeObjects(items: Json[]): { keys: string[]; presence: Map<string, number>; merged: { [key: string]: Json } } {
  const presence = new Map<string, number>();
  const merged: { [key: string]: Json } = {};
  const order: string[] = [];
  let objCount = 0;
  for (const item of items) {
    if (!isPlainObject(item)) continue;
    objCount += 1;
    for (const k of Object.keys(item)) {
      const val = item[k];
      if (val === undefined) continue;
      if (!(k in merged) || (merged[k] === null && val !== null)) {
        if (!(k in merged)) order.push(k);
        merged[k] = val;
      }
      presence.set(k, (presence.get(k) ?? 0) + 1);
    }
  }
  // store objCount inside presence under a sentinel? Instead return separately via closure not possible; encode in map
  presence.set('__count__', objCount);
  return { keys: order, presence, merged };
}

function build(
  obj: { [key: string]: Json },
  keys: string[],
  presence: Map<string, number>,
  total: number,
  typeName: string,
  defs: Typedef[],
  seen: Set<string>,
  opt: Options
): void {
  if (seen.has(typeName)) return;
  seen.add(typeName);
  const props: { key: string; type: string; optional: boolean }[] = [];

  for (const key of keys) {
    const value = obj[key];
    if (value === undefined) continue;
    const optional = total > 1 && (presence.get(key) ?? total) < total;

    if (value === null) {
      // a value seen only as null: type is unknown; '?*' = nullable any, else just 'null'
      props.push({ key, type: opt.markNullable ? '?*' : 'null', optional });
      continue;
    }

    if (isPlainObject(value)) {
      const nested = pascalCase(key);
      build(value, Object.keys(value), new Map<string, number>([['__count__', 1]]), 1, nested, defs, seen, opt);
      props.push({ key, type: nested, optional });
      continue;
    }

    if (Array.isArray(value)) {
      const first = value[0];
      let elem: string;
      if (first === undefined) {
        elem = '*';
      } else if (isPlainObject(first)) {
        const nested = pascalCase(key.replace(/s$/, '') || key);
        const m = mergeObjects(value);
        const cnt = m.presence.get('__count__') ?? value.length;
        build(m.merged, m.keys, m.presence, cnt, nested, defs, seen, opt);
        elem = nested;
      } else {
        elem = scalarType(first);
      }
      props.push({ key, type: listType(elem, opt), optional });
      continue;
    }

    props.push({ key, type: scalarType(value), optional });
  }

  defs.push({ name: typeName, props });
}

function emit(def: Typedef): string {
  const lines: string[] = ['/**'];
  lines.push(` * @typedef {Object} ${def.name}`);
  for (const p of def.props) {
    const name = p.optional ? `[${p.key}]` : p.key;
    lines.push(` * @property {${p.type}} ${name}`);
  }
  lines.push(' */');
  return lines.join('\n');
}

function generate(data: Json, opt: Options): string {
  const root = pascalCase(opt.rootName.trim() || 'Root');
  const defs: Typedef[] = [];
  const seen = new Set<string>();

  if (Array.isArray(data)) {
    const first = data[0];
    if (first !== undefined && isPlainObject(first)) {
      const m = mergeObjects(data);
      const cnt = m.presence.get('__count__') ?? data.length;
      build(m.merged, m.keys, m.presence, cnt, root, defs, seen, opt);
      return defs.map(emit).join('\n\n') + '\n';
    }
    throw new Error('Array must contain objects to generate JSDoc typedefs.');
  }

  if (isPlainObject(data)) {
    build(data, Object.keys(data), new Map<string, number>([['__count__', 1]]), 1, root, defs, seen, opt);
    return defs.map(emit).join('\n\n') + '\n';
  }

  throw new Error('Top-level JSON must be an object or array of objects.');
}

export default function JsonToJsdocTypedefTool() {
  const [arrayStyle, setArrayStyle] = useState(false);
  const [markNullable, setMarkNullable] = useState(false);
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
      return generate(parsed, { arrayStyle, markNullable, rootName });
    },
    [arrayStyle, markNullable, rootName]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[arrayStyle, markNullable, rootName]}
      inputLabel="JSON"
      outputLabel="JSDoc"
      inputPlaceholder="Paste a JSON object or array..."
      sample={SAMPLE}
      downloadName="types.js"
      downloadMime="text/javascript"
      options={
        <>
          <Field label="Root name" className="max-w-[160px]">
            <Input
              value={rootName}
              onChange={(e) => setRootName(e.target.value)}
              placeholder="Root"
              className="h-8 font-mono"
            />
          </Field>
          <Field label="Use type[] style">
            <Switch checked={arrayStyle} onCheckedChange={setArrayStyle} />
          </Field>
          <Field label="Mark nullables with ?">
            <Switch checked={markNullable} onCheckedChange={setMarkNullable} />
          </Field>
        </>
      }
    />
  );
}
