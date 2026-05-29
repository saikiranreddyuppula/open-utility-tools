'use client';

import { useCallback, useState } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { csvToJson } from '@/lib/data/csv';

const DELIMS: Record<string, string> = { ',': 'Comma', ';': 'Semicolon', '\t': 'Tab', '|': 'Pipe' };

const SAMPLE = 'id,name,role\n1,Ada,admin\n2,Linus,user';

function coerce(v: string): unknown {
  if (v === '') return '';
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

export default function CsvToJsonTool() {
  const [delim, setDelim] = useState(',');
  const [minify, setMinify] = useState(false);
  const [typed, setTyped] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const rows = csvToJson(input, delim);
      const data = typed
        ? rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, coerce(v)])))
        : rows;
      return JSON.stringify(data, null, minify ? undefined : 2);
    },
    [delim, minify, typed]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[delim, minify, typed]}
      inputLabel="CSV"
      outputLabel="JSON"
      inputPlaceholder={'a,b\n1,2'}
      sample={SAMPLE}
      downloadName="data.json"
      downloadMime="application/json"
      options={
        <>
          <Field label="Delimiter">
            <Select value={delim} onValueChange={setDelim}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DELIMS).map(([v, label]) => (
                  <SelectItem key={v} value={v}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Options">
            <div className="flex h-8 items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={typed} onCheckedChange={setTyped} /> infer types
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={minify} onCheckedChange={setMinify} /> minify
              </label>
            </div>
          </Field>
        </>
      }
    />
  );
}
