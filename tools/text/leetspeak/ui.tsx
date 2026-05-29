'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'encode' | 'decode';
type Level = 'basic' | 'medium' | 'advanced';

// Each level builds on the previous one. For a given letter the FIRST listed
// substitution is the one used when encoding.
const BASIC: Record<string, string[]> = {
  a: ['4'],
  e: ['3'],
  i: ['1'],
  o: ['0'],
  t: ['7'],
};

const MEDIUM: Record<string, string[]> = {
  ...BASIC,
  s: ['5'],
  b: ['8'],
  g: ['9'],
  l: ['1'],
  z: ['2'],
};

const ADVANCED: Record<string, string[]> = {
  ...MEDIUM,
  c: ['('],
  d: ['|)'],
  h: ['#'],
  k: ['|<'],
  m: ['/\\/\\'],
  n: ['|\\|'],
  r: ['|2'],
  u: ['|_|'],
  v: ['\\/'],
  w: ['\\/\\/'],
  x: ['><'],
  y: ['`/'],
};

function tableFor(level: Level): Record<string, string[]> {
  if (level === 'basic') return BASIC;
  if (level === 'medium') return MEDIUM;
  return ADVANCED;
}

function encode(input: string, level: Level): string {
  const table = tableFor(level);
  let out = '';
  for (const ch of input) {
    const lower = ch.toLowerCase();
    const subs = table[lower];
    const replacement = subs?.[0];
    out += replacement !== undefined ? replacement : ch;
  }
  return out;
}

// Build decode pairs, longest-first so multi-character leet sequences
// (e.g. "/\/\" for m) are matched before single characters.
function decodePairs(level: Level): Array<[string, string]> {
  const table = tableFor(level);
  const pairs: Array<[string, string]> = [];
  for (const [letter, subs] of Object.entries(table)) {
    for (const sub of subs) {
      pairs.push([sub, letter]);
    }
  }
  pairs.sort((a, b) => b[0].length - a[0].length);
  return pairs;
}

function decode(input: string, level: Level): string {
  const pairs = decodePairs(level);
  let out = '';
  let i = 0;
  while (i < input.length) {
    let matched = false;
    for (const [token, letter] of pairs) {
      if (token.length > 0 && input.startsWith(token, i)) {
        out += letter;
        i += token.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      out += input[i] ?? '';
      i += 1;
    }
  }
  return out;
}

export default function LeetspeakTool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [level, setLevel] = useState<Level>('medium');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      return mode === 'encode' ? encode(input, level) : decode(input, level);
    },
    [mode, level],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, level]}
      inputLabel="Text"
      outputLabel={mode === 'encode' ? 'Leetspeak' : 'Plain text'}
      inputPlaceholder={mode === 'encode' ? 'elite hacker text' : '3l1t3 h4ck3r 73x7'}
      sample={mode === 'encode' ? 'elite hacker text' : '3l1t3 h4ck3r 73x7'}
      downloadName="leetspeak.txt"
      options={
        <>
          <Field label="Direction">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="encode">To leet</TabsTrigger>
                <TabsTrigger value="decode">To plain</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Intensity" hint="Higher levels substitute more letters">
            <Tabs value={level} onValueChange={(v) => setLevel(v as Level)}>
              <TabsList>
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="medium">Medium</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </>
      }
    />
  );
}
