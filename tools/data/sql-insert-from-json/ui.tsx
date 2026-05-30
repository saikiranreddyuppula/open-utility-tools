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
type ColMode = 'union' | 'intersection';
type RowMode = 'per-row' | 'multi-row';

const SAMPLE = JSON.stringify(
  [
    { id: 1, name: "O'Brien", active: true, tags: ['a', 'b'] },
    { id: 2, name: 'Linus', active: false, note: null },
  ],
  null,
  2,
);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function quoteIdent(name: string, dialect: Dialect, doQuote: boolean): string {
  if (!doQuote) return name;
  if (dialect === 'mysql') return '`' + name.replace(/`/g, '``') + '`';
  return '"' + name.replace(/"/g, '""') + '"';
}

function sqlValue(v: unknown, dialect: Dialect, boolNumeric: boolean): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') {
    if (boolNumeric || dialect === 'sqlite') return v ? '1' : '0';
    return v ? 'TRUE' : 'FALSE';
  }
  if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
  // object / array → JSON string
  const json = JSON.stringify(v);
  return `'${json.replace(/'/g, "''")}'`;
}

export default function SqlInsertFromJsonTool() {
  const [dialect, setDialect] = useState<Dialect>('postgresql');
  const [tableName, setTableName] = useState('my_table');
  const [colMode, setColMode] = useState<ColMode>('union');
  const [rowMode, setRowMode] = useState<RowMode>('per-row');
  const [doQuote, setDoQuote] = useState(false);
  const [boolNumeric, setBoolNumeric] = useState(false);
  const [batch, setBatch] = useState('100');

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

      // Determine columns.
      let columns: string[];
      if (colMode === 'intersection') {
        const first = records[0];
        let inter = first ? Object.keys(first) : [];
        for (const rec of records) {
          inter = inter.filter((k) => Object.prototype.hasOwnProperty.call(rec, k));
        }
        columns = inter;
      } else {
        const order: string[] = [];
        const set = new Set<string>();
        for (const rec of records) {
          for (const k of Object.keys(rec)) {
            if (!set.has(k)) {
              set.add(k);
              order.push(k);
            }
          }
        }
        columns = order;
      }
      if (columns.length === 0) throw new Error('No common columns found across objects.');

      const tbl = quoteIdent(tableName.trim() || 'my_table', dialect, doQuote);
      const colList = columns.map((c) => quoteIdent(c, dialect, doQuote)).join(', ');

      const rowTuple = (rec: Record<string, unknown>): string =>
        '(' +
        columns
          .map((c) => sqlValue(Object.prototype.hasOwnProperty.call(rec, c) ? rec[c] : null, dialect, boolNumeric))
          .join(', ') +
        ')';

      if (rowMode === 'per-row') {
        return records.map((rec) => `INSERT INTO ${tbl} (${colList}) VALUES ${rowTuple(rec)};`).join('\n');
      }

      // multi-row, chunked by batch size
      let size = parseInt(batch, 10);
      if (!Number.isFinite(size) || size < 1) size = records.length;
      const out: string[] = [];
      for (let i = 0; i < records.length; i += size) {
        const chunk = records.slice(i, i + size);
        const tuples = chunk.map((r) => '  ' + rowTuple(r)).join(',\n');
        out.push(`INSERT INTO ${tbl} (${colList}) VALUES\n${tuples};`);
      }
      return out.join('\n\n');
    },
    [dialect, tableName, colMode, rowMode, doQuote, boolNumeric, batch],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[dialect, tableName, colMode, rowMode, doQuote, boolNumeric, batch]}
      inputLabel="JSON array of objects"
      outputLabel="INSERT statements"
      inputPlaceholder={'[ { "id": 1, "name": "Ada" } ]'}
      sample={SAMPLE}
      downloadName="inserts.sql"
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
          <Field label="Columns">
            <Tabs value={colMode} onValueChange={(v) => setColMode(v as ColMode)}>
              <TabsList>
                <TabsTrigger value="union">Union</TabsTrigger>
                <TabsTrigger value="intersection">Common</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Form">
            <Tabs value={rowMode} onValueChange={(v) => setRowMode(v as RowMode)}>
              <TabsList>
                <TabsTrigger value="per-row">Per row</TabsTrigger>
                <TabsTrigger value="multi-row">Multi-row</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {rowMode === 'multi-row' ? (
            <Field label="Batch size" className="w-24">
              <Input value={batch} onChange={(e) => setBatch(e.target.value)} inputMode="numeric" />
            </Field>
          ) : null}
          <Field label="Options">
            <div className="flex h-8 items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={doQuote} onCheckedChange={setDoQuote} /> quote idents
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={boolNumeric} onCheckedChange={setBoolNumeric} /> bool as 1/0
              </label>
            </div>
          </Field>
        </>
      }
    />
  );
}
