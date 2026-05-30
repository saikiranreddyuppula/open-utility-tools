'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'chars' | 'words' | 'lines';
type Delim = 'blank' | 'rule' | 'custom';

function chunkByChars(text: string, size: number, noWordBreak: boolean): string[] {
  const out: string[] = [];
  let i = 0;
  const len = text.length;
  while (i < len) {
    let end = Math.min(i + size, len);
    if (noWordBreak && end < len && !/\s/.test(text[end] ?? '')) {
      // Back up to the last whitespace within the window so we don't cut a word.
      let cut = end;
      while (cut > i && !/\s/.test(text[cut - 1] ?? '')) {
        cut -= 1;
      }
      // Only honor the break if it leaves a non-empty chunk; otherwise the
      // word is longer than the limit and we accept a hard cut.
      if (cut > i) end = cut;
    }
    const piece = text.slice(i, end);
    out.push(piece);
    i = end;
    // Skip leading whitespace before the next chunk (the boundary we broke on).
    while (i < len && /\s/.test(text[i] ?? '')) {
      i += 1;
    }
  }
  return out.map((c) => c.trim()).filter((c) => c.length > 0);
}

function chunkByWords(text: string, size: number): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const out: string[] = [];
  for (let i = 0; i < words.length; i += size) {
    out.push(words.slice(i, i + size).join(' '));
  }
  return out;
}

function chunkByLines(text: string, size: number): string[] {
  const lines = text.split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i += size) {
    out.push(lines.slice(i, i + size).join('\n'));
  }
  return out;
}

export default function SplitTextChunksTool() {
  const [mode, setMode] = useState<Mode>('chars');
  const [size, setSize] = useState('160');
  const [noWordBreak, setNoWordBreak] = useState(true);
  const [delim, setDelim] = useState<Delim>('blank');
  const [customDelim, setCustomDelim] = useState('===');
  const [label, setLabel] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      const n = Math.floor(Number(size));
      if (!Number.isFinite(n) || n < 1) {
        throw new Error('Enter a chunk size of 1 or more.');
      }
      if (n > 100000) {
        throw new Error('Chunk size is too large (max 100000).');
      }

      let chunks: string[];
      if (mode === 'chars') chunks = chunkByChars(input, n, noWordBreak);
      else if (mode === 'words') chunks = chunkByWords(input, n);
      else chunks = chunkByLines(input, n);

      const total = chunks.length;
      const separator =
        delim === 'blank' ? '\n\n' : delim === 'rule' ? '\n\n---\n\n' : `\n\n${customDelim}\n\n`;

      const labeled = label
        ? chunks.map((c, i) => `Part ${i + 1}/${total} ${c.trim()}`)
        : chunks;

      return labeled.join(separator);
    },
    [mode, size, noWordBreak, delim, customDelim, label],
  );

  const sizeHint =
    mode === 'chars' ? 'characters per chunk' : mode === 'words' ? 'words per chunk' : 'lines per chunk';

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, size, noWordBreak, delim, customDelim, label]}
      inputLabel="Text"
      outputLabel="Chunks"
      inputPlaceholder="Paste a long message to split…"
      sample={
        'This is a fairly long message that you might want to break up into several smaller pieces so it fits inside a strict character limit such as an SMS or a social media post. Each piece can be labeled automatically.'
      }
      downloadName="chunks.txt"
      options={
        <>
          <Field label="Split by">
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chars">Characters</SelectItem>
                <SelectItem value="words">Words</SelectItem>
                <SelectItem value="lines">Lines</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Size" hint={sizeHint}>
            <Input
              value={size}
              onChange={(e) => setSize(e.target.value)}
              inputMode="numeric"
              className="w-24"
            />
          </Field>
          {mode === 'chars' && (
            <Field label="Avoid splitting words" hint="Break at whitespace">
              <Switch checked={noWordBreak} onCheckedChange={setNoWordBreak} />
            </Field>
          )}
          <Field label="Separator">
            <Select value={delim} onValueChange={(v) => setDelim(v as Delim)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="blank">Blank line</SelectItem>
                <SelectItem value="rule">--- rule</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {delim === 'custom' && (
            <Field label="Custom separator">
              <Input
                value={customDelim}
                onChange={(e) => setCustomDelim(e.target.value)}
                className="w-28"
              />
            </Field>
          )}
          <Field label="Label parts" hint="Prefix 'Part 1/N'">
            <Switch checked={label} onCheckedChange={setLabel} />
          </Field>
        </>
      }
    />
  );
}
