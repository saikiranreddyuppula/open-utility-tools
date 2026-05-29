'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Direction = 'to-ndjson' | 'to-array';

const SAMPLE = JSON.stringify(
  [
    { id: 1, name: 'Ada' },
    { id: 2, name: 'Linus' },
    { id: 3, name: 'Grace' },
  ],
  null,
  2,
);

function arrayToNdjson(input: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (e) {
    throw new Error(`Invalid JSON: ${(e as Error).message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Expected a JSON array at the top level to convert to NDJSON.');
  }
  return parsed.map((item) => JSON.stringify(item)).join('\n');
}

function ndjsonToArray(input: string): string {
  const lines = input.split(/\r?\n/);
  const out: unknown[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    const line = raw.trim();
    if (line === '') continue;
    try {
      out.push(JSON.parse(line));
    } catch (e) {
      throw new Error(`Invalid JSON on line ${i + 1}: ${(e as Error).message}`);
    }
  }
  return JSON.stringify(out, null, 2);
}

export default function JsonToNdjsonTool() {
  const [direction, setDirection] = useState<Direction>('to-ndjson');

  const transform = useCallback(
    (input: string) => {
      if (input.trim() === '') return '';
      return direction === 'to-ndjson' ? arrayToNdjson(input) : ndjsonToArray(input);
    },
    [direction],
  );

  const isToNdjson = direction === 'to-ndjson';

  return (
    <TextToolLayout
      transform={transform}
      deps={[direction]}
      inputLabel={isToNdjson ? 'JSON array' : 'NDJSON / JSON Lines'}
      outputLabel={isToNdjson ? 'NDJSON / JSON Lines' : 'JSON array'}
      inputPlaceholder={isToNdjson ? '[ { "id": 1 }, { "id": 2 } ]' : '{"id":1}\n{"id":2}'}
      sample={isToNdjson ? SAMPLE : '{"id":1,"name":"Ada"}\n{"id":2,"name":"Linus"}'}
      downloadName={isToNdjson ? 'output.ndjson' : 'output.json'}
      downloadMime="application/json"
      options={
        <Field label="Direction">
          <Tabs value={direction} onValueChange={(v) => setDirection(v as Direction)}>
            <TabsList>
              <TabsTrigger value="to-ndjson">Array &rarr; NDJSON</TabsTrigger>
              <TabsTrigger value="to-array">NDJSON &rarr; Array</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
