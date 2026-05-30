'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
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
import { ErrorBanner } from '@/components/tools/error-banner';

type Format = 'png' | 'jpeg';

interface Params {
  inner: number; // % of half-diagonal where the vignette starts
  softness: number; // 0-100, controls gradient spread
  color: string;
  strength: number; // 0-100 alpha at the corners
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) {
    const r0 = h[0] ?? '0';
    const g0 = h[1] ?? '0';
    const b0 = h[2] ?? '0';
    h = `${r0}${r0}${g0}${g0}${b0}${b0}`;
  }
  const n = parseInt(h, 16);
  if (!Number.isFinite(n) || h.length !== 6) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export default function VignetteTool() {
  const [src, setSrc] = useState<string | null>(null);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<Format>('png');
  const [params, setParams] = useState<Params>({
    inner: 40,
    softness: 60,
    color: '#000000',
    strength: 70,
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const process = useCallback((dataUrl: string, p: Params, fmt: Format) => {
    const img = new globalThis.Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('Canvas not supported.');
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const halfDiag = Math.sqrt(cx * cx + cy * cy);
      const innerR = (p.inner / 100) * halfDiag;
      const outerR = halfDiag;
      const { r, g, b } = hexToRgb(p.color);
      const alpha = p.strength / 100;

      const grad = ctx.createRadialGradient(cx, cy, Math.min(innerR, outerR - 1), cx, cy, outerR);
      // softness shifts where the color starts ramping in.
      const mid = 1 - p.softness / 100;
      grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
      grad.addColorStop(Math.min(0.999, Math.max(0.001, mid)), `rgba(${r},${g},${b},0)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},${alpha})`);

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setError('Could not encode image.');
            return;
          }
          setOutUrl(URL.createObjectURL(blob));
        },
        fmt === 'png' ? 'image/png' : 'image/jpeg',
        fmt === 'jpeg' ? 0.92 : undefined
      );
      setError(null);
    };
    img.onerror = () => setError('Could not load image.');
    img.src = dataUrl;
  }, []);

  const update = useCallback(
    (over: Partial<Params>, fmtOver?: Format) => {
      const next = { ...params, ...over };
      setParams(next);
      const fmt = fmtOver ?? format;
      if (src) process(src, next, fmt);
    },
    [params, format, src, process]
  );

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
        setSrc(url);
        process(url, params, format);
      };
      reader.onerror = () => setError('Could not read file.');
      reader.readAsDataURL(file);
    },
    [process, params, format]
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
          <Field label="Color">
            <Input
              type="color"
              value={params.color}
              onChange={(e) => update({ color: e.target.value })}
              className="h-8 w-12 p-1"
            />
          </Field>
          <Field label={`Inner radius: ${params.inner}%`} className="min-w-[160px]">
            <Slider
              value={[params.inner]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v) => update({ inner: v[0] ?? 40 })}
            />
          </Field>
          <Field label={`Softness: ${params.softness}%`} className="min-w-[160px]">
            <Slider
              value={[params.softness]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v) => update({ softness: v[0] ?? 60 })}
            />
          </Field>
          <Field label={`Strength: ${params.strength}%`} className="min-w-[160px]">
            <Slider
              value={[params.strength]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v) => update({ strength: v[0] ?? 70 })}
            />
          </Field>
          <Field label="Format">
            <Select
              value={format}
              onValueChange={(v) => {
                const f = v as Format;
                setFormat(f);
                if (src) process(src, params, f);
              }}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="png">PNG</SelectItem>
                <SelectItem value="jpeg">JPEG</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {!outUrl && (
        <p className="px-1 text-xs text-muted-foreground">
          Upload a photo to add a soft dark (or light) vignette around the edges. All processing
          happens locally in your browser.
        </p>
      )}

      {outUrl && (
        <Panel>
          <PanelHeader title="Result" />
          <div className="flex flex-col items-center gap-3 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={outUrl} alt="vignette result" className="max-h-[460px] rounded border" />
            <a href={outUrl} download={`vignette.${format === 'png' ? 'png' : 'jpg'}`}>
              <Button size="sm">Download {format.toUpperCase()}</Button>
            </a>
          </div>
        </Panel>
      )}
    </div>
  );
}
