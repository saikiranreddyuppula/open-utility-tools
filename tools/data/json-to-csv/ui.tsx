'use client';

import { useCallback, useState } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { jsonToCsv } from '@/lib/data/csv';

const DELIMS: Record<string, string> = { ',': 'Comma', ';': 'Semicolon', '\t': 'Tab', '|': 'Pipe' };

const SAMPLE = JSON.stringify(
  [
    { id: 1, name: 'Ada', role: 'admin' },
    { id: 2, name: 'Linus', role: 'user', active: true },
  ],
  null,
  2
);

export default function JsonToCsvTool() {
  const [delim, setDelim] = useState(',');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let data: unknown;
      try {
        data = JSON.parse(input);
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : 'Invalid JSON');
      }
      return jsonToCsv(data, delim);
    },
    [delim]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[delim]}
      inputLabel="JSON"
      outputLabel="CSV"
      inputPlaceholder='[{ "a": 1, "b": 2 }]'
      sample={SAMPLE}
      downloadName="data.csv"
      downloadMime="text/csv"
      options={
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
      }
    />
  );
}
