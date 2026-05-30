'use client';

import { useCallback, useMemo, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'encode' | 'decode';

const ALPHABET = 'ABCDEFGHIKLMNOPQRSTUVWXYZ'; // 25 letters, J merged into I

// Build the 25-char Polybius square from a keyword (I/J merged).
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

// Two-digit Polybius coordinate (row,col), 1-based, for a letter.
function coordOf(square: string, ch: string): number {
  const idx = square.indexOf(ch);
  const safe = idx >= 0 ? idx : 0;
  const row = Math.floor(safe / 5) + 1;
  const col = (safe % 5) + 1;
  return row * 10 + col;
}

function letterFromCoord(square: string, coord: number): string {
  const row = Math.floor(coord / 10) - 1;
  const col = (coord % 10) - 1;
  if (row < 0 || row > 4 || col < 0 || col > 4) return '?';
  return square[row * 5 + col] ?? '?';
}

export default function NihilistCipherTool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [squareKey, setSquareKey] = useState('ZEBRAS');
  const [addKey, setAddKey] = useState('RUSSIAN');

  const square = useMemo(() => buildSquare(squareKey), [squareKey]);

  // Additive key as a sequence of two-digit coordinates (repeating).
  const keyCoords = useMemo(() => {
    const letters = (addKey.toUpperCase().replace(/J/g, 'I').match(/[A-Z]/g) ?? []).join('');
    return Array.from(letters, (ch) => coordOf(square, ch));
  }, [addKey, square]);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      if (keyCoords.length === 0) {
        throw new Error('Additive key must contain at least one A–Z letter.');
      }

      if (mode === 'encode') {
        const letters = (input.toUpperCase().replace(/J/g, 'I').match(/[A-Z]/g) ?? []).join('');
        if (!letters) throw new Error('Plaintext contains no A–Z letters.');
        const groups: string[] = [];
        for (let i = 0; i < letters.length; i++) {
          const ch = letters[i] ?? 'A';
          const plainCoord = coordOf(square, ch);
          const k = keyCoords[i % keyCoords.length] ?? 0;
          groups.push(String(plainCoord + k));
        }
        return groups.join(' ');
      }

      // decode: parse the cipher number groups, subtract the key, decode coords.
      const groups = (input.match(/\d+/g) ?? []).map((g) => Number(g));
      if (groups.length === 0) {
        throw new Error('Cipher text must contain space-separated number groups.');
      }
      let out = '';
      for (let i = 0; i < groups.length; i++) {
        const g = groups[i] ?? 0;
        const k = keyCoords[i % keyCoords.length] ?? 0;
        const coord = g - k;
        out += letterFromCoord(square, coord);
      }
      return out;
    },
    [mode, square, keyCoords],
  );

  // Intermediate breakdown of the additive key coordinates.
  const keyBreakdown = useMemo(() => {
    const letters = (addKey.toUpperCase().replace(/J/g, 'I').match(/[A-Z]/g) ?? []).join('');
    return Array.from(letters, (ch) => ({ ch, coord: coordOf(square, ch) }));
  }, [addKey, square]);

  return (
    <div className="space-y-4">
      <TextToolLayout
        transform={transform}
        deps={[mode, squareKey, addKey]}
        inputLabel={mode === 'encode' ? 'Plain text' : 'Cipher numbers'}
        outputLabel={mode === 'encode' ? 'Cipher numbers' : 'Plain text'}
        sample={mode === 'encode' ? 'ATTACK AT DAWN' : ''}
        downloadName="nihilist.txt"
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
            <Field label="Polybius square keyword">
              <Input
                value={squareKey}
                onChange={(e) => setSquareKey(e.target.value)}
                className="w-40"
              />
            </Field>
            <Field label="Additive key word">
              <Input
                value={addKey}
                onChange={(e) => setAddKey(e.target.value)}
                className="w-40"
              />
            </Field>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border bg-muted/20 p-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            Polybius square (rows/cols 1–5, I/J merged)
          </div>
          <div className="inline-grid grid-cols-6 gap-0.5 font-mono text-xs">
            <div />
            {[1, 2, 3, 4, 5].map((c) => (
              <div
                key={`h${c}`}
                className="flex size-5 items-center justify-center text-muted-foreground"
              >
                {c}
              </div>
            ))}
            {[0, 1, 2, 3, 4].map((r) => (
              <RowFragment key={`r${r}`} r={r} square={square} />
            ))}
          </div>
        </div>

        <div className="rounded-md border bg-muted/20 p-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">
            Additive key coordinates (repeating)
          </div>
          <div className="flex flex-wrap gap-1 font-mono text-xs">
            {keyBreakdown.length === 0 ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              keyBreakdown.map((k, i) => (
                <span key={i} className="rounded bg-background px-1.5 py-0.5">
                  {k.ch}={k.coord}
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RowFragment({ r, square }: { r: number; square: string }) {
  return (
    <>
      <div className="flex size-5 items-center justify-center text-muted-foreground">
        {r + 1}
      </div>
      {[0, 1, 2, 3, 4].map((c) => (
        <div
          key={`${r}-${c}`}
          className="flex size-5 items-center justify-center rounded bg-background"
        >
          {square[r * 5 + c] ?? ''}
        </div>
      ))}
    </>
  );
}
