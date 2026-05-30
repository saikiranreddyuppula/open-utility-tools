'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type DelimKey = 'comma' | 'tab' | 'semicolon' | 'pipe';
type OutFormat = 'markdown' | 'ascii' | 'csv';

const DELIMS: Record<DelimKey, string> = { comma: ',', tab: '\t', semicolon: ';', pipe: '|' };

const SAMPLE = `name,age,active,joined
Ada,36,true,2021-03-01
Grace,42,false,2020-11-15
Alan,29,true,2022-06-30
Katherine,42,true,2019-01-20
Ada,36,false,2021-03-01`;

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
        } else inQuotes = false;
      } else field += char;
    } else if (char === '"') inQuotes = true;
    else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function csvField(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

type ColType = 'integer' | 'float' | 'boolean' | 'date' | 'string';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;

function inferType(values: string[]): ColType {
  if (values.length === 0) return 'string';
  let allInt = true;
  let allFloat = true;
  let allBool = true;
  let allDate = true;
  for (const v of values) {
    const t = v.trim();
    if (allBool && t.toLowerCase() !== 'true' && t.toLowerCase() !== 'false') allBool = false;
    const n = Number(t);
    const numeric = t !== '' && Number.isFinite(n);
    if (!numeric) {
      allInt = false;
      allFloat = false;
    } else {
      if (!Number.isInteger(n)) allInt = false;
    }
    if (allDate && !ISO_DATE.test(t)) allDate = false;
  }
  if (allBool) return 'boolean';
  if (allInt) return 'integer';
  if (allFloat) return 'float';
  if (allDate) return 'date';
  return 'string';
}

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const mid = Math.floor(n / 2);
  if (n % 2 === 1) return sorted[mid] ?? NaN;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '';
  if (Number.isInteger(n)) return n.toString();
  return (Math.round(n * 1e6) / 1e6).toString();
}

interface ColStat {
  column: string;
  type: ColType;
  count: string;
  nonEmpty: string;
  empty: string;
  distinct: string;
  topValue: string;
  min: string;
  max: string;
  mean: string;
  median: string;
  stddev: string;
}

const HEADERS = [
  'column', 'type', 'count', 'non_empty', 'empty', 'distinct',
  'most_frequent', 'min', 'max', 'mean', 'median', 'stddev',
] as const;

function renderTable(stats: ColStat[], format: OutFormat): string {
  const rows = stats.map((s) => [
    s.column, s.type, s.count, s.nonEmpty, s.empty, s.distinct,
    s.topValue, s.min, s.max, s.mean, s.median, s.stddev,
  ]);
  const head = [...HEADERS];

  if (format === 'csv') {
    return [head, ...rows].map((r) => r.map(csvField).join(',')).join('\n');
  }

  const widths = head.map((h, c) =>
    Math.max(h.length, ...rows.map((r) => (r[c] ?? '').length))
  );
  const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - s.length));
  const line = (cells: string[]) =>
    '| ' + cells.map((cell, c) => pad(cell, widths[c] ?? 0)).join(' | ') + ' |';

  const out: string[] = [];
  out.push(line(head));
  if (format === 'markdown') {
    out.push('| ' + widths.map((w) => '-'.repeat(Math.max(3, w))).join(' | ') + ' |');
  } else {
    out.push('|' + widths.map((w) => '-'.repeat((w ?? 0) + 2)).join('+') + '|');
  }
  for (const r of rows) out.push(line(r));
  return out.join('\n');
}

