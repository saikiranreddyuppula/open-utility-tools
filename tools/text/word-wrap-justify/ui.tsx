'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Align = 'left' | 'right' | 'center' | 'justify';

function clampWidth(raw: string): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 4) return 4;
  if (n > 400) return 400;
  return n;
}

// Greedy line filling: pack as many words per line as fit within width.
function wrapWords(words: string[], width: number, breakLong: boolean): string[][] {
  const lines: string[][] = [];
  let current: string[] = [];
  let len = 0;

  const pushWord = (w: string): void => {
    const extra = current.length === 0 ? w.length : w.length + 1;
    if (current.length > 0 && len + extra > width) {
      lines.push(current);
      current = [];
      len = 0;
    }
    if (current.length === 0) {
      current.push(w);
      len = w.length;
    } else {
      current.push(w);
      len += w.length + 1;
    }
  };

  for (const word of words) {
    if (breakLong && word.length > width) {
      // Hard-break an over-long word into width-sized chunks.
      let rest = word;
      while (rest.length > width) {
        const chunk = rest.slice(0, width);
        if (current.length > 0) {
          lines.push(current);
          current = [];
          len = 0;
        }
        lines.push([chunk]);
        rest = rest.slice(width);
      }
      if (rest.length > 0) pushWord(rest);
    } else {
      pushWord(word);
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

function alignLine(
  words: string[],
  width: number,
  align: Align,
  isLast: boolean
): string {
  const joined = words.join(' ');
  if (align === 'left') return joined;
  if (align === 'right') {
    const pad = Math.max(0, width - joined.length);
    return ' '.repeat(pad) + joined;
  }
  if (align === 'center') {
    const pad = Math.max(0, width - joined.length);
    const left = Math.floor(pad / 2);
    return ' '.repeat(left) + joined;
  }
  // justify: distribute extra spaces between words; last line stays ragged.
  if (isLast || words.length === 1) return joined;
  const textLen = words.reduce((sum, w) => sum + w.length, 0);
  const gaps = words.length - 1;
  const totalSpaces = Math.max(gaps, width - textLen);
  const base = Math.floor(totalSpaces / gaps);
  const extra = totalSpaces - base * gaps;
  let out = '';
  for (let i = 0; i < words.length; i += 1) {
    out += words[i] ?? '';
    if (i < gaps) {
      const n = base + (i < extra ? 1 : 0);
      out += ' '.repeat(n);
    }
  }
  return out;
}

export default function WordWrapJustifyTool() {
  const [width, setWidth] = useState('60');
  const [align, setAlign] = useState<Align>('left');
  const [preserveBreaks, setPreserveBreaks] = useState(false);
  const [indentFirst, setIndentFirst] = useState('0');
  const [breakLong, setBreakLong] = useState(true);

  const transform = useCallback(
    (input: string): string => {
      if (!input) return '';
      const w = clampWidth(width);
      const indent = Math.max(0, Math.min(w - 1, Math.floor(Number(indentFirst)) || 0));

      // Split into paragraphs on blank lines.
      const paragraphs = input.split(/\n[ \t]*\n/);

      const wrapParagraph = (para: string): string => {
        // When preserving breaks, treat each existing line as its own unit.
        const segments = preserveBreaks ? para.split('\n') : [para.replace(/\n/g, ' ')];
        const outSegments: string[] = [];

        for (const seg of segments) {
          const words = seg.split(/\s+/).filter((x) => x.length > 0);
          if (words.length === 0) {
            outSegments.push('');
            continue;
          }
          const lines = wrapWords(words, w, breakLong);
          const rendered = lines.map((lineWords, idx) => {
            const isLast = idx === lines.length - 1;
            let line = alignLine(lineWords, w, align, isLast);
            if (idx === 0 && indent > 0 && align !== 'right') {
              line = ' '.repeat(indent) + line;
            }
            return line;
          });
          outSegments.push(rendered.join('\n'));
        }
        return outSegments.join('\n');
      };

      return paragraphs.map(wrapParagraph).join('\n\n');
    },
    [width, align, preserveBreaks, indentFirst, breakLong]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[width, align, preserveBreaks, indentFirst, breakLong]}
      inputLabel="Paragraphs"
      outputLabel="Reflowed"
      sample={
        'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs, and reflow this paragraph to the chosen column width using greedy word wrapping with optional full justification.\n\nA second paragraph follows after a blank line so you can see paragraph boundaries preserved.'
      }
      downloadName="reflowed.txt"
      options={
        <>
          <Field label="Width (cols)">
            <Input
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              inputMode="numeric"
              className="h-8 w-24"
            />
          </Field>
          <Field label="Alignment">
            <Select value={align} onValueChange={(v) => setAlign(v as Align)}>
              <SelectTrigger className="h-8 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left (ragged right)</SelectItem>
                <SelectItem value="right">Right</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="justify">Full justify</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="First-line indent">
            <Input
              value={indentFirst}
              onChange={(e) => setIndentFirst(e.target.value)}
              inputMode="numeric"
              className="h-8 w-24"
            />
          </Field>
          <Field label="Preserve line breaks">
            <div className="flex h-8 items-center">
              <Switch checked={preserveBreaks} onCheckedChange={setPreserveBreaks} />
            </div>
          </Field>
          <Field label="Break long words">
            <div className="flex h-8 items-center">
              <Switch checked={breakLong} onCheckedChange={setBreakLong} />
            </div>
          </Field>
        </>
      }
    />
  );
}
