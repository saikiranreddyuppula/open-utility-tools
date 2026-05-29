'use client';

import { useCallback, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

const DEFAULT_STOP_WORDS =
  'a an and as at but by for in nor of on or so the to up yet via vs';

const SAMPLE =
  'the quick brown FOX jumps over a lazy dog by the river';

export default function TitleCaseTool() {
  const [stopWordsRaw, setStopWordsRaw] = useState(DEFAULT_STOP_WORDS);
  const [perLine, setPerLine] = useState(true);

  const stopSet = useMemo(() => {
    const set = new Set<string>();
    for (const w of stopWordsRaw.split(/[\s,]+/)) {
      const t = w.trim().toLowerCase();
      if (t) set.add(t);
    }
    return set;
  }, [stopWordsRaw]);

  const capitalize = useCallback((word: string) => {
    // Capitalize the first alphabetic character, preserve the rest lowercased.
    // Handles leading punctuation like quotes/brackets.
    let i = 0;
    while (i < word.length && !/[\p{L}\p{N}]/u.test(word[i] ?? '')) i++;
    if (i >= word.length) return word;
    const head = word.slice(0, i);
    const first = word[i] ?? '';
    const rest = word.slice(i + 1);
    return head + first.toUpperCase() + rest;
  }, []);

  const titleLine = useCallback(
    (line: string) => {
      // Split on spaces but keep the runs of whitespace so they round-trip.
      const tokens = line.split(/(\s+)/);
      // Identify indices of actual words (non-whitespace tokens).
      const wordIdx: number[] = [];
      tokens.forEach((tok, idx) => {
        if (tok.length > 0 && !/^\s+$/.test(tok)) wordIdx.push(idx);
      });
      const firstWord = wordIdx[0];
      const lastWord = wordIdx[wordIdx.length - 1];

      return tokens
        .map((tok, idx) => {
          if (tok.length === 0 || /^\s+$/.test(tok)) return tok;
          const lower = tok.toLowerCase();
          const isEdge = idx === firstWord || idx === lastWord;
          // Compare against the stop list using the alphanumeric core only.
          const core = lower.replace(/[^\p{L}\p{N}]/gu, '');
          if (!isEdge && stopSet.has(core)) return lower;
          return capitalize(lower);
        })
        .join('');
    },
    [stopSet, capitalize]
  );

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      if (!perLine) return titleLine(input.replace(/\r\n?/g, '\n'));
      return input
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((line) => titleLine(line))
        .join('\n');
    },
    [perLine, titleLine]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[stopWordsRaw, perLine]}
      inputLabel="Text"
      outputLabel="Title Case"
      inputPlaceholder="Enter a headline or title…"
      sample={SAMPLE}
      downloadName="title-case.txt"
      options={
        <div className="flex flex-col gap-4">
          <Field
            label="Lowercase small words"
            hint="Space- or comma-separated. First and last words are always capitalized."
          >
            <Input
              value={stopWordsRaw}
              onChange={(e) => setStopWordsRaw(e.target.value)}
              placeholder={DEFAULT_STOP_WORDS}
            />
          </Field>
          <Field label="Treat each line as its own title">
            <div className="flex items-center gap-2">
              <Switch
                id="tc-perline"
                checked={perLine}
                onCheckedChange={setPerLine}
              />
              <Label htmlFor="tc-perline">
                Capitalize first/last word per line
              </Label>
            </div>
          </Field>
        </div>
      }
    />
  );
}
