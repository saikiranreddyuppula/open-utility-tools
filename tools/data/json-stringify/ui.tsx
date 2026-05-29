'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Direction = 'stringify' | 'parse';

export default function JsonStringifyTool() {
  const [direction, setDirection] = useState<Direction>('stringify');

  const transform = useCallback(
    (input: string) => {
      if (input === '') return '';
      if (direction === 'stringify') {
        return JSON.stringify(input);
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(input.trim());
      } catch (e) {
        throw new Error(`Invalid JSON: ${(e as Error).message}`);
      }
      if (typeof parsed !== 'string') {
        throw new Error('Input must be a quoted JSON string (e.g. "hello\\nworld").');
      }
      return parsed;
    },
    [direction],
  );

  const isStringify = direction === 'stringify';

  return (
    <TextToolLayout
      transform={transform}
      deps={[direction]}
      inputLabel={isStringify ? 'Raw text' : 'JSON string literal'}
      outputLabel={isStringify ? 'JSON string literal' : 'Raw text'}
      inputPlaceholder={isStringify ? 'Hello\nworld\t"quoted"' : '"Hello\\nworld"'}
      sample={isStringify ? 'Hello "world"\nLine two\tTabbed' : '"Hello \\"world\\"\\nLine two\\tTabbed"'}
      downloadName={isStringify ? 'stringified.txt' : 'parsed.txt'}
      options={
        <Field label="Direction">
          <Tabs value={direction} onValueChange={(v) => setDirection(v as Direction)}>
            <TabsList>
              <TabsTrigger value="stringify">Stringify</TabsTrigger>
              <TabsTrigger value="parse">Parse</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
