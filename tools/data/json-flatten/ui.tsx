'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Direction = 'flatten' | 'unflatten';
type ArrayStyle = 'bracket' | 'dot';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Flatten a nested object/array into a single-level map of path -> primitive. */
function flatten(value: unknown, arrayStyle: ArrayStyle): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  const walk = (node: unknown, prefix: string) => {
    if (Array.isArray(node)) {
      if (node.length === 0) {
        if (prefix) result[prefix] = [];
        return;
      }
      node.forEach((item, idx) => {
        const key =
          arrayStyle === 'bracket'
            ? `${prefix}[${idx}]`
            : prefix
              ? `${prefix}.${idx}`
              : String(idx);
        walk(item, key);
      });
      return;
    }
    if (isPlainObject(node)) {
      const keys = Object.keys(node);
      if (keys.length === 0) {
        if (prefix) result[prefix] = {};
        return;
      }
      for (const k of keys) {
        const childKey = prefix ? `${prefix}.${k}` : k;
        walk(node[k], childKey);
      }
      return;
    }
    // Primitive (or null) leaf.
    result[prefix] = node;
  };

  walk(value, '');
  return result;
}

/** Parse a flattened key into a sequence of object/array path segments. */
function parsePath(key: string): Array<string | number> {
  const segments: Array<string | number> = [];
  // Split on dots first, then expand [n] bracket notation within each part.
  const dotParts = key.split('.');
  for (const part of dotParts) {
    const bracketRe = /([^[\]]*)|(\[(\d+)\])/g;
    let consumed = '';
    // Handle a leading name then bracket indices, e.g. "items[0][1]".
    const nameMatch = /^([^[\]]+)/.exec(part);
    if (nameMatch && nameMatch[1] !== undefined) {
      const name = nameMatch[1];
      // Pure numeric segment from dot-style array index.
      if (/^\d+$/.test(name)) segments.push(Number(name));
      else segments.push(name);
      consumed = name;
    }
    const rest = part.slice(consumed.length);
    let m: RegExpExecArray | null;
    bracketRe.lastIndex = 0;
    const idxRe = /\[(\d+)\]/g;
    while ((m = idxRe.exec(rest)) !== null) {
      if (m[1] !== undefined) segments.push(Number(m[1]));
    }
    // Edge case: a part that is only "[0]" with no preceding name.
    if (!nameMatch) {
      const onlyIdx = /\[(\d+)\]/g;
      let mm: RegExpExecArray | null;
      while ((mm = onlyIdx.exec(part)) !== null) {
        if (mm[1] !== undefined) segments.push(Number(mm[1]));
      }
    }
  }
  return segments;
}

/** Rebuild a nested structure from a flat map of path -> value. */
function unflatten(flat: Record<string, unknown>): unknown {
  let root: unknown = undefined;

  const assign = (path: Array<string | number>, value: unknown) => {
    if (path.length === 0) {
      root = value;
      return;
    }
    const first = path[0];
    if (root === undefined) {
      root = typeof first === 'number' ? [] : {};
    }
    let cursor: unknown = root;
    for (let i = 0; i < path.length; i++) {
      const seg = path[i];
      if (seg === undefined) break;
      const isLast = i === path.length - 1;
      const nextSeg = path[i + 1];

      if (typeof seg === 'number') {
        const arr = cursor as unknown[];
        if (isLast) {
          arr[seg] = value;
        } else {
          if (arr[seg] === undefined || arr[seg] === null) {
            arr[seg] = typeof nextSeg === 'number' ? [] : {};
          }
          cursor = arr[seg];
        }
      } else {
        const obj = cursor as Record<string, unknown>;
        if (isLast) {
          obj[seg] = value;
        } else {
          if (obj[seg] === undefined || obj[seg] === null) {
            obj[seg] = typeof nextSeg === 'number' ? [] : {};
          }
          cursor = obj[seg];
        }
      }
    }
  };

  for (const key of Object.keys(flat)) {
    assign(parsePath(key), flat[key]);
  }
  return root === undefined ? {} : root;
}

export default function JsonFlattenTool() {
  const [direction, setDirection] = useState<Direction>('flatten');
  const [arrayStyle, setArrayStyle] = useState<ArrayStyle>('bracket');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let parsed: unknown;
      try {
        parsed = JSON.parse(input);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        throw new Error(`Invalid JSON input: ${message}`);
      }

      if (direction === 'flatten') {
        if (!isPlainObject(parsed) && !Array.isArray(parsed)) {
          throw new Error('Flatten expects a JSON object or array at the root.');
        }
        return JSON.stringify(flatten(parsed, arrayStyle), null, 2);
      }

      // Unflatten: expects a flat object of key -> value.
      if (!isPlainObject(parsed)) {
        throw new Error('Unflatten expects a flat JSON object of "dotted.key": value pairs.');
      }
      return JSON.stringify(unflatten(parsed), null, 2);
    },
    [direction, arrayStyle],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[direction, arrayStyle]}
      inputLabel={direction === 'flatten' ? 'Nested JSON' : 'Flattened JSON'}
      outputLabel={direction === 'flatten' ? 'Flattened JSON' : 'Nested JSON'}
      inputPlaceholder={direction === 'flatten' ? '{"a": {"b": 1}}' : '{"a.b": 1}'}
      sample={
        direction === 'flatten'
          ? '{\n  "user": {\n    "name": "Ada",\n    "roles": ["admin", "dev"]\n  },\n  "active": true\n}'
          : '{\n  "user.name": "Ada",\n  "user.roles[0]": "admin",\n  "user.roles[1]": "dev",\n  "active": true\n}'
      }
      downloadName="output.json"
      downloadMime="application/json"
      options={
        <>
          <Field label="Direction">
            <Tabs value={direction} onValueChange={(v) => setDirection(v as Direction)}>
              <TabsList>
                <TabsTrigger value="flatten">Flatten</TabsTrigger>
                <TabsTrigger value="unflatten">Unflatten</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Array keys" hint="How array indices appear in flattened keys.">
            <Tabs value={arrayStyle} onValueChange={(v) => setArrayStyle(v as ArrayStyle)}>
              <TabsList>
                <TabsTrigger value="bracket">a[0]</TabsTrigger>
                <TabsTrigger value="dot">a.0</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </>
      }
    />
  );
}
