'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ErrorBanner } from '@/components/tools/error-banner';

type Preset = '1:1' | '3:2' | '4:3' | '16:9' | '9:16' | 'custom';
type Anchor = 'center' | 'top' | 'bottom' | 'left' | 'right';
type OutFormat = 'image/png' | 'image/jpeg';

const PRESET_RATIOS: Record<Exclude<Preset, 'custom'>, [number, number]> = {
  '1:1': [1, 1],
  '3:2': [3, 2],
  '4:3': [4, 3],
  '16:9': [16, 9],
  '9:16': [9, 16],
};

export default function CropAspectTool() {
  const [src, setSrc] = useState<string | null>(null);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [outDim, setOutDim] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<Preset>('1:1');
  const [customW, setCustomW] = useState('4');
  const [customH, setCustomH] = useState('5');
  const [anchor, setAnchor] = useState<Anchor>('center');
  const [format, setFormat] = useState<OutFormat>('image/png');
  const fileRef = useRef<HTMLInputElement>(null);
  const lastOut = useRef<string | null>(null);

  const process = useCallback(
    (
      dataUrl: string,
      p: Preset,
      cw: string,
      ch: string,
      a: Anchor,
      fmt: OutFormat
    ) => {
      setError(null);
      let ratioW: number;
      let ratioH: number;
      if (p === 'custom') {
        ratioW = Number(cw);
        ratioH = Number(ch);
        if (!Number.isFinite(ratioW) || !Number.isFinite(ratioH) || ratioW <= 0 || ratioH <= 0) {
          setError('Enter a valid custom ratio (e.g. 4 : 5).');
          return;
        }
      } else {
        const pair = PRESET_RATIOS[p];
        ratioW = pair[0];
        ratioH = pair[1];
      }

      const img = new globalThis.Image();
      img.onload = () => {
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        const target = ratioW / ratioH;
        const source = iw / ih;
        let sw: number;
        let sh: number;
        if (source > target) {
          // source is wider: limit by height
          sh = ih;
          sw = Math.round(ih * target);
        } else {
          sw = iw;
          sh = Math.round(iw / target);
        }
        sw = Math.max(1, Math.min(iw, sw));
        sh = Math.max(1, Math.min(ih, sh));

        let sx: number;
        let sy: number;
        switch (a) {
          case 'top':
            sx = Math.round((iw - sw) / 2);
            sy = 0;
            break;
          case 'bottom':
            sx = Math.round((iw - sw) / 2);
            sy = ih - sh;
            break;
          case 'left':
            sx = 0;
            sy = Math.round((ih - sh) / 2);
            break;
          case 'right':
            sx = iw - sw;
            sy = Math.round((ih - sh) / 2);
            break;
          case 'center':
            sx = Math.round((iw - sw) / 2);
            sy = Math.round((ih - sh) / 2);
            break;
          default:
            sx = Math.round((iw - sw) / 2);
            sy = Math.round((ih - sh) / 2);
            break;
        }

        const canvas = document.createElement('canvas');
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setError('Canvas not supported.');
          return;
        }
        if (fmt === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, sw, sh);
        }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              setError('Could not encode image.');
              return;
            }
            if (lastOut.current) URL.revokeObjectURL(lastOut.current);
            const url = URL.createObjectURL(blob);
            lastOut.current = url;
            setOutUrl(url);
            setOutDim({ w: sw, h: sh });
          },
          fmt,
          fmt === 'image/jpeg' ? 0.92 : undefined
        );
      };
      img.onerror = () => setError('Could not load image.');
      img.src = dataUrl;
    },
    []
  );

  const onFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const url = typeof reader.result === 'string' ? reader.result : null;
        if (!url) {
          setError('Could not read file.');
          return;
        }
        setSrc(url);
        process(url, preset, customW, customH, anchor, format);
      };
      reader.onerror = () => setError('Could not read file.');
      reader.readAsDataURL(file);
    },
    [process, preset, customW, customH, anchor, format]
  );

  const ext = format === 'image/jpeg' ? 'jpg' : 'png';

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
          <Field label="Aspect ratio">
            <Select
              value={preset}
              onValueChange={(v) => {
                const p = v as Preset;
                setPreset(p);
                if (src) process(src, p, customW, customH, anchor, format);
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1:1">1 : 1 (square)</SelectItem>
                <SelectItem value="3:2">3 : 2</SelectItem>
                <SelectItem value="4:3">4 : 3</SelectItem>
                <SelectItem value="16:9">16 : 9</SelectItem>
                <SelectItem value="9:16">9 : 16</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {preset === 'custom' && (
            <>
              <Field label="Ratio W">
                <Input
                  type="number"
                  value={customW}
                  onChange={(e) => {
                    setCustomW(e.target.value);
                    if (src) process(src, preset, e.target.value, customH, anchor, format);
                  }}
                  className="w-20 font-mono"
                  inputMode="decimal"
                />
              </Field>
              <Field label="Ratio H">
                <Input
                  type="number"
                  value={customH}
                  onChange={(e) => {
                    setCustomH(e.target.value);
                    if (src) process(src, preset, customW, e.target.value, anchor, format);
                  }}
                  className="w-20 font-mono"
                  inputMode="decimal"
                />
              </Field>
            </>
          )}
          <Field label="Anchor">
            <Select
              value={anchor}
              onValueChange={(v) => {
                const a = v as Anchor;
                setAnchor(a);
                if (src) process(src, preset, customW, customH, a, format);
              }}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="top">Top</SelectItem>
                <SelectItem value="bottom">Bottom</SelectItem>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Format">
            <Select
              value={format}
              onValueChange={(v) => {
                const fmt = v as OutFormat;
                setFormat(fmt);
                if (src) process(src, preset, customW, customH, anchor, fmt);
              }}
            >
              <SelectTrigger className="w-24">
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

      {!outUrl && (
        <p className="px-1 text-xs text-muted-foreground">
          Upload an image to crop it to a fixed aspect ratio. Cropping runs entirely in
          your browser.
        </p>
      )}

      {outUrl && (
        <Panel>
          <PanelHeader title="Result">
            <a href={outUrl} download={`crop.${ext}`}>
              <Button size="sm">Download {ext.toUpperCase()}</Button>
            </a>
          </PanelHeader>
          <div className="flex flex-col items-center gap-3 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={outUrl} alt="cropped result" className="max-h-[460px] rounded border" />
          </div>
          {outDim && <StatBar items={[`Output ${outDim.w} × ${outDim.h} px`]} />}
        </Panel>
      )}
    </div>
  );
}
