'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

// CSS named colors (HTML/CSS Color Module Level 4).
const CSS_COLORS: Record<string, string> = {
  aliceblue: '#f0f8ff', antiquewhite: '#faebd7', aqua: '#00ffff', aquamarine: '#7fffd4', azure: '#f0ffff',
  beige: '#f5f5dc', bisque: '#ffe4c4', black: '#000000', blanchedalmond: '#ffebcd', blue: '#0000ff',
  blueviolet: '#8a2be2', brown: '#a52a2a', burlywood: '#deb887', cadetblue: '#5f9ea0', chartreuse: '#7fff00',
  chocolate: '#d2691e', coral: '#ff7f50', cornflowerblue: '#6495ed', cornsilk: '#fff8dc', crimson: '#dc143c',
  cyan: '#00ffff', darkblue: '#00008b', darkcyan: '#008b8b', darkgoldenrod: '#b8860b', darkgray: '#a9a9a9',
  darkgreen: '#006400', darkkhaki: '#bdb76b', darkmagenta: '#8b008b', darkolivegreen: '#556b2f', darkorange: '#ff8c00',
  darkorchid: '#9932cc', darkred: '#8b0000', darksalmon: '#e9967a', darkseagreen: '#8fbc8f', darkslateblue: '#483d8b',
  darkslategray: '#2f4f4f', darkturquoise: '#00ced1', darkviolet: '#9400d3', deeppink: '#ff1493', deepskyblue: '#00bfff',
  dimgray: '#696969', dodgerblue: '#1e90ff', firebrick: '#b22222', floralwhite: '#fffaf0', forestgreen: '#228b22',
  fuchsia: '#ff00ff', gainsboro: '#dcdcdc', ghostwhite: '#f8f8ff', gold: '#ffd700', goldenrod: '#daa520',
  gray: '#808080', green: '#008000', greenyellow: '#adff2f', honeydew: '#f0fff0', hotpink: '#ff69b4',
  indianred: '#cd5c5c', indigo: '#4b0082', ivory: '#fffff0', khaki: '#f0e68c', lavender: '#e6e6fa',
  lavenderblush: '#fff0f5', lawngreen: '#7cfc00', lemonchiffon: '#fffacd', lightblue: '#add8e6', lightcoral: '#f08080',
  lightcyan: '#e0ffff', lightgoldenrodyellow: '#fafad2', lightgray: '#d3d3d3', lightgreen: '#90ee90', lightpink: '#ffb6c1',
  lightsalmon: '#ffa07a', lightseagreen: '#20b2aa', lightskyblue: '#87cefa', lightslategray: '#778899', lightsteelblue: '#b0c4de',
  lightyellow: '#ffffe0', lime: '#00ff00', limegreen: '#32cd32', linen: '#faf0e6', magenta: '#ff00ff',
  maroon: '#800000', mediumaquamarine: '#66cdaa', mediumblue: '#0000cd', mediumorchid: '#ba55d3', mediumpurple: '#9370db',
  mediumseagreen: '#3cb371', mediumslateblue: '#7b68ee', mediumspringgreen: '#00fa9a', mediumturquoise: '#48d1cc', mediumvioletred: '#c71585',
  midnightblue: '#191970', mintcream: '#f5fffa', mistyrose: '#ffe4e1', moccasin: '#ffe4b5', navajowhite: '#ffdead',
  navy: '#000080', oldlace: '#fdf5e6', olive: '#808000', olivedrab: '#6b8e23', orange: '#ffa500',
  orangered: '#ff4500', orchid: '#da70d6', palegoldenrod: '#eee8aa', palegreen: '#98fb98', paleturquoise: '#afeeee',
  palevioletred: '#db7093', papayawhip: '#ffefd5', peachpuff: '#ffdab9', peru: '#cd853f', pink: '#ffc0cb',
  plum: '#dda0dd', powderblue: '#b0e0e6', purple: '#800080', rebeccapurple: '#663399', red: '#ff0000',
  rosybrown: '#bc8f8f', royalblue: '#4169e1', saddlebrown: '#8b4513', salmon: '#fa8072', sandybrown: '#f4a460',
  seagreen: '#2e8b57', seashell: '#fff5ee', sienna: '#a0522d', silver: '#c0c0c0', skyblue: '#87ceeb',
  slateblue: '#6a5acd', slategray: '#708090', snow: '#fffafa', springgreen: '#00ff7f', steelblue: '#4682b4',
  tan: '#d2b48c', teal: '#008080', thistle: '#d8bfd8', tomato: '#ff6347', turquoise: '#40e0d0',
  violet: '#ee82ee', wheat: '#f5deb3', white: '#ffffff', whitesmoke: '#f5f5f5', yellow: '#ffff00',
  yellowgreen: '#9acd32',
};

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1] ?? '';
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function parseColor(input: string): [number, number, number] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const rgbMatch = /^rgba?\(\s*(\d{1,3})[,\s]+(\d{1,3})[,\s]+(\d{1,3})/i.exec(trimmed);
  if (rgbMatch) {
    const r = Number(rgbMatch[1]);
    const g = Number(rgbMatch[2]);
    const b = Number(rgbMatch[3]);
    if ([r, g, b].every((v) => Number.isFinite(v) && v >= 0 && v <= 255)) {
      return [r, g, b];
    }
    return null;
  }
  return hexToRgb(trimmed);
}

