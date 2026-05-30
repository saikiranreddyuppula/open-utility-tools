'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface ColorResult {
  dominant: Rgb;
  average: Rgb;
}

function toHex(c: Rgb): string {
  const h = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

function toRgbStr(c: Rgb): string {
  return `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;
}

function toHslStr(c: Rgb): string {
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

function analyze(img: HTMLImageElement): ColorResult | null {
  const maxDim = 100;
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;
  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] ?? 0;
    if (a < 16) continue;
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    sumR += r;
    sumG += g;
    sumB += b;
    count++;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.n += 1;
    } else {
      buckets.set(key, { r, g, b, n: 1 });
    }
  }

  if (count === 0) return null;

  let best: { r: number; g: number; b: number; n: number } | null = null;
  for (const bucket of buckets.values()) {
    if (!best || bucket.n > best.n) best = bucket;
  }
  if (!best) return null;

  return {
    average: { r: sumR / count, g: sumG / count, b: sumB / count },
    dominant: { r: best.r / best.n, g: best.g / best.n, b: best.b / best.n },
  };
}

function ColorCard({ title, color }: { title: string; color: Rgb }) {
  const hex = toHex(color);
  const rgb = toRgbStr(color);
  const hsl = toHslStr(color);
  const rows: { label: string; value: string }[] = [
    { label: 'HEX', value: hex },
    { label: 'RGB', value: rgb },
    { label: 'HSL', value: hsl },
  ];
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center gap-3 border-b bg-muted/40 px-3 py-2">
        <div
          className="size-10 shrink-0 rounded border"
          style={{ backgroundColor: hex }}
          aria-hidden
        />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="divide-y">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between px-3 py-2">
            <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              {row.label}
            </span>
            <span className="flex items-center gap-2 font-mono text-sm">
              <span>{row.value}</span>
              <CopyButton value={row.value} size="icon-sm" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DominantColorTool() {
  const [result, setResult] = useState<ColorResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : null;
      if (!url) {
        setError('Could not read file.');
        return;
      }
      setPreviewUrl(url);
      const img = new globalThis.Image();
      img.onload = () => {
        const res = analyze(img);
        if (!res) {
          setError('Could not analyze image (it may be fully transparent).');
          return;
        }
        setResult(res);
      };
      img.onerror = () => setError('Could not load image.');
      img.src = url;
    };
    reader.onerror = () => setError('Could not read file.');
    reader.readAsDataURL(file);
  }, []);

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
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {!result && (
        <p className="px-1 text-xs text-muted-foreground">
          Upload an image to extract its dominant and average colors. Pixels are sampled
          locally in your browser — nothing is uploaded.
        </p>
      )}

      {result && (
        <Panel>
          <PanelHeader title="Extracted colors">
            <CopyButton
              value={() =>
                [
                  `Dominant: ${toHex(result.dominant)} / ${toRgbStr(result.dominant)}`,
                  `Average: ${toHex(result.average)} / ${toRgbStr(result.average)}`,
                ].join('\n')
              }
            />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
            <ColorCard title="Dominant color" color={result.dominant} />
            <ColorCard title="Average color" color={result.average} />
          </div>
          {previewUrl && (
            <div className="flex justify-center border-t p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="source" className="max-h-[280px] rounded border" />
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
