'use client';

import { useCallback, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Dialect = 'ansi' | 'postgresql' | 'mysql' | 'sqlite';

const SAMPLE = [
  'id,name,price,in_stock,created_at',
  '1,Widget,9.99,true,2024-01-15',
  '2,Gadget,19.50,false,2024-02-01',
  '3,Gizmo,4.25,true,2024-03-10',
].join('\n');

/** Minimal RFC4180-ish CSV parser supporting quoted fields and embedded newlines. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i] ?? '';
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\r') {
      i++;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && (r[0] ?? '') === ''));
}

function sanitizeIdent(name: string, index: number): string {
  let s = name
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  if (s === '') s = `col_${index + 1}`;
  if (/^[0-9]/.test(s)) s = `c_${s}`;
  return s;
}

const INT_RE = /^-?\d+$/;
const DEC_RE = /^-?\d*\.\d+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TS_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/;
const BOOL_RE = /^(true|false)$/i;

type Kind = 'int' | 'bigint' | 'decimal' | 'bool' | 'date' | 'timestamp' | 'varchar';

interface ColInfo {
  kind: Kind;
  maxLen: number;
  hasNull: boolean;
}

function inferColumn(values: string[]): ColInfo {
  let allInt = true;
  let allDec = true;
  let allBool = true;
  let allDate = true;
  let allTs = true;
  let bigint = false;
  let maxLen = 0;
  let hasNull = false;
  let nonEmpty = 0;

  for (const raw of values) {
    const v = raw.trim();
    if (v.length > maxLen) maxLen = v.length;
    if (v === '') {
      hasNull = true;
      continue;
    }
    nonEmpty++;
    if (INT_RE.test(v)) {
      const n = Number(v);
      if (!Number.isSafeInteger(n) || n > 2147483647 || n < -2147483648) bigint = true;
    } else {
      allInt = false;
    }
    if (!INT_RE.test(v) && !DEC_RE.test(v)) allDec = false;
    if (!BOOL_RE.test(v) && v !== '0' && v !== '1') allBool = false;
    if (!DATE_RE.test(v)) allDate = false;
    if (!TS_RE.test(v)) allTs = false;
  }

  let kind: Kind = 'varchar';
  if (nonEmpty > 0) {
    if (allBool) kind = 'bool';
    else if (allInt) kind = bigint ? 'bigint' : 'int';
    else if (allDec) kind = 'decimal';
    else if (allTs) kind = 'timestamp';
    else if (allDate) kind = 'date';
    else kind = 'varchar';
  }
  return { kind, maxLen: Math.max(maxLen, 1), hasNull };
}

function varcharLen(maxLen: number): number {
  let n = 1;
  while (n < maxLen) n *= 2;
  return Math.min(Math.max(n, 16), 65535);
}

function sqlType(info: ColInfo, dialect: Dialect): string {
  switch (info.kind) {
    case 'int':
      return dialect === 'sqlite' ? 'INTEGER' : 'INTEGER';
    case 'bigint':
      return 'BIGINT';
    case 'decimal':
      return dialect === 'sqlite' ? 'REAL' : dialect === 'mysql' ? 'DECIMAL(18,4)' : 'NUMERIC(18,4)';
    case 'bool':
      return dialect === 'mysql' ? 'TINYINT(1)' : dialect === 'sqlite' ? 'INTEGER' : 'BOOLEAN';
    case 'date':
      return 'DATE';
    case 'timestamp':
      return dialect === 'mysql' ? 'DATETIME' : 'TIMESTAMP';
    case 'varchar':
      return dialect === 'sqlite' ? 'TEXT' : `VARCHAR(${varcharLen(info.maxLen)})`;
    default:
      return 'TEXT';
  }
}

function quoteIdent(name: string, dialect: Dialect, doQuote: boolean): string {
  if (!doQuote) return name;
  if (dialect === 'mysql') return '`' + name.replace(/`/g, '``') + '`';
  return '"' + name.replace(/"/g, '""') + '"';
}

function idType(dialect: Dialect): string {
  switch (dialect) {
    case 'postgresql':
      return 'SERIAL PRIMARY KEY';
    case 'mysql':
      return 'INT AUTO_INCREMENT PRIMARY KEY';
    case 'sqlite':
      return 'INTEGER PRIMARY KEY AUTOINCREMENT';
    case 'ansi':
      return 'INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY';
    default:
      return 'INTEGER PRIMARY KEY';
  }
}

export default function SqlCreateTableFromCsvTool() {
  const [dialect, setDialect] = useState<Dialect>('postgresql');
  const [tableName, setTableName] = useState('my_table');
  const [doQuote, setDoQuote] = useState(false);
  const [addId, setAddId] = useState(false);
  const [notNull, setNotNull] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (input.trim() === '') return '';
      const rows = parseCsv(input);
      if (rows.length === 0) throw new Error('No CSV rows found.');
      const header = rows[0];
      if (!header || header.length === 0) throw new Error('CSV header row is empty.');
      const dataRows = rows.slice(1);

      const columns = header.map((h, idx) => {
        const ident = sanitizeIdent(h, idx);
        const values = dataRows.map((r) => r[idx] ?? '');
        const info = inferColumn(values);
        return { ident, info };
      });

      const lines: string[] = [];
      if (addId) {
        lines.push(`  ${quoteIdent('id', dialect, doQuote)} ${idType(dialect)}`);
      }
      for (const c of columns) {
        const type = sqlType(c.info, dialect);
        const nn = notNull && !c.info.hasNull && dataRows.length > 0 ? ' NOT NULL' : '';
        lines.push(`  ${quoteIdent(c.ident, dialect, doQuote)} ${type}${nn}`);
      }

      const tbl = quoteIdent(sanitizeIdent(tableName, 0) || 'my_table', dialect, doQuote);
      return `CREATE TABLE ${tbl} (\n${lines.join(',\n')}\n);`;
    },
    [dialect, tableName, doQuote, addId, notNull],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[dialect, tableName, doQuote, addId, notNull]}
      inputLabel="CSV (with header row)"
      outputLabel="CREATE TABLE"
      inputPlaceholder={'id,name\n1,Ada'}
      sample={SAMPLE}
      downloadName="create_table.sql"
      downloadMime="text/plain"
      mono
      options={
        <>
          <Field label="Dialect">
            <Select value={dialect} onValueChange={(v) => setDialect(v as Dialect)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ansi">ANSI</SelectItem>
                <SelectItem value="postgresql">PostgreSQL</SelectItem>
                <SelectItem value="mysql">MySQL</SelectItem>
                <SelectItem value="sqlite">SQLite</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Table name" className="w-44">
            <Input value={tableName} onChange={(e) => setTableName(e.target.value)} placeholder="my_table" />
          </Field>
          <Field label="Options">
            <div className="flex h-8 items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={doQuote} onCheckedChange={setDoQuote} /> quote idents
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={addId} onCheckedChange={setAddId} /> id PK
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={notNull} onCheckedChange={setNotNull} /> NOT NULL
              </label>
            </div>
          </Field>
        </>
      }
    />
  );
}
