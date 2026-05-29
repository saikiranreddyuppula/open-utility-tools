'use client';

import { useCallback } from 'react';

import { TextToolLayout } from '@/components/tools/text-tool';
import { jsonToYaml } from '@/lib/data/yaml';

const SAMPLE = '{\n  "name": "app",\n  "ports": [80, 443],\n  "env": { "DEBUG": true }\n}';

export default function JsonToYamlTool() {
  const transform = useCallback((input: string) => {
    if (!input.trim()) return '';
    let data: unknown;
    try {
      data = JSON.parse(input);
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Invalid JSON');
    }
    return jsonToYaml(data as never);
  }, []);

  return (
    <TextToolLayout
      transform={transform}
      inputLabel="JSON"
      outputLabel="YAML"
      sample={SAMPLE}
      downloadName="out.yaml"
      downloadMime="text/yaml"
    />
  );
}
