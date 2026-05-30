'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, Gauge } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ErrorBanner } from '@/components/tools/error-banner';

type Format = 'jpeg' | 'webp';

interface ResultInfo {
  size: number;
  quality: number;
  w: number;
  h: number;
  scaleSteps: number;
  underTarget: boolean;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function encode(
  base: HTMLCanvasElement,
  w: number,
  h: number,
  mime: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    const ctx = c.getContext('2d');
    if (!ctx) {
      resolve(null);
      return;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (mime === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
    }
    ctx.drawImage(base, 0, 0, c.width, c.height);
    c.toBlob((b) => resolve(b), mime, quality);
  });
}

export default function ImageResizeToFilesizeTool() {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetKb, setTargetKb] = useState('200');
  const [format, setFormat] = useState<Format>('jpeg');
  const [busy, setBusy] = useState(false);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [info, setInfo] = useState<ResultInfo | null>(null);
  const [orig, setOrig] = useState<{ w: number; h: number; size: number } | null>(null);

  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (outUrl) URL.revokeObjectURL(outUrl);
    };
  }, [outUrl]);

  const run = useCallback(
    async (fmt: Format, kbStr: string) => {
      const base = baseRef.current;
      if (!base) return;
      const kb = Number(kbStr);
      if (!Number.isFinite(kb) || kb <= 0) {
        setError('Enter a valid target size in KB greater than 0.');
        return;
      }
      setError(null);
      setBusy(true);
      const targetBytes = kb * 1024;
      const mime = fmt === 'jpeg' ? 'image/jpeg' : 'image/webp';

      let w = base.width;
      let h = base.height;
      let scaleSteps = 0;
      let best: { blob: Blob; quality: number; w: number; h: number } | null = null;

      // Up to a few dimension-halving passes if quality alone can't hit the target.
      for (let pass = 0; pass < 8; pass++) {
        // binary search quality 0.1..1.0 for the largest blob <= target
        let lo = 0.1;
        let hi = 1.0;
        let passBest: { blob: Blob; quality: number } | null = null;
        let smallest: { blob: Blob; quality: number } | null = null;
        for (let i = 0; i < 8; i++) {
          const q = (lo + hi) / 2;
          // eslint-disable-next-line no-await-in-loop
          const blob = await encode(base, w, h, mime, q);
          if (!blob) {
            setError('Could not encode image.');
            setBusy(false);
            return;
          }
          if (!smallest || blob.size < smallest.blob.size) {
            smallest = { blob, quality: q };
          }
          if (blob.size <= targetBytes) {
            passBest = { blob, quality: q };
            lo = q; // try higher quality
          } else {
            hi = q; // too big, lower quality
          }
        }
        if (passBest) {
          best = { blob: passBest.blob, quality: passBest.quality, w, h };
          break;
        }
        // Even lowest quality is too big at this size; keep the smallest as fallback.
        if (smallest) {
          best = { blob: smallest.blob, quality: smallest.quality, w, h };
        }
        // halve dimensions and retry
        if (w <= 16 || h <= 16) break;
        w = Math.round(w / 2);
        h = Math.round(h / 2);
        scaleSteps++;
      }

      if (!best) {
        setError('Could not produce an output.');
        setBusy(false);
        return;
      }
      if (outUrl) URL.revokeObjectURL(outUrl);
      setOutUrl(URL.createObjectURL(best.blob));
      setInfo({
        size: best.blob.size,
        quality: best.quality,
        w: best.w,
        h: best.h,
        scaleSteps,
        underTarget: best.blob.size <= targetBytes,
      });
      setBusy(false);
    },
    [outUrl]
  );

  const onFile = useCallback(
    (file: File) => {
      setError(null);
      const origSize = file.size;
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
          setOrig({ w: img.naturalWidth, h: img.naturalHeight, size: origSize });
          setSrc(url);
          void run(format, targetKb);
        };
        img.onerror = () => setError('Could not load image.');
        img.src = url;
      };
      reader.onerror = () => setError('Could not read file.');
      reader.readAsDataURL(file);
    },
    [run, format, targetKb]
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
          <Field label="Target max (KB)">
            <Input
              value={targetKb}
              onChange={(e) => setTargetKb(e.target.value)}
              inputMode="numeric"
              className="w-28"
            />
          </Field>
          <Field label="Format">
            <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="jpeg">JPEG</SelectItem>
                <SelectItem value="webp">WebP</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Button
            size="sm"
            disabled={!src || busy}
            onClick={() => void run(format, targetKb)}
          >
            <Gauge className="size-3.5" /> {busy ? 'Working…' : 'Compress'}
          </Button>
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {!src && (
        <p className="px-1 text-xs text-muted-foreground">
          Upload an image and set a max KB. The tool binary-searches encoder quality (and
          halves dimensions if needed) to fit under your upload limit. All offline.
        </p>
      )}

      {src && outUrl && info && (
        <Panel>
          <PanelHeader title="Result" />
          <div className="flex flex-col items-center gap-3 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={outUrl} alt="compressed result" className="max-h-[460px] rounded border" />
            <a href={outUrl} download={`compressed.${format === 'jpeg' ? 'jpg' : 'webp'}`}>
              <Button size="sm">Download {format.toUpperCase()}</Button>
            </a>
            {!info.underTarget && (
              <p className="text-xs text-amber-600">
                Could not reach the target even at minimum quality and reduced size; this is
                the smallest achievable result.
              </p>
            )}
          </div>
          <StatBar
            items={[
              orig && `original ${orig.w}×${orig.h}px · ${formatBytes(orig.size)}`,
              `achieved ${formatBytes(info.size)}`,
              `quality ${(info.quality * 100).toFixed(0)}%`,
              `dims ${info.w}×${info.h}px`,
              info.scaleSteps > 0 && `downscaled ${info.scaleSteps}×`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
