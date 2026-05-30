'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

type RGB = { r: number; g: number; b: number };
type Lab = { L: number; a: number; b: number };

function parseColor(input: string): RGB | null {
  let s = input.trim().toLowerCase();
  const rgbMatch = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(input.trim());
  if (rgbMatch) {
    const r = Number(rgbMatch[1]);
    const g = Number(rgbMatch[2]);
    const b = Number(rgbMatch[3]);
    if ([r, g, b].every((v) => Number.isFinite(v) && v >= 0 && v <= 255)) {
      return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
    }
    return null;
  }
  if (s.startsWith('#')) s = s.slice(1);
  if (s.length === 3) {
    const r = s[0]; const g = s[1]; const b = s[2];
    if (r === undefined || g === undefined || b === undefined) return null;
    s = `${r}${r}${g}${g}${b}${b}`;
  }
  if (s.length !== 6 || !/^[0-9a-f]{6}$/.test(s)) return null;
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }: RGB): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function rgbToLab({ r, g, b }: RGB): Lab {
  const lin = (c: number) => {
    const cs = c / 255;
    return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  };
  const rl = lin(r), gl = lin(g), bl = lin(b);
  // sRGB -> XYZ (D65)
  let x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
  let y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175;
  let z = rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041;
  // Normalize by D65 white
  x /= 0.95047; y /= 1.0; z /= 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

function deltaE76(a: Lab, b: Lab): number {
  return Math.sqrt((a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
}

function deltaE94(a: Lab, b: Lab): number {
  const dL = a.L - b.L;
  const C1 = Math.sqrt(a.a ** 2 + a.b ** 2);
  const C2 = Math.sqrt(b.a ** 2 + b.b ** 2);
  const dC = C1 - C2;
  const da = a.a - b.a;
  const db = a.b - b.b;
  const dHsq = da ** 2 + db ** 2 - dC ** 2;
  const dH = dHsq > 0 ? Math.sqrt(dHsq) : 0;
  const kL = 1, k1 = 0.045, k2 = 0.015;
  const sL = 1;
  const sC = 1 + k1 * C1;
  const sH = 1 + k2 * C1;
  return Math.sqrt((dL / (kL * sL)) ** 2 + (dC / sC) ** 2 + (dH / sH) ** 2);
}

function deltaE2000(lab1: Lab, lab2: Lab): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const deg = (r: number) => (r * 180) / Math.PI;
  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;
  const C1 = Math.sqrt(a1 ** 2 + b1 ** 2);
  const C2 = Math.sqrt(a2 ** 2 + b2 ** 2);
  const Cbar = (C1 + C2) / 2;
  const Cbar7 = Cbar ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.sqrt(a1p ** 2 + b1 ** 2);
  const C2p = Math.sqrt(a2p ** 2 + b2 ** 2);
  const h1p = (() => { let h = deg(Math.atan2(b1, a1p)); if (h < 0) h += 360; return h; })();
  const h2p = (() => { let h = deg(Math.atan2(b2, a2p)); if (h < 0) h += 360; return h; })();
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    const diff = h2p - h1p;
    if (Math.abs(diff) <= 180) dhp = diff;
    else if (diff > 180) dhp = diff - 360;
    else dhp = diff + 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp) / 2);
  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;
  let hbarp: number;
  if (C1p * C2p === 0) hbarp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbarp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hbarp = (h1p + h2p + 360) / 2;
  else hbarp = (h1p + h2p - 360) / 2;
  const T =
    1 -
    0.17 * Math.cos(rad(hbarp - 30)) +
    0.24 * Math.cos(rad(2 * hbarp)) +
    0.32 * Math.cos(rad(3 * hbarp + 6)) -
    0.2 * Math.cos(rad(4 * hbarp - 63));
  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const Cbarp7 = Cbarp ** 7;
  const Rc = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbarp - 50) ** 2) / Math.sqrt(20 + (Lbarp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc;
  const kL = 1, kC = 1, kH = 1;
  return Math.sqrt(
    (dLp / (kL * Sl)) ** 2 +
      (dCp / (kC * Sc)) ** 2 +
      (dHp / (kH * Sh)) ** 2 +
      Rt * (dCp / (kC * Sc)) * (dHp / (kH * Sh))
  );
}

function interpret(de: number): string {
  if (de < 1) return 'Not perceptible by the human eye';
  if (de < 2) return 'Perceptible through close inspection';
  if (de <= 10) return 'Perceptible at a glance';
  if (de <= 49) return 'Colors are more similar than opposite';
  return 'Colors are exact opposites';
}

export default function DeltaETool() {
  const [c1, setC1] = useState('#ff6b6b');
  const [c2, setC2] = useState('#ee5253');

  const result = useMemo(() => {
    const a = parseColor(c1);
    const b = parseColor(c2);
    if (!a) return { error: 'Color 1 is invalid (use #hex or rgb()).' };
    if (!b) return { error: 'Color 2 is invalid (use #hex or rgb()).' };
    const la = rgbToLab(a);
    const lb = rgbToLab(b);
    const de76 = deltaE76(la, lb);
    const de94 = deltaE94(la, lb);
    const de2000 = deltaE2000(la, lb);
    return { a, b, la, lb, de76, de94, de2000 };
  }, [c1, c2]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Color 1" className="min-w-[180px]">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={parseColor(c1) ? toHex(parseColor(c1) as RGB) : '#ff6b6b'}
                onChange={(e) => setC1(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-md border p-1"
                aria-label="Color 1"
              />
              <Input value={c1} onChange={(e) => setC1(e.target.value)} className="font-mono" />
            </div>
          </Field>
          <Field label="Color 2" className="min-w-[180px]">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={parseColor(c2) ? toHex(parseColor(c2) as RGB) : '#ee5253'}
                onChange={(e) => setC2(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-md border p-1"
                aria-label="Color 2"
              />
              <Input value={c2} onChange={(e) => setC2(e.target.value)} className="font-mono" />
            </div>
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col items-center gap-1 rounded-md border p-3">
              <div className="h-16 w-full rounded" style={{ backgroundColor: toHex(result.a) }} />
              <span className="font-mono text-xs">L {result.la.L.toFixed(2)} a {result.la.a.toFixed(2)} b {result.la.b.toFixed(2)}</span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-md border p-3">
              <div className="h-16 w-full rounded" style={{ backgroundColor: toHex(result.b) }} />
              <span className="font-mono text-xs">L {result.lb.L.toFixed(2)} a {result.lb.a.toFixed(2)} b {result.lb.b.toFixed(2)}</span>
            </div>
          </div>

          <Panel>
            <PanelHeader title="Delta-E">
              <CopyButton
                value={() =>
                  `CIE76: ${result.de76.toFixed(3)}\nCIE94: ${result.de94.toFixed(3)}\nCIEDE2000: ${result.de2000.toFixed(3)}`
                }
              />
            </PanelHeader>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
              {([
                ['CIE76', result.de76],
                ['CIE94', result.de94],
                ['CIEDE2000', result.de2000],
              ] as const).map(([label, val]) => (
                <div key={label} className="flex flex-col items-center gap-1 rounded-md border bg-muted/30 px-3 py-3">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="flex items-center gap-2 font-mono text-xl font-semibold tabular">
                    {val.toFixed(3)}
                    <CopyButton value={val.toFixed(3)} size="icon-sm" />
                  </span>
                </div>
              ))}
            </div>
            <div className="px-3 pb-3 text-sm text-muted-foreground">
              CIEDE2000: {interpret(result.de2000)}.
            </div>
          </Panel>

          <StatBar
            items={[
              `ΔE76 ${result.de76.toFixed(2)}`,
              `ΔE94 ${result.de94.toFixed(2)}`,
              `ΔE2000 ${result.de2000.toFixed(2)}`,
            ]}
          />
        </>
      )}
    </div>
  );
}
