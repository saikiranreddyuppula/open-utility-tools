'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

const SAMPLE = `# Example TOML
title = "TOML Example"
enabled = true
pi = 3.14159

[owner]
name = "Tom Preston-Werner"
dob = 1979-05-27T07:32:00Z

[database]
ports = [ 8001, 8001, 8002 ]
data = [ ["delta", "phi"], [3.14] ]

[[servers]]
ip = "10.0.0.1"
role = "frontend"

[[servers]]
ip = "10.0.0.2"
role = "backend"
`;

type TomlValue = string | number | boolean | TomlValue[] | { [k: string]: TomlValue };

interface TomlMarked {
  value: TomlValue;
  isDate?: boolean;
}

// ---- TOML parsing ----

function stripComment(line: string): string {
  let inStr: '"' | "'" | null = null;
  let result = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] ?? '';
    if (inStr) {
      if (ch === inStr && line[i - 1] !== '\\') inStr = null;
      result += ch;
    } else if (ch === '"' || ch === "'") {
      inStr = ch;
      result += ch;
    } else if (ch === '#') {
      break;
    } else {
      result += ch;
    }
  }
  return result;
}

const DATE_RE =
  /^\d{4}-\d{2}-\d{2}([Tt ]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})?)?$/;

function parseScalar(raw: string): TomlMarked {
  const s = raw.trim();
  if (s === '') throw new Error('Empty value.');

  // Basic string
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    const inner = s.slice(1, -1);
    const unescaped = inner
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
    return { value: unescaped };
  }
  // Literal string
  if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) {
    return { value: s.slice(1, -1) };
  }
  // Boolean
  if (s === 'true') return { value: true };
  if (s === 'false') return { value: false };
  // Datetime
  if (DATE_RE.test(s)) return { value: s, isDate: true };
  // Integer (allow underscores, hex, octal, binary)
  if (/^[+-]?(0x[0-9a-fA-F_]+|0o[0-7_]+|0b[01_]+|\d[\d_]*)$/.test(s)) {
    const cleaned = s.replace(/_/g, '');
    let n: number;
    if (/^[+-]?0x/i.test(cleaned)) n = parseInt(cleaned, 16);
    else if (/^[+-]?0o/i.test(cleaned)) n = parseInt(cleaned.replace(/0o/i, ''), 8);
    else if (/^[+-]?0b/i.test(cleaned)) n = parseInt(cleaned.replace(/0b/i, ''), 2);
    else n = parseInt(cleaned, 10);
    if (Number.isFinite(n)) return { value: n };
  }
  // Float
  if (/^[+-]?(\d[\d_]*\.?[\d_]*([eE][+-]?\d+)?|\.\d+([eE][+-]?\d+)?)$/.test(s)) {
    const n = Number(s.replace(/_/g, ''));
    if (Number.isFinite(n)) return { value: n };
  }
  if (s === 'inf' || s === '+inf') return { value: Infinity };
  if (s === '-inf') return { value: -Infinity };
  if (s === 'nan' || s === '+nan' || s === '-nan') return { value: NaN };

  // Array
  if (s.startsWith('[') && s.endsWith(']')) {
    return { value: parseArray(s) };
  }
  // Inline table
  if (s.startsWith('{') && s.endsWith('}')) {
    return { value: parseInlineTable(s) };
  }
  throw new Error(`Could not parse value: ${s}`);
}

/** Split a bracketed/braced body on top-level commas, respecting strings and nesting. */
function splitTopLevel(body: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let inStr: '"' | "'" | null = null;
  let cur = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i] ?? '';
    if (inStr) {
      if (ch === inStr && body[i - 1] !== '\\') inStr = null;
      cur += ch;
    } else if (ch === '"' || ch === "'") {
      inStr = ch;
      cur += ch;
    } else if (ch === '[' || ch === '{') {
      depth++;
      cur += ch;
    } else if (ch === ']' || ch === '}') {
      depth--;
      cur += ch;
    } else if (ch === ',' && depth === 0) {
      items.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim() !== '') items.push(cur);
  return items;
}

