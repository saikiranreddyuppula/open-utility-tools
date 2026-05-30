'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Direction = 'row' | 'row-reverse' | 'column' | 'column-reverse';
type Wrap = 'nowrap' | 'wrap' | 'wrap-reverse';
type Justify =
  | 'flex-start'
  | 'flex-end'
  | 'center'
  | 'space-between'
  | 'space-around'
  | 'space-evenly';
type Align = 'stretch' | 'flex-start' | 'flex-end' | 'center' | 'baseline';
type AlignContent =
  | 'normal'
  | 'flex-start'
  | 'flex-end'
  | 'center'
  | 'space-between'
  | 'space-around'
  | 'stretch';

function opt<T extends string>(values: readonly T[]) {
  return values.map((v) => (
    <SelectItem key={v} value={v}>
      {v}
    </SelectItem>
  ));
}

const DIRECTIONS: readonly Direction[] = ['row', 'row-reverse', 'column', 'column-reverse'];
const WRAPS: readonly Wrap[] = ['nowrap', 'wrap', 'wrap-reverse'];
const JUSTIFY: readonly Justify[] = [
  'flex-start',
  'flex-end',
  'center',
  'space-between',
  'space-around',
  'space-evenly',
];
const ALIGN: readonly Align[] = ['stretch', 'flex-start', 'flex-end', 'center', 'baseline'];
const ALIGN_CONTENT: readonly AlignContent[] = [
  'normal',
  'flex-start',
  'flex-end',
  'center',
  'space-between',
  'space-around',
  'stretch',
];

export default function FlexboxGeneratorTool() {
  const [direction, setDirection] = useState<Direction>('row');
  const [wrap, setWrap] = useState<Wrap>('wrap');
  const [justify, setJustify] = useState<Justify>('flex-start');
  const [align, setAlign] = useState<Align>('stretch');
  const [alignContent, setAlignContent] = useState<AlignContent>('normal');
  const [gap, setGap] = useState(8);
  const [count, setCount] = useState(5);

  const css = useMemo(() => {
    const decls: string[] = ['  display: flex;'];
    if (direction !== 'row') decls.push(`  flex-direction: ${direction};`);
    if (wrap !== 'nowrap') decls.push(`  flex-wrap: ${wrap};`);
    if (justify !== 'flex-start') decls.push(`  justify-content: ${justify};`);
    if (align !== 'stretch') decls.push(`  align-items: ${align};`);
    if (alignContent !== 'normal') decls.push(`  align-content: ${alignContent};`);
    if (gap > 0) decls.push(`  gap: ${gap}px;`);

    const container = `.container {\n${decls.join('\n')}\n}`;
    const item = `.item {\n  flex: 0 1 auto;\n}`;
    return `${container}\n\n${item}`;
  }, [direction, wrap, justify, align, alignContent, gap]);

  const previewStyle: CSSProperties = {
    display: 'flex',
    flexDirection: direction,
    flexWrap: wrap,
    justifyContent: justify,
    alignItems: align,
    alignContent: alignContent === 'normal' ? undefined : alignContent,
    gap: `${gap}px`,
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader title="Container properties" />
        <div className="flex flex-col gap-4 p-3">
          <OptionsBar>
            <Field label="flex-direction">
              <Select value={direction} onValueChange={(v) => setDirection(v as Direction)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>{opt(DIRECTIONS)}</SelectContent>
              </Select>
            </Field>
            <Field label="flex-wrap">
              <Select value={wrap} onValueChange={(v) => setWrap(v as Wrap)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>{opt(WRAPS)}</SelectContent>
              </Select>
            </Field>
            <Field label="justify-content">
              <Select value={justify} onValueChange={(v) => setJustify(v as Justify)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>{opt(JUSTIFY)}</SelectContent>
              </Select>
            </Field>
            <Field label="align-items">
              <Select value={align} onValueChange={(v) => setAlign(v as Align)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>{opt(ALIGN)}</SelectContent>
              </Select>
            </Field>
            <Field label="align-content">
              <Select value={alignContent} onValueChange={(v) => setAlignContent(v as AlignContent)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>{opt(ALIGN_CONTENT)}</SelectContent>
              </Select>
            </Field>
          </OptionsBar>
          <OptionsBar>
            <Field label={`gap: ${gap}px`} className="min-w-[220px]">
              <Slider value={[gap]} min={0} max={60} step={1} onValueChange={(v) => setGap(v[0] ?? 0)} />
            </Field>
            <Field label={`items: ${count}`} className="min-w-[220px]">
              <Slider value={[count]} min={1} max={12} step={1} onValueChange={(v) => setCount(v[0] ?? 1)} />
            </Field>
          </OptionsBar>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Preview" />
        <div className="m-3 min-h-[220px] rounded-md border bg-muted/30 p-3" style={previewStyle}>
          {Array.from({ length: count }, (_, i) => (
            <div
              key={i}
              className="flex h-14 min-w-14 items-center justify-center rounded bg-primary/80 px-3 font-mono text-sm text-primary-foreground"
            >
              {i + 1}
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="CSS">
          <CopyButton value={() => css} />
        </PanelHeader>
        <pre className="overflow-x-auto whitespace-pre p-3 font-mono text-xs">{css}</pre>
        <StatBar items={[direction, `gap ${gap}px`, `${count} items`]} />
      </Panel>
    </div>
  );
}
