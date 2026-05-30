'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Alphabet = 'elder' | 'younger';
type Direction = 'encode' | 'decode';

// Single-letter base maps (lowercase Latin -> rune).
const ELDER: Record<string, string> = {
  f: 'ᚠ',
  u: 'ᚢ',
  th: 'ᚦ',
  a: 'ᚨ',
  r: 'ᚱ',
  k: 'ᚲ',
  c: 'ᚲ',
  g: 'ᚷ',
  w: 'ᚹ',
  v: 'ᚹ',
  h: 'ᚺ',
  n: 'ᚾ',
  i: 'ᛁ',
  j: 'ᛃ',
  y: 'ᛃ',
  e: 'ᛖ',
  p: 'ᛈ',
  z: 'ᛉ',
  s: 'ᛋ',
  t: 'ᛏ',
  b: 'ᛒ',
  m: 'ᛗ',
  l: 'ᛚ',
  o: 'ᛟ',
  d: 'ᛞ',
  ng: 'ᛜ',
};

const YOUNGER: Record<string, string> = {
  f: 'ᚠ',
  u: 'ᚢ',
  v: 'ᚢ',
  w: 'ᚢ',
  th: 'ᚦ',
  a: 'ᛅ',
  o: 'ᚬ',
  r: 'ᚱ',
  k: 'ᚴ',
  c: 'ᚴ',
  g: 'ᚴ',
  h: 'ᚼ',
  n: 'ᚾ',
  i: 'ᛁ',
  e: 'ᛁ',
  j: 'ᛁ',
  y: 'ᛁ',
  s: 'ᛋ',
  z: 'ᛋ',
  t: 'ᛏ',
  d: 'ᛏ',
  b: 'ᛒ',
  p: 'ᛒ',
  m: 'ᛘ',
  l: 'ᛚ',
};

// Multi-letter digraphs handled before single letters.
const DIGRAPHS: Record<Alphabet, string[]> = {
  elder: ['th', 'ng'],
  younger: ['th'],
};

const SAMPLE = 'Hello world, this is the king of the north';

function buildDecodeMap(map: Record<string, string>): Map<string, string> {
  // Rune -> first Latin key that produced it (deterministic, prefer single letters).
  const out = new Map<string, string>();
  const keys = Object.keys(map).sort((a, b) => a.length - b.length);
  for (const k of keys) {
    const rune = map[k];
    if (rune !== undefined && !out.has(rune)) out.set(rune, k);
  }
  return out;
}

function encode(text: string, alphabet: Alphabet): string {
  const map = alphabet === 'elder' ? ELDER : YOUNGER;
  const digraphs = DIGRAPHS[alphabet];
  const lower = text.toLowerCase();
  const chars = [...lower];
  let out = '';
  let i = 0;
  while (i < chars.length) {
    // Try a two-letter digraph first.
    let matched = false;
    if (i + 1 < chars.length) {
      const pair = (chars[i] ?? '') + (chars[i + 1] ?? '');
      if (digraphs.includes(pair)) {
        const rune = map[pair];
        if (rune !== undefined) {
          out += rune;
          i += 2;
          matched = true;
        }
      }
    }
    if (matched) continue;
    const ch = chars[i] ?? '';
    const rune = map[ch];
    out += rune !== undefined ? rune : ch;
    i += 1;
  }
  return out;
}

function decode(text: string, alphabet: Alphabet): string {
  const map = alphabet === 'elder' ? ELDER : YOUNGER;
  const decodeMap = buildDecodeMap(map);
  const chars = [...text];
  let out = '';
  for (const ch of chars) {
    const latin = decodeMap.get(ch);
    out += latin !== undefined ? latin : ch;
  }
  return out;
}

export default function RunicTransliteratorTool() {
  const [alphabet, setAlphabet] = useState<Alphabet>('elder');
  const [direction, setDirection] = useState<Direction>('encode');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      return direction === 'encode' ? encode(input, alphabet) : decode(input, alphabet);
    },
    [alphabet, direction]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[alphabet, direction]}
      inputLabel={direction === 'encode' ? 'Latin text' : 'Runic text'}
      outputLabel={direction === 'encode' ? 'Runes' : 'Latin text'}
      sample={SAMPLE}
      downloadName="runes.txt"
      options={
        <>
          <Field label="Direction">
            <Tabs value={direction} onValueChange={(v) => setDirection(v as Direction)}>
              <TabsList>
                <TabsTrigger value="encode">Latin → Runes</TabsTrigger>
                <TabsTrigger value="decode">Runes → Latin</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Alphabet">
            <Select value={alphabet} onValueChange={(v) => setAlphabet(v as Alphabet)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="elder">Elder Futhark (24)</SelectItem>
                <SelectItem value="younger">Younger Futhark (16)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      }
    />
  );
}
