'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Op = 'get' | 'set' | 'delete';
type Seg = { kind: 'key'; name: string } | { kind: 'index'; idx: number };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Parse a dot+bracket path like a.b[0].c[-1] into segments. */
function parsePath(path: string): Seg[] {
  const segs: Seg[] = [];
  const parts = path.split('.');
  for (const part of parts) {
    if (part === '') continue;
    // Leading name before any bracket.
    const nameMatch = /^[^[\]]+/.exec(part);
    let rest = part;
    if (nameMatch && nameMatch[0] !== undefined && nameMatch[0] !== '') {
      const name = nameMatch[0];
      segs.push({ kind: 'key', name });
      rest = part.slice(name.length);
    }
    const idxRe = /\[(-?\d+)\]/g;
    let m: RegExpExecArray | null;
    while ((m = idxRe.exec(rest)) !== null) {
      const raw = m[1];
      if (raw === undefined) continue;
      const n = Number(raw);
      if (!Number.isInteger(n)) throw new Error(`Invalid index "[${raw}]" in path`);
      segs.push({ kind: 'index', idx: n });
    }
  }
  if (segs.length === 0) throw new Error('Path is empty.');
  return segs;
}

export default function JsonDotPathGetSetTool() {
  const [op, setOp] = useState<Op>('get');
  const [path, setPath] = useState('user.roles[0]');
  const [rawValue, setRawValue] = useState('"superuser"');
  const [autoCreate, setAutoCreate] = useState(true);
  const [valueAsJson, setValueAsJson] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let doc: unknown;
      try {
        doc = JSON.parse(input);
      } catch (e) {
        throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
      }

      const segs = parsePath(path.trim());

      if (op === 'get') {
        let cur: unknown = doc;
        for (const seg of segs) {
          if (seg.kind === 'key') {
            if (!isObject(cur)) return 'undefined';
            cur = cur[seg.name];
          } else {
            if (!Array.isArray(cur)) return 'undefined';
            const idx = seg.idx < 0 ? cur.length + seg.idx : seg.idx;
            cur = cur[idx];
          }
        }
        return cur === undefined ? 'undefined' : JSON.stringify(cur, null, 2);
      }

      // set / delete need a mutable clone of the root.
      const root: unknown = structuredClone(doc);

      // Parse the value for set.
      let value: unknown = rawValue;
      if (op === 'set') {
        if (valueAsJson) {
          try {
            value = JSON.parse(rawValue);
          } catch {
            value = rawValue; // fall back to raw string
          }
        } else {
          value = rawValue;
        }
      }

      let cur: unknown = root;
      for (let i = 0; i < segs.length; i++) {
        const seg = segs[i];
        if (seg === undefined) break;
        const isLast = i === segs.length - 1;
        const next = segs[i + 1];

        if (seg.kind === 'key') {
          if (!isObject(cur)) throw new Error(`Cannot traverse key "${seg.name}": parent is not an object.`);
          if (isLast) {
            if (op === 'delete') delete cur[seg.name];
            else cur[seg.name] = value;
          } else {
            if (cur[seg.name] === undefined || cur[seg.name] === null) {
              if (op === 'delete') return JSON.stringify(root, null, 2);
              if (!autoCreate) throw new Error(`Missing node at "${seg.name}". Enable auto-create.`);
              cur[seg.name] = next && next.kind === 'index' ? [] : {};
            }
            cur = cur[seg.name];
          }
        } else {
          if (!Array.isArray(cur)) throw new Error(`Cannot index [${seg.idx}]: parent is not an array.`);
          const idx = seg.idx < 0 ? cur.length + seg.idx : seg.idx;
          if (isLast) {
            if (op === 'delete') {
              if (idx >= 0 && idx < cur.length) cur.splice(idx, 1);
            } else {
              cur[idx] = value;
            }
          } else {
            if (cur[idx] === undefined || cur[idx] === null) {
              if (op === 'delete') return JSON.stringify(root, null, 2);
              if (!autoCreate) throw new Error(`Missing element at [${idx}]. Enable auto-create.`);
              cur[idx] = next && next.kind === 'index' ? [] : {};
            }
            cur = cur[idx];
          }
        }
      }

      return JSON.stringify(root, null, 2);
    },
    [op, path, rawValue, autoCreate, valueAsJson],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[op, path, rawValue, autoCreate, valueAsJson]}
      inputLabel="JSON document"
      outputLabel={op === 'get' ? 'Value at path' : 'Modified JSON'}
      inputPlaceholder='{"user": {"roles": ["admin"]}}'
      sample={
        '{\n' +
        '  "user": {\n' +
        '    "name": "Ada",\n' +
        '    "roles": ["admin", "dev"]\n' +
        '  },\n' +
        '  "active": true\n' +
        '}'
      }
      downloadName="result.json"
      downloadMime="application/json"
      options={
        <>
          <Field label="Operation">
            <Tabs value={op} onValueChange={(v) => setOp(v as Op)}>
              <TabsList>
                <TabsTrigger value="get">Get</TabsTrigger>
                <TabsTrigger value="set">Set</TabsTrigger>
                <TabsTrigger value="delete">Delete</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Path" hint="Dot + bracket, e.g. a.b[0].c" className="min-w-[200px] flex-1">
            <Input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="user.roles[0]"
              spellCheck={false}
              className="font-mono"
            />
          </Field>
          {op === 'set' && (
            <>
              <Field label="Value" className="min-w-[180px]">
                <Input
                  value={rawValue}
                  onChange={(e) => setRawValue(e.target.value)}
                  placeholder='"text" or 42 or true'
                  spellCheck={false}
                  className="font-mono"
                />
              </Field>
              <Field label="Parse value as JSON">
                <Switch checked={valueAsJson} onCheckedChange={setValueAsJson} />
              </Field>
              <Field label="Auto-create parents">
                <Switch checked={autoCreate} onCheckedChange={setAutoCreate} />
              </Field>
            </>
          )}
        </>
      }
    />
  );
}
