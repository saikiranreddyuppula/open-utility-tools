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

const SAMPLE = `<table>
  <thead>
    <tr><th>Name</th><th>Role</th><th>City</th></tr>
  </thead>
  <tbody>
    <tr><td>Ada</td><td>Engineer</td><td><a href="/london">London</a></td></tr>
    <tr><td>Grace</td><td colspan="2">Admiral &amp; Pioneer</td></tr>
    <tr><td>Alan</td><td>Cryptanalyst</td><td>Bletchley</td></tr>
  </tbody>
</table>`;

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Read a positive integer attribute, defaulting to 1. */
function spanOf(cell: Element, attr: string): number {
  const v = cell.getAttribute(attr);
  if (!v) return 1;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Build a rectangular grid from a <table>, expanding colspan/rowspan. */
function tableToGrid(table: HTMLTableElement, keepLinks: boolean): string[][] {
  const grid: string[][] = [];
  // Pending rowspans: column index -> { text, remaining }.
  const rowspans = new Map<number, { text: string; remaining: number }>();

  const trs = Array.from(table.querySelectorAll('tr'));
  for (const tr of trs) {
    const cells = Array.from(tr.children).filter(
      (c) => c.tagName === 'TD' || c.tagName === 'TH',
    );
    const row: string[] = [];
    let col = 0;

    const placePending = () => {
      while (rowspans.has(col)) {
        const pend = rowspans.get(col);
        if (!pend) break;
        row[col] = pend.text;
        pend.remaining -= 1;
        if (pend.remaining <= 0) rowspans.delete(col);
        col++;
      }
    };

    placePending();
    for (const cell of cells) {
      placePending();
      const colspan = spanOf(cell, 'colspan');
      const rowspan = spanOf(cell, 'rowspan');

      let text: string;
      if (keepLinks) {
        text = collapseWhitespace(cell.textContent ?? '');
      } else {
        const clone = cell.cloneNode(true) as Element;
        clone.querySelectorAll('a').forEach((a) => {
          a.replaceWith(a.ownerDocument.createTextNode(a.textContent ?? ''));
        });
        text = collapseWhitespace(clone.textContent ?? '');
      }

      for (let c = 0; c < colspan; c++) {
        row[col] = text;
        if (rowspan > 1) {
          rowspans.set(col, { text, remaining: rowspan - 1 });
        }
        col++;
      }
    }
    placePending();
    grid.push(row);
  }

  // Normalize to a rectangle (fill holes with empty strings).
  const width = grid.reduce((m, r) => Math.max(m, r.length), 0);
  return grid.map((r) => {
    const out: string[] = [];
    for (let i = 0; i < width; i++) out.push(r[i] ?? '');
    return out;
  });
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

export default function HtmlTableToCsvTool() {
  const [which, setWhich] = useState('1');
  const [outDelim, setOutDelim] = useState<DelimKey>('comma');
  const [keepLinks, setKeepLinks] = useState(true);

  return (
    <TextToolLayout
      deps={[which, outDelim, keepLinks]}
      sample={SAMPLE}
      inputLabel="HTML"
      outputLabel="CSV"
      downloadName="table.csv"
      downloadMime="text/csv"
      transform={(input) => {
        if (!input.trim()) return '';
        const doc = new DOMParser().parseFromString(input, 'text/html');
        const tables = Array.from(doc.querySelectorAll('table'));
        if (tables.length === 0) throw new Error('No <table> elements found in the HTML.');

        const od = DELIMS[outDelim];
        const renderGrid = (grid: string[][]): string =>
          grid.map((r) => r.map((f) => csvField(f, od)).join(od)).join('\n');

        const sel = which.trim().toLowerCase();
        if (sel === 'all' || sel === '*') {
          return tables
            .map((t) => renderGrid(tableToGrid(t as HTMLTableElement, keepLinks)))
            .join('\n\n');
        }

        const idx = parseInt(sel, 10);
        if (!Number.isFinite(idx) || idx < 1 || idx > tables.length) {
          throw new Error(
            `Table index must be between 1 and ${tables.length}, or "all".`,
          );
        }
        const table = tables[idx - 1];
        if (!table) throw new Error('Table not found.');
        return renderGrid(tableToGrid(table as HTMLTableElement, keepLinks));
      }}
      options={
        <>
          <Field label="Which table (1, 2… or all)">
            <Input value={which} onChange={(e) => setWhich(e.target.value)} className="w-28" />
          </Field>
          <Field label="Keep link text">
            <Switch checked={keepLinks} onCheckedChange={setKeepLinks} />
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
