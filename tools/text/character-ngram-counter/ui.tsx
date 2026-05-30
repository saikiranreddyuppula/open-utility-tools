'use client';

import { useMemo, useState } from 'react';

import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const SAMPLE =
  'The quick brown fox jumps over the lazy dog. The dog was not amused.';

interface Entry {
  gram: string;
  count: number;
}

type Result =
  | { error: string }
  | { entries: Entry[]; total: number; distinct: number };

export default function CharacterNgramCounterTool() {
  const [text, setText] = useState(SAMPLE);
  const [n, setN] = useState(2);
  const [lower, setLower] = useState(true);
  const [ignoreWs, setIgnoreWs] = useState(false);
  const [ignorePunct, setIgnorePunct] = useState(false);

  const result = useMemo<Result>(() => {
    let s = text;
    if (lower) s = s.toLowerCase();
    if (ignorePunct) s = s.replace(/[^\p{L}\p{N}\s]/gu, '');
    if (ignoreWs) s = s.replace(/\s+/gu, '');
    // Array.from handles surrogate pairs so multi-byte chars stay intact.
    const chars = Array.from(s);
    if (chars.length < n) {
      return { error: `Need at least ${n} characters after normalization.` };
    }
    const counts = new Map<string, number>();
    let total = 0;
    for (let i = 0; i + n <= chars.length; i += 1) {
      const gram = chars.slice(i, i + n).join('');
      counts.set(gram, (counts.get(gram) ?? 0) + 1);
      total += 1;
    }
    const entries: Entry[] = Array.from(counts, ([gram, count]) => ({ gram, count }));
    entries.sort((a, b) => b.count - a.count || a.gram.localeCompare(b.gram));
    return { entries, total, distinct: entries.length };
  }, [text, n, lower, ignoreWs, ignorePunct]);

  const top = 'entries' in result ? result.entries : [];
  const total = 'entries' in result ? result.total : 0;
  const maxCount = top[0]?.count ?? 0;

  const display = (gram: string): string =>
    gram
      .replace(/ /g, '␣')
      .replace(/\n/g, '⏎')
      .replace(/\t/g, '⇥');

  const copyValue = () =>
    top
      .map((e) => `${display(e.gram)}\t${e.count}\t${((e.count / total) * 100).toFixed(2)}%`)
      .join('\n');

  return (
    <div className="space-y-3">
      <OptionsBar>
        <Field label={`N (window size): ${n}`} className="min-w-[220px] flex-1">
          <Slider value={[n]} min={1} max={6} step={1} onValueChange={(v) => setN(v[0] ?? 2)} />
        </Field>
        <Field label="Normalize" className="gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Checkbox id="cng-lower" checked={lower} onCheckedChange={(v) => setLower(v === true)} />
              <Label htmlFor="cng-lower" className="text-xs font-normal">Lowercase</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="cng-ws" checked={ignoreWs} onCheckedChange={(v) => setIgnoreWs(v === true)} />
              <Label htmlFor="cng-ws" className="text-xs font-normal">Ignore whitespace</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="cng-punct" checked={ignorePunct} onCheckedChange={(v) => setIgnorePunct(v === true)} />
              <Label htmlFor="cng-punct" className="text-xs font-normal">Ignore punctuation</Label>
            </div>
          </div>
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Text" />
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste text to analyze character n-grams…"
          spellCheck={false}
          className="min-h-[140px] resize-y rounded-none border-0 font-mono focus-visible:ring-0"
        />
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title={`${n}-gram frequency`}>
            {top.length > 0 && <CopyButton value={copyValue} />}
          </PanelHeader>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/40">
                <tr className="border-b text-2xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-1.5 text-left font-semibold">#</th>
                  <th className="px-3 py-1.5 text-left font-semibold">N-Gram</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Count</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Freq</th>
                </tr>
              </thead>
              <tbody>
                {top.map((e, i) => {
                  const pct = total > 0 ? (e.count / total) * 100 : 0;
                  const barPct = maxCount > 0 ? (e.count / maxCount) * 100 : 0;
                  return (
                    <tr key={e.gram} className="border-b last:border-0">
                      <td className="px-3 py-1 font-mono text-2xs text-muted-foreground tabular">{i + 1}</td>
                      <td className="relative px-3 py-1 font-mono">
                        <span
                          className="absolute inset-y-0 left-0 bg-primary/10"
                          style={{ width: `${barPct}%` }}
                          aria-hidden
                        />
                        <span className="relative whitespace-pre">{display(e.gram)}</span>
                      </td>
                      <td className="px-3 py-1 text-right font-mono tabular">{e.count}</td>
                      <td className="px-3 py-1 text-right font-mono text-2xs text-muted-foreground tabular">
                        {pct.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <StatBar
            items={[`${result.distinct} distinct n-grams`, `${result.total} total windows`]}
          />
        </Panel>
      )}
    </div>
  );
}
