'use client';

import { useCallback, useState } from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

function queryToJson(input: string): string {
  const q = input.trim().replace(/^[?]/, '');
  if (!q) return '';
  const params = new URLSearchParams(q);
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of params.entries()) {
    if (k in out) {
      const cur = out[k]!;
      out[k] = Array.isArray(cur) ? [...cur, v] : [cur, v];
    } else {
      out[k] = v;
    }
  }
  return JSON.stringify(out, null, 2);
}

function jsonToQuery(input: string): string {
  if (!input.trim()) return '';
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(input);
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : 'Invalid JSON');
  }
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) v.forEach((item) => params.append(k, String(item)));
    else params.append(k, v == null ? '' : String(v));
  }
  return params.toString();
}

export default function QueryParamsTool() {
  const [mode, setMode] = useState<'toJson' | 'toQuery'>('toJson');

  const transform = useCallback(
    (input: string) => (mode === 'toJson' ? queryToJson(input) : jsonToQuery(input)),
    [mode]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode]}
      inputLabel={mode === 'toJson' ? 'Query string' : 'JSON'}
      outputLabel={mode === 'toJson' ? 'JSON' : 'Query string'}
      sample={mode === 'toJson' ? 'a=1&b=hello+world&tag=x&tag=y' : '{\n  "a": "1",\n  "tag": ["x", "y"]\n}'}
      downloadName={mode === 'toJson' ? 'params.json' : 'query.txt'}
      options={
        <Field label="Direction">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'toJson' | 'toQuery')}>
            <TabsList>
              <TabsTrigger value="toJson">Query → JSON</TabsTrigger>
              <TabsTrigger value="toQuery">JSON → Query</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
