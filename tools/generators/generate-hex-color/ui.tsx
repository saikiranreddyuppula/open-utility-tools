'use client';

import { useState } from 'react';
import { GeneratorList } from '@/components/tools/generator-list';
import { Field, OptionsBar } from '@/components/tools/panel';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const webcrypto = (
  globalThis as unknown as {
    crypto: {
      getRandomValues<T extends ArrayBufferView>(a: T): T;
      randomUUID(): string;
    };
  }
).crypto;

type Format = 'hex' | 'rgb' | 'hsl' | 'all';

/** Random float in [0, 1). */
function rand01(): number {
  const buf = new Uint32Array(1);
  webcrypto.getRandomValues(buf);
  return (buf[0] ?? 0) / 0x100000000;
}

/** Random integer in [min, max] inclusive. */
function randInt(min: number, max: number): number {
  if (max <= min) return min;
  return min + Math.floor(rand01() * (max - min + 1));
}

/** HSL (h 0-360, s/l 0-100) -> RGB (0-255). */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp >= 0 && hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp >= 1 && hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp >= 2 && hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp >= 3 && hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp >= 4 && hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = ln - c / 2;
  return [
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
  ];
}

function toHex(n: number): string {
  return Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
}

export default function HexColorTool() {
  const [format, setFormat] = useState<Format>('hex');
  const [hue, setHue] = useState<[number, number]>([0, 360]);
  const [sat, setSat] = useState<[number, number]>([40, 90]);
  const [light, setLight] = useState<[number, number]>([35, 70]);

  const gen = (): string => {
    const hLo = Math.min(hue[0], hue[1]);
    const hHi = Math.max(hue[0], hue[1]);
    const sLo = Math.min(sat[0], sat[1]);
    const sHi = Math.max(sat[0], sat[1]);
    const lLo = Math.min(light[0], light[1]);
    const lHi = Math.max(light[0], light[1]);

    const h = randInt(hLo, hHi);
    const s = randInt(sLo, sHi);
    const l = randInt(lLo, lHi);

    const [r, g, b] = hslToRgb(h, s, l);
    const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    const rgb = `rgb(${r}, ${g}, ${b})`;
    const hsl = `hsl(${h}, ${s}%, ${l}%)`;

    if (format === 'hex') return hex;
    if (format === 'rgb') return rgb;
    if (format === 'hsl') return hsl;
    return `${hex}  ${rgb}  ${hsl}`;
  };

  return (
    <GeneratorList
      generate={gen}
      deps={[format, hue[0], hue[1], sat[0], sat[1], light[0], light[1]]}
      downloadName="colors.txt"
      label="Random colors"
      options={
        <OptionsBar>
          <Field label="Format">
            <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hex">HEX</SelectItem>
                <SelectItem value="rgb">RGB</SelectItem>
                <SelectItem value="hsl">HSL</SelectItem>
                <SelectItem value="all">All three</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Hue range" hint={`${hue[0]}° - ${hue[1]}°`} className="min-w-44">
            <Slider
              min={0}
              max={360}
              step={1}
              value={hue}
              onValueChange={(v) => setHue([v[0] ?? 0, v[1] ?? 360])}
            />
          </Field>
          <Field label="Saturation" hint={`${sat[0]}% - ${sat[1]}%`} className="min-w-44">
            <Slider
              min={0}
              max={100}
              step={1}
              value={sat}
              onValueChange={(v) => setSat([v[0] ?? 0, v[1] ?? 100])}
            />
          </Field>
          <Field label="Lightness" hint={`${light[0]}% - ${light[1]}%`} className="min-w-44">
            <Slider
              min={0}
              max={100}
              step={1}
              value={light}
              onValueChange={(v) => setLight([v[0] ?? 0, v[1] ?? 100])}
            />
          </Field>
        </OptionsBar>
      }
    />
  );
}
