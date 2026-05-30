'use client';

import { useMemo, useState } from 'react';

import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { Textarea } from '@/components/ui/textarea';

const SAMPLE =
  'Readability tests measure how easy a piece of writing is to understand. Short sentences and common words generally make text easier to read. This sample uses simple language so it should score quite high.';

interface Row {
  label: string;
  value: string;
}

type Result =
  | { error: string }
  | {
      ease: number;
      grade: number;
      band: string;
      words: number;
      sentences: number;
      syllables: number;
      avgSentenceLen: number;
      avgSyllables: number;
    };

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length === 0) return 0;
  const groups = w.match(/[aeiouy]+/g) ?? [];
  let count = groups.length;
  // Silent trailing 'e' (but keep at least 1).
  if (w.endsWith('e') && !w.endsWith('le') && count > 1) count -= 1;
  return Math.max(1, count);
}

function band(ease: number): string {
  if (ease >= 90) return 'Very Easy';
  if (ease >= 80) return 'Easy';
  if (ease >= 70) return 'Fairly Easy';
  if (ease >= 60) return 'Standard';
  if (ease >= 50) return 'Fairly Difficult';
  if (ease >= 30) return 'Difficult';
  return 'Very Confusing';
}

export default function FleschReadingEaseTool() {
  const [text, setText] = useState(SAMPLE);

  const result = useMemo<Result>(() => {
    const sentenceParts = text
      .split(/[.!?]+(?=\s|$)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const wordTokens = (text.trim().match(/[A-Za-z']+/g) ?? []).filter((w) => w.length > 0);
    const words = wordTokens.length;
    const sentences = Math.max(sentenceParts.length, words > 0 ? 1 : 0);
    if (words === 0) return { error: 'Enter some text to analyze.' };
    let syllables = 0;
    for (const w of wordTokens) syllables += countSyllables(w);
    const avgSentenceLen = words / sentences;
    const avgSyllables = syllables / words;
    const ease = 206.835 - 1.015 * avgSentenceLen - 84.6 * avgSyllables;
    const grade = 0.39 * avgSentenceLen + 11.8 * avgSyllables - 15.59;
    return {
      ease,
      grade,
      band: band(ease),
      words,
      sentences,
      syllables,
      avgSentenceLen,
      avgSyllables,
    };
  }, [text]);

  const rows: Row[] =
    'error' in result
      ? []
      : [
          { label: 'Flesch Reading Ease', value: result.ease.toFixed(1) },
          { label: 'Difficulty band', value: result.band },
          { label: 'Flesch-Kincaid Grade', value: result.grade.toFixed(1) },
          { label: 'Words', value: String(result.words) },
          { label: 'Sentences', value: String(result.sentences) },
          { label: 'Syllables', value: String(result.syllables) },
          { label: 'Avg sentence length', value: result.avgSentenceLen.toFixed(2) },
          { label: 'Avg syllables / word', value: result.avgSyllables.toFixed(2) },
        ];

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Text" />
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste prose to score…"
          spellCheck={false}
          className="min-h-[160px] resize-y rounded-none border-0 font-mono focus-visible:ring-0"
        />
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton value={() => rows.map((r) => `${r.label}: ${r.value}`).join('\n')} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {rows.map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="text-sm text-muted-foreground">{r.label}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span>{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar
            items={[
              `Ease ${result.ease.toFixed(0)} (${result.band})`,
              `Grade ${result.grade.toFixed(1)}`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
