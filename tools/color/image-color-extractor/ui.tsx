'use client';

import { useCallback, useRef, useState } from 'react';
import { ImageIcon, Upload } from 'lucide-react';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Field, Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface Swatch {
  hex: string;
  count: number;
  pct: number;
}

function toHexByte(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
}

/**
 * Quantize pixels by bucketing each channel into `bits` significant bits,
 * count occurrences, then return the most frequent buckets (averaged).
 */
function extractPalette(data: Uint8ClampedArray, maxColors: number): Swatch[] {
  const bits = 4; // 16 levels per channel => 4096 buckets
  const shift = 8 - bits;
  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
  let total = 0;

  // Sample up to ~50k pixels for performance on large images.
  const pixelCount = Math.floor(data.length / 4);
  const step = Math.max(1, Math.floor(pixelCount / 50000));

  for (let i = 0; i < pixelCount; i += step) {
    const idx = i * 4;
    const a = data[idx + 3] ?? 0;
    if (a < 125) continue; // skip mostly-transparent pixels
    const r = data[idx] ?? 0;
    const g = data[idx + 1] ?? 0;
    const b = data[idx + 2] ?? 0;
    const key = ((r >> shift) << (bits * 2)) | ((g >> shift) << bits) | (b >> shift);
    const cur = buckets.get(key);
    if (cur) {
      cur.r += r;
      cur.g += g;
      cur.b += b;
      cur.n += 1;
    } else {
      buckets.set(key, { r, g, b, n: 1 });
    }
    total += 1;
  }

  if (total === 0) return [];

  const sorted = Array.from(buckets.values()).sort((a, b) => b.n - a.n);
  const top = sorted.slice(0, maxColors);
  return top.map((bk) => ({
    hex: rgbToHex(bk.r / bk.n, bk.g / bk.n, bk.b / bk.n),
    count: bk.n,
    pct: (bk.n / total) * 100,
  }));
}

function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Relative luminance approximation.
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140;
}

export default function ImageColorExtractorTool() {
  const [palette, setPalette] = useState<Swatch[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(8);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastImage = useRef<HTMLImageElement | null>(null);

  const runExtraction = useCallback((img: HTMLImageElement, maxColors: number) => {
    const canvas = document.createElement('canvas');
    // Downscale for speed; keeps aspect ratio.
    const maxDim = 400;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Could not get a 2D canvas context.');
      return;
    }
    ctx.drawImage(img, 0, 0, w, h);
    let imageData: ImageData;
    try {
      imageData = ctx.getImageData(0, 0, w, h);
    } catch {
      setError('Could not read image pixels (the image may be cross-origin).');
      return;
    }
    setPalette(extractPalette(imageData.data, maxColors));
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      setError(null);
      if (!file.type.startsWith('image/')) {
        setError('Please choose an image file.');
        return;
      }
      setBusy(true);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        setPreview(url);
        lastImage.current = img;
        runExtraction(img, count);
        setBusy(false);
      };
      img.onerror = () => {
        setError('Could not load that image.');
        URL.revokeObjectURL(url);
        setBusy(false);
      };
      img.src = url;
    },
    [count, runExtraction]
  );

  const onCountChange = useCallback(
    (n: number) => {
      setCount(n);
      if (lastImage.current) runExtraction(lastImage.current, n);
    },
    [runExtraction]
  );

  const allHex = palette.map((p) => p.hex).join('\n');

  return (
    <Panel>
      <PanelHeader title="Image Color Extractor" />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      <div
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center transition-colors hover:bg-muted/40"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
      >
        <Upload className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Click to upload or drop an image here
        </p>
        <Button type="button" variant="secondary" size="sm">
          <ImageIcon className="mr-2 h-4 w-4" />
          Choose image
        </Button>
      </div>

      <ErrorBanner error={error} />

      <Field label={`Number of colors: ${count}`}>
        <Slider
          value={[count]}
          min={2}
          max={16}
          step={1}
          onValueChange={(v) => onCountChange(v[0] ?? 8)}
        />
      </Field>

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Uploaded preview"
          className="max-h-48 w-auto rounded-lg border object-contain"
        />
      )}

      {palette.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {palette.map((sw, i) => (
              <div key={`${sw.hex}-${i}`} className="overflow-hidden rounded-lg border">
                <div
                  className="flex h-20 items-end justify-between p-2"
                  style={{ backgroundColor: sw.hex }}
                >
                  <span
                    className={`font-mono text-xs ${isLight(sw.hex) ? 'text-black/70' : 'text-white/80'}`}
                  >
                    {sw.hex}
                  </span>
                  <CopyButton value={sw.hex} />
                </div>
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  {sw.pct.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
          <StatBar items={[`${palette.length} colors`, busy && 'Processing…']} />
          <div className="flex justify-end">
            <CopyButton value={allHex} />
          </div>
        </>
      )}
    </Panel>
  );
}
