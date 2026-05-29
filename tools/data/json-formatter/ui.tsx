'use client';

import { useCallback, useState } from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'pretty' | 'minify';

const SAMPLE = '{"name":"utility-tools","tags":["fast","private"],"offline":true,"count":227}';

export default function JsonFormatterTool() {
  const [mode, setMode] = useState<Mode>('pretty');
  const [indent, setIndent] = useState('2');
  const [sortKeys, setSortKeys] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let parsed: unknown;
      try {
        parsed = JSON.parse(input);
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : 'Invalid JSON');
      }
      if (sortKeys) parsed = sortDeep(parsed);
      if (mode === 'minify') return JSON.stringify(parsed);
      const space = indent === 'tab' ? '\t' : Number(indent);
      return JSON.stringify(parsed, null, space);
    },
    [mode, indent, sortKeys]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, indent, sortKeys]}
      inputLabel="JSON"
      outputLabel={mode === 'minify' ? 'Minified' : 'Formatted'}
      inputPlaceholder='{ "paste": "your JSON here" }'
      sample={SAMPLE}
      downloadName="formatted.json"
      downloadMime="application/json"
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="pretty">Beautify</TabsTrigger>
                <TabsTrigger value="minify">Minify</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === 'pretty' && (
            <Field label="Indent">
              <Select value={indent} onValueChange={setIndent}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 spaces</SelectItem>
                  <SelectItem value="4">4 spaces</SelectItem>
                  <SelectItem value="tab">Tab</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Sort keys">
            <Tabs value={sortKeys ? 'on' : 'off'} onValueChange={(v) => setSortKeys(v === 'on')}>
              <TabsList>
                <TabsTrigger value="off">No</TabsTrigger>
                <TabsTrigger value="on">A–Z</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </>
      }
    />
  );
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortDeep(v)])
    );
  }
  return value;
}
