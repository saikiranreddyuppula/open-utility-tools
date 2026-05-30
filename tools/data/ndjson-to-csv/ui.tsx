'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type KeyOrder = 'first-seen' | 'sorted';

const DELIMS: Record<string, string> = { ',': 'Comma', ';': 'Semicolon', '\t': 'Tab', '|': 'Pipe' };

const SAMPLE = [
  '{"id":1,"name":"Ada","tags":["math","logic"]}',
  '{"id":2,"name":"Linus","email":"linus@example.com"}',
  '{"id":3,"name":"Grace","address":{"city":"NYC","zip":"10001"}}',
].join('\n');

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Flatten nested objects/arrays into dot/bracket paths. */
function flatten(obj: Record<string, unknown>, prefix: string, out: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (isPlainObject(v)) {
      flatten(v, path, out);
    } else if (Array.isArray(v)) {
      let hasNested = false;
      v.forEach((item, i) => {
        if (isPlainObject(item)) {
          hasNested = true;
          flatten(item, `${path}.${i}`, out);
        }
      });
      if (!hasNested) {
        v.forEach((item, i) => {
          out[`${path}.${i}`] = item;
        });
      }
    } else {
      out[path] = v;
    }
  }
}

function cellValue(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}

/** RFC 4180 quoting for a single field given a delimiter. */
function quote(field: string, delim: string): string {
  const needs =
    field.includes(delim) || field.includes('"') || field.includes('\n') || field.includes('\r');
  if (!needs) return field;
  return `"${field.replace(/"/g, '""')}"`;
}

export default function NdjsonToCsvTool() {
  const [keyOrder, setKeyOrder] = useState<KeyOrder>('first-seen');
  const [doFlatten, setDoFlatten] = useState(true);
  const [delim, setDelim] = useState(',');
  const [missing, setMissing] = useState('');

  const transform = useCallback(
    (input: string) => {
      if (input.trim() === '') return '';
      const lines = input.split(/\r?\n/);
      const records: Record<string, unknown>[] = [];
      const errors: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const raw = (lines[i] ?? '').trim();
        if (raw === '') continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch (e) {
          errors.push(`Line ${i + 1}: ${(e as Error).message}`);
          continue;
        }
        if (!isPlainObject(parsed)) {
          errors.push(`Line ${i + 1}: expected a JSON object, got ${Array.isArray(parsed) ? 'array' : typeof parsed}`);
          continue;
        }
        if (doFlatten) {
          const out: Record<string, unknown> = {};
          flatten(parsed, '', out);
          records.push(out);
        } else {
          records.push(parsed);
        }
      }

      if (errors.length > 0) {
        throw new Error(`Malformed line(s):\n${errors.join('\n')}`);
      }
      if (records.length === 0) {
        throw new Error('No valid JSON objects found.');
      }

      // Union of keys, first-seen order.
      const seen: string[] = [];
      const set = new Set<string>();
      for (const rec of records) {
        for (const k of Object.keys(rec)) {
          if (!set.has(k)) {
            set.add(k);
            seen.push(k);
          }
        }
      }
      const columns = keyOrder === 'sorted' ? [...seen].sort((a, b) => a.localeCompare(b)) : seen;

      const headerRow = columns.map((c) => quote(c, delim)).join(delim);
      const dataRows = records.map((rec) =>
        columns
          .map((c) => {
            const present = Object.prototype.hasOwnProperty.call(rec, c);
            const cell = present ? cellValue(rec[c]) : missing;
            return quote(cell, delim);
          })
          .join(delim),
      );

      return [headerRow, ...dataRows].join('\n');
    },
    [keyOrder, doFlatten, delim, missing],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[keyOrder, doFlatten, delim, missing]}
      inputLabel="NDJSON / JSON Lines"
      outputLabel="CSV"
      inputPlaceholder={'{"id":1}\n{"id":2}'}
      sample={SAMPLE}
      downloadName="output.csv"
      downloadMime="text/csv"
      options={
        <>
          <Field label="Key order">
            <Tabs value={keyOrder} onValueChange={(v) => setKeyOrder(v as KeyOrder)}>
              <TabsList>
                <TabsTrigger value="first-seen">First seen</TabsTrigger>
                <TabsTrigger value="sorted">Sorted</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Delimiter">
            <Tabs value={delim} onValueChange={setDelim}>
              <TabsList>
                {Object.entries(DELIMS).map(([v, label]) => (
                  <TabsTrigger key={v} value={v}>
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Missing cell value" className="w-40">
            <Input value={missing} onChange={(e) => setMissing(e.target.value)} placeholder="(empty)" />
          </Field>
          <Field label="Flatten nested">
            <label className="flex h-8 items-center gap-1.5 text-xs">
              <Switch checked={doFlatten} onCheckedChange={setDoFlatten} /> a.b / a.0 paths
            </label>
          </Field>
        </>
      }
    />
  );
}
