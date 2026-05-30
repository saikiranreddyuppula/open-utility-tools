'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Dir = 'rgb-to-lch' | 'lch-to-rgb';

const XN = 95.047;
const YN = 100.0;
const ZN = 108.883;
const DELTA = 6 / 29;

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
function fLab(t: number): number {
  return t > DELTA ** 3 ? Math.cbrt(t) : t / (3 * DELTA * DELTA) + 4 / 29;
}
function fInv(t: number): number {
  return t > DELTA ? t ** 3 : 3 * DELTA * DELTA * (t - 4 / 29);
}
function normHue(h: number): number {
  let x = h % 360;
  if (x < 0) x += 360;
  return x;
}

/** sRGB 0-255 -> CIELAB {L, a, b}. */
function rgbToLab(rc: number, gc: number, bc: number): { L: number; a: number; b: number } {
  const rl = srgbToLinear(rc / 255);
  const gl = srgbToLinear(gc / 255);
  const bl = srgbToLinear(bc / 255);
  const X = (0.4124 * rl + 0.3576 * gl + 0.1805 * bl) * 100;
  const Y = (0.2126 * rl + 0.7152 * gl + 0.0722 * bl) * 100;
  const Z = (0.0193 * rl + 0.1192 * gl + 0.9505 * bl) * 100;
  const fx = fLab(X / XN);
  const fy = fLab(Y / YN);
  const fz = fLab(Z / ZN);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** CIELAB -> sRGB 0-1 (unclamped). */
function labToRgbLinearish(L: number, a: number, b: number): [number, number, number] {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const X = XN * fInv(fx);
  const Y = YN * fInv(fy);
  const Z = ZN * fInv(fz);
  const xn = X / 100;
  const yn = Y / 100;
  const zn = Z / 100;
  const rl = 3.2406 * xn - 1.5372 * yn - 0.4986 * zn;
  const gl = -0.9689 * xn + 1.8758 * yn + 0.0415 * zn;
  const bl = 0.0557 * xn - 0.204 * yn + 1.057 * zn;
  return [linearToSrgb(rl), linearToSrgb(gl), linearToSrgb(bl)];
}

function parseNum(raw: string): number | null {
  const v = Number(raw.trim());
  return Number.isFinite(v) ? v : null;
}

interface Row {
  label: string;
  value: string;
}

export default function RgbToLchConverter() {
  const [dir, setDir] = useState<Dir>('rgb-to-lch');
  const [r, setR] = useState('99');
  const [g, setG] = useState('102');
  const [b, setB] = useState('241');
  const [lStr, setL] = useState('48.49');
  const [cStr, setC] = useState('84.51');
  const [hStr, setH] = useState('301.78');

  const result = useMemo((): { error: string } | { rows: Row[]; swatch: string; note: string } => {
    if (dir === 'rgb-to-lch') {
      const rv = parseNum(r);
      const gv = parseNum(g);
      const bv = parseNum(b);
      if (rv === null || gv === null || bv === null) {
        return { error: 'Enter valid R, G, B numbers (0-255).' };
      }
      const rc = clampByte(rv);
      const gc = clampByte(gv);
      const bc = clampByte(bv);
      const lab = rgbToLab(rc, gc, bc);
      const C = Math.hypot(lab.a, lab.b);
      const H = normHue((Math.atan2(lab.b, lab.a) * 180) / Math.PI);
      const hex = `#${toHexByte(rc)}${toHexByte(gc)}${toHexByte(bc)}`;
      return {
        swatch: `rgb(${rc}, ${gc}, ${bc})`,
        note: 'CIELCH (polar CIELAB) · D65',
        rows: [
          { label: 'LCH', value: `lch(${lab.L.toFixed(2)} ${C.toFixed(2)} ${H.toFixed(2)})` },
          { label: 'L', value: lab.L.toFixed(2) },
          { label: 'C', value: C.toFixed(2) },
          { label: 'H', value: H.toFixed(2) },
          { label: 'HEX', value: hex },
        ],
      };
    }

    const L = parseNum(lStr);
    const C = parseNum(cStr);
    const H = parseNum(hStr);
    if (L === null || C === null || H === null) {
      return { error: 'Enter valid L (0-100), C (0+) and H (0-360) values.' };
    }
    const rad = (normHue(H) * Math.PI) / 180;
    const a = C * Math.cos(rad);
    const bb = C * Math.sin(rad);
    const [rs, gs, bs] = labToRgbLinearish(L, a, bb);
    const outOfGamut = [rs, gs, bs].some((v) => v < -0.0001 || v > 1.0001);
    const rc = clampByte(rs * 255);
    const gc = clampByte(gs * 255);
    const bc = clampByte(bs * 255);
    const hex = `#${toHexByte(rc)}${toHexByte(gc)}${toHexByte(bc)}`;
    return {
      swatch: `rgb(${rc}, ${gc}, ${bc})`,
      note: outOfGamut ? 'Out of sRGB gamut — clamped' : 'Within sRGB gamut',
      rows: [
        { label: 'RGB', value: `rgb(${rc}, ${gc}, ${bc})` },
        { label: 'R', value: rc.toString() },
        { label: 'G', value: gc.toString() },
        { label: 'B', value: bc.toString() },
        { label: 'HEX', value: hex },
      ],
    };
  }, [dir, r, g, b, lStr, cStr, hStr]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Direction">
            <Tabs value={dir} onValueChange={(v) => setDir(v as Dir)}>
              <TabsList>
                <TabsTrigger value="rgb-to-lch">RGB to LCH</TabsTrigger>
                <TabsTrigger value="lch-to-rgb">LCH to RGB</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {dir === 'rgb-to-lch' ? (
            <>
              <Field label="R (0-255)" className="w-24">
                <Input value={r} onChange={(e) => setR(e.target.value)} inputMode="numeric" />
              </Field>
              <Field label="G (0-255)" className="w-24">
                <Input value={g} onChange={(e) => setG(e.target.value)} inputMode="numeric" />
              </Field>
              <Field label="B (0-255)" className="w-24">
                <Input value={b} onChange={(e) => setB(e.target.value)} inputMode="numeric" />
              </Field>
            </>
          ) : (
            <>
              <Field label="L (0-100)" className="w-28">
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
