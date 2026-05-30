'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { ErrorBanner } from '@/components/tools/error-banner';

type Mode = 'threshold' | 'dither';

export default function ThresholdBwTool() {
  const [src, setSrc] = useState<string | null>(null);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('threshold');
  const [threshold, setThreshold] = useState(128);
  const [invert, setInvert] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const process = useCallback(
    (dataUrl: string, m: Mode, t: number, inv: boolean) => {
      const img = new globalThis.Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (w * h > 16_000_000) {
          setError('Image is too large (over 16 megapixels).');
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setError('Canvas not supported.');
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        // Luminance buffer (0-255).
        const lum = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) {
          const r = data[i * 4] ?? 0;
          const g = data[i * 4 + 1] ?? 0;
          const b = data[i * 4 + 2] ?? 0;
          lum[i] = 0.299 * r + 0.587 * g + 0.114 * b;
        }

        const setPixel = (i: number, white: boolean) => {
          const on = inv ? !white : white;
          const v = on ? 255 : 0;
          data[i * 4] = v;
          data[i * 4 + 1] = v;
          data[i * 4 + 2] = v;
          data[i * 4 + 3] = 255;
        };

        if (m === 'threshold') {
          for (let i = 0; i < w * h; i++) {
            setPixel(i, (lum[i] ?? 0) >= t);
          }
        } else {
          // Floyd–Steinberg error diffusion.
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const i = y * w + x;
              const old = lum[i] ?? 0;
              const white = old >= 128;
              const newVal = white ? 255 : 0;
              const err = old - newVal;
              setPixel(i, white);
              if (x + 1 < w) lum[i + 1] = (lum[i + 1] ?? 0) + (err * 7) / 16;
              if (y + 1 < h) {
                if (x > 0) lum[i + w - 1] = (lum[i + w - 1] ?? 0) + (err * 3) / 16;
                lum[i + w] = (lum[i + w] ?? 0) + (err * 5) / 16;
                if (x + 1 < w) lum[i + w + 1] = (lum[i + w + 1] ?? 0) + (err * 1) / 16;
              }
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);
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
        setError(null);
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
        process(url, mode, threshold, invert);
      };
      reader.onerror = () => setError('Could not read file.');
      reader.readAsDataURL(file);
    },
    [process, mode, threshold, invert]
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
          <Field label="Mode">
            <Tabs
              value={mode}
              onValueChange={(v) => {
                const m = v as Mode;
                setMode(m);
                if (src) process(src, m, threshold, invert);
              }}
            >
              <TabsList>
                <TabsTrigger value="threshold">Threshold</TabsTrigger>
                <TabsTrigger value="dither">Floyd–Steinberg</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === 'threshold' && (
            <Field label={`Threshold: ${threshold}`} className="min-w-[200px]">
              <Slider
                value={[threshold]}
                min={0}
                max={255}
                step={1}
                onValueChange={(v) => {
                  const t = v[0] ?? 128;
                  setThreshold(t);
                  if (src) process(src, mode, t, invert);
                }}
              />
            </Field>
          )}
          <Field label="Invert">
            <label className="flex h-8 items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={invert}
                onChange={(e) => {
                  setInvert(e.target.checked);
                  if (src) process(src, mode, threshold, e.target.checked);
                }}
              />
              Swap black/white
            </label>
          </Field>
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {!outUrl && (
        <p className="px-1 text-xs text-muted-foreground">
          Upload an image to convert it to pure black and white — useful for laser engraving,
          thermal printers, e-ink, and stencils. All processing happens locally in your browser.
        </p>
      )}

      {outUrl && (
        <Panel>
          <PanelHeader title="Result" />
          <div className="flex flex-col items-center gap-3 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={outUrl} alt="black and white result" className="max-h-[460px] rounded border" />
            <a href={outUrl} download="bw-threshold.png">
              <Button size="sm">Download PNG</Button>
            </a>
          </div>
        </Panel>
      )}
    </div>
  );
}
