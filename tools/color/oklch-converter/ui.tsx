'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Dir = 'rgb-to-oklch' | 'oklch-to-rgb';

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}
function toHexByte(n: number): string {
  return clampByte(n).toString(16).padStart(2, '0');
}
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}
function normHue(h: number): number {
  let x = h % 360;
  if (x < 0) x += 360;
  return x;
}

/** linear sRGB 0-1 -> OKLab. (Björn Ottosson) */
function linearRgbToOklab(r: number, g: number, b: number): { L: number; a: number; b: number } {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

/** OKLab -> linear sRGB 0-1. */
function oklabToLinearRgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function parseNum(raw: string): number | null {
  const v = Number(raw.trim());
  return Number.isFinite(v) ? v : null;
}

/** Parse "#rgb"/"#rrggbb" or "r,g,b"/"r g b" into 0-255 triple. */
function parseRgbInput(raw: string): [number, number, number] | null {
  const s = raw.trim();
  if (!s) return null;
  const hexMatch = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hexMatch && hexMatch[1] !== undefined) {
    let hx = hexMatch[1];
    if (hx.length === 3) {
      const c0 = hx[0] ?? '0';
      const c1 = hx[1] ?? '0';
      const c2 = hx[2] ?? '0';
      hx = `${c0}${c0}${c1}${c1}${c2}${c2}`;
    }
    const r = parseInt(hx.slice(0, 2), 16);
    const g = parseInt(hx.slice(2, 4), 16);
    const b = parseInt(hx.slice(4, 6), 16);
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null;
    return [r, g, b];
  }
  const inner = /^rgba?\s*\(([^)]*)\)$/i.exec(s);
  const body = inner && inner[1] !== undefined ? inner[1] : s;
  const parts = body
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length < 3) return null;
  const r = parseNum(parts[0] ?? '');
  const g = parseNum(parts[1] ?? '');
  const b = parseNum(parts[2] ?? '');
  if (r === null || g === null || b === null) return null;
  return [r, g, b];
}

interface Row {
  label: string;
  value: string;
}

