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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Dialect = 'ansi' | 'postgresql' | 'mysql' | 'sqlite';
type Join = 'AND' | 'OR';

const SAMPLE = ['status = active', 'age >= 18', 'country IN US, CA, GB', 'deleted_at IS NULL'].join('\n');

const VALID_OPS = new Set(['=', '!=', '<>', '<', '<=', '>', '>=', 'LIKE', 'IN', 'IS NULL', 'IS NOT NULL', 'BETWEEN']);

function quoteIdent(name: string, dialect: Dialect, doQuote: boolean): string {
  const n = name.trim();
  if (!doQuote || n === '*' || n === '') return n;
  if (dialect === 'mysql') return '`' + n.replace(/`/g, '``') + '`';
  return '"' + n.replace(/"/g, '""') + '"';
}

/** Quote a scalar value: numbers raw, otherwise single-quoted string. */
function quoteScalar(v: string): string {
  const t = v.trim();
  if (t === '') return "''";
  if (/^-?\d+(\.\d+)?$/.test(t)) return t;
  if (/^(true|false|null)$/i.test(t)) return t.toUpperCase();
  return `'${t.replace(/'/g, "''")}'`;
}

interface Condition {
  col: string;
  op: string;
  value: string;
}

/** Parse a `col op value` line. */
function parseCondition(line: string): Condition {
  const trimmed = line.trim();
  // IS NULL / IS NOT NULL
  let m = trimmed.match(/^(.+?)\s+(IS NOT NULL|IS NULL)$/i);
  if (m && m[1] && m[2]) return { col: m[1].trim(), op: m[2].toUpperCase(), value: '' };
  // BETWEEN a AND b
  m = trimmed.match(/^(.+?)\s+BETWEEN\s+(.+?)\s+AND\s+(.+)$/i);
  if (m && m[1] && m[2] && m[3]) return { col: m[1].trim(), op: 'BETWEEN', value: `${m[2].trim()}|${m[3].trim()}` };
  // IN a, b, c
  m = trimmed.match(/^(.+?)\s+IN\s+(.+)$/i);
  if (m && m[1] && m[2]) return { col: m[1].trim(), op: 'IN', value: m[2].trim() };
  // LIKE
  m = trimmed.match(/^(.+?)\s+LIKE\s+(.+)$/i);
  if (m && m[1] && m[2]) return { col: m[1].trim(), op: 'LIKE', value: m[2].trim() };
  // operators
  m = trimmed.match(/^(.+?)\s*(<=|>=|!=|<>|=|<|>)\s*(.+)$/);
  if (m && m[1] && m[2] && m[3]) return { col: m[1].trim(), op: m[2], value: m[3].trim() };
  throw new Error(`Cannot parse condition: "${trimmed}". Use e.g. "age >= 18" or "name LIKE %a%".`);
}

function renderCondition(c: Condition, dialect: Dialect, doQuote: boolean): string {
  if (!VALID_OPS.has(c.op)) throw new Error(`Unsupported operator: ${c.op}`);
  const col = quoteIdent(c.col, dialect, doQuote);
  switch (c.op) {
    case 'IS NULL':
    case 'IS NOT NULL':
      return `${col} ${c.op}`;
    case 'IN': {
      const items = c.value
        .split(',')
        .map((s) => quoteScalar(s))
        .filter((s) => s !== "''" || c.value.includes(','));
      return `${col} IN (${items.join(', ')})`;
    }
    case 'BETWEEN': {
      const parts = c.value.split('|');
      const lo = quoteScalar(parts[0] ?? '');
      const hi = quoteScalar(parts[1] ?? '');
      return `${col} BETWEEN ${lo} AND ${hi}`;
    }
    case 'LIKE':
      return `${col} LIKE ${quoteScalar(c.value)}`;
    default:
      return `${col} ${c.op} ${quoteScalar(c.value)}`;
  }
}

export default function SqlSelectBuilderTool() {
  const [dialect, setDialect] = useState<Dialect>('postgresql');
  const [tableName, setTableName] = useState('users');
  const [cols, setCols] = useState('*');
  const [distinct, setDistinct] = useState(false);
  const [join, setJoin] = useState<Join>('AND');
  const [orderBy, setOrderBy] = useState('age DESC');
  const [limit, setLimit] = useState('50');
  const [offset, setOffset] = useState('');
  const [doQuote, setDoQuote] = useState(false);
  const [pretty, setPretty] = useState(true);

  const transform = useCallback(
    (input: string) => {
      const tbl = quoteIdent(tableName.trim() || 'table_name', dialect, doQuote);
      const colList =
        cols.trim() === '' || cols.trim() === '*'
          ? '*'
          : cols
              .split(',')
              .map((c) => quoteIdent(c.trim(), dialect, doQuote))
              .filter((c) => c !== '')
              .join(', ');

      const conds = input
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l !== '')
        .map((l) => renderCondition(parseCondition(l), dialect, doQuote));

      const orderParts = orderBy
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== '')
        .map((s) => {
          const m = s.match(/^(.+?)\s+(ASC|DESC)$/i);
          if (m && m[1] && m[2]) return `${quoteIdent(m[1].trim(), dialect, doQuote)} ${m[2].toUpperCase()}`;
          return quoteIdent(s, dialect, doQuote);
        });

      const limNum = parseInt(limit, 10);
      const offNum = parseInt(offset, 10);
      const useTop = dialect === 'ansi' && Number.isFinite(limNum) && !Number.isFinite(offNum);

      const selectKw = `SELECT${distinct ? ' DISTINCT' : ''}${useTop ? ` TOP ${limNum}` : ''}`;

      const parts: string[] = [];
      const sep = pretty ? '\n' : ' ';
      parts.push(`${selectKw} ${colList}`);
      parts.push(`FROM ${tbl}`);
      if (conds.length > 0) parts.push(`WHERE ${conds.join(`${sep}  ${join} `)}`);
      if (orderParts.length > 0) parts.push(`ORDER BY ${orderParts.join(', ')}`);
      if (!useTop && Number.isFinite(limNum) && limNum >= 0) parts.push(`LIMIT ${limNum}`);
      if (!useTop && Number.isFinite(offNum) && offNum >= 0) parts.push(`OFFSET ${offNum}`);

      return parts.join(sep) + ';';
    },
    [dialect, tableName, cols, distinct, join, orderBy, limit, offset, doQuote, pretty],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[dialect, tableName, cols, distinct, join, orderBy, limit, offset, doQuote, pretty]}
      inputLabel="WHERE conditions (one per line)"
      outputLabel="SELECT statement"
      inputPlaceholder={'status = active\nage >= 18'}
      sample={SAMPLE}
      downloadName="select.sql"
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
                <SelectItem value="ansi">ANSI (TOP)</SelectItem>
                <SelectItem value="postgresql">PostgreSQL</SelectItem>
                <SelectItem value="mysql">MySQL</SelectItem>
                <SelectItem value="sqlite">SQLite</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Table" className="w-36">
            <Input value={tableName} onChange={(e) => setTableName(e.target.value)} placeholder="users" />
          </Field>
          <Field label="Columns (or *)" className="w-48">
            <Input value={cols} onChange={(e) => setCols(e.target.value)} placeholder="id, name" />
          </Field>
          <Field label="Join WHERE">
            <Tabs value={join} onValueChange={(v) => setJoin(v as Join)}>
              <TabsList>
                <TabsTrigger value="AND">AND</TabsTrigger>
                <TabsTrigger value="OR">OR</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Order by" className="w-40">
            <Input value={orderBy} onChange={(e) => setOrderBy(e.target.value)} placeholder="age DESC" />
          </Field>
          <Field label="Limit" className="w-20">
            <Input value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="Offset" className="w-20">
            <Input value={offset} onChange={(e) => setOffset(e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="Options">
            <div className="flex h-8 items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={distinct} onCheckedChange={setDistinct} /> DISTINCT
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={doQuote} onCheckedChange={setDoQuote} /> quote
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={pretty} onCheckedChange={setPretty} /> pretty
              </label>
            </div>
          </Field>
        </>
      }
    />
  );
}
