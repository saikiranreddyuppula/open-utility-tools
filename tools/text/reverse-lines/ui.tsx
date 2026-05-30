'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Mode = 'order' | 'chars' | 'both' | 'rotate' | 'pairs';

const SAMPLE = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'].join('\n');

/** Reverse a string by code points (keeps astral chars intact). When
 *  graphemeAware is on, also keep combining marks attached using Intl.Segmenter
 *  where available. */
function reverseString(s: string, graphemeAware: boolean): string {
  if (graphemeAware) {
    type SegCtor = new (
      locale?: string,
      opts?: { granularity?: 'grapheme' }
    ) => { segment: (input: string) => Iterable<{ segment: string }> };
    const Seg = (Intl as unknown as { Segmenter?: SegCtor }).Segmenter;
    if (Seg) {
      const seg = new Seg(undefined, { granularity: 'grapheme' });
      const units: string[] = [];
      for (const part of seg.segment(s)) units.push(part.segment);
      return units.reverse().join('');
    }
  }
  return [...s].reverse().join('');
}

export default function ReverseLinesTool() {
  const [mode, setMode] = useState<Mode>('order');
  const [shift, setShift] = useState('1');
  const [ignoreTrailingBlank, setIgnoreTrailingBlank] = useState(true);
  const [graphemeAware, setGraphemeAware] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      let lines = input.split('\n');

      // Optionally peel off a single trailing blank line and restore it later.
      let trailing = '';
      if (ignoreTrailingBlank && lines.length > 1 && lines[lines.length - 1] === '') {
        lines = lines.slice(0, -1);
        trailing = '\n';
      }

      let result: string[];
      switch (mode) {
        case 'order':
          result = [...lines].reverse();
          break;
        case 'chars':
          result = lines.map((l) => reverseString(l, graphemeAware));
          break;
        case 'both':
          result = [...lines].reverse().map((l) => reverseString(l, graphemeAware));
          break;
        case 'rotate': {
          const n = Number(shift);
          const k = Number.isFinite(n) ? Math.trunc(n) : 0;
          const len = lines.length;
          if (len === 0) {
            result = lines;
          } else {
            const off = ((k % len) + len) % len;
            result = [...lines.slice(off), ...lines.slice(0, off)];
          }
          break;
        }
        case 'pairs': {
          result = [...lines];
          for (let i = 0; i + 1 < result.length; i += 2) {
            const a = result[i];
            const b = result[i + 1];
            if (a !== undefined && b !== undefined) {
              result[i] = b;
              result[i + 1] = a;
            }
          }
          break;
        }
        default:
          result = lines;
      }

      return result.join('\n') + trailing;
    },
    [mode, shift, ignoreTrailingBlank, graphemeAware]
  );

  const charMode = mode === 'chars' || mode === 'both';

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, shift, ignoreTrailingBlank, graphemeAware]}
      inputLabel="Lines"
      outputLabel="Result"
      sample={SAMPLE}
      downloadName="reversed.txt"
      options={
        <>
          <Field label="Mode">
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger className="w-[230px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="order">Reverse line order</SelectItem>
                <SelectItem value="chars">Reverse characters per line</SelectItem>
                <SelectItem value="both">Reverse both</SelectItem>
                <SelectItem value="rotate">Rotate lines by N</SelectItem>
                <SelectItem value="pairs">Flip pairs of lines</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {mode === 'rotate' && (
            <Field label="Shift by N (wrap)">
              <Input
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                className="w-[110px]"
                inputMode="numeric"
              />
            </Field>
          )}
          {charMode && (
            <Field label="Characters">
              <div className="flex h-9 items-center gap-2">
                <Checkbox
                  id="rl-grapheme"
                  checked={graphemeAware}
                  onCheckedChange={(v) => setGraphemeAware(v === true)}
                />
                <Label htmlFor="rl-grapheme" className="text-xs font-normal">
                  Grapheme-aware
                </Label>
              </div>
            </Field>
          )}
          <Field label="Trailing line">
            <div className="flex h-9 items-center gap-2">
              <Checkbox
                id="rl-trailing"
                checked={ignoreTrailingBlank}
                onCheckedChange={(v) => setIgnoreTrailingBlank(v === true)}
              />
              <Label htmlFor="rl-trailing" className="text-xs font-normal">
                Keep trailing blank
              </Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
