'use client';

import { useMemo, useState } from 'react';

import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { Textarea } from '@/components/ui/textarea';

const SAMPLE =
  'The implementation of comprehensive environmental regulations necessitates considerable administrative coordination. Organizations must demonstrate accountability while accommodating evolving requirements. Effective communication consequently becomes indispensable.';

interface Row {
  label: string;
  value: string;
}

type Result =
  | { error: string }
  | {
      fog: number;
      grade: string;
      words: number;
      sentences: number;
      complex: number;
      pctComplex: number;
      complexWords: string[];
    };

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length === 0) return 0;
  const groups = w.match(/[aeiouy]+/g) ?? [];
  let count = groups.length;
  if (w.endsWith('e') && !w.endsWith('le') && count > 1) count -= 1;
  return Math.max(1, count);
}

function gradeLabel(fog: number): string {
  const g = Math.round(fog);
  if (g <= 6) return 'Grade 6 or below (easy)';
  if (g <= 8) return `Grade ${g} (plain English)`;
  if (g <= 12) return `Grade ${g} (high school)`;
  if (g <= 16) return `Grade ${g} (college)`;
  return `Grade ${g}+ (graduate / dense)`;
}

export default function GunningFogIndexTool() {
  const [text, setText] = useState(SAMPLE);

  const result = useMemo<Result>(() => {
    const sentenceParts = text
      .split(/[.!?]+(?=\s|$)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const rawWords = text.match(/[A-Za-z]+(?:[-'][A-Za-z]+)*/g) ?? [];
    const words = rawWords.length;
    const sentences = Math.max(sentenceParts.length, words > 0 ? 1 : 0);
    if (words === 0) return { error: 'Enter some text to analyze.' };

    const complexList: string[] = [];
    const seen = new Set<string>();
    for (const raw of rawWords) {
      if (raw.includes('-')) continue; // skip hyphenated compounds
      const syl = countSyllables(raw);
      if (syl < 3) continue;
      // Skip proper nouns (capitalized, not sentence-initial heuristic): keep simple — count.
      // Skip words that only reach 3 syllables due to common suffixes on a short stem.
      const lower = raw.toLowerCase();
      const stem = lower.replace(/(es|ed|ing)$/, '');
      if (stem !== lower && countSyllables(stem) < 3) continue;
      complexList.push(raw);
      seen.add(lower);
    }
    const complex = complexList.length;
    const fog = 0.4 * (words / sentences + 100 * (complex / words));
    const pctComplex = (complex / words) * 100;
    // Deduplicate display list, preserve first appearance, cap to 200.
    const uniqDisplay: string[] = [];
    const dseen = new Set<string>();
    for (const w of complexList) {
      const k = w.toLowerCase();
      if (dseen.has(k)) continue;
      dseen.add(k);
      uniqDisplay.push(w);
      if (uniqDisplay.length >= 200) break;
    }
    return {
      fog,
      grade: gradeLabel(fog),
      words,
      sentences,
      complex,
      pctComplex,
      complexWords: uniqDisplay,
    };
  }, [text]);

  const rows: Row[] =
    'error' in result
      ? []
      : [
          { label: 'Gunning Fog Index', value: result.fog.toFixed(2) },
          { label: 'Interpretation', value: result.grade },
          { label: 'Words', value: String(result.words) },
          { label: 'Sentences', value: String(result.sentences) },
          { label: 'Complex words', value: String(result.complex) },
          { label: 'Percent complex', value: `${result.pctComplex.toFixed(1)}%` },
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
        <>
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
            <StatBar items={[`Fog ${result.fog.toFixed(1)}`, result.grade]} />
          </Panel>

          <Panel>
            <PanelHeader title={`Complex words (${result.complexWords.length} unique)`}>
              {result.complexWords.length > 0 && (
                <CopyButton value={() => result.complexWords.join('\n')} />
              )}
            </PanelHeader>
            {result.complexWords.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No complex words detected.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 p-3">
                {result.complexWords.map((w) => (
                  <span
                    key={w}
                    className="rounded border bg-muted/40 px-2 py-0.5 font-mono text-xs"
                  >
                    {w}
                  </span>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
