'use client';

import { useCallback, useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const SAMPLE = `{
  "name": "Ada Lovelace",
  "age": 36,
  "email": "ada@example.com",
  "active": true,
  "createdAt": "2024-01-15T08:30:00Z",
  "tags": ["math", "code"],
  "address": { "city": "London", "zip": "EC1" },
  "orders": [
    { "id": 1, "total": 9.99 }
  ],
  "meta": null
}`;

function isPlainObject(v: Json): v is { [key: string]: Json } {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(s);
}

function isKey(key: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);
}

function quoteKey(key: string): string {
  return isKey(key) ? key : JSON.stringify(key);
}

interface Options {
  timestamps: boolean;
  required: boolean;
  model: boolean;
  modelName: string;
}

function scalarType(v: Json): string {
  switch (typeof v) {
    case 'string':
      return isIsoDate(v) ? 'Date' : 'String';
    case 'boolean':
      return 'Boolean';
    case 'number':
      return 'Number';
    default:
      return 'mongoose.Schema.Types.Mixed';
  }
}

function indent(level: number): string {
  return '  '.repeat(level);
}

// Emit the schema definition body for an object at a given indent level.
function emitObject(obj: { [key: string]: Json }, level: number, opt: Options): string {
  const inner = indent(level + 1);
  const close = indent(level);
  const parts: string[] = [];

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value === undefined) continue;
    const fk = quoteKey(key);

    if (value === null) {
      parts.push(`${inner}${fk}: mongoose.Schema.Types.Mixed`);
      continue;
    }

    if (isPlainObject(value)) {
      parts.push(`${inner}${fk}: ${emitObject(value, level + 1, opt)}`);
      continue;
    }

    if (Array.isArray(value)) {
      const first = value[0];
      if (first === undefined) {
        parts.push(`${inner}${fk}: [mongoose.Schema.Types.Mixed]`);
      } else if (isPlainObject(first)) {
        parts.push(`${inner}${fk}: [${emitObject(first, level + 1, opt)}]`);
      } else {
        parts.push(`${inner}${fk}: [${scalarType(first)}]`);
      }
      continue;
    }

    // scalar: optionally use descriptor with required + type for date keys
    const t = scalarType(value);
    if (opt.required) {
      parts.push(`${inner}${fk}: { type: ${t}, required: true }`);
    } else {
      parts.push(`${inner}${fk}: ${t}`);
    }
  }

  return `{\n${parts.join(',\n')}\n${close}}`;
}

function generate(data: Json, opt: Options): string {
  let obj: { [key: string]: Json };
  if (isPlainObject(data)) {
    obj = data;
  } else if (Array.isArray(data) && data[0] !== undefined && isPlainObject(data[0])) {
    obj = data[0];
  } else {
    throw new Error('Top-level JSON must be an object (or array of objects) to generate a Mongoose schema.');
  }

  const body = emitObject(obj, 0, opt);
  const schemaOpts = opt.timestamps ? ', { timestamps: true }' : '';
  const name = (opt.modelName.trim() || 'Model').replace(/[^A-Za-z0-9_$]/g, '');
  const varName = name.charAt(0).toLowerCase() + name.slice(1) + 'Schema';

  const lines: string[] = [];
  lines.push("const mongoose = require('mongoose');");
  lines.push('');
  lines.push(`const ${varName} = new mongoose.Schema(${body}${schemaOpts});`);
  lines.push('');
  if (opt.model) {
    lines.push(`module.exports = mongoose.model('${name}', ${varName});`);
  } else {
    lines.push(`module.exports = ${varName};`);
  }
  return lines.join('\n') + '\n';
}

export default function JsonToMongooseSchemaTool() {
  const [timestamps, setTimestamps] = useState(true);
  const [required, setRequired] = useState(false);
  const [model, setModel] = useState(true);
  const [modelName, setModelName] = useState('User');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let parsed: Json;
      try {
        parsed = JSON.parse(input) as Json;
      } catch (e) {
        throw new Error(`Invalid JSON: ${(e as Error).message}`);
      }
      return generate(parsed, { timestamps, required, model, modelName });
    },
    [timestamps, required, model, modelName]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[timestamps, required, model, modelName]}
      inputLabel="JSON"
      outputLabel="Mongoose Schema"
      inputPlaceholder="Paste a JSON object..."
      sample={SAMPLE}
      downloadName="schema.js"
      downloadMime="text/javascript"
      options={
        <>
          <Field label="Model name" className="max-w-[160px]">
            <Input
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="User"
              className="h-8 font-mono"
            />
          </Field>
          <Field label="timestamps: true">
            <Switch checked={timestamps} onCheckedChange={setTimestamps} />
          </Field>
          <Field label="required: true">
            <Switch checked={required} onCheckedChange={setRequired} />
          </Field>
          <Field label="model() wrapper">
            <Switch checked={model} onCheckedChange={setModel} />
          </Field>
        </>
      }
    />
  );
}
