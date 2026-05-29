'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SAMPLE = `id,name,city
1,Alice,NYC
2,Bob,LA
1,Alice,NYC
3,Carol,LA
4,Bob,SF`;

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

type Mode = 'full' | 'keys';

export default function CsvDedupeTool() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<Mode>('full');
  const [keys, setKeys] = useState('');

  const result = useMemo<{
    output: string;
    error: string | null;
    kept: number;
    removed: number;
  }>(() => {
    if (!input.trim()) return { output: '', error: null, kept: 0, removed: 0 };
    const rows = parseCsv(input);
    const header = rows[0];
    if (!header || header.length === 0) {
      return { output: '', error: 'CSV has no header row.', kept: 0, removed: 0 };
    }

    let keyIdx: number[] | null = null;
    if (mode === 'keys') {
      const spec = keys
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (spec.length === 0) {
        return { output: '', error: 'Enter at least one key column name or index.', kept: 0, removed: 0 };
      }
      const resolved: number[] = [];
      for (const token of spec) {
        let idx = header.findIndex((h) => h === token);
        if (idx === -1) {
          const asNum = Number(token);
          if (Number.isFinite(asNum) && Number.isInteger(asNum) && asNum >= 0 && asNum < header.length) {
            idx = asNum;
          }
        }
        if (idx === -1) {
          return { output: '', error: `Column not found: "${token}"`, kept: 0, removed: 0 };
        }
        resolved.push(idx);
      }
      keyIdx = resolved;
    }

    // Signature uses a unit-separator join so commas in fields don't collide.
    const signatureOf = (row: string[]): string => {
      if (keyIdx) {
        return keyIdx.map((i) => row[i] ?? '').join('');
      }
      return row.join('');
    };

    const body = rows.slice(1);
    const seen = new Set<string>();
    const unique: string[][] = [];
    for (const row of body) {
      const sig = signatureOf(row);
      if (seen.has(sig)) continue;
      seen.add(sig);
      unique.push(row);
    }

    const output = toCsv([header, ...unique]);
    return {
      output,
      error: null,
      kept: unique.length,
      removed: body.length - unique.length,
    };
  }, [input, mode, keys]);

  return (
    <div className="flex flex-col gap-4">
      <OptionsBar>
        <Field label="Match on" hint="Whole row, or only the chosen key columns">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="full">Whole row</TabsTrigger>
              <TabsTrigger value="keys">Key columns</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        {mode === 'keys' && (
          <Field
            label="Key columns"
            hint="Comma-separated header names or 0-based indices"
            className="flex-1"
          >
            <Input
              value={keys}
              onChange={(e) => setKeys(e.target.value)}
              placeholder="id  or  0, 1"
            />
          </Field>
        )}
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
          <PanelHeader title="Deduplicated CSV">
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
          result.output ? `${result.kept} unique rows` : false,
          result.removed > 0 && `${result.removed} duplicate${result.removed === 1 ? '' : 's'} removed`,
        ]}
      />
    </div>
  );
}
