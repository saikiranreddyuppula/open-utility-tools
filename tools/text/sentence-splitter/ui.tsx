'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { TextToolLayout } from '@/components/tools/text-tool';

// Abbreviations whose trailing period should NOT end a sentence.
const ABBREVIATIONS = new Set<string>([
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'sr',
  'jr',
  'st',
  'vs',
  'etc',
  'inc',
  'ltd',
  'co',
  'corp',
  'no',
  'fig',
  'al',
  'eg',
  'ie',
  'approx',
  'dept',
  'est',
  'gen',
  'gov',
  'col',
  'capt',
  'sgt',
]);

function isAbbreviationBefore(text: string, dotIndex: number): boolean {
  // Walk back over letters/dots to capture the token ending at this period.
  let i = dotIndex - 1;
  let word = '';
  while (i >= 0) {
    const ch = text[i] ?? '';
    if (/[A-Za-z]/.test(ch)) {
      word = ch + word;
      i -= 1;
    } else {
      break;
    }
  }
  if (word.length === 0) return false;
  // Single uppercase letter (initial like "U.S." or "J. Smith").
  if (word.length === 1 && word === word.toUpperCase()) return true;
  return ABBREVIATIONS.has(word.toLowerCase());
}

function splitSentences(input: string): string[] {
  const text = input.replace(/\s+/g, ' ').trim();
  if (!text) return [];

  const sentences: string[] = [];
  let start = 0;
  const len = text.length;

  for (let i = 0; i < len; i += 1) {
    const ch = text[i] ?? '';
    const isTerminal = ch === '.' || ch === '!' || ch === '?' || ch === '…';
    if (!isTerminal) continue;

    // Treat a run of terminal punctuation (e.g. "?!" or "...") as one ender.
    let end = i;
    while (
      end + 1 < len &&
      ((): boolean => {
        const n = text[end + 1] ?? '';
        return n === '.' || n === '!' || n === '?' || n === '…';
      })()
    ) {
      end += 1;
    }

    const next = text[end + 1];

    // End of text → close the sentence.
    if (next === undefined) {
      sentences.push(text.slice(start, end + 1).trim());
      start = end + 1;
      break;
    }

    // Must be followed by whitespace to be a candidate boundary.
    if (next !== ' ') {
      i = end;
      continue;
    }

    // For a single period, guard decimals and abbreviations.
    if (ch === '.' && end === i) {
      const prev = text[i - 1] ?? '';
      const after = text[i + 2] ?? '';
      // Decimal number like "3.14" — digit before AND after the dot.
      if (/[0-9]/.test(prev) && /[0-9]/.test(after)) {
        continue;
      }
      if (isAbbreviationBefore(text, i)) {
        continue;
      }
    }

    // The character starting the next sentence should be uppercase, a digit,
    // or an opening quote/bracket — otherwise keep going.
    const startsNext = text[end + 2] ?? '';
    const startsSentence =
      startsNext === '' ||
      /[A-Z0-9"'“‘(\[]/.test(startsNext) ||
      startsNext === startsNext.toLocaleUpperCase();

    if (!startsSentence) {
      i = end;
      continue;
    }

    sentences.push(text.slice(start, end + 1).trim());
    start = end + 2; // skip the single space
    i = end + 1;
  }

  if (start < len) {
    const tail = text.slice(start).trim();
    if (tail) sentences.push(tail);
  }

  return sentences.filter((s) => s.length > 0);
}

export default function SentenceSplitterTool() {
  const [numbered, setNumbered] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const sentences = splitSentences(input);
      const body = numbered
        ? sentences.map((s, i) => `${i + 1}. ${s}`).join('\n')
        : sentences.join('\n');
      const count = sentences.length;
      return `${body}\n\n— ${count} sentence${count === 1 ? '' : 's'}`;
    },
    [numbered],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[numbered]}
      inputLabel="Paragraph"
      outputLabel="Sentences"
      inputPlaceholder="Paste prose here…"
      sample={
        'Dr. Smith arrived at 3.14 p.m. He said hello to the U.S. delegation, e.g. the ambassador. Was it worth it?! Yes, it certainly was.'
      }
      downloadName="sentences.txt"
      options={
        <Field label="Number sentences" hint="Prefix each line with 1. 2. 3. …">
          <Switch checked={numbered} onCheckedChange={setNumbered} />
        </Field>
      }
    />
  );
}
