'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

type FitMode = 'contain' | 'cover';

interface LoadedImage {
  el: HTMLImageElement;
  name: string;
}

function loadImage(file: File): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : null;
      if (!url) {
        reject(new Error(`Could not read ${file.name}`));
        return;
      }
      const img = new globalThis.Image();
      img.onload = () => resolve({ el: img, name: file.name });
      img.onerror = () => reject(new Error(`Could not decode ${file.name}`));
      img.src = url;
    };
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export default function ContactSheetTool() {
  const [images, setImages] = useState<LoadedImage[]>([]);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cols, setCols] = useState(3);
  const [cellW, setCellW] = useState(240);
  const [cellH, setCellH] = useState(180);
  const [gap, setGap] = useState(12);
  const [bg, setBg] = useState('#ffffff');
  const [caption, setCaption] = useState(true);
  const [fit, setFit] = useState<FitMode>('contain');
  const fileRef = useRef<HTMLInputElement>(null);
  const lastOut = useRef<string | null>(null);

  const render = useCallback(
    (
      imgs: LoadedImage[],
      c: number,
      cw: number,
      ch: number,
      g: number,
      bgc: string,
      cap: boolean,
      fm: FitMode
    ) => {
      setError(null);
      if (imgs.length === 0) {
        setOutUrl(null);
        return;
      }
      const ncols = Math.max(1, c);
      const nrows = Math.ceil(imgs.length / ncols);
      const captionH = cap ? 22 : 0;
      const totalW = ncols * cw + (ncols + 1) * g;
      const totalH = nrows * (ch + captionH) + (nrows + 1) * g;
      const canvas = document.createElement('canvas');
      canvas.width = totalW;
      canvas.height = totalH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('Canvas not supported.');
        return;
      }
      ctx.fillStyle = bgc;
      ctx.fillRect(0, 0, totalW, totalH);
      ctx.imageSmoothingQuality = 'high';

      imgs.forEach((item, i) => {
        const col = i % ncols;
        const row = Math.floor(i / ncols);
        const x0 = g + col * (cw + g);
        const y0 = g + row * (ch + captionH + g);
        const iw = item.el.naturalWidth;
        const ih = item.el.naturalHeight;
        if (iw <= 0 || ih <= 0) return;
        const scale =
          fm === 'contain'
            ? Math.min(cw / iw, ch / ih)
            : Math.max(cw / iw, ch / ih);
        const dw = iw * scale;
        const dh = ih * scale;

        if (fm === 'cover') {
          ctx.save();
          ctx.beginPath();
          ctx.rect(x0, y0, cw, ch);
          ctx.clip();
          ctx.drawImage(item.el, x0 + (cw - dw) / 2, y0 + (ch - dh) / 2, dw, dh);
          ctx.restore();
        } else {
          ctx.drawImage(item.el, x0 + (cw - dw) / 2, y0 + (ch - dh) / 2, dw, dh);
        }

        if (cap) {
          ctx.fillStyle = '#444444';
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          let label = item.name;
          while (label.length > 4 && ctx.measureText(label).width > cw - 6) {
            label = `${label.slice(0, label.length - 2)}…`;
          }
          ctx.fillText(label, x0 + cw / 2, y0 + ch + captionH / 2);
          ctx.textAlign = 'start';
        }
      });

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setError('Could not encode contact sheet.');
            return;
          }
          if (lastOut.current) URL.revokeObjectURL(lastOut.current);
          const url = URL.createObjectURL(blob);
          lastOut.current = url;
          setOutUrl(url);
        },
        'image/png'
      );
    },
    []
  );

  const addFiles = useCallback(
    async (files: File[]) => {
      try {
        const loaded = await Promise.all(files.map(loadImage));
        setImages((prev) => {
          const next = [...prev, ...loaded];
          render(next, cols, cellW, cellH, gap, bg, caption, fit);
          return next;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load images.');
      }
    },
    [render, cols, cellW, cellH, gap, bg, caption, fit]
  );

  const clearAll = useCallback(() => {
    setImages([]);
    setOutUrl(null);
    if (lastOut.current) {
      URL.revokeObjectURL(lastOut.current);
      lastOut.current = null;
    }
  }, []);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="size-3.5" /> Add images
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const fs = e.target.files ? Array.from(e.target.files) : [];
              if (fs.length) void addFiles(fs);
              e.target.value = '';
            }}
          />
          {images.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <Trash2 className="size-3.5" /> Clear
            </Button>
          )}
          <Field label={`Columns: ${cols}`} className="min-w-[140px]">
            <Slider
              value={[cols]}
              min={1}
              max={10}
              step={1}
              onValueChange={(v) => {
                const c = v[0] ?? 3;
                setCols(c);
                render(images, c, cellW, cellH, gap, bg, caption, fit);
              }}
            />
          </Field>
          <Field label="Cell W">
            <Input
              type="number"
              value={cellW}
              min={20}
              onChange={(e) => {
                const cw = Math.max(20, Number(e.target.value) || 20);
                setCellW(cw);
                render(images, cols, cw, cellH, gap, bg, caption, fit);
              }}
              className="w-20 font-mono"
            />
          </Field>
          <Field label="Cell H">
            <Input
              type="number"
              value={cellH}
              min={20}
              onChange={(e) => {
                const ch = Math.max(20, Number(e.target.value) || 20);
                setCellH(ch);
                render(images, cols, cellW, ch, gap, bg, caption, fit);
              }}
              className="w-20 font-mono"
            />
          </Field>
          <Field label={`Gap: ${gap}`} className="min-w-[120px]">
            <Slider
              value={[gap]}
              min={0}
              max={60}
              step={1}
              onValueChange={(v) => {
                const g = v[0] ?? 12;
                setGap(g);
                render(images, cols, cellW, cellH, g, bg, caption, fit);
              }}
            />
          </Field>
          <Field label="Background">
            <Input
              type="color"
              value={bg}
              onChange={(e) => {
                setBg(e.target.value);
                render(images, cols, cellW, cellH, gap, e.target.value, caption, fit);
              }}
              className="h-8 w-14 p-1"
            />
          </Field>
          <Field label="Fit">
            <Select
              value={fit}
              onValueChange={(v) => {
                const fm = v as FitMode;
                setFit(fm);
                render(images, cols, cellW, cellH, gap, bg, caption, fm);
              }}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contain">Contain</SelectItem>
                <SelectItem value="cover">Cover</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Captions">
            <div className="flex h-8 items-center gap-2">
              <Switch
                checked={caption}
                onCheckedChange={(c) => {
                  setCaption(c);
                  render(images, cols, cellW, cellH, gap, bg, c, fit);
                }}
              />
              <Label className="text-xs text-muted-foreground">filenames</Label>
            </div>
          </Field>
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {images.length === 0 && (
        <p className="px-1 text-xs text-muted-foreground">
          Add two or more images to build a single contact-sheet PNG. All images are
          processed locally in your browser.
        </p>
      )}

      {outUrl && (
        <Panel>
          <PanelHeader title="Contact sheet">
            <a href={outUrl} download="contact-sheet.png">
              <Button size="sm">Download PNG</Button>
            </a>
          </PanelHeader>
          <div className="flex flex-col items-center gap-3 overflow-auto p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={outUrl} alt="contact sheet" className="max-h-[520px] rounded border" />
          </div>
          <StatBar items={[`${images.length} images`, `${cols} columns`]} />
        </Panel>
      )}
    </div>
  );
}
