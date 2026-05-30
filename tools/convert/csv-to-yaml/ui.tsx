'use client';

import { useCallback, useState } from 'react';

import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SAMPLE = `id,name,active,role
1,Ada Lovelace,true,"Engineer, Lead"
2,Alan Turing,false,Researcher
3,Grace Hopper,true,"Admiral"`;

type DelimKey = 'comma' | 'semicolon' | 'tab' | 'pipe';
const DELIMS: Record<DelimKey, string> = { comma: ',', semicolon: ';', tab: '\t', pipe: '|' };

/** RFC-4180 CSV parser: handles quoted fields, embedded delimiters/newlines, doubled quotes. */
function parseCsv(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  // Normalize CRLF handling by inspecting chars directly.
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
    if (ch === delim) {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\r') {
      // swallow; \n handles line break (or lone \r below)
      if (text[i + 1] === '\n') {
        i += 1;
      }
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  // flush trailing field/row
  row.push(field);
  rows.push(row);
  // Drop a single trailing empty row caused by a final newline.
  const last = rows[rows.length - 1];
  if (last && last.length === 1 && last[0] === '') rows.pop();
  return rows;
}

type Scalar = string | number | boolean | null;

function coerce(raw: string, enabled: boolean): Scalar {
  if (!enabled) return raw;
  const t = raw.trim();
  if (t === '') return raw;
  const low = t.toLowerCase();
  if (low === 'true') return true;
  if (low === 'false') return false;
  if (low === 'null' || low === '~') return null;
  // numeric (int or float, optional sign/exponent), but not things like "0123" with leading zeros
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) {
    if (/^[+-]?0\d+$/.test(t)) return raw; // preserve leading-zero strings (e.g. zip codes)
    const num = Number(t);
    if (Number.isFinite(num)) return num;
  }
  return raw;
}

const PLAIN_SAFE = /^[A-Za-z0-9_][A-Za-z0-9 _./@+-]*$/;
const YAML_SPECIAL = new Set(['true', 'false', 'null', 'yes', 'no', 'on', 'off', '~']);

function quoteIfNeeded(s: string): string {
  if (s === '') return "''";
  const low = s.toLowerCase();
  const needs =
    !PLAIN_SAFE.test(s) ||
    YAML_SPECIAL.has(low) ||
    /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s) ||
    /^\s|\s$/.test(s) ||
    /^[#&*!|>%@`"'?:,\[\]{}-]/.test(s);
  if (!needs) return s;
  // Prefer single quotes; escape by doubling single quotes.
  return `'${s.replace(/'/g, "''")}'`;
}

function emitScalar(v: Scalar): string {
  if (v === null) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  return quoteIfNeeded(v);
}

function quoteKey(k: string): string {
  if (k === '') return "''";
  if (PLAIN_SAFE.test(k) && !YAML_SPECIAL.has(k.toLowerCase())) return k;
  return `'${k.replace(/'/g, "''")}'`;
}

export default function CsvToYamlTool() {
  const [delim, setDelim] = useState<DelimKey>('comma');
  const [hasHeader, setHasHeader] = useState(true);
  const [coercion, setCoercion] = useState(true);
  const [indent, setIndent] = useState('2');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const sep = DELIMS[delim];
      const rows = parseCsv(input.replace(/^﻿/, ''), sep).filter(
        (r) => !(r.length === 1 && (r[0] ?? '') === '')
      );
      if (rows.length === 0) return '';

      let headerRow: string[];
      let dataRows: string[][];
      if (hasHeader) {
        headerRow = rows[0] ?? [];
        dataRows = rows.slice(1);
      } else {
        const width = Math.max(...rows.map((r) => r.length));
        headerRow = Array.from({ length: width }, (_, i) => `col${i + 1}`);
        dataRows = rows;
      }
      if (headerRow.length === 0) throw new Error('No header columns found.');

      const indentSize = Math.min(8, Math.max(1, Number(indent) || 2));
      const pad = ' '.repeat(indentSize);

      if (dataRows.length === 0) return '[]\n';

      const blocks: string[] = [];
      for (const row of dataRows) {
        const lines: string[] = [];
        for (let c = 0; c < headerRow.length; c++) {
          const key = headerRow[c] ?? `col${c + 1}`;
          const cell = row[c] ?? '';
          const val = emitScalar(coerce(cell, coercion));
          lines.push(`${quoteKey(key)}: ${val}`);
        }
        // First key prefixed with "- ", remaining keys indented to align.
        const first = lines[0] ?? '';
        const rest = lines.slice(1).map((l) => `${pad}${l}`);
        blocks.push([`- ${first}`, ...rest].join('\n'));
      }
      return blocks.join('\n') + '\n';
    },
    [delim, hasHeader, coercion, indent]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[delim, hasHeader, coercion, indent]}
      inputLabel="CSV"
      outputLabel="YAML"
      sample={SAMPLE}
      downloadName="out.yaml"
      downloadMime="text/yaml"
      options={
        <>
          <Field label="Delimiter">
            <Select value={delim} onValueChange={(v) => setDelim(v as DelimKey)}>
              <SelectTrigger className="h-8 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comma">Comma ,</SelectItem>
                <SelectItem value="semicolon">Semicolon ;</SelectItem>
                <SelectItem value="tab">Tab</SelectItem>
                <SelectItem value="pipe">Pipe |</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Indent">
            <Select value={indent} onValueChange={setIndent}>
              <SelectTrigger className="h-8 w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 spaces</SelectItem>
                <SelectItem value="4">4 spaces</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="First row is header">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={hasHeader} onCheckedChange={setHasHeader} id="csvyaml-header" />
              <Label htmlFor="csvyaml-header" className="text-xs text-muted-foreground">
                {hasHeader ? 'Yes' : 'Generate col1…'}
              </Label>
            </div>
          </Field>
          <Field label="Type coercion">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={coercion} onCheckedChange={setCoercion} id="csvyaml-coerce" />
              <Label htmlFor="csvyaml-coerce" className="text-xs text-muted-foreground">
                {coercion ? 'numbers/bools' : 'strings only'}
              </Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
