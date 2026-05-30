'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type DelimKey = 'comma' | 'tab' | 'semicolon' | 'pipe';
type Strategy = 'forward' | 'backward' | 'constant' | 'mean' | 'median';

const DELIMS: Record<DelimKey, string> = { comma: ',', tab: '\t', semicolon: ';', pipe: '|' };
const NULL_TOKENS = new Set(['na', 'n/a', 'null', 'nan', 'none', '-']);

const SAMPLE = `date,temp,city
2021-01-01,5,London
2021-01-02,,London
2021-01-03,,
2021-01-04,8,Paris
2021-01-05,NA,Paris`;

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

function serializeField(field: string, delimiter: string): string {
  if (
    field.includes(delimiter) ||
    field.includes('"') ||
    field.includes('\n') ||
    field.includes('\r')
  ) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export default function CsvFillBlanks() {
  const [strategy, setStrategy] = useState<Strategy>('forward');
  const [targetCols, setTargetCols] = useState('');
  const [constant, setConstant] = useState('0');
  const [treatNull, setTreatNull] = useState(true);
  const [hasHeader, setHasHeader] = useState(true);
  const [delim, setDelim] = useState<DelimKey>('comma');

  return (
    <TextToolLayout
      deps={[strategy, targetCols, constant, treatNull, hasHeader, delim]}
      sample={SAMPLE}
      inputLabel="CSV"
      outputLabel="Filled CSV"
      downloadName="filled.csv"
      downloadMime="text/csv"
      transform={(input) => {
        if (!input.trim()) return '';
        const d = DELIMS[delim];
        const rows = parseCSV(input, d);
        if (rows.length === 0) return '';
        const cols = rows.reduce((m, r) => Math.max(m, r.length), 0);

        const headerRow = hasHeader ? rows[0] : null;
        const dataStart = hasHeader ? 1 : 0;
        const header = headerRow ? headerRow.map((h) => h.trim()) : [];

        // Resolve target column indices.
        const wanted = targetCols
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s !== '');
        let targets: number[];
        if (wanted.length === 0) {
          targets = Array.from({ length: cols }, (_, i) => i);
        } else {
          targets = [];
          for (const w of wanted) {
            let idx = header.indexOf(w);
            if (idx < 0) {
              const n = Number(w);
              if (Number.isInteger(n) && n >= 0 && n < cols) idx = n;
            }
            if (idx < 0) throw new Error(`Unknown column "${w}". Available: ${header.join(', ') || `0..${cols - 1}`}`);
            targets.push(idx);
          }
        }

        const isBlank = (v: string): boolean => {
          const t = v.trim();
          if (t === '') return true;
          if (treatNull && NULL_TOKENS.has(t.toLowerCase())) return true;
          return false;
        };

        // Work on a mutable copy of data rows (normalized to `cols`).
        const data: string[][] = [];
        for (let r = dataStart; r < rows.length; r++) {
          const src = rows[r] ?? [];
          const out: string[] = [];
          for (let c = 0; c < cols; c++) out.push(src[c] ?? '');
          data.push(out);
        }

        for (const c of targets) {
          if (strategy === 'forward') {
            let last: string | null = null;
            for (let r = 0; r < data.length; r++) {
              const row = data[r];
              if (!row) continue;
              const cell = row[c] ?? '';
              if (isBlank(cell)) {
                if (last !== null) row[c] = last;
              } else last = cell;
            }
          } else if (strategy === 'backward') {
            let next: string | null = null;
            for (let r = data.length - 1; r >= 0; r--) {
              const row = data[r];
              if (!row) continue;
              const cell = row[c] ?? '';
              if (isBlank(cell)) {
                if (next !== null) row[c] = next;
              } else next = cell;
            }
          } else if (strategy === 'constant') {
            for (const row of data) {
              if (isBlank(row[c] ?? '')) row[c] = constant;
            }
          } else {
            // mean / median over numeric non-blank cells
            const nums: number[] = [];
            for (const row of data) {
              const cell = row[c] ?? '';
              if (!isBlank(cell)) {
                const n = Number(cell.trim());
                if (Number.isFinite(n)) nums.push(n);
              }
            }
            if (nums.length === 0) continue; // nothing numeric to compute
            let fill: number;
            if (strategy === 'mean') {
              fill = nums.reduce((a, b) => a + b, 0) / nums.length;
            } else {
              const sorted = [...nums].sort((a, b) => a - b);
              const mid = Math.floor(sorted.length / 2);
              fill =
                sorted.length % 2 === 1
                  ? sorted[mid] ?? 0
                  : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
            }
            const fillStr = (Math.round(fill * 1e6) / 1e6).toString();
            for (const row of data) {
              if (isBlank(row[c] ?? '')) row[c] = fillStr;
            }
          }
        }

        const out: string[] = [];
        if (headerRow) {
          out.push(headerRow.map((c) => serializeField(c, d)).join(d));
        }
        for (const row of data) {
          out.push(row.map((c) => serializeField(c, d)).join(d));
        }
        return out.join('\n');
      }}
      options={
        <>
          <Field label="Strategy">
            <Select value={strategy} onValueChange={(v) => setStrategy(v as Strategy)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="forward">Forward-fill (down)</SelectItem>
                <SelectItem value="backward">Back-fill (up)</SelectItem>
                <SelectItem value="constant">Constant value</SelectItem>
                <SelectItem value="mean">Column mean (numeric)</SelectItem>
                <SelectItem value="median">Column median (numeric)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {strategy === 'constant' && (
            <Field label="Constant value">
              <Input value={constant} onChange={(e) => setConstant(e.target.value)} className="w-28 font-mono" />
            </Field>
          )}
          <Field label="Target columns" hint="names or indexes, comma-separated; blank = all" className="min-w-60 flex-1">
            <Input
              value={targetCols}
              onChange={(e) => setTargetCols(e.target.value)}
              placeholder="(all columns)"
              className="font-mono"
            />
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
          <Field label="Treat NA/null as blank">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={treatNull} onCheckedChange={setTreatNull} />
              <Label className="text-xs text-muted-foreground">NA, null, none, -</Label>
            </div>
          </Field>
          <Field label="First row is header">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={hasHeader} onCheckedChange={setHasHeader} />
              <Label className="text-xs text-muted-foreground">header row</Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
