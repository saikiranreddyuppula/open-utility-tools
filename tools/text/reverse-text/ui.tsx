'use client';

import { useCallback, useState } from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'chars' | 'words' | 'lines';

export default function ReverseTextTool() {
  const [mode, setMode] = useState<Mode>('chars');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      if (mode === 'chars') return [...input].reverse().join('');
      if (mode === 'words') return input.split(/(\s+)/).reverse().join('');
      return input.split('\n').reverse().join('\n');
    },
    [mode]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode]}
      sample={'Hello world\nSecond line'}
      downloadName="reversed.txt"
      options={
        <Field label="Reverse by">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="chars">Characters</TabsTrigger>
              <TabsTrigger value="words">Words</TabsTrigger>
              <TabsTrigger value="lines">Lines</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
