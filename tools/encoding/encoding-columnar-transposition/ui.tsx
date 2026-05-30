'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'encrypt' | 'decrypt';

/**
 * Column read order: index the keyword letters, sort by (letter, original
 * position) — ties broken left-to-right — and assign rank 0..n-1.
 * Returns an array `order` where order[r] = source column for read position r.
 */
function columnOrder(keyword: string): number[] {
  const chars = keyword.split('');
  const indexed = chars.map((c, i) => ({ c: c.toUpperCase(), i }));
  indexed.sort((a, b) => (a.c < b.c ? -1 : a.c > b.c ? 1 : a.i - b.i));
  return indexed.map((x) => x.i);
}

function normalizeKeyword(raw: string): string {
  const k = raw.replace(/\s+/g, '');
  if (k.length === 0) throw new Error('Enter a keyword (its length sets the column count).');
  return k;
}

function encrypt(text: string, keyword: string, pad: string, irregular: boolean): string {
  const k = normalizeKeyword(keyword);
  const cols = k.length;
  let body = text;
  if (!irregular) {
    const padCh = pad.length > 0 ? (pad[0] ?? 'X') : 'X';
    while (body.length % cols !== 0) body += padCh;
  }
  const order = columnOrder(k);
  let out = '';
  for (const col of order) {
    for (let row = col; row < body.length; row += cols) {
      out += body[row] ?? '';
    }
  }
  return out;
}

function decrypt(cipher: string, keyword: string): string {
  const k = normalizeKeyword(keyword);
  const cols = k.length;
  const len = cipher.length;
  const fullRows = Math.floor(len / cols);
  const longCols = len % cols; // first `longCols` source columns have an extra row
  const order = columnOrder(k);

  // Column heights by source-column index.
  const heights: number[] = [];
  for (let c = 0; c < cols; c += 1) heights[c] = fullRows + (c < longCols ? 1 : 0);

  // Slice ciphertext back into columns following the read order.
  const colData: string[] = new Array<string>(cols).fill('');
  let pos = 0;
  for (const col of order) {
    const h = heights[col] ?? 0;
    colData[col] = cipher.slice(pos, pos + h);
    pos += h;
  }

  // Read off row by row.
  let out = '';
  const rows = fullRows + (longCols > 0 ? 1 : 0);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const data = colData[c] ?? '';
      if (r < data.length) out += data[r] ?? '';
    }
  }
  return out;
}

function gridView(text: string, keyword: string, pad: string, irregular: boolean): string {
  const k = normalizeKeyword(keyword);
  const cols = k.length;
  let body = text;
  if (!irregular) {
    const padCh = pad.length > 0 ? (pad[0] ?? 'X') : 'X';
    while (body.length % cols !== 0) body += padCh;
  }
  const order = columnOrder(k);
  const rank: number[] = new Array<number>(cols).fill(0);
  order.forEach((srcCol, readPos) => {
    rank[srcCol] = readPos + 1;
  });
  const lines: string[] = [];
  lines.push(k.toUpperCase().split('').join(' '));
  lines.push(rank.join(' '));
  lines.push('-'.repeat(cols * 2));
  for (let i = 0; i < body.length; i += cols) {
    lines.push(body.slice(i, i + cols).split('').join(' '));
  }
  return lines.join('\n');
}

export default function ColumnarTranspositionTool() {
  const [mode, setMode] = useState<Mode>('encrypt');
  const [keyword, setKeyword] = useState('ZEBRAS');
  const [pad, setPad] = useState('X');
  const [irregular, setIrregular] = useState(false);
  const [showGrid, setShowGrid] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      if (mode === 'encrypt') {
        const cipher = encrypt(input, keyword, pad, irregular);
        if (!showGrid) return cipher;
        return `${cipher}\n\nGrid (numbers = column read order):\n${gridView(input, keyword, pad, irregular)}`;
      }
      return decrypt(input, keyword);
    },
    [mode, keyword, pad, irregular, showGrid],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, keyword, pad, irregular, showGrid]}
      inputLabel={mode === 'encrypt' ? 'Plaintext' : 'Ciphertext'}
      outputLabel={mode === 'encrypt' ? 'Ciphertext' : 'Plaintext'}
      inputPlaceholder={mode === 'encrypt' ? 'WEAREDISCOVEREDFLEEATONCE' : 'Paste ciphertext…'}
      sample={mode === 'encrypt' ? 'WEAREDISCOVEREDFLEEATONCE' : 'EVLNXACDTXESEAXROFOXDEECXWIREE'}
      downloadName="columnar.txt"
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="encrypt">Encrypt</TabsTrigger>
                <TabsTrigger value="decrypt">Decrypt</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Keyword" className="min-w-[160px]">
            <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="ZEBRAS" />
          </Field>
          {mode === 'encrypt' && !irregular && (
            <Field label="Pad char" className="w-24">
              <Input
                value={pad}
                onChange={(e) => setPad(e.target.value.slice(0, 1))}
                maxLength={1}
                placeholder="X"
              />
            </Field>
          )}
          {mode === 'encrypt' && (
            <Field label="Options">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="ct-irr"
                    checked={irregular}
                    onCheckedChange={(c) => setIrregular(c === true)}
                  />
                  <Label htmlFor="ct-irr">Ragged (no padding)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="ct-grid"
                    checked={showGrid}
                    onCheckedChange={(c) => setShowGrid(c === true)}
                  />
                  <Label htmlFor="ct-grid">Show grid</Label>
                </div>
              </div>
            </Field>
          )}
        </>
      }
    />
  );
}
