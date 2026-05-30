'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Sep = ':' | '=' | ': ' | 'tab';
type IndexStyle = 'bracket' | 'dot';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

const SAMPLE =
  '{\n  "name": "Demo",\n  "version": 2,\n  "active": true,\n  "owner": { "id": 7, "email": "a@b.io" },\n  "tags": ["x", "y"]\n}';

export default function JsonToKvPairsTool() {
  const [sep, setSep] = useState<Sep>(':');
  const [indexStyle, setIndexStyle] = useState<IndexStyle>('bracket');
  const [quoteStrings, setQuoteStrings] = useState(false);
  const [sortKeys, setSortKeys] = useState(false);
  const [flatten, setFlatten] = useState(true);

  return (
    <TextToolLayout
      deps={[sep, indexStyle, quoteStrings, sortKeys, flatten]}
      transform={(input) => {
        if (!input.trim()) return '';
        let data: unknown;
        try {
          data = JSON.parse(input);
        } catch (e) {
          throw new Error(e instanceof Error ? e.message : 'Invalid JSON');
        }
        if (!isPlainObject(data)) throw new Error('Top-level value must be a JSON object.');

        const separator = sep === 'tab' ? '\t' : sep;

        const renderLeaf = (v: unknown): string => {
          if (v === null) return 'null';
          if (typeof v === 'string') return quoteStrings ? JSON.stringify(v) : v;
          if (typeof v === 'object') return JSON.stringify(v);
          return String(v);
        };

        const pairs: Array<[string, unknown]> = [];

        const walk = (value: unknown, path: string): void => {
          if (Array.isArray(value)) {
            value.forEach((el, i) => {
              const seg = indexStyle === 'bracket' ? `${path}[${i}]` : `${path}.${i}`;
              walk(el, seg);
            });
          } else if (isPlainObject(value)) {
            for (const [k, v] of Object.entries(value)) {
              walk(v, path ? `${path}.${k}` : k);
            }
          } else {
            pairs.push([path, value]);
          }
        };

        if (flatten) {
          walk(data, '');
        } else {
          for (const [k, v] of Object.entries(data)) {
            pairs.push([k, v]);
          }
        }

        const lines = pairs.map(([k, v]) => `${k}${separator}${renderLeaf(v)}`);
        if (sortKeys) lines.sort((a, b) => a.localeCompare(b));
        return lines.join('\n');
      }}
      inputLabel="JSON"
      outputLabel="Key-Value Pairs"
      sample={SAMPLE}
      downloadName="pairs.txt"
      options={
        <>
          <Field label="Separator">
            <Select value={sep} onValueChange={(v) => setSep(v as Sep)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=":">key:value</SelectItem>
                <SelectItem value=": ">key: value</SelectItem>
                <SelectItem value="=">key=value</SelectItem>
                <SelectItem value="tab">key⇥value</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Array index">
            <Select
              value={indexStyle}
              onValueChange={(v) => setIndexStyle(v as IndexStyle)}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bracket">key[i]</SelectItem>
                <SelectItem value="dot">key.i</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Flatten nested">
            <Switch checked={flatten} onCheckedChange={setFlatten} />
          </Field>
          <Field label="Quote strings">
            <Switch checked={quoteStrings} onCheckedChange={setQuoteStrings} />
          </Field>
          <Field label="Sort keys">
            <Switch checked={sortKeys} onCheckedChange={setSortKeys} />
          </Field>
        </>
      }
    />
  );
}
