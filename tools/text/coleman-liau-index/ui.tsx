'use client';

import { useMemo, useState } from 'react';

import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { Textarea } from '@/components/ui/textarea';

const SAMPLE =
  'The Coleman-Liau index is a readability test designed to gauge the understandability of a text. Unlike many other indices, it relies on characters instead of syllables per word. Its output approximates the US grade level needed to comprehend the writing.';

interface Row {
  label: string;
  value: string;
}

type Result =
  | { error: string }
  | {
      index: number;
      grade: string;
      L: number;
      S: number;
      letters: number;
      words: number;
      sentences: number;
    };

function gradeLabel(idx: number): string {
  const g = Math.round(idx);
  if (g <= 0) return 'Kindergarten or below';
  if (g >= 16) return 'College graduate';
  if (g >= 13) return 'College';
  return `Grade ${g}`;
}

export default function ColemanLiauIndexTool() {
  const [text, setText] = useState(SAMPLE);

  const result = useMemo<Result>(() => {
    const letters = (text.match(/[A-Za-z]/g) ?? []).length;
    const words = (text.trim().match(/\S+/g) ?? []).length;
    const sentences = (text.match(/[.!?]+(?=\s|$)/g) ?? []).length || (words > 0 ? 1 : 0);
    if (words === 0) return { error: 'Enter some text to analyze.' };
    const L = (letters / words) * 100;
    const S = (sentences / words) * 100;
    const index = 0.0588 * L - 0.296 * S - 15.8;
    return {
      index,
      grade: gradeLabel(index),
      L,
      S,
      letters,
      words,
      sentences,
    };
  }, [text]);

  const rows: Row[] =
    'error' in result
      ? []
      : [
          { label: 'Coleman-Liau Index', value: result.index.toFixed(2) },
          { label: 'Grade level', value: result.grade },
          { label: 'L (letters per 100 words)', value: result.L.toFixed(2) },
          { label: 'S (sentences per 100 words)', value: result.S.toFixed(2) },
          { label: 'Letters', value: String(result.letters) },
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
              `Index ${result.index.toFixed(1)}`,
              `${result.words} words`,
              `${result.sentences} sentences`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
