'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ErrorBanner } from '@/components/tools/error-banner';

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): Rgb {
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

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export default function DuotoneTool() {
  const [src, setSrc] = useState<string | null>(null);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shadow, setShadow] = useState('#1e1b4b');
  const [highlight, setHighlight] = useState('#fde047');
  const [midtone, setMidtone] = useState('#ec4899');
  const [useMid, setUseMid] = useState(false);
  const [contrast, setContrast] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastOut = useRef<string | null>(null);

  const process = useCallback(
    (
      dataUrl: string,
      sh: string,
      hi: string,
      mid: string,
      threeStop: boolean,
      contr: number
    ) => {
      const img = new globalThis.Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          setError('Canvas not supported.');
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const cs = hexToRgb(sh);
        const ch = hexToRgb(hi);
        const cm = hexToRgb(mid);
        // contrast factor in [-100, 100] -> remap luminance around 0.5
        const cf = contr / 100;
        const k = Math.tan((Math.min(0.95, Math.abs(cf)) * Math.PI) / 2);

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i] ?? 0;
          const g = data[i + 1] ?? 0;
          const b = data[i + 2] ?? 0;
          let l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          if (cf > 0) {
            l = (l - 0.5) * (1 + k) + 0.5;
          } else if (cf < 0) {
            l = (l - 0.5) * (1 / (1 + k)) + 0.5;
          }
          l = Math.min(1, Math.max(0, l));

          let or: number;
          let og: number;
          let ob: number;
          if (threeStop) {
            if (l < 0.5) {
              const t = l / 0.5;
              or = lerp(cs.r, cm.r, t);
              og = lerp(cs.g, cm.g, t);
              ob = lerp(cs.b, cm.b, t);
            } else {
              const t = (l - 0.5) / 0.5;
              or = lerp(cm.r, ch.r, t);
              og = lerp(cm.g, ch.g, t);
              ob = lerp(cm.b, ch.b, t);
            }
          } else {
            or = lerp(cs.r, ch.r, l);
            og = lerp(cs.g, ch.g, l);
            ob = lerp(cs.b, ch.b, l);
          }
          data[i] = or;
          data[i + 1] = og;
          data[i + 2] = ob;
        }
        ctx.putImageData(imageData, 0, 0);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              setError('Could not encode image.');
              return;
            }
            if (lastOut.current) URL.revokeObjectURL(lastOut.current);
            const url = URL.createObjectURL(blob);
            lastOut.current = url;
            setOutUrl(url);
          },
          'image/png'
        );
      };
      img.onerror = () => setError('Could not load image.');
      img.src = dataUrl;
    },
    []
  );

  const rerun = useCallback(
    (next: Partial<{ sh: string; hi: string; mid: string; threeStop: boolean; contr: number }>) => {
      if (!src) return;
      process(
        src,
        next.sh ?? shadow,
        next.hi ?? highlight,
        next.mid ?? midtone,
        next.threeStop ?? useMid,
        next.contr ?? contrast
      );
    },
    [src, shadow, highlight, midtone, useMid, contrast, process]
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
        process(url, shadow, highlight, midtone, useMid, contrast);
      };
      reader.onerror = () => setError('Could not read file.');
      reader.readAsDataURL(file);
    },
    [process, shadow, highlight, midtone, useMid, contrast]
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
          <Field label="Shadows">
            <Input
              type="color"
              value={shadow}
              onChange={(e) => {
                setShadow(e.target.value);
                rerun({ sh: e.target.value });
              }}
              className="h-8 w-14 p-1"
            />
          </Field>
          {useMid && (
            <Field label="Midtones">
              <Input
                type="color"
                value={midtone}
                onChange={(e) => {
                  setMidtone(e.target.value);
                  rerun({ mid: e.target.value });
                }}
                className="h-8 w-14 p-1"
              />
            </Field>
          )}
          <Field label="Highlights">
            <Input
              type="color"
              value={highlight}
              onChange={(e) => {
                setHighlight(e.target.value);
                rerun({ hi: e.target.value });
              }}
              className="h-8 w-14 p-1"
            />
          </Field>
          <Field label="3-stop">
            <div className="flex h-8 items-center gap-2">
              <Switch
                checked={useMid}
                onCheckedChange={(c) => {
                  setUseMid(c);
                  rerun({ threeStop: c });
                }}
              />
              <Label className="text-xs text-muted-foreground">add midtone</Label>
            </div>
          </Field>
          <Field label={`Contrast: ${contrast}`} className="min-w-[180px]">
            <Slider
              value={[contrast]}
              min={-100}
              max={100}
              step={1}
              onValueChange={(v) => {
                const c = v[0] ?? 0;
                setContrast(c);
                rerun({ contr: c });
              }}
            />
          </Field>
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {!outUrl && (
        <p className="px-1 text-xs text-muted-foreground">
          Upload an image to apply a two- or three-color duotone gradient map. All
          processing happens locally in your browser.
        </p>
      )}

      {outUrl && (
        <Panel>
          <PanelHeader title="Result" />
          <div className="flex flex-col items-center gap-3 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={outUrl} alt="duotone result" className="max-h-[460px] rounded border" />
            <a href={outUrl} download="duotone.png">
              <Button size="sm">Download PNG</Button>
            </a>
          </div>
        </Panel>
      )}
    </div>
  );
}
