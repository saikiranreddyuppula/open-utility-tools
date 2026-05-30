'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const SAMPLE = `region,product,qty,revenue
West,Widget,3,30
East,Widget,5,55
West,Gadget,2,40
East,Gadget,7,70
West,Widget,1,12`;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i] ?? '';
    if (inQuotes) {
      if (ch === '"') {
        const next = src[i + 1] ?? '';
        if (next === '"') { cur += '"'; i++; } else { inQuotes = false; }
      } else { cur += ch; }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cur); cur = '';
    } else if (ch === '\n') {
      row.push(cur); rows.push(row); row = []; cur = '';
    } else {
      cur += ch;
    }
  }
  row.push(cur);
  rows.push(row);
  const last = rows[rows.length - 1];
  if (rows.length > 1 && last && last.length === 1 && last[0] === '') rows.pop();
  return rows;
}

function formatField(field: string): string {
  return /[",\n\r]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
}

function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(formatField).join(',')).join('\n');
}

type AggKey = 'count' | 'sum' | 'mean' | 'min' | 'max';
const AGG_ORDER: AggKey[] = ['count', 'sum', 'mean', 'min', 'max'];
const AGG_LABEL: Record<AggKey, string> = {
  count: 'count',
  sum: 'sum',
  mean: 'mean',
  min: 'min',
  max: 'max',
};

interface Bucket {
  key: string;
  count: number;
  sum: number;
  numericCount: number;
  min: number;
  max: number;
}

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '';
  return Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/\.?0+$/, '');
}

export default function CsvGroupByAggregateTool() {
  const [input, setInput] = useState('');
  const [groupCol, setGroupCol] = useState('');
  const [valueCol, setValueCol] = useState('');
  const [aggs, setAggs] = useState<Record<AggKey, boolean>>({
    count: true, sum: true, mean: true, min: false, max: false,
  });

  const result = useMemo<{ output: string; error: string | null; groups: number }>(() => {
    if (!input.trim()) return { output: '', error: null, groups: 0 };
    const matrix = parseCsv(input);
    const header = matrix[0];
    if (!header || header.length === 0) return { output: '', error: 'CSV has no header row.', groups: 0 };
    const body = matrix.slice(1);

    const gKey = groupCol.trim();
    if (!gKey) return { output: '', error: 'Enter a group-by column name.', groups: 0 };
    const gi = header.indexOf(gKey);
    if (gi === -1) return { output: '', error: `Group-by column not found: "${gKey}"`, groups: 0 };

    const selected = AGG_ORDER.filter((a) => aggs[a]);
    if (selected.length === 0) return { output: '', error: 'Select at least one aggregate.', groups: 0 };

    const needsValue = selected.some((a) => a !== 'count');
    const vKey = valueCol.trim();
    let vi = -1;
    if (needsValue) {
      if (!vKey) return { output: '', error: 'Enter a value column name for numeric aggregates.', groups: 0 };
      vi = header.indexOf(vKey);
      if (vi === -1) return { output: '', error: `Value column not found: "${vKey}"`, groups: 0 };
    }

    const order: string[] = [];
    const buckets = new Map<string, Bucket>();
    for (const r of body) {
      if (r.length === 1 && (r[0] ?? '') === '') continue;
      const key = r[gi] ?? '';
      let b = buckets.get(key);
      if (!b) {
        b = { key, count: 0, sum: 0, numericCount: 0, min: Infinity, max: -Infinity };
        buckets.set(key, b);
        order.push(key);
      }
      b.count++;
      if (needsValue) {
        const raw = (r[vi] ?? '').trim();
        const n = Number(raw);
        if (raw !== '' && Number.isFinite(n)) {
          b.sum += n;
          b.numericCount++;
          if (n < b.min) b.min = n;
          if (n > b.max) b.max = n;
        }
      }
    }

    const outHeader: string[] = [gKey];
    for (const a of selected) {
      outHeader.push(a === 'count' ? 'count' : `${AGG_LABEL[a]}_${vKey}`);
    }

    const outRows: string[][] = [outHeader];
    for (const key of order) {
      const b = buckets.get(key);
      if (!b) continue;
      const cells: string[] = [key];
      for (const a of selected) {
        switch (a) {
          case 'count': cells.push(String(b.count)); break;
          case 'sum': cells.push(b.numericCount > 0 ? fmtNum(b.sum) : ''); break;
          case 'mean': cells.push(b.numericCount > 0 ? fmtNum(b.sum / b.numericCount) : ''); break;
          case 'min': cells.push(b.numericCount > 0 ? fmtNum(b.min) : ''); break;
          case 'max': cells.push(b.numericCount > 0 ? fmtNum(b.max) : ''); break;
          default: cells.push(''); break;
        }
      }
      outRows.push(cells);
    }

    return { output: toCsv(outRows), error: null, groups: order.length };
  }, [input, groupCol, valueCol, aggs]);

  const toggle = (a: AggKey) => setAggs((prev) => ({ ...prev, [a]: !prev[a] }));

  return (
    <div className="flex flex-col gap-4">
      <OptionsBar>
        <Field label="Group by column">
          <Input value={groupCol} onChange={(e) => setGroupCol(e.target.value)} placeholder="region" className="w-40" />
        </Field>
        <Field label="Value column">
          <Input value={valueCol} onChange={(e) => setValueCol(e.target.value)} placeholder="revenue" className="w-40" />
        </Field>
        <Field label="Aggregates">
          <div className="flex flex-wrap items-center gap-3">
            {AGG_ORDER.map((a) => (
              <label key={a} className="flex cursor-pointer items-center gap-1.5">
                <Checkbox checked={aggs[a]} onCheckedChange={() => toggle(a)} />
                <Label className="cursor-pointer text-sm capitalize">{a}</Label>
              </label>
            ))}
          </div>
        </Field>
      </OptionsBar>

      <ErrorBanner error={result.error} />

      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <PanelHeader title="Input CSV">
            <Button variant="ghost" size="sm" onClick={() => { setInput(SAMPLE); setGroupCol('region'); setValueCol('revenue'); }}>
              Load sample
            </Button>
          </PanelHeader>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste CSV with a header row..."
            spellCheck={false}
            className="min-h-[280px] font-mono text-sm"
          />
        </Panel>
        <Panel>
          <PanelHeader title="Aggregated CSV">
            <CopyButton value={result.output} />
          </PanelHeader>
          <Textarea
            value={result.output}
            readOnly
            placeholder="Result appears here..."
            spellCheck={false}
            className="min-h-[280px] font-mono text-sm"
          />
        </Panel>
      </div>

      <StatBar items={[result.groups > 0 ? `${result.groups} groups` : false]} />
    </div>
  );
}
