'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

type Case = 'lower' | 'upper' | 'title' | 'mixed';

function detectCase(word: string): Case {
  if (word === word.toLowerCase()) return 'lower';
  if (word === word.toUpperCase()) return 'upper';
  const first = word[0] ?? '';
  const rest = word.slice(1);
  if (first === first.toUpperCase() && rest === rest.toLowerCase()) return 'title';
  return 'mixed';
}

function applyCase(word: string, kind: Case): string {
  switch (kind) {
    case 'lower':
      return word.toLowerCase();
    case 'upper':
      return word.toUpperCase();
    case 'title': {
      const lower = word.toLowerCase();
      const first = lower[0] ?? '';
      return first.toUpperCase() + lower.slice(1);
    }
    case 'mixed':
    default:
      return word;
  }
}

function encodeWord(word: string): string {
  const lower = word.toLowerCase();
  const firstVowel = lower.split('').findIndex((c) => VOWELS.has(c));

  let result: string;
  if (firstVowel === 0) {
    // Starts with a vowel: just append "way".
    result = `${lower}way`;
  } else if (firstVowel === -1) {
    // No vowels at all: append "ay".
    result = `${lower}ay`;
  } else {
    const cluster = lower.slice(0, firstVowel);
    const rest = lower.slice(firstVowel);
    result = `${rest}${cluster}ay`;
  }

  return applyCase(result, detectCase(word));
}

function decodeWord(word: string): string {
  const lower = word.toLowerCase();
  let result: string;

  if (lower.endsWith('way') && lower.length > 3) {
    // Vowel-initial word encoded with "way".
    result = lower.slice(0, -3);
  } else if (lower.endsWith('ay') && lower.length > 2) {
    const core = lower.slice(0, -2);
    // The trailing consonant cluster was moved to the end; move it back.
    const firstVowel = core.split('').findIndex((c) => VOWELS.has(c));
    if (firstVowel === -1) {
      // Whole thing is consonants (no vowels) -> originally appended "ay".
      result = core;
    } else {
      // Move the trailing run of consonants back to the front.
      let cut = core.length;
      while (cut > 0 && !VOWELS.has(core[cut - 1] ?? '')) {
        cut -= 1;
      }
      const cluster = core.slice(cut);
      const head = core.slice(0, cut);
      result = `${cluster}${head}`;
    }
  } else {
    result = lower;
  }

  return applyCase(result, detectCase(word));
}

function translate(text: string, mode: 'encode' | 'decode'): string {
  // Process letter-runs as words, leaving everything else (spaces, punctuation) intact.
  return text.replace(/[A-Za-z]+/g, (word) =>
    mode === 'encode' ? encodeWord(word) : decodeWord(word),
  );
}

export default function PigLatinTool() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      return translate(input, mode);
    },
    [mode],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode]}
      inputLabel={mode === 'encode' ? 'English' : 'Pig Latin'}
      outputLabel={mode === 'encode' ? 'Pig Latin' : 'English'}
      inputPlaceholder={
        mode === 'encode' ? 'Type English text...' : 'Type Pig Latin to translate back...'
      }
      sample={mode === 'encode' ? 'Hello world, this is fun!' : 'Ellohay orldway, isthay isway unfay!'}
      downloadName="pig-latin.txt"
      options={
        <Field label="Direction">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'encode' | 'decode')}>
            <TabsList>
              <TabsTrigger value="encode">To Pig Latin</TabsTrigger>
              <TabsTrigger value="decode">From Pig Latin</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
