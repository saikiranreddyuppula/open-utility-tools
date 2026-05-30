'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Direction = 'to-array' | 'to-ndjson';

const SAMPLE_NDJSON = ['{"id":1,"name":"Ada"}', '', '{"id":2,"name":"Linus"}', '{"id":3,"name":"Grace"}'].join('\n');
const SAMPLE_ARRAY = JSON.stringify(
  [
    { id: 1, name: 'Ada' },
    { id: 2, name: 'Linus' },
    { id: 3, name: 'Grace' },
  ],
  null,
  2,
);

function ndjsonToArray(input: string, skipMalformed: boolean, pretty: boolean): string {
  const lines = input.split(/\r?\n/);
  const out: unknown[] = [];
  const errors: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = (lines[i] ?? '').trim();
    if (raw === '') continue;
    try {
      out.push(JSON.parse(raw));
    } catch (e) {
      if (skipMalformed) continue;
      errors.push(`Line ${i + 1}: ${(e as Error).message}`);
    }
  }
  if (errors.length > 0) {
    throw new Error(`Malformed line(s):\n${errors.join('\n')}`);
  }
  return JSON.stringify(out, null, pretty ? 2 : undefined);
}

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

export default function NdjsonToJsonArrayTool() {
  const [direction, setDirection] = useState<Direction>('to-array');
  const [pretty, setPretty] = useState(true);
  const [skipMalformed, setSkipMalformed] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (input.trim() === '') return '';
      return direction === 'to-array'
        ? ndjsonToArray(input, skipMalformed, pretty)
        : arrayToNdjson(input);
    },
    [direction, pretty, skipMalformed],
  );

  const toArray = direction === 'to-array';

  return (
    <TextToolLayout
      transform={transform}
      deps={[direction, pretty, skipMalformed]}
      inputLabel={toArray ? 'NDJSON / JSON Lines' : 'JSON array'}
      outputLabel={toArray ? 'JSON array' : 'NDJSON / JSON Lines'}
      inputPlaceholder={toArray ? '{"id":1}\n{"id":2}' : '[ { "id": 1 }, { "id": 2 } ]'}
      sample={toArray ? SAMPLE_NDJSON : SAMPLE_ARRAY}
      downloadName={toArray ? 'output.json' : 'output.ndjson'}
      downloadMime="application/json"
      options={
        <>
          <Field label="Direction">
            <Tabs value={direction} onValueChange={(v) => setDirection(v as Direction)}>
              <TabsList>
                <TabsTrigger value="to-array">NDJSON &rarr; Array</TabsTrigger>
                <TabsTrigger value="to-ndjson">Array &rarr; NDJSON</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {toArray ? (
            <Field label="Options">
              <div className="flex h-8 items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs">
                  <Switch checked={pretty} onCheckedChange={setPretty} /> pretty
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <Switch checked={skipMalformed} onCheckedChange={setSkipMalformed} /> skip bad lines
                </label>
              </div>
            </Field>
          ) : null}
        </>
      }
    />
  );
}
