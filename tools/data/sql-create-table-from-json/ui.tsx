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
type Nested = 'json' | 'text';

const SAMPLE = JSON.stringify(
  [
    { id: 1, name: 'Ada', price: 9.99, active: true, joined: '2024-01-15', meta: { role: 'admin' } },
    { id: 2, name: 'Linus', price: 19.5, active: false, joined: '2024-02-01' },
    { id: 3, name: 'Grace', price: 4.25, active: true, joined: null },
  ],
  null,
  2,
);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TS_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/;

type Kind = 'int' | 'bigint' | 'double' | 'bool' | 'date' | 'timestamp' | 'varchar' | 'nested';

interface ColInfo {
  kind: Kind;
  maxLen: number;
  nullable: boolean;
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

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function mergeKind(prev: Kind | undefined, next: Kind): Kind {
  if (prev === undefined) return next;
  if (prev === next) return prev;
  // numeric widening
  const numeric = new Set<Kind>(['int', 'bigint', 'double']);
  if (numeric.has(prev) && numeric.has(next)) {
    if (prev === 'double' || next === 'double') return 'double';
    if (prev === 'bigint' || next === 'bigint') return 'bigint';
    return 'int';
  }
  // anything mixed with nested stays nested
  if (prev === 'nested' || next === 'nested') return 'nested';
  // fall back to varchar for incompatible scalar types
  return 'varchar';
}

function valueKind(v: unknown): Kind | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return 'bool';
  if (typeof v === 'number') {
    if (Number.isInteger(v)) {
      return v > 2147483647 || v < -2147483648 ? 'bigint' : 'int';
    }
    return 'double';
  }
  if (typeof v === 'string') {
    if (TS_RE.test(v)) return 'timestamp';
    if (DATE_RE.test(v)) return 'date';
    return 'varchar';
  }
  if (Array.isArray(v) || isPlainObject(v)) return 'nested';
  return 'varchar';
}

function sqlType(info: ColInfo, dialect: Dialect, nested: Nested): string {
  switch (info.kind) {
    case 'int':
      return 'INTEGER';
    case 'bigint':
      return 'BIGINT';
    case 'double':
      return dialect === 'sqlite' ? 'REAL' : dialect === 'mysql' ? 'DOUBLE' : 'DOUBLE PRECISION';
    case 'bool':
      return dialect === 'mysql' ? 'TINYINT(1)' : dialect === 'sqlite' ? 'INTEGER' : 'BOOLEAN';
    case 'date':
      return 'DATE';
    case 'timestamp':
      return dialect === 'mysql' ? 'DATETIME' : 'TIMESTAMP';
    case 'nested': {
      if (nested === 'text') return dialect === 'sqlite' ? 'TEXT' : 'TEXT';
      if (dialect === 'postgresql') return 'JSONB';
      if (dialect === 'mysql') return 'JSON';
      return 'TEXT';
    }
    case 'varchar': {
      if (dialect === 'sqlite') return 'TEXT';
      let n = 1;
      while (n < info.maxLen) n *= 2;
      return `VARCHAR(${Math.min(Math.max(n, 16), 65535)})`;
    }
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

export default function SqlCreateTableFromJsonTool() {
  const [dialect, setDialect] = useState<Dialect>('postgresql');
  const [tableName, setTableName] = useState('my_table');
  const [doQuote, setDoQuote] = useState(false);
  const [addId, setAddId] = useState(false);
  const [nested, setNested] = useState<Nested>('json');

  const transform = useCallback(
    (input: string) => {
      if (input.trim() === '') return '';
      let parsed: unknown;
      try {
        parsed = JSON.parse(input);
      } catch (e) {
        throw new Error(`Invalid JSON: ${(e as Error).message}`);
      }
      if (!Array.isArray(parsed)) throw new Error('Expected a JSON array of objects.');
      const records = parsed.filter(isPlainObject);
      if (records.length === 0) throw new Error('No objects found in the JSON array.');

      const order: string[] = [];
      const infos = new Map<string, ColInfo>();
      const presentCount = new Map<string, number>();

      for (const rec of records) {
        for (const [k, v] of Object.entries(rec)) {
          if (!infos.has(k)) {
            order.push(k);
            infos.set(k, { kind: 'varchar', maxLen: 1, nullable: false });
          }
          const info = infos.get(k);
          if (!info) continue;
          const kind = valueKind(v);
          if (kind === null) {
            info.nullable = true;
          } else {
            const prevPlaceholder = presentCount.get(k) ?? 0;
            info.kind = prevPlaceholder === 0 ? kind : mergeKind(info.kind, kind);
            presentCount.set(k, prevPlaceholder + 1);
            if (typeof v === 'string' && v.length > info.maxLen) info.maxLen = v.length;
          }
        }
        // keys absent from this record make column nullable
        for (const k of order) {
          if (!Object.prototype.hasOwnProperty.call(rec, k)) {
            const info = infos.get(k);
            if (info) info.nullable = true;
          }
        }
      }

      const lines: string[] = [];
      if (addId) lines.push(`  ${quoteIdent('id', dialect, doQuote)} ${idType(dialect)}`);
      order.forEach((k, idx) => {
        const info = infos.get(k);
        if (!info) return;
        if ((presentCount.get(k) ?? 0) === 0) info.kind = 'varchar';
        const ident = sanitizeIdent(k, idx);
        const type = sqlType(info, dialect, nested);
        const nn = info.nullable ? '' : ' NOT NULL';
        lines.push(`  ${quoteIdent(ident, dialect, doQuote)} ${type}${nn}`);
      });

      const tbl = quoteIdent(sanitizeIdent(tableName, 0) || 'my_table', dialect, doQuote);
      return `CREATE TABLE ${tbl} (\n${lines.join(',\n')}\n);`;
    },
    [dialect, tableName, doQuote, addId, nested],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[dialect, tableName, doQuote, addId, nested]}
      inputLabel="JSON array of objects"
      outputLabel="CREATE TABLE"
      inputPlaceholder={'[ { "id": 1, "name": "Ada" } ]'}
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
          <Field label="Nested as">
            <Select value={nested} onValueChange={(v) => setNested(v as Nested)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON column</SelectItem>
                <SelectItem value="text">TEXT</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Options">
            <div className="flex h-8 items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={doQuote} onCheckedChange={setDoQuote} /> quote idents
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={addId} onCheckedChange={setAddId} /> id PK
              </label>
            </div>
          </Field>
        </>
      }
    />
  );
}
