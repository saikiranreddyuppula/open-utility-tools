'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ErrorBanner } from '@/components/tools/error-banner';

type Mode = 'h2' | 'v2' | 'kaleido';
type Fmt = 'image/png' | 'image/jpeg';

export default function MirrorCollageTool() {
  const [src, setSrc] = useState<string | null>(null);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('h2');
  const [fmt, setFmt] = useState<Fmt>('image/png');
  const fileRef = useRef<HTMLInputElement>(null);

  const process = useCallback((dataUrl: string, m: Mode, format: Fmt) => {
    const img = new globalThis.Image();
    img.onload = () => {
      const w = Math.max(1, img.naturalWidth);
      const h = Math.max(1, img.naturalHeight);
      const canvas = document.createElement('canvas');
      let cw: number;
      let ch: number;
      if (m === 'h2') {
        cw = w * 2;
        ch = h;
      } else if (m === 'v2') {
        cw = w;
        ch = h * 2;
      } else {
        cw = w * 2;
        ch = h * 2;
      }
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('Canvas not supported in this browser.');
        return;
      }
      if (format === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cw, ch);
      }

      // Draw one copy of the image, optionally flipped on each axis, at (ox, oy).
      const drawAt = (ox: number, oy: number, flipX: boolean, flipY: boolean) => {
        ctx.save();
        ctx.translate(ox + (flipX ? w : 0), oy + (flipY ? h : 0));
        ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
        ctx.drawImage(img, 0, 0, w, h);
        ctx.restore();
      };

      if (m === 'h2') {
        drawAt(0, 0, false, false);
        drawAt(w, 0, true, false);
      } else if (m === 'v2') {
        drawAt(0, 0, false, false);
        drawAt(0, h, false, true);
      } else {
        // 4-quadrant kaleidoscope.
        drawAt(0, 0, false, false); // top-left
        drawAt(w, 0, true, false); // top-right (mirror X)
        drawAt(0, h, false, true); // bottom-left (mirror Y)
        drawAt(w, h, true, true); // bottom-right (mirror both)
      }

      setOutUrl(canvas.toDataURL(format, format === 'image/jpeg' ? 0.92 : undefined));
      setError(null);
    };
    img.onerror = () => setError('Could not load image.');
    img.src = dataUrl;
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
      setSrc(url);
    };
    reader.onerror = () => setError('Could not read file.');
    reader.readAsDataURL(file);
  }, []);

  useEffect(() => {
    if (src) process(src, mode, fmt);
  }, [src, mode, fmt, process]);

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
          <Field label="Mode">
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="h2">2-up horizontal mirror</SelectItem>
                <SelectItem value="v2">2-up vertical mirror</SelectItem>
                <SelectItem value="kaleido">4-quadrant kaleidoscope</SelectItem>
              </SelectContent>
            </Select>
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
            <img src={outUrl} alt="mirror collage" className="max-h-[460px] rounded border" />
            <a href={outUrl} download={`mirror-collage.${ext}`}>
              <Button size="sm">Download {ext.toUpperCase()}</Button>
            </a>
          </div>
        </Panel>
      )}

      <p className="px-1 text-2xs text-muted-foreground">
        Composites are built on a canvas in your browser — nothing is uploaded.
      </p>
    </div>
  );
}
