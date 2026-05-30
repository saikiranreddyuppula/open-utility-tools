'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

interface IconDef {
  size: number;
  name: string;
  label: string;
}

const ICONS: IconDef[] = [
  { size: 16, name: 'favicon-16x16.png', label: 'favicon 16' },
  { size: 32, name: 'favicon-32x32.png', label: 'favicon 32' },
  { size: 48, name: 'favicon-48x48.png', label: 'favicon 48' },
  { size: 180, name: 'apple-touch-icon.png', label: 'apple-touch 180' },
  { size: 192, name: 'android-chrome-192x192.png', label: 'android 192' },
  { size: 512, name: 'android-chrome-512x512.png', label: 'android 512' },
];

interface Generated {
  def: IconDef;
  url: string;
}

const HTML_TAGS = `<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />`;

const MANIFEST = `{
  "icons": [
    { "src": "/android-chrome-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/android-chrome-512x512.png", "sizes": "512x512", "type": "image/png" }
  ]
}`;

export default function FaviconGeneratorTool() {
  const [src, setSrc] = useState<string | null>(null);
  const [icons, setIcons] = useState<Generated[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fill, setFill] = useState(true);
  const [bg, setBg] = useState('#ffffff');
  const fileRef = useRef<HTMLInputElement>(null);

  const generate = useCallback(
    (dataUrl: string, useFill: boolean, bgColor: string) => {
      const img = new globalThis.Image();
      img.onload = () => {
        const out: Generated[] = [];
        for (const def of ICONS) {
          const canvas = document.createElement('canvas');
          canvas.width = def.size;
          canvas.height = def.size;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            setError('Canvas not supported in this browser.');
            return;
          }
          if (useFill) {
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, def.size, def.size);
          }
          // contain: scale to fit while preserving aspect ratio, centered
          const iw = img.naturalWidth || 1;
          const ih = img.naturalHeight || 1;
          const scale = Math.min(def.size / iw, def.size / ih);
          const dw = Math.max(1, Math.round(iw * scale));
          const dh = Math.max(1, Math.round(ih * scale));
          const dx = Math.round((def.size - dw) / 2);
          const dy = Math.round((def.size - dh) / 2);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, dx, dy, dw, dh);
          out.push({ def, url: canvas.toDataURL('image/png') });
        }
        setIcons(out);
        setError(null);
      };
      img.onerror = () => setError('Could not load image.');
      img.src = dataUrl;
    },
    []
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
        generate(url, fill, bg);
      };
      reader.onerror = () => setError('Could not read file.');
      reader.readAsDataURL(file);
    },
    [generate, fill, bg]
  );

  // Re-generate when options change and a source exists.
  useEffect(() => {
    if (src) generate(src, fill, bg);
  }, [src, fill, bg, generate]);

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
          <Field label="Fill background">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={fill} onCheckedChange={setFill} />
              <Label className="text-xs text-muted-foreground">for non-square / transparent</Label>
            </div>
          </Field>
          {fill && (
            <Field label="Background">
              <Input
                type="color"
                value={bg}
                onChange={(e) => setBg(e.target.value)}
                className="h-8 w-14 p-1"
              />
            </Field>
          )}
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {icons.length > 0 && (
        <>
          <Panel>
            <PanelHeader title="Generated PNGs" />
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
              {icons.map((g) => (
                <div
                  key={g.def.name}
                  className="flex flex-col items-center gap-2 rounded-md border bg-muted/30 p-3"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.url}
                    alt={g.def.label}
                    className="rounded border bg-[length:16px_16px] [image-rendering:pixelated]"
                    style={{
                      width: Math.min(96, g.def.size),
                      height: Math.min(96, g.def.size),
                    }}
                  />
                  <span className="font-mono text-2xs text-muted-foreground">
                    {g.def.size}×{g.def.size}
                  </span>
                  <a href={g.url} download={g.def.name} className="w-full">
                    <Button size="sm" variant="outline" className="w-full">
                      PNG
                    </Button>
                  </a>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="HTML &lt;head&gt; tags">
              <CopyButton value={HTML_TAGS} />
            </PanelHeader>
            <pre className="overflow-auto p-3 font-mono text-xs leading-relaxed">{HTML_TAGS}</pre>
          </Panel>

          <Panel>
            <PanelHeader title="site.webmanifest icons">
              <CopyButton value={MANIFEST} />
            </PanelHeader>
            <pre className="overflow-auto p-3 font-mono text-xs leading-relaxed">{MANIFEST}</pre>
          </Panel>
        </>
      )}

      <p className="px-1 text-2xs text-muted-foreground">
        PNG output only (no .ico packing). Everything runs locally in your browser — nothing is
        uploaded.
      </p>
    </div>
  );
}
