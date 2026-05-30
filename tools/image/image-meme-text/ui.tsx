'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ErrorBanner } from '@/components/tools/error-banner';

// Wrap text into lines that fit within maxWidth at the given font.
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0] ?? '';
  for (let i = 1; i < words.length; i++) {
    const word = words[i] ?? '';
    const test = `${current} ${word}`;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

export default function MemeTextTool() {
  const [src, setSrc] = useState<string | null>(null);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [top, setTop] = useState('Top text');
  const [bottom, setBottom] = useState('Bottom text');
  const [autoSize, setAutoSize] = useState(true);
  const [fontSize, setFontSize] = useState(48);
  const [upper, setUpper] = useState(true);
  const [fill, setFill] = useState('#ffffff');
  const [stroke, setStroke] = useState('#000000');
  const [strokeW, setStrokeW] = useState(6);
  const fileRef = useRef<HTMLInputElement>(null);

  const render = useCallback(
    (
      dataUrl: string,
      topText: string,
      bottomText: string,
      auto: boolean,
      size: number,
      up: boolean,
      fillColor: string,
      strokeColor: string,
      sw: number
    ) => {
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
        ctx.drawImage(img, 0, 0, w, h);

        const fs = auto ? Math.max(12, Math.round(w / 10)) : size;
        ctx.font = `bold ${fs}px Impact, "Arial Black", sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(1, auto ? fs / 8 : sw);
        ctx.fillStyle = fillColor;
        ctx.strokeStyle = strokeColor;

        const maxW = w * 0.94;
        const lineH = fs * 1.05;
        const margin = fs * 0.35;

        const drawBlock = (raw: string, anchor: 'top' | 'bottom') => {
          const text = up ? raw.toUpperCase() : raw;
          const lines = wrapLines(ctx, text, maxW);
          if (lines.length === 0) return;
          if (anchor === 'top') {
            ctx.textBaseline = 'top';
            let y = margin;
            for (const line of lines) {
              ctx.strokeText(line, w / 2, y, maxW);
              ctx.fillText(line, w / 2, y, maxW);
              y += lineH;
            }
          } else {
            ctx.textBaseline = 'bottom';
            let y = h - margin - (lines.length - 1) * lineH;
            for (const line of lines) {
              ctx.strokeText(line, w / 2, y, maxW);
              ctx.fillText(line, w / 2, y, maxW);
              y += lineH;
            }
          }
        };

        if (topText.trim()) drawBlock(topText, 'top');
        if (bottomText.trim()) drawBlock(bottomText, 'bottom');

        setOutUrl(canvas.toDataURL('image/png'));
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
    if (src) {
      render(src, top, bottom, autoSize, fontSize, upper, fill, stroke, strokeW);
    }
  }, [src, top, bottom, autoSize, fontSize, upper, fill, stroke, strokeW, render]);

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
          <Field label="Uppercase">
            <div className="flex h-8 items-center">
              <Switch checked={upper} onCheckedChange={setUpper} />
            </div>
          </Field>
          <Field label="Auto font size">
            <div className="flex h-8 items-center">
              <Switch checked={autoSize} onCheckedChange={setAutoSize} />
            </div>
          </Field>
          {!autoSize && (
            <Field label={`Font: ${fontSize}px`} className="min-w-[160px]">
              <Slider
                value={[fontSize]}
                min={12}
                max={160}
                step={1}
                onValueChange={(v) => setFontSize(v[0] ?? 48)}
              />
            </Field>
          )}
          <Field label="Fill">
            <Input
              type="color"
              value={fill}
              onChange={(e) => setFill(e.target.value)}
              className="h-8 w-14 p-1"
            />
          </Field>
          <Field label="Outline">
            <Input
              type="color"
              value={stroke}
              onChange={(e) => setStroke(e.target.value)}
              className="h-8 w-14 p-1"
            />
          </Field>
          {!autoSize && (
            <Field label={`Outline: ${strokeW}px`} className="min-w-[140px]">
              <Slider
                value={[strokeW]}
                min={0}
                max={20}
                step={1}
                onValueChange={(v) => setStrokeW(v[0] ?? 6)}
              />
            </Field>
          )}
        </OptionsBar>
        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
          <Field label="Top text">
            <Input value={top} onChange={(e) => setTop(e.target.value)} />
          </Field>
          <Field label="Bottom text">
            <Input value={bottom} onChange={(e) => setBottom(e.target.value)} />
          </Field>
        </div>
      </Panel>

      <ErrorBanner error={error} />

      {outUrl ? (
        <Panel>
          <PanelHeader title="Result" />
          <div className="flex flex-col items-center gap-3 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={outUrl} alt="meme" className="max-h-[460px] rounded border" />
            <a href={outUrl} download="meme.png">
              <Button size="sm">Download PNG</Button>
            </a>
          </div>
        </Panel>
      ) : (
        <p className="px-1 text-sm text-muted-foreground">
          Upload an image to add a caption. The Impact font renders best when installed locally; the
          tool falls back to Arial Black.
        </p>
      )}

      <p className="px-1 text-2xs text-muted-foreground">
        Captions are drawn on a canvas in your browser — nothing is uploaded.
      </p>
    </div>
  );
}
