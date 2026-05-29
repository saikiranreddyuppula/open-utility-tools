'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SAMPLE = `name,age,score
Bob,25,88
Alice,30,92
Carol,41,75
Dave,22,92`;

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] ?? '';
    if (inQuotes) {
      if (ch === '"') {
        const next = line[i + 1] ?? '';
        if (next === '"') {
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
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string): string[][] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l, idx, arr) => !(l === '' && idx === arr.length - 1))
    .map(parseLine);
}

function formatField(field: string): string {
  return /[",\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
}

function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(formatField).join(',')).join('\n');
}

type SortMode = 'text' | 'numeric';
type Direction = 'asc' | 'desc';

export default function CsvSortTool() {
  const [input, setInput] = useState('');
  const [column, setColumn] = useState('0');
  const [mode, setMode] = useState<SortMode>('text');
  const [dir, setDir] = useState<Direction>('asc');

  const header = useMemo<string[]>(() => {
    if (!input.trim()) return [];
    const rows = parseCsv(input);
    return rows[0] ?? [];
  }, [input]);

  const result = useMemo<{ output: string; error: string | null; rows: number }>(() => {
    if (!input.trim()) return { output: '', error: null, rows: 0 };
    const rows = parseCsv(input);
    const head = rows[0];
    if (!head || head.length === 0) {
      return { output: '', error: 'CSV has no header row.', rows: 0 };
    }

    const colIdx = Number(column);
    if (!Number.isFinite(colIdx) || !Number.isInteger(colIdx) || colIdx < 0 || colIdx >= head.length) {
      return { output: '', error: 'Select a valid column to sort by.', rows: 0 };
    }

    const body = rows.slice(1);
    // Decorate-sort-undecorate for a stable sort across all engines.
    const sign = dir === 'asc' ? 1 : -1;
    const decorated = body.map((row, index) => ({ row, index }));
    decorated.sort((a, b) => {
      const av = a.row[colIdx] ?? '';
      const bv = b.row[colIdx] ?? '';
      let cmp: number;
      if (mode === 'numeric') {
        const an = Number(av);
        const bn = Number(bv);
        const aValid = av.trim() !== '' && Number.isFinite(an);
        const bValid = bv.trim() !== '' && Number.isFinite(bn);
        if (aValid && bValid) {
          cmp = an - bn;
        } else if (aValid) {
          cmp = -1; // numbers sort before non-numbers
        } else if (bValid) {
          cmp = 1;
        } else {
          cmp = av.localeCompare(bv);
        }
      } else {
        cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
      }
      if (cmp !== 0) return cmp * sign;
      return a.index - b.index; // stable tie-break
    });

    const sorted = [head, ...decorated.map((d) => d.row)];
    return { output: toCsv(sorted), error: null, rows: body.length };
  }, [input, column, mode, dir]);

  return (
    <div className="flex flex-col gap-4">
      <OptionsBar>
        <Field label="Sort by column" className="min-w-[12rem]">
          <Select value={column} onValueChange={(v) => setColumn(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select column" />
            </SelectTrigger>
            <SelectContent>
              {header.length === 0 ? (
                <SelectItem value="0">Column 0</SelectItem>
              ) : (
                header.map((h, i) => (
                  <SelectItem key={`${i}-${h}`} value={String(i)}>
                    {h === '' ? `Column ${i}` : h}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Compare as">
          <Tabs value={mode} onValueChange={(v) => setMode(v as SortMode)}>
            <TabsList>
              <TabsTrigger value="text">Text</TabsTrigger>
              <TabsTrigger value="numeric">Numeric</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label="Order">
          <Tabs value={dir} onValueChange={(v) => setDir(v as Direction)}>
            <TabsList>
              <TabsTrigger value="asc">Ascending</TabsTrigger>
              <TabsTrigger value="desc">Descending</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      </OptionsBar>

      <ErrorBanner error={result.error} />

      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <PanelHeader title="Input CSV">
            <Button variant="ghost" size="sm" onClick={() => setInput(SAMPLE)}>
              Load sample
            </Button>
          </PanelHeader>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste CSV with a header row..."
            className="min-h-[280px] font-mono text-sm"
          />
        </Panel>

        <Panel>
          <PanelHeader title="Sorted CSV">
            <CopyButton value={result.output} />
          </PanelHeader>
          <Textarea
            value={result.output}
            readOnly
            placeholder="Result appears here..."
            className="min-h-[280px] font-mono text-sm"
          />
        </Panel>
      </div>

      <StatBar items={[result.rows > 0 && `${result.rows} data rows sorted`]} />
    </div>
  );
}
