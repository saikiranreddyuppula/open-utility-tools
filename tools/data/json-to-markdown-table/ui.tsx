'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Align = 'left' | 'center' | 'right';

function escapeCell(value: unknown): string {
  let str: string;
  if (value === null || value === undefined) {
    str = '';
  } else if (typeof value === 'object') {
    str = JSON.stringify(value);
  } else {
    str = String(value);
  }
  // Escape pipes and collapse newlines so the table stays valid.
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r\n|\r|\n/g, '<br>');
}

function separatorCell(align: Align): string {
  switch (align) {
    case 'center':
      return ':---:';
    case 'right':
      return '---:';
    default:
      return '---';
  }
}

export default function JsonToMarkdownTableTool() {
  const [align, setAlign] = useState<Align>('left');
  const [prettyPad, setPrettyPad] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';

      let parsed: unknown;
      try {
        parsed = JSON.parse(input);
      } catch (err) {
        throw new Error(`Invalid JSON: ${(err as Error).message}`);
      }

      if (!Array.isArray(parsed)) {
        throw new Error('Input must be a JSON array of objects.');
      }
      if (parsed.length === 0) {
        throw new Error('The array is empty — nothing to render.');
      }

      // Collect the ordered union of keys across all row objects.
      const headers: string[] = [];
      const seen = new Set<string>();
      for (const row of parsed) {
        if (row === null || typeof row !== 'object' || Array.isArray(row)) {
          throw new Error('Every array item must be a plain object.');
        }
        for (const key of Object.keys(row as Record<string, unknown>)) {
          if (!seen.has(key)) {
            seen.add(key);
            headers.push(key);
          }
        }
      }

      if (headers.length === 0) {
        throw new Error('No keys found across the objects.');
      }

      const rows: string[][] = (parsed as Record<string, unknown>[]).map((row) =>
        headers.map((h) => escapeCell(row[h])),
      );

      // Optionally pad each column to a common width for readability.
      const widths = headers.map((header, col) => {
        if (!prettyPad) return 0;
        let w = escapeCell(header).length;
        for (const r of rows) {
          const cell = r[col] ?? '';
          if (cell.length > w) w = cell.length;
        }
        return Math.max(w, 3);
      });

      const pad = (text: string, col: number): string => {
        if (!prettyPad) return text;
        const target = widths[col] ?? text.length;
        return text + ' '.repeat(Math.max(0, target - text.length));
      };

      const padSep = (col: number): string => {
        const base = separatorCell(align);
        if (!prettyPad) return base;
        const target = Math.max(widths[col] ?? base.length, base.length);
        // Keep the alignment colons intact while widening with dashes.
        if (align === 'center') {
          return `:${'-'.repeat(Math.max(1, target - 2))}:`;
        }
        if (align === 'right') {
          return `${'-'.repeat(Math.max(3, target - 1))}:`;
        }
        return '-'.repeat(target);
      };

      const headerLine = `| ${headers.map((h, i) => pad(escapeCell(h), i)).join(' | ')} |`;
      const sepLine = `| ${headers.map((_, i) => padSep(i)).join(' | ')} |`;
      const bodyLines = rows.map(
        (r) => `| ${r.map((c, i) => pad(c, i)).join(' | ')} |`,
      );

      return [headerLine, sepLine, ...bodyLines].join('\n');
    },
    [align, prettyPad],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[align, prettyPad]}
      inputLabel="JSON array"
      outputLabel="Markdown table"
      inputPlaceholder={'[\n  { "name": "Ada", "role": "Engineer" },\n  { "name": "Linus", "role": "Maintainer" }\n]'}
      sample={
        '[\n  { "id": 1, "name": "Ada Lovelace", "active": true },\n  { "id": 2, "name": "Alan Turing", "active": false, "note": "pioneer" }\n]'
      }
      downloadName="table.md"
      downloadMime="text/markdown"
      options={
        <>
          <Field label="Column alignment">
            <Tabs value={align} onValueChange={(v) => setAlign(v as Align)}>
              <TabsList>
                <TabsTrigger value="left">Left</TabsTrigger>
                <TabsTrigger value="center">Center</TabsTrigger>
                <TabsTrigger value="right">Right</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Pad columns">
            <div className="flex h-9 items-center">
              <Switch checked={prettyPad} onCheckedChange={setPrettyPad} />
            </div>
          </Field>
        </>
      }
    />
  );
}
