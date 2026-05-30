'use client';

import { useCallback, useState } from 'react';

import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SAMPLE = `| id | name | active | score |
|---:|------|:------:|------:|
| 1  | Ada  | true   | 9.5   |
| 2  | Bob  | false  | 7     |
| 3  | Cara |        | 12    |`;

type Shape = 'objects' | 'arrays';
type MissingMode = 'null' | 'empty' | 'skip';

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells: string[] = [];
  let buf = '';
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i] ?? '';
    if (ch === '\\' && s[i + 1] === '|') {
      buf += '|';
      i += 1;
      continue;
    }
    if (ch === '|') {
      cells.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  cells.push(buf.trim());
  return cells;
}

function isSeparatorRow(cells: string[]): boolean {
  if (cells.length === 0) return false;
  return cells.every((c) => /^:?-+:?$/.test(c.trim()));
}

function inferValue(raw: string): unknown {
  const t = raw.trim();
  if (t === '') return null;
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  // integer
  if (/^[+-]?\d+$/.test(t)) {
    const n = Number(t);
    if (Number.isSafeInteger(n)) return n;
  }
  // float
  if (/^[+-]?(\d+\.\d*|\.\d+|\d+)(e[+-]?\d+)?$/i.test(t) && /[.eE]/.test(t)) {
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  return raw;
}

function convert(
  input: string,
  infer: boolean,
  indent: number,
  missing: MissingMode,
  shape: Shape
): string {
  const tableLines = input.split('\n').filter((l) => l.trim().includes('|'));
  if (tableLines.length === 0) {
    throw new Error('No Markdown table found. Rows must contain "|".');
  }

  const headerLine = tableLines[0] ?? '';
  const headers = splitRow(headerLine);
  if (headers.length === 0) throw new Error('Header row is empty.');

  let dataStart = 1;
  const secondLine = tableLines[1] ?? '';
  if (secondLine && isSeparatorRow(splitRow(secondLine))) {
    dataStart = 2;
  }

  const dataLines = tableLines.slice(dataStart);

  const cellValue = (raw: string): unknown => (infer ? inferValue(raw) : raw);

  if (shape === 'arrays') {
    const arr: unknown[][] = [];
    arr.push(headers);
    for (const line of dataLines) {
      const cells = splitRow(line);
      const row: unknown[] = [];
      for (let c = 0; c < headers.length; c += 1) {
        const cell = cells[c];
        if (cell === undefined) {
          if (missing === 'skip') continue;
          row.push(missing === 'empty' ? '' : null);
        } else {
          row.push(cellValue(cell));
        }
      }
      arr.push(row);
    }
    return JSON.stringify(arr, null, indent) + '\n';
  }

  const out: Record<string, unknown>[] = [];
  for (const line of dataLines) {
    const cells = splitRow(line);
    const obj: Record<string, unknown> = {};
    for (let c = 0; c < headers.length; c += 1) {
      const key = headers[c] ?? `col${c}`;
      const cell = cells[c];
      if (cell === undefined) {
        if (missing === 'skip') continue;
        obj[key] = missing === 'empty' ? '' : null;
      } else {
        obj[key] = cellValue(cell);
      }
    }
    out.push(obj);
  }

  return JSON.stringify(out, null, indent) + '\n';
}

export default function MarkdownTableToJsonTool() {
  const [infer, setInfer] = useState(true);
  const [indent, setIndent] = useState('2');
  const [missing, setMissing] = useState<MissingMode>('null');
  const [shape, setShape] = useState<Shape>('objects');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const ind = Number(indent);
      const safeIndent = Number.isFinite(ind) && ind >= 0 ? ind : 2;
      return convert(input, infer, safeIndent, missing, shape);
    },
    [infer, indent, missing, shape]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[infer, indent, missing, shape]}
      inputLabel="Markdown Table"
      outputLabel="JSON"
      sample={SAMPLE}
      downloadName="table.json"
      downloadMime="application/json"
      options={
        <>
          <Field label="Output">
            <Tabs value={shape} onValueChange={(v) => setShape(v as Shape)}>
              <TabsList>
                <TabsTrigger value="objects">Array of objects</TabsTrigger>
                <TabsTrigger value="arrays">Array of arrays</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Type inference">
            <Switch checked={infer} onCheckedChange={setInfer} />
          </Field>
          <Field label="Missing cells">
            <Select value={missing} onValueChange={(v) => setMissing(v as MissingMode)}>
              <SelectTrigger className="h-8 w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">null</SelectItem>
                <SelectItem value="empty">empty</SelectItem>
                <SelectItem value="skip">skip</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Indent">
            <Select value={indent} onValueChange={setIndent}>
              <SelectTrigger className="h-8 w-[90px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Minified</SelectItem>
                <SelectItem value="2">2 spaces</SelectItem>
                <SelectItem value="4">4 spaces</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      }
    />
  );
}
