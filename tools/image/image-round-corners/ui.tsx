'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { ErrorBanner } from '@/components/tools/error-banner';

type Mode = 'rounded' | 'circle';
type RadiusUnit = 'px' | 'percent';

export default function ImageRoundCornersTool() {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('rounded');
  const [radius, setRadius] = useState(40);
  const [unit, setUnit] = useState<RadiusUnit>('px');
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const process = useCallback(
    (m: Mode, r: number, u: RadiusUnit) => {
      const base = baseRef.current;
      if (!base) return;
      const w = base.width;
      const h = base.height;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      if (!ctx) {
        setError('Canvas not supported.');
        return;
      }
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.beginPath();
      if (m === 'circle') {
        const cx = w / 2;
        const cy = h / 2;
        const rx = w / 2;
        const ry = h / 2;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      } else {
        const minSide = Math.min(w, h);
        let rad = u === 'percent' ? (minSide * r) / 100 : r;
        rad = Math.max(0, Math.min(rad, minSide / 2));
        // rounded rectangle path
        ctx.moveTo(rad, 0);
        ctx.lineTo(w - rad, 0);
        ctx.arcTo(w, 0, w, rad, rad);
        ctx.lineTo(w, h - rad);
        ctx.arcTo(w, h, w - rad, h, rad);
        ctx.lineTo(rad, h);
        ctx.arcTo(0, h, 0, h - rad, rad);
        ctx.lineTo(0, rad);
        ctx.arcTo(0, 0, rad, 0, rad);
      }
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(base, 0, 0, w, h);
      ctx.restore();
      setOutUrl(c.toDataURL('image/png'));
    },
    []
  );

  useEffect(() => {
    if (src) process(mode, radius, unit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, src]);

  const onFile = useCallback(
    (file: File) => {
      setError(null);
      const reader = new FileReader();
      reader.onload = () => {
        const url = typeof reader.result === 'string' ? reader.result : null;
        if (!url) {
          setError('Could not read file.');
          return;
        }
        const img = new globalThis.Image();
        img.onload = () => {
          const base = document.createElement('canvas');
          base.width = img.naturalWidth;
          base.height = img.naturalHeight;
          const ctx = base.getContext('2d');
          if (!ctx) {
            setError('Canvas not supported.');
            return;
          }
          ctx.drawImage(img, 0, 0);
          baseRef.current = base;
          setDims({ w: img.naturalWidth, h: img.naturalHeight });
          setSrc(url);
          process(mode, radius, unit);
        };
        img.onerror = () => setError('Could not load image.');
        img.src = url;
      };
      reader.onerror = () => setError('Could not read file.');
      reader.readAsDataURL(file);
    },
    [process, mode, radius, unit]
  );

  const maxRadius = unit === 'percent' ? 50 : Math.max(10, dims ? Math.floor(Math.min(dims.w, dims.h) / 2) : 400);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="size-3.5" /> Upload image
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="rounded">Rounded</TabsTrigger>
                <TabsTrigger value="circle">Circle / Ellipse</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>

          {mode === 'rounded' && (
            <>
              <Field label="Radius unit">
                <Select
                  value={unit}
                  onValueChange={(v) => {
                    const u = v as RadiusUnit;
                    const nextR = u === 'percent' ? Math.min(radius, 50) : radius;
                    setUnit(u);
                    setRadius(nextR);
                    if (src) process(mode, nextR, u);
                  }}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="px">Pixels</SelectItem>
                    <SelectItem value="percent">Percent</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label={`Radius: ${radius}${unit === 'percent' ? '%' : 'px'}`}
                className="min-w-[220px]"
              >
                <Slider
                  value={[Math.min(radius, maxRadius)]}
                  min={0}
                  max={maxRadius}
                  step={1}
                  onValueChange={(v) => {
                    const r = v[0] ?? 0;
                    setRadius(r);
                    if (src) process(mode, r, unit);
                  }}
                />
              </Field>
            </>
          )}
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {!src && (
        <p className="px-1 text-xs text-muted-foreground">
          Upload an image to round its corners by radius, or crop it to a circle/ellipse for an
          avatar. Output is a transparent PNG. Processed locally in your browser.
        </p>
      )}

      {src && outUrl && (
        <Panel>
          <PanelHeader title="Result" />
          <div className="flex flex-col items-center gap-3 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={outUrl}
              alt="rounded result"
              className="max-h-[460px] rounded border bg-[repeating-conic-gradient(#e5e5e5_0_25%,#fff_0_50%)] bg-[length:16px_16px]"
            />
            <a href={outUrl} download="rounded.png">
              <Button size="sm">Download PNG</Button>
            </a>
          </div>
          <StatBar
            items={[
              dims && `${dims.w}×${dims.h}px`,
              mode === 'circle'
                ? 'ellipse crop'
                : `radius ${radius}${unit === 'percent' ? '%' : 'px'}`,
              'transparent PNG',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
