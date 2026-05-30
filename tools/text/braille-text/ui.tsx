'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'encode' | 'decode';

const SAMPLE = 'Hello World 123';

// Map a list of dot numbers (1-6) to the Unicode Braille code point.
function cellFromDots(dots: number[]): string {
  let bits = 0;
  for (const d of dots) {
    if (d >= 1 && d <= 6) bits |= 1 << (d - 1);
  }
  return String.fromCharCode(0x2800 + bits);
}

const NUMBER_SIGN = cellFromDots([3, 4, 5, 6]); // ⠼
const CAPITAL_SIGN = cellFromDots([6]); // ⠠

// Grade-1 letter dot patterns.
const LETTER_DOTS: Record<string, number[]> = {
  a: [1],
  b: [1, 2],
  c: [1, 4],
  d: [1, 4, 5],
  e: [1, 5],
  f: [1, 2, 4],
  g: [1, 2, 4, 5],
  h: [1, 2, 5],
  i: [2, 4],
  j: [2, 4, 5],
  k: [1, 3],
  l: [1, 2, 3],
  m: [1, 3, 4],
  n: [1, 3, 4, 5],
  o: [1, 3, 5],
  p: [1, 2, 3, 4],
  q: [1, 2, 3, 4, 5],
  r: [1, 2, 3, 5],
  s: [2, 3, 4],
  t: [2, 3, 4, 5],
  u: [1, 3, 6],
  v: [1, 2, 3, 6],
  w: [2, 4, 5, 6],
  x: [1, 3, 4, 6],
  y: [1, 3, 4, 5, 6],
  z: [1, 3, 5, 6],
};

// Digits reuse a-j patterns, preceded by the number sign.
const DIGIT_LETTER: Record<string, string> = {
  '1': 'a',
  '2': 'b',
  '3': 'c',
  '4': 'd',
  '5': 'e',
  '6': 'f',
  '7': 'g',
  '8': 'h',
  '9': 'i',
  '0': 'j',
};

// Common punctuation dot patterns.
const PUNCT_DOTS: Record<string, number[]> = {
  ',': [2],
  ';': [2, 3],
  ':': [2, 5],
  '.': [2, 5, 6],
  '?': [2, 3, 6],
  '!': [2, 3, 5],
  "'": [3],
  '-': [3, 6],
  '(': [1, 2, 6],
  ')': [3, 4, 5],
  '/': [3, 4],
};

const SPACE = cellFromDots([]); // ⠀ (blank braille cell)

// Build encode + decode tables.
const ENC_LETTER = new Map<string, string>();
for (const [letter, dots] of Object.entries(LETTER_DOTS)) {
  ENC_LETTER.set(letter, cellFromDots(dots));
}
const ENC_PUNCT = new Map<string, string>();
for (const [p, dots] of Object.entries(PUNCT_DOTS)) {
  ENC_PUNCT.set(p, cellFromDots(dots));
}
const DEC_CELL = new Map<string, string>(); // cell -> base letter (lowercase)
for (const [letter, dots] of Object.entries(LETTER_DOTS)) {
  DEC_CELL.set(cellFromDots(dots), letter);
}
const DEC_PUNCT = new Map<string, string>();
for (const [p, dots] of Object.entries(PUNCT_DOTS)) {
  DEC_PUNCT.set(cellFromDots(dots), p);
}
const LETTER_TO_DIGIT = new Map<string, string>();
for (const [digit, letter] of Object.entries(DIGIT_LETTER)) {
  LETTER_TO_DIGIT.set(letter, digit);
}

function dotNotation(cell: string): string {
  const code = cell.charCodeAt(0) - 0x2800;
  if (code === 0) return '0';
  const dots: number[] = [];
  for (let d = 1; d <= 6; d++) {
    if (code & (1 << (d - 1))) dots.push(d);
  }
  return dots.join('-');
}

export default function BrailleTool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [showDots, setShowDots] = useState(false);

  return (
    <TextToolLayout
      deps={[mode, showDots]}
      transform={(input) => {
        if (!input) return '';

        if (mode === 'encode') {
          const cells: string[] = [];
          for (const ch of input) {
            if (/[A-Z]/.test(ch)) {
              const cell = ENC_LETTER.get(ch.toLowerCase());
              if (cell) cells.push(CAPITAL_SIGN, cell);
              continue;
            }
            if (/[a-z]/.test(ch)) {
              const cell = ENC_LETTER.get(ch);
              if (cell) cells.push(cell);
              continue;
            }
            if (/[0-9]/.test(ch)) {
              const letter = DIGIT_LETTER[ch];
              const cell = letter ? ENC_LETTER.get(letter) : undefined;
              if (cell) cells.push(NUMBER_SIGN, cell);
              continue;
            }
            if (ch === ' ') {
              cells.push(SPACE);
              continue;
            }
            const punct = ENC_PUNCT.get(ch);
            if (punct) cells.push(punct);
            // Unknown characters are silently dropped.
          }
          const braille = cells.join('');
          if (!showDots) return braille;
          const notation = cells
            .map((c) => (c === SPACE ? '/' : dotNotation(c)))
            .join(' ');
          return `${braille}\n\n${notation}`;
        }

        // Decode mode.
        const out: string[] = [];
        let capitalNext = false;
        let numberMode = false;
        for (const ch of input) {
          if (ch === CAPITAL_SIGN) {
            capitalNext = true;
            continue;
          }
          if (ch === NUMBER_SIGN) {
            numberMode = true;
            continue;
          }
          if (ch === SPACE || ch === ' ') {
            out.push(' ');
            numberMode = false;
            continue;
          }
          const letter = DEC_CELL.get(ch);
          if (letter) {
            if (numberMode) {
              const digit = LETTER_TO_DIGIT.get(letter);
              out.push(digit ?? letter);
            } else {
              out.push(capitalNext ? letter.toUpperCase() : letter);
            }
            capitalNext = false;
            continue;
          }
          const punct = DEC_PUNCT.get(ch);
          if (punct) {
            out.push(punct);
            numberMode = false;
            continue;
          }
          // Pass through anything we don't recognise.
          if (ch.charCodeAt(0) >= 0x2800 && ch.charCodeAt(0) <= 0x28ff) {
            out.push('?');
          } else {
            out.push(ch);
          }
        }
        return out.join('');
      }}
      inputLabel={mode === 'encode' ? 'Text' : 'Braille'}
      outputLabel={mode === 'encode' ? 'Braille' : 'Text'}
      sample={SAMPLE}
      downloadName="braille.txt"
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="encode">Text → Braille</TabsTrigger>
                <TabsTrigger value="decode">Braille → Text</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === 'encode' && (
            <Field label="Show dot-number notation">
              <Switch checked={showDots} onCheckedChange={setShowDots} />
            </Field>
          )}
        </>
      }
    />
  );
}
