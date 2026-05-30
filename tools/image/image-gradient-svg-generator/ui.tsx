'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type GradType = 'linear' | 'radial';

interface Stop {
  id: number;
  color: string;
  offset: number;
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

/** Convert a CSS angle (deg, 0 = to top) into SVG x1/y1/x2/y2 unit coordinates. */
function angleToLine(angleDeg: number): { x1: number; y1: number; x2: number; y2: number } {
  const a = ((angleDeg % 360) + 360) % 360;
  const rad = (a * Math.PI) / 180;
  // CSS gradient angle: 0deg points up. Vector direction:
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  // Map a centered unit vector to [0,1] gradient endpoints.
  const x1 = 0.5 - dx / 2;
  const y1 = 0.5 - dy / 2;
  const x2 = 0.5 + dx / 2;
  const y2 = 0.5 + dy / 2;
  return {
    x1: Math.round(x1 * 1000) / 1000,
    y1: Math.round(y1 * 1000) / 1000,
    x2: Math.round(x2 * 1000) / 1000,
    y2: Math.round(y2 * 1000) / 1000,
  };
}

let nextId = 3;

export default function GradientSvgGenerator() {
  const [type, setType] = useState<GradType>('linear');
  const [angle, setAngle] = useState(90);
  const [width, setWidth] = useState(400);
  const [height, setHeight] = useState(300);
  const [stops, setStops] = useState<Stop[]>([
    { id: 1, color: '#6366f1', offset: 0 },
    { id: 2, color: '#ec4899', offset: 100 },
  ]);
  const [pngError, setPngError] = useState<string | null>(null);

  const sorted = useMemo(() => [...stops].sort((a, b) => a.offset - b.offset), [stops]);

  const svg = useMemo(() => {
    const w = clamp(Math.round(width), 16, 4000);
    const h = clamp(Math.round(height), 16, 4000);
    const stopTags = sorted
      .map((s) => `      <stop offset="${clamp(s.offset, 0, 100)}%" stop-color="${s.color}"/>`)
      .join('\n');
    let gradDef: string;
    if (type === 'linear') {
      const { x1, y1, x2, y2 } = angleToLine(angle);
      gradDef = `    <linearGradient id="g" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">\n${stopTags}\n    </linearGradient>`;
    } else {
      gradDef = `    <radialGradient id="g" cx="0.5" cy="0.5" r="0.5">\n${stopTags}\n    </radialGradient>`;
    }
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
      `  <defs>`,
      gradDef,
      `  </defs>`,
      `  <rect width="100%" height="100%" fill="url(#g)"/>`,
      `</svg>`,
    ].join('\n');
  }, [type, angle, width, height, sorted]);

  const css = useMemo(() => {
    const parts = sorted.map((s) => `${s.color} ${clamp(s.offset, 0, 100)}%`).join(', ');
    if (type === 'linear') {
      return `background: linear-gradient(${angle}deg, ${parts});`;
    }
    return `background: radial-gradient(circle at center, ${parts});`;
  }, [type, angle, sorted]);

  const downloadPng = () => {
    setPngError(null);
    const w = clamp(Math.round(width), 16, 4000);
    const h = clamp(Math.round(height), 16, 4000);
    const img = new globalThis.Image();
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setPngError('Canvas not supported.');
        URL.revokeObjectURL(url);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob((out) => {
        if (!out) {
          setPngError('Could not export PNG.');
          return;
        }
        const a = document.createElement('a');
        const dl = URL.createObjectURL(out);
        a.href = dl;
        a.download = 'gradient.png';
        a.click();
        URL.revokeObjectURL(dl);
      }, 'image/png');
    };
    img.onerror = () => {
      setPngError('Could not rasterize SVG.');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const updateStop = (id: number, patch: Partial<Stop>) => {
    setStops((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };
  const addStop = () => {
    setStops((prev) => [...prev, { id: nextId++, color: '#22c55e', offset: 50 }]);
  };
  const removeStop = (id: number) => {
    setStops((prev) => (prev.length > 2 ? prev.filter((s) => s.id !== id) : prev));
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader title="Options" />
        <OptionsBar>
          <Field label="Type">
            <Select value={type} onValueChange={(v) => setType(v as GradType)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="linear">Linear</SelectItem>
                <SelectItem value="radial">Radial</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {type === 'linear' && (
            <Field label={`Angle: ${angle}°`} className="min-w-[200px]">
              <Slider min={0} max={360} step={1} value={[angle]} onValueChange={(v) => setAngle(v[0] ?? 90)} />
            </Field>
          )}
          <Field label="Width">
            <Input
              type="number"
              value={width}
              onChange={(e) => setWidth(Number(e.target.value) || 0)}
              className="w-24 font-mono"
            />
          </Field>
          <Field label="Height">
            <Input
              type="number"
              value={height}
              onChange={(e) => setHeight(Number(e.target.value) || 0)}
              className="w-24 font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Color stops">
          <Button variant="ghost" size="sm" onClick={addStop}>
            <Plus className="size-3.5" /> Add stop
          </Button>
        </PanelHeader>
        <div className="divide-y">
          {stops.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <Input
                type="color"
                value={s.color}
                onChange={(e) => updateStop(s.id, { color: e.target.value })}
                className="h-9 w-12 p-1"
              />
              <Input
                value={s.color}
                onChange={(e) => updateStop(s.id, { color: e.target.value })}
                className="w-28 font-mono"
              />
              <div className="flex min-w-[200px] flex-1 items-center gap-2">
                <span className="w-20 shrink-0 text-2xs uppercase tracking-wide text-muted-foreground">
                  Offset {clamp(s.offset, 0, 100)}%
                </span>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[s.offset]}
                  onValueChange={(v) => updateStop(s.id, { offset: v[0] ?? 0 })}
                />
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => removeStop(s.id)}
                disabled={stops.length <= 2}
                title="Remove stop"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Preview" />
        <div className="flex justify-center p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/svg+xml,${encodeURIComponent(svg)}`}
            alt="gradient preview"
            className="max-h-64 w-full max-w-lg rounded-md border"
          />
        </div>
      </Panel>

      <ErrorBanner error={pngError} />

      <Panel>
        <PanelHeader title="SVG markup">
          <Button variant="secondary" size="sm" onClick={downloadPng}>
            Download PNG
          </Button>
          <CopyButton value={svg} />
          <DownloadButton data={svg} filename="gradient.svg" mime="image/svg+xml" />
        </PanelHeader>
        <pre className="max-h-60 overflow-auto bg-card p-3 font-mono text-xs">{svg}</pre>
        <StatBar items={[`${type} gradient`, `${stops.length} stops`, `${svg.length} chars`]} />
      </Panel>

      <Panel>
        <PanelHeader title="CSS gradient">
          <CopyButton value={css} />
        </PanelHeader>
        <pre className="overflow-auto break-all whitespace-pre-wrap bg-card p-3 font-mono text-xs">{css}</pre>
      </Panel>
    </div>
  );
}
