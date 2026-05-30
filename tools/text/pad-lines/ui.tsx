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

type Mode = 'pad' | 'zero-number';
type Align = 'left' | 'right' | 'center';
type WidthMode = 'fixed' | 'longest';
type FillKind = 'space' | 'zero' | 'dot' | 'dash' | 'custom';

const SAMPLE = ['1 Intro', '2 Setup', '10 Advanced topics', '100 Appendix'].join('\n');

function fillChar(kind: FillKind, custom: string): string {
  switch (kind) {
    case 'space':
      return ' ';
    case 'zero':
      return '0';
    case 'dot':
      return '.';
    case 'dash':
      return '-';
    case 'custom': {
      const arr = [...custom];
      return arr[0] ?? ' ';
    }
    default:
      return ' ';
  }
}

/** Code-point aware length. */
function cpLen(s: string): number {
  return [...s].length;
}

/** Take the first n code points of s. */
function cpSlice(s: string, n: number): string {
  return [...s].slice(0, Math.max(0, n)).join('');
}

function padTo(line: string, width: number, fill: string, align: Align): string {
  const len = cpLen(line);
  if (len >= width) return line;
  const total = width - len;
  if (align === 'left') {
    return line + fill.repeat(total);
  }
  if (align === 'right') {
    return fill.repeat(total) + line;
  }
  const left = Math.floor(total / 2);
  const right = total - left;
  return fill.repeat(left) + line + fill.repeat(right);
}

export default function PadLinesTool() {
  const [mode, setMode] = useState<Mode>('pad');
  const [align, setAlign] = useState<Align>('left');
  const [widthMode, setWidthMode] = useState<WidthMode>('fixed');
  const [fixedWidth, setFixedWidth] = useState('12');
  const [extra, setExtra] = useState('0');
  const [fillKind, setFillKind] = useState<FillKind>('space');
  const [customFill, setCustomFill] = useState('.');
  const [truncate, setTruncate] = useState(false);
  const [digits, setDigits] = useState('3');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      const lines = input.split('\n');

      if (mode === 'zero-number') {
        const pad = (() => {
          const n = Number(digits);
          return Number.isFinite(n) && n >= 1 ? Math.trunc(n) : 3;
        })();
        return lines
          .map((line) => {
            const m = line.match(/^(\s*)(\d+)(.*)$/);
            if (!m) return line;
            const lead = m[1] ?? '';
            const num = m[2] ?? '';
            const rest = m[3] ?? '';
            return lead + num.padStart(pad, '0') + rest;
          })
          .join('\n');
      }

      const fill = fillChar(fillKind, customFill);
      const width = (() => {
        if (widthMode === 'fixed') {
          const n = Number(fixedWidth);
          return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
        }
        // longest line + N
        const longest = lines.reduce((max, l) => Math.max(max, cpLen(l)), 0);
        const n = Number(extra);
        const add = Number.isFinite(n) ? Math.trunc(n) : 0;
        return longest + add;
      })();

      return lines
        .map((line) => {
          if (cpLen(line) > width && truncate) {
            return cpSlice(line, width);
          }
          return padTo(line, width, fill, align);
        })
        .join('\n');
    },
    [mode, align, widthMode, fixedWidth, extra, fillKind, customFill, truncate, digits]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, align, widthMode, fixedWidth, extra, fillKind, customFill, truncate, digits]}
      inputLabel="Lines"
      outputLabel="Padded lines"
      sample={SAMPLE}
      downloadName="padded.txt"
      options={
        <>
          <Field label="Mode">
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pad">Pad to width</SelectItem>
                <SelectItem value="zero-number">Zero-pad leading number</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {mode === 'pad' ? (
            <>
              <Field label="Align">
                <Select value={align} onValueChange={(v) => setAlign(v as Align)}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Width">
                <Select value={widthMode} onValueChange={(v) => setWidthMode(v as WidthMode)}>
                  <SelectTrigger className="w-[170px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed width</SelectItem>
                    <SelectItem value="longest">Longest line + N</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {widthMode === 'fixed' ? (
                <Field label="Target width">
                  <Input
                    value={fixedWidth}
                    onChange={(e) => setFixedWidth(e.target.value)}
                    className="w-[100px]"
                    inputMode="numeric"
                  />
                </Field>
              ) : (
                <Field label="Extra (N)">
                  <Input
                    value={extra}
                    onChange={(e) => setExtra(e.target.value)}
                    className="w-[100px]"
                    inputMode="numeric"
                  />
                </Field>
              )}
              <Field label="Fill">
                <Select value={fillKind} onValueChange={(v) => setFillKind(v as FillKind)}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="space">Space</SelectItem>
                    <SelectItem value="zero">Zero (0)</SelectItem>
                    <SelectItem value="dot">Dot (.)</SelectItem>
                    <SelectItem value="dash">Dash (-)</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {fillKind === 'custom' && (
                <Field label="Fill char">
                  <Input
                    value={customFill}
                    onChange={(e) => setCustomFill(e.target.value)}
                    className="w-[90px]"
                    placeholder="."
                  />
                </Field>
              )}
              <Field label="Long lines">
                <div className="flex h-9 items-center gap-2">
                  <Checkbox
                    id="pad-trunc"
                    checked={truncate}
                    onCheckedChange={(v) => setTruncate(v === true)}
                  />
                  <Label htmlFor="pad-trunc" className="text-xs font-normal">
                    Truncate to width
                  </Label>
                </div>
              </Field>
            </>
          ) : (
            <Field label="Digits">
              <Input
                value={digits}
                onChange={(e) => setDigits(e.target.value)}
                className="w-[100px]"
                inputMode="numeric"
              />
            </Field>
          )}
        </>
      }
    />
  );
}
