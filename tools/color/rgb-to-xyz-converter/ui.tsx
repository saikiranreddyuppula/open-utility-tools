'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Dir = 'rgb-to-xyz' | 'xyz-to-rgb';

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}
function toHexByte(n: number): string {
  return clampByte(n).toString(16).padStart(2, '0');
}

/** sRGB inverse gamma (companded 0-1 -> linear 0-1). */
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
/** linear 0-1 -> sRGB companded 0-1. */
function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function parseNum(raw: string): number | null {
  const v = Number(raw.trim());
  return Number.isFinite(v) ? v : null;
}

interface Row {
  label: string;
  value: string;
}

export default function RgbToXyzConverter() {
  const [dir, setDir] = useState<Dir>('rgb-to-xyz');
  const [r, setR] = useState('99');
  const [g, setG] = useState('102');
  const [b, setB] = useState('241');
  const [x, setX] = useState('22.7383');
  const [y, setY] = useState('17.8009');
  const [z, setZ] = useState('86.1112');

  const result = useMemo((): { error: string } | { rows: Row[]; swatch: string; note: string } => {
    if (dir === 'rgb-to-xyz') {
      const rv = parseNum(r);
      const gv = parseNum(g);
      const bv = parseNum(b);
      if (rv === null || gv === null || bv === null) {
        return { error: 'Enter valid R, G, B numbers (0-255).' };
      }
      const rc = clampByte(rv);
      const gc = clampByte(gv);
      const bc = clampByte(bv);
      const rl = srgbToLinear(rc / 255);
      const gl = srgbToLinear(gc / 255);
      const bl = srgbToLinear(bc / 255);
      // sRGB D65 -> XYZ, scaled to 0-100.
      const xv = (0.4124 * rl + 0.3576 * gl + 0.1805 * bl) * 100;
      const yv = (0.2126 * rl + 0.7152 * gl + 0.0722 * bl) * 100;
      const zv = (0.0193 * rl + 0.1192 * gl + 0.9505 * bl) * 100;
      const hex = `#${toHexByte(rc)}${toHexByte(gc)}${toHexByte(bc)}`;
      return {
        swatch: `rgb(${rc}, ${gc}, ${bc})`,
        note: 'sRGB · D65 · scaled 0-100',
        rows: [
          { label: 'XYZ', value: `${xv.toFixed(4)}, ${yv.toFixed(4)}, ${zv.toFixed(4)}` },
          { label: 'X', value: xv.toFixed(4) },
          { label: 'Y', value: yv.toFixed(4) },
          { label: 'Z', value: zv.toFixed(4) },
          { label: 'HEX', value: hex },
        ],
      };
    }

    const xv = parseNum(x);
    const yv = parseNum(y);
    const zv = parseNum(z);
    if (xv === null || yv === null || zv === null) {
      return { error: 'Enter valid X, Y, Z numbers (0-100 scale).' };
    }
    const xn = xv / 100;
    const yn = yv / 100;
    const zn = zv / 100;
    // Inverse sRGB D65 matrix.
    const rl = 3.2406 * xn - 1.5372 * yn - 0.4986 * zn;
    const gl = -0.9689 * xn + 1.8758 * yn + 0.0415 * zn;
    const bl = 0.0557 * xn - 0.204 * yn + 1.057 * zn;
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
        { label: 'RGB', value: `rgb(${rc}, ${gc}, ${bc})` },
        { label: 'R', value: rc.toString() },
        { label: 'G', value: gc.toString() },
        { label: 'B', value: bc.toString() },
        { label: 'HEX', value: hex },
      ],
    };
  }, [dir, r, g, b, x, y, z]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Direction">
            <Tabs value={dir} onValueChange={(v) => setDir(v as Dir)}>
              <TabsList>
                <TabsTrigger value="rgb-to-xyz">RGB to XYZ</TabsTrigger>
                <TabsTrigger value="xyz-to-rgb">XYZ to RGB</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {dir === 'rgb-to-xyz' ? (
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
              <Field label="X" className="w-28">
                <Input value={x} onChange={(e) => setX(e.target.value)} inputMode="decimal" />
              </Field>
              <Field label="Y" className="w-28">
                <Input value={y} onChange={(e) => setY(e.target.value)} inputMode="decimal" />
              </Field>
              <Field label="Z" className="w-28">
                <Input value={z} onChange={(e) => setZ(e.target.value)} inputMode="decimal" />
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