export default function OklchConverter() {
  const [dir, setDir] = useState<Dir>('rgb-to-oklch');
  const [lPercent, setLPercent] = useState(false);
  const [rgbInput, setRgbInput] = useState('#6366f1');
  const [lStr, setL] = useState('0.55');
  const [cStr, setC] = useState('0.22');
  const [hStr, setH] = useState('277');

  const result = useMemo((): { error: string } | { rows: Row[]; swatch: string; note: string } => {
    const fmtL = (L: number): string => (lPercent ? `${(L * 100).toFixed(2)}%` : L.toFixed(4));

    if (dir === 'rgb-to-oklch') {
      const parsed = parseRgbInput(rgbInput);
      if (!parsed) return { error: 'Enter a HEX (#6366f1) or RGB (99 102 241) color.' };
      const rc = clampByte(parsed[0]);
      const gc = clampByte(parsed[1]);
      const bc = clampByte(parsed[2]);
      const rl = srgbToLinear(rc / 255);
      const gl = srgbToLinear(gc / 255);
      const bl = srgbToLinear(bc / 255);
      const lab = linearRgbToOklab(rl, gl, bl);
      const C = Math.hypot(lab.a, lab.b);
      const H = normHue((Math.atan2(lab.b, lab.a) * 180) / Math.PI);
      const hex = `#${toHexByte(rc)}${toHexByte(gc)}${toHexByte(bc)}`;
      return {
        swatch: `rgb(${rc}, ${gc}, ${bc})`,
        note: 'OKLab/OKLCH · Ottosson transform',
        rows: [
          { label: 'oklch()', value: `oklch(${fmtL(lab.L)} ${C.toFixed(4)} ${H.toFixed(2)})` },
          { label: 'oklab()', value: `oklab(${fmtL(lab.L)} ${lab.a.toFixed(4)} ${lab.b.toFixed(4)})` },
          { label: 'L', value: fmtL(lab.L) },
          { label: 'C', value: C.toFixed(4) },
          { label: 'H', value: H.toFixed(2) },
          { label: 'HEX', value: hex },
        ],
      };
    }

    let L = parseNum(lStr.endsWith('%') ? lStr.slice(0, -1) : lStr);
    const C = parseNum(cStr);
    const H = parseNum(hStr);
    if (L === null || C === null || H === null) {
      return { error: 'Enter valid L (0-1 or %), C (0+) and H (0-360) values.' };
    }
    if (lStr.trim().endsWith('%')) L /= 100;
    // If L looks like it was given as 0-100 without %, treat >1.5 as percent.
    else if (L > 1.5) L /= 100;
    const rad = (normHue(H) * Math.PI) / 180;
    const a = C * Math.cos(rad);
    const bb = C * Math.sin(rad);
    const [rl, gl, bl] = oklabToLinearRgb(L, a, bb);
    const rs = linearToSrgb(rl);
    const gs = linearToSrgb(gl);
    const bs = linearToSrgb(bl);
    const outOfGamut = [rs, gs, bs].some((v) => v < -0.0001 || v > 1.0001);
    const rc = clampByte(rs * 255);
    const gc = clampByte(gs * 255);
    const bc = clampByte(bs * 255);
    const hex = `#${toHexByte(rc)}${toHexByte(gc)}${toHexByte(bc)}`;
    return {
      swatch: `rgb(${rc}, ${gc}, ${bc})`,
      note: outOfGamut ? 'Out of sRGB gamut — clamped' : 'Within sRGB gamut',
      rows: [
        { label: 'HEX', value: hex },
        { label: 'RGB', value: `rgb(${rc}, ${gc}, ${bc})` },
        { label: 'R', value: rc.toString() },
        { label: 'G', value: gc.toString() },
        { label: 'B', value: bc.toString() },
      ],
    };
  }, [dir, lPercent, rgbInput, lStr, cStr, hStr]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Direction">
            <Tabs value={dir} onValueChange={(v) => setDir(v as Dir)}>
              <TabsList>
                <TabsTrigger value="rgb-to-oklch">RGB to OKLCH</TabsTrigger>
                <TabsTrigger value="oklch-to-rgb">OKLCH to RGB</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {dir === 'rgb-to-oklch' ? (
            <>
              <Field label="HEX or RGB" className="min-w-[220px] flex-1">
                <Input
                  value={rgbInput}
                  onChange={(e) => setRgbInput(e.target.value)}
                  placeholder="#6366f1 or 99 102 241"
                  className="font-mono"
                />
              </Field>
              <Field label="L as %">
                <Switch checked={lPercent} onCheckedChange={setLPercent} />
              </Field>
            </>
          ) : (
            <>
              <Field label="L (0-1)" className="w-28">
                <Input value={lStr} onChange={(e) => setL(e.target.value)} inputMode="decimal" />
              </Field>
              <Field label="C (0+)" className="w-28">
                <Input value={cStr} onChange={(e) => setC(e.target.value)} inputMode="decimal" />
              </Field>
              <Field label="H (0-360)" className="w-28">
                <Input value={hStr} onChange={(e) => setH(e.target.value)} inputMode="decimal" />
              </Field>
            </>
          )}
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton value={() => result.rows.map((row) => `${row.label}: ${row.value}`).join('\n')} />
          </PanelHeader>
          <div className="flex items-center gap-4 p-3">
            <div
              className="size-20 shrink-0 rounded-md border"
              style={{ backgroundColor: result.swatch }}
              aria-label="Color preview"
            />
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
              {result.rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
                >
                  <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                    {row.label}
                  </span>
                  <span className="flex min-w-0 items-center gap-2 font-mono text-xs">
                    <span className="truncate">{row.value}</span>
                    <CopyButton value={row.value} size="icon-sm" />
                  </span>
                </div>
              ))}
            </div>
          </div>
          <StatBar items={[result.note]} />
        </Panel>
      )}
    </div>
  );
}
