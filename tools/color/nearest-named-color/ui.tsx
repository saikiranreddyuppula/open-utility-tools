'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface RGB {
  r: number;
  g: number;
  b: number;
}

type Metric = 'lab' | 'rgb';

// The 148 CSS Color Module Level 4 named colors.
const NAMED: Record<string, string> = {
  aliceblue: '#f0f8ff', antiquewhite: '#faebd7', aqua: '#00ffff', aquamarine: '#7fffd4',
  azure: '#f0ffff', beige: '#f5f5dc', bisque: '#ffe4c4', black: '#000000',
  blanchedalmond: '#ffebcd', blue: '#0000ff', blueviolet: '#8a2be2', brown: '#a52a2a',
  burlywood: '#deb887', cadetblue: '#5f9ea0', chartreuse: '#7fff00', chocolate: '#d2691e',
  coral: '#ff7f50', cornflowerblue: '#6495ed', cornsilk: '#fff8dc', crimson: '#dc143c',
  cyan: '#00ffff', darkblue: '#00008b', darkcyan: '#008b8b', darkgoldenrod: '#b8860b',
  darkgray: '#a9a9a9', darkgreen: '#006400', darkgrey: '#a9a9a9', darkkhaki: '#bdb76b',
  darkmagenta: '#8b008b', darkolivegreen: '#556b2f', darkorange: '#ff8c00', darkorchid: '#9932cc',
  darkred: '#8b0000', darksalmon: '#e9967a', darkseagreen: '#8fbc8f', darkslateblue: '#483d8b',
  darkslategray: '#2f4f4f', darkslategrey: '#2f4f4f', darkturquoise: '#00ced1', darkviolet: '#9400d3',
  deeppink: '#ff1493', deepskyblue: '#00bfff', dimgray: '#696969', dimgrey: '#696969',
  dodgerblue: '#1e90ff', firebrick: '#b22222', floralwhite: '#fffaf0', forestgreen: '#228b22',
  fuchsia: '#ff00ff', gainsboro: '#dcdcdc', ghostwhite: '#f8f8ff', gold: '#ffd700',
  goldenrod: '#daa520', gray: '#808080', green: '#008000', greenyellow: '#adff2f',
  grey: '#808080', honeydew: '#f0fff0', hotpink: '#ff69b4', indianred: '#cd5c5c',
  indigo: '#4b0082', ivory: '#fffff0', khaki: '#f0e68c', lavender: '#e6e6fa',
  lavenderblush: '#fff0f5', lawngreen: '#7cfc00', lemonchiffon: '#fffacd', lightblue: '#add8e6',
  lightcoral: '#f08080', lightcyan: '#e0ffff', lightgoldenrodyellow: '#fafad2', lightgray: '#d3d3d3',
  lightgreen: '#90ee90', lightgrey: '#d3d3d3', lightpink: '#ffb6c1', lightsalmon: '#ffa07a',
  lightseagreen: '#20b2aa', lightskyblue: '#87cefa', lightslategray: '#778899', lightslategrey: '#778899',
  lightsteelblue: '#b0c4de', lightyellow: '#ffffe0', lime: '#00ff00', limegreen: '#32cd32',
  linen: '#faf0e6', magenta: '#ff00ff', maroon: '#800000', mediumaquamarine: '#66cdaa',
  mediumblue: '#0000cd', mediumorchid: '#ba55d3', mediumpurple: '#9370db', mediumseagreen: '#3cb371',
  mediumslateblue: '#7b68ee', mediumspringgreen: '#00fa9a', mediumturquoise: '#48d1cc', mediumvioletred: '#c71585',
  midnightblue: '#191970', mintcream: '#f5fffa', mistyrose: '#ffe4e1', moccasin: '#ffe4b5',
  navajowhite: '#ffdead', navy: '#000080', oldlace: '#fdf5e6', olive: '#808000',
  olivedrab: '#6b8e23', orange: '#ffa500', orangered: '#ff4500', orchid: '#da70d6',
  palegoldenrod: '#eee8aa', palegreen: '#98fb98', paleturquoise: '#afeeee', palevioletred: '#db7093',
  papayawhip: '#ffefd5', peachpuff: '#ffdab9', peru: '#cd853f', pink: '#ffc0cb',
  plum: '#dda0dd', powderblue: '#b0e0e6', purple: '#800080', rebeccapurple: '#663399',
  red: '#ff0000', rosybrown: '#bc8f8f', royalblue: '#4169e1', saddlebrown: '#8b4513',
  salmon: '#fa8072', sandybrown: '#f4a460', seagreen: '#2e8b57', seashell: '#fff5ee',
  sienna: '#a0522d', silver: '#c0c0c0', skyblue: '#87ceeb', slateblue: '#6a5acd',
  slategray: '#708090', slategrey: '#708090', snow: '#fffafa', springgreen: '#00ff7f',
  steelblue: '#4682b4', tan: '#d2b48c', teal: '#008080', thistle: '#d8bfd8',
  tomato: '#ff6347', turquoise: '#40e0d0', violet: '#ee82ee', wheat: '#f5deb3',
  white: '#ffffff', whitesmoke: '#f5f5f5', yellow: '#ffff00', yellowgreen: '#9acd32',
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
  const named = NAMED[s];
  if (named !== undefined) return hexToRgb(named);
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

const ENTRIES: { name: string; hex: string; rgb: RGB; lab: Lab }[] = Object.entries(NAMED)
  .map(([name, hex]) => {
    const rgb = hexToRgb(hex);
    return { name, hex, rgb, lab: rgbToLab(rgb) };
  });

function deltaLab(a: Lab, b: Lab): number {
  return Math.sqrt((a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
}

function deltaRgb(a: RGB, b: RGB): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function toHex({ r, g, b }: RGB): string {
  const h = (n: number) => clamp255(n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export default function NearestNamedColor() {
  const [color, setColor] = useState('#4f7ab3');
  const [metric, setMetric] = useState<Metric>('lab');
  const [q, setQ] = useState('');

  const matches = useMemo(() => {
    const rgb = parseColor(color);
    if (!rgb) return null;
    const lab = rgbToLab(rgb);
    const scored = ENTRIES.map((e) => ({
      ...e,
      dist: metric === 'lab' ? deltaLab(lab, e.lab) : deltaRgb(rgb, e.rgb),
    }));
    scored.sort((p, n) => p.dist - n.dist);
    return { input: rgb, top: scored.slice(0, 5) };
  }, [color, metric]);

  const browse = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return ENTRIES;
    return ENTRIES.filter((e) => `${e.name} ${e.hex}`.toLowerCase().includes(s));
  }, [q]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Color">
            <Input value={color} onChange={(e) => setColor(e.target.value)} className="w-44 font-mono" />
          </Field>
          <Field label="Distance metric">
            <Tabs value={metric} onValueChange={(v) => setMetric(v as Metric)}>
              <TabsList>
                <TabsTrigger value="lab">CIE76 (Lab)</TabsTrigger>
                <TabsTrigger value="rgb">RGB</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>
      </Panel>

      {!matches ? (
        <ErrorBanner error="Enter a valid color (e.g. #4f7ab3, rgb(79,122,179), or a CSS name)." />
      ) : (
        <Panel>
          <PanelHeader title="Nearest matches">
            <CopyButton
              value={() =>
                matches.top.map((m) => `${m.name} ${m.hex} (ΔE ${m.dist.toFixed(2)})`).join('\n')
              }
            />
          </PanelHeader>
          <div className="divide-y">
            {matches.top.map((m, i) => (
              <div key={m.name} className="flex items-center gap-3 px-3 py-2">
                <span className="w-5 shrink-0 text-right font-mono text-2xs text-muted-foreground">
                  {i + 1}
                </span>
                <div className="h-8 w-12 shrink-0 rounded border" style={{ backgroundColor: m.hex }} />
                <span className="w-44 shrink-0 text-sm">{m.name}</span>
                <code className="w-24 shrink-0 font-mono text-xs">{m.hex}</code>
                <span className="min-w-0 flex-1 text-right font-mono text-xs text-muted-foreground tabular">
                  {metric === 'lab' ? 'ΔE' : 'Δrgb'} {m.dist.toFixed(2)}
                </span>
                <CopyButton value={m.hex} size="icon-sm" />
              </div>
            ))}
          </div>
          <StatBar items={[`input ${toHex(matches.input)}`, `${ENTRIES.length} named colors`]} />
        </Panel>
      )}

      <Panel>
        <PanelHeader title="Browse named colors">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter…"
            className="h-7 w-48"
          />
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
