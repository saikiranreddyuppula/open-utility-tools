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

const SAMPLE = `id,name,active,price,joined,score
1,Alice,true,19.99,2023-01-15,
2,Bob,false,5,2022-12-01,87
3,Carol,yes,12.50,2024-03-30,42`;

type DelimKey = 'comma' | 'tab' | 'semicolon' | 'pipe';

const DELIM_CHAR: Record<DelimKey, string> = {
  comma: ',',
  tab: '\t',
  semicolon: ';',
  pipe: '|',
};

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
        if (next === '"') { cur += '"'; i++; } else { inQuotes = false; }
      } else { cur += ch; }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(cur); cur = '';
    } else if (ch === '\n') {
      row.push(cur); rows.push(row); row = []; cur = '';
    } else {
      cur += ch;
    }
  }
  row.push(cur);
  rows.push(row);
  const last = rows[rows.length - 1];
  if (rows.length > 1 && last && last.length === 1 && last[0] === '') rows.pop();
  return rows;
}

type DetectedType = 'integer' | 'float' | 'boolean' | 'date' | 'string';

const BOOL_VALUES = new Set(['true', 'false', 'yes', 'no', '0', '1']);

function isInteger(v: string): boolean {
  return /^[+-]?\d+$/.test(v);
}
function isFloat(v: string): boolean {
  // Decimal with a point, or any number in scientific notation.
  return /^[+-]?(\d+\.\d*|\.\d+|\d+(\.\d+)?[eE][+-]?\d+)$/.test(v);
}
function isBoolean(v: string): boolean {
  return BOOL_VALUES.has(v.toLowerCase());
}
function isIsoDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(v)) return false;
  const t = Date.parse(v);
  return Number.isFinite(t);
}

function sqlType(t: DetectedType): string {
  switch (t) {
    case 'integer': return 'INTEGER';
    case 'float': return 'DOUBLE PRECISION';
    case 'boolean': return 'BOOLEAN';
    case 'date': return 'TIMESTAMP';
    case 'string': return 'TEXT';
    default: return 'TEXT';
  }
}

function tsType(t: DetectedType): string {
  switch (t) {
    case 'integer': return 'number';
    case 'float': return 'number';
    case 'boolean': return 'boolean';
    case 'date': return 'string /* ISO date */';
    case 'string': return 'string';
    default: return 'string';
  }
}

interface ColResult {
  name: string;
  type: DetectedType;
  nulls: number;
  total: number;
  sample: string;
}

export default function CsvDetectTypesTool() {
  const [input, setInput] = useState('');
  const [delim, setDelim] = useState<DelimKey>('comma');
  const [emptyAsNull, setEmptyAsNull] = useState(true);

  const result = useMemo<{ cols: ColResult[]; error: string | null }>(() => {
    if (!input.trim()) return { cols: [], error: null };
    const matrix = parseCsv(input, DELIM_CHAR[delim]);
    const header = matrix[0];
    if (!header || header.length === 0) return { cols: [], error: 'CSV has no header row.' };
    const body = matrix.slice(1);

    const cols: ColResult[] = header.map((name, ci) => {
      const values: string[] = [];
      let nulls = 0;
      let sample = '';
      for (const r of body) {
        const raw = r[ci] ?? '';
        const v = raw.trim();
        if (v === '' && emptyAsNull) { nulls++; continue; }
        if (v === '') { nulls++; }
        if (!sample && v !== '') sample = v;
        if (v !== '') values.push(v);
      }

      let type: DetectedType = 'string';
      if (values.length > 0) {
        const allInt = values.every(isInteger);
        const allFloat = values.every((v) => isInteger(v) || isFloat(v));
        const allBool = values.every(isBoolean);
        const allDate = values.every(isIsoDate);
        // A column that is purely true/false/yes/no is a clear boolean. If the only
        // values are 0/1, that is also boolean-like but ambiguous with integer; we
        // treat pure 0/1 columns as boolean only when no other integer is present.
        const hasWordBool = values.some((v) => ['true', 'false', 'yes', 'no'].includes(v.toLowerCase()));
        if (allBool && hasWordBool) {
          type = 'boolean';
        } else if (allInt) {
          type = 'integer';
        } else if (allFloat) {
          type = 'float';
        } else if (allDate) {
          type = 'date';
        } else {
          type = 'string';
        }
      }

      return { name: name || `column_${ci + 1}`, type, nulls, total: body.length, sample: sample || '—' };
    });

    return { cols, error: null };
  }, [input, delim, emptyAsNull]);

  const exportText = useMemo(() => {
    return result.cols
      .map((c) => `${c.name}\t${c.type}\t${sqlType(c.type)}\t${tsType(c.type)}`)
      .join('\n');
  }, [result.cols]);

  return (
    <div className="flex flex-col gap-4">
      <OptionsBar>
        <Field label="Delimiter">
          <Select value={delim} onValueChange={(v) => setDelim(v as DelimKey)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="comma">Comma (,)</SelectItem>
              <SelectItem value="tab">Tab</SelectItem>
              <SelectItem value="semicolon">Semicolon (;)</SelectItem>
              <SelectItem value="pipe">Pipe (|)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Treat empty as null">
          <Switch checked={emptyAsNull} onCheckedChange={setEmptyAsNull} />
        </Field>
      </OptionsBar>

      <ErrorBanner error={result.error} />

      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <PanelHeader title="CSV Input">
            <Button variant="ghost" size="sm" onClick={() => setInput(SAMPLE)}>Load sample</Button>
          </PanelHeader>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste CSV with a header row..."
            spellCheck={false}
            className="min-h-[280px] font-mono text-sm"
          />
        </Panel>
        <Panel>
          <PanelHeader title="Detected Types">
            <CopyButton value={() => exportText} />
          </PanelHeader>
          <div className="max-h-[300px] divide-y overflow-auto">
            {result.cols.map((c) => (
              <div key={c.name} className="flex items-center gap-3 px-3 py-2 text-sm">
                <code className="min-w-0 flex-1 truncate font-mono text-xs">{c.name}</code>
                <span className="w-20 shrink-0 font-medium">{c.type}</span>
                <code className="w-32 shrink-0 truncate font-mono text-xs text-muted-foreground">{sqlType(c.type)}</code>
                <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">{c.nulls} null</span>
              </div>
            ))}
            {result.cols.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">Detected types appear here.</div>
            )}
          </div>
        </Panel>
      </div>

      <StatBar items={[result.cols.length > 0 ? `${result.cols.length} columns analyzed` : false]} />
    </div>
  );
}
