'use client';

import { useCallback, useState } from 'react';

import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SAMPLE = `| Name | Role | Score |
|:--|---|--:|
| Ada Lovelace | Engineer | 95 |
| Bob | QA | 7 |
| Charlie Brown | Product Manager | 100 |`;

type Align = 'keep' | 'left' | 'center' | 'right';

// number of display cells (count code points so emoji/astral chars don't over-count)
function dispWidth(s: string): number {
  return Array.from(s).length;
}

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  // split on unescaped pipes
  const cells: string[] = [];
  let buf = '';
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i] ?? '';
    if (ch === '\\' && s[i + 1] === '|') {
      buf += '\\|';
      i += 1;
      continue;
    }
    if (ch === '|') {
      cells.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  cells.push(buf);
  return cells.map((c) => c.trim());
}

function isSeparatorRow(cells: string[]): boolean {
  if (cells.length === 0) return false;
  return cells.every((c) => /^:?-+:?$/.test(c.trim()));
}

function parseAlign(cell: string): Align {
  const c = cell.trim();
  const left = c.startsWith(':');
  const right = c.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return 'keep';
}

function escapePipes(cell: string, escape: boolean): string {
  if (!escape) return cell;
  // escape any pipe not already escaped
  return cell.replace(/\\?\|/g, (m) => (m === '\\|' ? m : '\\|'));
}

function padCell(cell: string, width: number, align: Align): string {
  const len = dispWidth(cell);
  const gap = Math.max(0, width - len);
  if (align === 'right') return ' '.repeat(gap) + cell;
  if (align === 'center') {
    const l = Math.floor(gap / 2);
    const r = gap - l;
    return ' '.repeat(l) + cell + ' '.repeat(r);
  }
  // left / keep / default
  return cell + ' '.repeat(gap);
}

function sepCell(width: number, align: Align): string {
  // ensure at least 3 dashes incl. colons, fitting `width`
  const w = Math.max(width, 1);
  if (align === 'center') {
    const dashes = Math.max(1, w - 2);
    return `:${'-'.repeat(dashes)}:`;
  }
  if (align === 'right') {
    const dashes = Math.max(1, w - 1);
    return `${'-'.repeat(dashes)}:`;
  }
  if (align === 'left') {
    const dashes = Math.max(1, w - 1);
    return `:${'-'.repeat(dashes)}`;
  }
  return '-'.repeat(w);
}

function format(
  input: string,
  globalAlign: Align,
  outerPipes: boolean,
  compact: boolean,
  escape: boolean
): string {
  const tableLines = input.split('\n').filter((l) => l.trim().includes('|'));
  if (tableLines.length < 1) {
    throw new Error('No Markdown table found. Rows must contain "|".');
  }

  const rows: string[][] = [];
  let sepIndex = -1;
  for (let i = 0; i < tableLines.length; i += 1) {
    const line = tableLines[i] ?? '';
    const cells = splitRow(line);
    if (sepIndex === -1 && i > 0 && isSeparatorRow(cells)) {
      sepIndex = rows.length;
    }
    rows.push(cells);
  }

  // header is first row; separator is the detected one (or synthesize after header)
  const header = rows[0];
  if (!header) throw new Error('Table has no header row.');

  let colAligns: Align[] = [];
  let dataRows: string[][];
  if (sepIndex === 1 && rows[1]) {
    colAligns = (rows[1] ?? []).map(parseAlign);
    dataRows = rows.slice(2);
  } else {
    // no valid separator detected; treat everything after header as data, default align
    dataRows = rows.slice(1);
  }

  const colCount = Math.max(
    header.length,
    colAligns.length,
    ...dataRows.map((r) => r.length),
    1
  );

  // normalize rows to colCount
  const norm = (r: string[]): string[] => {
    const out = r.slice(0, colCount).map((c) => escapePipes(c, escape));
    while (out.length < colCount) out.push('');
    return out;
  };

  const headerCells = norm(header);
  const bodyCells = dataRows.map(norm);

  // effective alignment per column
  const aligns: Align[] = [];
  for (let c = 0; c < colCount; c += 1) {
    if (globalAlign !== 'keep') {
      aligns.push(globalAlign);
    } else {
      aligns.push(colAligns[c] ?? 'keep');
    }
  }

  if (compact) {
    const buildCompact = (cells: string[]): string => {
      const inner = cells.map((c) => c).join(' | ');
      return outerPipes ? `| ${inner} |` : inner;
    };
    const sep = aligns.map((a) => sepCell(3, a === 'keep' ? 'left' : a));
    const lines: string[] = [];
    lines.push(buildCompact(headerCells));
    lines.push(outerPipes ? `| ${sep.join(' | ')} |` : sep.join(' | '));
    for (const row of bodyCells) lines.push(buildCompact(row));
    return lines.join('\n') + '\n';
  }

  // aligned mode: compute column widths from header + body (separator needs >=3)
  const widths: number[] = [];
  for (let c = 0; c < colCount; c += 1) {
    let w = dispWidth(headerCells[c] ?? '');
    for (const row of bodyCells) {
      w = Math.max(w, dispWidth(row[c] ?? ''));
    }
    widths.push(Math.max(w, 3));
  }

  const buildRow = (cells: string[]): string => {
    const padded = cells.map((cell, c) =>
      padCell(cell, widths[c] ?? 0, aligns[c] ?? 'left')
    );
    const inner = padded.join(' | ');
    return outerPipes ? `| ${inner} |` : inner;
  };

  const sepCells = aligns.map((a, c) =>
    sepCell(widths[c] ?? 3, a === 'keep' ? 'left' : a)
  );
  const sepLine = outerPipes ? `| ${sepCells.join(' | ')} |` : sepCells.join(' | ');

  const lines: string[] = [];
  lines.push(buildRow(headerCells));
  lines.push(sepLine);
  for (const row of bodyCells) lines.push(buildRow(row));
  return lines.join('\n') + '\n';
}

export default function MarkdownTableFormatterTool() {
  const [align, setAlign] = useState<Align>('keep');
  const [outerPipes, setOuterPipes] = useState(true);
  const [compact, setCompact] = useState(false);
  const [escape, setEscape] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      return format(input, align, outerPipes, compact, escape);
    },
    [align, outerPipes, compact, escape]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[align, outerPipes, compact, escape]}
      inputLabel="Markdown Table"
      outputLabel="Formatted"
      sample={SAMPLE}
      downloadName="table.md"
      downloadMime="text/markdown"
      options={
        <>
          <Field label="Alignment">
            <Tabs value={align} onValueChange={(v) => setAlign(v as Align)}>
              <TabsList>
                <TabsTrigger value="keep">Keep</TabsTrigger>
                <TabsTrigger value="left">Left</TabsTrigger>
                <TabsTrigger value="center">Center</TabsTrigger>
                <TabsTrigger value="right">Right</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Outer pipes">
            <Switch checked={outerPipes} onCheckedChange={setOuterPipes} />
          </Field>
          <Field label="Compact">
            <Switch checked={compact} onCheckedChange={setCompact} />
          </Field>
          <Field label="Escape | in cells">
            <Switch checked={escape} onCheckedChange={setEscape} />
          </Field>
        </>
      }
    />
  );
}
