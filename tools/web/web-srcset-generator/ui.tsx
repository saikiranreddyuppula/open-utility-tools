'use client';

import { useMemo, useState } from 'react';
import {
  Panel,
  PanelHeader,
  OptionsBar,
  Field,
  StatBar,
} from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Descriptor = 'w' | 'x';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseWidths(raw: string): number[] {
  return raw
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => Number(t))
    .filter((n) => Number.isFinite(n) && n > 0)
    .map((n) => Math.round(n));
}

function applyPattern(pattern: string, token: string, width: number): string {
  if (pattern.includes(token)) {
    return pattern.split(token).join(String(width));
  }
  // No token: insert width before the extension.
  const dot = pattern.lastIndexOf('.');
  if (dot > 0) {
    return `${pattern.slice(0, dot)}-${width}${pattern.slice(dot)}`;
  }
  return `${pattern}-${width}`;
}

type Result =
  | { ok: true; markup: string; srcset: string; n: number }
  | { ok: false; error: string };

export default function SrcsetGeneratorTool() {
  const [pattern, setPattern] = useState('img-{w}.jpg');
  const [token, setToken] = useState('{w}');
  const [widthsRaw, setWidthsRaw] = useState('320, 640, 960, 1280, 1920');
  const [sizes, setSizes] = useState('(max-width: 600px) 100vw, 50vw');
  const [alt, setAlt] = useState('Descriptive alt text');
  const [descriptor, setDescriptor] = useState<Descriptor>('w');
  const [usePicture, setUsePicture] = useState(false);
  const [webp, setWebp] = useState(true);
  const [avif, setAvif] = useState(false);
  const [lazy, setLazy] = useState(true);

  const result = useMemo<Result>(() => {
    const tk = token.trim() || '{w}';
    if (!pattern.trim()) return { ok: false, error: 'Enter a base image filename pattern.' };
    const widths = parseWidths(widthsRaw);
    if (widths.length === 0) {
      return { ok: false, error: 'Enter at least one positive width (px).' };
    }
    if (widths.length > 30) {
      return { ok: false, error: 'Keep the width list to 30 entries or fewer.' };
    }
    const sorted = [...widths].sort((a, b) => a - b);

    const srcsetParts = sorted.map((w, i) => {
      const url = applyPattern(pattern, tk, w);
      if (descriptor === 'x') {
        return `${escapeHtml(url)} ${i + 1}x`;
      }
      return `${escapeHtml(url)} ${w}w`;
    });
    const srcset = srcsetParts.join(', ');

    const largest = sorted[sorted.length - 1] ?? sorted[0] ?? 0;
    const fallbackSrc = escapeHtml(applyPattern(pattern, tk, largest));
    const escapedAlt = escapeHtml(alt);
    const escapedSizes = escapeHtml(sizes.trim());

    const imgAttrs: string[] = [`src="${fallbackSrc}"`, `srcset="${srcset}"`];
    if (descriptor === 'w' && escapedSizes) imgAttrs.push(`sizes="${escapedSizes}"`);
    imgAttrs.push(`alt="${escapedAlt}"`);
    if (lazy) {
      imgAttrs.push('loading="lazy"');
      imgAttrs.push('decoding="async"');
    }

    if (!usePicture) {
      const markup = `<img\n  ${imgAttrs.join('\n  ')}\n>`;
      return { ok: true, markup, srcset, n: sorted.length };
    }

    // <picture> with format sources.
    const sources: string[] = [];
    const buildSourceSrcset = (ext: string): string =>
      sorted
        .map((w, i) => {
          const url = applyPattern(pattern, tk, w).replace(/\.[^./]+$/, `.${ext}`);
          return descriptor === 'x'
            ? `${escapeHtml(url)} ${i + 1}x`
            : `${escapeHtml(url)} ${w}w`;
        })
        .join(', ');

    const sizesAttr = descriptor === 'w' && escapedSizes ? `\n    sizes="${escapedSizes}"` : '';
    if (avif) {
      sources.push(
        `  <source\n    type="image/avif"\n    srcset="${buildSourceSrcset('avif')}"${sizesAttr}\n  >`,
      );
    }
    if (webp) {
      sources.push(
        `  <source\n    type="image/webp"\n    srcset="${buildSourceSrcset('webp')}"${sizesAttr}\n  >`,
      );
    }
    const imgTag = `  <img\n    ${imgAttrs.join('\n    ')}\n  >`;
    const markup = `<picture>\n${[...sources, imgTag].join('\n')}\n</picture>`;
    return { ok: true, markup, srcset, n: sorted.length };
  }, [pattern, token, widthsRaw, sizes, alt, descriptor, usePicture, webp, avif, lazy]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Filename pattern" className="min-w-[220px] flex-1">
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="font-mono"
            />
          </Field>
          <Field label="Width token" hint="replaced by each width" className="min-w-[120px]">
            <Input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-28 font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <OptionsBar>
          <Field label="Target widths (px)" className="min-w-[240px] flex-1">
            <Input
              value={widthsRaw}
              onChange={(e) => setWidthsRaw(e.target.value)}
              className="font-mono"
            />
          </Field>
          <Field label="Descriptor" className="min-w-[160px]">
            <Tabs value={descriptor} onValueChange={(v) => setDescriptor(v as Descriptor)}>
              <TabsList>
                <TabsTrigger value="w">width (w)</TabsTrigger>
                <TabsTrigger value="x">density (x)</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <OptionsBar>
          <Field label="sizes attribute" className="min-w-[260px] flex-1">
            <Input
              value={sizes}
              onChange={(e) => setSizes(e.target.value)}
              className="font-mono"
              disabled={descriptor === 'x'}
            />
          </Field>
          <Field label="alt text" className="min-w-[200px] flex-1">
            <Input value={alt} onChange={(e) => setAlt(e.target.value)} />
          </Field>
          <Field label="loading=lazy">
            <Switch checked={lazy} onCheckedChange={setLazy} />
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <OptionsBar>
          <Field label="<picture> element">
            <Switch checked={usePicture} onCheckedChange={setUsePicture} />
          </Field>
          <Field label="WebP source">
            <Switch checked={webp} onCheckedChange={setWebp} disabled={!usePicture} />
          </Field>
          <Field label="AVIF source">
            <Switch checked={avif} onCheckedChange={setAvif} disabled={!usePicture} />
          </Field>
        </OptionsBar>
      </Panel>

      {result.ok ? (
        <Panel>
          <PanelHeader title="Markup">
            <CopyButton value={() => result.markup} />
          </PanelHeader>
          <pre className="max-h-[360px] overflow-auto p-3 font-mono text-xs leading-relaxed">
            {result.markup}
          </pre>
          <StatBar items={[`${result.n} sources`, `${descriptor} descriptor`]} />
        </Panel>
      ) : (
        <ErrorBanner error={result.error} />
      )}
    </div>
  );
}
