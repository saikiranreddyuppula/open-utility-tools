'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';

const SAMPLE =
  'Take this medication exactly as your physician has instructed. Do not exceed the recommended ' +
  'dosage. Possible complications include gastrointestinal discomfort, dizziness, and an allergic ' +
  'reaction. If you experience difficulty breathing, contact emergency services immediately. ' +
  'Store the container in a refrigerated environment. Continue the entire prescribed course even ' +
  'if symptoms improve. Consult your pharmacist regarding potential interactions with other ' +
  'supplements. This information is intended to supplement, not replace, professional medical advice.';

// Vowel-group syllable heuristic.
function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;
  let trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  trimmed = trimmed.replace(/^y/, '');
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return groups ? groups.length : 1;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && /[a-zA-Z0-9]/.test(s));
}

function splitWords(text: string): string[] {
  const m = text.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g);
  return m ?? [];
}

export default function SmogReadabilityGrade() {
  const [text, setText] = useState(SAMPLE);

  const result = useMemo(() => {
    const sentences = splitSentences(text);
    const words = splitWords(text);
    if (sentences.length === 0 || words.length === 0)
      return { error: 'Enter at least one full sentence of prose.' };

    let polysyllables = 0;
    for (const w of words) {
      if (syllables(w) >= 3) polysyllables++;
    }

    const sCount = sentences.length;
    const per30 = polysyllables * (30 / sCount);
    const smog = 1.043 * Math.sqrt(per30) + 3.1291;
    const smogSimple = Math.sqrt(per30) + 3;
    const grade = Math.max(0, smog);

    return {
      sentences: sCount,
      words: words.length,
      polysyllables,
      smog,
      smogSimple,
      grade,
      readingAge: grade + 5,
      lowSample: sCount < 30,
    };
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
            rows={7}
            placeholder="Paste prose (works best with 30+ sentences)…"
          />
        </div>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="SMOG Grade">
            <CopyButton
              value={() =>
                [
                  `SMOG grade: ${result.smog.toFixed(2)}`,
                  `SMOG (simplified): ${result.smogSimple.toFixed(2)}`,
                  `Reading age: ${result.readingAge.toFixed(1)} years`,
                  `Polysyllables: ${result.polysyllables}`,
                  `Sentences: ${result.sentences}`,
                ].join('\n')
              }
            />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
            <div className="rounded-md border bg-muted/30 px-3 py-3">
              <div className="text-2xs uppercase tracking-wide text-muted-foreground">
                SMOG grade
              </div>
              <div className="font-mono text-2xl font-semibold">{result.smog.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">US grade level</div>
            </div>
            <div className="rounded-md border bg-muted/30 px-3 py-3">
              <div className="text-2xs uppercase tracking-wide text-muted-foreground">
                SMOG simplified
              </div>
              <div className="font-mono text-2xl font-semibold">
                {result.smogSimple.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">√(poly·30/sent)+3</div>
            </div>
            <div className="rounded-md border bg-muted/30 px-3 py-3">
              <div className="text-2xs uppercase tracking-wide text-muted-foreground">
                Reading age
              </div>
              <div className="font-mono text-2xl font-semibold">
                {result.readingAge.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground">years (grade + 5)</div>
            </div>
          </div>
          {result.lowSample && (
            <div className="mx-3 mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-muted-foreground">
              Only {result.sentences} sentences detected. SMOG is calibrated for 30+ sentences;
              the score is normalized but less reliable on short samples.
            </div>
          )}
          <StatBar
            items={[
              `polysyllables = ${result.polysyllables}`,
              `sentences = ${result.sentences}`,
              `words = ${result.words}`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
