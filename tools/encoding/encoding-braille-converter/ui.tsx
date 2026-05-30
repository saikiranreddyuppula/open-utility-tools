'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'encode' | 'decode';
type OutStyle = 'unicode' | 'dots';

// Each entry is a list of raised dot numbers (1..6). The Unicode Braille
// pattern lives at U+2800 + sum(1<<(dot-1)).
const LETTERS: Record<string, number[]> = {
  a: [1], b: [1, 2], c: [1, 4], d: [1, 4, 5], e: [1, 5], f: [1, 2, 4],
  g: [1, 2, 4, 5], h: [1, 2, 5], i: [2, 4], j: [2, 4, 5], k: [1, 3], l: [1, 2, 3],
  m: [1, 3, 4], n: [1, 3, 4, 5], o: [1, 3, 5], p: [1, 2, 3, 4], q: [1, 2, 3, 4, 5],
  r: [1, 2, 3, 5], s: [2, 3, 4], t: [2, 3, 4, 5], u: [1, 3, 6], v: [1, 2, 3, 6],
  w: [2, 4, 5, 6], x: [1, 3, 4, 6], y: [1, 3, 4, 5, 6], z: [1, 3, 5, 6],
};

// Digits 1..0 reuse the patterns for letters a..j after a number sign.
const DIGIT_LETTER: Record<string, string> = {
  '1': 'a', '2': 'b', '3': 'c', '4': 'd', '5': 'e',
  '6': 'f', '7': 'g', '8': 'h', '9': 'i', '0': 'j',
};

const PUNCT: Record<string, number[]> = {
  ',': [2], ';': [2, 3], ':': [2, 5], '.': [2, 5, 6], '?': [2, 3, 6], '!': [2, 3, 5],
  "'": [3], '-': [3, 6], '(': [2, 3, 6], ')': [3, 5, 6], '/': [3, 4],
};

const NUMBER_SIGN = 0x283c; // ⠼  dots 3-4-5-6
const CAPITAL_SIGN = 0x2820; // ⠠  dot 6

function dotsToChar(dots: number[]): string {
  let mask = 0;
  for (const d of dots) mask |= 1 << (d - 1);
  return String.fromCharCode(0x2800 + mask);
}

function charToDots(ch: string): number[] | null {
  const code = ch.charCodeAt(0);
  if (code < 0x2800 || code > 0x28ff) return null;
  const mask = code - 0x2800;
  const dots: number[] = [];
  for (let i = 0; i < 6; i += 1) if (mask & (1 << i)) dots.push(i + 1);
  return dots;
}

function dotLabel(ch: string): string {
  const dots = charToDots(ch);
  if (!dots) return '?';
  return dots.length ? dots.join('-') : '·';
}

function encode(input: string, indicators: boolean, style: OutStyle): string {
  let out = '';
  let inNumber = false;
  const emit = (cp: number) => {
    out += style === 'unicode' ? String.fromCharCode(cp) : `[${dotLabel(String.fromCharCode(cp))}]`;
  };
  for (const raw of input) {
    if (raw === '\n') {
      out += '\n';
      inNumber = false;
      continue;
    }
    const lower = raw.toLowerCase();
    if (DIGIT_LETTER[raw] !== undefined) {
      if (indicators && !inNumber) {
        emit(NUMBER_SIGN);
        inNumber = true;
      }
      const dl = DIGIT_LETTER[raw];
      const dots = dl !== undefined ? LETTERS[dl] : undefined;
      if (dots) emit(0x2800 + dots.reduce((m, d) => m | (1 << (d - 1)), 0));
      continue;
    }
    inNumber = false;
    if (lower >= 'a' && lower <= 'z') {
      if (indicators && raw >= 'A' && raw <= 'Z') emit(CAPITAL_SIGN);
      const dots = LETTERS[lower];
      if (dots) emit(0x2800 + dots.reduce((m, d) => m | (1 << (d - 1)), 0));
      continue;
    }
    if (raw === ' ') {
      out += style === 'unicode' ? '⠀' : '[ ]';
      continue;
    }
    const p = PUNCT[raw];
    if (p) {
      emit(0x2800 + p.reduce((m, d) => m | (1 << (d - 1)), 0));
      continue;
    }
    // Unsupported character: pass through with a marker.
    out += style === 'unicode' ? `�${raw}` : `[?${raw}]`;
  }
  return out;
}