function parseArray(s: string): TomlValue[] {
  const body = s.slice(1, -1).trim();
  if (body === '') return [];
  return splitTopLevel(body).map((item) => parseScalar(item.trim()).value);
}

function parseInlineTable(s: string): { [k: string]: TomlValue } {
  const body = s.slice(1, -1).trim();
  const obj: { [k: string]: TomlValue } = {};
  if (body === '') return obj;
  for (const pair of splitTopLevel(body)) {
    const eq = findEquals(pair);
    if (eq < 0) throw new Error(`Invalid inline table entry: ${pair}`);
    const key = parseKey(pair.slice(0, eq).trim());
    const val = parseScalar(pair.slice(eq + 1).trim()).value;
    setNested(obj, key, val);
  }
  return obj;
}

function findEquals(line: string): number {
  let inStr: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] ?? '';
    if (inStr) {
      if (ch === inStr && line[i - 1] !== '\\') inStr = null;
    } else if (ch === '"' || ch === "'") {
      inStr = ch;
    } else if (ch === '=') {
      return i;
    }
  }
  return -1;
}

/** Parse a possibly dotted/quoted key into a path of segments. */
function parseKey(raw: string): string[] {
  const segs: string[] = [];
  let cur = '';
  let inStr: '"' | "'" | null = null;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i] ?? '';
    if (inStr) {
      if (ch === inStr) inStr = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      inStr = ch;
    } else if (ch === '.') {
      segs.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim() !== '' || segs.length === 0) segs.push(cur.trim());
  return segs.filter((s) => s !== '');
}

function setNested(obj: { [k: string]: TomlValue }, path: string[], value: TomlValue): void {
  let node = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i] ?? '';
    const existing = node[key];
    if (existing === undefined) {
      const next: { [k: string]: TomlValue } = {};
      node[key] = next;
      node = next;
    } else if (typeof existing === 'object' && existing !== null && !Array.isArray(existing)) {
      node = existing as { [k: string]: TomlValue };
    } else {
      throw new Error(`Key path conflict at "${key}".`);
    }
  }
  const last = path[path.length - 1] ?? '';
  node[last] = value;
}

function getTableContainer(
  root: { [k: string]: TomlValue },
  path: string[],
  isArrayTable: boolean
): { [k: string]: TomlValue } {
  let node = root;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i] ?? '';
    let existing = node[key];
    if (existing === undefined) {
      const next: { [k: string]: TomlValue } = {};
      node[key] = next;
      existing = next;
    }
    if (Array.isArray(existing)) {
      const lastEl = existing[existing.length - 1];
      if (typeof lastEl === 'object' && lastEl !== null && !Array.isArray(lastEl)) {
        node = lastEl as { [k: string]: TomlValue };
      } else {
        throw new Error(`Path conflict at "${key}".`);
      }
    } else if (typeof existing === 'object' && existing !== null) {
      node = existing as { [k: string]: TomlValue };
    } else {
      throw new Error(`Path conflict at "${key}".`);
    }
  }

  const last = path[path.length - 1] ?? '';
  if (isArrayTable) {
    let arr = node[last];
    if (arr === undefined) {
      arr = [];
      node[last] = arr;
    }
    if (!Array.isArray(arr)) throw new Error(`"${last}" is not an array of tables.`);
    const entry: { [k: string]: TomlValue } = {};
    arr.push(entry);
    return entry;
  }
  let tbl = node[last];
  if (tbl === undefined) {
    tbl = {};
    node[last] = tbl;
  }
  if (typeof tbl !== 'object' || tbl === null || Array.isArray(tbl)) {
    throw new Error(`"${last}" is already defined as a non-table.`);
  }
  return tbl as { [k: string]: TomlValue };
}

