'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Descriptor = 'w' | 'x';

interface Breakpoint {
  id: number;
  maxWidth: string; // px; empty = default fallback size
  size: string; // e.g. 100vw, 50vw, 400px
}

let bpId = 0;
const newBp = (maxWidth: string, size: string): Breakpoint => ({
  id: bpId++,
  maxWidth,
  size,
});

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

function applyToken(pattern: string, token: string, width: number): string {
  if (pattern.includes(token)) return pattern.split(token).join(String(width));
  const dot = pattern.lastIndexOf('.');
  if (dot > 0) return `${pattern.slice(0, dot)}-${width}${pattern.slice(dot)}`;
  return `${pattern}-${width}`;
}

type Result =
  | { ok: true; srcset: string; sizesAttr: string; img: string; n: number }
  | { ok: false; error: string };

export default function SrcsetSizesBuilderTool() {
  const [pattern, setPattern] = useState('/img/hero-{w}.jpg');
  const [token, setToken] = useState('{w}');
  const [widthsRaw, setWidthsRaw] = useState('400, 800, 1200, 1600');
  const [descriptor, setDescriptor] = useState<Descriptor>('w');
  const [lazy, setLazy] = useState(true);
  const [decoding, setDecoding] = useState(true);
  const [alt, setAlt] = useState('Hero image');
  const [breaks, setBreaks] = useState<Breakpoint[]>([
    newBp('600', '100vw'),
    newBp('1200', '50vw'),
    newBp('', '33vw'),
  ]);

  const update = (id: number, patch: Partial<Breakpoint>) =>
    setBreaks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const remove = (id: number) => setBreaks((bs) => bs.filter((b) => b.id !== id));
  const add = () => setBreaks((bs) => [...bs, newBp('', '100vw')]);

  const result = useMemo<Result>(() => {
    const tk = token.trim() || '{w}';
    if (!pattern.trim()) return { ok: false, error: 'Enter a base image path/pattern.' };
    const widths = parseWidths(widthsRaw);
    if (widths.length === 0) {
      return { ok: false, error: 'Enter at least one positive width (px).' };
    }
    if (widths.length > 30) {
      return { ok: false, error: 'Keep the width list to 30 entries or fewer.' };
    }
    const sorted = [...widths].sort((a, b) => a - b);

    const srcset = sorted
      .map((w, i) =>
        descriptor === 'x'
          ? `${escapeHtml(applyToken(pattern, tk, w))} ${i + 1}x`
          : `${escapeHtml(applyToken(pattern, tk, w))} ${w}w`,
      )
      .join(', ');

    // Build sizes string: media-conditioned entries first, then a final default.
    const conditional: string[] = [];
    let fallback = '';
    for (const b of breaks) {
      const sz = b.size.trim();
      if (!sz) continue;
      const mw = b.maxWidth.trim();
      if (mw) {
        const n = Number(mw);
        if (!Number.isFinite(n) || n <= 0) {
          return { ok: false, error: `Breakpoint max-width "${mw}" must be a positive number.` };
        }
        conditional.push(`(max-width: ${Math.round(n)}px) ${sz}`);
      } else {
        fallback = sz; // last default wins
      }
    }
    const allSizes = [...conditional];
    if (fallback) allSizes.push(fallback);
    const sizesValue = allSizes.join(', ');
    const sizesAttr = sizesValue ? `sizes="${escapeHtml(sizesValue)}"` : '';

    const largest = sorted[sorted.length - 1] ?? 0;
    const attrs: string[] = [
      `src="${escapeHtml(applyToken(pattern, tk, largest))}"`,
      `srcset="${srcset}"`,
    ];
    if (descriptor === 'w' && sizesValue) attrs.push(sizesAttr);
    attrs.push(`alt="${escapeHtml(alt)}"`);
    if (lazy) attrs.push('loading="lazy"');
    if (decoding) attrs.push('decoding="async"');

    const img = `<img\n  ${attrs.join('\n  ')}\n>`;
    return { ok: true, srcset, sizesAttr: sizesValue, img, n: sorted.length };
  }, [pattern, token, widthsRaw, descriptor, lazy, decoding, alt, breaks]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Base path / pattern" className="min-w-[240px] flex-1">
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="font-mono"
            />
          </Field>
          <Field label="Width token" className="min-w-[110px]">
            <Input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-24 font-mono"
            />
          </Field>
          <Field label="Descriptor" className="min-w-[160px]">
            <Tabs value={descriptor} onValueChange={(v) => setDescriptor(v as Descriptor)}>
              <TabsList>
                <TabsTrigger value="w">w</TabsTrigger>
                <TabsTrigger value="x">x</TabsTrigger>
              </TabsList>
            </Tabs>
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
          <Field label="alt text" className="min-w-[180px] flex-1">
            <Input value={alt} onChange={(e) => setAlt(e.target.value)} />
          </Field>
          <Field label="loading=lazy">
            <Switch checked={lazy} onCheckedChange={setLazy} />
          </Field>
          <Field label="decoding=async">
            <Switch checked={decoding} onCheckedChange={setDecoding} />
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Breakpoint → size mapping (leave max-width empty for the default)">
          <Button variant="secondary" size="sm" onClick={add}>
            <Plus className="size-3.5" /> Add
          </Button>
        </PanelHeader>
        <div className="divide-y">
          {breaks.map((b) => (
            <div key={b.id} className="flex items-center gap-2 px-3 py-2">
              <span className="text-2xs text-muted-foreground">max-width</span>
              <Input
                value={b.maxWidth}
                onChange={(e) => update(b.id, { maxWidth: e.target.value })}
                placeholder="(default)"
                inputMode="numeric"
                className="w-28 font-mono"
              />
              <span className="text-2xs text-muted-foreground">px →</span>
              <Input
                value={b.size}
                onChange={(e) => update(b.id, { size: e.target.value })}
                placeholder="100vw"
                className="w-40 font-mono"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(b.id)}
                aria-label="Remove"
                className="ml-auto"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          {breaks.length === 0 && (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              No mappings — sizes will be omitted.
            </div>
          )}
        </div>
      </Panel>

      {result.ok ? (
        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Full <img> tag">
              <CopyButton value={() => result.img} />
            </PanelHeader>
            <pre className="max-h-[320px] overflow-auto p-3 font-mono text-xs leading-relaxed">
              {result.img}
            </pre>
            <StatBar items={[`${result.n} candidates`, `${descriptor} descriptor`]} />
          </Panel>
          <Panel>
            <PanelHeader title="srcset attribute value">
              <CopyButton value={() => result.srcset} />
            </PanelHeader>
            <pre className="overflow-auto p-3 font-mono text-xs leading-relaxed">
              {result.srcset}
            </pre>
          </Panel>
          {result.sizesAttr && (
            <Panel>
              <PanelHeader title="sizes attribute value">
                <CopyButton value={() => result.sizesAttr} />
              </PanelHeader>
              <pre className="overflow-auto p-3 font-mono text-xs leading-relaxed">
                {result.sizesAttr}
              </pre>
            </Panel>
          )}
        </div>
      ) : (
        <ErrorBanner error={result.error} />
      )}
    </div>
  );
}
