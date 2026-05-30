'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TextToolLayout } from '@/components/tools/text-tool';

type Direction = 'p2y' | 'y2p';

const SAMPLE_PROPS = `# Spring application config
server.port=8080
server.servlet.context-path=/api
spring.datasource.url=jdbc:mysql://db:3306/app
spring.datasource.username=admin
app.name=My App
app.debug=true
app.max-retries=5`;

const SAMPLE_YAML = `server:
  port: 8080
  servlet:
    context-path: /api
spring:
  datasource:
    url: jdbc:mysql://db:3306/app
    username: admin
app:
  name: My App
  debug: true
  max-retries: 5`;

// ---- properties parsing ----

function unescapeProp(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i] ?? '';
    if (ch === '\\') {
      const next = value[i + 1] ?? '';
      if (next === 'u') {
        const hex = value.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          out += String.fromCharCode(Number.parseInt(hex, 16));
          i += 5;
          continue;
        }
        out += 'u';
        i += 1;
        continue;
      }
      if (next === 't') out += '\t';
      else if (next === 'n') out += '\n';
      else if (next === 'r') out += '\r';
      else if (next === 'f') out += '\f';
      else if (next === '\\') out += '\\';
      else if (next === '=') out += '=';
      else if (next === ':') out += ':';
      else out += next;
      i += 1;
      continue;
    }
    out += ch;
  }
  return out;
}

function logicalLines(text: string): string[] {
  const physical = text.split(/\r\n|\r|\n/);
  const lines: string[] = [];
  let buffer = '';
  let continuing = false;
  for (const raw of physical) {
    const line = continuing ? raw.replace(/^\s+/, '') : raw;
    const match = /(\\*)$/.exec(line);
    const slashes = match && match[1] ? match[1].length : 0;
    if (slashes % 2 === 1) {
      buffer += line.slice(0, -1);
      continuing = true;
    } else {
      buffer += line;
      lines.push(buffer);
      buffer = '';
      continuing = false;
    }
  }
  if (buffer !== '') lines.push(buffer);
  return lines;
}

function parseProperties(input: string): { key: string; value: string }[] {
  const pairs: { key: string; value: string }[] = [];
  for (const line of logicalLines(input)) {
    const trimmed = line.replace(/^\s+/, '');
    if (trimmed === '') continue;
    const firstChar = trimmed[0] ?? '';
    if (firstChar === '#' || firstChar === '!') continue;
    let sepIdx = -1;
    for (let i = 0; i < trimmed.length; i++) {
      const c = trimmed[i] ?? '';
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === '=' || c === ':') {
        sepIdx = i;
        break;
      }
    }
    let rawKey: string;
    let rawVal: string;
    if (sepIdx === -1) {
      rawKey = trimmed;
      rawVal = '';
    } else {
      rawKey = trimmed.slice(0, sepIdx);
      rawVal = trimmed.slice(sepIdx + 1);
    }
    const key = unescapeProp(rawKey.trim());
    const value = unescapeProp(rawVal.trim());
    if (key !== '') pairs.push({ key, value });
  }
  return pairs;
}

// ---- nested tree builder ----

type Tree = { [k: string]: Tree | string };

function buildTree(pairs: { key: string; value: string }[]): Tree {
  const root: Tree = {};
  for (const { key, value } of pairs) {
    const parts = key.split('.').filter((p) => p.length > 0);
    if (parts.length === 0) continue;
    let cur: Tree = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i] ?? '';
      const existing = cur[part];
      if (existing === undefined || typeof existing === 'string') {
        const next: Tree = {};
        cur[part] = next;
        cur = next;
      } else {
        cur = existing;
      }
    }
    const last = parts[parts.length - 1] ?? key;
    cur[last] = value;
  }
  return root;
}

// ---- YAML scalar handling ----

