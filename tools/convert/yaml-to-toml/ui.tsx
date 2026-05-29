'use client';

import { useCallback } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

/* ------------------------------------------------------------------ *
 *  Minimal YAML parser (indentation-based maps, lists, scalars).      *
 * ------------------------------------------------------------------ */

interface Line {
  indent: number;
  content: string;
}

function tokenize(src: string): Line[] {
  const out: Line[] = [];
  for (const raw of src.split(/\r?\n/)) {
    // Strip full-line comments and document markers.
    if (/^\s*#/.test(raw)) continue;
    if (/^\s*---\s*$/.test(raw) || /^\s*\.\.\.\s*$/.test(raw)) continue;
    if (raw.trim() === '') continue;
    const indent = raw.length - raw.replace(/^ +/, '').length;
    out.push({ indent, content: raw.slice(indent) });
  }
  return out;
}

function stripInlineComment(s: string): string {
  let inStr: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i] ?? '';
    if (inStr) {
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'") inStr = c;
    else if (c === '#' && (i === 0 || s[i - 1] === ' ')) return s.slice(0, i);
  }
  return s;
}

function parseScalar(raw: string): Json {
  let v = stripInlineComment(raw).trim();
  if (v === '') return null;
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    const inner = v.slice(1, -1);
    return v[0] === '"' ? inner.replace(/\\"/g, '"').replace(/\\n/g, '\n') : inner;
  }
  if (v.startsWith('[') || v.startsWith('{')) return parseFlow(v);
  if (v === 'null' || v === '~') return null;
  if (v === 'true' || v === 'True') return true;
  if (v === 'false' || v === 'False') return false;
  if (/^[+-]?\d+$/.test(v)) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(v)) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return v;
}

/** Parse a YAML/JSON flow collection like [1, 2] or {a: 1}. */
function parseFlow(v: string): Json {
  const open = v[0];
  const body = v.slice(1, v.lastIndexOf(open === '[' ? ']' : '}'));
  const parts = splitFlow(body);
  if (open === '[') {
    return parts.map((p) => parseScalar(p.trim()));
  }
  const obj: { [k: string]: Json } = {};
  for (const p of parts) {
    const idx = p.indexOf(':');
    if (idx < 0) continue;
    const key = parseScalar(p.slice(0, idx).trim());
    obj[String(key)] = parseScalar(p.slice(idx + 1).trim());
  }
  return obj;
}

function splitFlow(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  let inStr: string | null = null;
  for (let i = 0; i < body.length; i++) {
    const c = body[i] ?? '';
    if (inStr) {
      cur += c;
      if (c === inStr) inStr = null;
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

/** Recursive descent over indentation-grouped lines. */
function parseBlock(lines: Line[], start: number, indent: number): [Json, number] {
  let i = start;
  const first = lines[i];
  if (!first) return [null, i];

  const isList = first.content.startsWith('- ') || first.content === '-';

  if (isList) {
    const arr: Json[] = [];
    while (i < lines.length) {
      const line = lines[i];
      if (!line || line.indent < indent) break;
      if (line.indent > indent) break;
      if (!(line.content.startsWith('- ') || line.content === '-')) break;
      const rest = line.content === '-' ? '' : line.content.slice(2);
      i++;
      if (rest.trim() === '') {
        // Nested block belonging to this list item.
        const [val, next] = parseBlock(lines, i, indent + 1);
        arr.push(val);
        i = next;
      } else if (/^[^:\s][^:]*:(\s|$)/.test(rest) || rest.includes(': ')) {
        // Inline "- key: value" — treat the rest as a one-line map start.
        const childIndent = line.indent + 2;
        const synthetic: Line[] = [{ indent: childIndent, content: rest }];
        // Pull following more-indented lines into this map.
        const collected: Line[] = [...synthetic];
        while (i < lines.length) {
          const nxt = lines[i];
          if (!nxt || nxt.indent <= line.indent) break;
          collected.push(nxt);
          i++;
        }
        const [val] = parseBlock(collected, 0, childIndent);
        arr.push(val);
      } else {
        arr.push(parseScalar(rest));
      }
    }
    return [arr, i];
  }

  // Mapping.
  const obj: { [k: string]: Json } = {};
  while (i < lines.length) {
    const line = lines[i];
    if (!line || line.indent < indent) break;
    if (line.indent > indent) break;
    if (line.content.startsWith('- ')) break;

    const colon = findColon(line.content);
    if (colon < 0) {
      i++;
      continue;
    }
    const key = parseScalar(line.content.slice(0, colon).trim());
    const after = line.content.slice(colon + 1);
    const valuePart = stripInlineComment(after).trim();
    i++;

    if (valuePart === '' || valuePart === '|' || valuePart === '>') {
      // Look ahead for a nested block.
      const nextLine = lines[i];
      if (nextLine && nextLine.indent > indent) {
        const [val, next] = parseBlock(lines, i, nextLine.indent);
        obj[String(key)] = val;
        i = next;
      } else {
        obj[String(key)] = null;
      }
    } else {
      obj[String(key)] = parseScalar(valuePart);
    }
  }
  return [obj, i];
}

function findColon(s: string): number {
  let inStr: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i] ?? '';
    if (inStr) {
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'") inStr = c;
    else if (c === ':' && (i + 1 >= s.length || s[i + 1] === ' ')) return i;
  }
  return -1;
}

function parseYaml(src: string): Json {
  const lines = tokenize(src);
  if (lines.length === 0) return {};
  const baseIndent = lines[0]?.indent ?? 0;
  const [val] = parseBlock(lines, 0, baseIndent);
  return val;
}

/* ------------------------------------------------------------------ *
 *  TOML serializer.                                                   *
 * ------------------------------------------------------------------ */

function isPlainObject(v: Json): v is { [k: string]: Json } {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isArrayOfTables(v: Json): v is { [k: string]: Json }[] {
  return Array.isArray(v) && v.length > 0 && v.every((e) => isPlainObject(e));
}

function quoteKey(key: string): string {
  return /^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key);
}

function formatScalar(v: Json): string {
  if (v === null) return '""';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return v > 0 ? 'inf' : Number.isNaN(v) ? 'nan' : '-inf';
    return String(v);
  }
  // Datetime-like strings are emitted bare (valid TOML).
  if (
    typeof v === 'string' &&
    /^\d{4}-\d{2}-\d{2}([Tt ]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})?)?$/.test(v)
  ) {
    return v;
  }
  return JSON.stringify(v);
}

