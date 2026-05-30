'use client';

import { useCallback, useState } from 'react';

import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SAMPLE = `id,name,balance
1,Ada Lovelace,1200.50
2,Linus,80
3,Grace Hopper,9999.99`;

const DELIMS: Record<string, string> = { ',': 'Comma', ';': 'Semicolon', '\t': 'Tab', '|': 'Pipe' };

type WidthMode = 'auto' | 'manual';
type Align = 'left' | 'right' | 'auto';
type Overflow = 'truncate' | 'overflow';

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

function isNumeric(s: string): boolean {
  const t = s.trim();
  return t !== '' && Number.isFinite(Number(t));
}

export default function CsvToFixedWidthTool() {
  const [delim, setDelim] = useState(',');
  const [widthMode, setWidthMode] = useState<WidthMode>('auto');
  const [manualWidths, setManualWidths] = useState('');
  const [align, setAlign] = useState<Align>('auto');
  const [gap, setGap] = useState('2');
  const [includeHeader, setIncludeHeader] = useState(true);
  const [ruler, setRuler] = useState(true);
  const [overflow, setOverflow] = useState<Overflow>('truncate');
  const [padChar, setPadChar] = useState(' ');

  const transform = useCallback(
    (text: string) => {
      if (!text.trim()) return '';
      const rows = parseCsv(text, delim);
      const head = rows[0];
      if (!head || head.length === 0) throw new Error('CSV has no header row.');
      const body = rows.slice(1);
      const nCols = head.length;

      const gapN = Math.max(0, Math.floor(Number(gap)));
      if (!Number.isFinite(gapN)) throw new Error('Column gap must be a number ≥ 0.');
      const pad = (padChar.length > 0 ? padChar[0] : ' ') ?? ' ';

      // determine per-column numeric-ness from data rows
      const numericCol: boolean[] = [];
      for (let c = 0; c < nCols; c++) {
        let allNum = body.length > 0;
        for (const row of body) {
          const cell = row[c] ?? '';
          if (cell.trim() !== '' && !isNumeric(cell)) {
            allNum = false;
            break;
          }
        }
        numericCol.push(allNum);
      }

      // widths
      const widths: number[] = [];
      if (widthMode === 'manual') {
        const parts = manualWidths
          .split(',')
          .map((s) => Math.floor(Number(s.trim())))
          .filter((n) => Number.isFinite(n) && n > 0);
        if (parts.length === 0) throw new Error('Enter comma-separated column widths (e.g. 4,18,10).');
        for (let c = 0; c < nCols; c++) widths.push(parts[c] ?? parts[parts.length - 1] ?? 8);
      } else {
        for (let c = 0; c < nCols; c++) {
          let w = includeHeader ? (head[c] ?? '').length : 0;
          for (const row of body) w = Math.max(w, (row[c] ?? '').length);
          widths.push(Math.max(1, w));
        }
      }

      const gapStr = ' '.repeat(gapN);

      const fmtCell = (raw: string, col: number): string => {
        const w = widths[col] ?? 8;
        let cell = raw;
        if (cell.length > w) {
          if (overflow === 'truncate') cell = cell.slice(0, w);
          // overflow: leave full-length (breaks alignment intentionally)
        }
        if (cell.length >= w) return cell;
        const fill = pad.repeat(w - cell.length);
        const rightAlign =
          align === 'right' || (align === 'auto' && (numericCol[col] ?? false));
        return rightAlign ? fill + cell : cell + fill;
      };

      const renderRow = (cells: string[]): string => {
        const out: string[] = [];
        for (let c = 0; c < nCols; c++) out.push(fmtCell(cells[c] ?? '', c));
        return out.join(gapStr).replace(/[ ]+$/u, '');
      };

      const lines: string[] = [];
      if (includeHeader) {
        lines.push(renderRow(head));
        if (ruler) {
          const rulerCells = widths.map((w) => '-'.repeat(w));
          lines.push(rulerCells.join(gapStr).replace(/[ ]+$/u, ''));
        }
      }
      for (const row of body) lines.push(renderRow(row));
      return lines.join('\n');
    },
    [delim, widthMode, manualWidths, align, gap, includeHeader, ruler, overflow, padChar]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[delim, widthMode, manualWidths, align, gap, includeHeader, ruler, overflow, padChar]}
      inputLabel="CSV"
      outputLabel="Fixed-width text"
      inputPlaceholder={'id,name\n1,Ada'}
      sample={SAMPLE}
      downloadName="fixed-width.txt"
      downloadMime="text/plain"
      options={
        <>
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
          <Field label="Widths">
            <Select value={widthMode} onValueChange={(v) => setWidthMode(v as WidthMode)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (max length)</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {widthMode === 'manual' && (
            <Field label="Column widths (comma sep)">
              <Input
                value={manualWidths}
                onChange={(e) => setManualWidths(e.target.value)}
                className="w-44 font-mono"
                placeholder="4,18,10"
              />
            </Field>
          )}
          <Field label="Alignment">
            <Select value={align} onValueChange={(v) => setAlign(v as Align)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (numbers right)</SelectItem>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Column gap">
            <Input value={gap} onChange={(e) => setGap(e.target.value)} inputMode="numeric" className="w-20" />
          </Field>
          <Field label="Pad char">
            <Input value={padChar} onChange={(e) => setPadChar(e.target.value)} maxLength={1} className="w-16 font-mono" />
          </Field>
          {widthMode === 'manual' && (
            <Field label="When too long">
              <Select value={overflow} onValueChange={(v) => setOverflow(v as Overflow)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="truncate">Truncate</SelectItem>
                  <SelectItem value="overflow">Overflow</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Header">
            <div className="flex h-8 items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={includeHeader} onCheckedChange={setIncludeHeader} /> include header
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={ruler} onCheckedChange={setRuler} /> ruler line
              </label>
            </div>
          </Field>
        </>
      }
    />
  );
}
