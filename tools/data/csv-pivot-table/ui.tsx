'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SAMPLE = `region,product,quarter,sales
West,Widget,Q1,120
West,Gadget,Q1,80
East,Widget,Q1,200
West,Widget,Q2,150
East,Gadget,Q2,60
East,Widget,Q2,210`;

const DELIMS: Record<string, string> = { ',': 'Comma', ';': 'Semicolon', '\t': 'Tab', '|': 'Pipe' };

type Agg = 'sum' | 'count' | 'avg' | 'min' | 'max' | 'distinct';

const AGGS: { value: Agg; label: string }[] = [
  { value: 'sum', label: 'Sum' },
  { value: 'count', label: 'Count' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Min' },
  { value: 'max', label: 'Max' },
  { value: 'distinct', label: 'Count distinct' },
];

type SortMode = 'alpha' | 'total';

function parseLine(line: string, delim: string): string[] {
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
    } else if (ch === delim) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string, delim: string): string[][] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l, idx, arr) => !(l === '' && idx === arr.length - 1))
    .map((l) => parseLine(l, delim));
}

function formatField(field: string, delim: string): string {
  const needs = field.includes('"') || field.includes('\n') || field.includes(delim);
  return needs ? `"${field.replace(/"/g, '""')}"` : field;
}

function toCsv(rows: string[][], delim: string): string {
  return rows.map((r) => r.map((f) => formatField(f, delim)).join(delim)).join('\n');
}

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '';
  return Number.isInteger(n) ? n.toString() : Number(n.toFixed(4)).toString();
}

