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
type Mode = 'inline' | 'parameterized';

const SAMPLE = ['status = active', 'updated_at = 2024-05-01', 'login_count = 5', 'verified = true'].join('\n');

function quoteIdent(name: string, dialect: Dialect, doQuote: boolean): string {
  const n = name.trim();
  if (!doQuote || n === '') return n;
  if (dialect === 'mysql') return '`' + n.replace(/`/g, '``') + '`';
  return '"' + n.replace(/"/g, '""') + '"';
}

/** Returns the SQL literal for a scalar value string, plus the raw value for parameterization. */
function literal(v: string): string {
  const t = v.trim();
  if (t === '') return "''";
  if (/^-?\d+(\.\d+)?$/.test(t)) return t;
  if (/^null$/i.test(t)) return 'NULL';
  if (/^(true|false)$/i.test(t)) return t.toUpperCase();
  return `'${t.replace(/'/g, "''")}'`;
}

function placeholder(dialect: Dialect, index: number): string {
  return dialect === 'postgresql' ? `$${index}` : '?';
}

interface Pair {
  col: string;
  value: string;
}

function parseAssignment(line: string): Pair {
  const m = line.match(/^(.+?)\s*=\s*(.*)$/);
  if (!m || !m[1]) throw new Error(`Cannot parse assignment: "${line.trim()}". Use "column = value".`);
  return { col: m[1].trim(), value: (m[2] ?? '').trim() };
}

interface Cond {
  col: string;
  op: string;
  value: string;
}

function parseWhere(seg: string): Cond {
  const trimmed = seg.trim();
  let m = trimmed.match(/^(.+?)\s+(IS NOT NULL|IS NULL)$/i);
  if (m && m[1] && m[2]) return { col: m[1].trim(), op: m[2].toUpperCase(), value: '' };
  m = trimmed.match(/^(.+?)\s*(<=|>=|!=|<>|=|<|>)\s*(.+)$/);
  if (m && m[1] && m[2] && m[3]) return { col: m[1].trim(), op: m[2], value: m[3].trim() };
  m = trimmed.match(/^(.+?)\s+LIKE\s+(.+)$/i);
  if (m && m[1] && m[2]) return { col: m[1].trim(), op: 'LIKE', value: m[2].trim() };
  throw new Error(`Cannot parse WHERE condition: "${trimmed}".`);
}

export default function SqlUpdateBuilderTool() {
  const [dialect, setDialect] = useState<Dialect>('postgresql');
  const [tableName, setTableName] = useState('users');
  const [where, setWhere] = useState('id = 42');
  const [join, setJoin] = useState<Join>('AND');
  const [mode, setMode] = useState<Mode>('inline');
  const [doQuote, setDoQuote] = useState(false);
  const [pretty, setPretty] = useState(true);

  const transform = useCallback(
    (input: string) => {
      const assignments = input
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l !== '')
        .map(parseAssignment);
      if (assignments.length === 0) return '';

      const tbl = quoteIdent(tableName.trim() || 'table_name', dialect, doQuote);
      const params: string[] = [];
      let pIndex = 0;

      const sets = assignments.map((a) => {
        const col = quoteIdent(a.col, dialect, doQuote);
        if (mode === 'parameterized' && !/^null$/i.test(a.value.trim())) {
          pIndex++;
          params.push(a.value);
          return `${col} = ${placeholder(dialect, pIndex)}`;
        }
        return `${col} = ${literal(a.value)}`;
      });

      const whereConds = where
        .split(/\r?\n|;/)
        .map((s) => s.trim())
        .filter((s) => s !== '');
      const renderedWhere = whereConds.map((seg) => {
        const c = parseWhere(seg);
        const col = quoteIdent(c.col, dialect, doQuote);
        if (c.op === 'IS NULL' || c.op === 'IS NOT NULL') return `${col} ${c.op}`;
        if (mode === 'parameterized') {
          pIndex++;
          params.push(c.value);
          return `${col} ${c.op === 'LIKE' ? 'LIKE' : c.op} ${placeholder(dialect, pIndex)}`;
        }
        return `${col} ${c.op === 'LIKE' ? 'LIKE' : c.op} ${literal(c.value)}`;
      });

      const sep = pretty ? '\n' : ' ';
      const parts: string[] = [];
      parts.push(`UPDATE ${tbl}`);
      parts.push(`SET ${sets.join(pretty ? `,${sep}    ` : ', ')}`);

      let warning = '';
      if (renderedWhere.length > 0) {
        parts.push(`WHERE ${renderedWhere.join(`${sep}  ${join} `)}`);
      } else {
        warning = '-- WARNING: no WHERE clause — this updates EVERY row in the table.\n';
      }

      let sql = warning + parts.join(sep) + ';';
      if (mode === 'parameterized' && params.length > 0) {
        sql += `\n\n-- Ordered parameters:\n-- [${params.map((p) => JSON.stringify(p)).join(', ')}]`;
      }
      return sql;
    },
    [dialect, tableName, where, join, mode, doQuote, pretty],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[dialect, tableName, where, join, mode, doQuote, pretty]}
      inputLabel="SET assignments (one per line)"
      outputLabel="UPDATE statement"
      inputPlaceholder={'status = active\nverified = true'}
      sample={SAMPLE}
      downloadName="update.sql"
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
                <SelectItem value="postgresql">PostgreSQL ($1)</SelectItem>
                <SelectItem value="mysql">MySQL (?)</SelectItem>
                <SelectItem value="sqlite">SQLite (?)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Table" className="w-36">
            <Input value={tableName} onChange={(e) => setTableName(e.target.value)} placeholder="users" />
          </Field>
          <Field label="WHERE (`;` or newline)" className="w-56">
            <Input value={where} onChange={(e) => setWhere(e.target.value)} placeholder="id = 42" />
          </Field>
          <Field label="Join WHERE">
            <Tabs value={join} onValueChange={(v) => setJoin(v as Join)}>
              <TabsList>
                <TabsTrigger value="AND">AND</TabsTrigger>
                <TabsTrigger value="OR">OR</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Values">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="inline">Inline</TabsTrigger>
                <TabsTrigger value="parameterized">Params</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Options">
            <div className="flex h-8 items-center gap-3">
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
