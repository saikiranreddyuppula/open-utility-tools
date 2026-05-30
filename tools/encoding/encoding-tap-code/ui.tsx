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
type Variant = 'ck' | 'q'; // C/K combined (standard) or Q omitted
type Form = 'taps' | 'numeric';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** 25-letter square: row-major, 5x5. Standard tap code drops K (maps to C). */
function buildSquare(variant: Variant): string[] {
  const dropped = variant === 'ck' ? 'K' : 'Q';
  const letters = ALPHABET.split('').filter((c) => c !== dropped);
  return letters.slice(0, 25);
}

function normalizeLetter(ch: string, variant: Variant): string | null {
  const u = ch.toUpperCase();
  if (!/[A-Z]/.test(u)) return null;
  if (variant === 'ck') return u === 'K' ? 'C' : u;
  // Q omitted: Q has no cell.
  return u === 'Q' ? null : u;
}

export default function TapCodeTool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [variant, setVariant] = useState<Variant>('ck');
  const [form, setForm] = useState<Form>('taps');
  const [glyph, setGlyph] = useState('.');
  const [coordSep, setCoordSep] = useState(' ');
  const [letterSep, setLetterSep] = useState('  /  ');

  const square = useMemo(() => buildSquare(variant), [variant]);

  const letterToCoord = useMemo(() => {
    const m = new Map<string, [number, number]>();
    square.forEach((ch, idx) => {
      m.set(ch, [Math.floor(idx / 5) + 1, (idx % 5) + 1]);
    });
    return m;
  }, [square]);

  const coordToLetter = useMemo(() => {
    const m = new Map<string, string>();
    square.forEach((ch, idx) => {
      m.set(`${Math.floor(idx / 5) + 1},${idx % 5 + 1}`, ch);
    });
    return m;
  }, [square]);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';

      if (mode === 'encode') {
        const out: string[] = [];
        for (const raw of input) {
          const letter = normalizeLetter(raw, variant);
          if (!letter) continue;
          const coord = letterToCoord.get(letter);
          if (!coord) continue;
          const [r, c] = coord;
          if (form === 'numeric') {
            out.push(`${r}${c}`);
          } else {
            const row = glyph.repeat(r);
            const col = glyph.repeat(c);
            out.push(`${row}${coordSep}${col}`);
          }
        }
        return out.join(letterSep);
      }

      // Decode
      if (form === 'numeric') {
        // Read all digit pairs in order (ignore non-digits).
        const digits = input.replace(/\D/g, '');
        if (digits.length % 2 !== 0) {
          throw new Error(`Found ${digits.length} digits — need an even count of (row,col) pairs.`);
        }
        let res = '';
        for (let i = 0; i < digits.length; i += 2) {
          const r = digits[i] ?? '';
          const c = digits[i + 1] ?? '';
          const letter = coordToLetter.get(`${r},${c}`);
          if (!letter) throw new Error(`Invalid coordinate ${r},${c} (rows/cols are 1–5).`);
          res += letter;
        }
        return res;
      }

      // Tap form: count runs of the glyph character; each run is one coordinate (1–5).
      if (!glyph) throw new Error('Tap glyph must not be empty.');
      const g = glyph;
      const counts: number[] = [];
      let i = 0;
      while (i < input.length) {
        if (input.startsWith(g, i)) {
          let n = 0;
          while (input.startsWith(g, i)) {
            n += 1;
            i += g.length;
          }
          counts.push(n);
        } else {
          i += 1;
        }
      }
      if (counts.length % 2 !== 0) {
        throw new Error(`Found ${counts.length} tap groups — need pairs of (row, col).`);
      }
      let res = '';
      for (let k = 0; k < counts.length; k += 2) {
        const r = counts[k] ?? 0;
        const c = counts[k + 1] ?? 0;
        if (r < 1 || r > 5 || c < 1 || c > 5) {
          throw new Error(`Tap group out of range: ${r},${c} (each must be 1–5 taps).`);
        }
        const letter = coordToLetter.get(`${r},${c}`);
        if (!letter) throw new Error(`No letter for ${r},${c}.`);
        res += letter;
      }
      return res;
    },
    [mode, variant, form, glyph, coordSep, letterSep, letterToCoord, coordToLetter],
  );

  return (
    <div className="space-y-4">
      <TextToolLayout
        transform={transform}
        deps={[mode, variant, form, glyph, coordSep, letterSep]}
        inputLabel={mode === 'encode' ? 'Plain text' : 'Tap code'}
        outputLabel={mode === 'encode' ? 'Tap code' : 'Plain text'}
        sample={mode === 'encode' ? 'WATER' : '. . . . .  /  . ....'}
        downloadName="tap-code.txt"
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
            <Field label="Form">
              <Select value={form} onValueChange={(v) => setForm(v as Form)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="taps">Taps (glyphs)</SelectItem>
                  <SelectItem value="numeric">Numeric (row col)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Square">
              <Select value={variant} onValueChange={(v) => setVariant(v as Variant)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ck">C/K combined</SelectItem>
                  <SelectItem value="q">Q omitted</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {form === 'taps' && (
              <>
                <Field label="Tap glyph">
                  <Input value={glyph} onChange={(e) => setGlyph(e.target.value)} className="w-20" />
                </Field>
                <Field label="Coord separator">
                  <Input
                    value={coordSep}
                    onChange={(e) => setCoordSep(e.target.value)}
                    placeholder="(space)"
                    className="w-24"
                  />
                </Field>
                <Field label="Letter separator">
                  <Input
                    value={letterSep}
                    onChange={(e) => setLetterSep(e.target.value)}
                    className="w-28"
                  />
                </Field>
              </>
            )}
          </>
        }
      />

      <div className="rounded-md border bg-muted/20 p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          Tap-code square ({variant === 'ck' ? 'C/K combined' : 'Q omitted'}) — taps = row, then column
        </div>
        <div className="inline-grid grid-cols-6 gap-px font-mono text-xs">
          <div className="px-2 py-1" />
          {[1, 2, 3, 4, 5].map((c) => (
            <div
              key={`col-${c}`}
              className="bg-background px-2 py-1 text-center font-semibold text-muted-foreground"
            >
              {c}
            </div>
          ))}
          {[1, 2, 3, 4, 5].map((rowNum, rowIdx) => (
            <div key={`row-${rowNum}`} className="contents">
              <div className="bg-background px-2 py-1 text-center font-semibold text-muted-foreground">
                {rowNum}
              </div>
              {[0, 1, 2, 3, 4].map((colIdx) => {
                const ch = square[rowIdx * 5 + colIdx] ?? '';
                const label = variant === 'ck' && ch === 'C' ? 'C/K' : ch;
                return (
                  <div
                    key={`cell-${rowIdx}-${colIdx}`}
                    className="bg-background px-2 py-1 text-center font-semibold"
                  >
                    {label}
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
