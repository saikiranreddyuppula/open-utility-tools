'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

interface RGB {
  r: number;
  g: number;
  b: number;
}

// Curated, royalty-free dictionary of well-known fancy color names.
// This is an UNOFFICIAL approximation and is NOT licensed Pantone data.
const DICT: Record<string, string> = {
  Amber: '#ffbf00', Amethyst: '#9966cc', Apricot: '#fbceb1', Aquamarine: '#7fffd4',
  Azure: '#007fff', Beige: '#f5f5dc', Bistre: '#3d2b1f', Bittersweet: '#fe6f5e',
  'Bondi Blue': '#0095b6', Brass: '#b5a642', 'Bright Green': '#66ff00', 'Bright Turquoise': '#08e8de',
  Bronze: '#cd7f32', Buff: '#f0dc82', Burgundy: '#900020', 'Burnt Orange': '#cc5500',
  'Burnt Sienna': '#e97451', 'Cadmium Red': '#e30022', Camel: '#c19a6b', Carmine: '#960018',
  'Carolina Blue': '#99badd', 'Carrot Orange': '#ed9121', Celadon: '#ace1af', Cerise: '#de3163',
  Cerulean: '#007ba7', Champagne: '#f7e7ce', Charcoal: '#36454f', Chartreuse: '#7fff00',
  Cinnamon: '#d2691e', Citrine: '#e4d00a', Cobalt: '#0047ab', 'Coffee': '#6f4e37',
  Copper: '#b87333', Coral: '#ff7f50', Cornflower: '#6495ed', Cream: '#fffdd0',
  Crimson: '#dc143c', Cyan: '#00ffff', 'Dark Slate': '#2f4f4f', Denim: '#1560bd',
  'Dodger Blue': '#1e90ff', Eggplant: '#614051', Emerald: '#50c878', Fern: '#4f7942',
  Flame: '#e25822', 'Forest Green': '#228b22', Fuchsia: '#ff00ff', Gamboge: '#e49b0f',
  Ginger: '#b06500', Gold: '#ffd700', Goldenrod: '#daa520', 'Granny Smith': '#a8e4a0',
  Gunmetal: '#2a3439', 'Hot Pink': '#ff69b4', Indigo: '#4b0082', 'International Orange': '#ff4f00',
  Ivory: '#fffff0', Jade: '#00a86b', Jasmine: '#f8de7e', 'Kelly Green': '#4cbb17',
  Khaki: '#c3b091', Lavender: '#b57edc', Lemon: '#fff700', Lilac: '#c8a2c8',
  Lime: '#bfff00', Linen: '#faf0e6', Magenta: '#ff00ff', Mahogany: '#c04000',
  Maize: '#fbec5d', Malachite: '#0bda51', Maroon: '#800000', Mauve: '#e0b0ff',
  'Midnight Blue': '#191970', Mint: '#3eb489', Mocha: '#967969', Moss: '#8a9a5b',
  Mustard: '#ffdb58', Navy: '#000080', Ochre: '#cc7722', Olive: '#808000',
  'Olive Drab': '#6b8e23', Onyx: '#353839', Orange: '#ff7f00', Orchid: '#da70d6',
  Pansy: '#78184a', Peach: '#ffe5b4', Pear: '#d1e231', Periwinkle: '#ccccff',
  Persimmon: '#ec5800', 'Pine Green': '#01796f', Pink: '#ffc0cb', Pistachio: '#93c572',
  Plum: '#8e4585', 'Powder Blue': '#b0e0e6', 'Prussian Blue': '#003153', Puce: '#cc8899',
  Pumpkin: '#ff7518', Purple: '#800080', 'Raspberry': '#e30b5d', 'Razzmatazz': '#e3256b',
  'Robin Egg': '#00cccc', Rose: '#ff007f', 'Royal Blue': '#4169e1', 'Royal Purple': '#7851a9',
  Ruby: '#e0115f', Russet: '#80461b', Saffron: '#f4c430', Salmon: '#fa8072',
  Sand: '#c2b280', Sangria: '#92000a', Sapphire: '#0f52ba', Scarlet: '#ff2400',
  'Sea Green': '#2e8b57', 'Seafoam': '#93e9be', Sepia: '#704214', Sienna: '#882d17',
  Silver: '#c0c0c0', 'Sky Blue': '#87ceeb', 'Slate Blue': '#6a5acd', 'Slate Gray': '#708090',
  Smalt: '#003399', 'Spring Green': '#00ff7f', 'Steel Blue': '#4682b4', 'Tangerine': '#f28500',
  Taupe: '#483c32', Teal: '#008080', 'Terracotta': '#e2725b', Thistle: '#d8bfd8',
  Tomato: '#ff6347', Turquoise: '#40e0d0', Ultramarine: '#3f00ff', Vermilion: '#e34234',
  Violet: '#7f00ff', Viridian: '#40826d', Wheat: '#f5deb3', Wine: '#722f37',
  Wisteria: '#c9a0dc', Yellow: '#ffff00', 'Zinnwaldite': '#ebc2af',
};

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
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
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m && m[1] !== undefined) {
    const parts = m[1].split(/[,\s/]+/).filter(Boolean);
    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null;
    return { r: clamp255(r), g: clamp255(g), b: clamp255(b) };
  }
  return null;
}

