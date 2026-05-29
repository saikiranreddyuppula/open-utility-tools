'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
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
type Base = 'dec' | 'hex' | 'oct' | 'bin';

const RADIX: Record<Base, number> = { dec: 10, hex: 16, oct: 8, bin: 2 };

function textToCodePoints(text: string, base: Base): string {
  const radix = RADIX[base];
  const out: string[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    let s = cp.toString(radix);
    if (base === 'hex') s = '0x' + s;
    out.push(s);
  }
  return out.join(' ');
}

function codePointsToText(input: string, base: Base): string {
  const radix = RADIX[base];
  // Split on any run of characters that are not valid digits / prefixes.
  const tokens = input
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const cps: number[] = [];
  for (const raw of tokens) {
    let t = raw;
    if (base === 'hex') {
      t = t.replace(/^0x/i, '');
    }
    if (!t) continue;
    const value = parseInt(t, radix);
    if (!Number.isFinite(value) || Number.isNaN(value)) {
      throw new Error(`"${raw}" is not a valid base-${radix} number.`);
    }
    if (value < 0 || value > 0x10ffff) {
      throw new Error(`Code point ${value} is out of the Unicode range (0–0x10FFFF).`);
    }
    if (value > 0xd7ff && value < 0xe000) {
      throw new Error(`Code point ${value} is a lone surrogate and cannot be encoded.`);
    }
    cps.push(value);
  }
  return String.fromCodePoint(...cps);
}

export default function AsciiCodePointTool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [base, setBase] = useState<Base>('dec');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      return mode === 'encode'
        ? textToCodePoints(input, base)
        : codePointsToText(input, base);
    },
    [mode, base],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, base]}
      inputLabel={mode === 'encode' ? 'Text' : 'Code points'}
      outputLabel={mode === 'encode' ? 'Code points' : 'Text'}
      inputPlaceholder={
        mode === 'encode' ? 'Hello' : base === 'hex' ? '0x48 0x69' : '72 105'
      }
      sample={mode === 'encode' ? 'Hello, 世界! 👋' : '72 101 108 108 111'}
      downloadName="code-points.txt"
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="encode">Text → Numbers</TabsTrigger>
                <TabsTrigger value="decode">Numbers → Text</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Number base">
            <Select value={base} onValueChange={(v) => setBase(v as Base)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dec">Decimal</SelectItem>
                <SelectItem value="hex">Hexadecimal</SelectItem>
                <SelectItem value="oct">Octal</SelectItem>
                <SelectItem value="bin">Binary</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      }
    />
  );
}
