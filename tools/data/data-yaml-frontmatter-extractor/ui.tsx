'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Format = 'auto' | 'yaml' | 'toml';

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue };

const SAMPLE = `---
title: Hello World
date: 2024-01-15
draft: false
tags:
  - intro
  - demo
author:
  name: Ada
  twitter: "@ada"
---

# Hello World

This is the body of the document, after the front matter block.
`;

function parseScalar(raw: string): JsonValue {
  const t = raw.trim();
  if (t === '' || t === '~' || t.toLowerCase() === 'null') return null;
  if (t === 'true' || t === 'false') return t === 'true';
  if (
    (t.startsWith('"') && t.endsWith('"') && t.length >= 2) ||
    (t.startsWith("'") && t.endsWith("'") && t.length >= 2)
  ) {
    return t.slice(1, -1);
  }
  if (/^[-+]?\d+$/.test(t)) {
    const n = Number(t);
    if (Number.isSafeInteger(n)) return n;
  }
  if (/^[-+]?(\d+\.\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) {
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  // Inline flow array: [a, b, c]
  if (t.startsWith('[') && t.endsWith(']')) {
    const inner = t.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map((p) => parseScalar(p.trim()));
  }
  return t;
}

interface FmLine {
  indent: number;
  content: string;
}

/** Minimal YAML subset parser: nested maps, block sequences, scalars. */
function parseYamlSubset(text: string): JsonValue {
  const lines: FmLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const ts = raw.replace(/^\s+/, '');
    if (ts === '' || ts.startsWith('#')) continue;
    lines.push({ indent: raw.length - ts.length, content: ts.replace(/\s+$/, '') });
  }
  let pos = 0;

  function parseBlock(minIndent: number): JsonValue {
    const first = lines[pos];
    if (!first || first.indent < minIndent) return null;
    if (first.content.startsWith('- ') || first.content === '-') {
      return parseSeq(first.indent);
    }
    return parseMap(first.indent);
  }

  function parseSeq(indent: number): JsonValue {
    const arr: JsonValue[] = [];
    while (pos < lines.length) {
      const line = lines[pos];
      if (!line || line.indent !== indent) break;
      if (!(line.content.startsWith('- ') || line.content === '-')) break;
      const rest = line.content === '-' ? '' : line.content.slice(2).trim();
      pos++;
      if (rest === '') {
        arr.push(parseBlock(indent + 1));
      } else {
        arr.push(parseScalar(rest));
      }
    }
    return arr;
  }

  function parseMap(indent: number): JsonValue {
    const obj: { [k: string]: JsonValue } = {};
    while (pos < lines.length) {
      const line = lines[pos];
      if (!line || line.indent !== indent) break;
      if (line.content.startsWith('- ') || line.content === '-') break;
      const ci = line.content.indexOf(':');
      if (ci === -1) {
        pos++;
        throw new Error(`Invalid front matter line (no colon): ${line.content}`);
      }
      let key = line.content.slice(0, ci).trim();
      if (
        (key.startsWith('"') && key.endsWith('"')) ||
        (key.startsWith("'") && key.endsWith("'"))
      ) {
        key = key.slice(1, -1);
      }
      const after = line.content.slice(ci + 1).trim();
      pos++;
      if (after === '') {
        obj[key] = parseBlock(indent + 1);
      } else {
        obj[key] = parseScalar(after);
      }
    }
    return obj;
  }

  if (lines.length === 0) return {};
  return parseBlock(lines[0]?.indent ?? 0);
}

/** Minimal TOML parser: top-level + [tables], key = value, basic arrays. */
function parseTomlSubset(text: string): JsonValue {
  const root: { [k: string]: JsonValue } = {};
  let current: { [k: string]: JsonValue } = root;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    if (line.startsWith('[') && line.endsWith(']')) {
      const name = line.slice(1, -1).trim();
      const parts = name.split('.').map((s) => s.trim());
      let node: { [k: string]: JsonValue } = root;
      for (const part of parts) {
        const existing = node[part];
        if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
          node = existing as { [k: string]: JsonValue };
        } else {
          const fresh: { [k: string]: JsonValue } = {};
          node[part] = fresh;
          node = fresh;
        }
      }
      current = node;
      continue;
    }
    const eq = line.indexOf('=');
    if (eq === -1) throw new Error(`Invalid TOML line (no =): ${line}`);
    let key = line.slice(0, eq).trim();
    if (
      (key.startsWith('"') && key.endsWith('"')) ||
      (key.startsWith("'") && key.endsWith("'"))
    ) {
      key = key.slice(1, -1);
    }
    const valRaw = line.slice(eq + 1).trim();
    current[key] = parseTomlValue(valRaw);
  }
  return root;
}

