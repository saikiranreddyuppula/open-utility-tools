'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const SAMPLE =
  '?user[name]=Ada&user[role]=Engineer&tags=js&tags=ts&filter[ids][]=1&filter[ids][]=2&active=true&count=42';

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

function coerce(raw: string, infer: boolean): JsonValue {
  if (!infer) return raw;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  if (raw !== '' && /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(raw)) {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return raw;
}

/** Parse a key like `user[role]` or `ids[]` into path segments. */
function parseKeyPath(key: string): string[] {
  const segments: string[] = [];
  const bracket = key.indexOf('[');
  if (bracket === -1) return [key];
  segments.push(key.slice(0, bracket));
  const rest = key.slice(bracket);
  const re = /\[([^\]]*)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest)) !== null) {
    segments.push(m[1] ?? '');
  }
  return segments;
}

function assign(
  root: Record<string, JsonValue>,
  path: string[],
  value: JsonValue,
): void {
  // Walk the path, creating intermediate containers as needed.
  let cursor: Record<string, JsonValue> | JsonValue[] = root;

  for (let i = 0; i < path.length; i++) {
    const seg = path[i] ?? '';
    const isLast = i === path.length - 1;
    const nextSeg = path[i + 1];
    // An empty segment ("[]") means push to an array.
    const nextIsArray = nextSeg === '';

    if (seg === '') {
      // Current container should be an array; push.
      if (!Array.isArray(cursor)) break; // defensive; shouldn't happen
      if (isLast) {
        cursor.push(value);
      } else {
        const child: JsonValue = nextIsArray ? [] : {};
        cursor.push(child);
        cursor = child as Record<string, JsonValue> | JsonValue[];
      }
      continue;
    }

    if (Array.isArray(cursor)) break; // type mismatch; defensive
    const container = cursor;

    if (isLast) {
      const existing = container[seg];
      if (existing === undefined) {
        container[seg] = value;
      } else if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        container[seg] = [existing, value];
      }
    } else {
      let child = container[seg];
      if (child === undefined || (typeof child !== 'object' || child === null)) {
        child = nextIsArray ? [] : {};
        container[seg] = child;
      }
      cursor = child as Record<string, JsonValue> | JsonValue[];
    }
  }
}

export default function QueryStringToJsonTool() {
  const [infer, setInfer] = useState(true);
  const [nesting, setNesting] = useState(true);

  const transform = useCallback(
    (input: string) => {
      const trimmed = input.trim();
      if (!trimmed) return '';

      // Strip everything up to and including a leading '?' if a full URL was pasted.
      let qs = trimmed;
      const qIdx = qs.indexOf('?');
      if (qIdx !== -1) qs = qs.slice(qIdx + 1);
      // Drop a fragment if present.
      const hashIdx = qs.indexOf('#');
      if (hashIdx !== -1) qs = qs.slice(0, hashIdx);

      const params = new URLSearchParams(qs);
      const root: Record<string, JsonValue> = {};

      for (const [rawKey, rawValue] of params.entries()) {
        const value = coerce(rawValue, infer);
        if (nesting) {
          const path = parseKeyPath(rawKey);
          assign(root, path, value);
        } else {
          const existing = root[rawKey];
          if (existing === undefined) {
            root[rawKey] = value;
          } else if (Array.isArray(existing)) {
            existing.push(value);
          } else {
            root[rawKey] = [existing, value];
          }
        }
      }

      return JSON.stringify(root, null, 2);
    },
    [infer, nesting],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[infer, nesting]}
      inputLabel="Query string"
      outputLabel="JSON"
      inputPlaceholder="?key=value&list=a&list=b"
      sample={SAMPLE}
      downloadName="params.json"
      downloadMime="application/json"
      options={
        <Field label="Options">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Switch id="qs-nesting" checked={nesting} onCheckedChange={setNesting} />
              <Label htmlFor="qs-nesting">Bracket nesting (key[a][b])</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="qs-infer" checked={infer} onCheckedChange={setInfer} />
              <Label htmlFor="qs-infer">Coerce numbers &amp; booleans</Label>
            </div>
          </div>
        </Field>
      }
    />
  );
}
