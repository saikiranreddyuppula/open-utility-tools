'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
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

type Fmt = 'image/png' | 'image/jpeg';

export default function ImageBlurTool() {
  const [src, setSrc] = useState<string | null>(null);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [radius, setRadius] = useState(8);
  const [clamp, setClamp] = useState(true);
  const [fmt, setFmt] = useState<Fmt>('image/png');
  const fileRef = useRef<HTMLInputElement>(null);

  const process = useCallback(
    (dataUrl: string, r: number, edgeClamp: boolean, format: Fmt) => {
      const img = new globalThis.Image();
      img.onload = () => {
        const w = Math.max(1, img.naturalWidth);
        const h = Math.max(1, img.naturalHeight);
        // Pad the canvas by the blur radius and extend edges so the blur does
        // not produce a transparent halo, then crop back to the original size.
        const pad = edgeClamp ? Math.ceil(r) : 0;
        const big = document.createElement('canvas');
        big.width = w + pad * 2;
        big.height = h + pad * 2;
        const bctx = big.getContext('2d');
        if (!bctx) {
          setError('Canvas not supported in this browser.');
          return;
        }
        if (pad > 0) {
          // Replicate edges by drawing stretched 1px strips around the image.
          // Corners.
          bctx.drawImage(img, 0, 0, 1, 1, 0, 0, pad, pad);
          bctx.drawImage(img, w - 1, 0, 1, 1, pad + w, 0, pad, pad);
          bctx.drawImage(img, 0, h - 1, 1, 1, 0, pad + h, pad, pad);
          bctx.drawImage(img, w - 1, h - 1, 1, 1, pad + w, pad + h, pad, pad);
          // Edges.
          bctx.drawImage(img, 0, 0, w, 1, pad, 0, w, pad);
          bctx.drawImage(img, 0, h - 1, w, 1, pad, pad + h, w, pad);
          bctx.drawImage(img, 0, 0, 1, h, 0, pad, pad, h);
          bctx.drawImage(img, w - 1, 0, 1, h, pad + w, pad, pad, h);
        }
        bctx.drawImage(img, pad, pad, w, h);

        const out = document.createElement('canvas');
        out.width = w;
        out.height = h;
        const ctx = out.getContext('2d');
        if (!ctx) {
          setError('Canvas not supported in this browser.');
          return;
        }
        if (format === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
        }
        ctx.filter = `blur(${r}px)`;
        // Draw the padded canvas shifted so the original region lands at 0,0.
        ctx.drawImage(big, -pad, -pad);
        setOutUrl(out.toDataURL(format, format === 'image/jpeg' ? 0.92 : undefined));
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
    if (src) process(src, radius, clamp, fmt);
  }, [src, radius, clamp, fmt, process]);

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
          <Field label={`Blur radius: ${radius}px`} className="min-w-[220px]">
            <Slider
              value={[radius]}
              min={0}
              max={50}
              step={1}
              onValueChange={(v) => setRadius(v[0] ?? 0)}
            />
          </Field>
          <Field label="Edge clamp">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={clamp} onCheckedChange={setClamp} />
              <Label className="text-xs text-muted-foreground">avoid halo</Label>
            </div>
          </Field>
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
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {outUrl && (
        <Panel>
          <PanelHeader title="Result" />
          <div className="flex flex-col items-center gap-3 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={outUrl} alt="blurred" className="max-h-[420px] rounded border" />
            <a href={outUrl} download={`blurred.${ext}`}>
              <Button size="sm">Download {ext.toUpperCase()}</Button>
            </a>
          </div>
        </Panel>
      )}

      <p className="px-1 text-2xs text-muted-foreground">
        Uses the native canvas blur filter. Everything runs locally in your browser — nothing is
        uploaded.
      </p>
    </div>
  );
}
