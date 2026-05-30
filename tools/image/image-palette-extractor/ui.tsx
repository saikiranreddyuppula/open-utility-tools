'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

interface Px {
  r: number;
  g: number;
  b: number;
}

interface Swatch {
  hex: string;
  rgb: string;
  count: number;
  pct: number;
}

function toHex(n: number): string {
  const v = Math.max(0, Math.min(255, Math.round(n)));
  return v.toString(16).padStart(2, '0');
}

// Median-cut quantization: recursively split the box with the largest channel
// range at its median along that channel until we have `target` boxes.
function medianCut(pixels: Px[], target: number): Px[][] {
  if (pixels.length === 0) return [];
  let boxes: Px[][] = [pixels];
  while (boxes.length < target) {
    // Find the box with the largest single-channel range.
    let bestIdx = -1;
    let bestRange = -1;
    let bestChannel: 'r' | 'g' | 'b' = 'r';
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (!box || box.length < 2) continue;
      let rMin = 255;
      let rMax = 0;
      let gMin = 255;
      let gMax = 0;
      let bMin = 255;
      let bMax = 0;
      for (const p of box) {
        if (p.r < rMin) rMin = p.r;
        if (p.r > rMax) rMax = p.r;
        if (p.g < gMin) gMin = p.g;
        if (p.g > gMax) gMax = p.g;
        if (p.b < bMin) bMin = p.b;
        if (p.b > bMax) bMax = p.b;
      }
      const rr = rMax - rMin;
      const gr = gMax - gMin;
      const br = bMax - bMin;
      const localMax = Math.max(rr, gr, br);
      if (localMax > bestRange) {
        bestRange = localMax;
        bestIdx = i;
        bestChannel = rr >= gr && rr >= br ? 'r' : gr >= br ? 'g' : 'b';
      }
    }
    if (bestIdx < 0) break; // no box can be split further
    const box = boxes[bestIdx];
    if (!box) break;
    const sorted = [...box].sort((a, b) => a[bestChannel] - b[bestChannel]);
    const mid = Math.floor(sorted.length / 2);
    const left = sorted.slice(0, mid);
    const right = sorted.slice(mid);
    if (left.length === 0 || right.length === 0) break;
    boxes = boxes.filter((_, i) => i !== bestIdx);
    boxes.push(left, right);
  }
  return boxes;
}

export default function PaletteExtractorTool() {
  const [swatches, setSwatches] = useState<Swatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(8);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const analyse = useCallback((dataUrl: string, n: number) => {
    const img = new globalThis.Image();
    img.onload = () => {
      const maxDim = 200;
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight, 1));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('Canvas not supported in this browser.');
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      let data: Uint8ClampedArray;
      try {
        data = ctx.getImageData(0, 0, w, h).data;
      } catch {
        setError('Could not read pixel data from this image.');
        return;
      }
      const pixels: Px[] = [];
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3] ?? 0;
        if (a < 16) continue; // skip transparent
        pixels.push({
          r: data[i] ?? 0,
          g: data[i + 1] ?? 0,
          b: data[i + 2] ?? 0,
        });
      }
      if (pixels.length === 0) {
        setError('Image has no opaque pixels to sample.');
        setSwatches([]);
        return;
      }
      const boxes = medianCut(pixels, n);
      const total = pixels.length;
      const result: Swatch[] = boxes
        .filter((b) => b.length > 0)
        .map((box) => {
          let sr = 0;
          let sg = 0;
          let sb = 0;
          for (const p of box) {
            sr += p.r;
            sg += p.g;
            sb += p.b;
          }
          const r = sr / box.length;
          const g = sg / box.length;
          const b = sb / box.length;
          return {
            hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`,
            rgb: `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`,
            count: box.length,
            pct: Math.round((box.length / total) * 1000) / 10,
          };
        })
        .sort((a, b) => b.count - a.count);
      setSwatches(result);
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
        setPreview(url);
        analyse(url, count);
      };
      reader.onerror = () => setError('Could not read file.');
      reader.readAsDataURL(file);
    },
    [analyse, count]
  );

  const onCountChange = useCallback(
    (n: number) => {
      setCount(n);
      if (preview) analyse(preview, n);
    },
    [preview, analyse]
  );

  const cssVars = swatches
    .map((s, i) => `  --color-${i + 1}: ${s.hex};`)
    .join('\n');
  const cssBlock = `:root {\n${cssVars}\n}`;
  const jsonBlock = JSON.stringify(
    swatches.map((s) => ({ hex: s.hex, rgb: s.rgb, percent: s.pct })),
    null,
    2
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
          <Field label="Colors">
            <Select value={String(count)} onValueChange={(v) => onCountChange(Number(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2, 3, 4, 5, 6, 8, 10, 12, 16].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {preview && (
        <Panel>
          <PanelHeader title="Source" />
          <div className="flex justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="source" className="max-h-[220px] rounded border" />
          </div>
        </Panel>
      )}

      {swatches.length > 0 && (
        <>
          <Panel>
            <PanelHeader title="Palette" />
            <div className="flex h-12 w-full overflow-hidden rounded-md border">
              {swatches.map((s) => (
                <div
                  key={s.hex + s.count}
                  style={{ backgroundColor: s.hex, flexGrow: Math.max(s.pct, 1) }}
                  title={`${s.hex} · ${s.pct}%`}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 md:grid-cols-4">
              {swatches.map((s) => (
                <div
                  key={s.hex + s.count}
                  className="flex items-center gap-2 rounded-md border bg-muted/30 p-2"
                >
                  <div
                    className="size-8 shrink-0 rounded border"
                    style={{ backgroundColor: s.hex }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <code className="font-mono text-xs">{s.hex}</code>
                      <CopyButton value={s.hex} size="icon-sm" />
                    </div>
                    <div className="truncate font-mono text-2xs text-muted-foreground">
                      {s.rgb} · {s.pct}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <StatBar items={[`${swatches.length} colors`, 'median-cut · sorted by population']} />
          </Panel>

          <Panel>
            <PanelHeader title="CSS variables">
              <CopyButton value={cssBlock} />
            </PanelHeader>
            <pre className="overflow-auto p-3 font-mono text-xs leading-relaxed">{cssBlock}</pre>
          </Panel>

          <Panel>
            <PanelHeader title="JSON">
              <CopyButton value={jsonBlock} />
            </PanelHeader>
            <pre className="max-h-72 overflow-auto p-3 font-mono text-xs leading-relaxed">
              {jsonBlock}
            </pre>
          </Panel>
        </>
      )}

      <p className="px-1 text-2xs text-muted-foreground">
        Colors are computed from a downscaled copy in your browser — nothing is uploaded.
      </p>
    </div>
  );
}
