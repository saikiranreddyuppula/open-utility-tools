'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SAMPLE = `# server config
host = localhost
port = 8080
debug = true
db.user = admin
db.password = s3cret
db.pool.max = 20
features.cache = false
title = My App`;

type Sep = '=' | ':';
type Dir = 'to-json' | 'to-kv';

type JsonVal = string | number | boolean | null | JsonVal[] | { [k: string]: JsonVal };

function coerceValue(raw: string, coerce: boolean): JsonVal {
  if (!coerce) return raw;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  // numbers (avoid coercing things like "1.2.3" or empty)
  if (raw !== '' && /^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(raw)) {
    const num = Number(raw);
    if (Number.isFinite(num)) return num;
  }
  // strip surrounding quotes
  const m = raw.match(/^(['"])([\s\S]*)\1$/);
  if (m) return m[2] ?? '';
  return raw;
}

function setNested(
  root: { [k: string]: JsonVal },
  parts: string[],
  value: JsonVal
): void {
  let node: { [k: string]: JsonVal } = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (key === undefined) return;
    const existing = node[key];
    if (existing === undefined || existing === null || typeof existing !== 'object' || Array.isArray(existing)) {
      const next: { [k: string]: JsonVal } = {};
      node[key] = next;
      node = next;
    } else {
      node = existing as { [k: string]: JsonVal };
    }
  }
  const last = parts[parts.length - 1];
  if (last !== undefined) node[last] = value;
}

function kvToJson(
  input: string,
  sep: Sep,
  coerce: boolean,
  nest: boolean,
  commentPrefix: string,
  pretty: boolean
): string {
  const lines = input.split(/\r?\n/);
  const root: { [k: string]: JsonVal } = {};
  const cp = commentPrefix.trim();
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (cp && line.startsWith(cp)) continue;
    const idx = line.indexOf(sep);
    if (idx === -1) {
      throw new Error(`Line missing "${sep}" separator: "${rawLine.trim()}"`);
    }
    const key = line.slice(0, idx).trim();
    const valRaw = line.slice(idx + 1).trim();
    if (!key) throw new Error(`Empty key in line: "${rawLine.trim()}"`);
    const value = coerceValue(valRaw, coerce);
    if (nest && key.includes('.')) {
      setNested(root, key.split('.'), value);
    } else {
      root[key] = value;
    }
  }
  return JSON.stringify(root, null, pretty ? 2 : undefined);
}

function flatten(
  value: JsonVal,
  prefix: string,
  out: string[],
  sep: Sep,
  nest: boolean
): void {
  if (value !== null && typeof value === 'object' && !Array.isArray(value) && nest) {
    const obj = value as { [k: string]: JsonVal };
    for (const [k, v] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${k}` : k;
      flatten(v, newKey, out, sep, nest);
    }
    return;
  }
  let rendered: string;
  if (value === null) rendered = 'null';
  else if (typeof value === 'object') rendered = JSON.stringify(value);
  else rendered = String(value);
  out.push(`${prefix}${sep} ${rendered}`);
}

function jsonToKv(input: string, sep: Sep, nest: boolean): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error('Input is not valid JSON. Switch direction or fix the JSON.');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Top-level JSON must be an object to flatten into key=value lines.');
  }
  const out: string[] = [];
  for (const [k, v] of Object.entries(parsed as { [k: string]: JsonVal })) {
    flatten(v, k, out, sep, nest);
  }
  return out.join('\n');
}

export default function KeyValueToJsonTool() {
  const [dir, setDir] = useState<Dir>('to-json');
  const [sep, setSep] = useState<Sep>('=');
  const [coerce, setCoerce] = useState(true);
  const [nest, setNestOpt] = useState(true);
  const [comment, setComment] = useState('#');
  const [pretty, setPretty] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      if (dir === 'to-json') return kvToJson(input, sep, coerce, nest, comment, pretty);
      return jsonToKv(input, sep, nest);
    },
    [dir, sep, coerce, nest, comment, pretty]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[dir, sep, coerce, nest, comment, pretty]}
      inputLabel={dir === 'to-json' ? 'key=value lines' : 'JSON object'}
      outputLabel={dir === 'to-json' ? 'JSON' : 'key=value lines'}
      inputPlaceholder={dir === 'to-json' ? 'host = localhost' : '{ "host": "localhost" }'}
      sample={dir === 'to-json' ? SAMPLE : undefined}
      downloadName={dir === 'to-json' ? 'config.json' : 'config.txt'}
      downloadMime={dir === 'to-json' ? 'application/json' : 'text/plain'}
      options={
        <>
          <Field label="Direction">
            <Tabs value={dir} onValueChange={(v) => setDir(v as Dir)}>
              <TabsList>
                <TabsTrigger value="to-json">KV → JSON</TabsTrigger>
                <TabsTrigger value="to-kv">JSON → KV</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Separator">
            <Tabs value={sep} onValueChange={(v) => setSep(v as Sep)}>
              <TabsList>
                <TabsTrigger value="=">=</TabsTrigger>
                <TabsTrigger value=":">:</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Nest dotted keys">
            <div className="flex h-8 items-center gap-2">
              <Switch id="nest" checked={nest} onCheckedChange={setNestOpt} />
              <Label htmlFor="nest" className="text-xs text-muted-foreground">
                a.b.c → nested
              </Label>
            </div>
          </Field>
          {dir === 'to-json' && (
            <>
              <Field label="Coerce types">
                <div className="flex h-8 items-center gap-2">
                  <Switch id="coerce" checked={coerce} onCheckedChange={setCoerce} />
                  <Label htmlFor="coerce" className="text-xs text-muted-foreground">
                    numbers/bool/null
                  </Label>
                </div>
              </Field>
              <Field label="Comment prefix">
                <Input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-20"
                  placeholder="#"
                />
              </Field>
              <Field label="Pretty">
                <div className="flex h-8 items-center gap-2">
                  <Switch id="pretty" checked={pretty} onCheckedChange={setPretty} />
                  <Label htmlFor="pretty" className="text-xs text-muted-foreground">
                    2-space indent
                  </Label>
                </div>
              </Field>
            </>
          )}
        </>
      }
    />
  );
}
