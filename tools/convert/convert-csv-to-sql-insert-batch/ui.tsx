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

type Dialect = 'mysql' | 'postgres' | 'sqlite';

const SAMPLE = `id,name,active,balance,notes
1,Ada Lovelace,true,1024.50,
2,"Hopper, Grace",false,0,first compiler
3,Linus,true,42,NULL`;

/** RFC-4180-ish CSV parser supporting quoted fields, escaped quotes, and CRLF. */
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
  // flush trailing field/row
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function quoteIdent(name: string, dialect: Dialect): string {
  if (dialect === 'mysql') return '`' + name.replace(/`/g, '``') + '`';
  // postgres + sqlite use double quotes
  return '"' + name.replace(/"/g, '""') + '"';
}

/** Decide how a raw CSV cell renders as an SQL literal. */
function sqlValue(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === '' ) return 'NULL';
  if (/^null$/i.test(trimmed)) return 'NULL';
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase() === 'true' ? 'TRUE' : 'FALSE';
  // integer or decimal (no leading zeros like 007, which are likely codes)
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(trimmed)) return trimmed;
  return "'" + raw.replace(/'/g, "''") + "'";
}

export default function CsvToBatchedSqlInsertTool() {
  const [table, setTable] = useState('my_table');
  const [batch, setBatch] = useState('100');
  const [dialect, setDialect] = useState<Dialect>('postgres');

  return (
    <TextToolLayout
      deps={[table, batch, dialect]}
      transform={(input) => {
        if (!input.trim()) return '';
        const rows = parseCsv(input).filter((r) => r.length > 0 && !(r.length === 1 && r[0] === ''));
        if (rows.length < 2) throw new Error('Need a header row plus at least one data row.');

        const header = rows[0];
        if (!header) throw new Error('Missing header row.');
        const cols = header.map((c) => c.trim());
        if (cols.some((c) => c === '')) throw new Error('Header has an empty column name.');

        const size = Math.max(1, Math.min(10000, Math.trunc(Number(batch))));
        if (!Number.isFinite(size)) throw new Error('Batch size must be a positive number.');

        const tbl = table.trim() || 'my_table';
        const colList = cols.map((c) => quoteIdent(c, dialect)).join(', ');
        const dataRows = rows.slice(1);

        const tuples: string[] = dataRows.map((r) => {
          const vals = cols.map((_, idx) => sqlValue(r[idx] ?? ''));
          return '(' + vals.join(', ') + ')';
        });

        const out: string[] = [];
        for (let start = 0; start < tuples.length; start += size) {
          const chunk = tuples.slice(start, start + size);
          out.push(
            `INSERT INTO ${quoteIdent(tbl, dialect)} (${colList}) VALUES\n  ` +
              chunk.join(',\n  ') +
              ';'
          );
        }
        return out.join('\n\n');
      }}
      inputLabel="CSV"
      outputLabel="SQL"
      sample={SAMPLE}
      downloadName="insert.sql"
      downloadMime="text/plain"
      options={
        <>
          <Field label="Table">
            <Input value={table} onChange={(e) => setTable(e.target.value)} className="w-44" />
          </Field>
          <Field label="Rows per INSERT">
            <Input
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              inputMode="numeric"
              className="w-28"
            />
          </Field>
          <Field label="Dialect">
            <Select value={dialect} onValueChange={(v) => setDialect(v as Dialect)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="postgres">PostgreSQL</SelectItem>
                <SelectItem value="mysql">MySQL</SelectItem>
                <SelectItem value="sqlite">SQLite</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      }
    />
  );
}
