'use client';

import { useMemo, useState } from 'react';

import { CopyButton } from '@/components/tools/copy-button';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'has',
  'he', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the', 'this', 'to',
  'was', 'were', 'will', 'with', 'i', 'you', 'we', 'they', 'she', 'his', 'her',
  'their', 'our', 'your', 'not', 'no', 'so', 'if', 'then', 'than', 'too', 'can',
  'do', 'does', 'did', 'have', 'had', 'been', 'being', 'am', 'me', 'my', 'them',
  'us', 'who', 'what', 'when', 'where', 'which', 'how', 'all', 'any', 'some',
]);

interface Entry {
  word: string;
  count: number;
}

export default function WordFrequencyTool() {
  const [text, setText] = useState('');
  const [ignoreCase, setIgnoreCase] = useState(true);
  const [skipStop, setSkipStop] = useState(false);

  const { entries, totalWords, uniqueWords } = useMemo(() => {
    const matches = text.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu) ?? [];
    const counts = new Map<string, number>();
    let total = 0;
    for (const raw of matches) {
      const word = ignoreCase ? raw.toLowerCase() : raw;
      if (skipStop && STOP_WORDS.has(word.toLowerCase())) continue;
      total += 1;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    const list: Entry[] = Array.from(counts, ([word, count]) => ({ word, count }));
    list.sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
    return { entries: list, totalWords: total, uniqueWords: list.length };
  }, [text, ignoreCase, skipStop]);

  const maxCount = entries[0]?.count ?? 0;

  const copyValue = () =>
    entries.map((e) => `${e.word}\t${e.count}`).join('\n');

  return (
    <div className="space-y-3">
      <OptionsBar>
        <Field label="Options" className="gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="ignore-case"
              checked={ignoreCase}
              onCheckedChange={(v) => setIgnoreCase(v === true)}
            />
            <Label htmlFor="ignore-case" className="text-xs font-normal">
              Ignore case
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="skip-stop"
              checked={skipStop}
              onCheckedChange={(v) => setSkipStop(v === true)}
            />
            <Label htmlFor="skip-stop" className="text-xs font-normal">
              Skip common stop words
            </Label>
          </div>
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Text" />
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste text to analyze word frequency…"
          className="min-h-[160px] resize-y rounded-none border-0 font-mono focus-visible:ring-0"
        />
        <StatBar
          items={[
            `${totalWords} words`,
            `${uniqueWords} unique`,
          ]}
        />
      </Panel>

      <Panel>
        <PanelHeader title="Frequency">
          {entries.length > 0 && <CopyButton value={copyValue} />}
        </PanelHeader>
        {entries.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No words yet.
          </div>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/40">
                <tr className="border-b text-2xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-1.5 text-left font-semibold">#</th>
                  <th className="px-3 py-1.5 text-left font-semibold">Word</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Count</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Share</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => {
                  const pct = totalWords > 0 ? (e.count / totalWords) * 100 : 0;
                  const barPct = maxCount > 0 ? (e.count / maxCount) * 100 : 0;
                  return (
                    <tr key={e.word} className="border-b last:border-0">
                      <td className="px-3 py-1 font-mono text-2xs text-muted-foreground tabular">
                        {i + 1}
                      </td>
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
                        {pct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
