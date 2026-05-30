'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SAMPLE = `# user record
name: Ada Lovelace
role: engineer
age: 36
active: true
tag: math
tag: history
address.city: London
address.zip: "EC1A"`;

type SepMode = 'auto' | 'colon' | 'equals' | 'tab' | 'whitespace';

type JsonVal = string | number | boolean | null | JsonVal[] | { [k: string]: JsonVal };

/** Find the index of the separator for a given line, returns -1 if none. */
function findSep(line: string, mode: SepMode): { idx: number; len: number } | null {
  if (mode === 'colon') {
    const i = line.indexOf(':');
    return i === -1 ? null : { idx: i, len: 1 };
  }
  if (mode === 'equals') {
    const i = line.indexOf('=');
    return i === -1 ? null : { idx: i, len: 1 };
  }
  if (mode === 'tab') {
    const i = line.indexOf('\t');
    return i === -1 ? null : { idx: i, len: 1 };
  }
  if (mode === 'whitespace') {
    const m = line.match(/\s/);
    if (!m || m.index === undefined) return null;
    // consume the run of whitespace as the separator
    const start = m.index;
    let end = start;
    while (end < line.length && /\s/.test(line[end] ?? '')) end++;
    return { idx: start, len: end - start };
  }
  // auto: pick the earliest of ':', '=', tab
  const candidates: number[] = [];
  const ci = line.indexOf(':');
  const ei = line.indexOf('=');
  const ti = line.indexOf('\t');
  if (ci !== -1) candidates.push(ci);
  if (ei !== -1) candidates.push(ei);
  if (ti !== -1) candidates.push(ti);
  if (candidates.length === 0) {
    // fall back to first whitespace
    const m = line.match(/\s/);
    if (!m || m.index === undefined) return null;
    const start = m.index;
    let end = start;
    while (end < line.length && /\s/.test(line[end] ?? '')) end++;
    return { idx: start, len: end - start };
  }
  return { idx: Math.min(...candidates), len: 1 };
}

function coerceValue(raw: string, coerce: boolean): JsonVal {
  // unquote first
  const q = raw.match(/^(['"])([\s\S]*)\1$/);
  if (q) return q[2] ?? '';
  if (!coerce) return raw;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  if (raw !== '' && /^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(raw)) {
    const num = Number(raw);
    if (Number.isFinite(num)) return num;
  }
  return raw;
}

function assign(
  node: { [k: string]: JsonVal },
  key: string,
  value: JsonVal,
  asArray: boolean
): void {
  if (!asArray) {
    node[key] = value;
    return;
  }
  const existing = node[key];
  if (existing === undefined) {
    node[key] = value;
  } else if (Array.isArray(existing)) {
    existing.push(value);
  } else {
    node[key] = [existing, value];
  }
}

function setNested(
  root: { [k: string]: JsonVal },
  parts: string[],
  value: JsonVal,
  asArray: boolean
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
  if (last !== undefined) assign(node, last, value, asArray);
}

export default function KvPairsToJsonTool() {
  const [sepMode, setSepMode] = useState<SepMode>('auto');
  const [coerce, setCoerce] = useState(true);
  const [nest, setNestOpt] = useState(true);
  const [asArray, setAsArray] = useState(true);
  const [pretty, setPretty] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const lines = input.split(/\r?\n/);
      const root: { [k: string]: JsonVal } = {};
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        if (line.startsWith('#')) continue;
        const sep = findSep(line, sepMode);
        if (!sep) throw new Error(`No separator found in line: "${line}"`);
        const key = line.slice(0, sep.idx).trim();
        const valRaw = line.slice(sep.idx + sep.len).trim();
        if (!key) throw new Error(`Empty key in line: "${line}"`);
        const value = coerceValue(valRaw, coerce);
        if (nest && key.includes('.')) {
          setNested(root, key.split('.'), value, asArray);
        } else {
          assign(root, key, value, asArray);
        }
      }
      return JSON.stringify(root, null, pretty ? 2 : undefined);
    },
    [sepMode, coerce, nest, asArray, pretty]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[sepMode, coerce, nest, asArray, pretty]}
      inputLabel="Key-value lines"
      outputLabel="JSON"
      inputPlaceholder="name: Ada"
      sample={SAMPLE}
      downloadName="data.json"
      downloadMime="application/json"
      options={
        <>
          <Field label="Separator">
            <Select value={sepMode} onValueChange={(v) => setSepMode(v as SepMode)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-detect</SelectItem>
                <SelectItem value="colon">Colon (:)</SelectItem>
                <SelectItem value="equals">Equals (=)</SelectItem>
                <SelectItem value="tab">Tab</SelectItem>
                <SelectItem value="whitespace">Whitespace</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Coerce types">
            <div className="flex h-8 items-center gap-2">
              <Switch id="coerce" checked={coerce} onCheckedChange={setCoerce} />
              <Label htmlFor="coerce" className="text-xs text-muted-foreground">
                numbers/bool/null
              </Label>
            </div>
          </Field>
          <Field label="Nest dotted keys">
            <div className="flex h-8 items-center gap-2">
              <Switch id="nest" checked={nest} onCheckedChange={setNestOpt} />
              <Label htmlFor="nest" className="text-xs text-muted-foreground">
                a.b → nested
              </Label>
            </div>
          </Field>
          <Field label="Repeated keys">
            <div className="flex h-8 items-center gap-2">
              <Switch id="arr" checked={asArray} onCheckedChange={setAsArray} />
              <Label htmlFor="arr" className="text-xs text-muted-foreground">
                collect as array
              </Label>
            </div>
          </Field>
          <Field label="Format">
            <div className="flex h-8 items-center gap-2">
              <Switch id="pretty" checked={pretty} onCheckedChange={setPretty} />
              <Label htmlFor="pretty" className="text-xs text-muted-foreground">
                pretty
              </Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
