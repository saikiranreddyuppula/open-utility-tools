'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
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

const SAMPLE = `| Name    | Role       | Score |
|:--------|:----------:|------:|
| Ada     | Engineer   | 95    |
| Linus   | Maintainer | 88    |
| Grace   | Admiral    | 100   |`;

type Align = 'left' | 'center' | 'right' | 'none';

/** Split a markdown table row into cells, honoring escaped pipes. */
function splitRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|') && !trimmed.endsWith('\\|')) trimmed = trimmed.slice(0, -1);
  const cells: string[] = [];
  let cur = '';
  let i = 0;
  while (i < trimmed.length) {
    const c = trimmed[i] ?? '';
    if (c === '\\' && trimmed[i + 1] === '|') {
      cur += '|';
      i += 2;
      continue;
    }
    if (c === '|') {
      cells.push(cur.trim());
      cur = '';
      i++;
      continue;
    }
    cur += c;
    i++;
  }
  cells.push(cur.trim());
  return cells;
}

function parseAlign(cell: string): Align {
  const t = cell.trim();
  const left = t.startsWith(':');
  const right = t.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return 'none';
}

function isSeparatorRow(cells: string[]): boolean {
  if (cells.length === 0) return false;
  return cells.every((c) => /^:?-{1,}:?$/.test(c.trim()));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function styleFor(align: Align): string {
  if (align === 'none') return '';
  return ` style="text-align:${align}"`;
}

function mdTableToHtml(
  input: string,
  indentUnit: string,
  className: string
): string {
  const rawLines = input.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (rawLines.length < 2) {
    throw new Error('Need at least a header row and a separator row (e.g. |---|).');
  }
  const rows = rawLines.map(splitRow);
  const headerRow = rows[0];
  const sepRow = rows[1];
  if (!headerRow || !sepRow) throw new Error('Malformed table.');
  if (!isSeparatorRow(sepRow)) {
    throw new Error('Second line must be a separator row like | --- | :--: | ---: |.');
  }
  const aligns: Align[] = sepRow.map(parseAlign);
  const bodyRows = rows.slice(2);

  const i1 = indentUnit;
  const i2 = indentUnit.repeat(2);
  const i3 = indentUnit.repeat(3);

  const out: string[] = [];
  const cls = className.trim() ? ` class="${escapeHtml(className.trim())}"` : '';
  out.push(`<table${cls}>`);
  out.push(`${i1}<thead>`);
  out.push(`${i2}<tr>`);
  headerRow.forEach((cell, idx) => {
    const a = aligns[idx] ?? 'none';
    out.push(`${i3}<th${styleFor(a)}>${escapeHtml(cell)}</th>`);
  });
  out.push(`${i2}</tr>`);
  out.push(`${i1}</thead>`);
  out.push(`${i1}<tbody>`);
  for (const row of bodyRows) {
    out.push(`${i2}<tr>`);
    // pad/truncate to header column count
    for (let idx = 0; idx < headerRow.length; idx++) {
      const cell = row[idx] ?? '';
      const a = aligns[idx] ?? 'none';
      out.push(`${i3}<td${styleFor(a)}>${escapeHtml(cell)}</td>`);
    }
    out.push(`${i2}</tr>`);
  }
  out.push(`${i1}</tbody>`);
  out.push('</table>');
  return out.join('\n');
}

export default function MarkdownTableToHtmlTool() {
  const [indent, setIndent] = useState('2');
  const [className, setClassName] = useState('');
  const [useTabs, setUseTabs] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const n = Number(indent);
      const size = Number.isFinite(n) && n >= 0 ? n : 2;
      const unit = useTabs ? '\t' : ' '.repeat(size);
      return mdTableToHtml(input, unit, className);
    },
    [indent, className, useTabs]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[indent, className, useTabs]}
      inputLabel="Markdown table"
      outputLabel="HTML table"
      inputPlaceholder="| A | B |&#10;|---|---|&#10;| 1 | 2 |"
      sample={SAMPLE}
      downloadName="table.html"
      downloadMime="text/html"
      options={
        <>
          <Field label="Indent size">
            <Select value={indent} onValueChange={setIndent}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 spaces</SelectItem>
                <SelectItem value="4">4 spaces</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tabs">
            <div className="flex h-8 items-center gap-2">
              <Switch id="tabs" checked={useTabs} onCheckedChange={setUseTabs} />
              <Label htmlFor="tabs" className="text-xs text-muted-foreground">
                indent with tabs
              </Label>
            </div>
          </Field>
          <Field label="Table class">
            <Input
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="w-40"
              placeholder="(optional)"
            />
          </Field>
        </>
      }
    />
  );
}
