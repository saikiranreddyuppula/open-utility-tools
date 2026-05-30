'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

interface RGBA { r: number; g: number; b: number; a: number } // r,g,b in 0..255, a 0..1

const NAMED: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff',
  yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff', gray: '#808080', grey: '#808080',
  orange: '#ffa500', purple: '#800080', pink: '#ffc0cb', brown: '#a52a2a', navy: '#000080',
  teal: '#008080', olive: '#808000', maroon: '#800000', lime: '#00ff00', aqua: '#00ffff',
  silver: '#c0c0c0', gold: '#ffd700', indigo: '#4b0082', violet: '#ee82ee', coral: '#ff7f50',
  salmon: '#fa8072', khaki: '#f0e68c', crimson: '#dc143c', tomato: '#ff6347', orchid: '#da70d6',
  transparent: '#00000000', rebeccapurple: '#663399', slategray: '#708090', dodgerblue: '#1e90ff',
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function parseHex(hex: string): RGBA | null {
  let h = hex.replace(/^#/, '');
  if (h.length === 3 || h.length === 4) {
    h = h.split('').map((c) => c + c).join('');
  }
  if (h.length !== 6 && h.length !== 8) return null;
  if (!/^[0-9a-fA-F]+$/.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

function parseNumberMaybePct(token: string, scale: number): number | null {
  const t = token.trim();
  if (t === '') return null;
  if (t.endsWith('%')) {
    const n = Number(t.slice(0, -1));
    if (!Number.isFinite(n)) return null;
    return (n / 100) * scale;
  }
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseAlpha(token: string | undefined): number {
  if (token === undefined) return 1;
  const t = token.trim();
  if (t === '') return 1;
  if (t.endsWith('%')) {
    const n = Number(t.slice(0, -1));
    return Number.isFinite(n) ? clamp(n / 100, 0, 1) : 1;
  }
  const n = Number(t);
  return Number.isFinite(n) ? clamp(n, 0, 1) : 1;
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hh = ((h % 360) + 360) % 360;
  const ss = clamp(s, 0, 1);
  const ll = clamp(l, 0, 1);
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  let rp = 0; let gp = 0; let bp = 0;
  if (hh < 60) { rp = c; gp = x; bp = 0; }
  else if (hh < 120) { rp = x; gp = c; bp = 0; }
  else if (hh < 180) { rp = 0; gp = c; bp = x; }
  else if (hh < 240) { rp = 0; gp = x; bp = c; }
  else if (hh < 300) { rp = x; gp = 0; bp = c; }
  else { rp = c; gp = 0; bp = x; }
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

function parseColor(input: string): RGBA | null {
  const s = input.trim().toLowerCase();
  if (s === '') return null;

  if (s.startsWith('#')) return parseHex(s);

  const named = NAMED[s];
  if (named) return parseHex(named);

  const fn = /^([a-z]+)\(([^)]*)\)$/.exec(s);
  if (!fn) {
    // maybe a bare hex without #
    if (/^[0-9a-f]{3,8}$/.test(s)) return parseHex(s);
    return null;
  }
  const name = fn[1] ?? '';
  const body = fn[2] ?? '';
  // split on commas or whitespace, and on slash for alpha
  const slashSplit = body.split('/');
  const main = (slashSplit[0] ?? '').trim();
  const alphaTok = slashSplit[1];
  const tokens = main.split(/[\s,]+/).filter((t) => t !== '');

  if (name === 'rgb' || name === 'rgba') {
    const r = parseNumberMaybePct(tokens[0] ?? '', 255);
    const g = parseNumberMaybePct(tokens[1] ?? '', 255);
    const b = parseNumberMaybePct(tokens[2] ?? '', 255);
    if (r === null || g === null || b === null) return null;
    const a = parseAlpha(alphaTok ?? tokens[3]);
    return { r: clamp(Math.round(r), 0, 255), g: clamp(Math.round(g), 0, 255), b: clamp(Math.round(b), 0, 255), a };
  }
  if (name === 'hsl' || name === 'hsla') {
    const hTok = tokens[0] ?? '';
    const h = Number(hTok.replace(/deg$/, ''));
    const sStr = tokens[1] ?? '';
    const lStr = tokens[2] ?? '';
    const sv = sStr.endsWith('%') ? Number(sStr.slice(0, -1)) / 100 : Number(sStr);
    const lv = lStr.endsWith('%') ? Number(lStr.slice(0, -1)) / 100 : Number(lStr);
    if (!Number.isFinite(h) || !Number.isFinite(sv) || !Number.isFinite(lv)) return null;
    const { r, g, b } = hslToRgb(h, sv, lv);
    const a = parseAlpha(alphaTok ?? tokens[3]);
    return { r, g, b, a };
  }
  return null;
}

// --- sRGB -> OKLCH ---

function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function rgbToOklch(r: number, g: number, b: number): { L: number; C: number; H: number } {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const C = Math.sqrt(a * a + bb * bb);
  let H = (Math.atan2(bb, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255; const gn = g / 255; const bn = b / 255;
  const max = Math.max(rn, gn, bn); const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0; let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

function rgbToHwb(r: number, g: number, b: number): { h: number; w: number; bl: number } {
  const { h } = rgbToHsl(r, g, b);
  const w = Math.min(r, g, b) / 255;
  const bl = 1 - Math.max(r, g, b) / 255;
  return { h, w, bl };
}

function hex2(n: number): string {
  return clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
}

function fmt(n: number, d: number): string {
  return Number.parseFloat(n.toFixed(d)).toString();
}

export default function CssColorFormatConverterTool() {
  const [input, setInput] = useState('#3b82f6');

  const result = useMemo(() => {
    const c = parseColor(input);
    if (input.trim() === '') return { error: '' };
    if (!c) return { error: 'Could not parse color. Try hex, rgb(), hsl(), or a named color.' };

    const { r, g, b, a } = c;
    const aPct = Math.round(a * 100);
    const hex6 = `#${hex2(r)}${hex2(g)}${hex2(b)}`;
    const hex8 = `#${hex2(r)}${hex2(g)}${hex2(b)}${hex2(a * 255)}`;
    const hsl = rgbToHsl(r, g, b);
    const hwb = rgbToHwb(r, g, b);
    const oklch = rgbToOklch(r, g, b);

    const rows: Array<{ label: string; value: string }> = [
      { label: 'Hex', value: hex6 },
      { label: 'Hex (8-digit)', value: hex8 },
      { label: 'rgb() modern', value: a < 1 ? `rgb(${r} ${g} ${b} / ${aPct}%)` : `rgb(${r} ${g} ${b})` },
      { label: 'rgba() legacy', value: a < 1 ? `rgba(${r}, ${g}, ${b}, ${fmt(a, 3)})` : `rgb(${r}, ${g}, ${b})` },
      {
        label: 'hsl()',
        value: a < 1
          ? `hsl(${fmt(hsl.h, 1)} ${fmt(hsl.s * 100, 1)}% ${fmt(hsl.l * 100, 1)}% / ${aPct}%)`
          : `hsl(${fmt(hsl.h, 1)} ${fmt(hsl.s * 100, 1)}% ${fmt(hsl.l * 100, 1)}%)`,
      },
      {
        label: 'hsla() legacy',
        value: `hsla(${fmt(hsl.h, 1)}, ${fmt(hsl.s * 100, 1)}%, ${fmt(hsl.l * 100, 1)}%, ${fmt(a, 3)})`,
      },
      {
        label: 'hwb()',
        value: a < 1
          ? `hwb(${fmt(hwb.h, 1)} ${fmt(hwb.w * 100, 1)}% ${fmt(hwb.bl * 100, 1)}% / ${aPct}%)`
          : `hwb(${fmt(hwb.h, 1)} ${fmt(hwb.w * 100, 1)}% ${fmt(hwb.bl * 100, 1)}%)`,
      },
      {
        label: 'oklch()',
        value: a < 1
          ? `oklch(${fmt(oklch.L * 100, 2)}% ${fmt(oklch.C, 4)} ${fmt(oklch.H, 2)} / ${aPct}%)`
          : `oklch(${fmt(oklch.L * 100, 2)}% ${fmt(oklch.C, 4)} ${fmt(oklch.H, 2)})`,
      },
    ];
    return { rows, swatch: a < 1 ? `rgba(${r}, ${g}, ${b}, ${a})` : hex6 };
  }, [input]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Color" className="min-w-[260px] flex-1">
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="#3b82f6, rgb(59 130 246), hsl(...), blue" className="font-mono" />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error || null} />
      ) : (
        <Panel>
          <PanelHeader title="All CSS formats">
            <CopyButton value={() => result.rows.map((r) => `${r.label}: ${r.value}`).join('\n')} />
          </PanelHeader>
          <div className="flex items-center gap-3 border-b px-3 py-3">
            <div className="size-12 shrink-0 rounded border" style={{ background: result.swatch }} />
            <span className="text-sm text-muted-foreground">Preview</span>
          </div>
          <div className="divide-y">
            {result.rows.map((r) => (
              <div key={r.label} className="flex items-center gap-3 px-3 py-2">
                <span className="w-36 shrink-0 text-sm text-muted-foreground">{r.label}</span>
                <code className="min-w-0 flex-1 break-all font-mono text-sm">{r.value}</code>
                <CopyButton value={r.value} size="icon-sm" />
              </div>
            ))}
          </div>
          <StatBar items={[`Input: ${input.trim()}`]} />
        </Panel>
      )}
    </div>
  );
}
