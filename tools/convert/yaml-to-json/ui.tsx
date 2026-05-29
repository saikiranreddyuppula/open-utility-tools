'use client';

import { useCallback, useState } from 'react';

import { Switch } from '@/components/ui/switch';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { yamlToJson } from '@/lib/data/yaml';

const SAMPLE = 'name: app\nports:\n  - 80\n  - 443\nenv:\n  DEBUG: true';

export default function YamlToJsonTool() {
  const [minify, setMinify] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let data: unknown;
      try {
        data = yamlToJson(input);
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : 'Invalid YAML');
      }
      return JSON.stringify(data, null, minify ? undefined : 2);
    },
    [minify]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[minify]}
      inputLabel="YAML"
      outputLabel="JSON"
      sample={SAMPLE}
      downloadName="out.json"
      downloadMime="application/json"
      options={
        <Field label="Output">
          <div className="flex h-8 items-center gap-2">
            <Switch checked={minify} onCheckedChange={setMinify} id="min" />
            <label htmlFor="min" className="text-xs text-muted-foreground">
              minify
            </label>
          </div>
        </Field>
      }
    />
  );
}
