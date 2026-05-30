'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Ramp = 'short' | 'long' | 'blocks';

const RAMPS: Record<Ramp, string> = {
  // ordered light -> dark
  short: ' .:-=+*#%@',
  long: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
  blocks: ' ░▒▓█',
};

interface Pixels {
  data: Uint8ClampedArray;
  w: number;
  h: number;
}

export default function ImageToAsciiArt() {
  const [pixels, setPixels] = useState<Pixels | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(80);
  const [ramp, setRamp] = useState<Ramp>('short');
  const [invert, setInvert] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const sampleData = useMemo(() => {
    // Draw a small built-in gradient circle so the tool works without an upload.
    const w = 60;
    const h = 60;
    const arr = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - w / 2;
        const dy = y - h / 2;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const v = Math.max(0, 255 - dist * 9);
        const i = (y * w + x) * 4;
        arr[i] = v;
        arr[i + 1] = v;
        arr[i + 2] = v;
        arr[i + 3] = 255;
      }
    }
    return { data: arr, w, h };
  }, []);

  const onFile = useCallback((file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : null;
      if (!url) {
        setError('Could not read file.');
        return;
      }
      setPreview(url);
      const img = new globalThis.Image();
      img.onload = () => {
        // Downscale to a manageable working buffer; final char-grid is derived later.
        const maxW = 400;
        const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
        const cw = Math.max(1, Math.round(img.naturalWidth * scale));
        const ch = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setError('Canvas not supported in this browser.');
          return;
        }
        ctx.drawImage(img, 0, 0, cw, ch);
        try {
          const id = ctx.getImageData(0, 0, cw, ch);
          setPixels({ data: id.data, w: cw, h: ch });
        } catch {
          setError('Could not read image pixels (the image may be from another origin).');
        }
      };
      img.onerror = () => setError('Could not load image.');
      img.src = url;
    };
    reader.readAsDataURL(file);
  }, []);

  const active: Pixels = pixels ?? sampleData;

  const ascii = useMemo(() => {
    const { data, w, h } = active;
    const cols = Math.max(8, Math.min(width, 240));
    const cellW = w / cols;
    // Characters are about twice as tall as wide; correct vertical sampling.
    const cellH = cellW * 2;
    const rows = Math.max(1, Math.floor(h / cellH));
    const chars = RAMPS[ramp];
    const lines: string[] = [];
    for (let r = 0; r < rows; r++) {
      let line = '';
      for (let c = 0; c < cols; c++) {
        const x0 = Math.floor(c * cellW);
        const x1 = Math.min(w, Math.floor((c + 1) * cellW));
        const y0 = Math.floor(r * cellH);
        const y1 = Math.min(h, Math.floor((r + 1) * cellH));
        let sum = 0;
        let n = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const i = (y * w + x) * 4;
            const rr = data[i] ?? 0;
            const gg = data[i + 1] ?? 0;
            const bb = data[i + 2] ?? 0;
            const aa = (data[i + 3] ?? 255) / 255;
            // Composite over white so transparent areas read as light.
            const lum = 0.299 * rr + 0.587 * gg + 0.114 * bb;
            sum += lum * aa + 255 * (1 - aa);
            n++;
          }
        }
        let lumAvg = n > 0 ? sum / n : 255;
        if (invert) lumAvg = 255 - lumAvg;
        // Light pixels -> first (sparse) glyph, dark -> last (dense) glyph.
        const t = 1 - lumAvg / 255;
        const idx = Math.min(chars.length - 1, Math.max(0, Math.round(t * (chars.length - 1))));
        line += chars[idx] ?? ' ';
      }
      lines.push(line);
    }
    return lines.join('\n');
  }, [active, width, ramp, invert]);

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader title="Options" />
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
          <Field label={`Width: ${width} cols`} className="min-w-[200px]">
            <Slider
              min={20}
              max={200}
              step={1}
              value={[width]}
              onValueChange={(v) => setWidth(v[0] ?? 80)}
            />
          </Field>
          <Field label="Character ramp">
            <Select value={ramp} onValueChange={(v) => setRamp(v as Ramp)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Short ( .:-=+*#%@)</SelectItem>
                <SelectItem value="long">Detailed (70-char)</SelectItem>
                <SelectItem value="blocks">Unicode blocks</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Invert">
            <div className="flex h-9 items-center gap-2">
              <Switch checked={invert} onCheckedChange={setInvert} />
              <span className="text-sm text-muted-foreground">
                {invert ? 'Dark bg' : 'Light bg'}
              </span>
            </div>
          </Field>
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {preview && (
        <Panel>
          <PanelHeader title="Source image" />
          <div className="flex justify-center p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="source" className="max-h-40 rounded border" />
          </div>
        </Panel>
      )}

      <Panel>
        <PanelHeader title={pixels ? 'ASCII art' : 'ASCII art (sample — upload an image)'}>
          <CopyButton value={() => ascii} disabled={!ascii} />
          <DownloadButton data={() => ascii} filename="ascii-art.txt" disabled={!ascii} />
        </PanelHeader>
        <pre className="max-h-[480px] overflow-auto bg-card p-3 font-mono text-[10px] leading-[1.05]">
          {ascii}
        </pre>
        <StatBar
          items={[
            `${ascii.split('\n').length} rows`,
            `${width} cols`,
            `ramp: ${ramp}`,
            `${ascii.length.toLocaleString()} chars`,
          ]}
        />
      </Panel>
    </div>
  );
}
