'use client';

import { useCallback, useState } from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Dir = 'csv2tsv' | 'tsv2csv';

/** Parse delimited text into rows of fields, honoring RFC-4180-style quoting. */
function parseDelimited(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  let sawContent = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < n) {
    const c = text[i] ?? '';
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      sawContent = true;
      i++;
      continue;
    }
    if (c === delim) {
      sawContent = true;
      pushField();
      i++;
      continue;
    }
    if (c === '\r') {
      // handle CRLF / CR line endings
      if (text[i + 1] === '\n') i++;
      pushRow();
      sawContent = false;
      i++;
      continue;
    }
    if (c === '\n') {
      pushRow();
      sawContent = false;
      i++;
      continue;
    }
    field += c;
    sawContent = true;
    i++;
  }
  // flush trailing field/row unless input ended exactly on a newline
  if (sawContent || field.length > 0 || row.length > 0) {
    pushRow();
  }
  return rows;
}

/** Serialize rows back to delimited text, quoting fields when required. */
function serialize(rows: string[][], delim: string): string {
  const needsQuote = (f: string) => f.includes(delim) || f.includes('"') || f.includes('\n') || f.includes('\r');
  return rows
    .map((row) =>
      row
        .map((f) => (needsQuote(f) ? `"${f.replace(/"/g, '""')}"` : f))
        .join(delim)
    )
    .join('\n');
}

export default function CsvToTsvTool() {
  const [dir, setDir] = useState<Dir>('csv2tsv');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      const fromDelim = dir === 'csv2tsv' ? ',' : '\t';
      const toDelim = dir === 'csv2tsv' ? '\t' : ',';
      const rows = parseDelimited(input, fromDelim);
      return serialize(rows, toDelim);
    },
    [dir]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[dir]}
      inputLabel={dir === 'csv2tsv' ? 'CSV' : 'TSV'}
      outputLabel={dir === 'csv2tsv' ? 'TSV' : 'CSV'}
      sample={
        dir === 'csv2tsv'
          ? 'name,city,note\nAda,"London, UK","said ""hi"""\nGrace,"New York",ok'
          : 'name\tcity\tnote\nAda\tLondon, UK\tsaid "hi"'
      }
      downloadName={dir === 'csv2tsv' ? 'data.tsv' : 'data.csv'}
      downloadMime={dir === 'csv2tsv' ? 'text/tab-separated-values' : 'text/csv'}
      options={
        <Field label="Direction">
          <Tabs value={dir} onValueChange={(v) => setDir(v as Dir)}>
            <TabsList>
              <TabsTrigger value="csv2tsv">CSV → TSV</TabsTrigger>
              <TabsTrigger value="tsv2csv">TSV → CSV</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
