'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const SAMPLE = `Name,Q1,Q2,Q3,Q4
Alice,10,20,30,40
Bob,15,25,35,45
Carol,12,22,32,42`;

type DelimKey = 'auto' | 'comma' | 'tab' | 'semicolon' | 'pipe';

const DELIM_CHAR: Record<Exclude<DelimKey, 'auto'>, string> = {
  comma: ',',
  tab: '\t',
  semicolon: ';',
  pipe: '|',
};

function detectDelimiter(text: string): string {
  const firstLine = text.replace(/\r\n/g, '\n').split('\n')[0] ?? '';
  const candidates: Array<[string, number]> = [
    [',', (firstLine.match(/,/g) ?? []).length],
    ['\t', (firstLine.match(/\t/g) ?? []).length],
    [';', (firstLine.match(/;/g) ?? []).length],
    ['|', (firstLine.match(/\|/g) ?? []).length],
  ];
  let best = ',';
  let bestCount = -1;
  for (const [ch, count] of candidates) {
    if (count > bestCount) {
      bestCount = count;
      best = ch;
    }
  }
  return best;
}

// RFC 4180 aware parser supporting quoted fields with embedded delimiters/newlines.
function parseCsv(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i] ?? '';
    if (inQuotes) {
      if (ch === '"') {
        const next = src[i + 1] ?? '';
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
    } else if (ch === delim) {
      row.push(cur);
      cur = '';
    } else if (ch === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else {
      cur += ch;
    }
  }
  row.push(cur);
  rows.push(row);
  // Drop a single trailing empty row caused by a terminal newline.
  const last = rows[rows.length - 1];
  if (rows.length > 1 && last && last.length === 1 && last[0] === '') {
    rows.pop();
  }
  return rows;
}

function formatField(field: string, delim: string): string {
  const needsQuote = field.includes(delim) || field.includes('"') || field.includes('\n') || field.includes('\r');
  return needsQuote ? `"${field.replace(/"/g, '""')}"` : field;
}

function toCsv(rows: string[][], delim: string): string {
  return rows.map((r) => r.map((f) => formatField(f, delim)).join(delim)).join('\n');
}

export default function CsvTransposeTool() {
  const [input, setInput] = useState('');
  const [inDelim, setInDelim] = useState<DelimKey>('auto');
  const [outDelim, setOutDelim] = useState<Exclude<DelimKey, 'auto'>>('comma');
  const [trim, setTrim] = useState(false);

  const result = useMemo<{ output: string; error: string | null; rows: number; cols: number }>(() => {
    if (!input.trim()) return { output: '', error: null, rows: 0, cols: 0 };
    const dch = inDelim === 'auto' ? detectDelimiter(input) : DELIM_CHAR[inDelim];
    const matrix = parseCsv(input, dch);
    if (matrix.length === 0) return { output: '', error: 'No data to transpose.', rows: 0, cols: 0 };

    const width = matrix.reduce((m, r) => Math.max(m, r.length), 0);
    const padded = matrix.map((r) => {
      const copy = r.slice();
      while (copy.length < width) copy.push('');
      return trim ? copy.map((c) => c.trim()) : copy;
    });

    const transposed: string[][] = [];
    for (let c = 0; c < width; c++) {
      const newRow: string[] = [];
      for (let r = 0; r < padded.length; r++) {
        newRow.push(padded[r]?.[c] ?? '');
      }
      transposed.push(newRow);
    }

    const doch = DELIM_CHAR[outDelim];
    return {
      output: toCsv(transposed, doch),
      error: null,
      rows: transposed.length,
      cols: padded.length,
    };
  }, [input, inDelim, outDelim, trim]);

  return (
    <div className="flex flex-col gap-4">
      <OptionsBar>
        <Field label="Input delimiter">
          <Select value={inDelim} onValueChange={(v) => setInDelim(v as DelimKey)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto-detect</SelectItem>
              <SelectItem value="comma">Comma (,)</SelectItem>
              <SelectItem value="tab">Tab</SelectItem>
              <SelectItem value="semicolon">Semicolon (;)</SelectItem>
              <SelectItem value="pipe">Pipe (|)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Output delimiter">
          <Select value={outDelim} onValueChange={(v) => setOutDelim(v as Exclude<DelimKey, 'auto'>)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="comma">Comma (,)</SelectItem>
              <SelectItem value="tab">Tab</SelectItem>
              <SelectItem value="semicolon">Semicolon (;)</SelectItem>
              <SelectItem value="pipe">Pipe (|)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Trim whitespace">
          <Switch checked={trim} onCheckedChange={setTrim} />
        </Field>
      </OptionsBar>

      <ErrorBanner error={result.error} />

      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <PanelHeader title="Input">
            <Button variant="ghost" size="sm" onClick={() => setInput(SAMPLE)}>Load sample</Button>
          </PanelHeader>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste CSV/TSV..."
            spellCheck={false}
            className="min-h-[280px] font-mono text-sm"
          />
        </Panel>
        <Panel>
          <PanelHeader title="Transposed">
            <CopyButton value={result.output} />
          </PanelHeader>
          <Textarea
            value={result.output}
            readOnly
            placeholder="Result appears here..."
            spellCheck={false}
            className="min-h-[280px] font-mono text-sm"
          />
        </Panel>
      </div>

      <StatBar
        items={[
          result.output ? `${result.rows} rows × ${result.cols} cols out` : false,
        ]}
      />
    </div>
  );
}
