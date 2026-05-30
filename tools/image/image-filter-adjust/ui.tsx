'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, RefreshCw } from 'lucide-react';
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

type Fmt = 'image/png' | 'image/jpeg';

interface Adjust {
  brightness: number;
  contrast: number;
  saturate: number;
  hue: number;
}

const DEFAULTS: Adjust = { brightness: 100, contrast: 100, saturate: 100, hue: 0 };

export default function FilterAdjustTool() {
  const [src, setSrc] = useState<string | null>(null);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adj, setAdj] = useState<Adjust>(DEFAULTS);
  const [fmt, setFmt] = useState<Fmt>('image/png');
  const fileRef = useRef<HTMLInputElement>(null);

  const process = useCallback((dataUrl: string, a: Adjust, format: Fmt) => {
    const img = new globalThis.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, img.naturalWidth);
      canvas.height = Math.max(1, img.naturalHeight);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('Canvas not supported in this browser.');
        return;
      }
      if (format === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.filter = `brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturate}%) hue-rotate(${a.hue}deg)`;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setOutUrl(canvas.toDataURL(format, format === 'image/jpeg' ? 0.92 : undefined));
      setError(null);
    };
    img.onerror = () => setError('Could not load image.');
    img.src = dataUrl;
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
        setSrc(url);
      };
      reader.onerror = () => setError('Could not read file.');
      reader.readAsDataURL(file);
    },
    []
  );

  useEffect(() => {
    if (src) process(src, adj, fmt);
  }, [src, adj, fmt, process]);

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAdj(DEFAULTS)}
            disabled={!src}
          >
            <RefreshCw className="size-3.5" /> Reset
          </Button>
        </OptionsBar>
        <div className="grid grid-cols-1 gap-4 p-3 sm:grid-cols-2">
          <Field label={`Brightness: ${adj.brightness}%`}>
            <Slider
              value={[adj.brightness]}
              min={0}
              max={200}
              step={1}
              onValueChange={(v) => setAdj((p) => ({ ...p, brightness: v[0] ?? 100 }))}
            />
          </Field>
          <Field label={`Contrast: ${adj.contrast}%`}>
            <Slider
              value={[adj.contrast]}
              min={0}
              max={200}
              step={1}
              onValueChange={(v) => setAdj((p) => ({ ...p, contrast: v[0] ?? 100 }))}
            />
          </Field>
          <Field label={`Saturation: ${adj.saturate}%`}>
            <Slider
              value={[adj.saturate]}
              min={0}
              max={200}
              step={1}
              onValueChange={(v) => setAdj((p) => ({ ...p, saturate: v[0] ?? 100 }))}
            />
          </Field>
          <Field label={`Hue rotate: ${adj.hue}°`}>
            <Slider
              value={[adj.hue]}
              min={-180}
              max={180}
              step={1}
              onValueChange={(v) => setAdj((p) => ({ ...p, hue: v[0] ?? 0 }))}
            />
          </Field>
        </div>
      </Panel>

      <ErrorBanner error={error} />

      {outUrl && (
        <Panel>
          <PanelHeader title="Result" />
          <div className="flex flex-col items-center gap-3 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={outUrl} alt="adjusted" className="max-h-[420px] rounded border" />
            <a href={outUrl} download={`adjusted.${ext}`}>
              <Button size="sm">Download {ext.toUpperCase()}</Button>
            </a>
          </div>
        </Panel>
      )}

      <p className="px-1 text-2xs text-muted-foreground">
        Adjustments are applied with the canvas CSS filter pipeline. Everything runs locally in your
        browser.
      </p>
    </div>
  );
}
