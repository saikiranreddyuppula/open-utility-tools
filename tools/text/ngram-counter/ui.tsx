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
  'The quick brown fox jumps over the lazy dog. The lazy dog sleeps all day. The quick brown fox is very quick indeed.';

const STOP_WORDS = new Set<string>([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'has',
  'he', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the', 'this', 'to',
  'was', 'were', 'will', 'with', 'i', 'you', 'we', 'they', 'she', 'his', 'her',
  'their', 'our', 'your', 'not', 'no', 'so', 'if', 'then', 'than', 'too', 'can',
  'do', 'does', 'did', 'have', 'had', 'been', 'being', 'am', 'me', 'my', 'them',
  'us', 'who', 'what', 'when', 'where', 'which', 'how', 'all', 'any', 'some',
]);

interface Entry {
  gram: string;
  count: number;
}

type Result =
  | { error: string }
  | { entries: Entry[]; total: number; distinct: number };

export default function NgramCounterTool() {
  const [text, setText] = useState(SAMPLE);
  const [n, setN] = useState(2);
  const [lower, setLower] = useState(true);
  const [stripPunct, setStripPunct] = useState(true);
  const [removeStop, setRemoveStop] = useState(false);
  const [respectSentences, setRespectSentences] = useState(true);

  const result = useMemo<Result>(() => {
    // Split into sentence segments so n-grams do not cross boundaries when enabled.
    const segments = respectSentences
      ? text.split(/[.!?]+(?=\s|$)|\n+/)
      : [text];

    const counts = new Map<string, number>();
    let total = 0;

    for (const seg of segments) {
      let raw: string[] = seg.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? [];
      if (lower) raw = raw.map((w) => w.toLowerCase());
      if (stripPunct) raw = raw.map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''));
      let tokens = raw.filter((w) => w.length > 0);
      if (removeStop) tokens = tokens.filter((w) => !STOP_WORDS.has(w.toLowerCase()));
      if (tokens.length < n) continue;
      for (let i = 0; i + n <= tokens.length; i += 1) {
        const gram = tokens.slice(i, i + n).join(' ');
        counts.set(gram, (counts.get(gram) ?? 0) + 1);
        total += 1;
      }
    }

    if (total === 0) {
      return { error: `Not enough words to form ${n}-grams after filtering.` };
    }
    const entries: Entry[] = Array.from(counts, ([gram, count]) => ({ gram, count }));
    entries.sort((a, b) => b.count - a.count || a.gram.localeCompare(b.gram));
    return { entries: entries.slice(0, 100), total, distinct: counts.size };
  }, [text, n, lower, stripPunct, removeStop, respectSentences]);

  const top = 'entries' in result ? result.entries : [];
  const total = 'entries' in result ? result.total : 0;
  const maxCount = top[0]?.count ?? 0;

  const copyValue = () =>
    top
      .map((e) => `${e.gram}\t${e.count}\t${((e.count / total) * 100).toFixed(2)}%`)
      .join('\n');

  return (
    <div className="space-y-3">
      <OptionsBar>
        <Field label={`N (words per gram): ${n}`} className="min-w-[200px] flex-1">
          <Slider value={[n]} min={1} max={5} step={1} onValueChange={(v) => setN(v[0] ?? 2)} />
        </Field>
        <Field label="Options" className="gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Checkbox id="ng-lower" checked={lower} onCheckedChange={(v) => setLower(v === true)} />
              <Label htmlFor="ng-lower" className="text-xs font-normal">Lowercase</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="ng-punct" checked={stripPunct} onCheckedChange={(v) => setStripPunct(v === true)} />
              <Label htmlFor="ng-punct" className="text-xs font-normal">Strip punctuation</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="ng-stop" checked={removeStop} onCheckedChange={(v) => setRemoveStop(v === true)} />
              <Label htmlFor="ng-stop" className="text-xs font-normal">Remove stop words</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="ng-sent" checked={respectSentences} onCheckedChange={(v) => setRespectSentences(v === true)} />
              <Label htmlFor="ng-sent" className="text-xs font-normal">Respect sentence boundaries</Label>
            </div>
          </div>
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Text" />
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste text to extract word n-grams…"
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
                  <th className="px-3 py-1.5 text-right font-semibold">Share</th>
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
                        <span className="relative">{e.gram}</span>
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
            items={[
              `${result.distinct} unique n-grams`,
              `${result.total} total`,
              `top ${top.length} shown`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
