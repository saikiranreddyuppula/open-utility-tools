'use client';

import { useCallback, useMemo, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type Mode = 'flatten' | 'unflatten';

const SAMPLE = JSON.stringify(
  {
    user: {
      name: 'Ada',
      address: { city: 'London', zip: 'EC1' },
      roles: ['admin', 'editor'],
    },
    active: true,
  },
  null,
  2,
);

function isPlainObject(v: JsonValue): v is { [key: string]: JsonValue } {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function flatten(
  value: JsonValue,
  prefix: string,
  out: Record<string, JsonValue>,
): void {
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      out[prefix] = {};
      return;
    }
    for (const key of keys) {
      const next = prefix ? `${prefix}.${key}` : key;
      flatten(value[key] as JsonValue, next, out);
    }
  } else if (Array.isArray(value)) {
    if (value.length === 0) {
      out[prefix] = [];
      return;
    }
    value.forEach((el, idx) => {
      const next = prefix ? `${prefix}[${idx}]` : `[${idx}]`;
      flatten(el, next, out);
    });
  } else {
    out[prefix] = value;
  }
}

/** Split "user.roles[0].name" into ['user','roles',0,'name']. */
function splitKey(key: string): (string | number)[] {
  const parts: (string | number)[] = [];
  const tokens = key.match(/[^.[\]]+|\[\d+\]/g) ?? [];
  for (const tok of tokens) {
    const m = /^\[(\d+)\]$/.exec(tok);
    if (m && m[1] !== undefined) parts.push(Number(m[1]));
    else parts.push(tok);
  }
  return parts;
}

function unflatten(flat: { [key: string]: JsonValue }): JsonValue {
  // Determine if the very top level is an array (all keys start with [n]).
  const topKeys = Object.keys(flat);
  let root: { [key: string]: JsonValue } | JsonValue[] = {};

  for (const key of topKeys) {
    const path = splitKey(key);
    if (path.length === 0) continue;

    const firstSeg = path[0];
    if (typeof firstSeg === 'number' && !Array.isArray(root)) {
      if (Object.keys(root).length === 0) root = [];
    }

    let cursor: { [key: string]: JsonValue } | JsonValue[] = root;
    for (let i = 0; i < path.length; i += 1) {
      const seg = path[i];
      if (seg === undefined) continue;
      const isLast = i === path.length - 1;
      const nextSeg = path[i + 1];

      if (isLast) {
        if (typeof seg === 'number' && Array.isArray(cursor)) {
          cursor[seg] = flat[key] as JsonValue;
        } else if (typeof seg === 'string' && !Array.isArray(cursor)) {
          cursor[seg] = flat[key] as JsonValue;
        }
        break;
      }

      const childShouldBeArray = typeof nextSeg === 'number';
      if (typeof seg === 'number' && Array.isArray(cursor)) {
        let existing = cursor[seg];
        if (existing === undefined || existing === null) {
          existing = childShouldBeArray ? [] : {};
          cursor[seg] = existing;
        }
        cursor = existing as { [key: string]: JsonValue } | JsonValue[];
      } else if (typeof seg === 'string' && !Array.isArray(cursor)) {
        let existing = cursor[seg];
        if (existing === undefined || existing === null) {
          existing = childShouldBeArray ? [] : {};
          cursor[seg] = existing;
        }
        cursor = existing as { [key: string]: JsonValue } | JsonValue[];
      }
    }
  }
  return root;
}

export default function JsonFlattenTool() {
  const [mode, setMode] = useState<Mode>('flatten');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';

      let parsed: JsonValue;
      try {
        parsed = JSON.parse(input) as JsonValue;
      } catch (err) {
        throw new Error(
          `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      if (mode === 'flatten') {
        const out: Record<string, JsonValue> = {};
        flatten(parsed, '', out);
        return JSON.stringify(out, null, 2);
      }

      if (!isPlainObject(parsed)) {
        throw new Error(
          'Unflatten expects a flat object of "dotted.key": value pairs.',
        );
      }
      return JSON.stringify(unflatten(parsed), null, 2);
    },
    [mode],
  );

  const options = useMemo(
    () => (
      <Field label="Direction">
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList>
            <TabsTrigger value="flatten">Flatten</TabsTrigger>
            <TabsTrigger value="unflatten">Unflatten</TabsTrigger>
          </TabsList>
        </Tabs>
      </Field>
    ),
    [mode],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode]}
      inputLabel={mode === 'flatten' ? 'Nested JSON' : 'Flat JSON'}
      outputLabel={mode === 'flatten' ? 'Flat JSON' : 'Nested JSON'}
      inputPlaceholder="Paste a JSON document…"
      sample={SAMPLE}
      downloadName="output.json"
      downloadMime="application/json"
      options={options}
    />
  );
}
