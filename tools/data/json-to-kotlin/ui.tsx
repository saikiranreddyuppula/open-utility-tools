'use client';

import { useCallback, useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const SAMPLE = `{
  "id": 1,
  "user_name": "ada",
  "score": 9.5,
  "active": true,
  "big_id": 9999999999,
  "nickname": null,
  "tags": ["a", "b"],
  "profile": { "city": "London", "verified": true }
}`;

function isPlainObject(v: Json): v is { [key: string]: Json } {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pascalCase(key: string): string {
  const parts = key.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (parts.length === 0) return 'Item';
  const out = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  return /^[0-9]/.test(out) ? `N${out}` : out;
}

function camelCase(key: string): string {
  const p = pascalCase(key);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

function isCamelCase(key: string): boolean {
  return /^[a-z][A-Za-z0-9]*$/.test(key);
}

interface Options {
  allNullable: boolean;
  useVal: boolean;
  serializable: boolean;
}

interface FieldDef {
  jsonKey: string;
  propName: string;
  type: string; // without trailing '?'
  nullable: boolean;
  serialName: boolean; // needs @SerialName
}

interface ClassDef {
  name: string;
  fields: FieldDef[];
}

function scalarType(v: Json): string {
  switch (typeof v) {
    case 'string':
      return 'String';
    case 'boolean':
      return 'Boolean';
    case 'number':
      if (Number.isInteger(v)) {
        return v > 2147483647 || v < -2147483648 ? 'Long' : 'Int';
      }
      return 'Double';
    default:
      return 'String';
  }
}

function build(
  obj: { [key: string]: Json },
  className: string,
  classes: ClassDef[],
  seen: Set<string>,
  opt: Options
): void {
  if (seen.has(className)) return;
  seen.add(className);
  const fields: FieldDef[] = [];

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value === undefined) continue;
    const prop = isCamelCase(key) ? key : camelCase(key);
    const needsSerial = prop !== key;
    const nullable = value === null || opt.allNullable;

    if (value === null) {
      fields.push({ jsonKey: key, propName: prop, type: 'String', nullable: true, serialName: needsSerial });
      continue;
    }

    if (isPlainObject(value)) {
      const nested = pascalCase(key);
      build(value, nested, classes, seen, opt);
      fields.push({ jsonKey: key, propName: prop, type: nested, nullable, serialName: needsSerial });
      continue;
    }

    if (Array.isArray(value)) {
      const first = value[0];
      let elem: string;
      if (first === undefined) {
        elem = 'String';
      } else if (isPlainObject(first)) {
        const nested = pascalCase(key.replace(/s$/, '') || key);
        build(first, nested, classes, seen, opt);
        elem = nested;
      } else {
        elem = scalarType(first);
      }
      fields.push({ jsonKey: key, propName: prop, type: `List<${elem}>`, nullable, serialName: needsSerial });
      continue;
    }

    fields.push({ jsonKey: key, propName: prop, type: scalarType(value), nullable, serialName: needsSerial });
  }

  classes.push({ name: className, fields });
}

function emit(c: ClassDef, opt: Options): string {
  const lines: string[] = [];
  if (opt.serializable) lines.push('@Serializable');
  const kw = opt.useVal ? 'val' : 'var';

  if (c.fields.length === 0) {
    lines.push(`data class ${c.name}(val placeholder: String? = null)`);
    return lines.join('\n');
  }

  lines.push(`data class ${c.name}(`);
  c.fields.forEach((f, i) => {
    const comma = i < c.fields.length - 1 ? ',' : '';
    const q = f.nullable ? '?' : '';
    const ann = opt.serializable && f.serialName ? `@SerialName("${f.jsonKey}") ` : '';
    lines.push(`    ${ann}${kw} ${f.propName}: ${f.type}${q}${comma}`);
  });
  lines.push(')');
  return lines.join('\n');
}

function generate(data: Json, opt: Options): string {
  let obj: { [key: string]: Json };
  let root = 'Root';
  if (isPlainObject(data)) {
    obj = data;
  } else if (Array.isArray(data) && data[0] !== undefined && isPlainObject(data[0])) {
    obj = data[0];
    root = 'Item';
  } else {
    throw new Error('Top-level JSON must be an object (or array of objects) to generate Kotlin data classes.');
  }
  const classes: ClassDef[] = [];
  build(obj, root, classes, new Set<string>(), opt);
  const body = classes.map((c) => emit(c, opt)).join('\n\n');
  const header = opt.serializable
    ? 'import kotlinx.serialization.SerialName\nimport kotlinx.serialization.Serializable\n\n'
    : '';
  return header + body + '\n';
}

export default function JsonToKotlinTool() {
  const [allNullable, setAllNullable] = useState(false);
  const [useVal, setUseVal] = useState(true);
  const [serializable, setSerializable] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let parsed: Json;
      try {
        parsed = JSON.parse(input) as Json;
      } catch (e) {
        throw new Error(`Invalid JSON: ${(e as Error).message}`);
      }
      return generate(parsed, { allNullable, useVal, serializable });
    },
    [allNullable, useVal, serializable]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[allNullable, useVal, serializable]}
      inputLabel="JSON"
      outputLabel="Kotlin"
      inputPlaceholder="Paste a JSON object..."
      sample={SAMPLE}
      downloadName="Models.kt"
      downloadMime="text/plain"
      options={
        <>
          <Field label="kotlinx.serialization">
            <Switch checked={serializable} onCheckedChange={setSerializable} />
          </Field>
          <Field label="val (immutable)">
            <Switch checked={useVal} onCheckedChange={setUseVal} />
          </Field>
          <Field label="All fields nullable">
            <Switch checked={allNullable} onCheckedChange={setAllNullable} />
          </Field>
        </>
      }
    />
  );
}
