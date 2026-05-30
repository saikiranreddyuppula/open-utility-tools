'use client';

import { useCallback, useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const SAMPLE = `{
  "id": 1,
  "userName": "ada",
  "score": 9.5,
  "active": true,
  "bigCount": 9999999999,
  "tags": ["a", "b"],
  "profile": { "city": "London", "verified": true },
  "extra": null
}`;

function isPlainObject(v: Json): v is { [key: string]: Json } {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pascalCase(key: string): string {
  const parts = key.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (parts.length === 0) return 'Message';
  const out = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  return /^[0-9]/.test(out) ? `M${out}` : out;
}

function snakeCase(key: string): string {
  const s = key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  return s.length > 0 ? s : 'field';
}

interface Options {
  defaultInt32: boolean; // prefer int32 over int64 for integers fitting 32-bit
  proto2: boolean;
  packageName: string;
}

interface FieldDef {
  protoName: string;
  origName: string;
  type: string;
  repeated: boolean;
}

interface MessageDef {
  name: string;
  fields: FieldDef[];
}

let usedWellKnownValue = false;

function intType(v: number, opt: Options): string {
  const fits32 = v <= 2147483647 && v >= -2147483648;
  if (opt.defaultInt32 && fits32) return 'int32';
  return 'int64';
}

function scalarType(v: Json, opt: Options): string {
  switch (typeof v) {
    case 'string':
      return 'string';
    case 'boolean':
      return 'bool';
    case 'number':
      return Number.isInteger(v) ? intType(v, opt) : 'double';
    default:
      usedWellKnownValue = true;
      return 'google.protobuf.Value';
  }
}

function build(
  obj: { [key: string]: Json },
  msgName: string,
  messages: MessageDef[],
  seen: Set<string>,
  opt: Options
): void {
  if (seen.has(msgName)) return;
  seen.add(msgName);
  const fields: FieldDef[] = [];

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value === undefined) continue;
    const protoName = snakeCase(key);

    if (value === null) {
      usedWellKnownValue = true;
      fields.push({ protoName, origName: key, type: 'google.protobuf.Value', repeated: false });
      continue;
    }

    if (isPlainObject(value)) {
      const nested = pascalCase(key);
      build(value, nested, messages, seen, opt);
      fields.push({ protoName, origName: key, type: nested, repeated: false });
      continue;
    }

    if (Array.isArray(value)) {
      const first = value[0];
      let elem: string;
      if (first === undefined) {
        elem = 'string';
      } else if (isPlainObject(first)) {
        const nested = pascalCase(key.replace(/s$/, '') || key);
        build(first, nested, messages, seen, opt);
        elem = nested;
      } else {
        elem = scalarType(first, opt);
      }
      fields.push({ protoName, origName: key, type: elem, repeated: true });
      continue;
    }

    fields.push({ protoName, origName: key, type: scalarType(value, opt), repeated: false });
  }

  messages.push({ name: msgName, fields });
}

function emit(m: MessageDef, opt: Options): string {
  const lines: string[] = [`message ${m.name} {`];
  m.fields.forEach((f, i) => {
    const num = i + 1;
    const optionalKw = opt.proto2 && !f.repeated ? 'optional ' : '';
    const rep = f.repeated ? 'repeated ' : '';
    const comment = f.protoName !== f.origName ? ` // json: ${f.origName}` : '';
    lines.push(`  ${rep}${optionalKw}${f.type} ${f.protoName} = ${num};${comment}`);
  });
  lines.push('}');
  return lines.join('\n');
}

function generate(data: Json, opt: Options): string {
  usedWellKnownValue = false;
  let obj: { [key: string]: Json };
  let root = 'Root';
  if (isPlainObject(data)) {
    obj = data;
  } else if (Array.isArray(data) && data[0] !== undefined && isPlainObject(data[0])) {
    obj = data[0];
    root = 'Item';
  } else {
    throw new Error('Top-level JSON must be an object (or array of objects) to generate a .proto file.');
  }

  const messages: MessageDef[] = [];
  build(obj, root, messages, new Set<string>(), opt);

  const header: string[] = [];
  header.push(opt.proto2 ? 'syntax = "proto2";' : 'syntax = "proto3";');
  if (usedWellKnownValue) {
    header.push('');
    header.push('import "google/protobuf/struct.proto";');
  }
  const pkg = opt.packageName.trim();
  if (pkg) {
    header.push('');
    header.push(`package ${pkg};`);
  }
  header.push('');

  return header.join('\n') + messages.map((m) => emit(m, opt)).join('\n\n') + '\n';
}

export default function JsonToProtobufTool() {
  const [defaultInt32, setDefaultInt32] = useState(false);
  const [proto2, setProto2] = useState(false);
  const [packageName, setPackageName] = useState('');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let parsed: Json;
      try {
        parsed = JSON.parse(input) as Json;
      } catch (e) {
        throw new Error(`Invalid JSON: ${(e as Error).message}`);
      }
      return generate(parsed, { defaultInt32, proto2, packageName });
    },
    [defaultInt32, proto2, packageName]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[defaultInt32, proto2, packageName]}
      inputLabel="JSON"
      outputLabel=".proto"
      inputPlaceholder="Paste a JSON object..."
      sample={SAMPLE}
      downloadName="schema.proto"
      downloadMime="text/plain"
      options={
        <>
          <Field label="Package" className="max-w-[160px]">
            <Input
              value={packageName}
              onChange={(e) => setPackageName(e.target.value)}
              placeholder="(none)"
              className="h-8 font-mono"
            />
          </Field>
          <Field label="Default int32">
            <Switch checked={defaultInt32} onCheckedChange={setDefaultInt32} />
          </Field>
          <Field label="proto2 syntax">
            <Switch checked={proto2} onCheckedChange={setProto2} />
          </Field>
        </>
      }
    />
  );
}
