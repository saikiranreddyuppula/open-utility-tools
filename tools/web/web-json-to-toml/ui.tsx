'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'j2t' | 't2j';

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

const BARE_KEY = /^[A-Za-z0-9_-]+$/;

function quoteKey(key: string): string {
  if (BARE_KEY.test(key)) return key;
  return '"' + key.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function quoteString(s: string): string {
  return (
    '"' +
    s
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t') +
    '"'
  );
}

function isPlainObject(v: JsonValue): v is { [k: string]: JsonValue } {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isArrayOfTables(v: JsonValue): v is { [k: string]: JsonValue }[] {
  return Array.isArray(v) && v.length > 0 && v.every((x) => isPlainObject(x));
}

function scalarToToml(v: JsonValue): string {
  if (v === null) throw new Error('TOML has no null type; remove null values before converting.');
  if (typeof v === 'string') return quoteString(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error('TOML cannot represent non-finite numbers (Infinity/NaN).');
    return String(v);
  }
  // inline array of scalars / mixed
  if (Array.isArray(v)) {
    return '[' + v.map((x) => scalarToToml(x)).join(', ') + ']';
  }
  // inline table
  const parts = Object.keys(v).map((k) => quoteKey(k) + ' = ' + scalarToToml(v[k] as JsonValue));
  return '{ ' + parts.join(', ') + ' }';
}

function emitTable(obj: { [k: string]: JsonValue }, path: string[], lines: string[]): void {
  const keys = Object.keys(obj);
  // First emit scalar / inline values
  for (const key of keys) {
    const val = obj[key] as JsonValue;
    if (isPlainObject(val) || isArrayOfTables(val)) continue;
    lines.push(quoteKey(key) + ' = ' + scalarToToml(val));
  }
  // Then nested tables and arrays of tables
  for (const key of keys) {
    const val = obj[key] as JsonValue;
    if (isPlainObject(val)) {
      const newPath = [...path, key];
      lines.push('');
      lines.push('[' + newPath.map(quoteKey).join('.') + ']');
      emitTable(val, newPath, lines);
    } else if (isArrayOfTables(val)) {
      const newPath = [...path, key];
      for (const entry of val) {
        lines.push('');
        lines.push('[[' + newPath.map(quoteKey).join('.') + ']]');
        emitTable(entry, newPath, lines);
      }
    }
  }
}

function jsonToToml(input: string): string {
  let parsed: JsonValue;
  try {
    parsed = JSON.parse(input) as JsonValue;
  } catch (e) {
    throw new Error('Invalid JSON: ' + (e instanceof Error ? e.message : String(e)));
  }
  if (!isPlainObject(parsed)) {
    throw new Error('Top-level JSON must be an object to convert to TOML.');
  }
  const lines: string[] = [];
  emitTable(parsed, [], lines);
  // remove a leading blank line if present
  while (lines.length > 0 && lines[0] === '') lines.shift();
  return lines.join('\n') + '\n';
}

// ----- Minimal TOML -> JSON -----

function parseTomlValue(raw: string): JsonValue {
  const s = raw.trim();
  if (s === '') throw new Error('Empty value in TOML.');
  const first = s[0];
  if (first === '"' || first === "'") {
    return parseTomlString(s);
  }
  if (first === '[') {
    return parseTomlArray(s);
  }
  if (first === '{') {
    return parseTomlInlineTable(s);
  }
  if (s === 'true') return true;
  if (s === 'false') return false;
  const num = Number(s);
  if (Number.isFinite(num) && /^[-+]?[0-9._eE+-]+$/.test(s)) {
    return Number(s.replace(/_/g, ''));
  }
  // bare/unknown -> treat as string
  return s;
}

function parseTomlString(s: string): string {
  const quote = s[0];
  let out = '';
  for (let i = 1; i < s.length; i++) {
    const ch = s[i];
    if (ch === undefined) break;
    if (quote === "'") {
      if (ch === "'") return out;
      out += ch;
      continue;
    }
    if (ch === '\\') {
      const next = s[i + 1];
      i++;
      if (next === 'n') out += '\n';
      else if (next === 't') out += '\t';
      else if (next === 'r') out += '\r';
      else if (next === '"') out += '"';
      else if (next === '\\') out += '\\';
      else out += next ?? '';
      continue;
    }
    if (ch === '"') return out;
    out += ch;
  }
  throw new Error('Unterminated string in TOML.');
}

function splitTopLevel(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inStr: string | null = null;
  let cur = '';
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i] ?? '';
    if (inStr) {
      cur += ch;
      if (ch === inStr && inner[i - 1] !== '\\') inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      cur += ch;
      continue;
    }
    if (ch === '[' || ch === '{') depth++;
    if (ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim() !== '') parts.push(cur);
  return parts;
}

function parseTomlArray(s: string): JsonValue[] {
  const inner = s.slice(1, s.lastIndexOf(']'));
  if (inner.trim() === '') return [];
  return splitTopLevel(inner).map((p) => parseTomlValue(p));
}

function parseTomlInlineTable(s: string): { [k: string]: JsonValue } {
  const inner = s.slice(1, s.lastIndexOf('}'));
  const obj: { [k: string]: JsonValue } = {};
  if (inner.trim() === '') return obj;
  for (const pair of splitTopLevel(inner)) {
    const eq = pair.indexOf('=');
    if (eq < 0) throw new Error('Invalid inline table entry: ' + pair.trim());
    const key = unquoteKey(pair.slice(0, eq).trim());
    obj[key] = parseTomlValue(pair.slice(eq + 1));
  }
  return obj;
}

function unquoteKey(k: string): string {
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    return parseTomlString(k);
  }
  return k;
}