interface Lab {
  L: number;
  a: number;
  b: number;
}

function rgbToLab({ r, g, b }: RGB): Lab {
  const srgb = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const rl = srgb[0] ?? 0;
  const gl = srgb[1] ?? 0;
  const bl = srgb[2] ?? 0;
  let x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047;
  let y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
  let z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x);
  y = f(y);
  z = f(z);
  return { L: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
}

const ENTRIES: { name: string; hex: string; lab: Lab }[] = Object.entries(DICT).map(([name, hex]) => ({
  name,
  hex,
  lab: rgbToLab(hexToRgb(hex)),
}));

function deltaLab(a: Lab, b: Lab): number {
  return Math.sqrt((a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
}

function toHex({ r, g, b }: RGB): string {
  const h = (n: number) => clamp255(n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export default function NearestPantoneName() {
  const [color, setColor] = useState('#0f52ba');
  const [q, setQ] = useState('');

  const matches = useMemo(() => {
    const rgb = parseColor(color);
    if (!rgb) return null;
    const lab = rgbToLab(rgb);
    const scored = ENTRIES.map((e) => ({ ...e, dist: deltaLab(lab, e.lab) }));
    scored.sort((p, n) => p.dist - n.dist);
    return { input: rgb, top: scored.slice(0, 5) };
  }, [color]);

  const browse = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return ENTRIES;
    return ENTRIES.filter((e) => `${e.name} ${e.hex}`.toLowerCase().includes(s));
  }, [q]);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-muted-foreground">
        Unofficial approximation from a curated, royalty-free color-name dictionary. NOT licensed
        Pantone data and not color-accurate for print matching.
      </div>

      <Panel>
        <OptionsBar>
          <Field label="Color">
            <Input value={color} onChange={(e) => setColor(e.target.value)} className="w-44 font-mono" />
          </Field>
        </OptionsBar>
      </Panel>

      {!matches ? (
        <ErrorBanner error="Enter a valid color (e.g. #0f52ba or rgb(15,82,186))." />
      ) : (
        <Panel>
          <PanelHeader title="Nearest names">
            <CopyButton
              value={() => matches.top.map((m) => `${m.name} ${m.hex} (ΔE ${m.dist.toFixed(2)})`).join('\n')}
            />
          </PanelHeader>
          <div className="divide-y">
            {matches.top.map((m, i) => (
              <div key={m.name} className="flex items-center gap-3 px-3 py-2">
                <span className="w-5 shrink-0 text-right font-mono text-2xs text-muted-foreground">
                  {i + 1}
                </span>
                <div className="h-8 w-12 shrink-0 rounded border" style={{ backgroundColor: m.hex }} />
                <span className="min-w-0 flex-1 text-sm">{m.name}</span>
                <code className="w-24 shrink-0 font-mono text-xs">{m.hex}</code>
                <span className="w-20 shrink-0 text-right font-mono text-xs text-muted-foreground tabular">
                  ΔE {m.dist.toFixed(2)}
                </span>
                <CopyButton value={m.hex} size="icon-sm" />
              </div>
            ))}
          </div>
          <StatBar items={[`input ${toHex(matches.input)}`, `${ENTRIES.length} entries`]} />
        </Panel>
      )}

      <Panel>
        <PanelHeader title="Browse dictionary">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="h-7 w-48" />
        </PanelHeader>
        <div className="max-h-[360px] divide-y overflow-auto">
          {browse.map((e) => (
            <div key={e.name} className="flex items-center gap-3 px-3 py-1.5">
              <div className="h-6 w-10 shrink-0 rounded border" style={{ backgroundColor: e.hex }} />
              <span className="min-w-0 flex-1 truncate text-sm">{e.name}</span>
              <code className="font-mono text-xs text-muted-foreground">{e.hex}</code>
              <CopyButton value={e.hex} size="icon-sm" />
            </div>
          ))}
        </div>
        <StatBar items={[`${browse.length} of ${ENTRIES.length}`]} />
      </Panel>
    </div>
  );
}
