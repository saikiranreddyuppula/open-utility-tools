'use client';

import { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { Field, OptionsBar, Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';

type Shade = { name: string; hex: string };
type Hue = { name: string; shades: Shade[] };

// Material Design 2014 color palette (https://material.io). Shades 50–900 + accents.
const PALETTE: Hue[] = [
  {
    name: 'Red',
    shades: [
      { name: '50', hex: '#FFEBEE' },
      { name: '100', hex: '#FFCDD2' },
      { name: '200', hex: '#EF9A9A' },
      { name: '300', hex: '#E57373' },
      { name: '400', hex: '#EF5350' },
      { name: '500', hex: '#F44336' },
      { name: '600', hex: '#E53935' },
      { name: '700', hex: '#D32F2F' },
      { name: '800', hex: '#C62828' },
      { name: '900', hex: '#B71C1C' },
      { name: 'A100', hex: '#FF8A80' },
      { name: 'A200', hex: '#FF5252' },
      { name: 'A400', hex: '#FF1744' },
      { name: 'A700', hex: '#D50000' },
    ],
  },
  {
    name: 'Pink',
    shades: [
      { name: '50', hex: '#FCE4EC' },
      { name: '100', hex: '#F8BBD0' },
      { name: '200', hex: '#F48FB1' },
      { name: '300', hex: '#F06292' },
      { name: '400', hex: '#EC407A' },
      { name: '500', hex: '#E91E63' },
      { name: '600', hex: '#D81B60' },
      { name: '700', hex: '#C2185B' },
      { name: '800', hex: '#AD1457' },
      { name: '900', hex: '#880E4F' },
      { name: 'A100', hex: '#FF80AB' },
      { name: 'A200', hex: '#FF4081' },
      { name: 'A400', hex: '#F50057' },
      { name: 'A700', hex: '#C51162' },
    ],
  },
  {
    name: 'Purple',
    shades: [
      { name: '50', hex: '#F3E5F5' },
      { name: '100', hex: '#E1BEE7' },
      { name: '200', hex: '#CE93D8' },
      { name: '300', hex: '#BA68C8' },
      { name: '400', hex: '#AB47BC' },
      { name: '500', hex: '#9C27B0' },
      { name: '600', hex: '#8E24AA' },
      { name: '700', hex: '#7B1FA2' },
      { name: '800', hex: '#6A1B9A' },
      { name: '900', hex: '#4A148C' },
      { name: 'A100', hex: '#EA80FC' },
      { name: 'A200', hex: '#E040FB' },
      { name: 'A400', hex: '#D500F9' },
      { name: 'A700', hex: '#AA00FF' },
    ],
  },
  {
    name: 'Deep Purple',
    shades: [
      { name: '50', hex: '#EDE7F6' },
      { name: '100', hex: '#D1C4E9' },
      { name: '200', hex: '#B39DDB' },
      { name: '300', hex: '#9575CD' },
      { name: '400', hex: '#7E57C2' },
      { name: '500', hex: '#673AB7' },
      { name: '600', hex: '#5E35B1' },
      { name: '700', hex: '#512DA8' },
      { name: '800', hex: '#4527A0' },
      { name: '900', hex: '#311B92' },
      { name: 'A100', hex: '#B388FF' },
      { name: 'A200', hex: '#7C4DFF' },
      { name: 'A400', hex: '#651FFF' },
      { name: 'A700', hex: '#6200EA' },
    ],
  },
  {
    name: 'Indigo',
    shades: [
      { name: '50', hex: '#E8EAF6' },
      { name: '100', hex: '#C5CAE9' },
      { name: '200', hex: '#9FA8DA' },
      { name: '300', hex: '#7986CB' },
      { name: '400', hex: '#5C6BC0' },
      { name: '500', hex: '#3F51B5' },
      { name: '600', hex: '#3949AB' },
      { name: '700', hex: '#303F9F' },
      { name: '800', hex: '#283593' },
      { name: '900', hex: '#1A237E' },
      { name: 'A100', hex: '#8C9EFF' },
      { name: 'A200', hex: '#536DFE' },
      { name: 'A400', hex: '#3D5AFE' },
      { name: 'A700', hex: '#304FFE' },
    ],
  },
  {
    name: 'Blue',
    shades: [
      { name: '50', hex: '#E3F2FD' },
      { name: '100', hex: '#BBDEFB' },
      { name: '200', hex: '#90CAF9' },
      { name: '300', hex: '#64B5F6' },
      { name: '400', hex: '#42A5F5' },
      { name: '500', hex: '#2196F3' },
      { name: '600', hex: '#1E88E5' },
      { name: '700', hex: '#1976D2' },
      { name: '800', hex: '#1565C0' },
      { name: '900', hex: '#0D47A1' },
      { name: 'A100', hex: '#82B1FF' },
      { name: 'A200', hex: '#448AFF' },
      { name: 'A400', hex: '#2979FF' },
      { name: 'A700', hex: '#2962FF' },
    ],
  },
  {
    name: 'Light Blue',
    shades: [
      { name: '50', hex: '#E1F5FE' },
      { name: '100', hex: '#B3E5FC' },
      { name: '200', hex: '#81D4FA' },
      { name: '300', hex: '#4FC3F7' },
      { name: '400', hex: '#29B6F6' },
      { name: '500', hex: '#03A9F4' },
      { name: '600', hex: '#039BE5' },
      { name: '700', hex: '#0288D1' },
      { name: '800', hex: '#0277BD' },
      { name: '900', hex: '#01579B' },
      { name: 'A100', hex: '#80D8FF' },
      { name: 'A200', hex: '#40C4FF' },
      { name: 'A400', hex: '#00B0FF' },
      { name: 'A700', hex: '#0091EA' },
    ],
  },
  {
    name: 'Cyan',
    shades: [
      { name: '50', hex: '#E0F7FA' },
      { name: '100', hex: '#B2EBF2' },
      { name: '200', hex: '#80DEEA' },
      { name: '300', hex: '#4DD0E1' },
      { name: '400', hex: '#26C6DA' },
      { name: '500', hex: '#00BCD4' },
      { name: '600', hex: '#00ACC1' },
      { name: '700', hex: '#0097A7' },
      { name: '800', hex: '#00838F' },
      { name: '900', hex: '#006064' },
      { name: 'A100', hex: '#84FFFF' },
      { name: 'A200', hex: '#18FFFF' },
      { name: 'A400', hex: '#00E5FF' },
      { name: 'A700', hex: '#00B8D4' },
    ],
  },
  {
    name: 'Teal',
    shades: [
      { name: '50', hex: '#E0F2F1' },
      { name: '100', hex: '#B2DFDB' },
      { name: '200', hex: '#80CBC4' },
      { name: '300', hex: '#4DB6AC' },
      { name: '400', hex: '#26A69A' },
      { name: '500', hex: '#009688' },
      { name: '600', hex: '#00897B' },
      { name: '700', hex: '#00796B' },
      { name: '800', hex: '#00695C' },
      { name: '900', hex: '#004D40' },
      { name: 'A100', hex: '#A7FFEB' },
      { name: 'A200', hex: '#64FFDA' },
      { name: 'A400', hex: '#1DE9B6' },
      { name: 'A700', hex: '#00BFA5' },
    ],
  },
  {
    name: 'Green',
    shades: [
      { name: '50', hex: '#E8F5E9' },
      { name: '100', hex: '#C8E6C9' },
      { name: '200', hex: '#A5D6A7' },
      { name: '300', hex: '#81C784' },
      { name: '400', hex: '#66BB6A' },
      { name: '500', hex: '#4CAF50' },
      { name: '600', hex: '#43A047' },
      { name: '700', hex: '#388E3C' },
      { name: '800', hex: '#2E7D32' },
      { name: '900', hex: '#1B5E20' },
      { name: 'A100', hex: '#B9F6CA' },
      { name: 'A200', hex: '#69F0AE' },
      { name: 'A400', hex: '#00E676' },
      { name: 'A700', hex: '#00C853' },
    ],
  },
  {
    name: 'Light Green',
    shades: [
      { name: '50', hex: '#F1F8E9' },
      { name: '100', hex: '#DCEDC8' },
      { name: '200', hex: '#C5E1A5' },
      { name: '300', hex: '#AED581' },
      { name: '400', hex: '#9CCC65' },
      { name: '500', hex: '#8BC34A' },
      { name: '600', hex: '#7CB342' },
      { name: '700', hex: '#689F38' },
      { name: '800', hex: '#558B2F' },
      { name: '900', hex: '#33691E' },
      { name: 'A100', hex: '#CCFF90' },
      { name: 'A200', hex: '#B2FF59' },
      { name: 'A400', hex: '#76FF03' },
      { name: 'A700', hex: '#64DD17' },
    ],
  },
  {
    name: 'Lime',
    shades: [
      { name: '50', hex: '#F9FBE7' },
      { name: '100', hex: '#F0F4C3' },
      { name: '200', hex: '#E6EE9C' },
      { name: '300', hex: '#DCE775' },
      { name: '400', hex: '#D4E157' },
      { name: '500', hex: '#CDDC39' },
      { name: '600', hex: '#C0CA33' },
      { name: '700', hex: '#AFB42B' },
      { name: '800', hex: '#9E9D24' },
      { name: '900', hex: '#827717' },
      { name: 'A100', hex: '#F4FF81' },
      { name: 'A200', hex: '#EEFF41' },
      { name: 'A400', hex: '#C6FF00' },
      { name: 'A700', hex: '#AEEA00' },
    ],
  },
  {
    name: 'Yellow',
    shades: [
      { name: '50', hex: '#FFFDE7' },
      { name: '100', hex: '#FFF9C4' },
      { name: '200', hex: '#FFF59D' },
      { name: '300', hex: '#FFF176' },
      { name: '400', hex: '#FFEE58' },
      { name: '500', hex: '#FFEB3B' },
      { name: '600', hex: '#FDD835' },
      { name: '700', hex: '#FBC02D' },
      { name: '800', hex: '#F9A825' },
      { name: '900', hex: '#F57F17' },
      { name: 'A100', hex: '#FFFF8D' },
      { name: 'A200', hex: '#FFFF00' },
      { name: 'A400', hex: '#FFEA00' },
      { name: 'A700', hex: '#FFD600' },
    ],
  },
  {
    name: 'Amber',
    shades: [
      { name: '50', hex: '#FFF8E1' },
      { name: '100', hex: '#FFECB3' },
      { name: '200', hex: '#FFE082' },
      { name: '300', hex: '#FFD54F' },
      { name: '400', hex: '#FFCA28' },
      { name: '500', hex: '#FFC107' },
      { name: '600', hex: '#FFB300' },
      { name: '700', hex: '#FFA000' },
      { name: '800', hex: '#FF8F00' },
      { name: '900', hex: '#FF6F00' },
      { name: 'A100', hex: '#FFE57F' },
      { name: 'A200', hex: '#FFD740' },
      { name: 'A400', hex: '#FFC400' },
      { name: 'A700', hex: '#FFAB00' },
    ],
  },
  {
    name: 'Orange',
    shades: [
      { name: '50', hex: '#FFF3E0' },
      { name: '100', hex: '#FFE0B2' },
      { name: '200', hex: '#FFCC80' },
      { name: '300', hex: '#FFB74D' },
      { name: '400', hex: '#FFA726' },
      { name: '500', hex: '#FF9800' },
      { name: '600', hex: '#FB8C00' },
      { name: '700', hex: '#F57C00' },
      { name: '800', hex: '#EF6C00' },
      { name: '900', hex: '#E65100' },
      { name: 'A100', hex: '#FFD180' },
      { name: 'A200', hex: '#FFAB40' },
      { name: 'A400', hex: '#FF9100' },
      { name: 'A700', hex: '#FF6D00' },
    ],
  },
  {
    name: 'Deep Orange',
    shades: [
      { name: '50', hex: '#FBE9E7' },
      { name: '100', hex: '#FFCCBC' },
      { name: '200', hex: '#FFAB91' },
      { name: '300', hex: '#FF8A65' },
      { name: '400', hex: '#FF7043' },
      { name: '500', hex: '#FF5722' },
      { name: '600', hex: '#F4511E' },
      { name: '700', hex: '#E64A19' },
      { name: '800', hex: '#D84315' },
      { name: '900', hex: '#BF360C' },
      { name: 'A100', hex: '#FF9E80' },
      { name: 'A200', hex: '#FF6E40' },
      { name: 'A400', hex: '#FF3D00' },
      { name: 'A700', hex: '#DD2C00' },
    ],
  },
  {
    name: 'Brown',
    shades: [
      { name: '50', hex: '#EFEBE9' },
      { name: '100', hex: '#D7CCC8' },
      { name: '200', hex: '#BCAAA4' },
      { name: '300', hex: '#A1887F' },
      { name: '400', hex: '#8D6E63' },
      { name: '500', hex: '#795548' },
      { name: '600', hex: '#6D4C41' },
      { name: '700', hex: '#5D4037' },
      { name: '800', hex: '#4E342E' },
      { name: '900', hex: '#3E2723' },
    ],
  },
  {
    name: 'Grey',
    shades: [
      { name: '50', hex: '#FAFAFA' },
      { name: '100', hex: '#F5F5F5' },
      { name: '200', hex: '#EEEEEE' },
      { name: '300', hex: '#E0E0E0' },
      { name: '400', hex: '#BDBDBD' },
      { name: '500', hex: '#9E9E9E' },
      { name: '600', hex: '#757575' },
      { name: '700', hex: '#616161' },
      { name: '800', hex: '#424242' },
      { name: '900', hex: '#212121' },
    ],
  },
  {
    name: 'Blue Grey',
    shades: [
      { name: '50', hex: '#ECEFF1' },
      { name: '100', hex: '#CFD8DC' },
      { name: '200', hex: '#B0BEC5' },
      { name: '300', hex: '#90A4AE' },
      { name: '400', hex: '#78909C' },
      { name: '500', hex: '#607D8B' },
      { name: '600', hex: '#546E7A' },
      { name: '700', hex: '#455A64' },
      { name: '800', hex: '#37474F' },
      { name: '900', hex: '#263238' },
    ],
  },
];

function isLight(hex: string): boolean {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  // Perceived luminance: darker text on light backgrounds.
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

function SwatchButton({ shade }: { shade: Shade }) {
  const [copied, setCopied] = useState(false);
  const fg = isLight(shade.hex) ? '#212121' : '#FFFFFF';

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(shade.hex);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      title={`Copy ${shade.hex}`}
      className="flex flex-col justify-between rounded-md p-2 text-left text-xs transition-opacity hover:opacity-90"
      style={{ backgroundColor: shade.hex, color: fg }}
    >
      <span className="flex items-center justify-between gap-1 font-medium">
        {shade.name}
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3 opacity-60" />}
      </span>
      <span className="font-mono">{shade.hex}</span>
    </button>
  );
}

export default function MaterialColorsTool() {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PALETTE;
    return PALETTE.map((hue) => {
      const hueMatches = hue.name.toLowerCase().includes(q);
      const shades = hueMatches
        ? hue.shades
        : hue.shades.filter(
            (s) =>
              s.hex.toLowerCase().includes(q) ||
              `${hue.name} ${s.name}`.toLowerCase().includes(q),
          );
      return { name: hue.name, shades };
    }).filter((hue) => hue.shades.length > 0);
  }, [query]);

  const total = useMemo(
    () => filtered.reduce((acc, h) => acc + h.shades.length, 0),
    [filtered],
  );

  return (
    <Panel>
      <PanelHeader title="Material Design Color Palette" />
      <div className="flex flex-col gap-4 p-4">
        <OptionsBar>
          <Field label="Search" className="min-w-[260px] flex-1">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by hue, shade or hex (e.g. blue, 500, #F44336)"
            />
          </Field>
        </OptionsBar>

        <StatBar items={[`${filtered.length} hues`, `${total} swatches`]} />

        <div className="flex flex-col gap-5">
          {filtered.map((hue) => (
            <div key={hue.name} className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">{hue.name}</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
                {hue.shades.map((shade) => (
                  <SwatchButton key={shade.name} shade={shade} />
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No colors match “{query}”.</p>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
