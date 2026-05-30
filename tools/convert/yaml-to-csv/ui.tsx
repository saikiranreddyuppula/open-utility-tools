'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SAMPLE = `- name: Ada Lovelace
  age: 36
  role: Mathematician
  tags:
    - pioneer
    - analyst
- name: Alan Turing
  age: 41
  role: Computer Scientist
  active: true
`;

type YamlValue = string | number | boolean | null | YamlValue[] | { [k: string]: YamlValue };

// ---- Minimal YAML parser (block style: maps, sequences, scalars, flow seq/map) ----

interface Line {
  indent: number;
  content: string;
}

function tokenize(text: string): Line[] {
  const out: Line[] = [];
  for (const raw of text.split('\n')) {
    // Strip full-line comments and trailing comments (best-effort, ignore inside quotes).
    let line = raw.replace(/\t/g, '  ');
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    // Remove trailing comment not inside quotes.
    let inStr: '"' | "'" | null = null;
    let cut = -1;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i] ?? '';
      if (inStr) {
        if (ch === inStr) inStr = null;
      } else if (ch === '"' || ch === "'") {
        inStr = ch;
      } else if (ch === '#' && (i === 0 || line[i - 1] === ' ')) {
        cut = i;
        break;
      }
    }
    if (cut >= 0) line = line.slice(0, cut);
    if (line.trim() === '') continue;
    const indent = line.length - line.trimStart().length;
    out.push({ indent, content: line.trim() });
  }
  return out;
}

function parseScalar(raw: string): YamlValue {
  const s = raw.trim();
  if (s === '' || s === '~' || s.toLowerCase() === 'null') return null;
  if (s === 'true' || s === 'True' || s === 'TRUE') return true;
  if (s === 'false' || s === 'False' || s === 'FALSE') return false;
  if (
    (s.startsWith('"') && s.endsWith('"') && s.length >= 2) ||
    (s.startsWith("'") && s.endsWith("'") && s.length >= 2)
  ) {
    const inner = s.slice(1, -1);
    if (s.startsWith('"')) {
      return inner.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
    return inner.replace(/''/g, "'");
  }
  if (s.startsWith('[') || s.startsWith('{')) return parseFlow(s);
  if (/^[+-]?\d+$/.test(s)) {
    const n = parseInt(s, 10);
    if (Number.isSafeInteger(n)) return n;
  }
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }
  return s;
}

function splitFlow(body: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let inStr: '"' | "'" | null = null;
  let cur = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i] ?? '';
    if (inStr) {
      if (ch === inStr) inStr = null;
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

function parseFlow(s: string): YamlValue {
  const t = s.trim();
  if (t.startsWith('[') && t.endsWith(']')) {
    const body = t.slice(1, -1).trim();
    if (body === '') return [];
    return splitFlow(body).map((x) => parseScalar(x.trim()));
  }
  if (t.startsWith('{') && t.endsWith('}')) {
    const body = t.slice(1, -1).trim();
    const obj: { [k: string]: YamlValue } = {};
    if (body === '') return obj;
    for (const pair of splitFlow(body)) {
      const idx = pair.indexOf(':');
      if (idx < 0) continue;
      const key = parseScalarKey(pair.slice(0, idx).trim());
      obj[key] = parseScalar(pair.slice(idx + 1).trim());
    }
    return obj;
  }
  return t;
}

function parseScalarKey(raw: string): string {
  const v = parseScalar(raw);
  return typeof v === 'string' ? v : String(v);
}

/** Find the position of the colon separating a YAML key from its value (top level). */
function findColon(content: string): number {
  let inStr: '"' | "'" | null = null;
  let depth = 0;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i] ?? '';
    if (inStr) {
      if (ch === inStr) inStr = null;
    } else if (ch === '"' || ch === "'") {
      inStr = ch;
    } else if (ch === '[' || ch === '{') depth++;
    else if (ch === ']' || ch === '}') depth--;
    else if (ch === ':' && depth === 0) {
      const next = content[i + 1];
      if (next === undefined || next === ' ') return i;
    }
  }
  return -1;
}

function parseBlock(lines: Line[], start: number, indent: number): { value: YamlValue; next: number } {
  // Determine if this block is a sequence or a mapping by the first line.
  const first = lines[start];
  if (!first) return { value: null, next: start };

  if (first.content.startsWith('- ') || first.content === '-') {
    const arr: YamlValue[] = [];
    let i = start;
    while (i < lines.length) {
      const ln = lines[i];
      if (!ln || ln.indent < indent) break;
      if (ln.indent > indent) {
        // shouldn't happen at this level; skip defensively
        i++;
        continue;
      }
      if (!ln.content.startsWith('-')) break;
      const rest = ln.content === '-' ? '' : ln.content.slice(1).trimStart();
      if (rest === '') {
        // Nested block on following deeper lines.
        const childIndent = (lines[i + 1]?.indent ?? indent + 2);
        if (childIndent > indent) {
          const sub = parseBlock(lines, i + 1, childIndent);
          arr.push(sub.value);
          i = sub.next;
        } else {
          arr.push(null);
          i++;
        }
      } else {
        const colon = findColon(rest);
        if (colon >= 0) {
          // Inline map start: "- key: val" — treat the dash position as a map at indent+2.
          const mapIndent = ln.indent + 2;
          // Rewrite this line as a map line and parse contiguous map block.
          const synthetic: Line[] = [{ indent: mapIndent, content: rest }];
          let j = i + 1;
          while (j < lines.length) {
            const nx = lines[j];
            if (!nx || nx.indent < mapIndent) break;
            synthetic.push(nx);
            j++;
          }
          const sub = parseBlock(synthetic, 0, mapIndent);
          arr.push(sub.value);
          i = j;
        } else {
          arr.push(parseScalar(rest));
          i++;
        }
      }
    }
    return { value: arr, next: i };
  }

  // Mapping
  const obj: { [k: string]: YamlValue } = {};
  let i = start;
  while (i < lines.length) {
    const ln = lines[i];
    if (!ln || ln.indent < indent) break;
    if (ln.indent > indent) {
      i++;
      continue;
    }
    if (ln.content.startsWith('- ') || ln.content === '-') break;
    const colon = findColon(ln.content);
    if (colon < 0) {
      // bare scalar where a map was expected; stop
      break;
    }
    const key = parseScalarKey(ln.content.slice(0, colon).trim());
    const valPart = ln.content.slice(colon + 1).trim();
    if (valPart === '') {
      const childIndent = lines[i + 1]?.indent ?? indent;
      if (childIndent > indent) {
        const sub = parseBlock(lines, i + 1, childIndent);
        obj[key] = sub.value;
        i = sub.next;
      } else {
        // Could be a sequence at same indent (YAML allows seq under key at same indent).
        const nextLn = lines[i + 1];
        if (nextLn && nextLn.indent === indent && (nextLn.content.startsWith('- ') || nextLn.content === '-')) {
          const sub = parseBlock(lines, i + 1, indent);
          obj[key] = sub.value;
          i = sub.next;
        } else {
          obj[key] = null;
          i++;
        }
      }
    } else {
      obj[key] = parseScalar(valPart);
      i++;
    }
  }
  return { value: obj, next: i };
}

function parseYaml(text: string): YamlValue {
  const lines = tokenize(text);
  if (lines.length === 0) return null;
  const baseIndent = lines[0]?.indent ?? 0;
  const { value } = parseBlock(lines, 0, baseIndent);
  return value;
}

// ---- CSV emission ----

function isPlainObject(v: YamlValue): v is { [k: string]: YamlValue } {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function flatten(
  obj: { [k: string]: YamlValue },
  prefix: string,
  out: { [k: string]: string },
  doFlatten: boolean
): void {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (doFlatten && isPlainObject(v)) {
      flatten(v, key, out, doFlatten);
    } else if (doFlatten && Array.isArray(v) && v.some((x) => isPlainObject(x) || Array.isArray(x))) {
      out[key] = JSON.stringify(v);
    } else {
      out[key] = cellValue(v);
    }
  }
}

function cellValue(v: YamlValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

function csvEscape(field: string, delim: string): string {
  if (field.includes(delim) || field.includes('"') || field.includes('\n') || field.includes('\r')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

type KeyOrder = 'first-seen' | 'alpha';

export default function YamlToCsvTool() {
  const [delimiter, setDelimiter] = useState<',' | ';' | '\t' | '|'>(',');
  const [flattenNested, setFlattenNested] = useState(true);
  const [includeHeader, setIncludeHeader] = useState(true);
  const [keyOrder, setKeyOrder] = useState<KeyOrder>('first-seen');

  return (
    <TextToolLayout
      deps={[delimiter, flattenNested, includeHeader, keyOrder]}
      transform={(input) => {
        if (!input.trim()) return '';
        let data: YamlValue;
        try {
          data = parseYaml(input);
        } catch (e) {
          throw new Error(`YAML parse error: ${e instanceof Error ? e.message : String(e)}`);
        }
        const records: Array<{ [k: string]: YamlValue }> = [];
        if (Array.isArray(data)) {
          for (const item of data) {
            if (isPlainObject(item)) records.push(item);
            else records.push({ value: item });
          }
        } else if (isPlainObject(data)) {
          records.push(data);
        } else {
          throw new Error('Expected a YAML sequence of mappings or a single mapping.');
        }
        if (records.length === 0) throw new Error('No records found.');

        // Build per-record flattened cell maps + header (first-seen union).
        const rowMaps: Array<{ [k: string]: string }> = [];
        const header: string[] = [];
        const seen = new Set<string>();
        for (const rec of records) {
          const cells: { [k: string]: string } = {};
          flatten(rec, '', cells, flattenNested);
          rowMaps.push(cells);
          for (const k of Object.keys(cells)) {
            if (!seen.has(k)) {
              seen.add(k);
              header.push(k);
            }
          }
        }
        if (keyOrder === 'alpha') header.sort();

        const delim = delimiter;
        const out: string[] = [];
        if (includeHeader) {
          out.push(header.map((h) => csvEscape(h, delim)).join(delim));
        }
        for (const row of rowMaps) {
          out.push(header.map((h) => csvEscape(row[h] ?? '', delim)).join(delim));
        }
        return out.join('\r\n');
      }}
      inputLabel="YAML"
      outputLabel="CSV"
      inputPlaceholder="Paste a YAML list of objects…"
      sample={SAMPLE}
      downloadName="output.csv"
      downloadMime="text/csv"
      options={
        <>
          <Field label="Delimiter">
            <Select value={delimiter} onValueChange={(v) => setDelimiter(v as ',' | ';' | '\t' | '|')}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=",">Comma</SelectItem>
                <SelectItem value=";">Semicolon</SelectItem>
                <SelectItem value={'\t'}>Tab</SelectItem>
                <SelectItem value="|">Pipe</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Key order">
            <Tabs value={keyOrder} onValueChange={(v) => setKeyOrder(v as KeyOrder)}>
              <TabsList>
                <TabsTrigger value="first-seen">First-seen</TabsTrigger>
                <TabsTrigger value="alpha">Alphabetical</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Flatten nested" hint="dot keys vs JSON">
            <Switch checked={flattenNested} onCheckedChange={setFlattenNested} />
          </Field>
          <Field label="Include header">
            <Switch checked={includeHeader} onCheckedChange={setIncludeHeader} />
          </Field>
        </>
      }
    />
  );
}
