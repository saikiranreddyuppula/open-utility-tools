'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

type JsonCell = string | number | boolean | null;

const SAMPLE = `<table>
  <thead>
    <tr><th>Name</th><th>Age</th><th>Active</th></tr>
  </thead>
  <tbody>
    <tr><td>Ada</td><td>36</td><td>true</td></tr>
    <tr><td>Grace</td><td>85</td><td>false</td></tr>
    <tr><td>Alan</td><td>41</td><td>null</td></tr>
  </tbody>
</table>`;

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function spanOf(cell: Element, attr: string): number {
  const v = cell.getAttribute(attr);
  if (!v) return 1;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function tableToGrid(table: HTMLTableElement): string[][] {
  const grid: string[][] = [];
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
      const text = collapseWhitespace(cell.textContent ?? '');
      for (let c = 0; c < colspan; c++) {
        row[col] = text;
        if (rowspan > 1) rowspans.set(col, { text, remaining: rowspan - 1 });
        col++;
      }
    }
    placePending();
    grid.push(row);
  }

  const width = grid.reduce((m, r) => Math.max(m, r.length), 0);
  return grid.map((r) => {
    const out: string[] = [];
    for (let i = 0; i < width; i++) out.push(r[i] ?? '');
    return out;
  });
}

function inferType(raw: string): JsonCell {
  const t = raw.trim();
  if (t === '') return '';
  if (t === 'null') return null;
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (/^-?\d+$/.test(t)) {
    const n = Number(t);
    if (Number.isSafeInteger(n)) return n;
  }
  if (/^-?(\d+\.\d*|\.\d+|\d+)([eE][-+]?\d+)?$/.test(t)) {
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  return raw;
}

export default function HtmlTableToJsonTool() {
  const [which, setWhich] = useState('1');
  const [useHeader, setUseHeader] = useState(true);
  const [infer, setInfer] = useState(true);
  const [indent, setIndent] = useState('2');
  const [trim, setTrim] = useState(true);

  return (
    <TextToolLayout
      deps={[which, useHeader, infer, indent, trim]}
      sample={SAMPLE}
      inputLabel="HTML"
      outputLabel="JSON"
      downloadName="table.json"
      downloadMime="application/json"
      transform={(input) => {
        if (!input.trim()) return '';
        const doc = new DOMParser().parseFromString(input, 'text/html');
        const tables = Array.from(doc.querySelectorAll('table'));
        if (tables.length === 0) throw new Error('No <table> elements found in the HTML.');

        const idx = parseInt(which.trim(), 10);
        if (!Number.isFinite(idx) || idx < 1 || idx > tables.length) {
          throw new Error(`Table index must be between 1 and ${tables.length}.`);
        }
        const table = tables[idx - 1];
        if (!table) throw new Error('Table not found.');

        const grid = tableToGrid(table as HTMLTableElement);
        if (grid.length === 0) return '[]';

        const cell = (s: string): JsonCell => {
          const v = trim ? s.trim() : s;
          return infer ? inferType(v) : v;
        };

        const indentN = (() => {
          const n = parseInt(indent, 10);
          return Number.isFinite(n) && n >= 0 && n <= 8 ? n : 2;
        })();

        if (!useHeader) {
          const arr: JsonCell[][] = grid.map((row) => row.map(cell));
          return JSON.stringify(arr, null, indentN);
        }

        const header = (grid[0] ?? []).map((h, i) => {
          const name = h.trim();
          return name === '' ? `column${i + 1}` : name;
        });
        const objects = grid.slice(1).map((row) => {
          const obj: Record<string, JsonCell> = {};
          for (let i = 0; i < header.length; i++) {
            const key = header[i] ?? `column${i + 1}`;
            obj[key] = cell(row[i] ?? '');
          }
          return obj;
        });
        return JSON.stringify(objects, null, indentN);
      }}
      options={
        <>
          <Field label="Table index">
            <Input value={which} onChange={(e) => setWhich(e.target.value)} className="w-24" />
          </Field>
          <Field label="First row as header">
            <Switch checked={useHeader} onCheckedChange={setUseHeader} />
          </Field>
          <Field label="Infer types">
            <Switch checked={infer} onCheckedChange={setInfer} />
          </Field>
          <Field label="Trim cells">
            <Switch checked={trim} onCheckedChange={setTrim} />
          </Field>
          <Field label="Indent (0-8)">
            <Input
              value={indent}
              onChange={(e) => setIndent(e.target.value)}
              inputMode="numeric"
              className="w-20"
            />
          </Field>
        </>
      }
    />
  );
}