function splitDottedKey(k: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let inStr: string | null = null;
  for (let i = 0; i < k.length; i++) {
    const ch = k[i] ?? '';
    if (inStr) {
      cur += ch;
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      cur += ch;
      continue;
    }
    if (ch === '.') {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts.map((p) => unquoteKey(p.trim()));
}

function ensureTable(root: { [k: string]: JsonValue }, path: string[]): { [k: string]: JsonValue } {
  let node: { [k: string]: JsonValue } = root;
  for (const seg of path) {
    const existing = node[seg];
    if (existing === undefined) {
      const next: { [k: string]: JsonValue } = {};
      node[seg] = next;
      node = next;
    } else if (Array.isArray(existing)) {
      const last = existing[existing.length - 1];
      if (last !== undefined && isPlainObject(last)) {
        node = last;
      } else {
        throw new Error('Key path conflicts with a non-table value: ' + seg);
      }
    } else if (isPlainObject(existing)) {
      node = existing;
    } else {
      throw new Error('Key path conflicts with a non-table value: ' + seg);
    }
  }
  return node;
}

function tomlToJson(input: string): string {
  const root: { [k: string]: JsonValue } = {};
  let current: { [k: string]: JsonValue } = root;
  const rawLines = input.split(/\r?\n/);

  for (let li = 0; li < rawLines.length; li++) {
    let line = rawLines[li] ?? '';
    // strip comments not inside strings
    let inStr: string | null = null;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inStr) {
        if (ch === inStr) inStr = null;
      } else if (ch === '"' || ch === "'") {
        inStr = ch;
      } else if (ch === '#') {
        line = line.slice(0, i);
        break;
      }
    }
    line = line.trim();
    if (line === '') continue;

    if (line.startsWith('[[') && line.endsWith(']]')) {
      const path = splitDottedKey(line.slice(2, -2).trim());
      if (path.length === 0) throw new Error('Empty array-of-tables header.');
      const parentPath = path.slice(0, -1);
      const lastKey = path[path.length - 1];
      if (lastKey === undefined) throw new Error('Invalid array-of-tables header.');
      const parent = ensureTable(root, parentPath);
      let arr = parent[lastKey];
      if (arr === undefined) {
        arr = [];
        parent[lastKey] = arr;
      }
      if (!Array.isArray(arr)) throw new Error('Conflicting key for array of tables: ' + lastKey);
      const entry: { [k: string]: JsonValue } = {};
      arr.push(entry);
      current = entry;
      continue;
    }

    if (line.startsWith('[') && line.endsWith(']')) {
      const path = splitDottedKey(line.slice(1, -1).trim());
      if (path.length === 0) throw new Error('Empty table header.');
      current = ensureTable(root, path);
      continue;
    }

    const eq = line.indexOf('=');
    if (eq < 0) throw new Error('Invalid TOML line (no key/value): ' + line);
    const keyPath = splitDottedKey(line.slice(0, eq).trim());
    const valueRaw = line.slice(eq + 1);
    const value = parseTomlValue(valueRaw);
    if (keyPath.length === 1) {
      const k = keyPath[0];
      if (k !== undefined) current[k] = value;
    } else {
      const k = keyPath[keyPath.length - 1];
      if (k === undefined) throw new Error('Invalid dotted key: ' + line);
      const tbl = ensureTable(current, keyPath.slice(0, -1));
      tbl[k] = value;
    }
  }

  return JSON.stringify(root, null, 2);
}

export default function JsonToTomlTool() {
  const [mode, setMode] = useState<Mode>('j2t');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      return mode === 'j2t' ? jsonToToml(input) : tomlToJson(input);
    },
    [mode],
  );

  const sample =
    mode === 'j2t'
      ? '{\n  "title": "My App",\n  "version": 2,\n  "database": {\n    "host": "localhost",\n    "ports": [5432, 5433],\n    "enabled": true\n  },\n  "servers": [\n    { "name": "alpha", "ip": "10.0.0.1" },\n    { "name": "beta", "ip": "10.0.0.2" }\n  ]\n}'
      : 'title = "My App"\nversion = 2\n\n[database]\nhost = "localhost"\nports = [5432, 5433]\nenabled = true\n\n[[servers]]\nname = "alpha"\nip = "10.0.0.1"\n\n[[servers]]\nname = "beta"\nip = "10.0.0.2"\n';

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode]}
      inputLabel={mode === 'j2t' ? 'JSON' : 'TOML'}
      outputLabel={mode === 'j2t' ? 'TOML' : 'JSON'}
      inputPlaceholder={mode === 'j2t' ? 'Paste JSON…' : 'Paste TOML…'}
      sample={sample}
      downloadName={mode === 'j2t' ? 'config.toml' : 'config.json'}
      downloadMime={mode === 'j2t' ? 'text/plain' : 'application/json'}
      options={
        <Field label="Direction">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="j2t">JSON → TOML</TabsTrigger>
              <TabsTrigger value="t2j">TOML → JSON</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
