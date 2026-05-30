'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';

const SAMPLE =
  'Readability formulas estimate how difficult a passage is to understand. They typically combine ' +
  'sentence length and word complexity into a single grade level. No single formula is perfect, so ' +
  'comparing several of them gives a more balanced picture. This report computes six well-known ' +
  'measures from the same text and reports a consensus grade so you can decide whether your writing ' +
  'is appropriately accessible for your intended audience.';

function syllables(raw: string): number {
  const w = raw.toLowerCase().replace(/[^a-z]/g, '');
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
  return text.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) ?? [];
}

export default function ReadabilitySummary() {
  const [text, setText] = useState(SAMPLE);

  const result = useMemo(() => {
    const sentences = splitSentences(text);
    const words = splitWords(text);
    if (sentences.length === 0 || words.length === 0)
      return { error: 'Enter at least one full sentence of prose.' };

    const W = words.length;
    const S = sentences.length;
    let syl = 0;
    let complex = 0; // 3+ syllables
    let letters = 0;
    for (const w of words) {
      const sc = syllables(w);
      syl += sc;
      if (sc >= 3) complex++;
      letters += w.replace(/[^A-Za-z]/g, '').length;
    }

    const wps = W / S; // words per sentence
    const spw = syl / W; // syllables per word

    const fleschEase = 206.835 - 1.015 * wps - 84.6 * spw;
    const fkGrade = 0.39 * wps + 11.8 * spw - 15.59;
    const fog = 0.4 * (wps + 100 * (complex / W));
    const smog = 1.043 * Math.sqrt(complex * (30 / S)) + 3.1291;
    const L = (letters / W) * 100; // letters per 100 words
    const Sn = (S / W) * 100; // sentences per 100 words
    const coleman = 0.0588 * L - 0.296 * Sn - 15.8;
    const ari = 4.71 * (letters / W) + 0.5 * wps - 21.43;

    const grades = [fkGrade, fog, smog, coleman, ari];
    const consensus = grades.reduce((a, b) => a + b, 0) / grades.length;

    const rows: { name: string; value: number; note: string }[] = [
      { name: 'Flesch Reading Ease', value: fleschEase, note: '0–100, higher = easier' },
      { name: 'Flesch-Kincaid Grade', value: fkGrade, note: 'US grade' },
      { name: 'Gunning Fog', value: fog, note: 'US grade' },
      { name: 'SMOG', value: smog, note: 'US grade' },
      { name: 'Coleman-Liau', value: coleman, note: 'US grade' },
      { name: 'Automated Readability (ARI)', value: ari, note: 'US grade' },
    ];

    return {
      rows,
      consensus: Math.max(0, consensus),
      readingAge: Math.max(0, consensus) + 5,
      W,
      S,
      syl,
      complex,
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
            placeholder="Paste prose to analyze…"
          />
        </div>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Readability report">
            <CopyButton
              value={() =>
                [
                  ...result.rows.map((r) => `${r.name}: ${r.value.toFixed(2)}`),
                  `Consensus grade: ${result.consensus.toFixed(1)}`,
                  `Reading age: ${result.readingAge.toFixed(1)}`,
                ].join('\n')
              }
            />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            <div className="rounded-md border bg-muted/30 px-3 py-3">
              <div className="text-2xs uppercase tracking-wide text-muted-foreground">
                Consensus US grade
              </div>
              <div className="font-mono text-2xl font-semibold">
                {result.consensus.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground">
                mean of 5 grade-producing formulas
              </div>
            </div>
            <div className="rounded-md border bg-muted/30 px-3 py-3">
              <div className="text-2xs uppercase tracking-wide text-muted-foreground">
                Estimated reading age
              </div>
              <div className="font-mono text-2xl font-semibold">
                {result.readingAge.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground">years (grade + 5)</div>
            </div>
          </div>
          <div className="px-3 pb-3">
            <div className="overflow-hidden rounded-md border">
              <div className="flex items-center bg-muted/40 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="flex-1">Formula</span>
                <span className="w-20 text-right">Score</span>
                <span className="w-44 text-right">Scale</span>
              </div>
              {result.rows.map((r) => (
                <div key={r.name} className="flex items-center border-t px-3 py-1.5 text-sm">
                  <span className="flex-1">{r.name}</span>
                  <span className="w-20 text-right font-mono">{r.value.toFixed(2)}</span>
                  <span className="w-44 text-right text-xs text-muted-foreground">{r.note}</span>
                </div>
              ))}
            </div>
          </div>
          <StatBar
            items={[
              `words = ${result.W}`,
              `sentences = ${result.S}`,
              `syllables = ${result.syl}`,
              `complex = ${result.complex}`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
