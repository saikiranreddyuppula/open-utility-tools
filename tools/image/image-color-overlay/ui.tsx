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

type BlendMode =
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'color'
  | 'hue'
  | 'luminosity';

const BLEND_LABELS: { value: BlendMode; label: string }[] = [
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'color', label: 'Color' },
  { value: 'hue', label: 'Hue' },
  { value: 'luminosity', label: 'Luminosity' },
];

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

export default function ColorOverlayTool() {
  const [src, setSrc] = useState<string | null>(null);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState('#3b82f6');
  const [opacity, setOpacity] = useState(50);
  const [blend, setBlend] = useState<BlendMode>('multiply');
  const fileRef = useRef<HTMLInputElement>(null);

  const process = useCallback(
    (dataUrl: string, col: string, op: number, mode: BlendMode) => {
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
        const { r, g, b } = hexToRgb(col);
        // Apply the blend mode for the tint, then clip to existing pixels.
        ctx.globalCompositeOperation = mode;
        ctx.fillStyle = `rgba(${r},${g},${b},${op / 100})`;
        ctx.fillRect(0, 0, w, h);
        // Re-clip so transparent areas of the source stay transparent.
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(img, 0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              setError('Could not encode image.');
              return;
            }
            setOutUrl(URL.createObjectURL(blob));
          },
          'image/png'
        );
      };
      img.onerror = () => setError('Could not load image.');
      img.src = dataUrl;
    },
    []
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
        process(url, color, opacity, blend);
      };
      reader.onerror = () => setError('Could not read file.');
      reader.readAsDataURL(file);
    },
    [process, color, opacity, blend]
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
          <Field label="Overlay color">
            <Input
              type="color"
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                if (src) process(src, e.target.value, opacity, blend);
              }}
              className="h-8 w-14 p-1"
            />
          </Field>
          <Field label={`Opacity: ${opacity}%`} className="min-w-[180px]">
            <Slider
              value={[opacity]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v) => {
                const op = v[0] ?? 50;
                setOpacity(op);
                if (src) process(src, color, op, blend);
              }}
            />
          </Field>
          <Field label="Blend mode">
            <Select
              value={blend}
              onValueChange={(v) => {
                const m = v as BlendMode;
                setBlend(m);
                if (src) process(src, color, opacity, m);
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BLEND_LABELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {!outUrl && (
        <p className="px-1 text-xs text-muted-foreground">
          Upload an image to tint it with a color and blend mode. All processing happens
          locally in your browser.
        </p>
      )}

      {outUrl && (
        <Panel>
          <PanelHeader title="Result" />
          <div className="flex flex-col items-center gap-3 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={outUrl} alt="tinted result" className="max-h-[460px] rounded border" />
            <a href={outUrl} download="color-overlay.png">
              <Button size="sm">Download PNG</Button>
            </a>
          </div>
        </Panel>
      )}
    </div>
  );
}
