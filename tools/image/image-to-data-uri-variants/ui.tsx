'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, StatBar } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

interface Loaded {
  dataUri: string;
  mime: string;
  base64Len: number;
  originalBytes: number;
  fileName: string;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ImageToDataUriVariantsTool() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : null;
      if (!url || !url.startsWith('data:')) {
        setError('Could not read file as a data URI.');
        return;
      }
      const comma = url.indexOf(',');
      const header = comma >= 0 ? url.slice(5, comma) : '';
      const mime = header.split(';')[0] || file.type || 'application/octet-stream';
      setLoaded({
        dataUri: url,
        mime,
        base64Len: url.length,
        originalBytes: file.size,
        fileName: file.name,
      });
    };
    reader.onerror = () => setError('Could not read file.');
    reader.readAsDataURL(file);
  }, []);

  const isSvg = loaded?.mime === 'image/svg+xml';

  const snippets = useMemo(() => {
    if (!loaded) return [] as { label: string; code: string }[];
    const uri = loaded.dataUri;
    const list: { label: string; code: string }[] = [
      { label: 'Raw data URI', code: uri },
      { label: 'CSS background-image', code: `background-image: url("${uri}");` },
      { label: 'HTML <img>', code: `<img src="${uri}" alt="" />` },
      { label: 'Markdown', code: `![](${uri})` },
      {
        label: 'JSX / CSS-in-JS',
        code: `<div style={{ backgroundImage: \`url(\${"${uri}"})\` }} />`,
      },
    ];
    if (isSvg) {
      // URL-encoded SVG-safe variant (smaller and avoids base64 for inline SVG).
      const comma = uri.indexOf(',');
      const payload = comma >= 0 ? uri.slice(comma + 1) : '';
      let decoded = '';
      try {
        decoded = atob(payload);
      } catch {
        decoded = '';
      }
      if (decoded) {
        const encoded = encodeURIComponent(decoded)
          .replace(/'/g, '%27')
          .replace(/"/g, '%22');
        const svgUri = `data:image/svg+xml,${encoded}`;
        list.push({
          label: 'URL-encoded SVG (CSS)',
          code: `background-image: url("${svgUri}");`,
        });
      }
    }
    return list;
  }, [loaded, isSvg]);

  const overhead = loaded
    ? ((loaded.base64Len / Math.max(1, loaded.originalBytes) - 1) * 100).toFixed(1)
    : '0';

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
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {!loaded && (
        <p className="px-1 text-xs text-muted-foreground">
          Upload an image to embed it as a base64 data URI with copy-ready CSS, HTML, Markdown, and
          JSX snippets. All processing happens locally in your browser.
        </p>
      )}

      {loaded && (
        <>
          <Panel>
            <PanelHeader title="Preview" />
            <div className="flex flex-col items-center gap-2 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={loaded.dataUri}
                alt={loaded.fileName}
                className="max-h-[260px] rounded border bg-[repeating-conic-gradient(#0001_0_25%,transparent_0_50%)] bg-[length:16px_16px]"
              />
            </div>
            <StatBar
              items={[
                `Type: ${loaded.mime}`,
                `Original: ${fmtBytes(loaded.originalBytes)}`,
                `Encoded: ${fmtBytes(loaded.base64Len)}`,
                `Overhead: +${overhead}%`,
              ]}
            />
          </Panel>

          {snippets.map((s) => (
            <Panel key={s.label}>
              <PanelHeader title={s.label}>
                <CopyButton value={() => s.code} />
              </PanelHeader>
              <pre className="max-h-40 overflow-auto break-all whitespace-pre-wrap p-3 font-mono text-xs">
                {s.code}
              </pre>
            </Panel>
          ))}
        </>
      )}
    </div>
  );
}
