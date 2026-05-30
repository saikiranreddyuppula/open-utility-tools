'use client';

import { TextToolLayout } from '@/components/tools/text-tool';

const SAMPLE = `defaults: &defaults
  adapter: postgres
  host: localhost
  pool: 5

development:
  <<: *defaults
  database: dev_db

production:
  <<: *defaults
  database: prod_db
  host: db.prod.internal

ports: &ports
  - 80
  - 443

web:
  expose: *ports`;

type YamlValue =
  | string
  | number
  | boolean
  | null
  | YamlValue[]
  | { [k: string]: YamlValue };

interface Line {
  indent: number;
  content: string;
  raw: string;
  no: number;
}

const anchors: Map<string, YamlValue> = new Map();

function clone(v: YamlValue): YamlValue {
  if (Array.isArray(v)) return v.map(clone);
  if (v !== null && typeof v === 'object') {
    const out: { [k: string]: YamlValue } = {};
    for (const k of Object.keys(v)) out[k] = clone(v[k] as YamlValue);
    return out;
  }
  return v;
}

/** Tokenize a quoted scalar, returning the unquoted string. */
function unquote(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && t[0] === '"' && t[t.length - 1] === '"') {
    const inner = t.slice(1, -1);
    return inner
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
  if (t.length >= 2 && t[0] === "'" && t[t.length - 1] === "'") {
    return t.slice(1, -1).replace(/''/g, "'");
  }
  return t;
}

function parseScalar(s: string): YamlValue {
  const t = s.trim();
  if (t === '' || t === '~' || t.toLowerCase() === 'null') return null;
  if (t === 'true' || t === 'True' || t === 'TRUE') return true;
  if (t === 'false' || t === 'False' || t === 'FALSE') return false;
  if (t[0] === '"' || t[0] === "'") return unquote(t);
  if (/^[-+]?\d+$/.test(t)) {
    const n = Number(t);
    if (Number.isSafeInteger(n)) return n;
  }
  if (/^[-+]?(\d+\.\d*|\.\d+|\d+)([eE][-+]?\d+)?$/.test(t)) {
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  return t;
}

/** Parse a flow collection like [1, 2, 3] or {a: 1, b: 2}. */
function parseFlow(s: string): YamlValue {
  const t = s.trim();
  if (t.startsWith('[') && t.endsWith(']')) {
    const inner = t.slice(1, -1).trim();
    if (inner === '') return [];
    return splitFlow(inner).map((part) => parseValueInline(part));
  }
  if (t.startsWith('{') && t.endsWith('}')) {
    const inner = t.slice(1, -1).trim();
    const obj: { [k: string]: YamlValue } = {};
    if (inner === '') return obj;
    for (const part of splitFlow(inner)) {
      const ci = findColon(part);
      if (ci === -1) {
        obj[part.trim()] = null;
      } else {
        const key = unquote(part.slice(0, ci).trim());
        obj[key] = parseValueInline(part.slice(ci + 1).trim());
      }
    }
    return obj;
  }
  return parseScalar(t);
}

/** Split a flow body on top-level commas (respecting brackets and quotes). */
function splitFlow(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let buf = '';
  let quote = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i] ?? '';
    if (quote) {
      buf += ch;
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim() !== '' || parts.length > 0) parts.push(buf);
  return parts;
}

/** Find the first top-level ': ' or trailing ':' colon in a flow-map entry. */
function findColon(s: string): number {
  let depth = 0;
  let quote = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i] ?? '';
    if (quote) {
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') depth--;
    else if (ch === ':' && depth === 0) {
      const next = s[i + 1];
      if (next === undefined || next === ' ') return i;
    }
  }
  return -1;
}

/** Parse an inline value that may carry an anchor/alias and flow/scalar. */
function parseValueInline(s: string): YamlValue {
  let t = s.trim();
  if (t === '') return null;
  if (t[0] === '*') {
    const name = t.slice(1).trim();
    const v = anchors.get(name);
    if (v === undefined) throw new Error(`Unknown alias *${name}`);
    return clone(v);
  }
  let anchorName = '';
  if (t[0] === '&') {
    const sp = t.search(/\s/);
    if (sp === -1) {
      anchorName = t.slice(1);
      t = '';
    } else {
      anchorName = t.slice(1, sp);
      t = t.slice(sp + 1).trim();
    }
  }
  let value: YamlValue;
  if (t === '') value = null;
  else if (t[0] === '[' || t[0] === '{') value = parseFlow(t);
  else value = parseScalar(t);
  if (anchorName) anchors.set(anchorName, value);
  return value;
}

