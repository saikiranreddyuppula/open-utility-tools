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

type RowMode = 'multi' | 'per-row';
type Quote = 'double' | 'backtick';

const SAMPLE = `{"id":1,"name":"Ada","active":true,"score":98}
{"id":2,"name":"Grace","active":false,"score":null}
{"id":3,"name":"Linus","score":42,"team":"kernel"}`;

function quoteIdent(name: string, quote: Quote): string {
  if (quote === 'backtick') return '`' + name.replace(/`/g, '``') + '`';
  return '"' + name.replace(/"/g, '""') + '"';
}

/** Render a parsed JSON value as an SQL literal. */
function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'string') return "'" + value.replace(/'/g, "''") + "'";
  // objects/arrays -> JSON string literal
  return "'" + JSON.stringify(value).replace(/'/g, "''") + "'";
}

export default function JsonlToSqlInsertTool() {
  const [table, setTable] = useState('records');
  const [mode, setMode] = useState<RowMode>('multi');
  const [quote, setQuote] = useState<Quote>('double');

  return (
    <TextToolLayout
      deps={[table, mode, quote]}
      transform={(input) => {
        const lines = input.split('\n').map((l) => l.trim()).filter((l) => l !== '');
        if (lines.length === 0) return '';

        const objects: Record<string, unknown>[] = [];
        for (let idx = 0; idx < lines.length; idx += 1) {
          const line = lines[idx] ?? '';
          let parsed: unknown;
          try {
            parsed = JSON.parse(line);
          } catch {
            throw new Error(`Line ${idx + 1} is not valid JSON.`);
          }
          if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error(`Line ${idx + 1} must be a JSON object.`);
          }
          objects.push(parsed as Record<string, unknown>);
        }

        // Union of keys, in first-seen order.
        const cols: string[] = [];
        const seen = new Set<string>();
        for (const obj of objects) {
          for (const key of Object.keys(obj)) {
            if (!seen.has(key)) {
              seen.add(key);
              cols.push(key);
            }
          }
        }
        if (cols.length === 0) throw new Error('No columns found in records.');

        const tbl = table.trim() || 'records';
        const colList = cols.map((c) => quoteIdent(c, quote)).join(', ');
        const tuples = objects.map((obj) => {
          const vals = cols.map((c) => sqlLiteral(Object.prototype.hasOwnProperty.call(obj, c) ? obj[c] : undefined));
          return '(' + vals.join(', ') + ')';
        });

        const head = `INSERT INTO ${quoteIdent(tbl, quote)} (${colList}) VALUES`;
        if (mode === 'multi') {
          return head + '\n  ' + tuples.join(',\n  ') + ';';
        }
        return tuples.map((t) => `${head}\n  ${t};`).join('\n');
      }}
      inputLabel="NDJSON"
      outputLabel="SQL"
      sample={SAMPLE}
      downloadName="insert.sql"
      downloadMime="text/plain"
      options={
        <>
          <Field label="Table">
            <Input value={table} onChange={(e) => setTable(e.target.value)} className="w-44" />
          </Field>
          <Field label="Statement style">
            <Select value={mode} onValueChange={(v) => setMode(v as RowMode)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="multi">Single multi-row</SelectItem>
                <SelectItem value="per-row">One INSERT per row</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Identifier quoting">
            <Select value={quote} onValueChange={(v) => setQuote(v as Quote)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="double">Double quote &quot;</SelectItem>
                <SelectItem value="backtick">Backtick `</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      }
    />
  );
}
