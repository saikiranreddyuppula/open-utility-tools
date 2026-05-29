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
import { parseCsv } from '@/lib/data/csv';

const SAMPLE = 'Name,Role,Score\nAda,admin,98\nLinus,user,72';

export default function CsvToMarkdownTool() {
  const [delim, setDelim] = useState(',');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const rows = parseCsv(input, delim === '\\t' ? '\t' : delim).filter((r) => r.some((c) => c !== ''));
      if (rows.length === 0) return '';
      const cols = Math.max(...rows.map((r) => r.length));
      const pad = (r: string[]) => Array.from({ length: cols }, (_, i) => (r[i] ?? '').replace(/\|/g, '\\|'));
      const header = pad(rows[0]!);
      const lines = [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`];
      for (const r of rows.slice(1)) lines.push(`| ${pad(r).join(' | ')} |`);
      return lines.join('\n');
    },
    [delim]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[delim]}
      inputLabel="CSV"
      outputLabel="Markdown"
      sample={SAMPLE}
      downloadName="table.md"
      downloadMime="text/markdown"
      options={
        <Field label="Delimiter">
          <Select value={delim} onValueChange={setDelim}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value=",">Comma</SelectItem>
              <SelectItem value=";">Semicolon</SelectItem>
              <SelectItem value="\t">Tab</SelectItem>
              <SelectItem value="|">Pipe</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      }
    />
  );
}
