'use client';

import { useCallback, useState } from 'react';

import { Switch } from '@/components/ui/switch';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TextToolLayout } from '@/components/tools/text-tool';

type Layout = 'qwerty' | 'azerty' | 'dvorak';
type Direction = 'left' | 'right' | 'up' | 'down';
type Mode = 'encode' | 'decode';

// Each layout: three rows of unshifted lower-case keys.
const LAYOUTS: Record<Layout, string[]> = {
  qwerty: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'],
  azerty: ['azertyuiop', 'qsdfghjklm', 'wxcvbn'],
  dvorak: ['pyfgcrl', 'aoeuidhtns', 'qjkxbmwvz'],
};

interface Pos {
  row: number;
  col: number;
}

function buildIndex(layout: string[]): Map<string, Pos> {
  const idx = new Map<string, Pos>();
  layout.forEach((row, r) => {
    for (let c = 0; c < row.length; c += 1) {
      const ch = row[c];
      if (ch !== undefined) idx.set(ch, { row: r, col: c });
    }
  });
  return idx;
}

function shiftPos(layout: string[], pos: Pos, dir: Direction, step: number): string | null {
  const row = layout[pos.row];
  if (row === undefined) return null;

  if (dir === 'left' || dir === 'right') {
    const len = row.length;
    const delta = dir === 'right' ? step : -step;
    const nc = (((pos.col + delta) % len) + len) % len;
    return row[nc] ?? null;
  }

  // up / down: move across rows, keep the column if it exists in the target row.
  const numRows = layout.length;
  const delta = dir === 'down' ? step : -step;
  const nr = (((pos.row + delta) % numRows) + numRows) % numRows;
  const targetRow = layout[nr];
  if (targetRow === undefined) return null;
  // Clamp column into the target row so shorter rows still map.
  const nc = pos.col < targetRow.length ? pos.col : targetRow.length - 1;
  return targetRow[nc] ?? null;
}

function inverse(dir: Direction): Direction {
  switch (dir) {
    case 'left':
      return 'right';
    case 'right':
      return 'left';
    case 'up':
      return 'down';
    case 'down':
      return 'up';
    default:
      return 'right';
  }
}

export default function KeyboardShiftCipherTool() {
  const [layout, setLayout] = useState<Layout>('qwerty');
  const [dir, setDir] = useState<Direction>('right');
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<Mode>('encode');
  const [passthrough, setPassthrough] = useState(true);

  const transform = useCallback(
    (input: string): string => {
      if (!input) return '';
      const rows = LAYOUTS[layout];
      const index = buildIndex(rows);
      const effDir = mode === 'decode' ? inverse(dir) : dir;

      let out = '';
      for (const ch of input) {
        const lower = ch.toLowerCase();
        const pos = index.get(lower);
        if (pos === undefined) {
          out += ch; // not a letter on this layout — keep as-is
          continue;
        }
        const mapped = shiftPos(rows, pos, effDir, step);
        if (mapped === null) {
          out += passthrough ? ch : '';
          continue;
        }
        // Preserve original case.
        out += ch === lower ? mapped : mapped.toUpperCase();
      }
      return out;
    },
    [layout, dir, step, mode, passthrough]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[layout, dir, step, mode, passthrough]}
      sample="Hello World"
      inputLabel={mode === 'encode' ? 'Plain text' : 'Ciphertext'}
      outputLabel={mode === 'encode' ? 'Ciphertext' : 'Plain text'}
      downloadName="keyboard-cipher.txt"
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="encode">Encode</TabsTrigger>
                <TabsTrigger value="decode">Decode</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Direction">
            <Select value={dir} onValueChange={(v) => setDir(v as Direction)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="right">Right</SelectItem>
                <SelectItem value="up">Up</SelectItem>
                <SelectItem value="down">Down</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Layout">
            <Select value={layout} onValueChange={(v) => setLayout(v as Layout)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="qwerty">QWERTY</SelectItem>
                <SelectItem value="azerty">AZERTY</SelectItem>
                <SelectItem value="dvorak">Dvorak</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={`Step: ${step}`} className="min-w-[180px]">
            <Slider value={[step]} min={1} max={5} step={1} onValueChange={(v) => setStep(v[0] ?? 1)} />
          </Field>
          <Field label="Other keys">
            <label className="flex h-8 items-center gap-1.5 text-xs">
              <Switch checked={passthrough} onCheckedChange={setPassthrough} /> pass through
            </label>
          </Field>
        </>
      }
    />
  );
}
