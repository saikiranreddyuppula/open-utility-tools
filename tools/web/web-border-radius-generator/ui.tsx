'use client';

import { useMemo, useState } from 'react';
import { Shuffle } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Unit = 'px' | '%' | 'em' | 'rem';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

// Corner order for border-radius: top-left, top-right, bottom-right, bottom-left.
const CORNERS = ['Top-left', 'Top-right', 'Bottom-right', 'Bottom-left'] as const;

/** Collapse 4 horizontal values into the shortest CSS list (1/2/3/4 values). */
function collapse4(vals: [number, number, number, number], unit: Unit): string {
  const [tl, tr, br, bl] = vals;
  const s = (n: number) => `${n}${unit}`;
  if (tl === tr && tr === br && br === bl) return s(tl);
  if (tl === br && tr === bl) return `${s(tl)} ${s(tr)}`;
  if (tr === bl) return `${s(tl)} ${s(tr)} ${s(br)}`;
  return `${s(tl)} ${s(tr)} ${s(br)} ${s(bl)}`;
}

function maxFor(unit: Unit): number {
  return unit === '%' ? 50 : unit === 'px' ? 200 : 10;
}

export default function BorderRadiusGeneratorTool() {
  const [h, setH] = useState<[number, number, number, number]>([24, 24, 24, 24]);
  const [v, setV] = useState<[number, number, number, number]>([24, 24, 24, 24]);
  const [unit, setUnit] = useState<Unit>('px');
  const [linked, setLinked] = useState(true);
  const [elliptical, setElliptical] = useState(false);

  const withIndex = (
    prev: [number, number, number, number],
    i: number,
    n: number,
  ): [number, number, number, number] => [
    i === 0 ? n : (prev[0] ?? 0),
    i === 1 ? n : (prev[1] ?? 0),
    i === 2 ? n : (prev[2] ?? 0),
    i === 3 ? n : (prev[3] ?? 0),
  ];

  const setHorizontal = (i: number, n: number) => {
    if (linked) {
      setH([n, n, n, n]);
      setV([n, n, n, n]);
      return;
    }
    setH((prev) => withIndex(prev, i, n));
  };

  const setVertical = (i: number, n: number) => {
    if (linked) {
      setV([n, n, n, n]);
      return;
    }
    setV((prev) => withIndex(prev, i, n));
  };

  const value = useMemo(() => {
    const hPart = collapse4(h, unit);
    if (!elliptical) return hPart;
    // elliptical: horizontal / vertical
    const allEqual = h.every((x, i) => x === v[i]);
    if (allEqual) return hPart;
    const vPart = collapse4(v, unit);
    return `${hPart} / ${vPart}`;
  }, [h, v, unit, elliptical]);

  const css = `border-radius: ${value};`;

  const randomBlob = () => {
    const mx = maxFor(unit);
    const rnd = () => {
      const buf = new Uint32Array(1);
      wc.getRandomValues(buf);
      const r = (buf[0] ?? 0) / 0xffffffff;
      return Math.round(r * mx);
    };
    const nh: [number, number, number, number] = [rnd(), rnd(), rnd(), rnd()];
    const nv: [number, number, number, number] = [rnd(), rnd(), rnd(), rnd()];
    setLinked(false);
    setElliptical(true);
    setH(nh);
    setV(nv);
  };

  const mx = maxFor(unit);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Unit" className="w-28">
            <Select
              value={unit}
              onValueChange={(x) => setUnit(x as Unit)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="px">px</SelectItem>
                <SelectItem value="%">%</SelectItem>
                <SelectItem value="em">em</SelectItem>
                <SelectItem value="rem">rem</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Link all corners">
            <div className="flex h-9 items-center">
              <Switch checked={linked} onCheckedChange={setLinked} />
            </div>
          </Field>
          <Field label="Elliptical (separate H/V)">
            <div className="flex h-9 items-center">
              <Switch checked={elliptical} onCheckedChange={setElliptical} />
            </div>
          </Field>
          <div className="flex items-end">
            <Button variant="secondary" size="sm" onClick={randomBlob}>
              <Shuffle className="size-3.5" /> Random blob
            </Button>
          </div>
        </OptionsBar>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Corners" />
          <div className="space-y-4 p-3">
            {CORNERS.map((name, i) => {
              const hv = h[i] ?? 0;
              const vv = v[i] ?? 0;
              return (
                <div key={name} className="space-y-2">
                  <div className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                    {name}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-6 shrink-0 text-2xs text-muted-foreground">
                      {elliptical ? 'H' : ''}
                    </span>
                    <Slider
                      value={[hv]}
                      min={0}
                      max={mx}
                      step={1}
                      onValueChange={(vals) => setHorizontal(i, vals[0] ?? 0)}
                      className="flex-1"
                    />
                    <span className="w-16 shrink-0 text-right font-mono text-xs">
                      {hv}
                      {unit}
                    </span>
                  </div>
                  {elliptical && (
                    <div className="flex items-center gap-3">
                      <span className="w-6 shrink-0 text-2xs text-muted-foreground">V</span>
                      <Slider
                        value={[vv]}
                        min={0}
                        max={mx}
                        step={1}
                        onValueChange={(vals) => setVertical(i, vals[0] ?? 0)}
                        className="flex-1"
                      />
                      <span className="w-16 shrink-0 text-right font-mono text-xs">
                        {vv}
                        {unit}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Preview" />
          <div className="flex items-center justify-center p-6">
            <div
              className="h-56 w-full max-w-[320px] border-2 border-dashed border-primary/40 bg-gradient-to-br from-primary/20 to-primary/40"
              style={{ borderRadius: value }}
            />
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="CSS">
          <CopyButton value={() => css} />
        </PanelHeader>
        <div className="p-3">
          <code className="block overflow-x-auto whitespace-pre rounded-md border bg-muted/30 px-3 py-2 font-mono text-sm">
            {css}
          </code>
        </div>
        <StatBar
          items={[
            elliptical ? 'elliptical' : 'circular',
            linked ? 'corners linked' : 'per-corner',
            `unit: ${unit}`,
          ]}
        />
      </Panel>
    </div>
  );
}
