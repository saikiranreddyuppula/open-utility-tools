'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ErrorBanner } from '@/components/tools/error-banner';

type Format = 'png' | 'jpeg';
type ScaleMode = '1' | '2' | '3' | 'custom';

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <rect width="120" height="120" rx="16" fill="#3b82f6"/>
  <circle cx="60" cy="60" r="34" fill="#fff"/>
  <path d="M48 60 l9 9 16 -20" stroke="#3b82f6" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/** Read intrinsic size from width/height attrs or fall back to viewBox. */
function svgSize(markup: string): { w: number; h: number } {
  const widthM = markup.match(/\bwidth\s*=\s*["']?\s*([\d.]+)/i);
  const heightM = markup.match(/\bheight\s*=\s*["']?\s*([\d.]+)/i);
  const w = widthM?.[1] ? Number(widthM[1]) : NaN;
  const h = heightM?.[1] ? Number(heightM[1]) : NaN;
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
    return { w, h };
  }
  const vb = markup.match(/viewBox\s*=\s*["']\s*[\d.+-]+\s+[\d.+-]+\s+([\d.]+)\s+([\d.]+)/i);
  const vw = vb?.[1] ? Number(vb[1]) : NaN;
  const vh = vb?.[2] ? Number(vb[2]) : NaN;
  if (Number.isFinite(vw) && Number.isFinite(vh) && vw > 0 && vh > 0) {
    return { w: vw, h: vh };
  }
  return { w: 512, h: 512 };
}

export default function SvgToPngTool() {
  const [svg, setSvg] = useState(SAMPLE_SVG);
  const [format, setFormat] = useState<Format>('png');
  const [scaleMode, setScaleMode] = useState<ScaleMode>('2');
  const [customW, setCustomW] = useState('512');
  const [quality, setQuality] = useState('92');
  const [bg, setBg] = useState('#ffffff');
  const [transparent, setTransparent] = useState(true);
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [outDims, setOutDims] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const render = useCallback(() => {
    setError(null);
    const markup = svg.trim();
    if (!markup) {
      setError('Paste or upload some SVG markup first.');
      return;
    }
    if (!/<svg[\s>]/i.test(markup)) {
      setError('Input does not look like an <svg> element.');
      return;
    }
    const { w, h } = svgSize(markup);
    let outW: number;
    let outH: number;
    if (scaleMode === 'custom') {
      const cw = Number(customW);
      if (!Number.isFinite(cw) || cw <= 0) {
        setError('Enter a valid custom width in pixels.');
        return;
      }
      outW = Math.round(cw);
      outH = Math.round((cw / w) * h);
    } else {
      const factor = Number(scaleMode);
      outW = Math.round(w * factor);
      outH = Math.round(h * factor);
    }
    outW = Math.max(1, Math.min(8000, outW));
    outH = Math.max(1, Math.min(8000, outH));

    const encoded = encodeURIComponent(markup)
      .replace(/'/g, '%27')
      .replace(/"/g, '%22');
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encoded}`;

    const img = new globalThis.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('Canvas not supported.');
        return;
      }
      const opaque = format === 'jpeg' || !transparent;
      if (opaque) {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, outW, outH);
      }
      ctx.drawImage(img, 0, 0, outW, outH);
      const q = Math.min(1, Math.max(0, (Number(quality) || 92) / 100));
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setError('Could not encode image. Check for external references in the SVG.');
            return;
          }
          setOutUrl(URL.createObjectURL(blob));
          setOutDims({ w: outW, h: outH });
        },
        format === 'png' ? 'image/png' : 'image/jpeg',
        format === 'jpeg' ? q : undefined
      );
    };
    img.onerror = () =>
      setError('Could not render the SVG. It may reference external resources, which are blocked.');
    img.src = dataUrl;
  }, [svg, format, scaleMode, customW, quality, bg, transparent]);

  const onFile = useCallback((file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : null;
      if (!text) {
        setError('Could not read file.');
        return;
      }
      setSvg(text);
    };
    reader.onerror = () => setError('Could not read file.');
    reader.readAsText(file);
  }, []);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="size-3.5" /> Upload .svg
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".svg,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
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
          <Field label="Scale">
            <Select value={scaleMode} onValueChange={(v) => setScaleMode(v as ScaleMode)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1× (native)</SelectItem>
                <SelectItem value="2">2×</SelectItem>
                <SelectItem value="3">3×</SelectItem>
                <SelectItem value="custom">Custom width</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {scaleMode === 'custom' && (
            <Field label="Width (px)">
              <Input
                value={customW}
                onChange={(e) => setCustomW(e.target.value)}
                inputMode="numeric"
                className="w-24"
              />
            </Field>
          )}
          {format === 'jpeg' && (
            <Field label="Quality">
              <Input
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                inputMode="numeric"
                className="w-20"
              />
            </Field>
          )}
          <Field label="Background">
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={bg}
                disabled={format === 'png' && transparent}
                onChange={(e) => setBg(e.target.value)}
                className="h-8 w-12 p-1"
              />
              {format === 'png' && (
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={transparent}
                    onChange={(e) => setTransparent(e.target.checked)}
                  />
                  Transparent
                </label>
              )}
            </div>
          </Field>
          <Button size="sm" onClick={render}>
            Rasterize
          </Button>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="SVG markup" />
        <Textarea
          value={svg}
          onChange={(e) => setSvg(e.target.value)}
          spellCheck={false}
          className="min-h-[160px] rounded-none border-0 font-mono text-xs"
        />
      </Panel>

      <ErrorBanner error={error} />

      {outUrl && outDims && (
        <Panel>
          <PanelHeader title={`Result — ${outDims.w}×${outDims.h}`} />
          <div className="flex flex-col items-center gap-3 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={outUrl}
              alt="rasterized svg"
              className="max-h-[420px] rounded border bg-[repeating-conic-gradient(#0001_0_25%,transparent_0_50%)] bg-[length:16px_16px]"
            />
            <a href={outUrl} download={`image.${format === 'png' ? 'png' : 'jpg'}`}>
              <Button size="sm">Download {format.toUpperCase()}</Button>
            </a>
          </div>
        </Panel>
      )}
    </div>
  );
}