function formatInlineArray(arr: Json[]): string {
  const parts = arr.map((el) => {
    if (isPlainObject(el)) return formatInlineTable(el);
    if (Array.isArray(el)) return formatInlineArray(el);
    return formatScalar(el);
  });
  return `[${parts.join(', ')}]`;
}

function formatInlineTable(obj: { [k: string]: Json }): string {
  const parts = Object.entries(obj).map(([k, val]) => {
    let rendered: string;
    if (isPlainObject(val)) rendered = formatInlineTable(val);
    else if (Array.isArray(val)) rendered = formatInlineArray(val);
    else rendered = formatScalar(val);
    return `${quoteKey(k)} = ${rendered}`;
  });
  return `{ ${parts.join(', ')} }`;
}

function serializeTable(obj: { [k: string]: Json }, prefix: string[]): string {
  const scalarLines: string[] = [];
  const tableBlocks: string[] = [];

  for (const [key, val] of Object.entries(obj)) {
    const path = [...prefix, key];
    const header = path.map(quoteKey).join('.');

    if (isPlainObject(val)) {
      const inner = serializeTable(val, path);
      tableBlocks.push(`[${header}]\n${inner}`.replace(/\n+$/, '') + '\n');
    } else if (isArrayOfTables(val)) {
      for (const entry of val) {
        const inner = serializeTable(entry, path);
        tableBlocks.push(`[[${header}]]\n${inner}`.replace(/\n+$/, '') + '\n');
      }
    } else if (Array.isArray(val)) {
      scalarLines.push(`${quoteKey(key)} = ${formatInlineArray(val)}`);
    } else {
      scalarLines.push(`${quoteKey(key)} = ${formatScalar(val)}`);
    }
  }

  const scalarBlock = scalarLines.length ? scalarLines.join('\n') + '\n' : '';
  return scalarBlock + (tableBlocks.length ? '\n' + tableBlocks.join('\n') : '');
}

function toToml(data: Json): string {
  if (!isPlainObject(data)) {
    throw new Error('Top-level YAML must be a mapping to convert to TOML.');
  }
  return serializeTable(data, []).replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export default function YamlToTomlTool() {
  const transform = useCallback((input: string) => {
    if (!input.trim()) return '';
    let data: Json;
    try {
      data = parseYaml(input);
    } catch (err) {
      throw new Error(`YAML parse error: ${(err as Error).message}`);
    }
    return toToml(data);
  }, []);

  return (
    <TextToolLayout
      transform={transform}
      inputLabel="YAML"
      outputLabel="TOML"
      inputPlaceholder={'title: Example\nowner:\n  name: Tom\n  age: 42'}
      sample={
        'title: TOML Demo\nversion: 1.0.0\nactive: true\nport: 8080\n\ndatabase:\n  server: 192.168.1.1\n  ports: [8000, 8001, 8002]\n\nservers:\n  - name: alpha\n    ip: 10.0.0.1\n  - name: beta\n    ip: 10.0.0.2\n'
      }
      downloadName="config.toml"
      downloadMime="text/plain"
    />
  );
}
