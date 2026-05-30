'use client';

import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

type Scheme =
  | 'random'
  | 'analogous'
  | 'complementary'
  | 'triadic'
  | 'monochromatic'
  | 'tetradic';

interface Swatch {
  hex: string;
  rgb: string;
  hsl: string;
}

function rand(): number {
  const a = new Uint32Array(1);
  wc.getRandomValues(a);
  return (a[0] ?? 0) / 4294967296;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.min(1, Math.max(0, s / 100));
  const ll = Math.min(1, Math.max(0, l / 100));
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

function parseHex(input: string): { h: number; s: number; l: number } | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(input.trim());
  const hex = m?.[1];
  if (!hex) return null;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const [h, s, l] = rgbToHsl(r, g, b);
  return { h, s, l };
}

function makeSwatch(h: number, s: number, l: number): Swatch {
  const [r, g, b] = hslToRgb(h, s, l);
  return {
    hex: rgbToHex(r, g, b),
    rgb: `rgb(${r}, ${g}, ${b})`,
    hsl: `hsl(${((Math.round(h) % 360) + 360) % 360}, ${Math.round(s)}%, ${Math.round(l)}%)`,
  };
}

export default function RandomColorPalette() {
  const [scheme, setScheme] = useState<Scheme>('analogous');
  const [count, setCount] = useState(5);
  const [satRange, setSatRange] = useState<[number, number]>([55, 80]);
  const [lightRange, setLightRange] = useState<[number, number]>([40, 65]);
  const [anchor, setAnchor] = useState('');
  const [seed, setSeed] = useState(0);

  const swatches = useMemo<Swatch[]>(() => {
    void seed;
    const k = Math.min(10, Math.max(2, count));
    const parsed = parseHex(anchor);
    const baseHue = parsed ? parsed.h : Math.floor(rand() * 360);
    const [sLo, sHi] = satRange;
    const [lLo, lHi] = lightRange;
    const sat = () => sLo + rand() * (sHi - sLo);
    const light = () => lLo + rand() * (lHi - lLo);

    const out: Swatch[] = [];
    const push = (h: number, s: number, l: number) => out.push(makeSwatch(h, s, l));

    switch (scheme) {
      case 'random': {
        for (let i = 0; i < k; i += 1) push(rand() * 360, sat(), light());
        break;
      }
      case 'analogous': {
        for (let i = 0; i < k; i += 1) {
          const offset = (i - (k - 1) / 2) * 30;
          push(baseHue + offset, sat(), light());
        }
        break;
      }
      case 'complementary': {
        for (let i = 0; i < k; i += 1) {
          const h = i % 2 === 0 ? baseHue : baseHue + 180;
          push(h, sat(), light());
        }
        break;
      }
      case 'triadic': {
        for (let i = 0; i < k; i += 1) push(baseHue + (i % 3) * 120, sat(), light());
        break;
      }
      case 'tetradic': {
        for (let i = 0; i < k; i += 1) push(baseHue + (i % 4) * 90, sat(), light());
        break;
      }
      case 'monochromatic': {
        const s = parsed ? parsed.s : sat();
        for (let i = 0; i < k; i += 1) {
          const l = lLo + ((lHi - lLo) * i) / Math.max(1, k - 1);
          push(baseHue, s, l);
        }
        break;
      }
      default: {
        for (let i = 0; i < k; i += 1) push(rand() * 360, sat(), light());
        break;
      }
    }
    return out;
  }, [scheme, count, satRange, lightRange, anchor, seed]);

  const allText = swatches.map((s) => s.hex).join('\n');
  const cssVars = swatches.map((s, i) => `  --color-${i + 1}: ${s.hex};`).join('\n');

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Scheme">
          <Select value={scheme} onValueChange={(v) => setScheme(v as Scheme)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="random">Random</SelectItem>
              <SelectItem value="analogous">Analogous</SelectItem>
              <SelectItem value="complementary">Complementary</SelectItem>
              <SelectItem value="triadic">Triadic</SelectItem>
              <SelectItem value="tetradic">Tetradic</SelectItem>
              <SelectItem value="monochromatic">Monochromatic</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={`Colors: ${count}`} className="min-w-[160px]">
          <Slider
            min={2}
            max={10}
            step={1}
            value={[count]}
            onValueChange={(v) => setCount(v[0] ?? 5)}
          />
        </Field>
        <Field label={`Saturation: ${satRange[0]}–${satRange[1]}%`} className="min-w-[180px]">
          <Slider
            min={0}
            max={100}
            step={1}
            value={[satRange[0], satRange[1]]}
            onValueChange={(v) =>
              setSatRange([v[0] ?? 55, v[1] ?? Math.max(v[0] ?? 55, 80)])
            }
          />
        </Field>
        <Field label={`Lightness: ${lightRange[0]}–${lightRange[1]}%`} className="min-w-[180px]">
          <Slider
            min={0}
            max={100}
            step={1}
            value={[lightRange[0], lightRange[1]]}
            onValueChange={(v) =>
              setLightRange([v[0] ?? 40, v[1] ?? Math.max(v[0] ?? 40, 65)])
            }
          />
        </Field>
        <Field label="Anchor hex" hint="optional base">
          <Input
            value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
            placeholder="#3b82f6"
            className="w-28 font-mono"
          />
        </Field>
        <div className="ml-auto flex items-end">
          <Button variant="secondary" size="sm" onClick={() => setSeed((s) => s + 1)}>
            <RefreshCw className="size-3.5" />
            Re-roll
          </Button>
        </div>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Palette">
          <CopyButton value={() => allText} label="Copy HEX" />
          <CopyButton value={() => `:root {\n${cssVars}\n}`} label="Copy CSS vars" />
        </PanelHeader>
        <div className="flex h-24 w-full overflow-hidden">
          {swatches.map((s, i) => (
            <div key={i} className="flex-1" style={{ backgroundColor: s.hex }} />
          ))}
        </div>
        <div className="divide-y">
          {swatches.map((s, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2">
              <span
                className="size-6 shrink-0 rounded border"
                style={{ backgroundColor: s.hex }}
              />
              <code className="w-24 shrink-0 font-mono text-xs uppercase">{s.hex}</code>
              <code className="w-40 shrink-0 font-mono text-xs text-muted-foreground">
                {s.rgb}
              </code>
              <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                {s.hsl}
              </code>
              <CopyButton value={`${s.hex}\n${s.rgb}\n${s.hsl}`} size="icon-sm" />
            </div>
          ))}
        </div>
        <StatBar items={[`${swatches.length} colors`, `scheme: ${scheme}`]} />
      </Panel>
    </div>
  );
}
