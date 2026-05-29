'use client';

import { useCallback } from 'react';

import { TextToolLayout } from '@/components/tools/text-tool';

export default function JsonMinifyTool() {
  const transform = useCallback((input: string) => {
    if (!input.trim()) return '';
    try {
      return JSON.stringify(JSON.parse(input));
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }, []);

  return (
    <TextToolLayout
      transform={transform}
      inputLabel="JSON"
      outputLabel="Minified"
      sample={'{\n  "hello": "world",\n  "nums": [1, 2, 3]\n}'}
      downloadName="min.json"
      downloadMime="application/json"
    />
  );
}
