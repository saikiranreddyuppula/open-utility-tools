'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface RGB {
  r: number;
  g: number;
  b: number;
}

type Layout = 'row' | 'grid';
type LabelFmt = 'hex' | 'rgb';

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseColor(input: string): RGB | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  const hex = s.startsWith('#') ? s.slice(1) : /^[0-9a-f]{3,8}$/.test(s) ? s : '';
  if (hex) {
    if (hex.length === 3 || hex.length === 4) {
      const r = hex[0];
      const g = hex[1];
      const b = hex[2];
      if (r === undefined || g === undefined || b === undefined) return null;
      return { r: parseInt(r + r, 16), g: parseInt(g + g, 16), b: parseInt(b + b, 16) };
    }
    if (hex.length === 6 || hex.length === 8) {
      return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
    }
    return null;
  }
  const rgbM = s.match(/rgba?\(([^)]+)\)/);
  if (rgbM && rgbM[1] !== undefined) {
    const parts = rgbM[1].split(/[,\s/]+/).filter(Boolean);
    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null;
    return { r: clamp255(r), g: clamp255(g), b: clamp255(b) };
  }
  const hslM = s.match(/hsla?\(([^)]+)\)/);
  if (hslM && hslM[1] !== undefined) {
    const parts = hslM[1].split(/[,\s/]+/).filter(Boolean);
    const h = Number((parts[0] ?? '').replace('deg', ''));
    const sPct = Number((parts[1] ?? '').replace('%', ''));
    const lPct = Number((parts[2] ?? '').replace('%', ''));
    if (!Number.isFinite(h) || !Number.isFinite(sPct) || !Number.isFinite(lPct)) return null;
    const sn = Math.max(0, Math.min(100, sPct)) / 100;
    const ln = Math.max(0, Math.min(100, lPct)) / 100;
    const c = (1 - Math.abs(2 * ln - 1)) * sn;
    const hp = (((h % 360) + 360) % 360) / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r1 = 0;
    let g1 = 0;
    let b1 = 0;
    if (hp < 1) {
      r1 = c;
      g1 = x;
    } else if (hp < 2) {
      r1 = x;
      g1 = c;
    } else if (hp < 3) {
      g1 = c;
      b1 = x;
    } else if (hp < 4) {
      g1 = x;
      b1 = c;
    } else if (hp < 5) {
      r1 = x;
      b1 = c;
    } else {
      r1 = c;
      b1 = x;
    }
    const m = ln - c / 2;
    return { r: clamp255((r1 + m) * 255), g: clamp255((g1 + m) * 255), b: clamp255((b1 + m) * 255) };
  }
  return null;
}

function toHex({ r, g, b }: RGB): string {
  const h = (n: number) => clamp255(n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function relLuminance({ r, g, b }: RGB): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const SAMPLE = ['#1e293b', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7'].join('\n');

export default function PaletteToSvg() {
  const [text, setText] = useState(SAMPLE);
  const [layout, setLayout] = useState<Layout>('row');
  const [size, setSize] = useState('120');
  const [showLabels, setShowLabels] = useState(true);
  const [labelFmt, setLabelFmt] = useState<LabelFmt>('hex');

  const colors = useMemo<RGB[]>(() => {
    const out: RGB[] = [];
    for (const line of text.split('\n')) {
      const raw = line.trim();
      if (!raw) continue;
      const rgb = parseColor(raw);
      if (rgb) out.push(rgb);
      if (out.length >= 64) break;
    }
    return out;
  }, [text]);

  const svg = useMemo(() => {
    if (colors.length === 0) return '';
    const sw = Math.max(40, Math.min(400, Number(size) || 120));
    const labelH = showLabels ? Math.max(16, Math.round(sw * 0.18)) : 0;
    const cellH = sw + labelH;
    const fontSize = Math.max(8, Math.round(sw * 0.11));
    const pad = 8;

    const cols = layout === 'row' ? colors.length : Math.ceil(Math.sqrt(colors.length));
    const rows = Math.ceil(colors.length / cols);
    const width = pad * 2 + cols * sw;
    const height = pad * 2 + rows * cellH;

    const fmt = (rgb: RGB) =>
      labelFmt === 'hex' ? toHex(rgb) : `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

    const parts: string[] = [];
    parts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="ui-sans-serif, system-ui, sans-serif">`
    );
    colors.forEach((rgb, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = pad + col * sw;
      const y = pad + row * cellH;
      const hex = toHex(rgb);
      parts.push(`<rect x="${x}" y="${y}" width="${sw}" height="${sw}" fill="${hex}"/>`);
      if (showLabels) {
        const textColor = relLuminance(rgb) > 0.45 ? '#000000' : '#ffffff';
        const ty = y + sw - fontSize * 0.6;
        parts.push(
          `<text x="${x + sw / 2}" y="${ty}" fill="${textColor}" font-size="${fontSize}" font-family="ui-monospace, monospace" text-anchor="middle">${escapeXml(fmt(rgb))}</text>`
        );
      }
    });
    parts.push('</svg>');
    return parts.join('\n');
  }, [colors, layout, size, showLabels, labelFmt]);

  const dataUri = useMemo(() => {
    if (!svg) return '';
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }, [svg]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Layout">
            <Tabs value={layout} onValueChange={(v) => setLayout(v as Layout)}>
              <TabsList>
                <TabsTrigger value="row">Row</TabsTrigger>
                <TabsTrigger value="grid">Grid</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Swatch size (px)">
            <Input
              value={size}
              onChange={(e) => setSize(e.target.value)}
              inputMode="numeric"
              className="w-24 font-mono"
            />
          </Field>
          <Field label="Labels">
            <Switch checked={showLabels} onCheckedChange={setShowLabels} />
          </Field>
          <Field label="Label format">
            <Select value={labelFmt} onValueChange={(v) => setLabelFmt(v as LabelFmt)}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hex">HEX</SelectItem>
                <SelectItem value="rgb">RGB</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Colors (one per line: hex / rgb() / hsl())" />
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          rows={6}
          className="rounded-none border-0 font-mono text-sm focus-visible:ring-0"
          placeholder="#3b82f6&#10;rgb(16,185,129)&#10;hsl(45, 93%, 47%)"
        />
      </Panel>

      {colors.length === 0 ? (
        <Panel>
          <div className="p-4 text-sm text-muted-foreground">
            Enter at least one valid color to render the SVG swatches.
          </div>
        </Panel>
      ) : (
        <>
          <Panel>
            <PanelHeader title="Preview" />
            <div className="flex justify-center overflow-auto bg-muted/20 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dataUri} alt="palette swatches" className="max-w-full rounded border" />
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="SVG markup">
              <CopyButton value={() => svg} label="Copy SVG" />
              <CopyButton value={() => dataUri} label="Copy data URI" />
              <DownloadButton data={() => svg} filename="palette.svg" mime="image/svg+xml" />
            </PanelHeader>
            <Textarea
              value={svg}
              readOnly
              spellCheck={false}
              rows={8}
              className="rounded-none border-0 font-mono text-xs focus-visible:ring-0"
            />
            <StatBar items={[`${colors.length} swatches`, `${layout} layout`, `${svg.length} bytes`]} />
          </Panel>
        </>
      )}
    </div>
  );
}