function parseTomlValue(raw: string): JsonValue {
  const t = raw.trim();
  if (t === 'true' || t === 'false') return t === 'true';
  if (
    (t.startsWith('"') && t.endsWith('"') && t.length >= 2) ||
    (t.startsWith("'") && t.endsWith("'") && t.length >= 2)
  ) {
    return t.slice(1, -1);
  }
  if (t.startsWith('[') && t.endsWith(']')) {
    const inner = t.slice(1, -1).trim();
    if (inner === '') return [];
    // Split on commas not inside quotes.
    const parts: string[] = [];
    let depth = 0;
    let buf = '';
    let quote = '';
    for (let i = 0; i < inner.length; i++) {
      const ch = inner[i] ?? '';
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
      if (ch === '[') depth++;
      else if (ch === ']') depth--;
      if (ch === ',' && depth === 0) {
        parts.push(buf);
        buf = '';
      } else buf += ch;
    }
    if (buf.trim() !== '') parts.push(buf);
    return parts.map((p) => parseTomlValue(p.trim()));
  }
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

interface Split {
  fmType: 'yaml' | 'toml' | null;
  fm: string;
  body: string;
}

function splitFrontMatter(text: string): Split {
  // Normalize a leading BOM and detect delimiter on the very first line.
  const lines = text.split(/\r?\n/);
  const firstLine = (lines[0] ?? '').trim();
  let delim: '---' | '+++' | null = null;
  if (firstLine === '---') delim = '---';
  else if (firstLine === '+++') delim = '+++';
  if (delim === null) return { fmType: null, fm: '', body: text };

  // Find the closing delimiter.
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if ((lines[i] ?? '').trim() === delim) {
      close = i;
      break;
    }
  }
  if (close === -1) {
    throw new Error(`Front matter opened with "${delim}" but no closing "${delim}" was found.`);
  }
  const fm = lines.slice(1, close).join('\n');
  const body = lines.slice(close + 1).join('\n').replace(/^\n+/, '');
  return { fmType: delim === '---' ? 'yaml' : 'toml', fm, body };
}

export default function FrontMatterExtractorTool() {
  const [format, setFormat] = useState<Format>('auto');

  return (
    <TextToolLayout
      deps={[format]}
      sample={SAMPLE}
      inputLabel="Markdown with front matter"
      outputLabel="Parsed JSON + body"
      downloadName="frontmatter.txt"
      transform={(input) => {
        if (!input.trim()) return '';
        const split = splitFrontMatter(input);
        if (split.fmType === null) {
          return ['{ "frontMatter": null }', '', '--- BODY ---', '', input].join('\n');
        }

        let useType: 'yaml' | 'toml' = split.fmType;
        if (format === 'yaml') useType = 'yaml';
        else if (format === 'toml') useType = 'toml';

        let parsed: JsonValue;
        try {
          parsed = useType === 'yaml' ? parseYamlSubset(split.fm) : parseTomlSubset(split.fm);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          throw new Error(`Failed to parse ${useType.toUpperCase()} front matter: ${msg}`);
        }

        const json = JSON.stringify(parsed, null, 2);
        return [
          `--- FRONT MATTER (${useType.toUpperCase()}) → JSON ---`,
          '',
          json,
          '',
          '--- BODY ---',
          '',
          split.body,
        ].join('\n');
      }}
      options={
        <Field label="Format">
          <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-detect</SelectItem>
              <SelectItem value="yaml">YAML (---)</SelectItem>
              <SelectItem value="toml">TOML (+++)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      }
    />
  );
}
