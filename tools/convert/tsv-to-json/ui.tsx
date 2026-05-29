'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const SAMPLE = `name	age	active	city
Ada	36	true	London
Linus	54	false	Portland
Grace	85	true	New York`;

type Json = string | number | boolean | null;

function coerce(raw: string, infer: boolean): Json {
  if (!infer) return raw;
  const t = raw.trim();
  if (t === '') return '';
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  // Numeric: avoid coercing things like phone numbers with leading zeros.
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(t)) {
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  return raw;
}

export default function TsvToJsonTool() {
  const [hasHeader, setHasHeader] = useState(true);
  const [infer, setInfer] = useState(true);
  const [pretty, setPretty] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const lines = input
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .filter((l) => l.length > 0);
      if (lines.length === 0) return '';

      const rows = lines.map((l) => l.split('\t'));
      const colCount = Math.max(...rows.map((r) => r.length));

      const firstRow = rows[0] ?? [];
      const headers = hasHeader
        ? firstRow.map((h, i) => {
            const name = h.trim();
            return name === '' ? `column${i + 1}` : name;
          })
        : Array.from({ length: colCount }, (_, i) => `column${i + 1}`);

      const bodyRows = hasHeader ? rows.slice(1) : rows;

      const out = bodyRows.map((r) => {
        const obj: Record<string, Json> = {};
        for (let i = 0; i < headers.length; i++) {
          const key = headers[i] ?? `column${i + 1}`;
          const cell = r[i] ?? '';
          obj[key] = coerce(cell, infer);
        }
        return obj;
      });

      return JSON.stringify(out, null, pretty ? 2 : 0);
    },
    [hasHeader, infer, pretty],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[hasHeader, infer, pretty]}
      inputLabel="TSV"
      outputLabel="JSON"
      inputPlaceholder="Paste tab-separated data…"
      sample={SAMPLE}
      downloadName="data.json"
      downloadMime="application/json"
      options={
        <Field label="Options">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Switch id="tsv-header" checked={hasHeader} onCheckedChange={setHasHeader} />
              <Label htmlFor="tsv-header">First row is header</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="tsv-infer" checked={infer} onCheckedChange={setInfer} />
              <Label htmlFor="tsv-infer">Coerce numbers &amp; booleans</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="tsv-pretty" checked={pretty} onCheckedChange={setPretty} />
              <Label htmlFor="tsv-pretty">Pretty print</Label>
            </div>
          </div>
        </Field>
      }
    />
  );
}
