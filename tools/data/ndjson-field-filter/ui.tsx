'use client';

import { useCallback, useState } from 'react';

import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SAMPLE = `{"id":1,"name":"Ada","email":"ada@x.io","meta":{"city":"London","zip":"E1"}}
{"id":2,"name":"Bob","email":"bob@x.io","meta":{"city":"Paris","zip":"75001"}}
{"id":3,"name":"Cara","email":"cara@x.io","meta":{"city":"Berlin","zip":"10115"}}`;

type Mode = 'keep' | 'drop' | 'rename';

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function parsePath(path: string): string[] {
  return path
    .split('.')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function isPlainObject(v: unknown): v is Record<string, JsonValue> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function getPath(obj: Record<string, JsonValue>, segs: string[]): {
  found: boolean;
  value: JsonValue;
} {
  let cur: JsonValue = obj;
  for (const seg of segs) {
    if (!isPlainObject(cur) || !(seg in cur)) return { found: false, value: null };
    cur = cur[seg] as JsonValue;
  }
  return { found: true, value: cur };
}

function setPath(
  target: Record<string, JsonValue>,
  segs: string[],
  value: JsonValue
): void {
  let cur: Record<string, JsonValue> = target;
  for (let i = 0; i < segs.length - 1; i += 1) {
    const seg = segs[i] ?? '';
    const next = cur[seg];
    if (!isPlainObject(next)) {
      const fresh: Record<string, JsonValue> = {};
      cur[seg] = fresh;
      cur = fresh;
    } else {
      cur = next;
    }
  }
  const last = segs[segs.length - 1];
  if (last !== undefined) cur[last] = value;
}

function deletePath(target: Record<string, JsonValue>, segs: string[]): void {
  let cur: Record<string, JsonValue> = target;
  for (let i = 0; i < segs.length - 1; i += 1) {
    const seg = segs[i] ?? '';
    const next = cur[seg];
    if (!isPlainObject(next)) return;
    cur = next;
  }
  const last = segs[segs.length - 1];
  if (last !== undefined) delete cur[last];
}

interface RenamePair {
  from: string[];
  toKey: string;
}

function transformRecord(
  record: Record<string, JsonValue>,
  mode: Mode,
  fields: string,
): Record<string, JsonValue> {
  if (mode === 'keep') {
    const paths = fields
      .split(',')
      .map((p) => parsePath(p))
      .filter((p) => p.length > 0);
    const out: Record<string, JsonValue> = {};
    for (const segs of paths) {
      const { found, value } = getPath(record, segs);
      if (found) setPath(out, segs, value);
    }
    return out;
  }
  if (mode === 'drop') {
    const paths = fields
      .split(',')
      .map((p) => parsePath(p))
      .filter((p) => p.length > 0);
    const out = structuredClone(record) as Record<string, JsonValue>;
    for (const segs of paths) deletePath(out, segs);
    return out;
  }
  // rename: pairs "path=newName"
  const pairs: RenamePair[] = [];
  for (const part of fields.split(',')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const from = parsePath(part.slice(0, eq));
    const toKey = part.slice(eq + 1).trim();
    if (from.length > 0 && toKey) pairs.push({ from, toKey });
  }
  const out = structuredClone(record) as Record<string, JsonValue>;
  for (const { from, toKey } of pairs) {
    const { found, value } = getPath(out, from);
    if (!found) continue;
    deletePath(out, from);
    // place renamed key at the same parent level as the original leaf
    const parent = from.slice(0, -1);
    setPath(out, [...parent, toKey], value);
  }
  return out;
}

function process(
  input: string,
  mode: Mode,
  fields: string,
  pretty: boolean,
  keepBlank: boolean
): string {
  const lines = input.split('\n');
  const out: string[] = [];
  let lineNo = 0;
  for (const raw of lines) {
    lineNo += 1;
    if (raw.trim() === '') {
      if (keepBlank) out.push('');
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      out.push(`/* line ${lineNo}: invalid JSON, kept as-is */ ${raw}`);
      continue;
    }
    if (!isPlainObject(parsed)) {
      // non-object record (array/scalar): emit unchanged
      out.push(pretty ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed));
      continue;
    }
    const transformed = transformRecord(parsed, mode, fields);
    out.push(
      pretty ? JSON.stringify(transformed, null, 2) : JSON.stringify(transformed)
    );
  }
  return out.join('\n');
}

export default function NdjsonFieldFilterTool() {
  const [mode, setMode] = useState<Mode>('keep');
  const [fields, setFields] = useState('id, name');
  const [pretty, setPretty] = useState(false);
  const [keepBlank, setKeepBlank] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      if (!fields.trim()) {
        throw new Error('Enter at least one field path.');
      }
      if (mode === 'rename' && !fields.includes('=')) {
        throw new Error('Rename mode expects "path=newName" pairs (comma-separated).');
      }
      return process(input, mode, fields, pretty, keepBlank);
    },
    [mode, fields, pretty, keepBlank]
  );

  const placeholder =
    mode === 'rename' ? 'oldPath=newName, meta.city=cityName' : 'id, name, meta.city';

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, fields, pretty, keepBlank]}
      inputLabel="NDJSON"
      outputLabel="Filtered NDJSON"
      sample={SAMPLE}
      downloadName="filtered.ndjson"
      downloadMime="application/x-ndjson"
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="keep">Keep only</TabsTrigger>
                <TabsTrigger value="drop">Drop</TabsTrigger>
                <TabsTrigger value="rename">Rename</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field
            label={mode === 'rename' ? 'path=newName pairs' : 'Field paths'}
            className="min-w-[280px] flex-1"
          >
            <Input
              value={fields}
              onChange={(e) => setFields(e.target.value)}
              placeholder={placeholder}
              spellCheck={false}
              className="font-mono text-xs"
            />
          </Field>
          <Field label="Pretty per line">
            <Switch checked={pretty} onCheckedChange={setPretty} />
          </Field>
          <Field label="Keep blank lines">
            <Switch checked={keepBlank} onCheckedChange={setKeepBlank} />
          </Field>
        </>
      }
    />
  );
}
