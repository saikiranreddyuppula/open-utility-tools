'use client';

import { useMemo, useState } from 'react';
import {
  Panel,
  PanelHeader,
  OptionsBar,
  Field,
  StatBar,
} from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Align = 'left' | 'center' | 'right';
type Delim = 'auto' | 'comma' | 'tab';

const SAMPLE = `Name, Role, Score
Ada, Engineer, 98
Linus, Maintainer, 87
Grace, Admiral, 100`;

function detectDelimiter(text: string, mode: Delim): string {
  if (mode === 'comma') return ',';
  if (mode === 'tab') return '\t';
  // auto: prefer tab if any line contains a tab, else comma
  return text.includes('\t') ? '\t' : ',';
}

function parseLine(line: string, delim: string): string[] {
  if (delim === '\t') {
    return line.split('\t').map((c) => c.trim());
  }
  // CSV with basic quote handling
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i] ?? '';
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
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
    } else if (ch === ',') {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseGrid(text: string, mode: Delim): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];
  const delim = detectDelimiter(text, mode);
  return lines.map((l) => parseLine(l, delim));
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

function sepCell(align: Align, width: number): string {
  const w = Math.max(width, align === 'center' ? 3 : 1);
  switch (align) {
    case 'left':
      return ':' + '-'.repeat(Math.max(w - 1, 1));
    case 'right':
      return '-'.repeat(Math.max(w - 1, 1)) + ':';
    case 'center':
      return ':' + '-'.repeat(Math.max(w - 2, 1)) + ':';
  }
}

function pad(value: string, width: number, align: Align): string {
  const len = value.length;
  if (len >= width) return value;
  const diff = width - len;
  if (align === 'right') return ' '.repeat(diff) + value;
  if (align === 'center') {
    const left = Math.floor(diff / 2);
    const right = diff - left;
    return ' '.repeat(left) + value + ' '.repeat(right);
  }
  return value + ' '.repeat(diff);
}

function buildTable(
  rows: string[][],
  aligns: Align[],
  pretty: boolean,
): string {
  if (rows.length === 0) return '';
  const colCount = rows.reduce((m, r) => Math.max(m, r.length), 0);
  if (colCount === 0) return '';

  // normalize rows to colCount, escape cells
  const norm: string[][] = rows.map((r) => {
    const out: string[] = [];
    for (let c = 0; c < colCount; c++) {
      out.push(escapeCell(r[c] ?? ''));
    }
    return out;
  });

  const colAligns: Align[] = [];
  for (let c = 0; c < colCount; c++) {
    colAligns.push(aligns[c] ?? 'left');
  }

  const header = norm[0] ?? [];
  const bodyRows = norm.slice(1);

  if (!pretty) {
    const lines: string[] = [];
    lines.push('| ' + header.map((h) => h).join(' | ') + ' |');
    lines.push(
      '| ' + colAligns.map((a) => sepCell(a, 3)).join(' | ') + ' |',
    );
    for (const r of bodyRows) {
      lines.push('| ' + r.join(' | ') + ' |');
    }
    return lines.join('\n');
  }

  // compute widths (min 3 for readable separators)
  const widths: number[] = [];
  for (let c = 0; c < colCount; c++) {
    let w = (header[c] ?? '').length;
    for (const r of bodyRows) {
      w = Math.max(w, (r[c] ?? '').length);
    }
    widths.push(Math.max(w, 3));
  }

  const lines: string[] = [];
  lines.push(
    '| ' +
      header
        .map((h, c) => pad(h, widths[c] ?? 3, colAligns[c] ?? 'left'))
        .join(' | ') +
      ' |',
  );
  lines.push(
    '| ' +
      colAligns.map((a, c) => sepCell(a, widths[c] ?? 3)).join(' | ') +
      ' |',
  );
  for (const r of bodyRows) {
    lines.push(
      '| ' +
        r
          .map((cell, c) => pad(cell, widths[c] ?? 3, colAligns[c] ?? 'left'))
          .join(' | ') +
        ' |',
    );
  }
  return lines.join('\n');
}

export default function MarkdownTableGeneratorTool() {
  const [raw, setRaw] = useState(SAMPLE);
  const [delim, setDelim] = useState<Delim>('auto');
  const [pretty, setPretty] = useState(true);
  const [aligns, setAligns] = useState<Align[]>([]);

  const rows = useMemo(() => parseGrid(raw, delim), [raw, delim]);
  const colCount = useMemo(
    () => rows.reduce((m, r) => Math.max(m, r.length), 0),
    [rows],
  );

  const effectiveAligns = useMemo(() => {
    const out: Align[] = [];
    for (let c = 0; c < colCount; c++) {
      out.push(aligns[c] ?? 'left');
    }
    return out;
  }, [aligns, colCount]);

  const output = useMemo(
    () => buildTable(rows, effectiveAligns, pretty),
    [rows, effectiveAligns, pretty],
  );

  const setColAlign = (col: number, value: Align) => {
    setAligns((prev) => {
      const next = [...prev];
      while (next.length <= col) next.push('left');
      next[col] = value;
      return next;
    });
  };

  const rowCount = rows.length > 0 ? rows.length - 1 : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <PanelHeader title="Input (CSV / TSV)" />
        <OptionsBar>
          <Field label="Delimiter">
            <Tabs
              value={delim}
              onValueChange={(v) => setDelim(v as Delim)}
            >
              <TabsList>
                <TabsTrigger value="auto">Auto</TabsTrigger>
                <TabsTrigger value="comma">Comma</TabsTrigger>
                <TabsTrigger value="tab">Tab</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Pretty (pad cells)">
            <Switch checked={pretty} onCheckedChange={setPretty} />
          </Field>
        </OptionsBar>
        <Textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="Paste CSV or TSV. First row is treated as the header."
          className="min-h-[220px] font-mono text-sm"
          spellCheck={false}
        />
        {colCount > 0 && (
          <div className="mt-3 flex flex-wrap gap-3">
            {Array.from({ length: colCount }, (_, c) => (
              <Field
                key={c}
                label={`Col ${c + 1} align`}
                className="min-w-[140px]"
              >
                <Select
                  value={effectiveAligns[c] ?? 'left'}
                  onValueChange={(v) => setColAlign(c, v as Align)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            ))}
          </div>
        )}
      </Panel>

      <Panel>
        <PanelHeader title="Markdown">
          <CopyButton value={output} />
        </PanelHeader>
        <Textarea
          value={output}
          readOnly
          className="min-h-[220px] font-mono text-sm"
          spellCheck={false}
        />
        <StatBar
          items={[
            `${colCount} column${colCount === 1 ? '' : 's'}`,
            `${rowCount} row${rowCount === 1 ? '' : 's'}`,
            `${output.length} chars`,
          ]}
        />
      </Panel>
    </div>
  );
}