function parseToml(text: string): { [k: string]: TomlValue } {
  const root: { [k: string]: TomlValue } = {};
  let current = root;

  // Pre-join multi-line arrays/inline tables into single logical lines.
  const rawLines = text.split('\n');
  const logical: string[] = [];
  let buffer = '';
  let openDepth = 0;
  for (const rl of rawLines) {
    const cleaned = stripComment(rl);
    const combined = buffer === '' ? cleaned : buffer + ' ' + cleaned.trim();
    // Count bracket/brace depth ignoring strings.
    let inStr: '"' | "'" | null = null;
    let depth = 0;
    for (let i = 0; i < combined.length; i++) {
      const ch = combined[i] ?? '';
      if (inStr) {
        if (ch === inStr && combined[i - 1] !== '\\') inStr = null;
      } else if (ch === '"' || ch === "'") inStr = ch;
      else if (ch === '[' || ch === '{') depth++;
      else if (ch === ']' || ch === '}') depth--;
    }
    openDepth = depth;
    if (openDepth > 0) {
      buffer = combined;
    } else {
      logical.push(combined);
      buffer = '';
    }
  }
  if (buffer.trim() !== '') logical.push(buffer);

  for (const line of logical) {
    const trimmed = line.trim();
    if (trimmed === '') continue;

    // Array of tables: [[a.b]]
    if (trimmed.startsWith('[[') && trimmed.endsWith(']]')) {
      const path = parseKey(trimmed.slice(2, -2).trim());
      current = getTableContainer(root, path, true);
      continue;
    }
    // Table: [a.b]
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const path = parseKey(trimmed.slice(1, -1).trim());
      current = getTableContainer(root, path, false);
      continue;
    }
    // Key = value
    const eq = findEquals(trimmed);
    if (eq < 0) throw new Error(`Invalid line (no '='): ${trimmed}`);
    const keyPath = parseKey(trimmed.slice(0, eq).trim());
    const valStr = trimmed.slice(eq + 1).trim();
    if (valStr === '') throw new Error(`Missing value for key: ${keyPath.join('.')}`);
    const parsed = parseScalar(valStr);
    setNested(current, keyPath, parsed.value);
  }
  return root;
}

// ---- YAML serialization ----

