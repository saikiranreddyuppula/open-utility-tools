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

type Layout = 'element' | 'attribute';

const SAMPLE = `Name,Job Title,Score,Notes
Ada Lovelace,Engineer,98,"Loves <math> & logic"
Grace Hopper,Admiral,95,Compiler pioneer`;

/** RFC-4180-ish CSV parser. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i] ?? '';
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function escapeXmlText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeXmlAttr(s: string): string {
  return escapeXmlText(s).replace(/"/g, '&quot;');
}

/** Sanitize a header into a valid XML element/attribute name. */
function sanitizeName(name: string, fallback: string): string {
  let n = name.trim().replace(/\s+/g, '_');
  // strip characters invalid in XML names (keep letters, digits, _, -, .)
  n = n.replace(/[^A-Za-z0-9_.-]/g, '');
  // must start with letter or underscore
  if (n === '' || !/^[A-Za-z_]/.test(n)) n = '_' + n;
  return n || fallback;
}

export default function CsvToXmlTool() {
  const [root, setRoot] = useState('rows');
  const [rowName, setRowName] = useState('row');
  const [layout, setLayout] = useState<Layout>('element');
  const [indentSize, setIndentSize] = useState('2');
  const [declaration, setDeclaration] = useState(true);

  return (
    <TextToolLayout
      deps={[root, rowName, layout, indentSize, declaration]}
      transform={(input) => {
        if (!input.trim()) return '';
        const rows = parseCsv(input).filter((r) => !(r.length === 1 && r[0] === ''));
        if (rows.length < 1) return '';
        const header = rows[0];
        if (!header) throw new Error('Missing header row.');

        const colNames = header.map((h, i) => sanitizeName(h, `col${i + 1}`));
        const rootName = sanitizeName(root, 'rows');
        const rowEl = sanitizeName(rowName, 'row');

        const indN = Math.max(0, Math.min(8, Math.trunc(Number(indentSize))));
        const pad = Number.isFinite(indN) ? ' '.repeat(indN) : '  ';

        const lines: string[] = [];
        if (declaration) lines.push('<?xml version="1.0" encoding="UTF-8"?>');
        lines.push(`<${rootName}>`);

        for (const r of rows.slice(1)) {
          if (layout === 'attribute') {
            const attrs = colNames
              .map((name, i) => `${name}="${escapeXmlAttr(r[i] ?? '')}"`)
              .join(' ');
            lines.push(`${pad}<${rowEl}${attrs ? ' ' + attrs : ''} />`);
          } else {
            lines.push(`${pad}<${rowEl}>`);
            for (let i = 0; i < colNames.length; i += 1) {
              const name = colNames[i] ?? `col${i + 1}`;
              const val = escapeXmlText(r[i] ?? '');
              lines.push(`${pad}${pad}<${name}>${val}</${name}>`);
            }
            lines.push(`${pad}</${rowEl}>`);
          }
        }

        lines.push(`</${rootName}>`);
        return lines.join('\n');
      }}
      inputLabel="CSV"
      outputLabel="XML"
      sample={SAMPLE}
      downloadName="data.xml"
      downloadMime="application/xml"
      options={
        <>
          <Field label="Root element">
            <Input value={root} onChange={(e) => setRoot(e.target.value)} className="w-32" />
          </Field>
          <Field label="Row element">
            <Input value={rowName} onChange={(e) => setRowName(e.target.value)} className="w-32" />
          </Field>
          <Field label="Columns as">
            <Select value={layout} onValueChange={(v) => setLayout(v as Layout)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="element">Child elements</SelectItem>
                <SelectItem value="attribute">Attributes</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Indent">
            <Input
              value={indentSize}
              onChange={(e) => setIndentSize(e.target.value)}
              inputMode="numeric"
              className="w-20"
            />
          </Field>
          <Field label="XML declaration">
            <label className="flex h-9 items-center gap-2 text-sm">
              <Switch checked={declaration} onCheckedChange={setDeclaration} />
              {declaration ? 'Include' : 'Omit'}
            </label>
          </Field>
        </>
      }
    />
  );
}
