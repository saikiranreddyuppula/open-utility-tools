'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ValueMode = 'whole' | 'field' | 'without-key';
type DupStrategy = 'first' | 'last' | 'array';

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function getByPath(value: unknown, path: string): unknown {
  let cur: unknown = value;
  for (const seg of path.split('.')) {
    if (seg === '') continue;
    if (isObject(cur)) cur = cur[seg];
    else return undefined;
  }
  return cur;
}

function keyToString(v: unknown): string {
  if (v === null || v === undefined) return String(v);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export default function JsonArrayToKeyValueTool() {
  const [keyField, setKeyField] = useState('id');
  const [valueMode, setValueMode] = useState<ValueMode>('whole');
  const [valueField, setValueField] = useState('name');
  const [dup, setDup] = useState<DupStrategy>('last');
  const [indent, setIndent] = useState(2);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let doc: unknown;
      try {
        doc = JSON.parse(input);
      } catch (e) {
        throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
      }
      if (!Array.isArray(doc)) throw new Error('Input must be a JSON array of objects.');

      const kf = keyField.trim();
      if (!kf) throw new Error('Provide a key field.');

      const result: Record<string, unknown> = {};
      const warnings: string[] = [];
      const topKey = kf.split('.')[0] ?? kf;

      doc.forEach((el, i) => {
        if (!isObject(el)) {
          warnings.push(`element ${i} is not an object (skipped)`);
          return;
        }
        const rawKey = getByPath(el, kf);
        if (rawKey === undefined) {
          warnings.push(`element ${i} is missing key field "${kf}"`);
          return;
        }
        const k = keyToString(rawKey);

        let value: unknown;
        if (valueMode === 'whole') {
          value = el;
        } else if (valueMode === 'field') {
          value = getByPath(el, valueField.trim());
        } else {
          const clone: Record<string, unknown> = { ...el };
          delete clone[topKey];
          value = clone;
        }

        if (k in result) {
          if (dup === 'first') {
            return;
          }
          if (dup === 'array') {
            const existing = result[k];
            if (Array.isArray(existing)) existing.push(value);
            else result[k] = [existing, value];
            return;
          }
          // 'last' falls through to overwrite below.
        } else if (dup === 'array') {
          result[k] = [value];
          return;
        }
        result[k] = value;
      });

      const body = JSON.stringify(result, null, indent);
      if (warnings.length > 0) {
        return `// warnings: ${warnings.slice(0, 5).join('; ')}${warnings.length > 5 ? ` … (+${warnings.length - 5} more)` : ''}\n${body}`;
      }
      return body;
    },
    [keyField, valueMode, valueField, dup, indent],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[keyField, valueMode, valueField, dup, indent]}
      inputLabel="JSON array"
      outputLabel="Lookup object"
      inputPlaceholder='[{"id": "a", "name": "Ada"}]'
      sample={
        '[\n' +
        '  {"id": "u1", "name": "Ada", "role": "admin"},\n' +
        '  {"id": "u2", "name": "Linus", "role": "dev"},\n' +
        '  {"id": "u3", "name": "Grace", "role": "dev"}\n' +
        ']'
      }
      downloadName="lookup.json"
      downloadMime="application/json"
      options={
        <>
          <Field label="Key field" hint="Dot path used as the map key" className="min-w-[160px]">
            <Input
              value={keyField}
              onChange={(e) => setKeyField(e.target.value)}
              placeholder="id"
              spellCheck={false}
              className="font-mono"
            />
          </Field>
          <Field label="Value">
            <Select value={valueMode} onValueChange={(v) => setValueMode(v as ValueMode)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whole">Whole object</SelectItem>
                <SelectItem value="field">Single field</SelectItem>
                <SelectItem value="without-key">Object without key</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {valueMode === 'field' && (
            <Field label="Value field" className="min-w-[160px]">
              <Input
                value={valueField}
                onChange={(e) => setValueField(e.target.value)}
                placeholder="name"
                spellCheck={false}
                className="font-mono"
              />
            </Field>
          )}
          <Field label="Duplicate keys">
            <Select value={dup} onValueChange={(v) => setDup(v as DupStrategy)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="first">Keep first</SelectItem>
                <SelectItem value="last">Keep last</SelectItem>
                <SelectItem value="array">Collect into array</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={`Indent: ${indent}`} className="min-w-[160px]">
            <Slider
              value={[indent]}
              min={0}
              max={8}
              step={1}
              onValueChange={(v) => setIndent(v[0] ?? 2)}
            />
          </Field>
        </>
      }
    />
  );
}
