'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, RotateCw, FlipHorizontal } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ErrorBanner } from '@/components/tools/error-banner';

type Format = 'png' | 'jpeg';

export default function ImageRotateFlipTool() {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [angle, setAngle] = useState(0); // degrees
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [bg, setBg] = useState('#ffffff');
  const [useBg, setUseBg] = useState(false);
  const [format, setFormat] = useState<Format>('png');
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [outDims, setOutDims] = useState<{ w: number; h: number } | null>(null);
  const [orig, setOrig] = useState<{ w: number; h: number } | null>(null);

  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const process = useCallback(
    (deg: number, fh: boolean, fv: boolean, bgFill: boolean, bgColor: string, fmt: Format) => {
      const base = baseRef.current;
      if (!base) return;
      const w = base.width;
      const h = base.height;
      const rad = (deg * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rad));
      const sin = Math.abs(Math.sin(rad));
      const bw = Math.max(1, Math.round(w * cos + h * sin));
      const bh = Math.max(1, Math.round(w * sin + h * cos));

      const c = document.createElement('canvas');
      c.width = bw;
      c.height = bh;
      const ctx = c.getContext('2d');
      if (!ctx) {
        setError('Canvas not supported.');
        return;
      }
      if (bgFill || fmt === 'jpeg') {
        ctx.fillStyle = fmt === 'jpeg' && !bgFill ? '#ffffff' : bgColor;
        ctx.fillRect(0, 0, bw, bh);
      }
      ctx.translate(bw / 2, bh / 2);
      ctx.rotate(rad);
      ctx.scale(fh ? -1 : 1, fv ? -1 : 1);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(base, -w / 2, -h / 2, w, h);

      const mime = fmt === 'jpeg' ? 'image/jpeg' : 'image/png';
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
          setOutDims({ w: bw, h: bh });
        },
        mime,
        fmt === 'jpeg' ? 0.92 : undefined
      );
    },
    []
  );

  useEffect(() => {
    return () => {
      if (outUrl) URL.revokeObjectURL(outUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rerun = useCallback(
    (next: Partial<{ deg: number; fh: boolean; fv: boolean; bgFill: boolean; bgColor: string; fmt: Format }>) => {
      if (!src) return;
      process(
        next.deg ?? angle,
        next.fh ?? flipH,
        next.fv ?? flipV,
        next.bgFill ?? useBg,
        next.bgColor ?? bg,
        next.fmt ?? format
      );
    },
    [src, angle, flipH, flipV, useBg, bg, format, process]
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
          setSrc(url);
          process(angle, flipH, flipV, useBg, bg, format);
        };
        img.onerror = () => setError('Could not load image.');
        img.src = url;
      };
      reader.onerror = () => setError('Could not read file.');
      reader.readAsDataURL(file);
    },
    [process, angle, flipH, flipV, useBg, bg, format]
  );

  const quick = (deg: number) => {
    const next = ((angle + deg) % 360 + 360) % 360;
    setAngle(next);
    rerun({ deg: next });
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
          <Field label="Quick rotate">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => quick(90)}>
                <RotateCw className="size-3.5" /> +90°
              </Button>
              <Button variant="outline" size="sm" onClick={() => quick(180)}>
                180°
              </Button>
              <Button variant="outline" size="sm" onClick={() => quick(270)}>
                +270°
              </Button>
            </div>
          </Field>
          <Field label={`Free angle: ${angle}°`} className="min-w-[220px]">
            <Slider
              value={[angle]}
              min={-180}
              max={180}
              step={1}
              onValueChange={(v) => {
                const a = v[0] ?? 0;
                setAngle(a);
                rerun({ deg: a });
              }}
            />
          </Field>
          <Field label="Flip H">
            <div className="flex h-9 items-center gap-2">
              <FlipHorizontal className="size-3.5 text-muted-foreground" />
              <Switch
                checked={flipH}
                onCheckedChange={(c) => {
                  setFlipH(c);
                  rerun({ fh: c });
                }}
              />
            </div>
          </Field>
          <Field label="Flip V">
            <div className="flex h-9 items-center">
              <Switch
                checked={flipV}
                onCheckedChange={(c) => {
                  setFlipV(c);
                  rerun({ fv: c });
                }}
              />
            </div>
          </Field>
          <Field label="Fill background">
            <div className="flex h-9 items-center gap-2">
              <Switch
                checked={useBg}
                onCheckedChange={(c) => {
                  setUseBg(c);
                  rerun({ bgFill: c });
                }}
              />
              <Input
                type="color"
                value={bg}
                onChange={(e) => {
                  setBg(e.target.value);
                  if (useBg) rerun({ bgColor: e.target.value });
                }}
                className="h-8 w-12 p-1"
              />
            </div>
          </Field>
          <Field label="Format">
            <Select
              value={format}
              onValueChange={(v) => {
                const f = v as Format;
                setFormat(f);
                rerun({ fmt: f });
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

      {!src && (
        <p className="px-1 text-xs text-muted-foreground">
          Upload an image to rotate it by quarter turns or any free angle, and flip it
          horizontally or vertically. PNG keeps transparent corners; JPEG fills with the chosen
          color. All offline.
        </p>
      )}

      {src && outUrl && (
        <Panel>
          <PanelHeader title="Result" />
          <div className="flex flex-col items-center gap-3 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={outUrl}
              alt="rotated result"
              className="max-h-[460px] rounded border bg-[repeating-conic-gradient(#e5e5e5_0_25%,#fff_0_50%)] bg-[length:16px_16px]"
            />
            <a href={outUrl} download={`rotated.${format === 'jpeg' ? 'jpg' : 'png'}`}>
              <Button size="sm">Download {format.toUpperCase()}</Button>
            </a>
          </div>
          <StatBar
            items={[
              orig && `original ${orig.w}×${orig.h}px`,
              outDims && `output ${outDims.w}×${outDims.h}px`,
              `angle ${angle}°`,
              flipH && 'flipped H',
              flipV && 'flipped V',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
