'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Style = 'bullet' | 'dash' | 'star' | 'number' | 'paren' | 'lower' | 'upper' | 'roman' | 'custom';

function toRoman(n: number): string {
  if (n <= 0) return String(n);
  const table: [number, string][] = [
    [1000, 'm'],
    [900, 'cm'],
    [500, 'd'],
    [400, 'cd'],
    [100, 'c'],
    [90, 'xc'],
    [50, 'l'],
    [40, 'xl'],
    [10, 'x'],
    [9, 'ix'],
    [5, 'v'],
    [4, 'iv'],
    [1, 'i'],
  ];
  let out = '';
  let rem = n;
  for (const [value, sym] of table) {
    while (rem >= value) {
      out += sym;
      rem -= value;
    }
  }
  return out;
}

function toAlpha(n: number): string {
  // 1 -> a, 26 -> z, 27 -> aa ...
  let num = n;
  let out = '';
  while (num > 0) {
    const rem = (num - 1) % 26;
    out = String.fromCharCode(97 + rem) + out;
    num = Math.floor((num - 1) / 26);
  }
  return out;
}

export default function ListFormatterTool() {
  const [style, setStyle] = useState<Style>('bullet');
  const [start, setStart] = useState('1');
  const [indent, setIndent] = useState(0);
  const [skipBlank, setSkipBlank] = useState(true);
  const [customMarker, setCustomMarker] = useState('-');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      const lines = input.split('\n');
      const startNum = (() => {
        const n = Number(start);
        return Number.isFinite(n) ? Math.trunc(n) : 1;
      })();
      const pad = ' '.repeat(Math.max(0, indent));

      let counter = 0;
      const out = lines.map((line) => {
        const isBlank = line.trim() === '';
        if (isBlank && skipBlank) return line;
        counter += 1;
        const idx = startNum + counter - 1;
        let marker: string;
        switch (style) {
          case 'bullet':
            marker = '•';
            break;
          case 'dash':
            marker = '-';
            break;
          case 'star':
            marker = '*';
            break;
          case 'number':
            marker = `${idx}.`;
            break;
          case 'paren':
            marker = `${idx})`;
            break;
          case 'lower':
            marker = `${toAlpha(idx)}.`;
            break;
          case 'upper':
            marker = `${toAlpha(idx).toUpperCase()}.`;
            break;
          case 'roman':
            marker = `${toRoman(idx)}.`;
            break;
          case 'custom':
            marker = customMarker;
            break;
          default:
            marker = '•';
        }
        return `${pad}${marker} ${line.trim()}`;
      });
      return out.join('\n');
    },
    [style, start, indent, skipBlank, customMarker]
  );

  const isNumbered = ['number', 'paren', 'lower', 'upper', 'roman'].includes(style);

  return (
    <TextToolLayout
      transform={transform}
      deps={[style, start, indent, skipBlank, customMarker]}
      inputLabel="List (one item per line)"
      outputLabel="Formatted list"
      sample={'Apples\nBananas\nCherries\nDates'}
      downloadName="list.txt"
      options={
        <>
          <Field label="Style">
            <Select value={style} onValueChange={(v) => setStyle(v as Style)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bullet">{'Bullet (•)'}</SelectItem>
                <SelectItem value="dash">Dash (-)</SelectItem>
                <SelectItem value="star">Star (*)</SelectItem>
                <SelectItem value="number">Numbered (1.)</SelectItem>
                <SelectItem value="paren">Numbered (1))</SelectItem>
                <SelectItem value="lower">Lettered (a.)</SelectItem>
                <SelectItem value="upper">Lettered (A.)</SelectItem>
                <SelectItem value="roman">Roman (i.)</SelectItem>
                <SelectItem value="custom">Custom marker</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {style === 'custom' && (
            <Field label="Marker">
              <Input
                value={customMarker}
                onChange={(e) => setCustomMarker(e.target.value)}
                className="w-[120px]"
                placeholder="-"
              />
            </Field>
          )}
          {isNumbered && (
            <Field label="Start at">
              <Input
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-[100px]"
                inputMode="numeric"
              />
            </Field>
          )}
          <Field label={`Indent (${indent})`} className="min-w-[160px]">
            <Slider
              value={[indent]}
              onValueChange={(v) => setIndent(v[0] ?? 0)}
              min={0}
              max={12}
              step={1}
            />
          </Field>
          <Field label="Blank lines">
            <div className="flex h-9 items-center gap-2">
              <Checkbox
                id="skip-blank"
                checked={skipBlank}
                onCheckedChange={(v) => setSkipBlank(v === true)}
              />
              <Label htmlFor="skip-blank" className="text-xs font-normal">
                Skip blank lines
              </Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
