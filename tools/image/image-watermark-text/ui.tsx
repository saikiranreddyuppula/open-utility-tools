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
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { ErrorBanner } from '@/components/tools/error-banner';

type Mode = 'single' | 'tiled';
type Format = 'png' | 'jpeg';
type Anchor =
  | 'tl' | 'tc' | 'tr'
  | 'ml' | 'mc' | 'mr'
  | 'bl' | 'bc' | 'br';

interface Params {
  text: string;
  fontSize: number;
  color: string;
  opacity: number;
  angle: number;
  spacing: number;
  mode: Mode;
  anchor: Anchor;
}

const ANCHORS: { value: Anchor; label: string }[] = [
  { value: 'tl', label: '↖' }, { value: 'tc', label: '↑' }, { value: 'tr', label: '↗' },
  { value: 'ml', label: '←' }, { value: 'mc', label: '•' }, { value: 'mr', label: '→' },
  { value: 'bl', label: '↙' }, { value: 'bc', label: '↓' }, { value: 'br', label: '↘' },
];

export default function WatermarkTextTool() {
  const [src, setSrc] = useState<string | null>(null);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<Format>('png');
  const [p, setP] = useState<Params>({
    text: '© Your Name',
    fontSize: 32,
    color: '#ffffff',
    opacity: 35,
    angle: -30,
    spacing: 180,
    mode: 'tiled',
    anchor: 'br',
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const process = useCallback((dataUrl: string, prm: Params, fmt: Format) => {
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

      const text = prm.text || ' ';
      const fontPx = Math.max(6, prm.fontSize);
      ctx.font = `bold ${fontPx}px sans-serif`;
      ctx.fillStyle = prm.color;
      ctx.globalAlpha = Math.min(1, Math.max(0, prm.opacity / 100));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const rad = (prm.angle * Math.PI) / 180;

      if (prm.mode === 'single') {
        const pad = fontPx;
        let x = w / 2;
        let y = h / 2;
        const a = prm.anchor;
        if (a === 'tl' || a === 'ml' || a === 'bl') x = pad + ctx.measureText(text).width / 2;
        if (a === 'tr' || a === 'mr' || a === 'br') x = w - pad - ctx.measureText(text).width / 2;
        if (a === 'tl' || a === 'tc' || a === 'tr') y = pad + fontPx / 2;
        if (a === 'bl' || a === 'bc' || a === 'br') y = h - pad - fontPx / 2;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rad);
        ctx.fillText(text, 0, 0);
        ctx.restore();
      } else {
        const step = Math.max(20, prm.spacing);
        const diag = Math.sqrt(w * w + h * h);
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.rotate(rad);
        for (let yy = -diag; yy < diag; yy += step) {
          for (let xx = -diag; xx < diag; xx += step) {
            ctx.fillText(text, xx, yy);
          }
        }
        ctx.restore();
      }

      ctx.globalAlpha = 1;
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setError('Could not encode image.');
            return;
          }
          setOutUrl(URL.createObjectURL(blob));
        },
        fmt === 'png' ? 'image/png' : 'image/jpeg',
        fmt === 'jpeg' ? 0.92 : undefined
      );
      setError(null);
    };
    img.onerror = () => setError('Could not load image.');
    img.src = dataUrl;
  }, []);

  const update = useCallback(
    (over: Partial<Params>) => {
      const next = { ...p, ...over };
      setP(next);
      if (src) process(src, next, format);
    },
    [p, src, format, process]
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
        process(url, p, format);
      };
      reader.onerror = () => setError('Could not read file.');
      reader.readAsDataURL(file);
    },
    [process, p, format]
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
          <Field label="Watermark text" className="min-w-[180px]">
            <Input value={p.text} onChange={(e) => update({ text: e.target.value })} />
          </Field>
          <Field label="Mode">
            <Tabs value={p.mode} onValueChange={(v) => update({ mode: v as Mode })}>
              <TabsList>
                <TabsTrigger value="single">Single</TabsTrigger>
                <TabsTrigger value="tiled">Tiled</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {p.mode === 'single' && (
            <Field label="Position">
              <Select value={p.anchor} onValueChange={(v) => update({ anchor: v as Anchor })}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANCHORS.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label} {a.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {p.mode === 'tiled' && (
            <Field label={`Spacing: ${p.spacing}px`} className="min-w-[150px]">
              <Slider
                value={[p.spacing]}
                min={40}
                max={500}
                step={5}
                onValueChange={(v) => update({ spacing: v[0] ?? 180 })}
              />
            </Field>
          )}
          <Field label="Color">
            <Input
              type="color"
              value={p.color}
              onChange={(e) => update({ color: e.target.value })}
              className="h-8 w-12 p-1"
            />
          </Field>
          <Field label={`Font size: ${p.fontSize}px`} className="min-w-[150px]">
            <Slider
              value={[p.fontSize]}
              min={8}
              max={200}
              step={1}
              onValueChange={(v) => update({ fontSize: v[0] ?? 32 })}
            />
          </Field>
          <Field label={`Opacity: ${p.opacity}%`} className="min-w-[150px]">
            <Slider
              value={[p.opacity]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v) => update({ opacity: v[0] ?? 35 })}
            />
          </Field>
          <Field label={`Angle: ${p.angle}°`} className="min-w-[150px]">
            <Slider
              value={[p.angle]}
              min={-90}
              max={90}
              step={1}
              onValueChange={(v) => update({ angle: v[0] ?? -30 })}
            />
          </Field>
          <Field label="Format">
            <Select
              value={format}
              onValueChange={(v) => {
                const f = v as Format;
                setFormat(f);
                if (src) process(src, p, f);
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

      {!outUrl && (
        <p className="px-1 text-xs text-muted-foreground">
          Upload an image to stamp it with a single or repeating text watermark. All processing
          happens locally in your browser.
        </p>
      )}

      {outUrl && (
        <Panel>
          <PanelHeader title="Result" />
          <div className="flex flex-col items-center gap-3 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={outUrl} alt="watermarked result" className="max-h-[460px] rounded border" />
            <a href={outUrl} download={`watermarked.${format === 'png' ? 'png' : 'jpg'}`}>
              <Button size="sm">Download {format.toUpperCase()}</Button>
            </a>
          </div>
        </Panel>
      )}
    </div>
  );
}
