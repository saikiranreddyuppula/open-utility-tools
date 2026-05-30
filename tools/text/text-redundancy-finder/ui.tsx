'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const SAMPLE =
  'At the end of the day, we need to think outside the box. At the end of the day, results matter. ' +
  'In order to succeed, in order to grow, the team must think outside the box and at the end of the ' +
  'day commit to the plan. Due to the fact that deadlines are tight, due to the fact that budgets ' +
  'are small, we must focus.';

const MAX_PHRASE_LEN = 6;
const MAX_WORDS = 20000;

const STOP_WORDS = new Set<string>([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for', 'is', 'are', 'was',
  'were', 'be', 'by', 'with', 'as', 'it', 'that', 'this', 'we', 'you', 'i', 'he', 'she', 'they',
]);

interface Phrase {
  phrase: string;
  count: number;
  words: number;
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+(?:['’][a-z0-9]+)?/g) ?? []).slice(0, MAX_WORDS);
}

export default function RepeatedPhraseFinder() {
  const [text, setText] = useState(SAMPLE);
  const [minLen, setMinLen] = useState('2');
  const [minCount, setMinCount] = useState('2');
  const [dropStop, setDropStop] = useState(false);

  const result = useMemo(() => {
    const tokens = tokenize(text);
    if (tokens.length === 0) return { error: 'Enter some text to scan for repetition.' };

    const lo = Math.max(1, Math.min(Math.trunc(Number(minLen) || 2), MAX_PHRASE_LEN));
    const minOcc = Math.max(2, Math.trunc(Number(minCount) || 2));

    // Count every contiguous window from lo..MAX_PHRASE_LEN words.
    const counts = new Map<string, number>();
    for (let len = lo; len <= MAX_PHRASE_LEN; len++) {
      for (let i = 0; i + len <= tokens.length; i++) {
        const slice = tokens.slice(i, i + len);
        if (dropStop) {
          const first = slice[0] ?? '';
          const last = slice[len - 1] ?? '';
          if (STOP_WORDS.has(first) || STOP_WORDS.has(last)) continue;
        }
        const key = slice.join(' ');
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    // Keep repeated phrases.
    const repeated: Phrase[] = [];
    for (const [phrase, count] of counts) {
      if (count >= minOcc) {
        repeated.push({ phrase, count, words: phrase.split(' ').length });
      }
    }

    // Drop a shorter phrase if it is contained in a longer repeated phrase with the same count
    // (it is not "maximal" — the longer one explains all its occurrences).
    const byLenDesc = [...repeated].sort((a, b) => b.words - a.words);
    const maximal: Phrase[] = [];
    for (const p of byLenDesc) {
      const subsumed = maximal.some(
        (m) => m.count === p.count && m.words > p.words && (` ${m.phrase} `).includes(` ${p.phrase} `)
      );
      if (!subsumed) maximal.push(p);
    }

    maximal.sort((a, b) => b.count - a.count || b.words - a.words || a.phrase.localeCompare(b.phrase));

    return { phrases: maximal, totalWords: tokens.length, scanned: counts.size, lo, minOcc };
  }, [text, minLen, minCount, dropStop]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Text" />
        <div className="p-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            rows={6}
            placeholder="Paste text to find repeated phrases…"
          />
        </div>
        <OptionsBar className="rounded-none border-x-0 border-b-0">
          <Field label="Min phrase length (words)">
            <Input
              value={minLen}
              onChange={(e) => setMinLen(e.target.value)}
              inputMode="numeric"
              className="w-24 font-mono"
            />
          </Field>
          <Field label="Min occurrences">
            <Input
              value={minCount}
              onChange={(e) => setMinCount(e.target.value)}
              inputMode="numeric"
              className="w-24 font-mono"
            />
          </Field>
          <Field label="Skip stop words">
            <div className="flex h-8 items-center gap-2">
              <Switch id="ds" checked={dropStop} onCheckedChange={setDropStop} />
              <Label htmlFor="ds" className="text-xs text-muted-foreground">
                Ignore the/and/of…
              </Label>
            </div>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title={`Repeated phrases (${result.phrases.length})`}>
            <CopyButton
              value={() =>
                result.phrases.map((p) => `${p.count}×  ${p.phrase}`).join('\n')
              }
            />
          </PanelHeader>
          {result.phrases.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              No phrases of {result.lo}+ words repeat at least {result.minOcc} times.
            </div>
          ) : (
            <div className="max-h-[420px] overflow-auto">
              <div className="flex items-center border-b bg-muted/40 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="w-16 shrink-0">Count</span>
                <span className="w-16 shrink-0">Words</span>
                <span className="min-w-0 flex-1">Phrase</span>
              </div>
              {result.phrases.map((p, i) => (
                <div
                  key={`${p.phrase}-${i}`}
                  className="flex items-center gap-1 border-b px-3 py-1.5 text-sm last:border-b-0"
                >
                  <span className="w-16 shrink-0 font-mono font-semibold">{p.count}×</span>
                  <span className="w-16 shrink-0 font-mono text-muted-foreground">{p.words}</span>
                  <span className="min-w-0 flex-1 truncate">{p.phrase}</span>
                  <CopyButton value={p.phrase} size="icon-sm" />
                </div>
              ))}
            </div>
          )}
          <StatBar
            items={[
              `phrases = ${result.phrases.length}`,
              `words = ${result.totalWords}`,
              `windows scanned = ${result.scanned}`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
