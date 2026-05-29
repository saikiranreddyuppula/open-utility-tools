'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

type Token = { kind: 'key'; value: string } | { kind: 'index'; value: number };

const SAMPLE = JSON.stringify(
  { data: { items: [{ name: 'first', tags: ['a', 'b'] }, { name: 'second' }], total: 2 } },
  null,
  2,
);

function tokenizePath(path: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = path.length;
  // Allow an optional leading "$" (root) and an optional leading ".".
  if (i < n && path[i] === '$') i++;
  while (i < n) {
    const ch = path[i];
    if (ch === '.') {
      i++;
      continue;
    }
    if (ch === '[') {
      i++;
      // bracket: either ["key"] / ['key'] or [number]
      const quote = path[i];
      if (quote === '"' || quote === "'") {
        i++;
        let buf = '';
        while (i < n && path[i] !== quote) {
          if (path[i] === '\\' && i + 1 < n) {
            buf += path[i + 1] ?? '';
            i += 2;
            continue;
          }
          buf += path[i] ?? '';
          i++;
        }
        if (i >= n || path[i] !== quote) throw new Error('Unterminated quoted key in path.');
        i++; // closing quote
        if (i >= n || path[i] !== ']') throw new Error('Expected "]" after quoted key.');
        i++; // closing bracket
        tokens.push({ kind: 'key', value: buf });
        continue;
      }
      let buf = '';
      while (i < n && path[i] !== ']') {
        buf += path[i] ?? '';
        i++;
      }
      if (i >= n || path[i] !== ']') throw new Error('Unterminated "[" in path.');
      i++; // closing bracket
      const trimmed = buf.trim();
      const num = Number(trimmed);
      if (trimmed === '' || !Number.isInteger(num) || num < 0) {
        throw new Error(`Invalid array index "${buf}". Use a non-negative integer.`);
      }
      tokens.push({ kind: 'index', value: num });
      continue;
    }
    // bare key segment until next "." or "["
    let buf = '';
    while (i < n && path[i] !== '.' && path[i] !== '[') {
      buf += path[i] ?? '';
      i++;
    }
    if (buf === '') throw new Error('Empty path segment.');
    tokens.push({ kind: 'key', value: buf });
  }
  return tokens;
}

function walk(root: unknown, tokens: Token[]): unknown {
  let current: unknown = root;
  for (let t = 0; t < tokens.length; t++) {
    const token = tokens[t];
    if (token === undefined) break;
    const label = token.kind === 'index' ? `[${token.value}]` : `.${token.value}`;
    if (current === null || current === undefined) {
      throw new Error(`Cannot read "${label}" of ${current === null ? 'null' : 'undefined'}.`);
    }
    if (token.kind === 'index') {
      if (!Array.isArray(current)) {
        throw new Error(`Expected an array at "${label}" but found ${typeof current}.`);
      }
      if (token.value >= current.length) {
        throw new Error(`Index ${token.value} is out of bounds (length ${current.length}).`);
      }
      current = current[token.value];
    } else {
      if (typeof current !== 'object' || Array.isArray(current)) {
        throw new Error(`Expected an object at "${label}" but found ${Array.isArray(current) ? 'array' : typeof current}.`);
      }
      const obj = current as Record<string, unknown>;
      if (!Object.prototype.hasOwnProperty.call(obj, token.value)) {
        throw new Error(`Key "${token.value}" not found.`);
      }
      current = obj[token.value];
    }
  }
  return current;
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `array (${value.length})`;
  return typeof value;
}

export default function JsonPathExtractorTool() {
  const [json, setJson] = useState(SAMPLE);
  const [path, setPath] = useState('data.items[0].name');

  const result = useMemo<{ output: string; type: string; error: string | null }>(() => {
    if (json.trim() === '') return { output: '', type: '', error: null };
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (e) {
      return { output: '', type: '', error: `Invalid JSON: ${(e as Error).message}` };
    }
    if (path.trim() === '') {
      return { output: JSON.stringify(parsed, null, 2), type: describe(parsed), error: null };
    }
    try {
      const tokens = tokenizePath(path.trim());
      const value = walk(parsed, tokens);
      const output = value === undefined ? 'undefined' : JSON.stringify(value, null, 2);
      return { output, type: describe(value), error: null };
    } catch (e) {
      return { output: '', type: '', error: (e as Error).message };
    }
  }, [json, path]);

  return (
    <div className="flex flex-col gap-4">
      <ErrorBanner error={result.error} />
      <OptionsBar>
        <Field label="Path" hint="e.g. data.items[0].name or data[&quot;items&quot;][1]" className="flex-1">
          <Input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="data.items[0].name"
            spellCheck={false}
          />
        </Field>
      </OptionsBar>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <PanelHeader title="JSON input" />
          <Textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            placeholder="Paste JSON here"
            spellCheck={false}
            className="min-h-[320px] font-mono text-sm"
          />
        </Panel>
        <Panel>
          <PanelHeader title="Extracted value">
            <CopyButton value={result.output} />
          </PanelHeader>
          <Textarea
            value={result.output}
            readOnly
            placeholder="Matched value appears here"
            spellCheck={false}
            className="min-h-[320px] font-mono text-sm"
          />
          <StatBar items={[result.type && `type: ${result.type}`, `${result.output.length} chars`]} />
        </Panel>
      </div>
    </div>
  );
}
