'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ErrorBanner } from '@/components/tools/error-banner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Format = 'png' | 'jpeg';

interface Sides {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

export default function AddBorderTool() {
  const [src, setSrc] = useState<string | null>(null);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [uniform, setUniform] = useState(true);
  const [border, setBorder] = useState(24);
  const [sides, setSides] = useState<Sides>({ top: 24, right: 24, bottom: 24, left: 24 });
  const [borderColor, setBorderColor] = useState('#111827');
  const [padding, setPadding] = useState(16);
  const [paddingColor, setPaddingColor] = useState('#ffffff');
  const [format, setFormat] = useState<Format>('png');

  const fileRef = useRef<HTMLInputElement>(null);

  const process = useCallback(
    (dataUrl: string) => {
      const img = new globalThis.Image();
      img.onload = () => {
        const b: Sides = uniform
          ? { top: border, right: border, bottom: border, left: border }
          : sides;
        const bt = clamp(b.top, 0, 1000);
        const br = clamp(b.right, 0, 1000);
        const bb = clamp(b.bottom, 0, 1000);
        const bl = clamp(b.left, 0, 1000);
        const pad = clamp(padding, 0, 1000);

        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        const totalW = iw + bl + br + pad * 2;
        const totalH = ih + bt + bb + pad * 2;

        const canvas = document.createElement('canvas');
        canvas.width = totalW;
        canvas.height = totalH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setError('Canvas not supported in this browser.');
          return;
        }

        // For JPEG (no alpha) fill the whole canvas with the border color first.
        if (format === 'jpeg') {
          ctx.fillStyle = borderColor;
          ctx.fillRect(0, 0, totalW, totalH);
        } else {
          // PNG: only paint the border ring (padding/image areas may stay transparent
          // if padding is transparent — but color inputs are opaque, so paint border).
          ctx.fillStyle = borderColor;
          ctx.fillRect(0, 0, totalW, totalH);
        }

        // Padding (matte) inside the border.
        ctx.fillStyle = paddingColor;
        ctx.fillRect(bl, bt, iw + pad * 2, ih + pad * 2);

        // Draw the image centered within the padding.
        ctx.drawImage(img, bl + pad, bt + pad, iw, ih);

        const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
        setOutUrl(canvas.toDataURL(mime, format === 'jpeg' ? 0.92 : undefined));
        setDims({ w: totalW, h: totalH });
        setError(null);
      };
      img.onerror = () => setError('Could not load image.');
      img.src = dataUrl;
    },
    [uniform, border, sides, borderColor, padding, paddingColor, format],
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
        process(url);
      };
      reader.readAsDataURL(file);
    },
    [process],
  );

  // Re-process whenever options change and an image is loaded.
  useEffect(() => {
    if (src) process(src);
  }, [src, process]);

  const updateSide = (key: keyof Sides, value: number) => {
    setSides((prev) => ({ ...prev, [key]: clamp(value, 0, 1000) }));
  };

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
          <Field label="Uniform border">
            <div className="flex h-9 items-center gap-2">
              <Switch checked={uniform} onCheckedChange={setUniform} />
              <span className="text-sm text-muted-foreground">{uniform ? 'All sides' : 'Per side'}</span>
            </div>
          </Field>
          {uniform ? (
            <Field label={`Border: ${border}px`} className="min-w-[200px]">
              <Slider min={0} max={200} step={1} value={[border]} onValueChange={(v) => setBorder(v[0] ?? 24)} />
            </Field>
          ) : (
            <>
              <Field label="Top">
                <Input type="number" value={sides.top} onChange={(e) => updateSide('top', Number(e.target.value))} className="w-20 font-mono" />
              </Field>
              <Field label="Right">
                <Input type="number" value={sides.right} onChange={(e) => updateSide('right', Number(e.target.value))} className="w-20 font-mono" />
              </Field>
              <Field label="Bottom">
                <Input type="number" value={sides.bottom} onChange={(e) => updateSide('bottom', Number(e.target.value))} className="w-20 font-mono" />
              </Field>
              <Field label="Left">
                <Input type="number" value={sides.left} onChange={(e) => updateSide('left', Number(e.target.value))} className="w-20 font-mono" />
              </Field>
            </>
          )}
          <Field label="Border color">
            <div className="flex items-center gap-2">
              <Input type="color" value={borderColor} onChange={(e) => setBorderColor(e.target.value)} className="h-9 w-12 p-1" />
              <Input value={borderColor} onChange={(e) => setBorderColor(e.target.value)} className="w-28 font-mono" />
            </div>
          </Field>
          <Field label={`Padding (matte): ${padding}px`} className="min-w-[200px]">
            <Slider min={0} max={200} step={1} value={[padding]} onValueChange={(v) => setPadding(v[0] ?? 16)} />
          </Field>
          <Field label="Padding color">
            <div className="flex items-center gap-2">
              <Input type="color" value={paddingColor} onChange={(e) => setPaddingColor(e.target.value)} className="h-9 w-12 p-1" />
              <Input value={paddingColor} onChange={(e) => setPaddingColor(e.target.value)} className="w-28 font-mono" />
            </div>
          </Field>
          <Field label="Format">
            <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
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
        <Panel>
          <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
            <Upload className="size-6" />
            Upload an image to add a border and padding frame around it.
          </div>
        </Panel>
      )}

      {outUrl && (
        <Panel>
          <PanelHeader title="Result">
            {dims && <span className="px-2 font-mono text-2xs text-muted-foreground">{dims.w} × {dims.h}px</span>}
          </PanelHeader>
          <div className="flex flex-col items-center gap-3 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={outUrl} alt="result with border" className="max-h-[460px] rounded border bg-[conic-gradient(#0001_25%,transparent_0_50%,#0001_0_75%,transparent_0)] bg-[length:16px_16px]" />
            <a href={outUrl} download={`bordered.${format === 'jpeg' ? 'jpg' : 'png'}`}>
              <Button size="sm">Download {format === 'jpeg' ? 'JPEG' : 'PNG'}</Button>
            </a>
          </div>
          <StatBar
            items={[
              dims ? `output ${dims.w}×${dims.h}px` : null,
              `border: ${uniform ? `${border}px` : `${sides.top}/${sides.right}/${sides.bottom}/${sides.left}`}`,
              `padding: ${padding}px`,
              `format: ${format.toUpperCase()}`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
