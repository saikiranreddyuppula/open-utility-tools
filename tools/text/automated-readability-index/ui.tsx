'use client';

import { useMemo, useState } from 'react';

import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { Textarea } from '@/components/ui/textarea';

const SAMPLE =
  'The Automated Readability Index estimates the US grade level needed to understand a passage. It uses the count of characters per word and words per sentence rather than syllables, which makes it easy to compute automatically. Try editing this paragraph to see how the score changes.';

interface Row {
  label: string;
  value: string;
}

type Result =
  | { error: string }
  | {
      ari: number;
      grade: number;
      gradeLabel: string;
      ageRange: string;
      characters: number;
      words: number;
      sentences: number;
    };

// Maps the ceiling ARI grade (1-14) to a US grade label and reading age range.
function gradeInfo(grade: number): { label: string; age: string } {
  const table: Record<number, { label: string; age: string }> = {
    1: { label: 'Kindergarten', age: 'Ages 5-6' },
    2: { label: 'Grade 1', age: 'Ages 6-7' },
    3: { label: 'Grade 2', age: 'Ages 7-8' },
    4: { label: 'Grade 3', age: 'Ages 8-9' },
    5: { label: 'Grade 4', age: 'Ages 9-10' },
    6: { label: 'Grade 5', age: 'Ages 10-11' },
    7: { label: 'Grade 6', age: 'Ages 11-12' },
    8: { label: 'Grade 7', age: 'Ages 12-13' },
    9: { label: 'Grade 8', age: 'Ages 13-14' },
    10: { label: 'Grade 9', age: 'Ages 14-15' },
    11: { label: 'Grade 10', age: 'Ages 15-16' },
    12: { label: 'Grade 11', age: 'Ages 16-17' },
    13: { label: 'Grade 12', age: 'Ages 17-18' },
    14: { label: 'College', age: 'Ages 18-22' },
  };
  if (grade <= 1) return { label: 'Kindergarten', age: 'Ages 5-6' };
  if (grade >= 14) return { label: 'College / Professional', age: 'Ages 18+' };
  return table[grade] ?? { label: `Grade ${grade - 1}`, age: 'Unknown' };
}

export default function AutomatedReadabilityIndexTool() {
  const [text, setText] = useState(SAMPLE);

  const result = useMemo<Result>(() => {
    // Characters: letters and digits only, excluding whitespace and punctuation.
    const characters = (text.match(/[A-Za-z0-9]/g) ?? []).length;
    const words = (text.trim().match(/\S+/g) ?? []).length;
    const sentences =
      (text.match(/[.!?]+(?=\s|$)/g) ?? []).length || (words > 0 ? 1 : 0);

    if (words === 0) return { error: 'Enter some text to analyze.' };
    if (sentences === 0) return { error: 'No sentences detected; add ending punctuation.' };

    const ari = 4.71 * (characters / words) + 0.5 * (words / sentences) - 21.43;
    const grade = Math.max(1, Math.ceil(ari));
    const info = gradeInfo(grade);

    return {
      ari,
      grade,
      gradeLabel: info.label,
      ageRange: info.age,
      characters,
      words,
      sentences,
    };
  }, [text]);

  const rows: Row[] =
    'error' in result
      ? []
      : [
          { label: 'ARI (raw)', value: result.ari.toFixed(2) },
          { label: 'Grade (rounded up)', value: String(result.grade) },
          { label: 'US grade label', value: result.gradeLabel },
          { label: 'Age range', value: result.ageRange },
          { label: 'Characters', value: String(result.characters) },
          { label: 'Words', value: String(result.words) },
          { label: 'Sentences', value: String(result.sentences) },
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
              `ARI ${result.ari.toFixed(1)}`,
              result.gradeLabel,
              `${result.words} words`,
              `${result.sentences} sentences`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
