'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { TextToolLayout } from '@/components/tools/text-tool';

function chunk(word: string, width: number): string[] {
  const pieces: string[] = [];
  for (let i = 0; i < word.length; i += width) {
    pieces.push(word.slice(i, i + width));
  }
  return pieces.length > 0 ? pieces : [word];
}

function wrapParagraph(para: string, width: number, indent: string, breakLong: boolean): string {
  const words = para.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return '';
  const lines: string[] = [];
  let current = '';
  let isFirst = true;

  const prefix = () => (isFirst ? '' : indent);

  const pushWord = (word: string) => {
    const indentLen = isFirst ? 0 : indent.length;
    const avail = Math.max(1, width - indentLen);
    if (breakLong && word.length > avail) {
      // flush current, then split the long word across lines
      if (current.length > 0) {
        lines.push(prefix() + current);
        current = '';
        isFirst = false;
      }
      const segs = chunk(word, Math.max(1, width - indent.length));
      const last = segs.length - 1;
      for (let i = 0; i < segs.length; i += 1) {
        const seg = segs[i] ?? '';
        if (i === last) {
          current = seg;
        } else {
          lines.push((isFirst ? '' : indent) + seg);
          isFirst = false;
        }
      }
      return;
    }
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= avail) {
      current += ' ' + word;
    } else {
      lines.push(prefix() + current);
      isFirst = false;
      current = word;
    }
  };

  for (const w of words) pushWord(w);
  if (current.length > 0) lines.push(prefix() + current);
  return lines.join('\n');
}

export default function TextWrap() {
  const [widthStr, setWidthStr] = useState('80');
  const [indentStr, setIndentStr] = useState('0');
  const [breakLong, setBreakLong] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      const width = Number(widthStr);
      if (!Number.isFinite(width) || width < 1) {
        throw new Error('Column width must be a positive number.');
      }
      const indentN = Number(indentStr);
      if (!Number.isFinite(indentN) || indentN < 0) {
        throw new Error('Hanging indent must be a non-negative number.');
      }
      const w = Math.floor(width);
      const indent = ' '.repeat(Math.min(Math.floor(indentN), Math.max(0, w - 1)));
      return input
        .split('\n')
        .map((para) => (para.trim() === '' ? '' : wrapParagraph(para, w, indent, breakLong)))
        .join('\n');
    },
    [widthStr, indentStr, breakLong],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[widthStr, indentStr, breakLong]}
      inputLabel="Text"
      outputLabel="Wrapped"
      inputPlaceholder="Paste a long paragraph…"
      sample="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
      downloadName="wrapped.txt"
      options={
        <>
          <Field label="Column width">
            <Input
              type="number"
              min={1}
              value={widthStr}
              onChange={(e) => setWidthStr(e.target.value)}
              className="w-24"
            />
          </Field>
          <Field label="Hanging indent" hint="spaces on wrapped lines">
            <Input
              type="number"
              min={0}
              value={indentStr}
              onChange={(e) => setIndentStr(e.target.value)}
              className="w-24"
            />
          </Field>
          <div className="flex items-center gap-2">
            <Checkbox
              id="breaklong"
              checked={breakLong}
              onCheckedChange={(v) => setBreakLong(Boolean(v))}
            />
            <Label htmlFor="breaklong">Break long words</Label>
          </div>
        </>
      }
    />
  );
}
