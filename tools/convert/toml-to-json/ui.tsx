'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

/** Parse a TOML basic/literal string or a bare value into a JSON value. */
function parseValue(raw: string): Json {
  const v = raw.trim();
  if (v === '') throw new Error('Empty value');

  // Inline array.
  if (v.startsWith('[')) {
    return parseInlineArray(v);
  }
  // Inline table.
  if (v.startsWith('{')) {
    return parseInlineTable(v);
  }
  // Multi-line / basic string.
  if (v.startsWith('"""')) return parseBasicString(v.slice(3, v.length - 3), true);
  if (v.startsWith("'''")) return v.slice(3, v.length - 3).replace(/^\n/, '');
  if (v.startsWith('"')) return parseBasicString(v.slice(1, v.length - 1), false);
  if (v.startsWith("'")) return v.slice(1, v.length - 1);

  // Booleans.
  if (v === 'true') return true;
  if (v === 'false') return false;

  // Datetimes (RFC 3339) and dates/times — keep as string.
  if (
    /^\d{4}-\d{2}-\d{2}([Tt ]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})?)?$/.test(v) ||
    /^\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(v)
  ) {
    return v;
  }

  // Numbers (int, float, hex, oct, bin, inf, nan, underscores).
  if (/^[+-]?(inf|nan)$/.test(v)) {
    if (v.endsWith('nan')) return NaN;
    return v.startsWith('-') ? -Infinity : Infinity;
  }
  const cleaned = v.replace(/_/g, '');
  if (/^0x[0-9a-fA-F]+$/.test(cleaned)) return parseInt(cleaned, 16);
  if (/^0o[0-7]+$/.test(cleaned)) return parseInt(cleaned.slice(2), 8);
  if (/^0b[01]+$/.test(cleaned)) return parseInt(cleaned.slice(2), 2);
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(cleaned)) {
    const num = Number(cleaned);
    if (Number.isFinite(num)) return num;
  }

  throw new Error(`Cannot parse value: ${raw}`);
}

function parseBasicString(s: string, multiline: boolean): string {
  let str = s;
  if (multiline) str = str.replace(/^\n/, '').replace(/\\\s*\n\s*/g, '');
  return str.replace(/\\(u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|.)/g, (_m, esc: string) => {
    if (esc[0] === 'u' || esc[0] === 'U') {
      return String.fromCodePoint(parseInt(esc.slice(1), 16));
    }
    switch (esc) {
      case 'n':
        return '\n';
      case 't':
        return '\t';
      case 'r':
        return '\r';
      case '"':
        return '"';
      case '\\':
        return '\\';
      case 'b':
        return '\b';
      case 'f':
        return '\f';
      default:
        return esc;
    }
  });
}

/** Split a bracketed body into top-level comma-separated parts. */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  let inStr: string | null = null;
  for (let i = 0; i < body.length; i++) {
    const c = body[i] ?? '';
    if (inStr) {
      cur += c;
      if (c === '\\' && inStr === '"') {
        cur += body[i + 1] ?? '';
        i++;
      } else if (c === inStr) {
        inStr = null;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = c;
      cur += c;
      continue;
    }
    if (c === '[' || c === '{') depth++;
    if (c === ']' || c === '}') depth--;
    if (c === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.trim() !== '') parts.push(cur);
  return parts;
}

function parseInlineArray(v: string): Json[] {
  const body = v.slice(1, v.lastIndexOf(']'));
  return splitTopLevel(body)
    .map((p) => p.trim())
    .filter((p) => p !== '')
    .map((p) => parseValue(p));
}

function parseInlineTable(v: string): { [k: string]: Json } {
  const body = v.slice(1, v.lastIndexOf('}'));
  const obj: { [k: string]: Json } = {};
  for (const pair of splitTopLevel(body)) {
    const eq = findEquals(pair);
    if (eq < 0) continue;
    const key = pair.slice(0, eq).trim();
    const val = pair.slice(eq + 1).trim();
    setDotted(obj, parseKeyPath(key), parseValue(val));
  }
  return obj;
}

/** Find the position of the key/value '=' outside of quotes. */
function findEquals(line: string): number {
  let inStr: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i] ?? '';
    if (inStr) {
      if (c === '\\' && inStr === '"') i++;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'") inStr = c;
    else if (c === '=') return i;
  }
  return -1;
}

