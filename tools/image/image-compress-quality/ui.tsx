'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ErrorBanner } from '@/components/tools/error-banner';

type OutFormat = 'image/jpeg' | 'image/webp';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ImageCompressorTool() {
  const [src, setSrc] = useState<string | null>(null);
  const [origUrl, setOrigUrl] = useState<string | null>(null);
  const [origBytes, setOrigBytes] = useState(0);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [outBytes, setOutBytes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [quality, setQuality] = useState(70);
  const [format, setFormat] = useState<OutFormat>('image/jpeg');
  const [capDim, setCapDim] = useState(false);
  const [maxDim, setMaxDim] = useState(1920);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastOut = useRef<string | null>(null);

  const encode = useCallback(
    (dataUrl: string, q: number, fmt: OutFormat, cap: boolean, dim: number) => {
      const img = new globalThis.Image();
      img.onload = () => {
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (cap && dim > 0) {
          const scale = Math.min(1, dim / Math.max(w, h));
          w = Math.max(1, Math.round(w * scale));
          h = Math.max(1, Math.round(h * scale));
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setError('Canvas not supported.');
          return;
        }
        if (fmt === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
        }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              setError('Could not encode image (format may be unsupported).');
              return;
            }
            if (lastOut.current) URL.revokeObjectURL(lastOut.current);
            const url = URL.createObjectURL(blob);
            lastOut.current = url;
            setOutUrl(url);
            setOutBytes(blob.size);
          },
          fmt,
          Math.min(1, Math.max(0.1, q / 100))
        );
      };
      img.onerror = () => setError('Could not load image.');
      img.src = dataUrl;
    },
    []
  );

  const scheduleEncode = useCallback(
    (dataUrl: string, q: number, fmt: OutFormat, cap: boolean, dim: number) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => encode(dataUrl, q, fmt, cap, dim), 180);
    },
    [encode]
  );

  useEffect(() => {
    return () => {
      if (lastOut.current) URL.revokeObjectURL(lastOut.current);
    };
  }, []);

  const onFile = useCallback(
    (file: File) => {
      setError(null);
      setOrigBytes(file.size);
      const reader = new FileReader();
      reader.onload = () => {
        const url = typeof reader.result === 'string' ? reader.result : null;
        if (!url) {
          setError('Could not read file.');
          return;
        }
        setSrc(url);
        setOrigUrl(url);
        encode(url, quality, format, capDim, maxDim);
      };
      reader.onerror = () => setError('Could not read file.');
      reader.readAsDataURL(file);
    },
    [encode, quality, format, capDim, maxDim]
  );

  const saved = origBytes > 0 && outBytes > 0 ? 1 - outBytes / origBytes : 0;
  const ext = format === 'image/jpeg' ? 'jpg' : 'webp';

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
          <Field label="Format">
            <Select
              value={format}
              onValueChange={(v) => {
                const fmt = v as OutFormat;
                setFormat(fmt);
                if (src) encode(src, quality, fmt, capDim, maxDim);
              }}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image/jpeg">JPEG</SelectItem>
                <SelectItem value="image/webp">WebP</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={`Quality: ${quality}`} className="min-w-[200px]">
            <Slider
              value={[quality]}
              min={10}
              max={100}
              step={1}
              onValueChange={(v) => {
                const q = v[0] ?? 70;
                setQuality(q);
                if (src) scheduleEncode(src, q, format, capDim, maxDim);
              }}
            />
          </Field>
          <Field label="Cap dimension">
            <div className="flex h-8 items-center gap-2">
              <Switch
                checked={capDim}
                onCheckedChange={(c) => {
                  setCapDim(c);
                  if (src) encode(src, quality, format, c, maxDim);
                }}
              />
              <Label className="text-xs text-muted-foreground">resize down</Label>
            </div>
          </Field>
          {capDim && (
            <Field label="Max px (long edge)">
              <Input
                type="number"
                value={maxDim}
                min={1}
                onChange={(e) => {
                  const d = Math.max(1, Number(e.target.value) || 1);
                  setMaxDim(d);
                  if (src) scheduleEncode(src, quality, format, capDim, d);
                }}
                className="w-24 font-mono"
              />
            </Field>
          )}
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {!outUrl && (
        <p className="px-1 text-xs text-muted-foreground">
          Upload an image and adjust quality to shrink it. Encoding runs entirely in your
          browser — the file is never uploaded.
        </p>
      )}

      {outUrl && origUrl && (
        <Panel>
          <PanelHeader title="Before / After">
            <a href={outUrl} download={`compressed.${ext}`}>
              <Button size="sm">Download {ext.toUpperCase()}</Button>
            </a>
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
            <div className="flex flex-col items-center gap-2">
              <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                Original · {formatBytes(origBytes)}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={origUrl} alt="original" className="max-h-[360px] rounded border" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                Compressed · {formatBytes(outBytes)}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={outUrl} alt="compressed" className="max-h-[360px] rounded border" />
            </div>
          </div>
          <StatBar
            items={[
              `Original ${formatBytes(origBytes)}`,
              `Compressed ${formatBytes(outBytes)}`,
              saved > 0 ? `Saved ${(saved * 100).toFixed(1)}%` : `+${((-saved) * 100).toFixed(1)}% (larger)`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
