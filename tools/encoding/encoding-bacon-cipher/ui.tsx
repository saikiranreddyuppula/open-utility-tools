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
type Variant = '24' | '26';
type SymbolPair = 'ab' | '01' | 'custom';

// 24-letter variant: I/J share a code and U/V share a code.
function buildTable(variant: Variant): { enc: Record<string, string>; dec: Record<string, string> } {
  const enc: Record<string, string> = {};
  const dec: Record<string, string> = {};
  let idx = 0;
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i);
    if (variant === '24' && (letter === 'J' || letter === 'V')) {
      // Share previous letter's code (I and U respectively).
      const shared = letter === 'J' ? 'I' : 'U';
      const code = enc[shared];
      if (code !== undefined) enc[letter] = code;
      continue;
    }
    const code = idx.toString(2).padStart(5, '0').replace(/0/g, 'A').replace(/1/g, 'B');
    enc[letter] = code;
    if (dec[code] === undefined) dec[code] = letter;
    idx++;
  }
  return { enc, dec };
}

export default function BaconCipherTool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [variant, setVariant] = useState<Variant>('24');
  const [symbols, setSymbols] = useState<SymbolPair>('ab');
  const [customA, setCustomA] = useState('A');
  const [customB, setCustomB] = useState('B');
  const [stego, setStego] = useState(false);
  const [cover, setCover] = useState('the quick brown fox jumps over the lazy dog and runs fast');
  const [passThrough, setPassThrough] = useState(false);

  const sym = useMemo((): { a: string; b: string; err: string | null } => {
    if (symbols === '01') return { a: '0', b: '1', err: null };
    if (symbols === 'ab') return { a: 'A', b: 'B', err: null };
    const a = customA.slice(0, 1);
    const b = customB.slice(0, 1);
    if (!a || !b) return { a: 'A', b: 'B', err: 'Enter both custom symbols.' };
    if (a === b) return { a, b, err: 'Custom symbols must differ.' };
    return { a, b, err: null };
  }, [symbols, customA, customB]);

  const { enc, dec } = useMemo(() => buildTable(variant), [variant]);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      if (sym.err) throw new Error(sym.err);

      if (mode === 'encode') {
        const groups: string[] = [];
        for (const ch of input) {
          const upper = ch.toUpperCase();
          const code = enc[upper];
          if (code !== undefined) {
            groups.push(code.replace(/A/g, sym.a).replace(/B/g, sym.b));
          } else if (passThrough && !stego) {
            // Pass non-letters through as-is (only meaningful in plain mode).
            groups.push(ch);
          }
        }
        if (stego) {
          // Hide the A/B pattern as letter case over the cover text.
          const pattern = groups.join('');
          const letters = cover.replace(/[^A-Za-z]/g, '');
          if (letters.length < pattern.length) {
            throw new Error(
              `Cover text needs at least ${pattern.length} letters (has ${letters.length}). Add more cover text.`,
            );
          }
          let out = '';
          let pi = 0;
          for (const c of cover) {
            if (/[A-Za-z]/.test(c) && pi < pattern.length) {
              const bit = pattern[pi] ?? sym.a;
              out += bit === sym.b ? c.toUpperCase() : c.toLowerCase();
              pi++;
            } else {
              out += c;
            }
          }
          return out;
        }
        return groups.join(' ');
      }

      // Decode
      if (stego) {
        // Read case from cover text: uppercase letter = B, lowercase = A.
        let bits = '';
        for (const c of input) {
          if (/[A-Z]/.test(c)) bits += 'B';
          else if (/[a-z]/.test(c)) bits += 'A';
        }
        return decodeBits(bits, dec);
      }
      // Normalise custom symbols and 0/1 back to A/B, drop everything else.
      let bits = '';
      for (const c of input) {
        if (c === sym.a) bits += 'A';
        else if (c === sym.b) bits += 'B';
        else if (c === 'A' || c === 'a') bits += 'A';
        else if (c === 'B' || c === 'b') bits += 'B';
        else if (c === '0') bits += 'A';
        else if (c === '1') bits += 'B';
      }
      if (bits.length === 0) throw new Error('No valid A/B (or 0/1) symbols found.');
      return decodeBits(bits, dec);
    },
    [mode, enc, dec, sym, stego, cover, passThrough],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, variant, symbols, customA, customB, stego, cover, passThrough]}
      inputLabel={mode === 'encode' ? 'Plain text' : stego ? 'Cover text (cased)' : 'Bacon code'}
      outputLabel={mode === 'encode' ? (stego ? 'Cased cover text' : 'Bacon code') : 'Plain text'}
      sample={mode === 'encode' ? 'HELLO' : 'AABBB AABAA ABABA ABABA ABBAB'}
      downloadName="bacon.txt"
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
          <Field label="Alphabet">
            <Tabs value={variant} onValueChange={(v) => setVariant(v as Variant)}>
              <TabsList>
                <TabsTrigger value="24">24-letter (I=J, U=V)</TabsTrigger>
                <TabsTrigger value="26">26-letter</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Symbols">
            <Select value={symbols} onValueChange={(v) => setSymbols(v as SymbolPair)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ab">A / B</SelectItem>
                <SelectItem value="01">0 / 1</SelectItem>
                <SelectItem value="custom">Custom pair</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {symbols === 'custom' && (
            <>
              <Field label="Symbol A">
                <Input
                  value={customA}
                  onChange={(e) => setCustomA(e.target.value)}
                  maxLength={1}
                  className="w-16"
                />
              </Field>
              <Field label="Symbol B">
                <Input
                  value={customB}
                  onChange={(e) => setCustomB(e.target.value)}
                  maxLength={1}
                  className="w-16"
                />
              </Field>
            </>
          )}
          <Field label="Steganography (hide as case)">
            <Switch checked={stego} onCheckedChange={setStego} />
          </Field>
          {stego && mode === 'encode' && (
            <Field label="Cover text" className="min-w-[260px] flex-1">
              <Input value={cover} onChange={(e) => setCover(e.target.value)} />
            </Field>
          )}
          {!stego && (
            <Field label="Pass through non-letters">
              <Switch checked={passThrough} onCheckedChange={setPassThrough} />
            </Field>
          )}
        </>
      }
    />
  );
}

function decodeBits(bits: string, dec: Record<string, string>): string {
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    const group = bits.slice(i, i + 5);
    out += dec[group] ?? '?';
  }
  return out;
}
