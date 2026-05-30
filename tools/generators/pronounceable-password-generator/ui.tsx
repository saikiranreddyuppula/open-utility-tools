'use client';

import { useCallback, useMemo, useState } from 'react';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Field } from '@/components/tools/panel';
import { GeneratorList } from '@/components/tools/generator-list';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

type Pattern = 'CV' | 'CVC' | 'CCV';

const CONSONANTS = 'bcdfghjklmnpqrstvwz';
const VOWELS = 'aeiou';

/** Unbiased index in [0, n). */
function randIndex(n: number): number {
  if (n <= 0) return 0;
  const limit = Math.floor(0xffffffff / n) * n;
  const buf = new Uint32Array(1);
  let v = 0;
  do {
    wc.getRandomValues(buf);
    v = buf[0] ?? 0;
  } while (v >= limit);
  return v % n;
}

function pick(set: string): string {
  return set.charAt(randIndex(set.length));
}

function syllable(pattern: Pattern): string {
  switch (pattern) {
    case 'CV':
      return pick(CONSONANTS) + pick(VOWELS);
    case 'CVC':
      return pick(CONSONANTS) + pick(VOWELS) + pick(CONSONANTS);
    case 'CCV':
      return pick(CONSONANTS) + pick(CONSONANTS) + pick(VOWELS);
    default:
      return pick(CONSONANTS) + pick(VOWELS);
  }
}

/** Approximate bits of entropy per produced letter for a syllable pattern. */
function bitsPerSyllable(pattern: Pattern): { bits: number; len: number } {
  const c = Math.log2(CONSONANTS.length);
  const v = Math.log2(VOWELS.length);
  switch (pattern) {
    case 'CV':
      return { bits: c + v, len: 2 };
    case 'CVC':
      return { bits: c + v + c, len: 3 };
    case 'CCV':
      return { bits: c + c + v, len: 3 };
    default:
      return { bits: c + v, len: 2 };
  }
}

export default function PronounceablePasswordGeneratorTool() {
  const [length, setLength] = useState(12);
  const [pattern, setPattern] = useState<Pattern>('CV');
  const [withDigit, setWithDigit] = useState(true);
  const [capitalize, setCapitalize] = useState(true);

  const generate = useCallback(() => {
    let out = '';
    // emit whole syllables until we reach/exceed the target, then trim.
    while (out.length < length) {
      out += syllable(pattern);
    }
    out = out.slice(0, Math.max(2, length));
    if (capitalize) out = out.charAt(0).toUpperCase() + out.slice(1);
    if (withDigit) {
      out += randIndex(10).toString();
    }
    return out;
  }, [length, pattern, withDigit, capitalize]);

  const entropy = useMemo(() => {
    const { bits, len } = bitsPerSyllable(pattern);
    // bits per produced letter, scaled to the trimmed output length
    let total = (bits / len) * length;
    if (withDigit) total += Math.log2(10);
    return Math.round(total * 10) / 10;
  }, [length, pattern, withDigit]);

  return (
    <div className="flex flex-col gap-3">
      <GeneratorList
        generate={generate}
        deps={[length, pattern, withDigit, capitalize]}
        defaultCount={10}
        maxCount={100}
        downloadName="pronounceable-passwords.txt"
        label="Passwords"
        options={
          <>
            <Field label={`Length: ${length}`} className="min-w-[200px]">
              <Slider
                value={[length]}
                min={6}
                max={24}
                step={1}
                onValueChange={(v) => setLength(v[0] ?? 12)}
              />
            </Field>
            <Field label="Syllable pattern">
              <Select value={pattern} onValueChange={(v) => setPattern(v as Pattern)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CV">CV</SelectItem>
                  <SelectItem value="CVC">CVC</SelectItem>
                  <SelectItem value="CCV">CCV</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Add digit">
              <div className="flex h-8 items-center gap-2">
                <Switch checked={withDigit} onCheckedChange={setWithDigit} id="dig" />
                <Label htmlFor="dig" className="text-xs text-muted-foreground">
                  trailing 0-9
                </Label>
              </div>
            </Field>
            <Field label="Capitalize">
              <div className="flex h-8 items-center gap-2">
                <Switch checked={capitalize} onCheckedChange={setCapitalize} id="cap" />
                <Label htmlFor="cap" className="text-xs text-muted-foreground">
                  first letter
                </Label>
              </div>
            </Field>
          </>
        }
      />
      <div className="rounded-lg border bg-muted/30 px-3 py-2 font-mono text-2xs text-muted-foreground">
        Approx. entropy: ~{entropy} bits per password (pattern {pattern}, length {length}
        {withDigit ? ' + digit' : ''})
      </div>
    </div>
  );
}