/** Parse a dotted, possibly-quoted key path into segments. */
function parseKeyPath(key: string): string[] {
  const segs: string[] = [];
  let cur = '';
  let inStr: string | null = null;
  for (let i = 0; i < key.length; i++) {
    const c = key[i] ?? '';
    if (inStr) {
      if (c === inStr) {
        inStr = null;
      } else {
        cur += c;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = c;
      continue;
    }
    if (c === '.') {
      segs.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.trim() !== '') segs.push(cur.trim());
  return segs.filter((s) => s !== '');
}

function setDotted(
  root: { [k: string]: Json },
  path: string[],
  value: Json,
): void {
  let node = root;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i];
    if (seg === undefined) continue;
    const existing = node[seg];
    if (existing === undefined) {
      node[seg] = {};
      node = node[seg] as { [k: string]: Json };
    } else if (existing !== null && typeof existing === 'object' && !Array.isArray(existing)) {
      node = existing as { [k: string]: Json };
    } else {
      throw new Error(`Key "${path.join('.')}" conflicts with an existing value`);
    }
  }
  const last = path[path.length - 1];
  if (last === undefined) return;
  node[last] = value;
}

/** Strip an unquoted trailing comment from a value line. */
function stripComment(line: string): string {
  let inStr: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i] ?? '';
    if (inStr) {
      if (c === '\\' && inStr === '"') i++;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'") inStr = c;
    else if (c === '#') return line.slice(0, i);
  }
  return line;
}

function parseToml(input: string): { [k: string]: Json } {
  const root: { [k: string]: Json } = {};
  // Tracks tables created via [[array]] so we append to the right element.
  const lines = input.split(/\r?\n/);

  // Current table object that bare keys attach to.
  let current: { [k: string]: Json } = root;

  let i = 0;
  while (i < lines.length) {
    let rawLine = lines[i] ?? '';
    i++;

    // Join multi-line strings / arrays by counting open brackets/quotes.
    let working = rawLine;
    const trimmed = stripComment(working).trim();
    if (trimmed === '') continue;

    // Table header [a.b] or array of tables [[a.b]].
    if (trimmed.startsWith('[')) {
      const isArray = trimmed.startsWith('[[');
      const close = isArray ? trimmed.indexOf(']]') : trimmed.indexOf(']');
      const name = trimmed.slice(isArray ? 2 : 1, close).trim();
      const path = parseKeyPath(name);
      current = resolveTable(root, path, isArray);
      continue;
    }

    // Key/value. Accumulate continuation lines for multi-line values.
    while (needsMore(stripComment(working)) && i < lines.length) {
      working += '\n' + (lines[i] ?? '');
      i++;
    }
    const cleaned = isMultilineString(working) ? working : stripComment(working);
    const eq = findEquals(cleaned);
    if (eq < 0) throw new Error(`Invalid line: ${rawLine}`);
    const key = cleaned.slice(0, eq).trim();
    const val = cleaned.slice(eq + 1).trim();
    setDotted(current, parseKeyPath(key), parseValue(val));
  }

  return root;
}

function isMultilineString(s: string): boolean {
  const t = s.slice(findEquals(s) + 1).trim();
  return t.startsWith('"""') || t.startsWith("'''");
}

