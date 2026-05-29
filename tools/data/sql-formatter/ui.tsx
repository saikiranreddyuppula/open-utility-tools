'use client';

import { useCallback, useState } from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

const KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN',
  'OUTER JOIN', 'JOIN', 'ON', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET',
  'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'CREATE TABLE', 'ALTER TABLE',
  'DROP TABLE', 'UNION ALL', 'UNION', 'AS', 'DISTINCT', 'COUNT', 'CASE', 'WHEN', 'THEN',
  'ELSE', 'END',
];
const NEWLINE_BEFORE = [
  'FROM', 'WHERE', 'AND', 'OR', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'OUTER JOIN',
  'JOIN', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'VALUES', 'SET', 'UNION ALL', 'UNION',
];

function formatSql(sql: string, upper: boolean): string {
  // Collapse whitespace.
  let s = sql.replace(/\s+/g, ' ').trim();
  // Casing on keywords (word-boundary, longest first).
  const sorted = [...KEYWORDS].sort((a, b) => b.length - a.length);
  for (const kw of sorted) {
    const re = new RegExp(`\\b${kw.replace(/ /g, '\\s+')}\\b`, 'gi');
    s = s.replace(re, upper ? kw : kw.toLowerCase());
  }
  // Newlines before major clauses.
  for (const kw of NEWLINE_BEFORE) {
    const target = upper ? kw : kw.toLowerCase();
    const re = new RegExp(`\\s+(${target.replace(/ /g, '\\s+')})\\b`, 'g');
    s = s.replace(re, `\n$1`);
  }
  // SELECT columns onto indented lines.
  s = s.replace(/,\s*/g, ',\n  ');
  // Indent continuation of AND/OR.
  s = s
    .split('\n')
    .map((line) => {
      const t = line.trim();
      if (/^(and|or)\b/i.test(t)) return '  ' + t;
      return t;
    })
    .join('\n');
  return s;
}

export default function SqlFormatterTool() {
  const [upper, setUpper] = useState(true);

  const transform = useCallback(
    (input: string) => (input.trim() ? formatSql(input, upper) : ''),
    [upper]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[upper]}
      inputLabel="SQL"
      outputLabel="Formatted"
      inputPlaceholder="SELECT * FROM users WHERE active = 1 ORDER BY name"
      sample="select id, name, email from users u join orders o on o.user_id = u.id where u.active = 1 and o.total > 100 order by o.total desc limit 10"
      downloadName="query.sql"
      downloadMime="application/sql"
      options={
        <Field label="Keywords">
          <Tabs value={upper ? 'upper' : 'lower'} onValueChange={(v) => setUpper(v === 'upper')}>
            <TabsList>
              <TabsTrigger value="upper">UPPER</TabsTrigger>
              <TabsTrigger value="lower">lower</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
