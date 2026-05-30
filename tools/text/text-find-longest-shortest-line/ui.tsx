'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Unit = 'utf16' | 'codepoints';

const SAMPLE = `The quick brown fox
jumps
over the lazy dog and keeps running

A short one
This is the very longest line in this particular sample block`;

export default function FindLongestShortestLine() {
  const [unit, setUnit] = useState<Unit>('codepoints');
  const [includeEmpty, setIncludeEmpty] = useState(false);
  const [trimTrailing, setTrimTrailing] = useState(true);

  const transform = useCallback(
    (input: string): string => {
      if (!input) return '';

      const rawLines = input.split(/\r\n?|\n/u);

      const measure = (s: string): number => {
        const t = trimTrailing ? s.replace(/\s+$/u, '') : s;
        return unit === 'codepoints' ? [...t].length : t.length;
      };

      type Entry = { num: number; len: number; text: string };
      const entries: Entry[] = [];
      rawLines.forEach((line, i) => {
        const considered = trimTrailing ? line.replace(/\s+$/u, '') : line;
        const isEmpty = considered.trim() === '';
        if (isEmpty && !includeEmpty) return;
        entries.push({ num: i + 1, len: measure(line), text: line });
      });

      if (entries.length === 0) {
        throw new Error(
          'No lines to measure. Enable "include empty lines" or add content.'
        );
      }

      let longest = entries[0]!;
      let shortest = entries[0]!;
      for (const e of entries) {
        if (e.len > longest.len) longest = e;
        if (e.len < shortest.len) shortest = e;
      }

      const lens = entries.map((e) => e.len).sort((a, b) => a - b);
      const sum = lens.reduce((acc, n) => acc + n, 0);
      const avg = sum / lens.length;
      const mid = Math.floor(lens.length / 2);
      const median =
        lens.length % 2 === 1
          ? lens[mid]!
          : ((lens[mid - 1] ?? 0) + (lens[mid] ?? 0)) / 2;

      const clip = (s: string): string =>
        s.length > 120 ? `${s.slice(0, 117)}...` : s;

      const unitLabel = unit === 'codepoints' ? 'code points' : 'UTF-16 units';

      return [
        `Measuring by: ${unitLabel}` +
          (trimTrailing ? ' (trailing whitespace trimmed)' : ''),
        `Lines measured: ${entries.length} of ${rawLines.length}` +
          (includeEmpty ? '' : ' (empty lines excluded)'),
        '',
        `Longest line  -> #${longest.num}, length ${longest.len}`,
        `  ${clip(longest.text)}`,
        '',
        `Shortest line -> #${shortest.num}, length ${shortest.len}`,
        `  ${clip(shortest.text)}`,
        '',
        `Average length: ${avg.toFixed(2)}`,
        `Median length : ${median}`,
      ].join('\n');
    },
    [unit, includeEmpty, trimTrailing]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[unit, includeEmpty, trimTrailing]}
      inputLabel="Text"
      outputLabel="Line measurements"
      sample={SAMPLE}
      downloadName="line-lengths.txt"
      options={
        <>
          <Field label="Measure length by">
            <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
              <SelectTrigger className="h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="codepoints">Unicode code points</SelectItem>
                <SelectItem value="utf16">UTF-16 units</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Options">
            <div className="flex h-8 items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox
                  checked={trimTrailing}
                  onCheckedChange={(v) => setTrimTrailing(v === true)}
                />
                Trim trailing whitespace
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox
                  checked={includeEmpty}
                  onCheckedChange={(v) => setIncludeEmpty(v === true)}
                />
                Include empty lines
              </label>
            </div>
          </Field>
        </>
      }
    />
  );
}
