'use client';

import { useCallback, useState } from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

function sortDeep(value: unknown, dir: 1 | -1): unknown {
  if (Array.isArray(value)) return value.map((v) => sortDeep(v, dir));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b) * dir)
        .map(([k, v]) => [k, sortDeep(v, dir)])
    );
  }
  return value;
}

export default function JsonSortKeysTool() {
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let data: unknown;
      try {
        data = JSON.parse(input);
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : 'Invalid JSON');
      }
      return JSON.stringify(sortDeep(data, dir === 'asc' ? 1 : -1), null, 2);
    },
    [dir]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[dir]}
      inputLabel="JSON"
      outputLabel="Sorted"
      sample={'{ "name": "Ada", "active": true, "id": 1 }'}
      downloadName="sorted.json"
      downloadMime="application/json"
      options={
        <Field label="Order">
          <Tabs value={dir} onValueChange={(v) => setDir(v as 'asc' | 'desc')}>
            <TabsList>
              <TabsTrigger value="asc">A → Z</TabsTrigger>
              <TabsTrigger value="desc">Z → A</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
