'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type DelimKey = 'comma' | 'tab' | 'semicolon' | 'pipe';

const DELIMS: Record<DelimKey, string> = {
  comma: ',',
  tab: '\t',
  semicolon: ';',
  pipe: '|',
};

function parseCSV(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function CsvToHtmlTool() {
  const [delim, setDelim] = useState<DelimKey>('comma');
  const [hasHeader, setHasHeader] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const rows = parseCSV(input, DELIMS[delim]).filter(
        (r) => r.length > 1 || (r.length === 1 && (r[0] ?? '') !== ''),
      );
      if (rows.length === 0) return '';

      const lines: string[] = ['<table>'];
      let bodyStart = 0;

      if (hasHeader) {
        const header = rows[0];
        if (header) {
          lines.push('  <thead>');
          lines.push('    <tr>');
          for (const cell of header) {
            lines.push(`      <th>${escapeHtml(cell)}</th>`);
          }
          lines.push('    </tr>');
          lines.push('  </thead>');
          bodyStart = 1;
        }
      }

      lines.push('  <tbody>');
      for (let i = bodyStart; i < rows.length; i++) {
        const row = rows[i] ?? [];
        lines.push('    <tr>');
        for (const cell of row) {
          lines.push(`      <td>${escapeHtml(cell)}</td>`);
        }
        lines.push('    </tr>');
      }
      lines.push('  </tbody>');
      lines.push('</table>');

      return lines.join('\n');
    },
    [delim, hasHeader],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[delim, hasHeader]}
      inputLabel="CSV"
      outputLabel="HTML table"
      sample={'name,role,active\nAda,admin,true\n"Doe, Jane",editor,false'}
      downloadName="table.html"
      downloadMime="text/html"
      options={
        <>
          <Field label="Delimiter">
            <Tabs value={delim} onValueChange={(v) => setDelim(v as DelimKey)}>
              <TabsList>
                <TabsTrigger value="comma">Comma</TabsTrigger>
                <TabsTrigger value="tab">Tab</TabsTrigger>
                <TabsTrigger value="semicolon">Semicolon</TabsTrigger>
                <TabsTrigger value="pipe">Pipe</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Header">
            <div className="flex items-center gap-2 pt-1">
              <Switch id="has-header" checked={hasHeader} onCheckedChange={setHasHeader} />
              <Label htmlFor="has-header" className="text-sm font-normal">
                First row is header
              </Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
