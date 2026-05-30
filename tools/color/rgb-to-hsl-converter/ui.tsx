'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Dir = 'rgb-to-hsl' | 'hsl-to-rgb';

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}
function toHexByte(n: number): string {
  return clampByte(n).toString(16).padStart(2, '0');
}
function normHue(h: number): number {
  let x = h % 360;
  if (x < 0) x += 360;
  return x;
}

/** sRGB 0-255 -> HSL (h deg, s/l in 0-1). */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const chroma = max - min;
  let s = 0;
  if (chroma !== 0) s = chroma / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (chroma === 0) {
    h = 0;
  } else if (max === rn) {
    h = ((gn - bn) / chroma) % 6;
  } else if (max === gn) {
    h = (bn - rn) / chroma + 2;
  } else {
    h = (rn - gn) / chroma + 4;
  }
  h *= 60;
  return { h: normHue(h), s, l };
}

/** HSL (h deg, s/l in 0-1) -> sRGB 0-255. */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = normHue(h) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp < 1) {
    r1 = c;
    g1 = x;
  } else if (hp < 2) {
    r1 = x;
    g1 = c;
  } else if (hp < 3) {
    g1 = c;
    b1 = x;
  } else if (hp < 4) {
    g1 = x;
    b1 = c;
  } else if (hp < 5) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }
  const m = l - c / 2;
  return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255];
}

function parseNum(raw: string): number | null {
  const v = Number(raw.trim());
  return Number.isFinite(v) ? v : null;
}

interface Row {
  label: string;
  value: string;
}

export default function RgbToHslConverter() {
  const [dir, setDir] = useState<Dir>('rgb-to-hsl');
  const [decimals, setDecimals] = useState(false);
  const [percent, setPercent] = useState(true);
  // RGB inputs
  const [r, setR] = useState('255');
  const [g, setG] = useState('99');
  const [b, setB] = useState('71');
  // HSL inputs
  const [h, setH] = useState('9');
  const [s, setS] = useState('100');
  const [l, setL] = useState('64');

  const result = useMemo((): { error: string } | { rows: Row[]; swatch: string } => {
    const fmt = (n: number): string => {
      const fixed = decimals ? Number(n.toFixed(1)) : Math.round(n);
      return fixed.toString();
    };
    const fmtSL = (frac: number): string => {
      if (percent) return `${fmt(frac * 100)}%`;
      const v = decimals ? Number(frac.toFixed(3)) : Number(frac.toFixed(2));
      return v.toString();
    };

    if (dir === 'rgb-to-hsl') {
      const rv = parseNum(r);
      const gv = parseNum(g);
      const bv = parseNum(b);
      if (rv === null || gv === null || bv === null) {
        return { error: 'Enter valid R, G, B numbers (0-255).' };
      }
      const rc = clampByte(rv);
      const gc = clampByte(gv);
      const bc = clampByte(bv);
      const hsl = rgbToHsl(rc, gc, bc);
      const swatch = `rgb(${rc}, ${gc}, ${bc})`;
      const hex = `#${toHexByte(rc)}${toHexByte(gc)}${toHexByte(bc)}`;
      return {
        swatch,
        rows: [
          { label: 'HSL', value: `hsl(${fmt(hsl.h)}, ${fmtSL(hsl.s)}, ${fmtSL(hsl.l)})` },
          { label: 'H', value: fmt(hsl.h) },
          { label: 'S', value: fmtSL(hsl.s) },
          { label: 'L', value: fmtSL(hsl.l) },
          { label: 'HEX', value: hex },
        ],
      };
    }

    const hv = parseNum(h);
    let sv = parseNum(s);
    let lv = parseNum(l);
    if (hv === null || sv === null || lv === null) {
      return { error: 'Enter valid H (0-360), S and L values.' };
    }
    // Accept S/L as percent (0-100) or fraction (0-1).
    if (sv > 1) sv /= 100;
    if (lv > 1) lv /= 100;
    sv = Math.max(0, Math.min(1, sv));
    lv = Math.max(0, Math.min(1, lv));
    const [rr, gg, bb] = hslToRgb(hv, sv, lv);
    const rc = clampByte(rr);
    const gc = clampByte(gg);
    const bc = clampByte(bb);
    const hex = `#${toHexByte(rc)}${toHexByte(gc)}${toHexByte(bc)}`;
    return {
      swatch: `rgb(${rc}, ${gc}, ${bc})`,
      rows: [
        { label: 'RGB', value: `rgb(${rc}, ${gc}, ${bc})` },
        { label: 'R', value: rc.toString() },
        { label: 'G', value: gc.toString() },
        { label: 'B', value: bc.toString() },
        { label: 'HEX', value: hex },
      ],
    };
  }, [dir, decimals, percent, r, g, b, h, s, l]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Direction">
            <Tabs value={dir} onValueChange={(v) => setDir(v as Dir)}>
              <TabsList>
                <TabsTrigger value="rgb-to-hsl">RGB to HSL</TabsTrigger>
                <TabsTrigger value="hsl-to-rgb">HSL to RGB</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {dir === 'rgb-to-hsl' ? (
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
              <Field label="H (0-360)" className="w-24">
                <Input value={h} onChange={(e) => setH(e.target.value)} inputMode="decimal" />
              </Field>
              <Field label="S (0-100%)" className="w-24">
                <Input value={s} onChange={(e) => setS(e.target.value)} inputMode="decimal" />
              </Field>
              <Field label="L (0-100%)" className="w-24">
                <Input value={l} onChange={(e) => setL(e.target.value)} inputMode="decimal" />
              </Field>
            </>
          )}
          <Field label="1 decimal">
            <Switch checked={decimals} onCheckedChange={setDecimals} />
          </Field>
          <Field label="S/L as %">
            <Switch checked={percent} onCheckedChange={setPercent} />
          </Field>
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
          <StatBar items={[dir === 'rgb-to-hsl' ? 'sRGB to HSL' : 'HSL to sRGB']} />
        </Panel>
      )}
    </div>
  );
}
