'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';

type DelimKey = 'comma' | 'tab' | 'semicolon' | 'pipe';
type IdentQuote = 'none' | 'double' | 'backtick';

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

function quoteIdent(name: string, style: IdentQuote): string {
  if (style === 'double') return `"${name.replace(/"/g, '""')}"`;
  if (style === 'backtick') return `\`${name.replace(/`/g, '``')}\``;
  return name;
}

function sqlValue(raw: string, nullEmpty: boolean): string {
  if (nullEmpty && raw === '') return 'NULL';
  const lower = raw.toLowerCase();
  if (lower === 'null') return 'NULL';
  if (lower === 'true') return 'TRUE';
  if (lower === 'false') return 'FALSE';
  if (raw !== '' && /^-?\d+(\.\d+)?$/.test(raw) && Number.isFinite(Number(raw))) {
    return raw;
  }
  return `'${raw.replace(/'/g, "''")}'`;
}

export default function CsvToSqlTool() {
  const [input, setInput] = useState('');
  const [table, setTable] = useState('my_table');
  const [delim, setDelim] = useState<DelimKey>('comma');
  const [identQuote, setIdentQuote] = useState<IdentQuote>('none');
  const [multiRow, setMultiRow] = useState(false);
  const [nullEmpty, setNullEmpty] = useState(true);

  const { output, error, stmtCount } = useMemo(() => {
    if (!input.trim()) return { output: '', error: null as string | null, stmtCount: 0 };
    const tableName = table.trim() || 'my_table';
    try {
      const rows = parseCSV(input, DELIMS[delim]).filter(
        (r) => r.length > 1 || (r.length === 1 && (r[0] ?? '') !== ''),
      );
      if (rows.length < 2) {
        throw new Error('Need a header row and at least one data row.');
      }
      const header = rows[0];
      if (!header || header.length === 0) {
        throw new Error('Header row is empty.');
      }
      const colCount = header.length;
      const cols = header.map((c) => quoteIdent(c, identQuote)).join(', ');
      const dataRows = rows.slice(1);
      const tbl = quoteIdent(tableName, identQuote);

      const valueTuples = dataRows.map((row) => {
        const vals: string[] = [];
        for (let i = 0; i < colCount; i++) {
          vals.push(sqlValue(row[i] ?? '', nullEmpty));
        }
        return `(${vals.join(', ')})`;
      });

      let out: string;
      if (multiRow) {
        out = `INSERT INTO ${tbl} (${cols}) VALUES\n  ${valueTuples.join(',\n  ')};`;
      } else {
        out = valueTuples
          .map((t) => `INSERT INTO ${tbl} (${cols}) VALUES ${t};`)
          .join('\n');
      }

      return {
        output: out,
        error: null as string | null,
        stmtCount: multiRow ? 1 : valueTuples.length,
      };
    } catch (err) {
      return {
        output: '',
        error: err instanceof Error ? err.message : 'Failed to generate SQL',
        stmtCount: 0,
      };
    }
  }, [input, table, delim, identQuote, multiRow, nullEmpty]);

  return (
    <div className="flex flex-col gap-4">
      <OptionsBar>
        <Field label="Table name">
          <Input
            value={table}
            onChange={(e) => setTable(e.target.value)}
            placeholder="my_table"
            className="w-44"
          />
        </Field>
        <Field label="Delimiter">
          <Tabs value={delim} onValueChange={(v) => setDelim(v as DelimKey)}>
            <TabsList>
              <TabsTrigger value="comma">,</TabsTrigger>
              <TabsTrigger value="tab">Tab</TabsTrigger>
              <TabsTrigger value="semicolon">;</TabsTrigger>
              <TabsTrigger value="pipe">|</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label="Identifier quoting">
          <Tabs value={identQuote} onValueChange={(v) => setIdentQuote(v as IdentQuote)}>
            <TabsList>
              <TabsTrigger value="none">None</TabsTrigger>
              <TabsTrigger value="double">&quot; &quot;</TabsTrigger>
              <TabsTrigger value="backtick">` `</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label="Multi-row">
          <div className="flex items-center gap-2 pt-1">
            <Switch id="multi-row" checked={multiRow} onCheckedChange={setMultiRow} />
            <Label htmlFor="multi-row" className="text-sm font-normal">
              Single statement
            </Label>
          </div>
        </Field>
        <Field label="Empty cells">
          <div className="flex items-center gap-2 pt-1">
            <Switch id="null-empty" checked={nullEmpty} onCheckedChange={setNullEmpty} />
            <Label htmlFor="null-empty" className="text-sm font-normal">
              Empty as NULL
            </Label>
          </div>
        </Field>
      </OptionsBar>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="CSV" />
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste CSV with a header row…"
            className="min-h-[300px] flex-1 resize-none border-0 font-mono text-sm focus-visible:ring-0"
          />
        </Panel>
        <Panel>
          <PanelHeader title="SQL">
            <div className="flex gap-1">
              <CopyButton value={output} />
              <DownloadButton data={() => output} filename="insert.sql" mime="application/sql" disabled={!output} />
            </div>
          </PanelHeader>
          <ErrorBanner error={error} />
          <Textarea
            value={output}
            readOnly
            placeholder="INSERT statements appear here…"
            className="min-h-[300px] flex-1 resize-none border-0 font-mono text-sm focus-visible:ring-0"
          />
        </Panel>
      </div>

      <StatBar items={[stmtCount > 0 && `${stmtCount} statement${stmtCount === 1 ? '' : 's'}`]} />
    </div>
  );
}
