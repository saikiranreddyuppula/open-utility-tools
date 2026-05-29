'use client';

import { useCallback, useState } from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

export default function JsonEscapeTool() {
  const [mode, setMode] = useState<'escape' | 'unescape'>('escape');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      if (mode === 'escape') {
        // JSON.stringify wraps in quotes; strip them to show the escaped body.
        const s = JSON.stringify(input);
        return s.slice(1, -1);
      }
      const wrapped = input.startsWith('"') ? input : `"${input}"`;
      try {
        return JSON.parse(wrapped) as string;
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : 'Invalid escaped string');
      }
    },
    [mode]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode]}
      inputLabel={mode === 'escape' ? 'Raw text' : 'Escaped'}
      outputLabel={mode === 'escape' ? 'Escaped' : 'Raw text'}
      sample={mode === 'escape' ? 'Line 1\nTab\there "quoted"' : 'Line 1\\nTab\\there \\"quoted\\"'}
      downloadName="escaped.txt"
      options={
        <Field label="Mode">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'escape' | 'unescape')}>
            <TabsList>
              <TabsTrigger value="escape">Escape</TabsTrigger>
              <TabsTrigger value="unescape">Unescape</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
