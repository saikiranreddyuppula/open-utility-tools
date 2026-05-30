'use client';

import { useCallback, useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const SAMPLE = `{
  "resource": {
    "aws_instance": {
      "web": {
        "ami": "ami-12345",
        "instance_count": 2,
        "monitoring": true,
        "tags": { "Name": "web", "Env": "prod" }
      }
    }
  },
  "ports": [80, 443]
}`;

function isPlainObject(v: Json): v is { [key: string]: Json } {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isArrayOfObjects(v: Json[]): boolean {
  return v.length > 0 && v.every((item) => isPlainObject(item));
}

interface Options {
  blocks: boolean; // nested objects as blocks vs assignment maps
  indentWidth: number;
  quoteKeys: boolean;
}

function formatKey(key: string, opt: Options): string {
  if (opt.quoteKeys) return JSON.stringify(key);
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(key) ? key : JSON.stringify(key);
}

function formatScalar(v: Exclude<Json, Json[] | { [key: string]: Json }>): string {
  if (v === null) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : `"${String(v)}"`;
  // escape interpolation-like ${ sequences so HCL treats them literally
  const escaped = v
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\$\{/g, '$${')
    .replace(/%\{/g, '%%{');
  return `"${escaped}"`;
}

function indent(level: number, opt: Options): string {
  return ' '.repeat(level * opt.indentWidth);
}

function formatInline(v: Json): string {
  if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return formatScalar(v);
  }
  if (Array.isArray(v)) {
    return `[${v.map((item) => formatInline(item)).join(', ')}]`;
  }
  // inline object (map)
  const parts: string[] = [];
  for (const k of Object.keys(v)) {
    const child = v[k];
    if (child === undefined) continue;
    parts.push(`${k} = ${formatInline(child)}`);
  }
  return `{ ${parts.join(', ')} }`;
}

function emit(obj: { [key: string]: Json }, level: number, lines: string[], opt: Options): void {
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value === undefined) continue;
    const pad = indent(level, opt);
    const fkey = formatKey(key, opt);

    if (isPlainObject(value)) {
      if (opt.blocks) {
        lines.push(`${pad}${fkey} {`);
        emit(value, level + 1, lines, opt);
        lines.push(`${pad}}`);
      } else {
        lines.push(`${pad}${fkey} = ${formatInline(value)}`);
      }
      continue;
    }

    if (Array.isArray(value)) {
      if (opt.blocks && isArrayOfObjects(value)) {
        for (const item of value) {
          if (!isPlainObject(item)) continue;
          lines.push(`${pad}${fkey} {`);
          emit(item, level + 1, lines, opt);
          lines.push(`${pad}}`);
        }
      } else {
        lines.push(`${pad}${fkey} = ${formatInline(value)}`);
      }
      continue;
    }

    lines.push(`${pad}${fkey} = ${formatScalar(value)}`);
  }
}

function generate(data: Json, opt: Options): string {
  if (!isPlainObject(data)) {
    throw new Error('Top-level JSON must be an object to convert to HCL.');
  }
  const lines: string[] = [];
  emit(data, 0, lines, opt);
  return lines.join('\n') + (lines.length ? '\n' : '');
}

export default function JsonToHclTool() {
  const [blocks, setBlocks] = useState(true);
  const [indentWidth, setIndentWidth] = useState(2);
  const [quoteKeys, setQuoteKeys] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let parsed: Json;
      try {
        parsed = JSON.parse(input) as Json;
      } catch (e) {
        throw new Error(`Invalid JSON: ${(e as Error).message}`);
      }
      return generate(parsed, { blocks, indentWidth, quoteKeys });
    },
    [blocks, indentWidth, quoteKeys]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[blocks, indentWidth, quoteKeys]}
      inputLabel="JSON"
      outputLabel="HCL"
      inputPlaceholder="Paste a JSON object..."
      sample={SAMPLE}
      downloadName="config.tf"
      downloadMime="text/plain"
      options={
        <>
          <Field label="Nested objects as blocks">
            <Switch checked={blocks} onCheckedChange={setBlocks} />
          </Field>
          <Field label="Quote all keys">
            <Switch checked={quoteKeys} onCheckedChange={setQuoteKeys} />
          </Field>
          <Field label={`Indent: ${indentWidth}`} className="min-w-[180px]">
            <Slider
              value={[indentWidth]}
              min={1}
              max={8}
              step={1}
              onValueChange={(v) => setIndentWidth(v[0] ?? 2)}
            />
          </Field>
        </>
      }
    />
  );
}
