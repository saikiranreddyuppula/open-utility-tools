'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

interface Point {
  x: number;
  y: number;
}

interface Probe {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export default function ImagePixelRulerTool() {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [hover, setHover] = useState<Probe | null>(null);
  const [pointA, setPointA] = useState<Point | null>(null);
  const [pointB, setPointB] = useState<Point | null>(null);

  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null); // natural-size buffer for getImageData
  const viewCanvasRef = useRef<HTMLCanvasElement | null>(null); // scaled display canvas
  const fileRef = useRef<HTMLInputElement>(null);

  const redraw = useCallback(() => {
    const base = baseCanvasRef.current;
    const view = viewCanvasRef.current;
    if (!base || !view) return;
    const w = base.width;
    const h = base.height;
    view.width = w * zoom;
    view.height = h * zoom;
    const ctx = view.getContext('2d');
    if (!ctx) {
      setError('Canvas not supported.');
      return;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, view.width, view.height);
    ctx.drawImage(base, 0, 0, view.width, view.height);

    // measurement line
    if (pointA && pointB) {
      ctx.strokeStyle = '#ff2d55';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pointA.x * zoom + zoom / 2, pointA.y * zoom + zoom / 2);
      ctx.lineTo(pointB.x * zoom + zoom / 2, pointB.y * zoom + zoom / 2);
      ctx.stroke();
    }
    const dot = (p: Point, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x * zoom + zoom / 2, p.y * zoom + zoom / 2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };
    if (pointA) dot(pointA, '#22c55e');
    if (pointB) dot(pointB, '#3b82f6');
  }, [zoom, pointA, pointB]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const onFile = useCallback((file: File) => {
    setError(null);
    setPointA(null);
    setPointB(null);
    setHover(null);
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
        baseCanvasRef.current = base;
        setDims({ w: img.naturalWidth, h: img.naturalHeight });
        setSrc(url);
      };
      img.onerror = () => setError('Could not load image.');
      img.src = url;
    };
    reader.onerror = () => setError('Could not read file.');
    reader.readAsDataURL(file);
  }, []);

  const pixelAt = useCallback((px: number, py: number): Probe | null => {
    const base = baseCanvasRef.current;
    if (!base) return null;
    if (px < 0 || py < 0 || px >= base.width || py >= base.height) return null;
    const ctx = base.getContext('2d');
    if (!ctx) return null;
    const data = ctx.getImageData(px, py, 1, 1).data;
    const r = data[0] ?? 0;
    const g = data[1] ?? 0;
    const b = data[2] ?? 0;
    const a = data[3] ?? 0;
    return { x: px, y: py, r, g, b, a };
  }, []);

  const eventToPixel = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>): Point | null => {
      const view = viewCanvasRef.current;
      if (!view) return null;
      const rect = view.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      // account for CSS scaling vs canvas pixel size
      const scaleX = view.width / rect.width;
      const scaleY = view.height / rect.height;
      const px = Math.floor((cx * scaleX) / zoom);
      const py = Math.floor((cy * scaleY) / zoom);
      return { x: px, y: py };
    },
    [zoom]
  );

  const onMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const p = eventToPixel(e);
      if (!p) return;
      setHover(pixelAt(p.x, p.y));
    },
    [eventToPixel, pixelAt]
  );

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const p = eventToPixel(e);
      if (!p) return;
      const base = baseCanvasRef.current;
      if (!base || p.x < 0 || p.y < 0 || p.x >= base.width || p.y >= base.height) return;
      // first click sets A (and clears prior B); next click sets B; third restarts
      if (!pointA || (pointA && pointB)) {
        setPointA(p);
        setPointB(null);
      } else {
        setPointB(p);
      }
    },
    [pointA, pointB]
  );

  let measure: { dx: number; dy: number; dist: number; angle: number } | null = null;
  if (pointA && pointB) {
    const dx = pointB.x - pointA.x;
    const dy = pointB.y - pointA.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    measure = { dx, dy, dist, angle };
  }

  const hoverHex = hover ? toHex(hover.r, hover.g, hover.b) : '';
  const hoverRgb = hover ? `rgb(${hover.r}, ${hover.g}, ${hover.b})` : '';

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
          <Field label={`Zoom: ${zoom}x`} className="min-w-[200px]">
            <Slider
              value={[zoom]}
              min={1}
              max={8}
              step={1}
              onValueChange={(v) => setZoom(v[0] ?? 1)}
            />
          </Field>
          {(pointA || pointB) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPointA(null);
                setPointB(null);
              }}
            >
              <X className="size-3.5" /> Clear points
            </Button>
          )}
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {!src && (
        <p className="px-1 text-xs text-muted-foreground">
          Upload an image, then move the cursor to read pixel colors. Click to drop point A,
          click again for point B to measure distance and angle. Everything runs locally in
          your browser.
        </p>
      )}

      {src && (
        <Panel>
          <PanelHeader title="Inspect" />
          <div className="max-h-[520px] overflow-auto bg-[repeating-conic-gradient(#e5e5e5_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-2">
            <canvas
              ref={viewCanvasRef}
              onMouseMove={onMove}
              onMouseLeave={() => setHover(null)}
              onClick={onClick}
              className="cursor-crosshair"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                Hovered pixel
              </div>
              {hover ? (
                <div className="flex items-center gap-3">
                  <div
                    className="size-10 shrink-0 rounded border"
                    style={{ backgroundColor: hoverHex }}
                  />
                  <div className="min-w-0 font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <span>{hoverHex}</span>
                      <CopyButton value={hoverHex} size="icon-sm" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span>{hoverRgb}</span>
                      <CopyButton value={hoverRgb} size="icon-sm" />
                    </div>
                    <div className="text-muted-foreground">
                      ({hover.x}, {hover.y}) · a={hover.a}
                    </div>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Move cursor over image.</span>
              )}
            </div>

            <div className="rounded-md border bg-muted/30 p-3">
              <div className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                Measurement
              </div>
              {measure ? (
                <div className="font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span>distance = {measure.dist.toFixed(2)} px</span>
                    <CopyButton value={measure.dist.toFixed(2)} size="icon-sm" />
                  </div>
                  <div>
                    dx = {measure.dx} px · dy = {measure.dy} px
                  </div>
                  <div>angle = {measure.angle.toFixed(2)}°</div>
                  <div className="text-muted-foreground">
                    A({pointA?.x}, {pointA?.y}) → B({pointB?.x}, {pointB?.y})
                  </div>
                </div>
              ) : pointA ? (
                <span className="text-xs text-muted-foreground">
                  Point A set at ({pointA.x}, {pointA.y}). Click to set point B.
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Click the image to drop point A.
                </span>
              )}
            </div>
          </div>
          <StatBar
            items={[
              dims && `image ${dims.w}×${dims.h}px`,
              `zoom ${zoom}x`,
              measure && `dist ${measure.dist.toFixed(2)}px`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