const REV_LETTER: Record<number, string> = (() => {
  const m: Record<number, string> = {};
  for (const [ch, dots] of Object.entries(LETTERS)) {
    m[dots.reduce((acc, d) => acc | (1 << (d - 1)), 0)] = ch;
  }
  return m;
})();
const REV_PUNCT: Record<number, string> = (() => {
  const m: Record<number, string> = {};
  for (const [ch, dots] of Object.entries(PUNCT)) {
    const mask = dots.reduce((acc, d) => acc | (1 << (d - 1)), 0);
    if (m[mask] === undefined) m[mask] = ch;
  }
  return m;
})();
const LETTER_TO_DIGIT: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [digit, letter] of Object.entries(DIGIT_LETTER)) m[letter] = digit;
  return m;
})();

function decode(input: string): string {
  let out = '';
  let capNext = false;
  let inNumber = false;
  for (const ch of input) {
    const code = ch.charCodeAt(0);
    if (code === CAPITAL_SIGN) {
      capNext = true;
      continue;
    }
    if (code === NUMBER_SIGN) {
      inNumber = true;
      continue;
    }
    if (code < 0x2800 || code > 0x28ff) {
      // Non-Braille (newline, stray char): emit verbatim, reset state.
      out += ch;
      capNext = false;
      inNumber = false;
      continue;
    }
    const mask = code - 0x2800;
    if (mask === 0) {
      out += ' ';
      inNumber = false;
      continue;
    }
    const letter = REV_LETTER[mask];
    if (letter !== undefined) {
      if (inNumber && LETTER_TO_DIGIT[letter] !== undefined) {
        out += LETTER_TO_DIGIT[letter] ?? letter;
      } else {
        inNumber = false;
        out += capNext ? letter.toUpperCase() : letter;
      }
      capNext = false;
      continue;
    }
    const punct = REV_PUNCT[mask];
    if (punct !== undefined) {
      out += punct;
      capNext = false;
      inNumber = false;
      continue;
    }
    out += '�';
    capNext = false;
  }
  return out;
}

export default function BrailleConverterTool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [indicators, setIndicators] = useState(true);
  const [style, setStyle] = useState<OutStyle>('unicode');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      return mode === 'encode' ? encode(input, indicators, style) : decode(input);
    },
    [mode, indicators, style],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, indicators, style]}
      inputLabel={mode === 'encode' ? 'Text' : 'Braille'}
      outputLabel={mode === 'encode' ? 'Braille' : 'Text'}
      inputPlaceholder={mode === 'encode' ? 'Hello World 42' : 'Paste Unicode Braille…'}
      sample={mode === 'encode' ? 'Hello World 42!' : '⠠⠓⠑⠇⠇⠕⠀⠠⠺⠕⠗⠇⠙'}
      downloadName="braille.txt"
      mono={false}
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
            <>
              <Field label="Output">
                <Tabs value={style} onValueChange={(v) => setStyle(v as OutStyle)}>
                  <TabsList>
                    <TabsTrigger value="unicode">Unicode ⠿</TabsTrigger>
                    <TabsTrigger value="dots">Dot numbers</TabsTrigger>
                  </TabsList>
                </Tabs>
              </Field>
              <Field label="Indicators">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="br-ind"
                    checked={indicators}
                    onCheckedChange={(c) => setIndicators(c === true)}
                  />
                  <Label htmlFor="br-ind">Capital / number signs</Label>
                </div>
              </Field>
            </>
          )}
        </>
      }
    />
  );
}
