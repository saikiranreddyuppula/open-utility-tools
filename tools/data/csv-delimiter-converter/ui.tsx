'use client';

import { useMemo, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';

type DelimKey = 'comma' | 'tab' | 'semicolon' | 'pipe';

const DELIMS: Record<DelimKey, string> = {
  comma: ',',
  tab: '\t',
  semicolon: ';',
  pipe: '|',
};

const LABELS: Record<DelimKey, string> = {
  comma: 'Comma (,)',
  tab: 'Tab (\\t)',
  semicolon: 'Semicolon (;)',
  pipe: 'Pipe (|)',
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

function serializeField(field: string, delimiter: string): string {
  const needsQuote =
    field.includes(delimiter) ||
    field.includes('"') ||
    field.includes('\n') ||
    field.includes('\r');
  if (!needsQuote) return field;
  return `"${field.replace(/"/g, '""')}"`;
}

export default function CsvDelimiterConverterTool() {
  const [input, setInput] = useState('');
  const [from, setFrom] = useState<DelimKey>('comma');
  const [to, setTo] = useState<DelimKey>('tab');

  const { output, error, rowCount } = useMemo(() => {
    if (!input.trim()) return { output: '', error: null as string | null, rowCount: 0 };
    try {
      const rows = parseCSV(input, DELIMS[from]);
      const toDelim = DELIMS[to];
      const out = rows
        .map((row) => row.map((f) => serializeField(f, toDelim)).join(toDelim))
        .join('\n');
      return { output: out, error: null as string | null, rowCount: rows.length };
    } catch (err) {
      return {
        output: '',
        error: err instanceof Error ? err.message : 'Failed to convert',
        rowCount: 0,
      };
    }
  }, [input, from, to]);

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  return (
    <div className="flex flex-col gap-4">
      <OptionsBar>
        <Field label="From">
          <Select value={from} onValueChange={(v) => setFrom(v as DelimKey)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(DELIMS) as DelimKey[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Button variant="ghost" size="icon" onClick={swap} aria-label="Swap delimiters" className="mt-5">
          <ArrowLeftRight className="h-4 w-4" />
        </Button>
        <Field label="To">
          <Select value={to} onValueChange={(v) => setTo(v as DelimKey)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(DELIMS) as DelimKey[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </OptionsBar>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Input" />
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste delimited data here…"
            className="min-h-[300px] flex-1 resize-none border-0 font-mono text-sm focus-visible:ring-0"
          />
        </Panel>
        <Panel>
          <PanelHeader title="Output">
            <div className="flex gap-1">
              <CopyButton value={output} />
              <DownloadButton data={() => output} filename="converted.csv" mime="text/csv" disabled={!output} />
            </div>
          </PanelHeader>
          <ErrorBanner error={error} />
          <Textarea
            value={output}
            readOnly
            placeholder="Result appears here…"
            className="min-h-[300px] flex-1 resize-none border-0 font-mono text-sm focus-visible:ring-0"
          />
        </Panel>
      </div>

      <StatBar items={[rowCount > 0 && `${rowCount} row${rowCount === 1 ? '' : 's'}`]} />
    </div>
  );
}