function yamlScalar(value: string): string {
  if (value === '') return '""';
  if (/^(true|false|null|yes|no|on|off|~)$/i.test(value)) return JSON.stringify(value);
  if (/^[+-]?\d+$/.test(value) || /^[+-]?(\d+\.\d+|\.\d+)([eE][+-]?\d+)?$/.test(value)) {
    // Numeric-looking: emit bare so it reads as a number.
    return value;
  }
  // Quote if it contains characters that would break block-style plain scalars.
  if (/[:#\[\]{}&*!|>'"%@`,]/.test(value) || /^[\s]|[\s]$/.test(value) || /^[-?]/.test(value)) {
    return JSON.stringify(value);
  }
  return value;
}

function yamlKey(key: string): string {
  if (/^[A-Za-z0-9_.\-]+$/.test(key)) return key;
  return JSON.stringify(key);
}

function toYaml(tree: Tree, depth: number): string {
  const indent = '  '.repeat(depth);
  const lines: string[] = [];
  for (const k of Object.keys(tree)) {
    const v = tree[k];
    if (v !== undefined && typeof v === 'object') {
      if (Object.keys(v).length === 0) {
        lines.push(`${indent}${yamlKey(k)}: {}`);
      } else {
        lines.push(`${indent}${yamlKey(k)}:`);
        lines.push(toYaml(v, depth + 1));
      }
    } else {
      lines.push(`${indent}${yamlKey(k)}: ${yamlScalar(v ?? '')}`);
    }
  }
  return lines.join('\n');
}

// ---- YAML -> properties (flatten) ----

interface YamlLine {
  indent: number;
  key: string;
  value: string | null;
}

function parseYamlValue(raw: string): string {
  let v = raw.trim();
  if (v.startsWith('#')) return '';
  // Strip trailing inline comment when value is unquoted.
  if (!(v.startsWith('"') || v.startsWith("'"))) {
    const hashIdx = v.indexOf(' #');
    if (hashIdx !== -1) v = v.slice(0, hashIdx).trim();
  }
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    if (v.startsWith('"')) {
      try {
        return JSON.parse(v) as string;
      } catch {
        return v.slice(1, -1);
      }
    }
    return v.slice(1, -1).replace(/''/g, "'");
  }
  return v;
}

function yamlToProperties(input: string): string {
  const parsed: YamlLine[] = [];
  for (const raw of input.split(/\r\n|\r|\n/)) {
    if (raw.trim() === '') continue;
    const trimmedStart = raw.replace(/^\s*/, '');
    if (trimmedStart.startsWith('#')) continue;
    if (trimmedStart.startsWith('- ')) {
      throw new Error('YAML sequences (lists) are not supported; flatten to dotted keys only.');
    }
    const indentMatch = /^(\s*)/.exec(raw);
    const indent = indentMatch && indentMatch[1] ? indentMatch[1].length : 0;
    const colonIdx = trimmedStart.indexOf(':');
    if (colonIdx === -1) {
      throw new Error(`Line is not a "key: value" mapping: "${raw.trim()}"`);
    }
    const key = trimmedStart.slice(0, colonIdx).trim();
    const after = trimmedStart.slice(colonIdx + 1).trim();
    parsed.push({ indent, key, value: after === '' ? null : parseYamlValue(after) });
  }

  const out: string[] = [];
  const stack: { indent: number; key: string }[] = [];
  for (const line of parsed) {
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      if (top && top.indent >= line.indent) stack.pop();
      else break;
    }
    if (line.value === null) {
      stack.push({ indent: line.indent, key: line.key });
    } else {
      const path = [...stack.map((s) => s.key), line.key].join('.');
      out.push(`${path}=${line.value}`);
    }
  }
  return out.join('\n');
}

export default function PropertiesToYamlTool() {
  const [dir, setDir] = useState<Direction>('p2y');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      if (dir === 'p2y') {
        const pairs = parseProperties(input);
        if (pairs.length === 0) throw new Error('No key=value pairs found.');
        const tree = buildTree(pairs);
        return toYaml(tree, 0);
      }
      return yamlToProperties(input);
    },
    [dir],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[dir]}
      inputLabel={dir === 'p2y' ? '.properties' : 'YAML'}
      outputLabel={dir === 'p2y' ? 'YAML' : '.properties'}
      inputPlaceholder={dir === 'p2y' ? 'server.port=8080' : 'server:\n  port: 8080'}
      sample={dir === 'p2y' ? SAMPLE_PROPS : SAMPLE_YAML}
      downloadName={dir === 'p2y' ? 'application.yml' : 'application.properties'}
      options={
        <Field label="Direction">
          <Tabs value={dir} onValueChange={(v) => setDir(v as Direction)}>
            <TabsList>
              <TabsTrigger value="p2y">Properties to YAML</TabsTrigger>
              <TabsTrigger value="y2p">YAML to Properties</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