function prettyName(name: string): string {
  const suffixes = [
    'goldenrodyellow', 'goldenrod', 'aquamarine', 'turquoise', 'violetred', 'springgreen',
    'seagreen', 'slateblue', 'slategray', 'steelblue', 'skyblue', 'orchid', 'salmon',
    'blue', 'green', 'red', 'yellow', 'gray', 'grey', 'pink', 'purple', 'white',
    'violet', 'orange', 'brown', 'cyan', 'khaki', 'almond', 'wood', 'chiffon', 'cream',
    'lace', 'rose', 'smoke', 'puff', 'whip',
  ];
  let result = name;
  for (const w of suffixes) {
    result = result.replace(new RegExp(`(.+)${w}$`), `$1 ${w}`);
  }
  result = result.replace(/^(dark|light|medium|pale|deep|hot|dim|blanched|navajo|cornflower|cadet|forest|dodger|fire|midnight|royal|saddle|sandy|rosy|powder|peach|papaya|misty|mint|lemon|lavender|honey|ghost|floral|dark|antique|alice)/, '$1 ');
  return result.replace(/\s+/g, ' ').trim();
}

interface Match {
  name: string;
  hex: string;
  delta: number;
}

const ENTRIES: Array<[string, string, [number, number, number]]> = Object.entries(CSS_COLORS).map(
  ([name, hex]) => [name, hex, hexToRgb(hex) ?? [0, 0, 0]],
);

function nearestColors(rgb: [number, number, number], count: number): Match[] {
  const scored: Match[] = ENTRIES.map(([name, hex, crgb]) => {
    const dr = rgb[0] - crgb[0];
    const dg = rgb[1] - crgb[1];
    const db = rgb[2] - crgb[2];
    return { name, hex, delta: dr * dr + dg * dg + db * db };
  });
  scored.sort((a, b) => a.delta - b.delta);
  return scored.slice(0, count);
}

export default function ColorNameFinderTool() {
  const [colorInput, setColorInput] = useState('#6a8fd5');

  const rgb = useMemo(() => parseColor(colorInput), [colorInput]);
  const error = colorInput.trim() && !rgb ? 'Enter a valid HEX (#6a8fd5) or rgb() color.' : null;

  const matches = useMemo(() => (rgb ? nearestColors(rgb, 6) : []), [rgb]);
  const top = matches[0];

  const pickerHex = useMemo(() => {
    if (!rgb) return '#6a8fd5';
    return '#' + rgb.map((x) => x.toString(16).padStart(2, '0')).join('');
  }, [rgb]);

  return (
    <div className="flex flex-col gap-3">
      <ErrorBanner error={error} />
      <OptionsBar>
        <Field label="Color (HEX or rgb)" className="min-w-[260px]">
          <div className="flex items-center gap-2">
            <Input
              type="color"
              value={pickerHex}
              onChange={(e) => setColorInput(e.target.value)}
              className="h-9 w-12 p-1"
              aria-label="Pick color"
            />
            <Input
              value={colorInput}
              onChange={(e) => setColorInput(e.target.value)}
              placeholder="#6a8fd5 or rgb(106,143,213)"
              className="h-9 font-mono"
            />
          </div>
        </Field>
      </OptionsBar>

      {top ? (
        <Panel>
          <PanelHeader title="Closest CSS color name">
            <CopyButton value={prettyName(top.name)} />
          </PanelHeader>
          <div className="flex items-center gap-4 p-4">
            <div className="flex flex-col items-center gap-1">
              <span
                className="size-16 rounded-md border"
                style={{ backgroundColor: pickerHex }}
              />
              <span className="text-2xs text-muted-foreground">your color</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span
                className="size-16 rounded-md border"
                style={{ backgroundColor: top.hex }}
              />
              <span className="text-2xs text-muted-foreground">match</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-lg font-semibold capitalize">{prettyName(top.name)}</span>
              <span className="font-mono text-sm text-muted-foreground">
                {top.name} · {top.hex}
              </span>
            </div>
          </div>
          <StatBar
            items={[top.delta === 0 ? 'Exact match' : `Δ ${Math.round(Math.sqrt(top.delta))}`]}
          />
        </Panel>
      ) : null}

      {matches.length > 1 ? (
        <Panel>
          <PanelHeader title="Other close matches" />
          <div className="divide-y">
            {matches.slice(1).map((m) => (
              <div key={m.name} className="flex items-center gap-3 px-3 py-2">
                <span
                  className="size-8 shrink-0 rounded border"
                  style={{ backgroundColor: m.hex }}
                />
                <span className="flex-1 capitalize">{prettyName(m.name)}</span>
                <span className="font-mono text-sm text-muted-foreground">{m.hex}</span>
                <span className="w-16 text-right text-2xs text-muted-foreground">
                  Δ {Math.round(Math.sqrt(m.delta))}
                </span>
                <CopyButton value={prettyName(m.name)} size="icon-sm" />
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
