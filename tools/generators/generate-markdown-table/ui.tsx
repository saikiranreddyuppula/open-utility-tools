'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Delimiter = 'auto' | 'comma' | 'tab' | 'pipe';
type Align = 'left' | 'center' | 'right';

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] ?? '';
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const pipes = (firstLine.match(/\|/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  if (tabs >= commas && tabs >= pipes && tabs > 0) return '\t';
  if (pipes >= commas && pipes > 0) return '|';
  return ',';
}

// Minimal CSV row parser supporting double-quoted fields with escaped quotes.
function parseCsvLine(line: string, delim: string): string[] {
  if (delim !== ',') {
    return line.split(delim).map((c) => c.trim());
  }
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] ?? '';
    if (inQuotes) {
      if (ch === '"') {
        if ((line[i + 1] ?? '') === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function escapeCell(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function alignSeparator(align: Align, width: number): string {
  const dashes = '-'.repeat(Math.max(width, 1));
  switch (align) {
    case 'left':
      return `:${dashes}`;
    case 'right':
      return `${dashes}:`;
    case 'center':
      return `:${'-'.repeat(Math.max(width - 1, 1))}:`;
    default:
      return dashes;
  }
}

function pad(s: string, width: number, align: Align): string {
  const diff = width - s.length;
  if (diff <= 0) return s;
  if (align === 'right') return ' '.repeat(diff) + s;
  if (align === 'center') {
    const left = Math.floor(diff / 2);
    return ' '.repeat(left) + s + ' '.repeat(diff - left);
  }
  return s + ' '.repeat(diff);
}

export default function MarkdownTableTool() {
  const [delim, setDelim] = useState<Delimiter>('auto');
  const [align, setAlign] = useState<Align>('left');
  const [firstRowHeader, setFirstRowHeader] = useState<'header' | 'generic'>('header');

  const transform = useCallback(
    (input: string) => {
      const text = input.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
      if (!text.trim()) return '';

      const d = delim === 'auto' ? detectDelimiter(text) : delim === 'comma' ? ',' : delim === 'tab' ? '\t' : '|';

      const rawLines = text.split('\n').filter((l) => l.trim().length > 0);
      let rows = rawLines.map((l) => {
        const cells = parseCsvLine(l, d);
        // For pipe-delimited input, drop leading/trailing empty cells from "| a | b |" syntax.
        if (d === '|') {
          if (cells.length > 0 && (cells[0] ?? '').trim() === '') cells.shift();
          if (cells.length > 0 && (cells[cells.length - 1] ?? '').trim() === '') cells.pop();
        }
        return cells;
      });

      // Skip a markdown separator row like |---|---| if present as the second line.
      rows = rows.filter((r) => !(r.length > 0 && r.every((c) => /^:?-+:?$/.test(c.trim()))));

      if (rows.length === 0) return '';

      const colCount = rows.reduce((m, r) => Math.max(m, r.length), 0);

      let header: string[];
      let body: string[][];
      if (firstRowHeader === 'header') {
        header = rows[0] ?? [];
        body = rows.slice(1);
      } else {
        header = Array.from({ length: colCount }, (_, i) => `Column ${i + 1}`);
        body = rows;
      }

      const normalize = (r: string[]): string[] =>
        Array.from({ length: colCount }, (_, i) => escapeCell((r[i] ?? '').trim()));

      const nHeader = normalize(header);
      const nBody = body.map(normalize);

      // Compute column widths (min 3 to fit "---").
      const widths: number[] = [];
      for (let c = 0; c < colCount; c++) {
        let w = (nHeader[c] ?? '').length;
        for (const r of nBody) w = Math.max(w, (r[c] ?? '').length);
        widths[c] = Math.max(w, 3);
      }

      const renderRow = (cells: string[]): string =>
        `| ${cells.map((cell, i) => pad(cell, widths[i] ?? 3, align)).join(' | ')} |`;

      const sepRow = `| ${widths.map((w) => alignSeparator(align, w)).join(' | ')} |`;

      const lines: string[] = [renderRow(nHeader), sepRow, ...nBody.map(renderRow)];
      return lines.join('\n');
    },
    [delim, align, firstRowHeader],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[delim, align, firstRowHeader]}
      inputLabel="CSV / TSV / pipe-delimited data"
      outputLabel="Markdown table"
      inputPlaceholder={'Name, Role, Years\nAda, Engineer, 12\nGrace, Admiral, 30'}
      sample={'Name, Role, Years\nAda, Engineer, 12\nGrace, Admiral, 30'}
      downloadName="table.md"
      downloadMime="text/markdown"
      options={
        <>
          <Field label="Delimiter">
            <Tabs value={delim} onValueChange={(v) => setDelim(v as Delimiter)}>
              <TabsList>
                <TabsTrigger value="auto">Auto</TabsTrigger>
                <TabsTrigger value="comma">CSV</TabsTrigger>
                <TabsTrigger value="tab">TSV</TabsTrigger>
                <TabsTrigger value="pipe">Pipe</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Alignment">
            <Tabs value={align} onValueChange={(v) => setAlign(v as Align)}>
              <TabsList>
                <TabsTrigger value="left">Left</TabsTrigger>
                <TabsTrigger value="center">Center</TabsTrigger>
                <TabsTrigger value="right">Right</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="First row">
            <Tabs value={firstRowHeader} onValueChange={(v) => setFirstRowHeader(v as 'header' | 'generic')}>
              <TabsList>
                <TabsTrigger value="header">Is header</TabsTrigger>
                <TabsTrigger value="generic">Generate names</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </>
      }
    />
  );
}
