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
import { ErrorBanner } from '@/components/tools/error-banner';

type Preset = 'sepia' | 'warm' | 'cool' | 'faded';

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'sepia', label: 'Sepia' },
  { key: 'warm', label: 'Warm' },
  { key: 'cool', label: 'Cool' },
  { key: 'faded', label: 'Faded' },
];

function clamp(n: number): number {
  return n < 0 ? 0 : n > 255 ? 255 : n;
}

function filterPixel(preset: Preset, r: number, g: number, b: number): [number, number, number] {
  switch (preset) {
    case 'sepia': {
      const nr = 0.393 * r + 0.769 * g + 0.189 * b;
      const ng = 0.349 * r + 0.686 * g + 0.168 * b;
      const nb = 0.272 * r + 0.534 * g + 0.131 * b;
      return [clamp(nr), clamp(ng), clamp(nb)];
    }
    case 'warm': {
      // boost red, lower blue
      return [clamp(r * 1.12 + 12), clamp(g * 1.02), clamp(b * 0.85)];
    }
    case 'cool': {
      // boost blue, lower red
      return [clamp(r * 0.85), clamp(g * 1.0), clamp(b * 1.12 + 12)];
    }
    case 'faded': {
      // raise black point and lower contrast around mid-gray
      const lift = 28;
      const contrast = 0.78;
      const fr = (r - 128) * contrast + 128 + lift;
      const fg = (g - 128) * contrast + 128 + lift;
      const fb = (b - 128) * contrast + 128 + lift;
      return [clamp(fr), clamp(fg), clamp(fb)];
    }
    default:
      return [r, g, b];
  }
}

export default function ImageSepiaVintageTool() {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<Preset>('sepia');
  const [intensity, setIntensity] = useState(100);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  const imgDataRef = useRef<ImageData | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const process = useCallback((p: Preset, intensityPct: number) => {
    const data = imgDataRef.current;
    if (!data) return;
    const { width, height } = data;
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d');
    if (!ctx) {
      setError('Canvas not supported.');
      return;
    }
    const out = ctx.createImageData(width, height);
    const dst = out.data;
    const src8 = data.data;
    const t = Math.max(0, Math.min(1, intensityPct / 100));
    for (let i = 0; i < src8.length; i += 4) {
      const r = src8[i] ?? 0;
      const g = src8[i + 1] ?? 0;
      const b = src8[i + 2] ?? 0;
      const [fr, fg, fb] = filterPixel(p, r, g, b);
      // lerp original and filtered by intensity
      dst[i] = clamp(r + (fr - r) * t);
      dst[i + 1] = clamp(g + (fg - g) * t);
      dst[i + 2] = clamp(b + (fb - b) * t);
      dst[i + 3] = src8[i + 3] ?? 255;
    }
    ctx.putImageData(out, 0, 0);
    c.toBlob(
      (blob) => {
        if (!blob) {
          setError('Could not encode image.');
          return;
        }
        setOutUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      },
      'image/png'
    );
  }, []);

  useEffect(() => {
    return () => {
      if (outUrl) URL.revokeObjectURL(outUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          const w = img.naturalWidth;
          const h = img.naturalHeight;
          if (w * h > 25_000_000) {
            setError('Image is too large to filter (over 25 megapixels).');
            return;
          }
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const ctx = c.getContext('2d');
          if (!ctx) {
            setError('Canvas not supported.');
            return;
          }
          ctx.drawImage(img, 0, 0);
          imgDataRef.current = ctx.getImageData(0, 0, w, h);
          setDims({ w, h });
          setSrc(url);
          process(preset, intensity);
        };
        img.onerror = () => setError('Could not load image.');
        img.src = url;
      };
      reader.onerror = () => setError('Could not read file.');
      reader.readAsDataURL(file);
    },
    [process, preset, intensity]
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
          <Field label="Preset">
            <Select
              value={preset}
              onValueChange={(v) => {
                const p = v as Preset;
                setPreset(p);
                if (src) process(p, intensity);
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={`Intensity: ${intensity}%`} className="min-w-[220px]">
            <Slider
              value={[intensity]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v) => {
                const n = v[0] ?? 100;
                setIntensity(n);
                if (src) process(preset, n);
              }}
            />
          </Field>
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {!src && (
        <p className="px-1 text-xs text-muted-foreground">
          Upload a photo to apply a sepia, warm, cool, or faded vintage tint. The intensity
          slider blends between the original and the filtered image. Processed locally in your
          browser.
        </p>
      )}

      {src && outUrl && (
        <Panel>
          <PanelHeader title="Result" />
          <div className="flex flex-col items-center gap-3 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={outUrl} alt="filtered result" className="max-h-[460px] rounded border" />
            <a href={outUrl} download={`${preset}-filter.png`}>
              <Button size="sm">Download PNG</Button>
            </a>
          </div>
          <StatBar
            items={[
              dims && `${dims.w}×${dims.h}px`,
              `preset ${preset}`,
              `intensity ${intensity}%`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
