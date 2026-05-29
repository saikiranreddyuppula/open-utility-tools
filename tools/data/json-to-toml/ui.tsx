'use client';

import { useCallback } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const SAMPLE = `{
  "title": "Example",
  "owner": { "name": "Alice", "active": true },
  "ports": [8000, 8001],
  "servers": [
    { "host": "alpha", "port": 1 },
    { "host": "beta", "port": 2 }
  ]
}`;

function isPlainObject(v: Json): v is { [key: string]: Json } {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isArrayOfTables(v: Json): v is { [key: string]: Json }[] {
  return Array.isArray(v) && v.length > 0 && v.every((item) => isPlainObject(item));
}

// A key that needs no quoting per TOML bare-key rules.
function formatKey(key: string): string {
  return /^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key);
}

function formatString(s: string): string {
  return JSON.stringify(s); // produces a valid TOML basic string
}

function formatScalar(v: Json): string {
  if (v === null) {
    throw new Error('TOML has no null type; remove null values before converting.');
  }
  switch (typeof v) {
    case 'string':
      return formatString(v);
    case 'boolean':
      return v ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(v)) {
        throw new Error('TOML cannot represent Infinity or NaN.');
      }
      return String(v);
    default:
      throw new Error('Unsupported scalar type.');
  }
}

// Inline value used for arrays of scalars/nested arrays/inline tables.
function formatInline(v: Json): string {
  if (Array.isArray(v)) {
    return `[${v.map((item) => formatInline(item)).join(', ')}]`;
  }
  if (isPlainObject(v)) {
    const parts: string[] = [];
    for (const k of Object.keys(v)) {
      const child = v[k];
      if (child === undefined) continue;
      parts.push(`${formatKey(k)} = ${formatInline(child)}`);
    }
    return `{ ${parts.join(', ')} }`;
  }
  return formatScalar(v);
}

// Emit a table body. `path` is the dotted header path for nested tables.
function emitTable(obj: { [key: string]: Json }, path: string[], lines: string[]): void {
  const scalarKeys: string[] = [];
  const tableKeys: string[] = [];
  const arrayTableKeys: string[] = [];

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value === undefined) continue;
    if (isPlainObject(value)) {
      tableKeys.push(key);
    } else if (isArrayOfTables(value)) {
      arrayTableKeys.push(key);
    } else {
      scalarKeys.push(key);
    }
  }

  // Scalars and inline arrays first, under the current header.
  for (const key of scalarKeys) {
    const value = obj[key];
    if (value === undefined) continue;
    const rendered: string = formatInline(value);
    lines.push(`${formatKey(key)} = ${rendered}`);
  }

  // Sub-tables as [a.b] sections.
  for (const key of tableKeys) {
    const value = obj[key];
    if (value === undefined || !isPlainObject(value)) continue;
    const nextPath = [...path, key];
    if (lines.length > 0 && lines[lines.length - 1] !== '') lines.push('');
    lines.push(`[${nextPath.map(formatKey).join('.')}]`);
    emitTable(value, nextPath, lines);
  }

  // Arrays of objects as [[a.b]] sections.
  for (const key of arrayTableKeys) {
    const value = obj[key];
    if (value === undefined || !isArrayOfTables(value)) continue;
    const nextPath = [...path, key];
    for (const item of value) {
      if (lines.length > 0 && lines[lines.length - 1] !== '') lines.push('');
      lines.push(`[[${nextPath.map(formatKey).join('.')}]]`);
      emitTable(item, nextPath, lines);
    }
  }
}

function jsonToToml(value: Json): string {
  if (!isPlainObject(value)) {
    throw new Error('Top-level JSON must be an object to convert to TOML.');
  }
  const lines: string[] = [];
  emitTable(value, [], lines);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + (lines.length ? '\n' : '');
}

export default function JsonToTomlTool() {
  const transform = useCallback((input: string) => {
    if (!input.trim()) return '';
    let parsed: Json;
    try {
      parsed = JSON.parse(input) as Json;
    } catch (e) {
      throw new Error(`Invalid JSON: ${(e as Error).message}`);
    }
    return jsonToToml(parsed);
  }, []);

  return (
    <TextToolLayout
      transform={transform}
      inputLabel="JSON"
      outputLabel="TOML"
      inputPlaceholder="Paste a JSON object..."
      sample={SAMPLE}
      downloadName="config.toml"
      downloadMime="application/toml"
    />
  );
}
