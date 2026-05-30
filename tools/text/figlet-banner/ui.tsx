'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type FontName = 'banner' | 'block' | 'small';
type Justify = 'left' | 'center' | 'right';

// 5x5 bitmap font. '1' = filled pixel. Uppercase only; lowercase folds up.
// Unknown characters fall back to a blank glyph (rendered as spaces).
const BITMAP: Record<string, string[]> = {
  A: ['01110', '10001', '11111', '10001', '10001'],
  B: ['11110', '10001', '11110', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '11110', '10000', '11111'],
  F: ['11111', '10000', '11110', '10000', '10000'],
  G: ['01111', '10000', '10011', '10001', '01111'],
  H: ['10001', '10001', '11111', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '11100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001'],
  O: ['01110', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '11110', '10000', '10000'],
  Q: ['01110', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '11110', '10010', '10001'],
  S: ['01111', '10000', '01110', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10101', '11011', '10001'],
  X: ['10001', '01010', '00100', '01010', '10001'],
  Y: ['10001', '01010', '00100', '00100', '00100'],
  Z: ['11111', '00010', '00100', '01000', '11111'],
  '0': ['01110', '10011', '10101', '11001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00110', '01000', '11111'],
  '3': ['11110', '00001', '01110', '00001', '11110'],
  '4': ['00010', '00110', '01010', '11111', '00010'],
  '5': ['11111', '10000', '11110', '00001', '11110'],
  '6': ['01110', '10000', '11110', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '00100'],
  '8': ['01110', '10001', '01110', '10001', '01110'],
  '9': ['01110', '10001', '01111', '00001', '01110'],
  '.': ['00000', '00000', '00000', '00000', '00100'],
  ',': ['00000', '00000', '00000', '00100', '01000'],
  '!': ['00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00110', '00000', '00100'],
  ':': ['00000', '00100', '00000', '00100', '00000'],
  ';': ['00000', '00100', '00000', '00100', '01000'],
  '-': ['00000', '00000', '11111', '00000', '00000'],
  '+': ['00000', '00100', '01110', '00100', '00000'],
  '=': ['00000', '11111', '00000', '11111', '00000'],
  '*': ['10101', '01110', '11111', '01110', '10101'],
  '/': ['00001', '00010', '00100', '01000', '10000'],
  '\\': ['10000', '01000', '00100', '00010', '00001'],
  '(': ['00110', '01000', '01000', '01000', '00110'],
  ')': ['01100', '00010', '00010', '00010', '01100'],
  '<': ['00010', '00100', '01000', '00100', '00010'],
  '>': ['01000', '00100', '00010', '00100', '01000'],
  '@': ['01110', '10011', '10111', '10000', '01111'],
  '#': ['01010', '11111', '01010', '11111', '01010'],
  '&': ['01100', '10010', '01100', '10011', '01101'],
  '$': ['01111', '10100', '01110', '00101', '11110'],
  '%': ['11001', '11010', '00100', '01011', '10011'],
  "'": ['00100', '00100', '00000', '00000', '00000'],
  '"': ['01010', '01010', '00000', '00000', '00000'],
};

const BLANK = ['00000', '00000', '00000', '00000', '00000'];

interface Style {
  rows: number;
  // map a glyph (5x5 bitmap) to its rendered rows for this font
  render: (bitmap: string[]) => string[];
}

// Banner: each pixel becomes '#' (on) or ' ' (off), 5 rows tall, 1:1.
function bannerRender(bm: string[]): string[] {
  const out: string[] = [];
  for (let r = 0; r < 5; r++) {
    const row = bm[r] ?? '00000';
    let line = '';
    for (const c of row) line += c === '1' ? '#' : ' ';
    out.push(line);
  }
  return out;
}

// Block: each on-pixel becomes two columns of a heavy block char for a chunky look.
function blockRender(bm: string[]): string[] {
  const out: string[] = [];
  for (let r = 0; r < 5; r++) {
    const row = bm[r] ?? '00000';
    let line = '';
    for (const c of row) line += c === '1' ? '██' : '  ';
    out.push(line);
  }
  return out;
}

// Small: compress 5 rows into 3 by OR-merging row pairs; on-pixel becomes 'o'.
function smallRender(bm: string[]): string[] {
  const r0 = bm[0] ?? '00000';
  const r1 = bm[1] ?? '00000';
  const r2 = bm[2] ?? '00000';
  const r3 = bm[3] ?? '00000';
  const r4 = bm[4] ?? '00000';
  const merge = (a: string, b: string): string => {
    let s = '';
    for (let i = 0; i < 5; i++) {
      const on = (a[i] ?? '0') === '1' || (b[i] ?? '0') === '1';
      s += on ? 'o' : ' ';
    }
    return s;
  };
  const top = merge(r0, r1);
  const mid = merge(r2, '00000');
  const bot = merge(r3, r4);
  return [top, mid, bot];
}

const STYLES: Record<FontName, Style> = {
  banner: { rows: 5, render: bannerRender },
  block: { rows: 5, render: blockRender },
  small: { rows: 3, render: smallRender },
};

function glyphFor(ch: string): string[] {
  const up = ch.toUpperCase();
  return BITMAP[up] ?? BITMAP[ch] ?? BLANK;
}

function renderBanner(
  text: string,
  font: FontName,
  spacing: number,
  justify: Justify,
  width: number
): string[] {
  const style = STYLES[font];
  const rows = style.rows;
  const lines: string[] = new Array<string>(rows).fill('');
  const gap = ' '.repeat(Math.max(0, spacing));

  const chars = Array.from(text);
  chars.forEach((ch, idx) => {
    if (ch === ' ') {
      const sp = font === 'block' ? '      ' : '   ';
      for (let r = 0; r < rows; r++) lines[r] = (lines[r] ?? '') + sp;
      return;
    }
    const glyph = style.render(glyphFor(ch));
    for (let r = 0; r < rows; r++) {
      const piece = glyph[r] ?? '';
      const sep = idx < chars.length - 1 ? gap : '';
      lines[r] = (lines[r] ?? '') + piece + sep;
    }
  });

  // Justify each line within width.
  if (width > 0) {
    const maxLen = lines.reduce((m, l) => Math.max(m, l.length), 0);
    return lines.map((l) => {
      const trimmedRight = l.replace(/\s+$/u, '');
      const len = Math.max(trimmedRight.length, maxLen);
      const padTotal = Math.max(0, width - len);
      if (justify === 'right') return ' '.repeat(padTotal) + l;
      if (justify === 'center') return ' '.repeat(Math.floor(padTotal / 2)) + l;
      return l;
    });
  }
  return lines;
}

export default function FigletBannerTool() {
  const [text, setText] = useState('HELLO');
  const [font, setFont] = useState<FontName>('banner');
  const [spacing, setSpacing] = useState(1);
  const [justify, setJustify] = useState<Justify>('left');
  const [width, setWidth] = useState(80);

  const { output, error } = useMemo(() => {
    if (text.length > 60) {
      return { output: '', error: 'Keep text to 60 characters or fewer.' };
    }
    if (text === '') return { output: '', error: null };
    const lines = renderBanner(text, font, spacing, justify, width);
    return { output: lines.join('\n'), error: null };
  }, [text, font, spacing, justify, width]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Text" className="min-w-[200px] flex-1">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a short banner…"
              spellCheck={false}
            />
          </Field>
          <Field label="Font">
            <Select value={font} onValueChange={(v) => setFont(v as FontName)}>
              <SelectTrigger className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="banner">Banner (#)</SelectItem>
                <SelectItem value="block">Block (█)</SelectItem>
                <SelectItem value="small">Small (o)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Justify">
            <Select value={justify} onValueChange={(v) => setJustify(v as Justify)}>
              <SelectTrigger className="h-8 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={`Spacing: ${spacing}`} className="min-w-[160px]">
            <Slider
              value={[spacing]}
              min={0}
              max={6}
              step={1}
              onValueChange={(v) => setSpacing(v[0] ?? 1)}
            />
          </Field>
          <Field label={`Width: ${width}`} className="min-w-[160px]">
            <Slider
              value={[width]}
              min={0}
              max={160}
              step={1}
              onValueChange={(v) => setWidth(v[0] ?? 0)}
            />
          </Field>
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {output && (
        <Panel>
          <PanelHeader title="Banner">
            <CopyButton value={() => output} />
            <DownloadButton data={() => output} filename="banner.txt" />
          </PanelHeader>
          <pre className="overflow-auto p-3 font-mono text-xs leading-tight whitespace-pre">
            {output}
          </pre>
          <StatBar items={[`${STYLES[font].rows} rows`, `${Array.from(text).length} chars`]} />
        </Panel>
      )}
    </div>
  );
}
