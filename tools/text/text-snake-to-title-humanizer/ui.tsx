'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Checkbox } from '@/components/ui/checkbox';

const SAMPLE = `firstName
user_id
--max-count
HTTPStatusCode
getURLFromAPI
total_amount_of_money
parseHTML5Document`;

const SMALL_WORDS: ReadonlySet<string> = new Set<string>([
  'a',
  'an',
  'and',
  'as',
  'at',
  'but',
  'by',
  'for',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);

// Split an identifier into words across underscores, hyphens, spaces, and
// camelCase / acronym boundaries.
function splitWords(id: string): string[] {
  const cleaned = id.trim().replace(/^[-_\s]+|[-_\s]+$/gu, '');
  if (cleaned === '') return [];
  const spaced = cleaned
    .replace(/[_\-\s]+/gu, ' ')
    // boundary between a lowercase/digit and an uppercase: fooBar -> foo Bar
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    // boundary inside an acronym followed by a word: HTMLParser -> HTML Parser
    .replace(/([A-Z]+)([A-Z][a-z])/gu, '$1 $2')
    // boundary between letters and digits: html5 -> html 5
    .replace(/([A-Za-z])([0-9])/gu, '$1 $2')
    .replace(/([0-9])([A-Za-z])/gu, '$1 $2');
  return spaced.split(/\s+/u).filter((w) => w.length > 0);
}

export default function IdentifierHumanizer() {
  const [keepAcronyms, setKeepAcronyms] = useState(true);
  const [lowerSmallWords, setLowerSmallWords] = useState(true);

  const transform = useCallback(
    (input: string): string => {
      if (!input) return '';
      const lines = input.split(/\r\n?|\n/u);

      const humanizeWord = (word: string, index: number): string => {
        const isAllCaps = word.length > 1 && word === word.toUpperCase() && /[A-Z]/u.test(word);
        if (keepAcronyms && isAllCaps) return word;

        const lower = word.toLowerCase();
        if (lowerSmallWords && index > 0 && SMALL_WORDS.has(lower)) {
          return lower;
        }
        const first = lower.charAt(0).toUpperCase();
        return first + lower.slice(1);
      };

      return lines
        .map((line) => {
          const words = splitWords(line);
          if (words.length === 0) return line.trim() === '' ? '' : line;
          return words.map((w, i) => humanizeWord(w, i)).join(' ');
        })
        .join('\n');
    },
    [keepAcronyms, lowerSmallWords]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[keepAcronyms, lowerSmallWords]}
      inputLabel="Identifiers (one per line)"
      outputLabel="Humanized labels"
      sample={SAMPLE}
      downloadName="humanized.txt"
      options={
        <Field label="Options">
          <div className="flex h-8 items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs">
              <Checkbox
                checked={keepAcronyms}
                onCheckedChange={(v) => setKeepAcronyms(v === true)}
              />
              Keep acronyms uppercase
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <Checkbox
                checked={lowerSmallWords}
                onCheckedChange={(v) => setLowerSmallWords(v === true)}
              />
              Lowercase small words
            </label>
          </div>
        </Field>
      }
    />
  );
}
