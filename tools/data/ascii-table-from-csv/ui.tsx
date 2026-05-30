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

type BorderStyle = 'ascii' | 'unicode';
type Align = 'left' | 'center' | 'right' | 'auto';
type DelimKey = 'comma' | 'tab' | 'semicolon' | 'pipe';

const DELIMS: Record<DelimKey, string> = { comma: ',', tab: '\t', semicolon: ';', pipe: '|' };

const SAMPLE = `name,role,salary
Ada Lovelace,Engineer,120000
Grace Hopper,Admiral,95000
Alan Turing,Cryptanalyst,110000`;

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

function dispWidth(s: string): number {
  return s.length;
}

// Wrap a single string into lines no wider than `max`.
function wrapCell(value: string, max: number): string[] {
  if (max <= 0 || value.length <= max) return [value];
  const lines: string[] = [];
  let rest = value;
  while (rest.length > max) {
    lines.push(rest.slice(0, max));
    rest = rest.slice(max);
  }
  if (rest.length > 0) lines.push(rest);
  return lines.length > 0 ? lines : [''];
}

function isNumeric(s: string): boolean {
  const t = s.trim();
  if (t === '') return false;
  return Number.isFinite(Number(t));
}

function pad(text: string, width: number, align: Align): string {
  const len = dispWidth(text);
  const space = Math.max(0, width - len);
  if (align === 'right') return ' '.repeat(space) + text;
  if (align === 'center') {
    const left = Math.floor(space / 2);
    return ' '.repeat(left) + text + ' '.repeat(space - left);
  }
  return text + ' '.repeat(space);
}

interface BorderChars {
  topL: string; topM: string; topR: string;
  midL: string; midM: string; midR: string;
  botL: string; botM: string; botR: string;
  h: string; v: string;
}

const BORDERS: Record<BorderStyle, BorderChars> = {
  ascii: {
    topL: '+', topM: '+', topR: '+',
    midL: '+', midM: '+', midR: '+',
    botL: '+', botM: '+', botR: '+',
    h: '-', v: '|',
  },
  unicode: {
    topL: '┌', topM: '┬', topR: '┐',
    midL: '├', midM: '┼', midR: '┤',
    botL: '└', botM: '┴', botR: '┘',
    h: '─', v: '│',
  },
};

export default function AsciiTableFromCsv() {
  const [style, setStyle] = useState<BorderStyle>('unicode');
  const [align, setAlign] = useState<Align>('auto');
  const [header, setHeader] = useState(true);
  const [headerSep, setHeaderSep] = useState(true);
  const [padding, setPadding] = useState('1');
  const [maxWidth, setMaxWidth] = useState('30');
  const [delim, setDelim] = useState<DelimKey>('comma');

  return (
    <TextToolLayout
      deps={[style, align, header, headerSep, padding, maxWidth, delim]}
      sample={SAMPLE}
      inputLabel="CSV"
      outputLabel="Box table"
      downloadName="table.txt"
      transform={(input) => {
        if (!input.trim()) return '';
        const rows = parseCSV(input, DELIMS[delim]);
        if (rows.length === 0) return '';
        const cols = rows.reduce((m, r) => Math.max(m, r.length), 0);
        const padN = Math.max(0, Math.min(Number(padding) || 0, 8));
        const maxW = Math.max(0, Math.min(Number(maxWidth) || 0, 200));

        // Normalize rows to `cols` columns and wrap cells.
        const wrapped: string[][][] = rows.map((r) => {
          const out: string[][] = [];
          for (let c = 0; c < cols; c++) {
            const cell = r[c] ?? '';
            out.push(wrapCell(cell, maxW));
          }
          return out;
        });

        // Column widths = max line width across all rows.
        const widths: number[] = new Array<number>(cols).fill(0);
        for (const r of wrapped) {
          for (let c = 0; c < cols; c++) {
            const lines = r[c] ?? [''];
            for (const ln of lines) widths[c] = Math.max(widths[c] ?? 0, dispWidth(ln));
          }
        }

        // Per-column alignment: 'auto' = right for numeric data columns.
        const dataRows = header ? rows.slice(1) : rows;
        const colAlign: Align[] = [];
        for (let c = 0; c < cols; c++) {
          if (align !== 'auto') {
            colAlign.push(align);
            continue;
          }
          const sample = dataRows.map((r) => r[c] ?? '').filter((v) => v.trim() !== '');
          const allNum = sample.length > 0 && sample.every(isNumeric);
          colAlign.push(allNum ? 'right' : 'left');
        }

        const b = BORDERS[style];
        const cellW = (c: number) => (widths[c] ?? 0) + padN * 2;

        const rule = (l: string, m: string, r: string): string => {
          const segs: string[] = [];
          for (let c = 0; c < cols; c++) segs.push(b.h.repeat(cellW(c)));
          return l + segs.join(m) + r;
        };

        const renderRow = (cells: string[][]): string => {
          const height = cells.reduce((h, lines) => Math.max(h, lines.length), 1);
          const out: string[] = [];
          for (let lineIdx = 0; lineIdx < height; lineIdx++) {
            const parts: string[] = [];
            for (let c = 0; c < cols; c++) {
              const lines = cells[c] ?? [''];
              const txt = lines[lineIdx] ?? '';
              const a = colAlign[c] ?? 'left';
              parts.push(' '.repeat(padN) + pad(txt, widths[c] ?? 0, a) + ' '.repeat(padN));
            }
            out.push(b.v + parts.join(b.v) + b.v);
          }
          return out.join('\n');
        };

        const lines: string[] = [];
        lines.push(rule(b.topL, b.topM, b.topR));
        for (let i = 0; i < wrapped.length; i++) {
          const r = wrapped[i];
          if (!r) continue;
          lines.push(renderRow(r));
          if (header && headerSep && i === 0) {
            lines.push(rule(b.midL, b.midM, b.midR));
          }
        }
        lines.push(rule(b.botL, b.botM, b.botR));
        return lines.join('\n');
      }}
      options={
        <>
          <Field label="Border style">
            <Select value={style} onValueChange={(v) => setStyle(v as BorderStyle)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unicode">Unicode box</SelectItem>
                <SelectItem value="ascii">ASCII (+-|)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Alignment">
            <Select value={align} onValueChange={(v) => setAlign(v as Align)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (num→right)</SelectItem>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
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
          <Field label="Cell padding" hint="0-8 spaces">
            <Input
              type="number"
              min={0}
              max={8}
              value={padding}
              onChange={(e) => setPadding(e.target.value)}
              className="w-20 font-mono"
            />
          </Field>
          <Field label="Max col width" hint="0 = no wrap">
            <Input
              type="number"
              min={0}
              max={200}
              value={maxWidth}
              onChange={(e) => setMaxWidth(e.target.value)}
              className="w-24 font-mono"
            />
          </Field>
          <Field label="First row is header">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={header} onCheckedChange={setHeader} />
              <Label className="text-xs text-muted-foreground">header</Label>
            </div>
          </Field>
          <Field label="Header separator">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={headerSep} onCheckedChange={setHeaderSep} />
              <Label className="text-xs text-muted-foreground">rule line</Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
