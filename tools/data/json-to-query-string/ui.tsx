'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type ArrayStyle = 'repeat' | 'brackets' | 'indices' | 'comma';

function enc(value: string, encode: boolean): string {
  return encode ? encodeURIComponent(value) : value;
}

function scalarToString(value: unknown): string {
  if (value === null) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  return String(value);
}

export default function JsonToQueryStringTool() {
  const [arrayStyle, setArrayStyle] = useState<ArrayStyle>('repeat');
  const [encode, setEncode] = useState(true);
  const [leadingQuestion, setLeadingQuestion] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let parsed: unknown;
      try {
        parsed = JSON.parse(input);
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Invalid JSON');
      }

      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Input must be a JSON object (key/value pairs).');
      }

      const obj = parsed as Record<string, unknown>;
      const pairs: string[] = [];

      for (const key of Object.keys(obj)) {
        const value = obj[key];

        if (Array.isArray(value)) {
          if (arrayStyle === 'comma') {
            const joined = value.map((v) => scalarToString(v)).join(',');
            pairs.push(`${enc(key, encode)}=${enc(joined, encode)}`);
          } else {
            for (let i = 0; i < value.length; i++) {
              const item = value[i];
              let rawKey: string;
              if (arrayStyle === 'brackets') rawKey = `${key}[]`;
              else if (arrayStyle === 'indices') rawKey = `${key}[${i}]`;
              else rawKey = key;
              pairs.push(`${enc(rawKey, encode)}=${enc(scalarToString(item), encode)}`);
            }
          }
          continue;
        }

        if (value !== null && typeof value === 'object') {
          throw new Error(
            `Value for "${key}" is a nested object; only flat objects and arrays are supported.`,
          );
        }

        pairs.push(`${enc(key, encode)}=${enc(scalarToString(value), encode)}`);
      }

      const qs = pairs.join('&');
      if (!qs) return '';
      return leadingQuestion ? `?${qs}` : qs;
    },
    [arrayStyle, encode, leadingQuestion],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[arrayStyle, encode, leadingQuestion]}
      inputLabel="JSON object"
      outputLabel="Query string"
      sample='{"q":"hello world","page":2,"tags":["news","tech"],"active":true}'
      downloadName="query.txt"
      options={
        <>
          <Field label="Arrays">
            <Tabs value={arrayStyle} onValueChange={(v) => setArrayStyle(v as ArrayStyle)}>
              <TabsList>
                <TabsTrigger value="repeat">key=a&amp;key=b</TabsTrigger>
                <TabsTrigger value="brackets">key[]</TabsTrigger>
                <TabsTrigger value="indices">key[0]</TabsTrigger>
                <TabsTrigger value="comma">key=a,b</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Encode">
            <div className="flex items-center gap-2 pt-1">
              <Switch id="encode" checked={encode} onCheckedChange={setEncode} />
              <Label htmlFor="encode" className="text-sm font-normal">
                URL-encode keys &amp; values
              </Label>
            </div>
          </Field>
          <Field label="Prefix">
            <div className="flex items-center gap-2 pt-1">
              <Switch
                id="leading"
                checked={leadingQuestion}
                onCheckedChange={setLeadingQuestion}
              />
              <Label htmlFor="leading" className="text-sm font-normal">
                Leading &quot;?&quot;
              </Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
