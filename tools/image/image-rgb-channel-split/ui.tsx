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

type DisplayMode = 'grayscale' | 'isolated';
type Channel = 'red' | 'green' | 'blue' | 'alpha';

interface ChannelOut {
  channel: Channel;
  label: string;
  url: string;
}

const CHANNELS: { key: Channel; label: string }[] = [
  { key: 'red', label: 'Red' },
  { key: 'green', label: 'Green' },
  { key: 'blue', label: 'Blue' },
  { key: 'alpha', label: 'Alpha mask' },
];

export default function ImageRgbChannelSplitTool() {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<DisplayMode>('grayscale');
  const [outputs, setOutputs] = useState<ChannelOut[]>([]);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  const imgDataRef = useRef<ImageData | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const buildChannel = useCallback(
    (data: ImageData, channel: Channel, m: DisplayMode): string | null => {
      const { width, height } = data;
      const src8 = data.data;
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      const ctx = c.getContext('2d');
      if (!ctx) return null;
      const out = ctx.createImageData(width, height);
      const dst = out.data;
      const offset = channel === 'red' ? 0 : channel === 'green' ? 1 : channel === 'blue' ? 2 : 3;
      for (let i = 0; i < src8.length; i += 4) {
        const val = src8[i + offset] ?? 0;
        if (channel === 'alpha') {
          // alpha shown as grayscale mask, fully opaque
          dst[i] = val;
          dst[i + 1] = val;
          dst[i + 2] = val;
          dst[i + 3] = 255;
        } else if (m === 'grayscale') {
          dst[i] = val;
          dst[i + 1] = val;
          dst[i + 2] = val;
          dst[i + 3] = src8[i + 3] ?? 255;
        } else {
          // isolated: keep only this channel's value in its slot
          dst[i] = channel === 'red' ? val : 0;
          dst[i + 1] = channel === 'green' ? val : 0;
          dst[i + 2] = channel === 'blue' ? val : 0;
          dst[i + 3] = src8[i + 3] ?? 255;
        }
      }
      ctx.putImageData(out, 0, 0);
      return c.toDataURL('image/png');
    },
    []
  );

  const rebuild = useCallback(
    (m: DisplayMode) => {
      const data = imgDataRef.current;
      if (!data) return;
      const next: ChannelOut[] = [];
      for (const ch of CHANNELS) {
        const url = buildChannel(data, ch.key, m);
        if (url) next.push({ channel: ch.key, label: ch.label, url });
      }
      setOutputs(next);
    },
    [buildChannel]
  );

  useEffect(() => {
    if (src) rebuild(mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, src]);

  const onFile = useCallback((file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : null;
      if (!url) {
        setError('Could not read file.');
        return;
      }
      const img = new globalThis.Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (w * h > 16_000_000) {
          setError('Image is too large to split (over 16 megapixels).');
          return;
        }
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        if (!ctx) {
          setError('Canvas not supported.');
          return;
        }
        ctx.drawImage(img, 0, 0);
        imgDataRef.current = ctx.getImageData(0, 0, w, h);
        setDims({ w, h });
        setSrc(url);
      };
      img.onerror = () => setError('Could not load image.');
      img.src = url;
    };
    reader.onerror = () => setError('Could not read file.');
    reader.readAsDataURL(file);
  }, []);

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
          <Field label="RGB display mode" hint="Alpha is always a grayscale mask">
            <Select value={mode} onValueChange={(v) => setMode(v as DisplayMode)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grayscale">Grayscale intensity</SelectItem>
                <SelectItem value="isolated">Isolated color</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {!src && (
        <p className="px-1 text-xs text-muted-foreground">
          Upload an image to split it into red, green, blue, and alpha channels. Useful for
          compositing and debugging transparency. Processed locally in your browser.
        </p>
      )}

      {src && outputs.length > 0 && (
        <Panel>
          <PanelHeader title="Channels" />
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
            {outputs.map((o) => (
              <div key={o.channel} className="flex flex-col items-center gap-2 rounded-md border bg-muted/20 p-3">
                <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {o.label}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={o.url}
                  alt={`${o.label} channel`}
                  className="max-h-[240px] max-w-full rounded border bg-[repeating-conic-gradient(#e5e5e5_0_25%,#fff_0_50%)] bg-[length:16px_16px]"
                />
                <a href={o.url} download={`channel-${o.channel}.png`}>
                  <Button size="sm" variant="outline">
                    Download PNG
                  </Button>
                </a>
              </div>
            ))}
          </div>
          {dims && (
            <div className="border-t bg-muted/30 px-3 py-2 font-mono text-2xs text-muted-foreground">
              source {dims.w}×{dims.h}px · {outputs.length} channels
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
