'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Align = 'left' | 'center' | 'right';

const SAMPLE = `Name\tRole\tSalary
Ada Lovelace\tEngineer\t120000
Grace Hopper\tAdmiral\t150000
Alan Turing\tCryptanalyst\t110000`;

function escapeCell(cell: string): string {
  // Escape pipes and collapse newlines (Markdown cells are single-line).
  return cell.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function sepFor(align: Align): string {
  switch (align) {
    case 'left':
      return ':---';
    case 'center':
      return ':---:';
    case 'right':
      return '---:';
    default:
      return '---';
  }
}

export default function TsvToMarkdownTool() {
  const [hasHeader, setHasHeader] = useState(true);
  const [align, setAlign] = useState<Align>('left');

  return (
    <TextToolLayout
      deps={[hasHeader, align]}
      sample={SAMPLE}
      inputLabel="TSV input"
      outputLabel="Markdown table"
      downloadName="table.md"
      downloadMime="text/markdown"
      transform={(input) => {
        if (!input.trim()) return '';
        const lines = input.split(/\r?\n/).filter((l) => l.length > 0);
        if (lines.length === 0) return '';

        const grid: string[][] = lines.map((line) => line.split('\t'));
        const colCount = grid.reduce((m, r) => Math.max(m, r.length), 0);

        const pad = (row: string[]): string[] => {
          const out: string[] = [];
          for (let c = 0; c < colCount; c++) out.push(escapeCell(row[c] ?? ''));
          return out;
        };

        let headerRow: string[];
        let bodyRows: string[][];
        if (hasHeader) {
          headerRow = pad(grid[0] ?? []);
          bodyRows = grid.slice(1).map(pad);
        } else {
          headerRow = Array.from({ length: colCount }, (_, i) => `Column ${i + 1}`);
          bodyRows = grid.map(pad);
        }

        const sep = Array.from({ length: colCount }, () => sepFor(align));
        const lineOf = (cells: string[]) => `| ${cells.join(' | ')} |`;

        const out: string[] = [];
        out.push(lineOf(headerRow));
        out.push(lineOf(sep));
        for (const r of bodyRows) out.push(lineOf(r));
        return out.join('\n');
      }}
      options={
        <>
          <Field label="First row is header">
            <Switch checked={hasHeader} onCheckedChange={setHasHeader} />
          </Field>
          <Field label="Column alignment">
            <Select value={align} onValueChange={(v) => setAlign(v as Align)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      }
    />
  );
}
