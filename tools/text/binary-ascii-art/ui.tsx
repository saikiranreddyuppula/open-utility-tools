'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
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

type Mode = 'encode' | 'decode';
type Variant = '24' | '26';

const SAMPLE = 'Knowledge is power';

// Build the letter -> 5-bit code maps for both variants.
// 24-letter: I/J share, U/V share. 26-letter: distinct sequential.
function buildMaps(variant: Variant): { enc: Map<string, string>; dec: Map<string, string> } {
  const enc = new Map<string, string>();
  const dec = new Map<string, string>();
  const code = (n: number) =>
    n
      .toString(2)
      .padStart(5, '0')
      .split('')
      .map((bit) => (bit === '0' ? 'A' : 'B'))
      .join('');

  if (variant === '26') {
    for (let i = 0; i < 26; i++) {
      const letter = String.fromCharCode(65 + i);
      const c = code(i);
      enc.set(letter, c);
      dec.set(c, letter);
    }
  } else {
    // 24-letter classic table (J and V merged out).
    const letters = 'ABCDEFGHIKLMNOPQRSTUWXYZ'.split('');
    letters.forEach((letter, i) => {
      const c = code(i);
      enc.set(letter, c);
      dec.set(c, letter);
    });
    const iCode = enc.get('I');
    const uCode = enc.get('U');
    if (iCode) enc.set('J', iCode);
    if (uCode) enc.set('V', uCode);
  }
  return { enc, dec };
}

export default function BaconCipherTool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [variant, setVariant] = useState<Variant>('24');
  const [symA, setSymA] = useState('A');
  const [symB, setSymB] = useState('B');
  const [dropNonLetters, setDropNonLetters] = useState(true);

  return (
    <TextToolLayout
      deps={[mode, variant, symA, symB, dropNonLetters]}
      transform={(input) => {
        if (!input) return '';
        const a = symA || 'A';
        const b = symB || 'B';
        if (a === b) throw new Error('The two symbols must be different.');

        const { enc, dec } = buildMaps(variant);

        if (mode === 'encode') {
          const out: string[] = [];
          for (const ch of input) {
            const upper = ch.toUpperCase();
            const codeAB = enc.get(upper);
            if (codeAB) {
              out.push(codeAB.split('A').join(a).split('B').join(b));
            } else if (!dropNonLetters) {
              out.push(ch);
            }
          }
          return out.join(' ');
        }

        // Decode: map the custom symbols back to canonical A/B, read 5-bit groups.
        // Walk char-by-char so multi-char custom symbols work and there is no
        // collision when a/b happen to be the letters A/B.
        const canonical: string[] = [];
        let i = 0;
        while (i < input.length) {
          if (input.startsWith(a, i)) {
            canonical.push('A');
            i += a.length;
          } else if (input.startsWith(b, i)) {
            canonical.push('B');
            i += b.length;
          } else {
            i += 1;
          }
        }
        const bits = canonical.join('');
        if (bits.length === 0) return 'No cipher symbols detected.';
        const result: string[] = [];
        for (let j = 0; j + 5 <= bits.length; j += 5) {
          const group = bits.slice(j, j + 5);
          result.push(dec.get(group) ?? '?');
        }
        return result.join('');
      }}
      inputLabel={mode === 'encode' ? 'Plain text' : 'Cipher text'}
      outputLabel={mode === 'encode' ? 'Cipher text' : 'Decoded text'}
      sample={SAMPLE}
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
            <Select value={variant} onValueChange={(v) => setVariant(v as Variant)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">24-letter (I=J, U=V)</SelectItem>
                <SelectItem value="26">26-letter (distinct)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Symbol A">
            <Input value={symA} onChange={(e) => setSymA(e.target.value)} className="w-16" />
          </Field>
          <Field label="Symbol B">
            <Input value={symB} onChange={(e) => setSymB(e.target.value)} className="w-16" />
          </Field>
          {mode === 'encode' && (
            <Field label="Drop non-letters">
              <Switch checked={dropNonLetters} onCheckedChange={setDropNonLetters} />
            </Field>
          )}
        </>
      }
    />
  );
}
