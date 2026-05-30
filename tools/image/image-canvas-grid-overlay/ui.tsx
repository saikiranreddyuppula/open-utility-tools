'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ErrorBanner } from '@/components/tools/error-banner';

type GuideType = 'thirds' | 'golden' | 'grid' | 'pixel';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) {
    const r0 = h[0] ?? '0';
    const g0 = h[1] ?? '0';
    const b0 = h[2] ?? '0';
    h = `${r0}${r0}${g0}${g0}${b0}${b0}`;
  }
  const n = parseInt(h, 16);
  if (!Number.isFinite(n) || h.length !== 6) return { r: 255, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export default function ImageGridOverlayTool() {
  const [src, setSrc] = useState<string | null>(null);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guide, setGuide] = useState<GuideType>('thirds');
  const [cols, setCols] = useState(4);
  const [rows, setRows] = useState(4);
  const [spacing, setSpacing] = useState(50);
  const [color, setColor] = useState('#ff2d55');
  const [opacity, setOpacity] = useState(80);
  const [lineWidth, setLineWidth] = useState(2);
  const fileRef = useRef<HTMLInputElement>(null);

  const process = useCallback(
    (
      dataUrl: string,
      g: GuideType,
      c: number,
      r: number,
      sp: number,
      col: string,
      op: number,
      lw: number
    ) => {
      const img = new globalThis.Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setError('Canvas not supported.');
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const { r: rr, g: gg, b: bb } = hexToRgb(col);
        ctx.strokeStyle = `rgba(${rr},${gg},${bb},${op / 100})`;
        ctx.lineWidth = Math.max(1, lw);

        const vlines: number[] = [];
        const hlines: number[] = [];

        if (g === 'thirds') {
          vlines.push(w / 3, (2 * w) / 3);
          hlines.push(h / 3, (2 * h) / 3);
        } else if (g === 'golden') {
          const phi = 0.6180339887;
          vlines.push(w * (1 - phi), w * phi);
          hlines.push(h * (1 - phi), h * phi);
        } else if (g === 'grid') {
          const nc = Math.max(1, c);
          const nr = Math.max(1, r);
          for (let i = 1; i < nc; i++) vlines.push((w * i) / nc);
          for (let i = 1; i < nr; i++) hlines.push((h * i) / nr);
        } else {
          const step = Math.max(2, sp);
          for (let x = step; x < w; x += step) vlines.push(x);
          for (let y = step; y < h; y += step) hlines.push(y);
        }

        ctx.beginPath();
        for (const x of vlines) {
          const px = Math.round(x) + 0.5;
          ctx.moveTo(px, 0);
          ctx.lineTo(px, h);
        }
        for (const y of hlines) {
          const py = Math.round(y) + 0.5;
          ctx.moveTo(0, py);
          ctx.lineTo(w, py);
        }
        ctx.stroke();

        setOutUrl(canvas.toDataURL('image/png'));
      };
      img.onerror = () => setError('Could not load image.');
      img.src = dataUrl;
    },
    []
  );

  const rerun = useCallback(
    (next: Partial<{
      g: GuideType;
      c: number;
      r: number;
      sp: number;
      col: string;
      op: number;
      lw: number;
    }>) => {
      if (!src) return;
      process(
        src,
        next.g ?? guide,
        next.c ?? cols,
        next.r ?? rows,
        next.sp ?? spacing,
        next.col ?? color,
        next.op ?? opacity,
        next.lw ?? lineWidth
      );
    },
    [src, guide, cols, rows, spacing, color, opacity, lineWidth, process]
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
        process(url, guide, cols, rows, spacing, color, opacity, lineWidth);
      };
      reader.onerror = () => setError('Could not read file.');
      reader.readAsDataURL(file);
    },
    [process, guide, cols, rows, spacing, color, opacity, lineWidth]
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
          <Field label="Guide type">
            <Select
              value={guide}
              onValueChange={(v) => {
                const g = v as GuideType;
                setGuide(g);
                rerun({ g });
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="thirds">Rule of thirds</SelectItem>
                <SelectItem value="golden">Golden ratio</SelectItem>
                <SelectItem value="grid">N×M grid</SelectItem>
                <SelectItem value="pixel">Fixed pixel grid</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {guide === 'grid' && (
            <>
              <Field label={`Columns: ${cols}`} className="min-w-[140px]">
                <Slider
                  value={[cols]}
                  min={2}
                  max={24}
                  step={1}
                  onValueChange={(v) => {
                    const c = v[0] ?? 4;
                    setCols(c);
                    rerun({ c });
                  }}
                />
              </Field>
              <Field label={`Rows: ${rows}`} className="min-w-[140px]">
                <Slider
                  value={[rows]}
                  min={2}
                  max={24}
                  step={1}
                  onValueChange={(v) => {
                    const r = v[0] ?? 4;
                    setRows(r);
                    rerun({ r });
                  }}
                />
              </Field>
            </>
          )}

          {guide === 'pixel' && (
            <Field label={`Spacing: ${spacing}px`} className="min-w-[160px]">
              <Slider
                value={[spacing]}
                min={5}
                max={300}
                step={1}
                onValueChange={(v) => {
                  const sp = v[0] ?? 50;
                  setSpacing(sp);
                  rerun({ sp });
                }}
              />
            </Field>
          )}

          <Field label="Line color">
            <Input
              type="color"
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                rerun({ col: e.target.value });
              }}
              className="h-8 w-14 p-1"
            />
          </Field>
          <Field label={`Opacity: ${opacity}%`} className="min-w-[140px]">
            <Slider
              value={[opacity]}
              min={5}
              max={100}
              step={1}
              onValueChange={(v) => {
                const op = v[0] ?? 80;
                setOpacity(op);
                rerun({ op });
              }}
            />
          </Field>
          <Field label={`Line width: ${lineWidth}px`} className="min-w-[140px]">
            <Slider
              value={[lineWidth]}
              min={1}
              max={8}
              step={1}
              onValueChange={(v) => {
                const lw = v[0] ?? 2;
                setLineWidth(lw);
                rerun({ lw });
              }}
            />
          </Field>
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {!outUrl && (
        <p className="px-1 text-xs text-muted-foreground">
          Upload an image to overlay composition guides. Everything is processed locally
          in your browser — nothing is uploaded.
        </p>
      )}

      {outUrl && (
        <Panel>
          <PanelHeader title="Result" />
          <div className="flex flex-col items-center gap-3 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={outUrl} alt="overlay result" className="max-h-[460px] rounded border" />
            <a href={outUrl} download="grid-overlay.png">
              <Button size="sm">Download PNG</Button>
            </a>
          </div>
        </Panel>
      )}
    </div>
  );
}
