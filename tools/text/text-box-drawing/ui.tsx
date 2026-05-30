'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TextToolLayout } from '@/components/tools/text-tool';

type StyleKey = 'ascii' | 'single' | 'double' | 'rounded' | 'bold' | 'hash' | 'star';
type Align = 'left' | 'center';

interface BorderChars {
  tl: string;
  tr: string;
  bl: string;
  br: string;
  h: string;
  v: string;
}

const STYLES: Record<StyleKey, BorderChars> = {
  ascii: { tl: '+', tr: '+', bl: '+', br: '+', h: '-', v: '|' },
  single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
  double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
  rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' },
  bold: { tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃' },
  hash: { tl: '#', tr: '#', bl: '#', br: '#', h: '#', v: '#' },
  star: { tl: '*', tr: '*', bl: '*', br: '*', h: '*', v: '*' },
};

function padLine(line: string, width: number, align: Align): string {
  const diff = width - line.length;
  if (diff <= 0) return line;
  if (align === 'center') {
    const left = Math.floor(diff / 2);
    const right = diff - left;
    return ' '.repeat(left) + line + ' '.repeat(right);
  }
  return line + ' '.repeat(diff);
}

export default function TextBoxDrawingTool() {
  const [style, setStyle] = useState<StyleKey>('single');
  const [align, setAlign] = useState<Align>('left');
  const [hPad, setHPad] = useState(1);
  const [vPad, setVPad] = useState(0);
  const [title, setTitle] = useState('');
  const [commentMode, setCommentMode] = useState(false);
  const [commentPrefix, setCommentPrefix] = useState('// ');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      const b = STYLES[style];
      const rawLines = input.split('\n');
      const contentWidth = rawLines.reduce(
        (max, l) => Math.max(max, l.length),
        Math.max(0, title.length),
      );
      const innerWidth = contentWidth + hPad * 2;

      const horiz = b.h.repeat(innerWidth);
      const topBorder = title
        ? (() => {
            const t = ` ${title} `;
            const remaining = Math.max(0, innerWidth - t.length);
            return `${b.tl}${b.h}${t}${b.h.repeat(remaining > 0 ? remaining - 1 : 0)}${b.tr}`;
          })()
        : `${b.tl}${horiz}${b.tr}`;
      const bottomBorder = `${b.bl}${horiz}${b.br}`;

      const padRow = `${b.v}${' '.repeat(innerWidth)}${b.v}`;
      const out: string[] = [topBorder];
      for (let i = 0; i < vPad; i += 1) out.push(padRow);
      for (const line of rawLines) {
        const padded = padLine(line, contentWidth, align);
        out.push(`${b.v}${' '.repeat(hPad)}${padded}${' '.repeat(hPad)}${b.v}`);
      }
      for (let i = 0; i < vPad; i += 1) out.push(padRow);
      out.push(bottomBorder);

      if (commentMode) {
        const prefix = commentPrefix.length > 0 ? commentPrefix : '// ';
        return out.map((l) => `${prefix}${l}`).join('\n');
      }
      return out.join('\n');
    },
    [style, align, hPad, vPad, title, commentMode, commentPrefix],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[style, align, hPad, vPad, title, commentMode, commentPrefix]}
      inputLabel="Text"
      outputLabel="Boxed"
      inputPlaceholder="Type one or more lines…"
      sample={'Build complete\nAll tests passing\nReady to deploy'}
      downloadName="box.txt"
      mono
      options={
        <>
          <Field label="Border style">
            <Select value={style} onValueChange={(v) => setStyle(v as StyleKey)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ascii">ASCII +-|</SelectItem>
                <SelectItem value="single">Single ┌─┐</SelectItem>
                <SelectItem value="double">Double ╔═╗</SelectItem>
                <SelectItem value="rounded">Rounded ╭─╮</SelectItem>
                <SelectItem value="bold">Bold ┏━┓</SelectItem>
                <SelectItem value="hash"># banner</SelectItem>
                <SelectItem value="star">* banner</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Alignment">
            <Tabs value={align} onValueChange={(v) => setAlign(v as Align)}>
              <TabsList>
                <TabsTrigger value="left">Left</TabsTrigger>
                <TabsTrigger value="center">Center</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label={`H padding: ${hPad}`} className="min-w-[160px]">
            <Slider
              value={[hPad]}
              min={0}
              max={6}
              step={1}
              onValueChange={(v) => setHPad(v[0] ?? 1)}
            />
          </Field>
          <Field label={`V padding: ${vPad}`} className="min-w-[160px]">
            <Slider
              value={[vPad]}
              min={0}
              max={4}
              step={1}
              onValueChange={(v) => setVPad(v[0] ?? 0)}
            />
          </Field>
          <Field label="Title" hint="Shown in the top border">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="optional"
              className="w-40"
            />
          </Field>
          <Field label="Comment box" hint="Prefix each line">
            <Switch checked={commentMode} onCheckedChange={setCommentMode} />
          </Field>
          {commentMode && (
            <Field label="Comment prefix">
              <Input
                value={commentPrefix}
                onChange={(e) => setCommentPrefix(e.target.value)}
                className="w-20"
              />
            </Field>
          )}
        </>
      }
    />
  );
}
