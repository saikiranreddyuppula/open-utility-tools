'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Panel,
  PanelHeader,
  OptionsBar,
  Field,
  StatBar,
} from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Point = { x: number; y: number };

const SIZE = 260; // SVG drawing area (the curve box is square)
const PAD = 40; // padding so y values >1 / <0 (overshoot) stay visible

const PRESETS: Record<string, [number, number, number, number]> = {
  ease: [0.25, 0.1, 0.25, 1],
  linear: [0, 0, 1, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
  'ease-in-back': [0.36, 0, 0.66, -0.56],
  'ease-out-back': [0.34, 1.56, 0.64, 1],
  bounce: [0.68, -0.55, 0.27, 1.55],
};

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// Convert a normalized bezier coordinate to SVG pixel space.
// x in [0,1] maps to [0, SIZE]; y is flipped (0 at bottom) and can exceed [0,1].
function toSvgX(x: number): number {
  return x * SIZE;
}
function toSvgY(y: number): number {
  return SIZE - y * SIZE;
}
function fromSvgX(px: number): number {
  return px / SIZE;
}
function fromSvgY(py: number): number {
  return (SIZE - py) / SIZE;
}

export default function CubicBezierTool() {
  const [p1, setP1] = useState<Point>({ x: 0.25, y: 0.1 });
  const [p2, setP2] = useState<Point>({ x: 0.25, y: 1 });
  const [dragging, setDragging] = useState<1 | 2 | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const value = useMemo(
    () =>
      `cubic-bezier(${round(p1.x)}, ${round(p1.y)}, ${round(p2.x)}, ${round(p2.y)})`,
    [p1, p2],
  );

  const css = useMemo(
    () => `transition-timing-function: ${value};`,
    [value],
  );

  const presetMatch = useMemo(() => {
    for (const [name, [a, b, c, d]] of Object.entries(PRESETS)) {
      if (
        round(p1.x) === a &&
        round(p1.y) === b &&
        round(p2.x) === c &&
        round(p2.y) === d
      ) {
        return name;
      }
    }
    return 'custom';
  }, [p1, p2]);

  const updateFromEvent = useCallback(
    (clientX: number, clientY: number, which: 1 | 2) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      // map client coords into the SVG's internal coordinate system.
      // The viewBox is [-PAD, -PAD, SIZE+2PAD, SIZE+2PAD] and the element is square.
      const vbW = SIZE + 2 * PAD;
      const localX = ((clientX - rect.left) / rect.width) * vbW - PAD;
      const localY = ((clientY - rect.top) / rect.height) * vbW - PAD;
      let nx = fromSvgX(localX);
      const ny = fromSvgY(localY);
      // x is clamped to [0,1] per CSS spec; y is unconstrained (overshoot allowed)
      nx = Math.min(Math.max(nx, 0), 1);
      const next = { x: round(nx), y: round(Math.min(Math.max(ny, -1), 2)) };
      if (which === 1) setP1(next);
      else setP2(next);
    },
    [],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!dragging) return;
      e.preventDefault();
      updateFromEvent(e.clientX, e.clientY, dragging);
    },
    [dragging, updateFromEvent],
  );

  const applyPreset = (name: string) => {
    const preset = PRESETS[name];
    if (!preset) return;
    const [a, b, c, d] = preset;
    setP1({ x: a, y: b });
    setP2({ x: c, y: d });
    setAnimKey((k) => k + 1);
  };

  const curvePath = useMemo(() => {
    const start = `M ${toSvgX(0)} ${toSvgY(0)}`;
    const c = `C ${toSvgX(p1.x)} ${toSvgY(p1.y)}, ${toSvgX(p2.x)} ${toSvgY(p2.y)}, ${toSvgX(1)} ${toSvgY(1)}`;
    return `${start} ${c}`;
  }, [p1, p2]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <PanelHeader title="Curve">
          <CopyButton value={value} />
        </PanelHeader>
        <OptionsBar>
          <Field label="Preset">
            <Select
              value={presetMatch === 'custom' ? '' : presetMatch}
              onValueChange={(v) => applyPreset(v)}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Custom" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(PRESETS).map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </OptionsBar>
        <div className="flex justify-center">
          <svg
            ref={svgRef}
            viewBox={`${-PAD} ${-PAD} ${SIZE + 2 * PAD} ${SIZE + 2 * PAD}`}
            className="aspect-square w-full max-w-[340px] touch-none select-none"
            onPointerMove={onPointerMove}
            onPointerUp={() => setDragging(null)}
            onPointerLeave={() => setDragging(null)}
          >
            {/* grid box */}
            <rect
              x={0}
              y={0}
              width={SIZE}
              height={SIZE}
              className="fill-muted/40 stroke-border"
              strokeWidth={1}
            />
            {/* diagonal reference (linear) */}
            <line
              x1={toSvgX(0)}
              y1={toSvgY(0)}
              x2={toSvgX(1)}
              y2={toSvgY(1)}
              className="stroke-border"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            {/* handles */}
            <line
              x1={toSvgX(0)}
              y1={toSvgY(0)}
              x2={toSvgX(p1.x)}
              y2={toSvgY(p1.y)}
              className="stroke-primary/60"
              strokeWidth={1.5}
            />
            <line
              x1={toSvgX(1)}
              y1={toSvgY(1)}
              x2={toSvgX(p2.x)}
              y2={toSvgY(p2.y)}
              className="stroke-primary/60"
              strokeWidth={1.5}
            />
            {/* the curve */}
            <path
              d={curvePath}
              className="fill-none stroke-primary"
              strokeWidth={2.5}
            />
            {/* endpoints */}
            <circle cx={toSvgX(0)} cy={toSvgY(0)} r={4} className="fill-foreground" />
            <circle cx={toSvgX(1)} cy={toSvgY(1)} r={4} className="fill-foreground" />
            {/* draggable control points */}
            <circle
              cx={toSvgX(p1.x)}
              cy={toSvgY(p1.y)}
              r={8}
              className="cursor-grab fill-primary active:cursor-grabbing"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setDragging(1);
              }}
            />
            <circle
              cx={toSvgX(p2.x)}
              cy={toSvgY(p2.y)}
              r={8}
              className="cursor-grab fill-primary active:cursor-grabbing"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setDragging(2);
              }}
            />
          </svg>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Preview" />
        <div className="space-y-4">
          <div className="relative h-16 rounded-md border bg-muted/40">
            <div
              key={animKey}
              className="absolute top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-primary"
              style={{
                left: 0,
                animationName: 'cb-move',
                animationDuration: '1.6s',
                animationTimingFunction: value,
                animationIterationCount: 'infinite',
                animationDirection: 'alternate',
              }}
            />
            <style>{`@keyframes cb-move { from { left: 0; } to { left: calc(100% - 2rem); } }`}</style>
          </div>
          <Button variant="outline" onClick={() => setAnimKey((k) => k + 1)}>
            Replay
          </Button>
          <div className="flex items-center gap-2">
            <code className="block flex-1 overflow-x-auto rounded bg-muted px-3 py-2 font-mono text-sm">
              {value}
            </code>
            <CopyButton value={value} />
          </div>
          <div className="flex items-center gap-2">
            <code className="block flex-1 overflow-x-auto rounded bg-muted px-3 py-2 font-mono text-sm">
              {css}
            </code>
            <CopyButton value={css} />
          </div>
        </div>
        <StatBar
          items={[
            `P1 (${round(p1.x)}, ${round(p1.y)})`,
            `P2 (${round(p2.x)}, ${round(p2.y)})`,
            presetMatch === 'custom' ? 'custom' : presetMatch,
          ]}
        />
      </Panel>
    </div>
  );
}
