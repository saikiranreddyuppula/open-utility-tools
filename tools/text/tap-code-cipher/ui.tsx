'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'encode' | 'decode';
type Merge = 'k' | 'j'; // which letter is merged in the 25-cell square
type TapSymbol = 'dots' | 'numbers';

// Build the 5x5 alphabet for the chosen merge. Classic tap code merges C/K
// (so K is typed as C). The J variant drops J (typed as I).
function buildSquare(merge: Merge): string {
  if (merge === 'k') return 'ABCDEFGHIJLMNOPQRSTUVWXYZ'; // K removed
  return 'ABCDEFGHIKLMNOPQRSTUVWXYZ'; // J removed
}

function normalizeLetter(ch: string, merge: Merge): string | null {
  let u = ch.toUpperCase();
  if (u < 'A' || u > 'Z') return null;
  if (merge === 'k' && u === 'K') u = 'C';
  if (merge === 'j' && u === 'J') u = 'I';
  return u;
}

function tapsFor(symbol: TapSymbol, n: number): string {
  if (symbol === 'numbers') return String(n);
  return '.'.repeat(Math.max(0, n));
}

export default function TapCodeCipherTool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [merge, setMerge] = useState<Merge>('k');
  const [symbol, setTapSymbol] = useState<TapSymbol>('dots');
  const [intra, setIntra] = useState(' '); // between the two tap groups of one letter
  const [inter, setInter] = useState('  '); // between letters

  const encode = useCallback(
    (input: string): string => {
      const square = buildSquare(merge);
      const intraSep = intra.length > 0 ? intra : ' ';
      const interSep = inter.length > 0 ? inter : '  ';
      const wordSep = ' / ';
      const words = input.split(/\s+/).filter((w) => w.length > 0);
      const encodedWords: string[] = [];
      for (const word of words) {
        const letters: string[] = [];
        for (const ch of word) {
          const norm = normalizeLetter(ch, merge);
          if (norm === null) continue; // drop punctuation/digits
          const idx = square.indexOf(norm);
          if (idx < 0) continue;
          const row = Math.floor(idx / 5) + 1;
          const col = (idx % 5) + 1;
          letters.push(`${tapsFor(symbol, row)}${intraSep}${tapsFor(symbol, col)}`);
        }
        if (letters.length > 0) encodedWords.push(letters.join(interSep));
      }
      return encodedWords.join(wordSep);
    },
    [merge, symbol, intra, inter],
  );

  const decode = useCallback(
    (input: string): string => {
      const square = buildSquare(merge);
      // A '/' marks a word break; decode each word chunk separately.
      const chunks = input.split('/');
      const outWords: string[] = [];
      for (const chunk of chunks) {
        // Collect tap counts. If the chunk uses explicit digits (1-9), read
        // each digit as a count and ignore dots; otherwise count dot-runs.
        const counts: number[] = [];
        if (/[1-9]/.test(chunk)) {
          for (const d of chunk.replace(/[^1-9]/g, '')) {
            counts.push(Number(d));
          }
        } else {
          const runRe = /\.+/g;
          let m: RegExpExecArray | null;
          while ((m = runRe.exec(chunk)) !== null) {
            counts.push(m[0].length);
          }
        }
        let word = '';
        for (let i = 0; i + 1 < counts.length; i += 2) {
          const row = counts[i] ?? 0;
          const col = counts[i + 1] ?? 0;
          if (row < 1 || row > 5 || col < 1 || col > 5) {
            word += '?';
            continue;
          }
          const idx = (row - 1) * 5 + (col - 1);
          word += square[idx] ?? '?';
        }
        if (word.length > 0) outWords.push(word);
      }
      return outWords.join(' ');
    },
    [merge],
  );

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      return mode === 'encode' ? encode(input) : decode(input);
    },
    [mode, encode, decode],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, merge, symbol, intra, inter]}
      inputLabel={mode === 'encode' ? 'Text' : 'Tap sequence'}
      outputLabel={mode === 'encode' ? 'Tap code' : 'Text'}
      inputPlaceholder={mode === 'encode' ? 'water' : '. . . . . / . . . . .'}
      sample={mode === 'encode' ? 'water' : '.. ...  . .....  ... .  ... .  ... ....'}
      downloadName="tap-code.txt"
      mono
      options={
        <>
          <Field label="Direction">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="encode">Encode</TabsTrigger>
                <TabsTrigger value="decode">Decode</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Square" hint="Which letter shares a cell">
            <Select value={merge} onValueChange={(v) => setMerge(v as Merge)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="k">Merge C/K (classic)</SelectItem>
                <SelectItem value="j">Merge I/J</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {mode === 'encode' && (
            <>
              <Field label="Tap symbol">
                <Select value={symbol} onValueChange={(v) => setTapSymbol(v as TapSymbol)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dots">Dots (.)</SelectItem>
                    <SelectItem value="numbers">Numbers</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Row/col separator">
                <Input value={intra} onChange={(e) => setIntra(e.target.value)} className="w-20" />
              </Field>
              <Field label="Letter separator">
                <Input value={inter} onChange={(e) => setInter(e.target.value)} className="w-20" />
              </Field>
            </>
          )}
        </>
      }
    />
  );
}
