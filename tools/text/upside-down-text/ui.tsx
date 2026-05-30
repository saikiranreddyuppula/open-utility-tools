'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'upside-down' | 'mirror';

// Look-alike glyphs for a 180° rotation.
const FLIP: Record<string, string> = {
  a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ᴉ',
  j: 'ɾ', k: 'ʞ', l: 'l', m: 'ɯ', n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ',
  s: 's', t: 'ʇ', u: 'n', v: 'ʌ', w: 'ʍ', x: 'x', y: 'ʎ', z: 'z',
  A: '∀', B: 'ꓭ', C: 'Ɔ', D: 'ꓷ', E: 'Ǝ', F: 'Ⅎ', G: 'פ', H: 'H', I: 'I',
  J: 'ſ', K: 'ꓘ', L: 'ꓶ', M: 'W', N: 'N', O: 'O', P: 'Ԁ', Q: 'Q', R: 'ꓤ',
  S: 'S', T: 'ꓕ', U: 'ꓵ', V: 'ꓥ', W: 'M', X: 'X', Y: '⅄', Z: 'Z',
  '0': '0', '1': 'Ɩ', '2': 'ᄅ', '3': 'Ɛ', '4': 'ㄣ', '5': 'ϛ', '6': '9',
  '7': 'ㄥ', '8': '8', '9': '6',
  '.': '˙', ',': "'", "'": ',', '"': '„', '`': ',', '?': '¿', '!': '¡',
  '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>',
  '>': '<', '&': '⅋', '_': '‾', '‾': '_', '∴': '∵', ';': '؛',
};

// Mirror look-alikes (horizontal flip, no vertical change).
const MIRROR: Record<string, string> = {
  b: 'd', d: 'b', p: 'q', q: 'p', c: 'ɔ', e: 'ɘ', s: 'ƨ', z: 'ƹ',
  B: 'ᗺ', C: 'Ɔ', D: 'ᗡ', E: 'Ǝ', J: 'Ⴑ', L: '⅃', P: 'ꟼ', R: 'Я',
  S: 'Ƨ', Z: 'Ƹ', '3': 'Ɛ', '1': '1', '2': 'S',
  '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>',
  '>': '<', '/': '\\', '\\': '/',
};

function buildReverse(map: Record<string, string>): Record<string, string> {
  const rev: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) {
    if (rev[v] === undefined) rev[v] = k;
  }
  return rev;
}

const FLIP_ALL: Record<string, string> = { ...FLIP, ...buildReverse(FLIP) };

function mapChar(ch: string, mode: Mode): string {
  if (mode === 'upside-down') return FLIP_ALL[ch] ?? ch;
  return MIRROR[ch] ?? ch;
}

export default function UpsideDownTextTool() {
  const [mode, setMode] = useState<Mode>('upside-down');
  const [reverseLines, setReverseLines] = useState(false);

  const transform = useCallback(
    (input: string): string => {
      if (!input) return '';

      const lines = input.split('\n');
      const outLines = lines.map((line) => {
        const chars = Array.from(line).map((c) => mapChar(c, mode));
        // Both modes reverse left-right order: a 180° rotation flips order,
        // and a horizontal mirror also reverses the reading order.
        chars.reverse();
        return chars.join('');
      });

      if (reverseLines) outLines.reverse();
      return outLines.join('\n');
    },
    [mode, reverseLines]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, reverseLines]}
      inputLabel="Text"
      outputLabel="Transformed"
      sample={'Hello, World!\nFlip this text 180 degrees.'}
      downloadName="flipped.txt"
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="upside-down">Upside-down</TabsTrigger>
                <TabsTrigger value="mirror">Mirror</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Also reverse line order">
            <div className="flex h-8 items-center">
              <Switch checked={reverseLines} onCheckedChange={setReverseLines} />
            </div>
          </Field>
        </>
      }
    />
  );
}