function tokenize(text: string): Line[] {
  const out: Line[] = [];
  const rows = text.split(/\r?\n/);
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i] ?? '';
    // Strip full-line comments and trailing comments (outside quotes, simple).
    const trimmedStart = raw.replace(/^\s+/, '');
    if (trimmedStart === '' || trimmedStart.startsWith('#')) continue;
    if (trimmedStart === '---' || trimmedStart === '...') continue;
    const indent = raw.length - trimmedStart.length;
    out.push({ indent, content: stripComment(trimmedStart), raw, no: i + 1 });
  }
  return out;
}

function stripComment(s: string): string {
  let quote = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i] ?? '';
    if (quote) {
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '#' && (i === 0 || s[i - 1] === ' ')) {
      return s.slice(0, i).trimEnd();
    }
  }
  return s.trimEnd();
}

interface Parser {
  lines: Line[];
  pos: number;
}

function parseBlock(p: Parser, minIndent: number): YamlValue {
  const first = p.lines[p.pos];
  if (!first || first.indent < minIndent) return null;
  if (first.content.startsWith('- ') || first.content === '-') {
    return parseSeq(p, first.indent);
  }
  return parseMap(p, first.indent);
}

function parseSeq(p: Parser, indent: number): YamlValue[] {
  const arr: YamlValue[] = [];
  while (p.pos < p.lines.length) {
    const line = p.lines[p.pos];
    if (!line || line.indent < indent) break;
    if (line.indent > indent) break;
    if (!(line.content.startsWith('- ') || line.content === '-')) break;
    const rest = line.content === '-' ? '' : line.content.slice(2).trim();
    if (rest === '') {
      p.pos++;
      arr.push(parseBlock(p, indent + 1));
    } else if (
      rest[0] !== '[' &&
      rest[0] !== '{' &&
      rest[0] !== '*' &&
      findColon(rest) !== -1
    ) {
      // Inline map starting on the dash line: "- key: value"
      arr.push(parseInlineSeqMap(p, line.indent + 2));
    } else {
      p.pos++;
      arr.push(parseValueInline(rest));
    }
  }
  return arr;
}

/** Handle "- key: val" sequences where the map shares the dash line. */
function parseInlineSeqMap(p: Parser, childIndent: number): YamlValue {
  const obj: { [k: string]: YamlValue } = {};
  let firstHandled = false;
  while (p.pos < p.lines.length) {
    const line = p.lines[p.pos];
    if (!line) break;
    let content: string;
    let effIndent: number;
    if (!firstHandled) {
      content = line.content.slice(2).trim();
      effIndent = childIndent;
      firstHandled = true;
    } else {
      if (line.indent !== childIndent) break;
      if (line.content.startsWith('- ') || line.content === '-') break;
      content = line.content;
      effIndent = childIndent;
    }
    applyMapEntry(p, obj, content, effIndent);
  }
  return obj;
}

function parseMap(p: Parser, indent: number): YamlValue {
  const obj: { [k: string]: YamlValue } = {};
  while (p.pos < p.lines.length) {
    const line = p.lines[p.pos];
    if (!line || line.indent !== indent) break;
    if (line.content.startsWith('- ') || line.content === '-') break;
    applyMapEntry(p, obj, line.content, indent);
  }
  return obj;
}

