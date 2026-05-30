'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ErrorBanner } from '@/components/tools/error-banner';

type Mode = 'pixels' | 'percent';
type Format = 'png' | 'jpeg';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ImageResizePixelsTool() {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orig, setOrig] = useState<{ w: number; h: number } | null>(null);
  const [mode, setMode] = useState<Mode>('pixels');
  const [width, setWidth] = useState('800');
  const [height, setHeight] = useState('600');
  const [percent, setPercent] = useState('50');
  const [lock, setLock] = useState(true);
  const [format, setFormat] = useState<Format>('png');
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [outDims, setOutDims] = useState<{ w: number; h: number } | null>(null);
  const [outSize, setOutSize] = useState<number | null>(null);

  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const compute = useCallback(
    (m: Mode, wStr: string, hStr: string, pStr: string, fmt: Format) => {
      const base = baseRef.current;
      if (!base) return;
      let tw = 0;
      let th = 0;
      if (m === 'percent') {
        const p = Number(pStr);
        if (!Number.isFinite(p) || p <= 0) {
          setError('Enter a valid percentage greater than 0.');
          return;
        }
        tw = Math.round((base.width * p) / 100);
        th = Math.round((base.height * p) / 100);
      } else {
        const w = Math.round(Number(wStr));
        const h = Math.round(Number(hStr));
        if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
          setError('Enter valid width and height in pixels.');
          return;
        }
        tw = w;
        th = h;
      }
      tw = Math.max(1, Math.min(12000, tw));
      th = Math.max(1, Math.min(12000, th));
      setError(null);

      const canvas = document.createElement('canvas');
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('Canvas not supported.');
        return;
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      if (fmt === 'jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, tw, th);
      }
      ctx.drawImage(base, 0, 0, tw, th);
      const mime = fmt === 'jpeg' ? 'image/jpeg' : 'image/png';
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setError('Could not encode image.');
            return;
          }
          if (outUrl) URL.revokeObjectURL(outUrl);
          setOutUrl(URL.createObjectURL(blob));
          setOutDims({ w: tw, h: th });
          setOutSize(blob.size);
        },
        mime,
        fmt === 'jpeg' ? 0.92 : undefined
      );
    },
    [outUrl]
  );

  useEffect(() => {
    return () => {
      if (outUrl) URL.revokeObjectURL(outUrl);
    };
  }, [outUrl]);

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
          setOrig({ w: img.naturalWidth, h: img.naturalHeight });
          setWidth(String(img.naturalWidth));
          setHeight(String(img.naturalHeight));
          setSrc(url);
          compute(mode, String(img.naturalWidth), String(img.naturalHeight), percent, format);
        };
        img.onerror = () => setError('Could not load image.');
        img.src = url;
      };
      reader.onerror = () => setError('Could not read file.');
      reader.readAsDataURL(file);
    },
    [compute, mode, percent, format]
  );

  const ratio = orig ? orig.w / orig.h : 1;

  const onWidthChange = (val: string) => {
    setWidth(val);
    if (lock && orig) {
      const w = Number(val);
      if (Number.isFinite(w) && w > 0) {
        const h = String(Math.round(w / ratio));
        setHeight(h);
        compute('pixels', val, h, percent, format);
        return;
      }
    }
    compute('pixels', val, height, percent, format);
  };

  const onHeightChange = (val: string) => {
    setHeight(val);
    if (lock && orig) {
      const h = Number(val);
      if (Number.isFinite(h) && h > 0) {
        const w = String(Math.round(h * ratio));
        setWidth(w);
        compute('pixels', w, val, percent, format);
        return;
      }
    }
    compute('pixels', width, val, percent, format);
  };

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
            <Select
              value={mode}
              onValueChange={(v) => {
                const m = v as Mode;
                setMode(m);
                if (src) compute(m, width, height, percent, format);
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pixels">Pixels</SelectItem>
                <SelectItem value="percent">Percent</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {mode === 'pixels' ? (
            <>
              <Field label="Width (px)">
                <Input
                  value={width}
                  onChange={(e) => onWidthChange(e.target.value)}
                  inputMode="numeric"
                  className="w-28"
                />
              </Field>
              <Field label="Height (px)">
                <Input
                  value={height}
                  onChange={(e) => onHeightChange(e.target.value)}
                  inputMode="numeric"
                  className="w-28"
                />
              </Field>
              <Field label="Lock aspect">
                <div className="flex h-9 items-center">
                  <Switch checked={lock} onCheckedChange={setLock} />
                </div>
              </Field>
            </>
          ) : (
            <Field label="Scale (%)">
              <Input
                value={percent}
                onChange={(e) => {
                  setPercent(e.target.value);
                  if (src) compute('percent', width, height, e.target.value, format);
                }}
                inputMode="decimal"
                className="w-28"
              />
            </Field>
          )}

          <Field label="Format">
            <Select
              value={format}
              onValueChange={(v) => {
                const f = v as Format;
                setFormat(f);
                if (src) compute(mode, width, height, percent, f);
              }}
            >
              <SelectTrigger className="w-28">
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

      {!src && (
        <p className="px-1 text-xs text-muted-foreground">
          Upload an image to resize it to exact pixels or a percentage. Aspect-lock keeps
          proportions. All processing happens locally in your browser.
        </p>
      )}

      {src && outUrl && (
        <Panel>
          <PanelHeader title="Result" />
          <div className="flex flex-col items-center gap-3 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={outUrl} alt="resized result" className="max-h-[460px] rounded border" />
            <a href={outUrl} download={`resized.${format === 'jpeg' ? 'jpg' : 'png'}`}>
              <Button size="sm">Download {format.toUpperCase()}</Button>
            </a>
          </div>
          <StatBar
            items={[
              orig && `original ${orig.w}×${orig.h}px`,
              outDims && `new ${outDims.w}×${outDims.h}px`,
              outSize != null && `~${formatBytes(outSize)}`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
