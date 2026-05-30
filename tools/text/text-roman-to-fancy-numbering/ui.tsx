'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Style = 'decimal' | 'romanUpper' | 'romanLower' | 'alphaUpper' | 'alphaLower';
type Sep = '. ' | ') ' | ': ';

const SAMPLE = `1. First task to complete
2. Second important item
- Third bullet here
4) Fourth thing
Fifth without marker`;

// Strip an existing leading list marker (number, roman-ish, letter, bullet).
function stripMarker(line: string): string {
  return line.replace(
    /^\s*(?:[-*•]|\(?(?:\d+|[A-Za-z]{1,3}|[ivxlcdmIVXLCDM]+)\)?[.)\]:])\s+/u,
    ''
  );
}

function toRoman(n: number): string {
  if (n <= 0) return String(n);
  const table: Array<[number, string]> = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let rem = n;
  let out = '';
  for (const [val, sym] of table) {
    while (rem >= val) {
      out += sym;
      rem -= val;
    }
  }
  return out;
}

// 1 -> a, 26 -> z, 27 -> aa (bijective base-26).
function toAlpha(n: number): string {
  if (n <= 0) return String(n);
  let num = n;
  let out = '';
  while (num > 0) {
    const rem = (num - 1) % 26;
    out = String.fromCharCode(97 + rem) + out;
    num = Math.floor((num - 1) / 26);
  }
  return out;
}

export default function ListNumberStyleConverter() {
  const [style, setStyle] = useState<Style>('decimal');
  const [sep, setSep] = useState<Sep>('. ');
  const [start, setStart] = useState('1');
  const [continueAcrossBlank, setContinueAcrossBlank] = useState(true);
  const [stripExisting, setStripExisting] = useState(true);

  const transform = useCallback(
    (input: string): string => {
      if (!input) return '';
      const startN = Math.trunc(Number(start));
      const base = Number.isFinite(startN) ? startN : 1;

      const lines = input.split(/\r\n?|\n/u);

      const marker = (i: number): string => {
        const n = base + i;
        switch (style) {
          case 'decimal':
            return String(n);
          case 'romanUpper':
            return toRoman(n);
          case 'romanLower':
            return toRoman(n).toLowerCase();
          case 'alphaUpper':
            return toAlpha(n).toUpperCase();
          case 'alphaLower':
            return toAlpha(n);
          default:
            return String(n);
        }
      };

      let idx = 0;
      const out = lines.map((line) => {
        const isBlank = line.trim() === '';
        if (isBlank) {
          // Blank lines stay blank. When continuation is off, a blank line
          // restarts numbering for the next group.
          if (!continueAcrossBlank) idx = 0;
          return '';
        }
        const content = stripExisting ? stripMarker(line) : line;
        const m = marker(idx);
        idx += 1;
        return `${m}${sep}${content}`;
      });

      return out.join('\n');
    },
    [style, sep, start, continueAcrossBlank, stripExisting]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[style, sep, start, continueAcrossBlank, stripExisting]}
      inputLabel="List"
      outputLabel="Renumbered list"
      sample={SAMPLE}
      downloadName="renumbered.txt"
      options={
        <>
          <Field label="Number style">
            <Select value={style} onValueChange={(v) => setStyle(v as Style)}>
              <SelectTrigger className="h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="decimal">Decimal (1, 2, 3)</SelectItem>
                <SelectItem value="romanUpper">Roman upper (I, II)</SelectItem>
                <SelectItem value="romanLower">Roman lower (i, ii)</SelectItem>
                <SelectItem value="alphaUpper">Letters (A, B, C)</SelectItem>
                <SelectItem value="alphaLower">Letters (a, b, c)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Separator">
            <Select value={sep} onValueChange={(v) => setSep(v as Sep)}>
              <SelectTrigger className="h-8 w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=". ">{'1. '}</SelectItem>
                <SelectItem value=") ">{'1) '}</SelectItem>
                <SelectItem value=": ">{'1: '}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Start at">
            <Input
              value={start}
              onChange={(e) => setStart(e.target.value)}
              inputMode="numeric"
              className="w-20"
            />
          </Field>
          <Field label="Options">
            <div className="flex h-8 items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox
                  checked={stripExisting}
                  onCheckedChange={(v) => setStripExisting(v === true)}
                />
                Strip existing markers
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox
                  checked={continueAcrossBlank}
                  onCheckedChange={(v) => setContinueAcrossBlank(v === true)}
                />
                Continue across blank lines
              </label>
            </div>
          </Field>
        </>
      }
    />
  );
}
