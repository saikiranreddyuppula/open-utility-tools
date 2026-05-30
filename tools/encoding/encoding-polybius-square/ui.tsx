'use client';

import { useCallback, useMemo, useState } from 'react';

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
type Variant = 'ij' | 'q'; // I/J merged, or Q omitted
type Labels = 'digits' | 'adfgx';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Build the 25-letter square (5x5) for a variant + optional keyword. */
function buildSquare(keyword: string, variant: Variant): string[] {
  // Choose the 25-letter alphabet (drop one letter).
  let base = ALPHABET;
  if (variant === 'ij') base = base.replace('J', '');
  else base = base.replace('Q', '');

  const seen = new Set<string>();
  const ordered: string[] = [];
  const pushLetter = (raw: string) => {
    let ch = raw.toUpperCase();
    if (!/[A-Z]/.test(ch)) return;
    if (variant === 'ij' && ch === 'J') ch = 'I';
    if (variant === 'q' && ch === 'Q') return;
    if (seen.has(ch)) return;
    seen.add(ch);
    ordered.push(ch);
  };
  for (const ch of keyword) pushLetter(ch);
  for (const ch of base) pushLetter(ch);
  return ordered;
}

function labelChars(labels: Labels): string[] {
  return labels === 'adfgx' ? ['A', 'D', 'F', 'G', 'X'] : ['1', '2', '3', '4', '5'];
}

export default function PolybiusSquareTool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [keyword, setKeyword] = useState('');
  const [variant, setVariant] = useState<Variant>('ij');
  const [labels, setLabels] = useState<Labels>('digits');
  const [sep, setSep] = useState(' ');

  const square = useMemo(() => buildSquare(keyword, variant), [keyword, variant]);
  const lbl = useMemo(() => labelChars(labels), [labels]);

  // Maps for fast lookup.
  const letterToCoord = useMemo(() => {
    const m = new Map<string, string>();
    square.forEach((ch, idx) => {
      const r = lbl[Math.floor(idx / 5)] ?? '?';
      const c = lbl[idx % 5] ?? '?';
      m.set(ch, `${r}${c}`);
    });
    return m;
  }, [square, lbl]);

  const coordToLetter = useMemo(() => {
    const m = new Map<string, string>();
    square.forEach((ch, idx) => {
      const r = lbl[Math.floor(idx / 5)] ?? '?';
      const c = lbl[idx % 5] ?? '?';
      m.set(`${r}${c}`, ch);
    });
    return m;
  }, [square, lbl]);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      if (mode === 'encode') {
        const parts: string[] = [];
        for (const raw of input) {
          let ch = raw.toUpperCase();
          if (!/[A-Z]/.test(ch)) continue;
          if (variant === 'ij' && ch === 'J') ch = 'I';
          const coord = letterToCoord.get(ch);
          if (!coord) {
            // Q omitted variant: letter has no cell.
            throw new Error(
              `Letter "${ch}" is not in the square (omitted by current variant).`,
            );
          }
          parts.push(coord);
        }
        return parts.join(sep);
      }
      // Decode: gather label characters into coordinate pairs.
      const labelSet = new Set(lbl);
      const tokens = input
        .split('')
        .filter((c) => labelSet.has(c.toUpperCase()))
        .map((c) => c.toUpperCase());
      if (tokens.length % 2 !== 0) {
        throw new Error(
          `Found ${tokens.length} coordinate symbols — must be an even count to form pairs.`,
        );
      }
      let out = '';
      for (let i = 0; i < tokens.length; i += 2) {
        const r = tokens[i] ?? '';
        const c = tokens[i + 1] ?? '';
        const letter = coordToLetter.get(`${r}${c}`);
        if (!letter) throw new Error(`Invalid coordinate pair "${r}${c}".`);
        out += letter;
      }
      return out;
    },
    [mode, variant, letterToCoord, coordToLetter, lbl, sep],
  );

  return (
    <div className="space-y-4">
      <TextToolLayout
        transform={transform}
        deps={[mode, keyword, variant, labels, sep]}
        inputLabel={mode === 'encode' ? 'Plain text' : 'Coordinates'}
        outputLabel={mode === 'encode' ? 'Coordinates' : 'Plain text'}
        sample={mode === 'encode' ? 'ATTACK AT DAWN' : '11 44 44 11 13 25'}
        downloadName="polybius.txt"
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
            <Field label="Keyword (optional)">
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g. SECRET"
                className="w-40"
              />
            </Field>
            <Field label="Square variant">
              <Select value={variant} onValueChange={(v) => setVariant(v as Variant)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ij">I/J merged</SelectItem>
                  <SelectItem value="q">Q omitted</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Coordinate labels">
              <Select value={labels} onValueChange={(v) => setLabels(v as Labels)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="digits">Digits 1–5</SelectItem>
                  <SelectItem value="adfgx">ADFGX letters</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Pair separator">
              <Input
                value={sep}
                onChange={(e) => setSep(e.target.value)}
                placeholder="(space)"
                className="w-24"
              />
            </Field>
          </>
        }
      />

      <div className="rounded-md border bg-muted/20 p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          Polybius square ({variant === 'ij' ? 'I/J merged' : 'Q omitted'})
        </div>
        <div className="inline-grid grid-cols-6 gap-px font-mono text-xs">
          <div className="px-2 py-1" />
          {lbl.map((c) => (
            <div
              key={`col-${c}`}
              className="bg-background px-2 py-1 text-center font-semibold text-muted-foreground"
            >
              {c}
            </div>
          ))}
          {lbl.map((rowLabel, rowIdx) => (
            <div key={`row-${rowLabel}`} className="contents">
              <div className="bg-background px-2 py-1 text-center font-semibold text-muted-foreground">
                {rowLabel}
              </div>
              {lbl.map((_colLabel, colIdx) => {
                const ch = square[rowIdx * 5 + colIdx] ?? '';
                return (
                  <div
                    key={`cell-${rowIdx}-${colIdx}`}
                    className="bg-background px-2 py-1 text-center font-semibold"
                  >
                    {ch === 'I' && variant === 'ij' ? 'I/J' : ch}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
