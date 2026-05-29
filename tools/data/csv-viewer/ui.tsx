'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { parseCsv } from '@/lib/data/csv';

const SAMPLE = 'name,role,score\nAda,admin,98\nLinus,user,72\nGrace,editor,88';

export default function CsvViewerTool() {
  const [input, setInput] = useState(SAMPLE);
  const [delim, setDelim] = useState(',');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ col: number; dir: 1 | -1 } | null>(null);

  const { headers, rows } = useMemo(() => {
    const parsed = parseCsv(input, delim === '\\t' ? '\t' : delim).filter((r) => r.some((c) => c !== ''));
    if (parsed.length === 0) return { headers: [], rows: [] };
    return { headers: parsed[0]!, rows: parsed.slice(1) };
  }, [input, delim]);

  const view = useMemo(() => {
    let r = rows;
    if (q.trim()) {
      const s = q.toLowerCase();
      r = r.filter((row) => row.some((c) => c.toLowerCase().includes(s)));
    }
    if (sort) {
      r = [...r].sort((a, b) => {
        const av = a[sort.col] ?? '';
        const bv = b[sort.col] ?? '';
        const an = parseFloat(av);
        const bn = parseFloat(bv);
        const cmp = !isNaN(an) && !isNaN(bn) ? an - bn : av.localeCompare(bv);
        return cmp * sort.dir;
      });
    }
    return r;
  }, [rows, q, sort]);

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <PanelHeader title="CSV input" />
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          className="min-h-24 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>

      <OptionsBar>
        <Field label="Delimiter">
          <Select value={delim} onValueChange={setDelim}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value=",">Comma</SelectItem>
              <SelectItem value=";">Semicolon</SelectItem>
              <SelectItem value="\t">Tab</SelectItem>
              <SelectItem value="|">Pipe</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Filter" className="flex-1">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search rows…" className="font-mono" />
        </Field>
      </OptionsBar>

      {headers.length > 0 && (
        <Panel>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/60 text-2xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">#</th>
                  {headers.map((h, i) => (
                    <th
                      key={i}
                      className="cursor-pointer px-3 py-1.5 text-left font-medium hover:text-foreground"
                      onClick={() =>
                        setSort((s) => (s?.col === i ? { col: i, dir: s.dir === 1 ? -1 : 1 } : { col: i, dir: 1 }))
                      }
                    >
                      {h} {sort?.col === i ? (sort.dir === 1 ? '↑' : '↓') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono">
                {view.map((row, ri) => (
                  <tr key={ri} className="border-t hover:bg-accent/40">
                    <td className="px-2 py-1 text-muted-foreground tabular">{ri + 1}</td>
                    {headers.map((_, ci) => (
                      <td key={ci} className="px-3 py-1">{row[ci] ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <StatBar items={[`${view.length} / ${rows.length} rows`, `${headers.length} columns`]} />
        </Panel>
      )}
    </div>
  );
}
