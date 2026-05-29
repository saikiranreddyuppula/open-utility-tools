'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SAMPLE = `id,name,email,age
1,Alice,alice@example.com,30
2,Bob,bob@example.com,25
3,Carol,carol@example.com,41`;

// Parse a single CSV line honoring quoted fields with embedded commas/quotes.
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

type Mode = 'keep' | 'drop';

export default function CsvColumnSelectorTool() {
  const [input, setInput] = useState('');
  const [columns, setColumns] = useState('');
  const [mode, setMode] = useState<Mode>('keep');

  const result = useMemo<{ output: string; error: string | null; cols: number; rows: number }>(() => {
    if (!input.trim()) return { output: '', error: null, cols: 0, rows: 0 };
    const rows = parseCsv(input);
    const header = rows[0];
    if (!header || header.length === 0) {
      return { output: '', error: 'CSV has no header row.', cols: 0, rows: 0 };
    }

    const spec = columns
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (spec.length === 0) {
      return { output: '', error: 'Enter at least one column name or index.', cols: 0, rows: 0 };
    }

    const resolveOne = (token: string): number => {
      const byName = header.findIndex((h) => h === token);
      if (byName !== -1) return byName;
      const asNum = Number(token);
      if (Number.isFinite(asNum) && Number.isInteger(asNum) && asNum >= 0 && asNum < header.length) {
        return asNum;
      }
      return -1;
    };

    let selected: number[];
    if (mode === 'keep') {
      selected = [];
      for (const token of spec) {
        const idx = resolveOne(token);
        if (idx === -1) {
          return { output: '', error: `Column not found: "${token}"`, cols: 0, rows: 0 };
        }
        selected.push(idx);
      }
    } else {
      const dropSet = new Set<number>();
      for (const token of spec) {
        const idx = resolveOne(token);
        if (idx === -1) {
          return { output: '', error: `Column not found: "${token}"`, cols: 0, rows: 0 };
        }
        dropSet.add(idx);
      }
      selected = header.map((_, i) => i).filter((i) => !dropSet.has(i));
      if (selected.length === 0) {
        return { output: '', error: 'Dropping these columns leaves no columns.', cols: 0, rows: 0 };
      }
    }

    const rebuilt = rows.map((row) => selected.map((i) => row[i] ?? ''));
    return { output: toCsv(rebuilt), error: null, cols: selected.length, rows: rebuilt.length };
  }, [input, columns, mode]);

  return (
    <div className="flex flex-col gap-4">
      <OptionsBar>
        <Field label="Mode" hint="Keep only listed columns, or drop them">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="keep">Keep</TabsTrigger>
              <TabsTrigger value="drop">Drop</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field
          label="Columns"
          hint="Comma-separated header names or 0-based indices; order is preserved when keeping"
          className="flex-1"
        >
          <Input
            value={columns}
            onChange={(e) => setColumns(e.target.value)}
            placeholder="name, email  or  1, 2"
          />
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
          <PanelHeader title="Output CSV">
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

      <StatBar
        items={[
          result.cols > 0 && `${result.cols} column${result.cols === 1 ? '' : 's'}`,
          result.rows > 0 && `${result.rows} rows`,
        ]}
      />
    </div>
  );
}
