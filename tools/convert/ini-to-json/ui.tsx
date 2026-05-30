'use client';

import { useCallback, useState } from 'react';

import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const SAMPLE = `; app configuration
appName = My App
debug = true
retries = 3

[database]
host = localhost
port = 5432
password = "p@ss;word"

[database.pool]
min = 1
max = 10

[features]
flag = a
flag = b`;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

interface Opts {
  coerce: boolean;
  nested: boolean;
  lowercaseKeys: boolean;
  repeatArrays: boolean;
}

function stripInlineComment(value: string): string {
  // Only strip comments that are NOT inside quotes and preceded by whitespace.
  let inS = false;
  let inD = false;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i] ?? '';
    if (ch === "'" && !inD) inS = !inS;
    else if (ch === '"' && !inS) inD = !inD;
    else if ((ch === ';' || ch === '#') && !inS && !inD) {
      const prev = value[i - 1] ?? ' ';
      if (prev === ' ' || prev === '\t') return value.slice(0, i);
    }
  }
  return value;
}

function unquote(raw: string): { value: string; wasQuoted: boolean } {
  const v = raw.trim();
  if (v.length >= 2) {
    const first = v[0];
    const last = v[v.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      const inner = v.slice(1, -1);
      if (first === '"') {
        // process simple escapes for double-quoted
        const out = inner.replace(/\\(.)/g, (_m, c: string) => {
          if (c === 'n') return '\n';
          if (c === 't') return '\t';
          if (c === 'r') return '\r';
          return c;
        });
        return { value: out, wasQuoted: true };
      }
      return { value: inner, wasQuoted: true };
    }
  }
  return { value: v, wasQuoted: false };
}

function coerceValue(raw: string, wasQuoted: boolean, enabled: boolean): JsonValue {
  if (!enabled || wasQuoted) return raw;
  const t = raw;
  if (t === '') return '';
  const low = t.toLowerCase();
  if (low === 'true') return true;
  if (low === 'false') return false;
  if (low === 'null' || low === 'nil' || low === 'none') return null;
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) {
    if (/^[+-]?0\d+$/.test(t)) return raw;
    const num = Number(t);
    if (Number.isFinite(num)) return num;
  }
  return raw;
}

function setNested(root: JsonObject, path: string[]): JsonObject {
  let cur: JsonObject = root;
  for (const seg of path) {
    const existing = cur[seg];
    if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
      cur = existing as JsonObject;
    } else {
      const obj: JsonObject = {};
      cur[seg] = obj;
      cur = obj;
    }
  }
  return cur;
}

function assignKey(target: JsonObject, key: string, value: JsonValue, repeatArrays: boolean): void {
  if (repeatArrays && Object.prototype.hasOwnProperty.call(target, key)) {
    const prev = target[key];
    if (Array.isArray(prev)) {
      prev.push(value);
    } else if (prev !== undefined) {
      target[key] = [prev, value];
    } else {
      target[key] = value;
    }
    return;
  }
  target[key] = value;
}

function parseIni(text: string, opts: Opts): JsonObject {
  const root: JsonObject = {};
  let current: JsonObject = root;
  const lines = text.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '') continue;
    if (line.startsWith(';') || line.startsWith('#')) continue;

    // section header
    if (line.startsWith('[') && line.endsWith(']')) {
      const name = line.slice(1, -1).trim();
      if (name === '') {
        current = root;
        continue;
      }
      if (opts.nested && name.includes('.')) {
        const segs = name
          .split('.')
          .map((s) => (opts.lowercaseKeys ? s.trim().toLowerCase() : s.trim()))
          .filter((s) => s !== '');
        current = setNested(root, segs);
      } else {
        const secKey = opts.lowercaseKeys ? name.toLowerCase() : name;
        const existing = root[secKey];
        if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
          current = existing as JsonObject;
        } else {
          const obj: JsonObject = {};
          root[secKey] = obj;
          current = obj;
        }
      }
      continue;
    }

    // key=value or key: value
    let sepIdx = -1;
    let sepChar = '=';
    const eq = line.indexOf('=');
    const colon = line.indexOf(':');
    if (eq === -1 && colon === -1) {
      // bare key -> treat as boolean true flag
      const k = opts.lowercaseKeys ? line.toLowerCase() : line;
      assignKey(current, k, opts.coerce ? true : '', opts.repeatArrays);
      continue;
    }
    if (eq !== -1 && (colon === -1 || eq < colon)) {
      sepIdx = eq;
      sepChar = '=';
    } else {
      sepIdx = colon;
      sepChar = ':';
    }
    void sepChar;

    const rawKey = line.slice(0, sepIdx).trim();
    if (rawKey === '') continue;
    const key = opts.lowercaseKeys ? rawKey.toLowerCase() : rawKey;
    const rawValuePart = stripInlineComment(line.slice(sepIdx + 1)).trim();
    const { value: unq, wasQuoted } = unquote(rawValuePart);
    const value = coerceValue(unq, wasQuoted, opts.coerce);
    assignKey(current, key, value, opts.repeatArrays);
  }

  return root;
}

export default function IniToJsonTool() {
  const [coerce, setCoerce] = useState(true);
  const [nested, setNested] = useState(true);
  const [lowercaseKeys, setLowercaseKeys] = useState(false);
  const [repeatArrays, setRepeatArrays] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const result = parseIni(input, { coerce, nested, lowercaseKeys, repeatArrays });
      return JSON.stringify(result, null, 2);
    },
    [coerce, nested, lowercaseKeys, repeatArrays]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[coerce, nested, lowercaseKeys, repeatArrays]}
      inputLabel="INI"
      outputLabel="JSON"
      sample={SAMPLE}
      downloadName="config.json"
      downloadMime="application/json"
      options={
        <>
          <Field label="Type coercion">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={coerce} onCheckedChange={setCoerce} id="ini-coerce" />
              <Label htmlFor="ini-coerce" className="text-xs text-muted-foreground">
                {coerce ? 'numbers/bools' : 'strings only'}
              </Label>
            </div>
          </Field>
          <Field label="Nested sections">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={nested} onCheckedChange={setNested} id="ini-nested" />
              <Label htmlFor="ini-nested" className="text-xs text-muted-foreground">
                {nested ? '[a.b] nests' : 'flat keys'}
              </Label>
            </div>
          </Field>
          <Field label="Lowercase keys">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={lowercaseKeys} onCheckedChange={setLowercaseKeys} id="ini-lc" />
              <Label htmlFor="ini-lc" className="text-xs text-muted-foreground">
                {lowercaseKeys ? 'on' : 'preserve'}
              </Label>
            </div>
          </Field>
          <Field label="Repeated keys">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={repeatArrays} onCheckedChange={setRepeatArrays} id="ini-arr" />
              <Label htmlFor="ini-arr" className="text-xs text-muted-foreground">
                {repeatArrays ? 'merge to array' : 'last wins'}
              </Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
