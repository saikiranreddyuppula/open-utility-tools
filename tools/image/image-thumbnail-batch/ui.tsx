'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, Download } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ErrorBanner } from '@/components/tools/error-banner';

type Fit = 'cover' | 'contain';
type Format = 'png' | 'jpeg' | 'webp';

interface Thumb {
  name: string;
  url: string;
}

const EXT: Record<Format, string> = { png: 'png', jpeg: 'jpg', webp: 'webp' };
const MIME: Record<Format, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export default function ThumbnailBatchTool() {
  const [thumbs, setThumbs] = useState<Thumb[]>([]);
  const [wStr, setWStr] = useState('200');
  const [hStr, setHStr] = useState('200');
  const [fit, setFit] = useState<Fit>('cover');
  const [bg, setBg] = useState('#ffffff');
  const [format, setFormat] = useState<Format>('jpeg');
  const [quality, setQuality] = useState('85');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const makeThumb = useCallback(
    (img: HTMLImageElement, tw: number, th: number, f: Fit, bgColor: string, fmt: Format, q: number): string | null => {
      const canvas = document.createElement('canvas');
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      if (fmt !== 'png' || f === 'contain') {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, tw, th);
      }

      const sw = img.naturalWidth;
      const sh = img.naturalHeight;
      const scale = f === 'cover' ? Math.max(tw / sw, th / sh) : Math.min(tw / sw, th / sh);
      const dw = sw * scale;
      const dh = sh * scale;
      const dx = (tw - dw) / 2;
      const dy = (th - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);

      return canvas.toDataURL(MIME[fmt], fmt === 'png' ? undefined : q);
    },
    []
  );

  const addFiles = useCallback(
    (files: FileList) => {
      setError(null);
      const tw = Math.max(1, Math.floor(Number(wStr) || 0));
      const th = Math.max(1, Math.floor(Number(hStr) || 0));
      if (tw < 1 || th < 1 || tw > 4000 || th > 4000) {
        setError('Enter valid thumbnail dimensions (1–4000 px).');
        return;
      }
      const q = Math.min(1, Math.max(0, (Number(quality) || 85) / 100));
      const arr = Array.from(files);
      let pending = arr.length;
      const out: Thumb[] = [];
      for (const file of arr) {
        const reader = new FileReader();
        reader.onload = () => {
          const url = typeof reader.result === 'string' ? reader.result : null;
          if (!url) {
            pending -= 1;
            if (pending === 0 && out.length > 0) setThumbs((p) => [...p, ...out]);
            return;
          }
          const img = new globalThis.Image();
          img.onload = () => {
            const thumbUrl = makeThumb(img, tw, th, fit, bg, format, q);
            if (thumbUrl) {
              const base = file.name.replace(/\.[^.]+$/, '');
              out.push({ name: `${base}-${tw}x${th}.${EXT[format]}`, url: thumbUrl });
            }
            pending -= 1;
            if (pending === 0) setThumbs((p) => [...p, ...out]);
          };
          img.onerror = () => {
            pending -= 1;
            setError(`Could not load ${file.name}.`);
            if (pending === 0 && out.length > 0) setThumbs((p) => [...p, ...out]);
          };
          img.src = url;
        };
        reader.onerror = () => {
          pending -= 1;
          setError(`Could not read ${file.name}.`);
        };
        reader.readAsDataURL(file);
      }
    },
    [wStr, hStr, quality, fit, bg, format, makeThumb]
  );

  const downloadAll = useCallback(() => {
    for (let i = 0; i < thumbs.length; i++) {
      const t = thumbs[i];
      if (!t) continue;
      const a = document.createElement('a');
      a.href = t.url;
      a.download = t.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, [thumbs]);

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
              const fs = e.target.files;
              if (fs && fs.length > 0) addFiles(fs);
              e.target.value = '';
            }}
          />
          <Field label="Width">
            <Input value={wStr} onChange={(e) => setWStr(e.target.value)} inputMode="numeric" className="w-20" />
          </Field>
          <Field label="Height">
            <Input value={hStr} onChange={(e) => setHStr(e.target.value)} inputMode="numeric" className="w-20" />
          </Field>
          <Field label="Fit">
            <Tabs value={fit} onValueChange={(v) => setFit(v as Fit)}>
              <TabsList>
                <TabsTrigger value="cover">Cover (crop)</TabsTrigger>
                <TabsTrigger value="contain">Contain (pad)</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Background">
            <Input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="h-8 w-12 p-1" />
          </Field>
          <Field label="Format">
            <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="jpeg">JPEG</SelectItem>
                <SelectItem value="png">PNG</SelectItem>
                <SelectItem value="webp">WebP</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {format !== 'png' && (
            <Field label="Quality">
              <Input value={quality} onChange={(e) => setQuality(e.target.value)} inputMode="numeric" className="w-20" />
            </Field>
          )}
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {thumbs.length === 0 && (
        <p className="px-1 text-xs text-muted-foreground">
          Set a thumbnail size and fit mode, then add one or more images. Each is resized to the
          exact size. All processing happens locally in your browser.
        </p>
      )}

      {thumbs.length > 0 && (
        <Panel>
          <PanelHeader title={`${thumbs.length} thumbnail${thumbs.length === 1 ? '' : 's'}`}>
            <Button variant="secondary" size="sm" onClick={downloadAll}>
              <Download className="size-3.5" /> Download all
            </Button>
          </PanelHeader>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3 p-3">
            {thumbs.map((t, i) => (
              <a
                key={`${t.name}-${i}`}
                href={t.url}
                download={t.name}
                className="flex flex-col items-center gap-1 rounded-md border bg-muted/30 p-2 hover:bg-muted/60"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.url} alt={t.name} className="max-h-28 rounded border" />
                <span className="max-w-full truncate font-mono text-2xs text-muted-foreground">
                  {t.name}
                </span>
              </a>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
