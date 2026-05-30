'use client';

import { useState } from 'react';
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

type DelimKey = 'comma' | 'tab' | 'semicolon' | 'pipe';

const DELIMS: Record<DelimKey, string> = {
  comma: ',',
  tab: '\t',
  semicolon: ';',
  pipe: '|',
};

const SAMPLE = `id,first,last,email
1,Ada,Lovelace,ada@example.com
2,Grace,Hopper,grace@example.com
3,Alan,Turing,alan@example.com`;

function parseDelimited(text: string, delimiter: string): string[][] {
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

export default function ColumnReorderTool() {
  const [inDelim, setInDelim] = useState<DelimKey>('comma');
  const [outDelim, setOutDelim] = useState<DelimKey>('comma');
  const [hasHeader, setHasHeader] = useState(true);
  const [oneBased, setOneBased] = useState(true);
  const [spec, setSpec] = useState('first,last,email,id');

  return (
    <TextToolLayout
      deps={[inDelim, outDelim, hasHeader, oneBased, spec]}
      sample={SAMPLE}
      inputLabel="Delimited input"
      outputLabel="Reordered"
      downloadName="reordered.csv"
      downloadMime="text/csv"
      transform={(input) => {
        if (!input.trim()) return '';
        const rows = parseDelimited(input, DELIMS[inDelim]);
        if (rows.length === 0) return '';

        const specTokens = spec
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s !== '');
        if (specTokens.length === 0) {
          throw new Error('Enter an ordering spec (comma list of indices or header names).');
        }

        const header = hasHeader ? rows[0] ?? [] : [];
        const headerLower = header.map((h) => h.trim().toLowerCase());

        // Resolve each spec token to a 0-based column index.
        const indices: number[] = specTokens.map((tok) => {
          // Numeric index?
          if (/^-?\d+$/.test(tok)) {
            const n = Number(tok);
            const idx = oneBased ? n - 1 : n;
            return idx;
          }
          // Header name lookup (case-insensitive).
          if (!hasHeader) {
            throw new Error(
              `Column "${tok}" is a name, but "Header present" is off — use numeric indices.`,
            );
          }
          const found = headerLower.indexOf(tok.toLowerCase());
          if (found === -1) {
            throw new Error(`Column "${tok}" not found in header row.`);
          }
          return found;
        });

        const dataRows = hasHeader ? rows.slice(1) : rows;
        const outRows: string[][] = [];

        if (hasHeader) {
          outRows.push(
            indices.map((idx) => header[idx] ?? ''),
          );
        }
        for (const r of dataRows) {
          outRows.push(indices.map((idx) => r[idx] ?? ''));
        }

        const od = DELIMS[outDelim];
        return outRows
          .map((r) => r.map((f) => serializeField(f, od)).join(od))
          .join('\n');
      }}
      options={
        <>
          <Field label="Input delimiter">
            <Select value={inDelim} onValueChange={(v) => setInDelim(v as DelimKey)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comma">Comma (,)</SelectItem>
                <SelectItem value="tab">Tab (\t)</SelectItem>
                <SelectItem value="semicolon">Semicolon (;)</SelectItem>
                <SelectItem value="pipe">Pipe (|)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Output delimiter">
            <Select value={outDelim} onValueChange={(v) => setOutDelim(v as DelimKey)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comma">Comma (,)</SelectItem>
                <SelectItem value="tab">Tab (\t)</SelectItem>
                <SelectItem value="semicolon">Semicolon (;)</SelectItem>
                <SelectItem value="pipe">Pipe (|)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Order spec (indices or names)" className="min-w-[220px] flex-1">
            <Input
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              placeholder="e.g. 3,1,name"
            />
          </Field>
          <Field label="Header present">
            <Switch checked={hasHeader} onCheckedChange={setHasHeader} />
          </Field>
          <Field label="1-based indices">
            <Switch checked={oneBased} onCheckedChange={setOneBased} />
          </Field>
        </>
      }
    />
  );
}
