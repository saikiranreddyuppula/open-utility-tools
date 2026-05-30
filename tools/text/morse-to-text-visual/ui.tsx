'use client';

import { useCallback, useState } from 'react';

import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'encode' | 'decode';

const MORSE: Record<string, string> = {
  a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.',
  h: '....', i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.',
  o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-', u: '..-',
  v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
  '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--',
  '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...',
  ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-',
  '"': '.-..-.', '$': '...-..-', '@': '.--.-.',
};

const PROSIGNS: Record<string, string> = {
  sos: '...---...',
  error: '........',
};

const REVERSE: Record<string, string> = (() => {
  const r: Record<string, string> = {};
  for (const [k, v] of Object.entries(MORSE)) r[v] = k;
  return r;
})();

const SAMPLE_ENCODE = 'Hello World';
const SAMPLE_DECODE = '.... . .-.. .-.. --- / .-- --- .-. .-..';

function visualRhythm(code: string): string {
  // Render each Morse symbol as a short/long block string.
  let s = '';
  for (const ch of code) {
    if (ch === '.') s += '▪';
    else if (ch === '-') s += '███';
  }
  return s;
}

export default function MorseVisualTool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [dot, setDot] = useState('.');
  const [dash, setDash] = useState('-');
  const [letterGap, setLetterGap] = useState(' ');
  const [wordGap, setWordGap] = useState('/');
  const [usePros, setUsePros] = useState(true);
  const [showVisual, setShowVisual] = useState(true);

  const transform = useCallback(
    (input: string): string => {
      if (!input) return '';
      const lg = letterGap.length > 0 ? letterGap : ' ';
      const wg = wordGap.length > 0 ? wordGap : '/';

      if (mode === 'encode') {
        const codesByWord: string[][] = [];
        for (const rawWord of input.trim().split(/\s+/)) {
          const lowerWord = rawWord.toLowerCase();
          const pros = PROSIGNS[lowerWord];
          if (usePros && pros !== undefined) {
            codesByWord.push([pros]);
            continue;
          }
          const codes: string[] = [];
          for (const ch of lowerWord) {
            const code = MORSE[ch];
            if (code !== undefined) codes.push(code);
            // unknown chars are dropped silently
          }
          if (codes.length > 0) codesByWord.push(codes);
        }

        if (codesByWord.length === 0) throw new Error('No encodable characters found.');

        const d = dot.length > 0 ? dot : '.';
        const h = dash.length > 0 ? dash : '-';
        const render = (code: string): string => {
          let s = '';
          for (const ch of code) {
            if (ch === '.') s += d;
            else if (ch === '-') s += h;
          }
          return s;
        };
        const customWords = codesByWord.map((w) => w.map(render).join(lg));
        const custom = customWords.join(` ${wg} `);

        const parts: string[] = [custom];
        if (showVisual) {
          const rhythm = codesByWord
            .map((w) => w.map((c) => visualRhythm(c)).join('  '))
            .join('   /   ');
          parts.push(`\n--- Visual rhythm ---\n${rhythm}`);
        }
        return parts.join('\n');
      }

      // decode: split words on the word gap, letters on the letter gap.
      const decodedWords: string[] = [];
      for (const wordChunk of input.split(wg)) {
        const letters = wordChunk.trim().split(lg).filter((t) => t.length > 0);
        let word = '';
        for (const token of letters) {
          // map custom dot/dash back to canonical '.'/'-'
          let canon = '';
          for (const ch of token) {
            if (dot.length > 0 && ch === dot) canon += '.';
            else if (dash.length > 0 && ch === dash) canon += '-';
            else if (ch === '.') canon += '.';
            else if (ch === '-') canon += '-';
            // stray chars ignored
          }
          if (canon.length === 0) continue;
          if (usePros) {
            const ps = Object.entries(PROSIGNS).find(([, code]) => code === canon);
            if (ps !== undefined) {
              const name = ps[0];
              word += `[${name.toUpperCase()}]`;
              continue;
            }
          }
          word += REVERSE[canon] ?? '?';
        }
        if (word.length > 0) decodedWords.push(word);
      }
      if (decodedWords.length === 0) throw new Error('Could not decode any Morse tokens.');
      return decodedWords.join(' ');
    },
    [mode, dot, dash, letterGap, wordGap, usePros, showVisual]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, dot, dash, letterGap, wordGap, usePros, showVisual]}
      sample={mode === 'encode' ? SAMPLE_ENCODE : SAMPLE_DECODE}
      inputLabel={mode === 'encode' ? 'Text' : 'Morse'}
      outputLabel={mode === 'encode' ? 'Morse' : 'Text'}
      downloadName="morse.txt"
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="encode">Encode</TabsTrigger>
                <TabsTrigger value="decode">Decode</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Dot">
            <Input className="w-16" value={dot} onChange={(e) => setDot(e.target.value)} />
          </Field>
          <Field label="Dash">
            <Input className="w-16" value={dash} onChange={(e) => setDash(e.target.value)} />
          </Field>
          <Field label="Letter gap">
            <Input className="w-16" value={letterGap} onChange={(e) => setLetterGap(e.target.value)} />
          </Field>
          <Field label="Word gap">
            <Input className="w-16" value={wordGap} onChange={(e) => setWordGap(e.target.value)} />
          </Field>
          <Field label="Options">
            <div className="flex h-8 items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={usePros} onCheckedChange={setUsePros} /> prosigns
              </label>
              {mode === 'encode' && (
                <label className="flex items-center gap-1.5 text-xs">
                  <Switch checked={showVisual} onCheckedChange={setShowVisual} /> visual rhythm
                </label>
              )}
            </div>
          </Field>
        </>
      }
    />
  );
}
