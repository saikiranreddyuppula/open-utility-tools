'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type JsonValue = string | JsonValue[] | { [key: string]: JsonValue };

function setNested(
  root: Record<string, JsonValue>,
  path: (string | number)[],
  value: string,
): void {
  let current: Record<string, JsonValue> | JsonValue[] = root;

  for (let i = 0; i < path.length; i++) {
    const key = path[i];
    if (key === undefined) continue;
    const isLast = i === path.length - 1;
    const nextKey = path[i + 1];

    if (isLast) {
      assign(current, key, value);
      continue;
    }

    // Determine if the next container should be an array or object.
    const wantArray = typeof nextKey === 'number' || nextKey === '';
    const existing = read(current, key);

    if (existing === undefined || typeof existing !== 'object') {
      const container: Record<string, JsonValue> | JsonValue[] = wantArray ? [] : {};
      assign(current, key, container);
      current = container;
    } else {
      current = existing as Record<string, JsonValue> | JsonValue[];
    }
  }
}

function read(
  container: Record<string, JsonValue> | JsonValue[],
  key: string | number,
): JsonValue | undefined {
  if (Array.isArray(container)) {
    if (typeof key === 'number') return container[key];
    return undefined;
  }
  return container[String(key)];
}

function assign(
  container: Record<string, JsonValue> | JsonValue[],
  key: string | number,
  value: JsonValue,
): void {
  if (Array.isArray(container)) {
    if (key === '' || typeof key === 'number') {
      // Push for empty-bracket "[]" or explicit numeric index.
      if (typeof key === 'number') container[key] = value;
      else container.push(value);
    } else {
      container.push(value);
    }
    return;
  }
  container[String(key)] = value;
}

function parseKeyPath(rawKey: string): (string | number)[] {
  // Split "a[b][0][]" into ["a", "b", 0, ""].
  const match = rawKey.match(/^([^[\]]*)((?:\[[^[\]]*\])*)$/);
  if (!match) return [rawKey];

  const base = match[1] ?? rawKey;
  const rest = match[2] ?? '';
  const segments: (string | number)[] = [base];

  const bracketRe = /\[([^[\]]*)\]/g;
  let m: RegExpExecArray | null;
  while ((m = bracketRe.exec(rest)) !== null) {
    const inner = m[1] ?? '';
    if (inner === '') {
      segments.push('');
    } else if (/^\d+$/.test(inner)) {
      segments.push(Number(inner));
    } else {
      segments.push(inner);
    }
  }
  return segments;
}

function parseQuery(input: string): Record<string, JsonValue> {
  let raw = input.trim();
  if (!raw) return {};
  // Strip a leading "?" or a full URL up to the query portion.
  const qIndex = raw.indexOf('?');
  if (qIndex !== -1) raw = raw.slice(qIndex + 1);
  // Drop a trailing hash fragment.
  const hashIndex = raw.indexOf('#');
  if (hashIndex !== -1) raw = raw.slice(0, hashIndex);

  const params = new URLSearchParams(raw);
  const result: Record<string, JsonValue> = {};
  const repeatCounts = new Map<string, number>();

  // First pass: count occurrences of each simple (non-bracket) key.
  for (const key of params.keys()) {
    if (!/[[\]]/.test(key)) {
      repeatCounts.set(key, (repeatCounts.get(key) ?? 0) + 1);
    }
  }

  for (const [key, value] of params.entries()) {
    if (/[[\]]/.test(key)) {
      setNested(result, parseKeyPath(key), value);
    } else if ((repeatCounts.get(key) ?? 0) > 1) {
      const existing = result[key];
      if (Array.isArray(existing)) existing.push(value);
      else result[key] = [value];
    } else {
      result[key] = value;
    }
  }

  return result;
}

export default function QueryStringParserTool() {
  const [mode, setMode] = useState<'json' | 'table'>('json');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const parsed = parseQuery(input);
      const keys = Object.keys(parsed);
      if (keys.length === 0) return '{}';

      if (mode === 'json') {
        return JSON.stringify(parsed, null, 2);
      }

      // Flat key/value table view.
      const rows: string[] = [];
      const walk = (value: JsonValue, prefix: string): void => {
        if (Array.isArray(value)) {
          value.forEach((v, i) => walk(v, `${prefix}[${i}]`));
        } else if (value !== null && typeof value === 'object') {
          for (const [k, v] of Object.entries(value)) {
            walk(v, prefix ? `${prefix}.${k}` : k);
          }
        } else {
          rows.push(`${prefix} = ${value}`);
        }
      };
      for (const k of keys) {
        const v = parsed[k];
        if (v !== undefined) walk(v, k);
      }
      return rows.join('\n');
    },
    [mode],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode]}
      inputLabel="Query string or URL"
      outputLabel={mode === 'json' ? 'Parsed JSON' : 'Key/value table'}
      inputPlaceholder="?foo=1&bar[]=a&bar[]=b&user[name]=Ada"
      sample="https://example.com/search?q=hello+world&tag=js&tag=ts&filter[year]=2024&ids[]=1&ids[]=2"
      downloadName="query.json"
      downloadMime="application/json"
      options={
        <Field label="Output">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'json' | 'table')}>
            <TabsList>
              <TabsTrigger value="json">JSON</TabsTrigger>
              <TabsTrigger value="table">Table</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