export default function CsvColumnStats() {
  const [format, setFormat] = useState<OutFormat>('markdown');
  const [delim, setDelim] = useState<DelimKey>('comma');
  const [sampleCap, setSampleCap] = useState('100000');

  return (
    <TextToolLayout
      deps={[format, delim, sampleCap]}
      sample={SAMPLE}
      inputLabel="CSV (first row = header)"
      outputLabel="Column statistics"
      downloadName={format === 'csv' ? 'column-stats.csv' : 'column-stats.txt'}
      downloadMime={format === 'csv' ? 'text/csv' : 'text/plain'}
      transform={(input) => {
        if (!input.trim()) return '';
        const rows = parseCSV(input, DELIMS[delim]);
        const headerRow = rows[0];
        if (!headerRow) return '';
        const header = headerRow.map((h) => h.trim());
        const dataRows = rows.slice(1);
        const cap = Math.max(1, Math.min(Number(sampleCap) || 100000, 5_000_000));

        const stats: ColStat[] = [];
        for (let c = 0; c < header.length; c++) {
          const colName = header[c] ?? `col${c + 1}`;
          const all: string[] = [];
          for (const r of dataRows) all.push(r[c] ?? '');
          const nonEmpty = all.filter((v) => v.trim() !== '');
          const empty = all.length - nonEmpty.length;

          const type = inferType(nonEmpty);

          // distinct + most frequent (capped)
          const freq = new Map<string, number>();
          const limit = Math.min(nonEmpty.length, cap);
          for (let k = 0; k < limit; k++) {
            const v = nonEmpty[k] ?? '';
            freq.set(v, (freq.get(v) ?? 0) + 1);
          }
          let topValue = '';
          let topCount = 0;
          for (const [v, n] of freq) {
            if (n > topCount) {
              topCount = n;
              topValue = v;
            }
          }
          const distinct = freq.size;

          const stat: ColStat = {
            column: colName,
            type,
            count: all.length.toString(),
            nonEmpty: nonEmpty.length.toString(),
            empty: empty.toString(),
            distinct: distinct.toString() + (nonEmpty.length > cap ? '+' : ''),
            topValue: topCount > 0 ? `${topValue} (${topCount})` : '',
            min: '',
            max: '',
            mean: '',
            median: '',
            stddev: '',
          };

          if (type === 'integer' || type === 'float') {
            const nums = nonEmpty
              .map((v) => Number(v.trim()))
              .filter((n) => Number.isFinite(n));
            if (nums.length > 0) {
              const sum = nums.reduce((a, b) => a + b, 0);
              const mean = sum / nums.length;
              const variance =
                nums.reduce((a, b) => a + (b - mean) * (b - mean), 0) / nums.length;
              const sorted = [...nums].sort((a, b) => a - b);
              stat.min = fmtNum(sorted[0] ?? NaN);
              stat.max = fmtNum(sorted[sorted.length - 1] ?? NaN);
              stat.mean = fmtNum(mean);
              stat.median = fmtNum(median(sorted));
              stat.stddev = fmtNum(Math.sqrt(variance));
            }
          } else if (nonEmpty.length > 0) {
            // string-like: min/max length
            const lengths = nonEmpty.map((v) => v.length).sort((a, b) => a - b);
            stat.min = `len ${lengths[0] ?? 0}`;
            stat.max = `len ${lengths[lengths.length - 1] ?? 0}`;
          }
          stats.push(stat);
        }
        return renderTable(stats, format);
      }}
      options={
        <>
          <Field label="Output format">
            <Tabs value={format} onValueChange={(v) => setFormat(v as OutFormat)}>
              <TabsList>
                <TabsTrigger value="markdown">Markdown</TabsTrigger>
                <TabsTrigger value="ascii">ASCII</TabsTrigger>
                <TabsTrigger value="csv">CSV</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Delimiter">
            <Select value={delim} onValueChange={(v) => setDelim(v as DelimKey)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comma">Comma</SelectItem>
                <SelectItem value="tab">Tab</SelectItem>
                <SelectItem value="semicolon">Semicolon</SelectItem>
                <SelectItem value="pipe">Pipe</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Distinct sample cap" hint="rows scanned for distinct/top">
            <Input value={sampleCap} onChange={(e) => setSampleCap(e.target.value)} inputMode="numeric" className="w-28 font-mono" />
          </Field>
        </>
      }
    />
  );
}
