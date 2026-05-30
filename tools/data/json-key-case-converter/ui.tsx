'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Case = 'camel' | 'snake' | 'kebab' | 'pascal' | 'constant';

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Split an identifier into lowercase words, handling camel/snake/kebab/space/acronyms. */
function splitWords(key: string): string[] {
  // Normalize separators to spaces, then break camelCase / acronym boundaries.
  const spaced = key
    .replace(/[_\-\s]+/g, ' ')
    // Boundary between a lowercase/digit and an uppercase: fooBar -> foo Bar
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    // Boundary inside an acronym before a capitalized word: HTMLParser -> HTML Parser
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return spaced
    .split(' ')
    .map((w) => w.trim())
    .filter((w) => w.length > 0)
    .map((w) => w.toLowerCase());
}

function cap(w: string): string {
  if (w.length === 0) return w;
  return (w[0] ?? '').toUpperCase() + w.slice(1);
}

function toCase(key: string, target: Case): string {
  const words = splitWords(key);
  if (words.length === 0) return key;
  switch (target) {
    case 'camel':
      return words.map((w, i) => (i === 0 ? w : cap(w))).join('');
    case 'pascal':
      return words.map(cap).join('');
    case 'snake':
      return words.join('_');
    case 'kebab':
      return words.join('-');
    case 'constant':
      return words.join('_').toUpperCase();
    default:
      return key;
  }
}

export default function JsonKeyCaseConverterTool() {
  const [target, setTarget] = useState<Case>('camel');
  const [intoArrays, setIntoArrays] = useState(true);
  const [preserveUnderscores, setPreserveUnderscores] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let doc: unknown;
      try {
        doc = JSON.parse(input);
      } catch (e) {
        throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
      }

      const collisions: string[] = [];

      const convertKey = (key: string): string => {
        if (preserveUnderscores) {
          const lead = /^_+/.exec(key);
          const prefix = lead ? lead[0] : '';
          const body = key.slice(prefix.length);
          if (body === '') return key;
          return prefix + toCase(body, target);
        }
        return toCase(key, target);
      };

      const walk = (node: unknown): unknown => {
        if (Array.isArray(node)) {
          return intoArrays ? node.map(walk) : node;
        }
        if (isObject(node)) {
          const out: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(node)) {
            const nk = convertKey(k);
            if (nk in out) collisions.push(nk);
            out[nk] = walk(v);
          }
          return out;
        }
        return node;
      };

      const result = walk(doc);
      const body = JSON.stringify(result, null, 2);
      if (collisions.length > 0) {
        const uniq = Array.from(new Set(collisions));
        return `// warning: key collisions after conversion: ${uniq.join(', ')}\n${body}`;
      }
      return body;
    },
    [target, intoArrays, preserveUnderscores],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[target, intoArrays, preserveUnderscores]}
      inputLabel="JSON document"
      outputLabel="Converted keys"
      inputPlaceholder='{"user_name": "Ada"}'
      sample={
        '{\n' +
        '  "user_id": 1,\n' +
        '  "firstName": "Ada",\n' +
        '  "home-address": {\n' +
        '    "ZIP_code": "98101",\n' +
        '    "cityName": "Seattle"\n' +
        '  },\n' +
        '  "tags": [{"tag_label": "vip"}]\n' +
        '}'
      }
      downloadName="converted.json"
      downloadMime="application/json"
      options={
        <>
          <Field label="Target case">
            <Select value={target} onValueChange={(v) => setTarget(v as Case)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="camel">camelCase</SelectItem>
                <SelectItem value="snake">snake_case</SelectItem>
                <SelectItem value="kebab">kebab-case</SelectItem>
                <SelectItem value="pascal">PascalCase</SelectItem>
                <SelectItem value="constant">CONSTANT_CASE</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Recurse into arrays">
            <Switch checked={intoArrays} onCheckedChange={setIntoArrays} />
          </Field>
          <Field label="Preserve leading underscores">
            <Switch checked={preserveUnderscores} onCheckedChange={setPreserveUnderscores} />
          </Field>
        </>
      }
    />
  );
}
