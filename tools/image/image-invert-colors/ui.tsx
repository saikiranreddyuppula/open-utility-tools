'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
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

type Mode = 'rgb' | 'luma';
type Fmt = 'image/png' | 'image/jpeg';

function clamp255(n: number): number {
  return n < 0 ? 0 : n > 255 ? 255 : n;
}

export default function InvertColorsTool() {
  const [src, setSrc] = useState<string | null>(null);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('rgb');
  const [intensity, setIntensity] = useState(100);
  const [fmt, setFmt] = useState<Fmt>('image/png');
  const fileRef = useRef<HTMLInputElement>(null);

  const process = useCallback(
    (dataUrl: string, m: Mode, amt: number, format: Fmt) => {
      const img = new globalThis.Image();
      img.onload = () => {
        const w = Math.max(1, img.naturalWidth);
        const h = Math.max(1, img.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setError('Canvas not supported in this browser.');
          return;
        }
        if (format === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
        }
        ctx.drawImage(img, 0, 0, w, h);
        let imageData: ImageData;
        try {
          imageData = ctx.getImageData(0, 0, w, h);
        } catch {
          setError('Could not read pixel data from this image.');
          return;
        }
        const data = imageData.data;
        const t = amt / 100; // blend factor: 0 = original, 1 = fully inverted
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i] ?? 0;
          const g = data[i + 1] ?? 0;
          const b = data[i + 2] ?? 0;
          let ir: number;
          let ig: number;
          let ib: number;
          if (m === 'rgb') {
            ir = 255 - r;
            ig = 255 - g;
            ib = 255 - b;
          } else {
            // Invert luminance only: YCbCr, flip Y, convert back. Keeps hue.
            const y = 0.299 * r + 0.587 * g + 0.114 * b;
            const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
            const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
            const ny = 255 - y;
            ir = clamp255(ny + 1.402 * (cr - 128));
            ig = clamp255(ny - 0.344136 * (cb - 128) - 0.714136 * (cr - 128));
            ib = clamp255(ny + 1.772 * (cb - 128));
          }
          data[i] = clamp255(r + (ir - r) * t);
          data[i + 1] = clamp255(g + (ig - g) * t);
          data[i + 2] = clamp255(b + (ib - b) * t);
        }
        ctx.putImageData(imageData, 0, 0);
        setOutUrl(canvas.toDataURL(format, format === 'image/jpeg' ? 0.92 : undefined));
        setError(null);
      };
      img.onerror = () => setError('Could not load image.');
      img.src = dataUrl;
    },
    []
  );

  const onFile = useCallback((file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : null;
      if (!url) {
        setError('Could not read file.');
        return;
      }
      setSrc(url);
    };
    reader.onerror = () => setError('Could not read file.');
    reader.readAsDataURL(file);
  }, []);

  useEffect(() => {
    if (src) process(src, mode, intensity, fmt);
  }, [src, mode, intensity, fmt, process]);

  const ext = fmt === 'image/jpeg' ? 'jpg' : 'png';

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
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rgb">Full RGB negative</SelectItem>
                <SelectItem value="luma">Invert luminance only</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={`Intensity: ${intensity}%`} className="min-w-[200px]">
            <Slider
              value={[intensity]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v) => setIntensity(v[0] ?? 100)}
            />
          </Field>
          <Field label="Format">
            <Select value={fmt} onValueChange={(v) => setFmt(v as Fmt)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image/png">PNG</SelectItem>
                <SelectItem value="image/jpeg">JPEG</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {outUrl && (
        <Panel>
          <PanelHeader title="Result" />
          <div className="flex flex-col items-center gap-3 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={outUrl} alt="inverted" className="max-h-[420px] rounded border" />
            <a href={outUrl} download={`inverted.${ext}`}>
              <Button size="sm">Download {ext.toUpperCase()}</Button>
            </a>
          </div>
        </Panel>
      )}

      <p className="px-1 text-2xs text-muted-foreground">
        Pixels are inverted entirely in your browser — nothing is uploaded.
      </p>
    </div>
  );
}
