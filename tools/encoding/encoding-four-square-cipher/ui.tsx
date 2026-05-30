'use client';

import { useCallback, useMemo, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'encode' | 'decode';

const ALPHABET = 'ABCDEFGHIKLMNOPQRSTUVWXYZ'; // 25 letters, J merged into I

// Build a 5x5 square (as a flat 25-char string) from a keyword (I/J merged).
function buildSquare(keyword: string): string {
  const seen = new Set<string>();
  let out = '';
  const normalized = (keyword.toUpperCase().replace(/J/g, 'I').match(/[A-Z]/g) ?? []).join('');
  for (const ch of normalized) {
    if (!ALPHABET.includes(ch)) continue;
    if (!seen.has(ch)) {
      seen.add(ch);
      out += ch;
    }
  }
  for (const ch of ALPHABET) {
    if (!seen.has(ch)) {
      seen.add(ch);
      out += ch;
    }
  }
  return out;
}

// Position of a letter within a 25-char square -> [row, col].
function posOf(square: string, ch: string): [number, number] {
  const idx = square.indexOf(ch);
  // idx is always >= 0 because input letters are normalized to the 25-letter set.
  const safe = idx >= 0 ? idx : 0;
  return [Math.floor(safe / 5), safe % 5];
}

function letterAt(square: string, row: number, col: number): string {
  return square[row * 5 + col] ?? 'X';
}

export default function FourSquareCipherTool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [key1, setKey1] = useState('EXAMPLE');
  const [key2, setKey2] = useState('KEYWORD');

  // The four squares: top-left = plain, top-right = key1, bottom-left = key2,
  // bottom-right = plain.
  const squares = useMemo(() => {
    const plain = ALPHABET; // plain alphabet arranged in order
    return {
      tl: plain,
      tr: buildSquare(key1),
      bl: buildSquare(key2),
      br: plain,
    };
  }, [key1, key2]);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      const letters = (input.toUpperCase().replace(/J/g, 'I').match(/[A-Z]/g) ?? []).join('');
      if (!letters) throw new Error('Input contains no A–Z letters to process.');

      // Split into digraphs, padding an odd final letter with X.
      const padded = letters.length % 2 === 0 ? letters : `${letters}X`;
      const { tl, tr, bl, br } = squares;

      let out = '';
      for (let i = 0; i < padded.length; i += 2) {
        const a = padded[i] ?? 'X';
        const b = padded[i + 1] ?? 'X';
        if (mode === 'encode') {
          // Locate the two letters in the two PLAIN squares (TL & BR),
          // read the cipher pair from the two KEY squares (TR & BL).
          const [r1, c1] = posOf(tl, a);
          const [r2, c2] = posOf(br, b);
          out += letterAt(tr, r1, c2);
          out += letterAt(bl, r2, c1);
        } else {
          // Decrypt: locate in the KEY squares, read from the PLAIN squares.
          const [r1, c1] = posOf(tr, a);
          const [r2, c2] = posOf(bl, b);
          out += letterAt(tl, r1, c2);
          out += letterAt(br, r2, c1);
        }
      }
      return out;
    },
    [mode, squares],
  );

  const renderSquare = (sq: string, title: string) => (
    <div className="rounded-md border bg-background p-2">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="grid grid-cols-5 gap-0.5 font-mono text-xs">
        {Array.from(sq).map((ch, i) => (
          <div
            key={`${title}-${i}`}
            className="flex size-5 items-center justify-center rounded bg-muted/40"
          >
            {ch}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <TextToolLayout
        transform={transform}
        deps={[mode, key1, key2]}
        inputLabel={mode === 'encode' ? 'Plain text' : 'Cipher text'}
        outputLabel={mode === 'encode' ? 'Cipher text' : 'Plain text'}
        sample="HELP ME OBI WAN"
        downloadName="four-square.txt"
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
            <Field label="Keyword 1 (top-right)">
              <Input
                value={key1}
                onChange={(e) => setKey1(e.target.value)}
                className="w-40"
              />
            </Field>
            <Field label="Keyword 2 (bottom-left)">
              <Input
                value={key2}
                onChange={(e) => setKey2(e.target.value)}
                className="w-40"
              />
            </Field>
          </>
        }
      />

      <div className="rounded-md border bg-muted/20 p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          The four squares (I/J merged). Plaintext letters are looked up in the
          plain squares; cipher letters are read from the keyed squares.
        </div>
        <div className="grid grid-cols-2 gap-2 sm:max-w-md">
          {renderSquare(squares.tl, 'Top-left (plain)')}
          {renderSquare(squares.tr, 'Top-right (key 1)')}
          {renderSquare(squares.bl, 'Bottom-left (key 2)')}
          {renderSquare(squares.br, 'Bottom-right (plain)')}
        </div>
      </div>
    </div>
  );
}