function needsQuote(s: string): boolean {
  if (s === '') return true;
  if (/^[\s]|[\s]$/.test(s)) return true;
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(s)) return true;
  if (/[:#]/.test(s) && /[\s]/.test(s)) return true;
  if (/:\s/.test(s) || s.endsWith(':')) return true;
  if (/\s#/.test(s)) return true;
  if (/^(true|false|null|yes|no|on|off|~)$/i.test(s)) return true;
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return true;
  if (/[\n\t]/.test(s)) return true;
  return false;
}

function quoteString(s: string): string {
  if (/[\n\t\\"]/.test(s)) {
    const esc = s
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t');
    return `"${esc}"`;
  }
  return `'${s.replace(/'/g, "''")}'`;
}

function scalarToYaml(v: TomlValue): string {
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) {
      if (Number.isNaN(v)) return '.nan';
      return v > 0 ? '.inf' : '-.inf';
    }
    return String(v);
  }
  if (typeof v === 'string') {
    return needsQuote(v) ? quoteString(v) : v;
  }
  // Arrays/objects are handled by the structural dumper; stringify defensively.
  return JSON.stringify(v);
}

function isEmptyArray(v: TomlValue): boolean {
  return Array.isArray(v) && v.length === 0;
}

function isPlainObject(v: TomlValue): v is { [k: string]: TomlValue } {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isScalar(v: TomlValue): boolean {
  return !Array.isArray(v) && !isPlainObject(v);
}

interface YamlOptions {
  indent: number;
  flowShortArrays: boolean;
  sortKeys: boolean;
}

function flowArray(arr: TomlValue[]): string {
  return `[${arr.map((x) => scalarToYaml(x)).join(', ')}]`;
}

function dumpYaml(value: TomlValue, indentLevel: number, opts: YamlOptions): string {
  const pad = ' '.repeat(indentLevel * opts.indent);

  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) return `${pad}{}\n`;
    const ordered = opts.sortKeys ? [...keys].sort() : keys;
    let out = '';
    for (const key of ordered) {
      const child = value[key];
      if (child === undefined) continue;
      const keyStr = needsQuote(key) ? quoteString(key) : key;
      if (isScalar(child) || isEmptyArray(child)) {
        out += `${pad}${keyStr}: ${isEmptyArray(child) ? '[]' : scalarToYaml(child)}\n`;
      } else if (Array.isArray(child)) {
        if (opts.flowShortArrays && child.every(isScalar) && child.length <= 6) {
          out += `${pad}${keyStr}: ${flowArray(child)}\n`;
        } else {
          out += `${pad}${keyStr}:\n${dumpYaml(child, indentLevel, opts)}`;
        }
      } else {
        out += `${pad}${keyStr}:\n${dumpYaml(child, indentLevel + 1, opts)}`;
      }
    }
    return out;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}[]\n`;
    let out = '';
    for (const item of value) {
      if (isScalar(item) || isEmptyArray(item)) {
        out += `${pad}- ${isEmptyArray(item) ? '[]' : scalarToYaml(item)}\n`;
      } else if (Array.isArray(item)) {
        if (opts.flowShortArrays && item.every(isScalar) && item.length <= 6) {
          out += `${pad}- ${flowArray(item)}\n`;
        } else {
          out += `${pad}-\n${dumpYaml(item, indentLevel + 1, opts)}`;
        }
      } else {
        // object inside list: inline the first line after the dash
        const rendered = dumpYaml(item, indentLevel + 1, opts);
        const lines = rendered.split('\n');
        const firstNonEmpty = lines.findIndex((l) => l.trim() !== '');
        if (firstNonEmpty >= 0) {
          const first = lines[firstNonEmpty] ?? '';
          out += `${pad}- ${first.trimStart()}\n`;
          for (let i = firstNonEmpty + 1; i < lines.length; i++) {
            const l = lines[i] ?? '';
            if (l.trim() === '') continue;
            out += `${l}\n`;
          }
        } else {
          out += `${pad}- {}\n`;
        }
      }
    }
    return out;
  }

  return `${pad}${scalarToYaml(value)}\n`;
}

export default function TomlToYamlTool() {
  const [indent, setIndent] = useState(2);
  const [flowShortArrays, setFlowShortArrays] = useState(true);
  const [sortKeys, setSortKeys] = useState(false);

  return (
    <TextToolLayout
      deps={[indent, flowShortArrays, sortKeys]}
      transform={(input) => {
        if (!input.trim()) return '';
        let obj: { [k: string]: TomlValue };
        try {
          obj = parseToml(input);
        } catch (e) {
          throw new Error(`TOML parse error: ${e instanceof Error ? e.message : String(e)}`);
        }
        const yaml = dumpYaml(obj, 0, { indent, flowShortArrays, sortKeys });
        return yaml.replace(/\n+$/, '\n');
      }}
      inputLabel="TOML"
      outputLabel="YAML"
      inputPlaceholder="Paste TOML configuration…"
      sample={SAMPLE}
      downloadName="output.yaml"
      downloadMime="text/yaml"
      options={
        <>
          <Field label={`Indent: ${indent}`} hint="Spaces" className="min-w-[10rem]">
            <Slider
              min={2}
              max={8}
              step={1}
              value={[indent]}
              onValueChange={(v) => setIndent(v[0] ?? 2)}
            />
          </Field>
          <Field label="Flow short arrays" hint="[a, b] on one line">
            <Switch checked={flowShortArrays} onCheckedChange={setFlowShortArrays} />
          </Field>
          <Field label="Sort keys" hint="Alphabetical">
            <Switch checked={sortKeys} onCheckedChange={setSortKeys} />
          </Field>
        </>
      }
    />
  );
}
