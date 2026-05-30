'use client';

import { useMemo, useState } from 'react';

import { CopyButton } from '@/components/tools/copy-button';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const SAMPLE =
  'Content marketing helps businesses grow. Great content marketing drives organic traffic, and consistent content builds authority. Marketing teams should plan content around target keywords for the best search results.';

const STOP_WORDS = new Set<string>([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'has',
  'he', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the', 'this', 'to',
  'was', 'were', 'will', 'with', 'i', 'you', 'we', 'they', 'she', 'his', 'her',
  'their', 'our', 'your', 'not', 'no', 'so', 'if', 'then', 'than', 'too', 'can',
  'do', 'does', 'did', 'have', 'had', 'been', 'being', 'am', 'me', 'my', 'them',
  'us', 'who', 'what', 'when', 'where', 'which', 'how', 'all', 'any', 'some',
  'about', 'into', 'over', 'after', 'before', 'up', 'down', 'out', 'off', 'just',
  'also', 'more', 'most', 'other', 'such', 'only', 'own', 'same', 'should',
]);

interface Entry {
  word: string;
  count: number;
  density: number;
}

export default function KeywordDensityAnalyzerTool() {
  const [text, setText] = useState(SAMPLE);
  const [minLen, setMinLen] = useState(3);
  const [removeStop, setRemoveStop] = useState(true);
  const [caseSensitive, setCaseSensitive] = useState(false);

  const { entries, totalWords, kept } = useMemo(() => {
    const raw = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? [];
    const total = raw.length;
    const counts = new Map<string, number>();
    let keptCount = 0;
    for (const token of raw) {
      const word = caseSensitive ? token : token.toLowerCase();
      if (word.length < minLen) continue;
      if (removeStop && STOP_WORDS.has(word.toLowerCase())) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
      keptCount += 1;
    }
    const list: Entry[] = Array.from(counts, ([word, count]) => ({
      word,
      count,
      density: total > 0 ? (count / total) * 100 : 0,
    }));
    list.sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
    return { entries: list.slice(0, 100), totalWords: total, kept: keptCount };
  }, [text, minLen, removeStop, caseSensitive]);

  const maxCount = entries[0]?.count ?? 0;

  const copyValue = () =>
    entries.map((e) => `${e.word}\t${e.count}\t${e.density.toFixed(2)}%`).join('\n');

  return (
    <div className="space-y-3">
      <OptionsBar>
        <Field label={`Min word length: ${minLen}`} className="min-w-[200px] flex-1">
          <Slider value={[minLen]} min={1} max={10} step={1} onValueChange={(v) => setMinLen(v[0] ?? 3)} />
        </Field>
        <Field label="Options" className="gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Checkbox id="kda-stop" checked={removeStop} onCheckedChange={(v) => setRemoveStop(v === true)} />
              <Label htmlFor="kda-stop" className="text-xs font-normal">Remove stop words</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="kda-case" checked={caseSensitive} onCheckedChange={(v) => setCaseSensitive(v === true)} />
              <Label htmlFor="kda-case" className="text-xs font-normal">Case sensitive</Label>
            </div>
          </div>
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Content" />
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste content to analyze keyword density…"
          spellCheck={false}
          className="min-h-[150px] resize-y rounded-none border-0 font-mono focus-visible:ring-0"
        />
      </Panel>

      <Panel>
        <PanelHeader title="Keyword density">
          {entries.length > 0 && <CopyButton value={copyValue} />}
        </PanelHeader>
        {entries.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No qualifying keywords yet.
          </div>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/40">
                <tr className="border-b text-2xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-1.5 text-left font-semibold">#</th>
                  <th className="px-3 py-1.5 text-left font-semibold">Keyword</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Count</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Density</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => {
                  const barPct = maxCount > 0 ? (e.count / maxCount) * 100 : 0;
                  return (
                    <tr key={e.word} className="border-b last:border-0">
                      <td className="px-3 py-1 font-mono text-2xs text-muted-foreground tabular">{i + 1}</td>
                      <td className="relative px-3 py-1 font-mono">
                        <span
                          className="absolute inset-y-0 left-0 bg-primary/10"
                          style={{ width: `${barPct}%` }}
                          aria-hidden
                        />
                        <span className="relative">{e.word}</span>
                      </td>
                      <td className="px-3 py-1 text-right font-mono tabular">{e.count}</td>
                      <td className="px-3 py-1 text-right font-mono text-2xs text-muted-foreground tabular">
                        {e.density.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <StatBar
          items={[
            `${totalWords} total words`,
            `${kept} counted`,
            `${entries.length} keywords shown`,
          ]}
        />
      </Panel>
    </div>
  );
}
