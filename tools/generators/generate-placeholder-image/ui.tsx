'use client';

import { useEffect, useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Format = 'png' | 'jpeg' | 'webp';

const MIME: Record<Format, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

const CHECKER_STYLE: React.CSSProperties = {
  backgroundImage:
    'repeating-conic-gradient(#0000 0% 25%, rgba(128,128,128,0.13) 0% 50%)',
  backgroundSize: '16px 16px',
};

function clampDim(raw: string, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  if (i < 1) return 1;
  if (i > 4000) return 4000;
  return i;
}

export default function PlaceholderImageGenerator() {
  const [widthRaw, setWidthRaw] = useState('600');
  const [heightRaw, setHeightRaw] = useState('400');
  const [bg, setBg] = useState('#cccccc');
  const [fg, setFg] = useState('#333333');
  const [label, setLabel] = useState('');
  const [format, setFormat] = useState<Format>('png');
  const [dataUrl, setDataUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const width = useMemo(() => clampDim(widthRaw, 600), [widthRaw]);
  const height = useMemo(() => clampDim(heightRaw, 400), [heightRaw]);
  const displayLabel = label.trim() || `${width} × ${height}`;

  useEffect(() => {
    let cancelled = false;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('Canvas is not supported in this browser.');
        setDataUrl('');
        return;
      }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = fg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const fontSize = Math.max(10, Math.floor(Math.min(width, height) / 8));
      ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
      ctx.fillText(displayLabel, width / 2, height / 2);

      const url = canvas.toDataURL(MIME[format]);
      if (!cancelled) {
        setDataUrl(url);
        setError(null);
      }
    } catch (e) {
      if (!cancelled) {
        setError(e instanceof Error ? e.message : 'Failed to render image.');
        setDataUrl('');
      }
    }
    return () => {
      cancelled = true;
    };
  }, [width, height, bg, fg, displayLabel, format]);

  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `placeholder-${width}x${height}.${format}`;
    a.click();
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader title="Options" />
        <OptionsBar>
          <Field label="Width (px)" hint="1-4000">
            <Input
              type="number"
              min={1}
              max={4000}
              value={widthRaw}
              onChange={(e) => setWidthRaw(e.target.value)}
            />
          </Field>
          <Field label="Height (px)" hint="1-4000">
            <Input
              type="number"
              min={1}
              max={4000}
              value={heightRaw}
              onChange={(e) => setHeightRaw(e.target.value)}
            />
          </Field>
          <Field label="Background">
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={bg}
                onChange={(e) => setBg(e.target.value)}
                className="h-9 w-12 p-1"
              />
              <Input value={bg} onChange={(e) => setBg(e.target.value)} className="font-mono" />
            </div>
          </Field>
          <Field label="Text color">
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={fg}
                onChange={(e) => setFg(e.target.value)}
                className="h-9 w-12 p-1"
              />
              <Input value={fg} onChange={(e) => setFg(e.target.value)} className="font-mono" />
            </div>
          </Field>
          <Field label="Label" hint="blank shows dimensions">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={`${width} × ${height}`}
            />
          </Field>
          <Field label="Format">
            <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="png">PNG</SelectItem>
                <SelectItem value="jpeg">JPEG</SelectItem>
                <SelectItem value="webp">WebP</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      <Panel>
        <PanelHeader title="Preview">
          <Button type="button" variant="outline" size="sm" onClick={download} disabled={!dataUrl}>
            Download
          </Button>
          <CopyButton value={() => dataUrl} />
        </PanelHeader>
        <div className="flex justify-center overflow-auto rounded-md p-4" style={CHECKER_STYLE}>
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dataUrl}
              alt={displayLabel}
              className="max-w-full"
              style={{ maxHeight: 360 }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No preview.</p>
          )}
        </div>
        <StatBar
          items={[
            `${width} × ${height} px`,
            `format: ${format}`,
            dataUrl ? `${Math.round(dataUrl.length / 1024)} KB data URL` : false,
          ]}
        />
      </Panel>
    </div>
  );
}