export default function CsvPivotTableTool() {
  const [delim, setDelim] = useState(',');
  const [rowField, setRowField] = useState('');
  const [colField, setColField] = useState('');
  const [valField, setValField] = useState('');
  const [agg, setAgg] = useState<Agg>('sum');
  const [grandTotals, setGrandTotals] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>('alpha');
  const [fillZero, setFillZero] = useState(false);
  const [input, setInput] = useState('');

  const header = useMemo<string[]>(() => {
    if (!input.trim()) return [];
    return parseCsv(input, delim)[0] ?? [];
  }, [input, delim]);

  const result = useMemo<{ output: string; error: string | null; rows: number; cols: number }>(() => {
    if (!input.trim()) return { output: '', error: null, rows: 0, cols: 0 };
    const rows = parseCsv(input, delim);
    const head = rows[0];
    if (!head || head.length === 0) return { output: '', error: 'CSV has no header row.', rows: 0, cols: 0 };
    if (!rowField || !colField || !valField)
      return { output: '', error: 'Choose a Row, Column, and Value field.', rows: 0, cols: 0 };
    const rIdx = head.indexOf(rowField);
    const cIdx = head.indexOf(colField);
    const vIdx = head.indexOf(valField);
    if (rIdx < 0 || cIdx < 0 || vIdx < 0)
      return { output: '', error: 'Selected field not found in header.', rows: 0, cols: 0 };

    const body = rows.slice(1);
    // bucket[rowKey][colKey] = number[] of values for distinct/count, or numeric list
    const buckets = new Map<string, Map<string, string[]>>();
    const rowKeys: string[] = [];
    const colKeys: string[] = [];
    const rowSeen = new Set<string>();
    const colSeen = new Set<string>();

    for (const row of body) {
      const rk = row[rIdx] ?? '';
      const ck = row[cIdx] ?? '';
      const v = row[vIdx] ?? '';
      if (!rowSeen.has(rk)) {
        rowSeen.add(rk);
        rowKeys.push(rk);
      }
      if (!colSeen.has(ck)) {
        colSeen.add(ck);
        colKeys.push(ck);
      }
      let inner = buckets.get(rk);
      if (!inner) {
        inner = new Map<string, string[]>();
        buckets.set(rk, inner);
      }
      const arr = inner.get(ck);
      if (arr) arr.push(v);
      else inner.set(ck, [v]);
    }

    const aggregate = (vals: string[] | undefined): number | null => {
      if (!vals || vals.length === 0) return null;
      if (agg === 'count') return vals.length;
      if (agg === 'distinct') return new Set(vals).size;
      const nums = vals.map((x) => Number(x)).filter((x) => Number.isFinite(x));
      if (nums.length === 0) return null;
      if (agg === 'sum') return nums.reduce((a, b) => a + b, 0);
      if (agg === 'avg') return nums.reduce((a, b) => a + b, 0) / nums.length;
      if (agg === 'min') return Math.min(...nums);
      if (agg === 'max') return Math.max(...nums);
      return null;
    };

    // compute row totals (sum of cell aggregates) for sorting
    const cellVal = (rk: string, ck: string): number | null => aggregate(buckets.get(rk)?.get(ck));

    const rowTotal = (rk: string): number =>
      colKeys.reduce((sum, ck) => {
        const v = cellVal(rk, ck);
        return sum + (v ?? 0);
      }, 0);
    const colTotal = (ck: string): number =>
      rowKeys.reduce((sum, rk) => {
        const v = cellVal(rk, ck);
        return sum + (v ?? 0);
      }, 0);

    const sortedRows = [...rowKeys];
    const sortedCols = [...colKeys];
    if (sortMode === 'alpha') {
      sortedRows.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      sortedCols.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    } else {
      sortedRows.sort((a, b) => rowTotal(b) - rowTotal(a));
      sortedCols.sort((a, b) => colTotal(b) - colTotal(a));
    }

    const out: string[][] = [];
    const headerRow: string[] = [`${rowField} \\ ${colField}`, ...sortedCols];
    if (grandTotals) headerRow.push('Total');
    out.push(headerRow);

    for (const rk of sortedRows) {
      const line: string[] = [rk === '' ? '(blank)' : rk];
      for (const ck of sortedCols) {
        const v = cellVal(rk, ck);
        line.push(v == null ? (fillZero ? '0' : '') : fmtNum(v));
      }
      if (grandTotals) line.push(fmtNum(rowTotal(rk)));
      out.push(line);
    }

    if (grandTotals) {
      const totalRow: string[] = ['Total'];
      for (const ck of sortedCols) totalRow.push(fmtNum(colTotal(ck)));
      const grand = sortedRows.reduce((s, rk) => s + rowTotal(rk), 0);
      totalRow.push(fmtNum(grand));
      out.push(totalRow);
    }

    return { output: toCsv(out, delim), error: null, rows: sortedRows.length, cols: sortedCols.length };
  }, [input, delim, rowField, colField, valField, agg, grandTotals, sortMode, fillZero]);

  const colSelect = (value: string, onChange: (v: string) => void, placeholder: string) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-40">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {header.length === 0 ? (
          <SelectItem value="__none" disabled>
            (load CSV first)
          </SelectItem>
        ) : (
          header.map((h, i) => (
            <SelectItem key={`${i}-${h}`} value={h}>
              {h === '' ? `(col ${i})` : h}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );

  return (
    <div className="flex flex-col gap-4">
      <OptionsBar>
        <Field label="Delimiter">
          <Select value={delim} onValueChange={setDelim}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DELIMS).map(([v, label]) => (
                <SelectItem key={v} value={v}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Row field">{colSelect(rowField, setRowField, 'rows')}</Field>
        <Field label="Column field">{colSelect(colField, setColField, 'columns')}</Field>
        <Field label="Value field">{colSelect(valField, setValField, 'values')}</Field>
        <Field label="Aggregation">
          <Select value={agg} onValueChange={(v) => setAgg(v as Agg)}>
            <SelectTrigger className="h-8 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGGS.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Sort labels">
          <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
            <SelectTrigger className="h-8 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alpha">Alphabetical</SelectItem>
              <SelectItem value="total">By total (desc)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Options">
          <div className="flex h-8 items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs">
              <Switch checked={grandTotals} onCheckedChange={setGrandTotals} /> grand totals
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <Switch checked={fillZero} onCheckedChange={setFillZero} /> empty as 0
            </label>
          </div>
        </Field>
      </OptionsBar>

      <ErrorBanner error={result.error} />

      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <PanelHeader title="Input CSV">
            <Button variant="ghost" size="sm" onClick={() => setInput(SAMPLE)}>
              Sample
            </Button>
          </PanelHeader>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste CSV with a header row..."
            spellCheck={false}
            className="min-h-[300px] font-mono text-sm"
          />
        </Panel>

        <Panel>
          <PanelHeader title="Pivot Table (CSV)">
            <CopyButton value={() => result.output} disabled={!result.output} />
            <DownloadButton
              data={() => result.output}
              filename="pivot.csv"
              mime="text/csv"
              disabled={!result.output}
              label="Download"
            />
          </PanelHeader>
          <Textarea
            value={result.output}
            readOnly
            placeholder="Result appears here..."
            spellCheck={false}
            className="min-h-[300px] font-mono text-sm"
          />
        </Panel>
      </div>

      <StatBar items={[result.rows > 0 && `${result.rows} row groups × ${result.cols} columns`]} />
    </div>
  );
}
