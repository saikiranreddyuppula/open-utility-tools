'use client';

import { useCallback, useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

type OutFormat = 'csv' | 'lines' | 'json';
type Order = 'first-seen' | 'alpha';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function csvEscape(field: string): string {
  if (/[",\n\r]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/** Collect leaf dot-paths of one record up to a depth limit. */
function collectPaths(
  value: unknown,
  prefix: string,
  depth: number,
  maxDepth: number,
  expandArrays: boolean,
  out: string[],
): void {
  if (isPlainObject(value) && depth < maxDepth) {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      out.push(prefix);
      return;
    }
    for (const key of keys) {
      const childPrefix = prefix ? `${prefix}.${key}` : key;
      collectPaths(value[key], childPrefix, depth + 1, maxDepth, expandArrays, out);
    }
    return;
  }
  if (Array.isArray(value) && expandArrays && depth < maxDepth) {
    if (value.length === 0) {
      out.push(prefix);
      return;
    }
    value.forEach((item, idx) => {
      const childPrefix = prefix ? `${prefix}[${idx}]` : `[${idx}]`;
      collectPaths(item, childPrefix, depth + 1, maxDepth, expandArrays, out);
    });
    return;
  }
  // Leaf (primitive, null, or arrays/objects beyond depth/expansion limit).
  out.push(prefix);
}

export default function JsonToCsvHeadersTool() {
  const [outFormat, setOutFormat] = useState<OutFormat>('csv');
  const [order, setOrder] = useState<Order>('first-seen');
  const [expandArrays, setExpandArrays] = useState(false);
  const [maxDepth, setMaxDepth] = useState('10');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let parsed: unknown;
      try {
        parsed = JSON.parse(input);
      } catch (e) {
        throw new Error(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
      }
      if (!Array.isArray(parsed)) {
        throw new Error('Provide a JSON array of objects.');
      }
      const records = parsed.filter(isPlainObject);
      if (records.length === 0) {
        throw new Error('The array contains no objects to derive headers from.');
      }

      const depthNum = Number(maxDepth);
      const limit = Number.isFinite(depthNum) && depthNum >= 1 ? Math.floor(depthNum) : 10;

      const order_: string[] = [];
      const seen = new Set<string>();
      const fillCount = new Map<string, number>();

      for (const rec of records) {
        const paths: string[] = [];
        collectPaths(rec, '', 0, limit, expandArrays, paths);
        const uniqueInRecord = new Set(paths);
        for (const p of uniqueInRecord) {
          if (!seen.has(p)) {
            seen.add(p);
            order_.push(p);
          }
          fillCount.set(p, (fillCount.get(p) ?? 0) + 1);
        }
      }

      const headers = order === 'alpha' ? [...order_].sort((a, b) => a.localeCompare(b)) : order_;
      const total = records.length;

      let headerOut: string;
      if (outFormat === 'csv') {
        headerOut = headers.map(csvEscape).join(',');
      } else if (outFormat === 'lines') {
        headerOut = headers.join('\n');
      } else {
        headerOut = JSON.stringify(headers, null, 2);
      }

      const sparse = headers.filter((h) => (fillCount.get(h) ?? 0) < total);

      const report: string[] = [];
      report.push('--- Header ---');
      report.push(headerOut);
      report.push('');
      report.push('--- Coverage ---');
      report.push(`Records scanned: ${total}`);
      report.push(`Distinct leaf keys: ${headers.length}`);
      report.push('');
      report.push('Fill rate per key:');
      for (const h of headers) {
        const c = fillCount.get(h) ?? 0;
        const pct = ((c / total) * 100).toFixed(0);
        const flag = c < total ? '  (sparse)' : '';
        report.push(`  ${h}: ${c}/${total} (${pct}%)${flag}`);
      }
      if (sparse.length > 0) {
        report.push('');
        report.push(`Sparse keys (${sparse.length}): ${sparse.join(', ')}`);
      }

      return report.join('\n');
    },
    [outFormat, order, expandArrays, maxDepth],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[outFormat, order, expandArrays, maxDepth]}
      inputLabel="JSON array of objects"
      outputLabel="Header + coverage"
      sample={JSON.stringify(
        [
          { id: 1, name: 'Ada', address: { city: 'London' } },
          { id: 2, name: 'Linus', email: 'l@x.com', address: { city: 'Helsinki', zip: '00100' } },
          { id: 3, name: 'Grace', tags: ['admin'] },
        ],
        null,
        2,
      )}
      downloadName="headers.txt"
      downloadMime="text/plain"
      options={
        <>
          <Field label="Header format">
            <Tabs value={outFormat} onValueChange={(v) => setOutFormat(v as OutFormat)}>
              <TabsList>
                <TabsTrigger value="csv">CSV row</TabsTrigger>
                <TabsTrigger value="lines">Lines</TabsTrigger>
                <TabsTrigger value="json">JSON array</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Order">
            <Tabs value={order} onValueChange={(v) => setOrder(v as Order)}>
              <TabsList>
                <TabsTrigger value="first-seen">First seen</TabsTrigger>
                <TabsTrigger value="alpha">A→Z</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Expand arrays">
            <Switch checked={expandArrays} onCheckedChange={setExpandArrays} />
          </Field>
          <Field label="Max depth">
            <Input value={maxDepth} onChange={(e) => setMaxDepth(e.target.value)} inputMode="numeric" className="w-20" />
          </Field>
        </>
      }
    />
  );
}