/** Decide if a value line is incomplete (open array/inline-table/triple-string). */
function needsMore(line: string): boolean {
  const eq = findEquals(line);
  if (eq < 0) return false;
  const val = line.slice(eq + 1);
  // Triple-quoted multi-line strings.
  for (const q of ['"""', "'''"]) {
    const first = val.indexOf(q);
    if (first >= 0) {
      const rest = val.indexOf(q, first + 3);
      if (rest < 0) return true;
    }
  }
  // Unbalanced brackets/braces (ignoring those in strings).
  let depth = 0;
  let inStr: string | null = null;
  for (let i = 0; i < val.length; i++) {
    const c = val[i] ?? '';
    if (inStr) {
      if (c === '\\' && inStr === '"') i++;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'") inStr = c;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') depth--;
  }
  return depth > 0;
}

function resolveTable(
  root: { [k: string]: Json },
  path: string[],
  isArray: boolean,
): { [k: string]: Json } {
  let node = root;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i];
    if (seg === undefined) continue;
    let existing = node[seg];
    if (existing === undefined) {
      existing = {};
      node[seg] = existing;
    }
    if (Array.isArray(existing)) {
      const last = existing[existing.length - 1];
      if (last !== null && typeof last === 'object' && !Array.isArray(last)) {
        node = last as { [k: string]: Json };
      } else {
        throw new Error(`Path "${path.join('.')}" conflicts with an array`);
      }
    } else if (existing !== null && typeof existing === 'object') {
      node = existing as { [k: string]: Json };
    } else {
      throw new Error(`Path "${path.join('.')}" conflicts with a value`);
    }
  }

  const last = path[path.length - 1];
  if (last === undefined) return node;

  if (isArray) {
    let arr = node[last];
    if (arr === undefined) {
      arr = [];
      node[last] = arr;
    }
    if (!Array.isArray(arr)) {
      throw new Error(`Cannot redefine "${last}" as an array of tables`);
    }
    const entry: { [k: string]: Json } = {};
    arr.push(entry);
    return entry;
  }

  let tbl = node[last];
  if (tbl === undefined) {
    tbl = {};
    node[last] = tbl;
  }
  if (tbl === null || typeof tbl !== 'object' || Array.isArray(tbl)) {
    throw new Error(`Cannot redefine "${last}" as a table`);
  }
  return tbl as { [k: string]: Json };
}

export default function TomlToJsonTool() {
  const [indent, setIndent] = useState<'2' | '4' | 'tab' | 'min'>('2');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let data: Json;
      try {
        data = parseToml(input);
      } catch (err) {
        throw new Error(`TOML parse error: ${(err as Error).message}`);
      }
      if (indent === 'min') return JSON.stringify(data);
      const indentValue = indent === 'tab' ? '\t' : Number(indent);
      return JSON.stringify(data, null, indentValue);
    },
    [indent],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[indent]}
      inputLabel="TOML"
      outputLabel="JSON"
      inputPlaceholder={'title = "Example"\n\n[owner]\nname = "Tom"\ndob = 1979-05-27T07:32:00Z'}
      sample={
        '# Cargo-style example\ntitle = "TOML Demo"\nversion = "1.0.0"\nactive = true\nport = 8080\nratio = 3.14\n\n[database]\nserver = "192.168.1.1"\nports = [8000, 8001, 8002]\nlimits = { max = 100, min = 0 }\n\n[[servers]]\nname = "alpha"\nip = "10.0.0.1"\n\n[[servers]]\nname = "beta"\nip = "10.0.0.2"\n'
      }
      downloadName="config.json"
      downloadMime="application/json"
      options={
        <Field label="Output">
          <Tabs
            value={indent}
            onValueChange={(v) => setIndent(v as '2' | '4' | 'tab' | 'min')}
          >
            <TabsList>
              <TabsTrigger value="2">2 spaces</TabsTrigger>
              <TabsTrigger value="4">4 spaces</TabsTrigger>
              <TabsTrigger value="tab">Tab</TabsTrigger>
              <TabsTrigger value="min">Minify</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
