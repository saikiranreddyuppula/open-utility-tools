'use client';

import { useCallback } from 'react';

import { TextToolLayout } from '@/components/tools/text-tool';
import { jsonToTypeScript } from '@/lib/data/json-to-ts';

const SAMPLE = JSON.stringify(
  { id: 1, name: 'Ada', tags: ['a', 'b'], profile: { active: true, score: 9.5 } },
  null,
  2
);

export default function JsonToTypeScriptTool() {
  const transform = useCallback((input: string) => {
    if (!input.trim()) return '';
    let data: unknown;
    try {
      data = JSON.parse(input);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Invalid JSON');
    }
    return jsonToTypeScript(data, 'Root');
  }, []);

  return (
    <TextToolLayout
      transform={transform}
      inputLabel="JSON"
      outputLabel="TypeScript"
      sample={SAMPLE}
      downloadName="types.ts"
      downloadMime="text/typescript"
    />
  );
}
