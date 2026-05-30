'use client';

import { useCallback, useMemo, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
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
type Variant = 'ij' | 'noq'; // I/J merged, or Q omitted

function alphabetFor(variant: Variant): string {
  return variant === 'ij'
    ? 'ABCDEFGHIKLMNOPQRSTUVWXYZ' // J merged into I
    : 'ABCDEFGHIJKLMNOPRSTUVWXYZ'; // Q omitted
}

// Normalize plaintext to the 25-letter alphabet of the chosen variant.
function normalize(text: string, variant: Variant): string {
  let s = text.toUpperCase().replace(/[^A-Z]/g, '');
  if (variant === 'ij') s = s.replace(/J/g, 'I');
  else s = s.replace(/Q/g, '');
  return s;
}

function buildSquare(keyword: string, variant: Variant): string {
  const alphabet = alphabetFor(variant);
  const seen = new Set<string>();
  let out = '';
  for (const ch of normalize(keyword, variant)) {
    if (!alphabet.includes(ch)) continue;
    if (!seen.has(ch)) {
      seen.add(ch);
      out += ch;
    }
  }
  for (const ch of alphabet) {
    if (!seen.has(ch)) {
      seen.add(ch);
      out += ch;
    }
  }
  return out;
}

function posOf(square: string, ch: string): [number, number] {
  const idx = square.indexOf(ch);
  const safe = idx >= 0 ? idx : 0;
  return [Math.floor(safe / 5), safe % 5];
}

function at(square: string, row: number, col: number): string {
  return square[row * 5 + col] ?? '?';
}

export default function PlayfairCipherTool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [keyword, setKeyword] = useState('PLAYFAIR EXAMPLE');
  const [variant, setVariant] = useState<Variant>('ij');
  const [filler, setFiller] = useState('X');
  const [padOdd, setPadOdd] = useState(true);

  const square = useMemo(() => buildSquare(keyword, variant), [keyword, variant]);

  const fillerChar = useMemo(() => {
    const f = normalize(filler, variant)[0];
    return f ?? 'X';
  }, [filler, variant]);

  // Split plaintext into digraphs with the filler rule (encryption side).
  const splitDigraphs = useCallback(
    (text: string): string[] => {
      const s = normalize(text, variant);
      const pairs: string[] = [];
      let i = 0;
      while (i < s.length) {
        const a = s[i] ?? '';
        let b = s[i + 1] ?? '';
        if (b === '' || a === b) {
          // Insert filler when the pair would be identical or at the end.
          const f = a === fillerChar ? (fillerChar === 'X' ? 'Q' : 'X') : fillerChar;
          b = a === b ? f : '';
          if (b === '') {
            if (padOdd) {
              pairs.push(a + f);
            }
            i += 1;
            continue;
          }
          pairs.push(a + b);
          i += 1;
          continue;
        }
        pairs.push(a + b);
        i += 2;
      }
      return pairs;
    },
    [variant, fillerChar, padOdd],
  );

  const runPair = useCallback(
    (pair: string): string => {
      const a = pair[0] ?? '';
      const b = pair[1] ?? '';
      const [r1, c1] = posOf(square, a);
      const [r2, c2] = posOf(square, b);
      const dir = mode === 'encode' ? 1 : -1;
      if (r1 === r2) {
        return at(square, r1, (c1 + dir + 5) % 5) + at(square, r2, (c2 + dir + 5) % 5);
      }
      if (c1 === c2) {
        return at(square, (r1 + dir + 5) % 5, c1) + at(square, (r2 + dir + 5) % 5, c2);
      }
      // Rectangle: swap columns.
      return at(square, r1, c2) + at(square, r2, c1);
    },
    [square, mode],
  );

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      let pairs: string[];
      if (mode === 'encode') {
        pairs = splitDigraphs(input);
      } else {
        // Decryption: ciphertext is already in even-length digraphs.
        const s = normalize(input, variant);
        pairs = [];
        for (let i = 0; i < s.length; i += 2) {
          const a = s[i] ?? '';
          const b = s[i + 1] ?? '';
          if (b === '') {
            pairs.push(a + (fillerChar === 'X' ? 'Q' : 'X'));
          } else {
            pairs.push(a + b);
          }
        }
      }
      if (pairs.length === 0) {
        throw new Error('Input contains no usable letters after normalization.');
      }
      return pairs.map((p) => runPair(p)).join(' ');
    },
    [mode, splitDigraphs, runPair, variant, fillerChar],
  );

  return (
    <div className="space-y-4">
      <TextToolLayout
        transform={transform}
        deps={[mode, keyword, variant, fillerChar, padOdd]}
        inputLabel={mode === 'encode' ? 'Plain text' : 'Cipher text'}
        outputLabel={mode === 'encode' ? 'Cipher text' : 'Plain text'}
        sample="HIDE THE GOLD IN THE TREE STUMP"
        downloadName="playfair.txt"
        options={
          <>
            <Field label="Mode">
              <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <TabsList>
                  <TabsTrigger value="encode">Encrypt</TabsTrigger>
                  <TabsTrigger value="decode">Decrypt</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
            <Field label="Keyword">
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-48"
              />
            </Field>
            <Field label="Alphabet variant">
              <Select
                value={variant}
                onValueChange={(v) => setVariant(v as Variant)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ij">I/J merged</SelectItem>
                  <SelectItem value="noq">Q omitted</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Filler letter">
              <Input
                value={filler}
                onChange={(e) => setFiller(e.target.value)}
                className="w-16"
                maxLength={1}
              />
            </Field>
            <Field label="Pad odd length">
              <Switch checked={padOdd} onCheckedChange={setPadOdd} />
            </Field>
          </>
        }
      />

      <div className="rounded-md border bg-muted/20 p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          5×5 key square ({variant === 'ij' ? 'I/J share a cell' : 'Q omitted'})
        </div>
        <div className="inline-grid grid-cols-5 gap-0.5 font-mono text-sm">
          {Array.from(square).map((ch, i) => (
            <div
              key={i}
              className="flex size-7 items-center justify-center rounded bg-background"
            >
              {ch}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
