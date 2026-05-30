'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Direction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

const DIRECTIONS: Array<{ value: Direction; label: string }> = [
  { value: 'up', label: 'Up ▲' },
  { value: 'down', label: 'Down ▼' },
  { value: 'left', label: 'Left ◀' },
  { value: 'right', label: 'Right ▶' },
  { value: 'top-left', label: 'Top-left ◤' },
  { value: 'top-right', label: 'Top-right ◥' },
  { value: 'bottom-left', label: 'Bottom-left ◣' },
  { value: 'bottom-right', label: 'Bottom-right ◢' },
];

interface Borders {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

function clampHex(v: string): string {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : '#000000';
}

// Compute the four border declarations. width = triangle base, height = triangle height.
function computeBorders(dir: Direction, width: number, height: number, color: string): Borders {
  const c = clampHex(color);
  const w = `${width}px`;
  const hw = `${Math.round(width / 2)}px`;
  const h = `${height}px`;
  const T = (size: string) => `${size} solid transparent`;
  const C = (size: string) => `${size} solid ${c}`;

  switch (dir) {
    case 'up':
      // base on bottom; left/right transparent half-base, bottom colored (height)
      return { top: '0', right: T(hw), bottom: C(h), left: T(hw) };
    case 'down':
      return { top: C(h), right: T(hw), bottom: '0', left: T(hw) };
    case 'left':
      // vertical base = width (split top/bottom), colored right border = height (the point's reach)
      return { top: T(hw), right: C(h), bottom: T(hw), left: '0' };
    case 'right':
      return { top: T(hw), right: '0', bottom: T(hw), left: C(h) };
    case 'top-left':
      // right-angle corner triangle: top + left colored gives top-left filled corner
      return { top: C(h), right: T(w), bottom: '0', left: '0' };
    case 'top-right':
      return { top: C(h), right: '0', bottom: '0', left: T(w) };
    case 'bottom-left':
      return { top: '0', right: T(w), bottom: C(h), left: '0' };
    case 'bottom-right':
      return { top: '0', right: '0', bottom: C(h), left: T(w) };
    default:
      return { top: '0', right: T(hw), bottom: C(h), left: T(hw) };
  }
}

export default function CssTriangleGeneratorTool() {
  const [dir, setDir] = useState<Direction>('up');
  const [width, setWidth] = useState(80);
  const [height, setHeight] = useState(60);
  const [color, setColor] = useState('#4f46e5');

  const isDiagonal = dir.includes('-');

  const borders = useMemo(
    () => computeBorders(dir, width, height, color),
    [dir, width, height, color],
  );

  const css = useMemo(() => {
    const lines: string[] = ['  width: 0;', '  height: 0;'];
    // Only emit non-zero borders for clarity, but include explicit zeros so behavior is unambiguous.
    if (borders.top !== '0') lines.push(`  border-top: ${borders.top};`);
    if (borders.right !== '0') lines.push(`  border-right: ${borders.right};`);
    if (borders.bottom !== '0') lines.push(`  border-bottom: ${borders.bottom};`);
    if (borders.left !== '0') lines.push(`  border-left: ${borders.left};`);
    return `.triangle {\n${lines.join('\n')}\n}`;
  }, [borders]);

  const previewStyle: CSSProperties = {
    width: 0,
    height: 0,
    borderTop: borders.top === '0' ? undefined : borders.top,
    borderRight: borders.right === '0' ? undefined : borders.right,
    borderBottom: borders.bottom === '0' ? undefined : borders.bottom,
    borderLeft: borders.left === '0' ? undefined : borders.left,
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <PanelHeader title="Triangle" />
        <div className="space-y-4 p-3">
          <OptionsBar>
            <Field label="Direction" className="w-44">
              <Select value={dir} onValueChange={(v) => setDir(v as Direction)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIRECTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Color" className="w-36">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={clampHex(color)}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-10 shrink-0 cursor-pointer rounded border bg-transparent"
                  aria-label="Triangle color"
                />
                <Input value={color} onChange={(e) => setColor(e.target.value)} className="font-mono" />
              </div>
            </Field>
          </OptionsBar>
          <OptionsBar>
            <Field label={`Width (base): ${width}px`} className="min-w-[200px] flex-1">
              <Slider value={[width]} min={2} max={300} step={1} onValueChange={(v) => setWidth(v[0] ?? width)} />
            </Field>
            <Field label={`Height: ${height}px`} className="min-w-[200px] flex-1">
              <Slider value={[height]} min={2} max={300} step={1} onValueChange={(v) => setHeight(v[0] ?? height)} />
            </Field>
          </OptionsBar>
          {isDiagonal && (
            <p className="text-2xs text-muted-foreground">
              Diagonal (right-angle) triangles fill a corner. Width sets the horizontal leg, Height the vertical leg.
            </p>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Preview & CSS">
          <CopyButton value={() => css} label="Copy CSS" />
        </PanelHeader>
        <div className="flex min-h-[200px] items-center justify-center rounded-md border bg-muted/40 p-8">
          <div style={previewStyle} />
        </div>
        <div className="p-3">
          <pre className="overflow-auto whitespace-pre rounded bg-muted px-3 py-2 font-mono text-xs">{css}</pre>
        </div>
        <StatBar items={[dir, `base ${width}px`, `height ${height}px`]} />
      </Panel>
    </div>
  );
}
