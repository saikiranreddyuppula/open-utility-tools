'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type ArrayMode = 'index' | 'wildcard' | 'skip';

function inferType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function collectPaths(
  value: unknown,
  prefix: string,
  arrayMode: ArrayMode,
  out: Map<string, string>,
): void {
  const type = inferType(value);
  if (prefix) {
    out.set(prefix, type);
  }

  if (Array.isArray(value)) {
    if (arrayMode === 'skip') return;
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      const seg = arrayMode === 'wildcard' ? '[]' : `[${i}]`;
      const childPrefix = prefix ? `${prefix}${seg}` : seg;
      collectPaths(item, childPrefix, arrayMode, out);
    }
    return;
  }

  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      const safeKey = /^[A-Za-z_$][\w$]*$/.test(key) ? key : `["${key.replace(/"/g, '\\"')}"]`;
      let childPrefix: string;
      if (!prefix) {
        childPrefix = safeKey.startsWith('[') ? safeKey : key;
      } else {
        childPrefix = safeKey.startsWith('[') ? `${prefix}${safeKey}` : `${prefix}.${safeKey}`;
      }
      collectPaths(obj[key], childPrefix, arrayMode, out);
    }
  }
}

export default function JsonExtractKeysTool() {
  const [arrayMode, setArrayMode] = useState<ArrayMode>('wildcard');
  const [showTypes, setShowTypes] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let parsed: unknown;
      try {
        parsed = JSON.parse(input);
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Invalid JSON');
      }

      const out = new Map<string, string>();
      collectPaths(parsed, '', arrayMode, out);

      if (out.size === 0) {
        throw new Error('No key paths found (root value is a scalar).');
      }

      const paths = Array.from(out.keys()).sort((a, b) => a.localeCompare(b));
      return paths
        .map((p) => (showTypes ? `${p}: ${out.get(p) ?? 'unknown'}` : p))
        .join('\n');
    },
    [arrayMode, showTypes],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[arrayMode, showTypes]}
      inputLabel="JSON"
      outputLabel="Key paths"
      sample='{"user":{"name":"Ada","roles":["admin","editor"]},"active":true,"meta":{"count":2}}'
      downloadName="keys.txt"
      options={
        <>
          <Field label="Arrays">
            <Tabs value={arrayMode} onValueChange={(v) => setArrayMode(v as ArrayMode)}>
              <TabsList>
                <TabsTrigger value="wildcard">Wildcard []</TabsTrigger>
                <TabsTrigger value="index">Index [0]</TabsTrigger>
                <TabsTrigger value="skip">Skip</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Types">
            <div className="flex items-center gap-2 pt-1">
              <Switch id="show-types" checked={showTypes} onCheckedChange={setShowTypes} />
              <Label htmlFor="show-types" className="text-sm font-normal">
                Show inferred type
              </Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
