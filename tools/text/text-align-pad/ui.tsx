'use client';

import { useCallback, useMemo, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Align = 'left' | 'right' | 'center';

const SAMPLE = ['apple', 'banana', 'kiwi', 'pomegranate', 'fig'].join('\n');

function center(line: string, width: number, fill: string): string {
  const total = width - line.length;
  if (total <= 0) return line;
  const left = Math.floor(total / 2);
  const right = total - left;
  return fill.repeat(left) + line + fill.repeat(right);
}

export default function TextAlignPadTool() {
  const [align, setAlign] = useState<Align>('left');
  const [widthStr, setWidthStr] = useState('20');
  const [fillStr, setFillStr] = useState(' ');
  const [autoWidth, setAutoWidth] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';

      // The fill must be exactly one character to keep widths predictable.
      const fill = fillStr.length === 0 ? ' ' : fillStr;
      if (fill.length !== 1) {
        throw new Error('Fill must be a single character.');
      }

      const lines = input.split('\n');

      let width: number;
      if (autoWidth) {
        width = lines.reduce((max, line) => Math.max(max, line.length), 0);
      } else {
        const parsed = Number(widthStr);
        if (!Number.isFinite(parsed) || parsed < 0) {
          throw new Error('Width must be a non-negative number.');
        }
        width = Math.floor(parsed);
      }

      return lines
        .map((line) => {
          if (line.length >= width) return line;
          if (align === 'left') return line.padEnd(width, fill);
          if (align === 'right') return line.padStart(width, fill);
          return center(line, width, fill);
        })
        .join('\n');
    },
    [align, widthStr, fillStr, autoWidth],
  );

  const options = useMemo(
    () => (
      <div className="flex flex-wrap items-end gap-4">
        <Field label="Alignment">
          <Tabs value={align} onValueChange={(v) => setAlign(v as Align)}>
            <TabsList>
              <TabsTrigger value="left">Left</TabsTrigger>
              <TabsTrigger value="right">Right</TabsTrigger>
              <TabsTrigger value="center">Center</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label="Width" hint={autoWidth ? 'auto (longest line)' : undefined}>
          <Input
            type="number"
            min={0}
            value={widthStr}
            onChange={(e) => setWidthStr(e.target.value)}
            disabled={autoWidth}
            className="w-28"
          />
        </Field>
        <Field label="Fill character">
          <Input
            value={fillStr}
            onChange={(e) => setFillStr(e.target.value)}
            maxLength={1}
            placeholder="(space)"
            className="w-20"
          />
        </Field>
        <Field label="Auto width" hint="fit to longest line">
          <Switch checked={autoWidth} onCheckedChange={setAutoWidth} />
        </Field>
      </div>
    ),
    [align, widthStr, fillStr, autoWidth],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[align, widthStr, fillStr, autoWidth]}
      inputLabel="Text"
      outputLabel="Aligned"
      inputPlaceholder="One item per line…"
      sample={SAMPLE}
      downloadName="aligned.txt"
      options={options}
    />
  );
}
