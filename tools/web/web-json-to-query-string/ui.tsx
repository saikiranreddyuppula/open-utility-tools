'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type ArrayStyle = 'bracket' | 'indexed' | 'repeat';

function flatten(
  value: unknown,
  prefix: string,
  arrayStyle: ArrayStyle,
  pairs: [string, string][],
): void {
  if (value === null || value === undefined) {
    // Represent null/undefined as an empty value to keep the key present.
    pairs.push([prefix, '']);
    return;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      // Nothing to emit for an empty array.
      return;
    }
    value.forEach((item, index) => {
      let key: string;
      if (arrayStyle === 'indexed') key = `${prefix}[${index}]`;
      else if (arrayStyle === 'repeat') key = prefix;
      else key = `${prefix}[]`;
      flatten(item, key, arrayStyle, pairs);
    });
    return;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return;
    }
    for (const [k, v] of entries) {
      const key = prefix ? `${prefix}[${k}]` : k;
      flatten(v, key, arrayStyle, pairs);
    }
    return;
  }

  // Primitive: string, number, boolean.
  pairs.push([prefix, String(value)]);
}

export default function JsonToQueryStringTool() {
  const [arrayStyle, setArrayStyle] = useState<ArrayStyle>('bracket');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';

      let parsed: unknown;
      try {
        parsed = JSON.parse(input);
      } catch {
        throw new Error('Invalid JSON: could not parse the input.');
      }

      if (parsed === null || typeof parsed !== 'object') {
        throw new Error('Input must be a JSON object or array, not a single value.');
      }

      const pairs: [string, string][] = [];
      flatten(parsed, '', arrayStyle, pairs);

      const params = new URLSearchParams();
      for (const [k, v] of pairs) {
        if (!k) continue;
        params.append(k, v);
      }

      return params.toString();
    },
    [arrayStyle],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[arrayStyle]}
      inputLabel="JSON object"
      outputLabel="Query string"
      inputPlaceholder='{"q":"hello","tags":["js","ts"],"user":{"id":7}}'
      sample={
        '{\n  "q": "hello world",\n  "page": 2,\n  "tags": ["js", "ts"],\n  "filter": { "year": 2024, "active": true }\n}'
      }
      downloadName="query.txt"
      options={
        <Field label="Array style" hint="How array values are keyed">
          <Tabs value={arrayStyle} onValueChange={(v) => setArrayStyle(v as ArrayStyle)}>
            <TabsList>
              <TabsTrigger value="bracket">key[]</TabsTrigger>
              <TabsTrigger value="indexed">key[0]</TabsTrigger>
              <TabsTrigger value="repeat">key=…</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
