'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ErrorBanner } from '@/components/tools/error-banner';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export default function ImagePixelateTool() {
  const [src, setSrc] = useState<string | null>(null);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [block, setBlock] = useState(12);
  const [regionMode, setRegionMode] = useState(false);
  const [region, setRegion] = useState<Rect | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const process = useCallback(
    (blockSize: number, reg: Rect | null) => {
      const base = baseRef.current;
      if (!base) return;
      const w = base.width;
      const h = base.height;
      const out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      const ctx = out.getContext('2d');
      if (!ctx) {
        setError('Canvas not supported.');
        return;
      }
      // start with the original image
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(base, 0, 0);

      const bs = Math.max(2, blockSize);
      // region to pixelate (full image if none)
      const rx = reg ? Math.max(0, Math.round(reg.x)) : 0;
      const ry = reg ? Math.max(0, Math.round(reg.y)) : 0;
      const rw = reg ? Math.min(w - rx, Math.round(reg.w)) : w;
      const rh = reg ? Math.min(h - ry, Math.round(reg.h)) : h;
      if (rw <= 0 || rh <= 0) {
        setOutUrl(out.toDataURL('image/png'));
        return;
      }

      const smallW = Math.max(1, Math.round(rw / bs));
      const smallH = Math.max(1, Math.round(rh / bs));
      const tmp = document.createElement('canvas');
      tmp.width = smallW;
      tmp.height = smallH;
      const tctx = tmp.getContext('2d');
      if (!tctx) {
        setError('Canvas not supported.');
        return;
      }
      // downscale the region (smoothing averages the block colors)
      tctx.imageSmoothingEnabled = true;
      tctx.imageSmoothingQuality = 'high';
      tctx.drawImage(base, rx, ry, rw, rh, 0, 0, smallW, smallH);
      // upscale back with nearest-neighbor into the region
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmp, 0, 0, smallW, smallH, rx, ry, rw, rh);

      setOutUrl(out.toDataURL('image/png'));
    },
    []
  );

  const drawView = useCallback(
    (reg: Rect | null) => {
      const base = baseRef.current;
      const view = viewRef.current;
      if (!base || !view) return;
      view.width = base.width;
      view.height = base.height;
      const ctx = view.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(base, 0, 0);
      if (reg) {
        ctx.strokeStyle = '#ff2d55';
        ctx.lineWidth = Math.max(2, base.width / 300);
        ctx.setLineDash([8, 6]);
        ctx.strokeRect(reg.x, reg.y, reg.w, reg.h);
      }
    },
    []
  );

  useEffect(() => {
    if (src) {
      drawView(region);
      process(block, region);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const onFile = useCallback(
    (file: File) => {
      setError(null);
      setRegion(null);
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
        };
        img.onerror = () => setError('Could not load image.');
        img.src = url;
      };
      reader.onerror = () => setError('Could not read file.');
      reader.readAsDataURL(file);
    },
    []
  );

  const evtPoint = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const view = viewRef.current;
    if (!view) return null;
    const rect = view.getBoundingClientRect();
    const scaleX = view.width / rect.width;
    const scaleY = view.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const onDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!regionMode) return;
      const p = evtPoint(e);
      if (!p) return;
      dragStart.current = p;
    },
    [regionMode, evtPoint]
  );

  const onDrag = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!regionMode || !dragStart.current) return;
      const p = evtPoint(e);
      if (!p) return;
      const s = dragStart.current;
      const reg: Rect = {
        x: Math.min(s.x, p.x),
        y: Math.min(s.y, p.y),
        w: Math.abs(p.x - s.x),
        h: Math.abs(p.y - s.y),
      };
      drawView(reg);
    },
    [regionMode, evtPoint, drawView]
  );

  const onUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!regionMode || !dragStart.current) return;
      const p = evtPoint(e);
      const s = dragStart.current;
      dragStart.current = null;
      if (!p) return;
      const reg: Rect = {
        x: Math.min(s.x, p.x),
        y: Math.min(s.y, p.y),
        w: Math.abs(p.x - s.x),
        h: Math.abs(p.y - s.y),
      };
      if (reg.w < 4 || reg.h < 4) {
        setRegion(null);
        drawView(null);
        process(block, null);
        return;
      }
      setRegion(reg);
      drawView(reg);
      process(block, reg);
    },
    [regionMode, evtPoint, drawView, process, block]
  );

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
          <Field label={`Block size: ${block}px`} className="min-w-[200px]">
            <Slider
              value={[block]}
              min={2}
              max={64}
              step={1}
              onValueChange={(v) => {
                const b = v[0] ?? 12;
                setBlock(b);
                if (src) process(b, region);
              }}
            />
          </Field>
          <Field label="Region only (drag)">
            <div className="flex h-9 items-center gap-2">
              <Switch
                checked={regionMode}
                onCheckedChange={(c) => {
                  setRegionMode(c);
                  if (!c) {
                    setRegion(null);
                    if (src) {
                      drawView(null);
                      process(block, null);
                    }
                  }
                }}
              />
              <span className="text-xs text-muted-foreground">
                {regionMode ? 'on' : 'off'}
              </span>
            </div>
          </Field>
          {region && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRegion(null);
                drawView(null);
                process(block, null);
              }}
            >
              <X className="size-3.5" /> Clear region
            </Button>
          )}
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {!src && (
        <p className="px-1 text-xs text-muted-foreground">
          Upload an image to pixelate it. Enable &quot;Region only&quot; and drag a rectangle to
          censor just one area (e.g. a face). Processed entirely in your browser.
        </p>
      )}

      {src && (
        <>
          {regionMode && (
            <Panel>
              <PanelHeader title="Select region (drag)" />
              <div className="max-h-[420px] overflow-auto p-2">
                <canvas
                  ref={viewRef}
                  onMouseDown={onDown}
                  onMouseMove={onDrag}
                  onMouseUp={onUp}
                  className="max-w-full cursor-crosshair"
                />
              </div>
            </Panel>
          )}
          {outUrl && (
            <Panel>
              <PanelHeader title="Result" />
              <div className="flex flex-col items-center gap-3 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={outUrl} alt="pixelated result" className="max-h-[460px] rounded border" />
                <a href={outUrl} download="pixelated.png">
                  <Button size="sm">Download PNG</Button>
                </a>
              </div>
              <StatBar
                items={[
                  dims && `${dims.w}×${dims.h}px`,
                  `block ${block}px`,
                  region ? 'region selection' : 'whole image',
                ]}
              />
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
