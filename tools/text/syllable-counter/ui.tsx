'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';

const SAMPLE = 'An old silent pond\nA frog jumps into the pond\nSplash! Silence again';

// English syllable heuristic: count vowel groups with diphthong / silent-e / "-le" adjustments.
function countSyllables(raw: string): number {
  const w = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;

  // Count contiguous vowel groups (a e i o u y).
  const groups = w.match(/[aeiouy]+/g) ?? [];
  let count = groups.length;

  // Silent trailing 'e' (but not "-le" handled below, and not words like "the" already short).
  if (w.endsWith('e') && !w.endsWith('le')) {
    count -= 1;
  }

  // Words ending in consonant + "le" gain a syllable back (e.g. "table", "little").
  if (w.length > 2 && w.endsWith('le')) {
    const before = w[w.length - 3] ?? '';
    if (before && !'aeiouy'.includes(before)) count += 1;
  }

  // Common silent endings: "-es" / "-ed" usually do not add a syllable when preceded by
  // a non-vowel that is not a sibilant/d/t.
  if (/[^aeioulr]es$/.test(w) || /[^aeioudt]ed$/.test(w)) {
    count -= 1;
  }

  return Math.max(1, count);
}

export default function SyllableCounter() {
  const [text, setText] = useState(SAMPLE);

  const result = useMemo(() => {
    const matches = text.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g);
    if (!matches || matches.length === 0)
      return { error: 'Enter a word or some text to count syllables.' };

    const words = matches.map((w) => ({ word: w, syl: countSyllables(w) }));
    const total = words.reduce((acc, x) => acc + x.syl, 0);
    const avg = total / words.length;

    // Per-line totals (useful for haiku 5-7-5 checking).
    const lines = text.split(/\n/).map((line) => {
      const lm = line.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) ?? [];
      const syl = lm.reduce((a, w) => a + countSyllables(w), 0);
      return { line, syl, words: lm.length };
    });

    return { words, total, avg, wordCount: words.length, lines };
  }, [text]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Text" />
        <div className="p-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            rows={5}
            className="font-mono"
            placeholder="A word, sentence, or poem…"
          />
        </div>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Summary" />
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
              <div className="rounded-md border bg-muted/30 px-3 py-3">
                <div className="text-2xs uppercase tracking-wide text-muted-foreground">
                  Total syllables
                </div>
                <div className="font-mono text-2xl font-semibold">{result.total}</div>
              </div>
              <div className="rounded-md border bg-muted/30 px-3 py-3">
                <div className="text-2xs uppercase tracking-wide text-muted-foreground">Words</div>
                <div className="font-mono text-2xl font-semibold">{result.wordCount}</div>
              </div>
              <div className="rounded-md border bg-muted/30 px-3 py-3">
                <div className="text-2xs uppercase tracking-wide text-muted-foreground">
                  Avg syllables/word
                </div>
                <div className="font-mono text-2xl font-semibold">{result.avg.toFixed(2)}</div>
              </div>
            </div>
            {result.lines.length > 1 && (
              <div className="px-3 pb-3">
                <div className="overflow-hidden rounded-md border">
                  <div className="bg-muted/40 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Per line (haiku check)
                  </div>
                  {result.lines.map((l, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 border-t px-3 py-1.5 text-sm"
                    >
                      <span className="w-10 shrink-0 text-right font-mono font-semibold">
                        {l.syl}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {l.line.trim() || '(blank line)'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Per-word breakdown">
              <CopyButton value={() => result.words.map((w) => `${w.word}: ${w.syl}`).join('\n')} />
            </PanelHeader>
            <div className="max-h-[360px] overflow-auto p-3">
              <div className="flex flex-wrap gap-1.5">
                {result.words.map((w, i) => (
                  <span
                    key={`${w.word}-${i}`}
                    className="inline-flex items-center gap-1 rounded border bg-muted/30 px-2 py-0.5 text-sm"
                  >
                    <span>{w.word}</span>
                    <span className="font-mono text-2xs text-muted-foreground">{w.syl}</span>
                  </span>
                ))}
              </div>
            </div>
            <StatBar
              items={[`syllables = ${result.total}`, `words = ${result.wordCount}`]}
            />
          </Panel>
        </div>
      )}
    </div>
  );
}
