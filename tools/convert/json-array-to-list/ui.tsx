'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type JoinMode = 'newline' | 'comma' | 'custom';

function getByPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function scalarToString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

const SAMPLE =
  '[\n  { "id": 1, "user": { "name": "Ada" } },\n  { "id": 2, "user": { "name": "Linus" } },\n  { "id": 3, "user": { "name": "Ada" } }\n]';

export default function JsonArrayToListTool() {
  const [joinMode, setJoinMode] = useState<JoinMode>('newline');
  const [delimiter, setDelimiter] = useState(', ');
  const [keyPath, setKeyPath] = useState('user.name');
  const [quote, setQuote] = useState(false);
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [dedupe, setDedupe] = useState(false);

  return (
    <TextToolLayout
      deps={[joinMode, delimiter, keyPath, quote, prefix, suffix, dedupe]}
      transform={(input) => {
        if (!input.trim()) return '';
        let data: unknown;
        try {
          data = JSON.parse(input);
        } catch (e) {
          throw new Error(e instanceof Error ? e.message : 'Invalid JSON');
        }
        if (!Array.isArray(data)) throw new Error('Top-level value must be a JSON array.');

        let items = data.map((el): string => {
          if (el !== null && typeof el === 'object' && keyPath.trim()) {
            return scalarToString(getByPath(el, keyPath.trim()));
          }
          return scalarToString(el);
        });

        if (dedupe) {
          const seen = new Set<string>();
          items = items.filter((it) => {
            if (seen.has(it)) return false;
            seen.add(it);
            return true;
          });
        }

        const decorated = items.map((it) => {
          const q = quote ? `"${it.replace(/"/g, '\\"')}"` : it;
          return `${prefix}${q}${suffix}`;
        });

        const sep =
          joinMode === 'newline'
            ? '\n'
            : joinMode === 'comma'
              ? ', '
              : delimiter.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
        return decorated.join(sep);
      }}
      inputLabel="JSON Array"
      outputLabel="List"
      sample={SAMPLE}
      downloadName="list.txt"
      options={
        <>
          <Field label="Join with">
            <Select value={joinMode} onValueChange={(v) => setJoinMode(v as JoinMode)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newline">New line</SelectItem>
                <SelectItem value="comma">Comma</SelectItem>
                <SelectItem value="custom">Custom delimiter</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {joinMode === 'custom' && (
            <Field label="Delimiter (\n, \t ok)">
              <Input
                value={delimiter}
                onChange={(e) => setDelimiter(e.target.value)}
                className="w-28"
              />
            </Field>
          )}
          <Field label="Object key path">
            <Input
              value={keyPath}
              onChange={(e) => setKeyPath(e.target.value)}
              placeholder="e.g. user.name"
              className="w-40"
            />
          </Field>
          <Field label="Item prefix">
            <Input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              className="w-24"
            />
          </Field>
          <Field label="Item suffix">
            <Input
              value={suffix}
              onChange={(e) => setSuffix(e.target.value)}
              className="w-24"
            />
          </Field>
          <Field label="Quote items">
            <Switch checked={quote} onCheckedChange={setQuote} />
          </Field>
          <Field label="Dedupe">
            <Switch checked={dedupe} onCheckedChange={setDedupe} />
          </Field>
        </>
      }
    />
  );
}
