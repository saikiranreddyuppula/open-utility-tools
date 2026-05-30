'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Collision = 'overwrite-last' | 'keep-first' | 'group';

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

export default function JsonArrayToObjectTool() {
  const [keyField, setKeyField] = useState('id');
  const [collision, setCollision] = useState<Collision>('overwrite-last');
  const [removeKey, setRemoveKey] = useState(false);
  const [projectField, setProjectField] = useState('');

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
      const proj = projectField.trim();
      const topKey = kf.split('.')[0] ?? kf;

      const result: Record<string, unknown> = {};

      doc.forEach((el) => {
        if (!isObject(el)) return;
        const rawKey = getByPath(el, kf);
        if (rawKey === undefined) return;
        const k = keyToString(rawKey);

        let value: unknown;
        if (proj) {
          value = getByPath(el, proj);
        } else if (removeKey) {
          const clone: Record<string, unknown> = { ...el };
          delete clone[topKey];
          value = clone;
        } else {
          value = el;
        }

        if (k in result) {
          if (collision === 'keep-first') return;
          if (collision === 'group') {
            const existing = result[k];
            if (Array.isArray(existing)) existing.push(value);
            else result[k] = [existing, value];
            return;
          }
          // overwrite-last
          result[k] = value;
          return;
        }
        if (collision === 'group') {
          result[k] = [value];
          return;
        }
        result[k] = value;
      });

      return JSON.stringify(result, null, 2);
    },
    [keyField, collision, removeKey, projectField],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[keyField, collision, removeKey, projectField]}
      inputLabel="JSON array"
      outputLabel="Keyed object"
      inputPlaceholder='[{"id": 1, "name": "a"}]'
      sample={
        '[\n' +
        '  {"id": 10, "sku": "ABC", "qty": 4},\n' +
        '  {"id": 11, "sku": "DEF", "qty": 1},\n' +
        '  {"id": 12, "sku": "GHI", "qty": 9}\n' +
        ']'
      }
      downloadName="indexed.json"
      downloadMime="application/json"
      options={
        <>
          <Field label="Key field" hint="Dot path" className="min-w-[160px]">
            <Input
              value={keyField}
              onChange={(e) => setKeyField(e.target.value)}
              placeholder="id"
              spellCheck={false}
              className="font-mono"
            />
          </Field>
          <Field
            label="Value-only field (optional)"
            hint="Map key → this field instead of the object"
            className="min-w-[180px]"
          >
            <Input
              value={projectField}
              onChange={(e) => setProjectField(e.target.value)}
              placeholder="e.g. qty"
              spellCheck={false}
              className="font-mono"
            />
          </Field>
          <Field label="Remove key from value" hint="Ignored when projecting a field">
            <Switch checked={removeKey} onCheckedChange={setRemoveKey} />
          </Field>
          <Field label="Collisions">
            <Select value={collision} onValueChange={(v) => setCollision(v as Collision)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overwrite-last">Overwrite (last)</SelectItem>
                <SelectItem value="keep-first">Keep first</SelectItem>
                <SelectItem value="group">Group into arrays</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      }
    />
  );
}
