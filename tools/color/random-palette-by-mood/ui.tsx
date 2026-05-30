'use client';

import { useCallback, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { CopyButton } from '@/components/tools/copy-button';
import { Field, OptionsBar, Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type RGB = { r: number; g: number; b: number };
type HSL = { h: number; s: number; l: number };
type Mood = 'vibrant' | 'pastel' | 'muted' | 'dark' | 'warm' | 'cool' | 'earthy';

interface MoodSpec {
  // saturation/lightness bands as [min, max] in 0..1
  s: [number, number];
  l: [number, number];
  // allowed hue windows in degrees; empty = full wheel
  hueWindows: [number, number][];
}

const MOODS: Record<Mood, MoodSpec> = {
  vibrant: { s: [0.7, 1], l: [0.45, 0.6], hueWindows: [] },
  pastel: { s: [0.25, 0.45], l: [0.8, 0.9], hueWindows: [] },
  muted: { s: [0.18, 0.38], l: [0.45, 0.62], hueWindows: [] },
  dark: { s: [0.4, 0.7], l: [0.18, 0.32], hueWindows: [] },
  warm: { s: [0.55, 0.85], l: [0.45, 0.62], hueWindows: [[0, 60], [300, 360]] },
  cool: { s: [0.5, 0.8], l: [0.45, 0.62], hueWindows: [[120, 260]] },
  earthy: { s: [0.3, 0.55], l: [0.32, 0.52], hueWindows: [[20, 50], [70, 110]] },
};

const MOOD_LABELS: Record<Mood, string> = {
  vibrant: 'Vibrant',
  pastel: 'Pastel',
  muted: 'Muted',
  dark: 'Dark',
  warm: 'Warm',
  cool: 'Cool',
  earthy: 'Earthy',
};

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hslToRgb({ h, s, l }: HSL): RGB {
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hn = h / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  };
}

function rgbToHex({ r, g, b }: RGB): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

// Map a 0..360 hue into the nearest allowed window for the mood.
function constrainHue(h: number, windows: [number, number][]): number {
  if (windows.length === 0) return ((h % 360) + 360) % 360;
  const total = windows.reduce((acc, [lo, hi]) => acc + (hi - lo), 0);
  let pos = (((h % 360) + 360) % 360) / 360 * total;
  for (const w of windows) {
    const lo = w[0];
    const hi = w[1];
    const span = hi - lo;
    if (pos <= span) return ((lo + pos) % 360 + 360) % 360;
    pos -= span;
  }
  const last = windows[windows.length - 1] ?? [0, 360];
  return last[1] % 360;
}

export default function RandomPaletteByMoodTool() {
  const [mood, setMood] = useState<Mood>('vibrant');
  const [size, setSize] = useState(5);
  const [seedInput, setSeedInput] = useState('');
  const [nonce, setNonce] = useState(0);

  const reseed = useCallback(() => setNonce((n) => n + 1), []);

  const palette = useMemo(() => {
    const spec = MOODS[mood];
    const seedStr = seedInput.trim().length ? seedInput.trim() : `auto-${nonce}`;
    const rand = mulberry32(fnv1a(`${mood}:${seedStr}`));
    const startHue = rand() * 360;
    const out: { hex: string; hsl: string }[] = [];
    for (let i = 0; i < size; i++) {
      // Spread hues evenly around the wheel, then constrain to the mood's windows.
      const rawHue = startHue + (i / Math.max(1, size)) * 360 + (rand() - 0.5) * 24;
      const h = constrainHue(rawHue, spec.hueWindows);
      const s = spec.s[0] + rand() * (spec.s[1] - spec.s[0]);
      const l = spec.l[0] + rand() * (spec.l[1] - spec.l[0]);
      const c = hslToRgb({ h, s, l });
      out.push({
        hex: rgbToHex(c),
        hsl: `hsl(${Math.round(h)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`,
      });
    }
    return out;
  }, [mood, size, seedInput, nonce]);

  const cssVars = useMemo(
    () => ':root {\n' + palette.map((p, i) => `  --c-${i + 1}: ${p.hex};`).join('\n') + '\n}',
    [palette],
  );

  return (
    <Panel>
      <PanelHeader title="Random Palette by Mood" />
      <div className="flex flex-col gap-4 p-4">
        <OptionsBar>
          <Field label="Mood" className="min-w-[160px]">
            <Select value={mood} onValueChange={(v) => setMood(v as Mood)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MOODS) as Mood[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {MOOD_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={`Size: ${size}`} className="min-w-[160px]">
            <Slider
              value={[size]}
              min={2}
              max={10}
              step={1}
              onValueChange={(v) => setSize(v[0] ?? size)}
            />
          </Field>
          <Field label="Seed (optional)" className="min-w-[180px]">
            <Input
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              className="font-mono"
              placeholder="empty = random"
            />
          </Field>
          <div className="ml-auto flex items-end">
            <Button variant="secondary" size="sm" onClick={reseed}>
              <RefreshCw className="size-3.5" />
              Regenerate
            </Button>
          </div>
        </OptionsBar>

        <div className="flex h-16 w-full overflow-hidden rounded-md border">
          {palette.map((p, i) => (
            <div key={i} className="flex-1" style={{ backgroundColor: p.hex }} title={p.hex} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
          {palette.map((p, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border p-2">
              <div className="h-9 w-9 shrink-0 rounded border" style={{ backgroundColor: p.hex }} />
              <div className="min-w-0 flex-1">
                <div className="font-mono text-xs">{p.hex}</div>
                <div className="truncate font-mono text-2xs text-muted-foreground">{p.hsl}</div>
              </div>
              <CopyButton value={p.hex} size="icon-sm" />
            </div>
          ))}
        </div>

        <StatBar
          items={[
            `${palette.length} colors`,
            `${MOOD_LABELS[mood]} mood`,
            seedInput.trim().length ? 'seeded' : 'random',
          ]}
        />

        <Panel>
          <PanelHeader title="CSS custom properties">
            <CopyButton value={cssVars} label="Copy" />
          </PanelHeader>
          <pre className="max-h-48 overflow-auto p-3 font-mono text-xs">{cssVars}</pre>
        </Panel>
      </div>
    </Panel>
  );
}
