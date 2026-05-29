'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SAMPLE = `| Name  | Role    | City      |
| ----- | ------- | --------- |
| Ada   | Engineer| London    |
| Linus | Maintainer | Portland |
| Grace | Admiral | New York  |`;

type Delimiter = ',' | '\t' | ';';

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && s[i + 1] === '|') {
      cur += '|';
      i++;
    } else if (ch === '|') {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

function isAlignmentRow(line: string): boolean {
  const s = line.trim();
  if (!s.includes('-')) return false;
  return /^\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?$/.test(s);
}

function csvCell(value: string, delim: string): string {
  const needsQuote =
    value.includes(delim) ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r');
  if (needsQuote) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default function MarkdownTableToCsvTool() {
  const [delim, setDelim] = useState<Delimiter>(',');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const lines = input
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .filter((l) => l.includes('|') && l.trim() !== '');

      if (lines.length === 0) {
        throw new Error('No Markdown table rows found. Each row must use pipes (|).');
      }

      const rows = lines
        .filter((l) => !isAlignmentRow(l))
        .map((l) => splitRow(l));

      if (rows.length === 0) {
        throw new Error('No data rows found after the alignment separator.');
      }

      const colCount = Math.max(...rows.map((r) => r.length));
      const csvLines = rows.map((r) => {
        const padded = [...r];
        while (padded.length < colCount) padded.push('');
        return padded.map((c) => csvCell(c, delim)).join(delim);
      });

      return csvLines.join('\n');
    },
    [delim],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[delim]}
      inputLabel="Markdown table"
      outputLabel="CSV"
      inputPlaceholder="Paste a Markdown table…"
      sample={SAMPLE}
      downloadName="table.csv"
      downloadMime="text/csv"
      options={
        <Field label="Delimiter">
          <Tabs value={delim} onValueChange={(v) => setDelim(v as Delimiter)}>
            <TabsList>
              <TabsTrigger value=",">Comma</TabsTrigger>
              <TabsTrigger value=";">Semicolon</TabsTrigger>
              <TabsTrigger value={'\t'}>Tab</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
