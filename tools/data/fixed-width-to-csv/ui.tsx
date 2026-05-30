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

type LayoutMode = 'widths' | 'positions';
type TrimMode = 'both' | 'left' | 'right' | 'none';
type DelimKey = 'comma' | 'tab' | 'semicolon' | 'pipe';

const DELIMS: Record<DelimKey, string> = {
  comma: ',',
  tab: '\t',
  semicolon: ';',
  pipe: '|',
};

const SAMPLE = `1001  Ada       Lovelace  London
1002  Grace     Hopper    New York
1003  Alan      Turing    Bletchley `;

function trimField(s: string, mode: TrimMode): string {
  switch (mode) {
    case 'both':
      return s.trim();
    case 'left':
      return s.replace(/^\s+/, '');
    case 'right':
      return s.replace(/\s+$/, '');
    case 'none':
      return s;
    default:
      return s;
  }
}

function csvField(field: string, delimiter: string): string {
  const needsQuote =
    field.includes(delimiter) ||
    field.includes('"') ||
    field.includes('\n') ||
    field.includes('\r');
  if (!needsQuote) return field;
  return `"${field.replace(/"/g, '""')}"`;
}

/** Parse a comma list of positive integers; throws on invalid entries. */
function parseIntList(spec: string, label: string): number[] {
  const tokens = spec
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t !== '');
  const out: number[] = [];
  for (const t of tokens) {
    if (!/^\d+$/.test(t)) {
      throw new Error(`${label} must be a comma list of numbers (got "${t}").`);
    }
    out.push(Number(t));
  }
  if (out.length === 0) throw new Error(`Enter at least one ${label.toLowerCase()}.`);
  return out;
}

export default function FixedWidthToCsvTool() {
  const [mode, setMode] = useState<LayoutMode>('widths');
  const [layout, setLayout] = useState('6,10,10,10');
  const [headers, setHeaders] = useState('id,first,last,city');
  const [trim, setTrim] = useState<TrimMode>('both');
  const [outDelim, setOutDelim] = useState<DelimKey>('comma');

  return (
    <TextToolLayout
      deps={[mode, layout, headers, trim, outDelim]}
      sample={SAMPLE}
      inputLabel="Fixed-width text"
      outputLabel="CSV"
      downloadName="fixed-width.csv"
      downloadMime="text/csv"
      transform={(input) => {
        if (!input.replace(/\n+$/, '').trim()) return '';
        const od = DELIMS[outDelim];

        // Compute slice ranges [start, end) per field.
        const ranges: Array<[number, number]> = [];
        if (mode === 'widths') {
          const widths = parseIntList(layout, 'Widths');
          let cursor = 0;
          for (const w of widths) {
            if (w <= 0) throw new Error('Widths must be positive integers.');
            ranges.push([cursor, cursor + w]);
            cursor += w;
          }
        } else {
          const positions = parseIntList(layout, 'Positions');
          // Positions are 1-based column indices where each field ends.
          let prev = 0;
          const sorted = [...positions];
          for (const pos of sorted) {
            if (pos <= prev) {
              throw new Error('Cut positions must be strictly increasing.');
            }
            ranges.push([prev, pos]);
            prev = pos;
          }
          // Trailing field captures everything after the last position.
          ranges.push([prev, Number.MAX_SAFE_INTEGER]);
        }

        const headerNames = headers
          .split(',')
          .map((h) => h.trim())
          .filter((h) => h !== '');

        const lines = input.split(/\r?\n/);
        // Drop a single trailing empty line caused by a final newline.
        while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

        const rows: string[][] = [];
        if (headerNames.length > 0) {
          // Use only as many headers as there are fields; pad with generic names.
          const hr: string[] = [];
          for (let i = 0; i < ranges.length; i++) {
            hr.push(headerNames[i] ?? `field${i + 1}`);
          }
          rows.push(hr);
        }

        for (const line of lines) {
          const fields: string[] = [];
          for (const [start, end] of ranges) {
            const slice = end === Number.MAX_SAFE_INTEGER ? line.slice(start) : line.slice(start, end);
            fields.push(trimField(slice, trim));
          }
          rows.push(fields);
        }

        return rows.map((r) => r.map((f) => csvField(f, od)).join(od)).join('\n');
      }}
      options={
        <>
          <Field label="Layout mode">
            <Select value={mode} onValueChange={(v) => setMode(v as LayoutMode)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="widths">Field widths</SelectItem>
                <SelectItem value="positions">Cut positions</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field
            label={mode === 'widths' ? 'Widths (e.g. 6,10,10)' : 'End positions (e.g. 6,16,26)'}
            className="min-w-[200px] flex-1"
          >
            <Input value={layout} onChange={(e) => setLayout(e.target.value)} />
          </Field>
          <Field label="Header names (optional)" className="min-w-[200px] flex-1">
            <Input
              value={headers}
              onChange={(e) => setHeaders(e.target.value)}
              placeholder="leave blank for none"
            />
          </Field>
          <Field label="Trim">
            <Select value={trim} onValueChange={(v) => setTrim(v as TrimMode)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Both</SelectItem>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="right">Right</SelectItem>
                <SelectItem value="none">None</SelectItem>
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
        </>
      }
    />
  );
}