function applyMapEntry(
  p: Parser,
  obj: { [k: string]: YamlValue },
  content: string,
  indent: number,
): void {
  const ci = findColon(content);
  if (ci === -1) {
    // Not a key:value; treat as malformed — advance to avoid infinite loop.
    p.pos++;
    throw new Error(`Expected "key: value" but got: ${content}`);
  }
  const rawKey = content.slice(0, ci).trim();
  const after = content.slice(ci + 1).trim();
  p.pos++;

  const isMerge = rawKey === '<<';

  // Detect "key:" or "key: &anchor" with the real value on following indented lines.
  const bareAnchor = after.startsWith('&') && /^&\S+$/.test(after);
  const next = p.lines[p.pos];
  const hasNestedBlock = next !== undefined && next.indent > indent;

  let value: YamlValue;
  if (after === '' || (bareAnchor && hasNestedBlock)) {
    const anchorName = bareAnchor ? after.slice(1) : '';
    value = parseBlock(p, indent + 1);
    if (anchorName) anchors.set(anchorName, value);
  } else {
    value = parseValueInline(after);
  }

  if (isMerge) {
    const merges: YamlValue[] = Array.isArray(value) ? value : [value];
    for (const m of merges) {
      if (m !== null && typeof m === 'object' && !Array.isArray(m)) {
        for (const k of Object.keys(m)) {
          if (!(k in obj)) obj[k] = m[k] as YamlValue;
        }
      }
    }
    return;
  }

  const key = unquote(rawKey);
  obj[key] = value;
}

function parseYaml(text: string): YamlValue {
  anchors.clear();
  const lines = tokenize(text);
  if (lines.length === 0) return null;
  const p: Parser = { lines, pos: 0 };
  const result = parseBlock(p, lines[0]?.indent ?? 0);
  return result;
}

function needsQuote(s: string): boolean {
  if (s === '') return true;
  // Words that would otherwise parse as a non-string type.
  if (/^(true|false|null|~|yes|no|on|off)$/i.test(s)) return true;
  if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return true;
  // Leading/trailing whitespace, or a newline, must be quoted.
  if (s !== s.trim()) return true;
  if (s.includes('\n')) return true;
  // Indicator characters that are unsafe at the start of a plain scalar.
  if (/^[#&*!|>%@`?:[\]{},'"-]/.test(s)) return true;
  // A colon followed by space, or a space followed by #, is ambiguous inline.
  if (s.includes(': ') || s.includes(' #') || s.endsWith(':')) return true;
  return false;
}

function quoteStr(s: string): string {
  if (s.includes('\n') || s.includes('"') || s.includes('\\')) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
  }
  return `'${s.replace(/'/g, "''")}'`;
}

function serializeScalar(v: YamlValue): string {
  if (v === null) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  const s = String(v);
  return needsQuote(s) ? quoteStr(s) : s;
}

function isEmptyCollection(v: YamlValue): boolean {
  if (Array.isArray(v)) return v.length === 0;
  if (v !== null && typeof v === 'object') return Object.keys(v).length === 0;
  return false;
}

function serialize(v: YamlValue, indent: number): string {
  const pad = '  '.repeat(indent);
  if (Array.isArray(v)) {
    if (v.length === 0) return `${pad}[]`;
    const out: string[] = [];
    for (const item of v) {
      if (item !== null && typeof item === 'object' && !isEmptyCollection(item)) {
        const block = serialize(item, indent + 1);
        const lines = block.split('\n');
        const first = (lines[0] ?? '').slice((indent + 1) * 2);
        out.push(`${pad}- ${first}`);
        for (let i = 1; i < lines.length; i++) out.push(lines[i] ?? '');
      } else {
        out.push(`${pad}- ${serializeScalar(item)}`);
      }
    }
    return out.join('\n');
  }
  if (v !== null && typeof v === 'object') {
    const keys = Object.keys(v);
    if (keys.length === 0) return `${pad}{}`;
    const out: string[] = [];
    for (const k of keys) {
      const child = v[k] as YamlValue;
      const keyStr = needsQuote(k) ? quoteStr(k) : k;
      if (child !== null && typeof child === 'object' && !isEmptyCollection(child)) {
        out.push(`${pad}${keyStr}:`);
        out.push(serialize(child, indent + 1));
      } else {
        out.push(`${pad}${keyStr}: ${serializeScalar(child)}`);
      }
    }
    return out.join('\n');
  }
  return `${pad}${serializeScalar(v)}`;
}

export default function YamlAnchorExpanderTool() {
  return (
    <TextToolLayout
      sample={SAMPLE}
      inputLabel="YAML with anchors"
      outputLabel="Expanded YAML"
      downloadName="expanded.yaml"
      downloadMime="text/yaml"
      transform={(input) => {
        if (!input.trim()) return '';
        const parsed = parseYaml(input);
        if (parsed === null) return '';
        const out = serialize(parsed, 0);
        return out;
      }}
    />
  );
}
