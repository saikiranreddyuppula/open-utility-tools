'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Dir = 'rgb-to-hwb' | 'hwb-to-rgb';

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

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const chroma = max - min;
  const v = max;
  const s = max === 0 ? 0 : chroma / max;
  let h = 0;
  if (chroma === 0) h = 0;
  else if (max === rn) h = ((gn - bn) / chroma) % 6;
  else if (max === gn) h = (bn - rn) / chroma + 2;
  else h = (rn - gn) / chroma + 4;
  h *= 60;
  return { h: normHue(h), s, v };
}

/** Pure hue color at full saturation/value as RGB 0-1 triple. */
function hueToRgb(h: number): [number, number, number] {
  const hp = normHue(h) / 60;
  const x = 1 - Math.abs((hp % 2) - 1);
  if (hp < 1) return [1, x, 0];
  if (hp < 2) return [x, 1, 0];
  if (hp < 3) return [0, 1, x];
  if (hp < 4) return [0, x, 1];
  if (hp < 5) return [x, 0, 1];
  return [1, 0, x];
}

function parseNum(raw: string): number | null {
  const v = Number(raw.trim());
  return Number.isFinite(v) ? v : null;
}

interface Row {
  label: string;
  value: string;
}

export default function RgbToHwbConverter() {
  const [dir, setDir] = useState<Dir>('rgb-to-hwb');
  const [r, setR] = useState('255');
  const [g, setG] = useState('99');
  const [b, setB] = useState('71');
  const [h, setH] = useState('9');
  const [w, setW] = useState('28');
  const [bl, setBl] = useState('0');

  const result = useMemo((): { error: string } | { rows: Row[]; swatch: string; note: string } => {
    if (dir === 'rgb-to-hwb') {
      const rv = parseNum(r);
      const gv = parseNum(g);
      const bv = parseNum(b);
      if (rv === null || gv === null || bv === null) {
        return { error: 'Enter valid R, G, B numbers (0-255).' };
      }
      const rc = clampByte(rv);
      const gc = clampByte(gv);
      const bc = clampByte(bv);
      const hsv = rgbToHsv(rc, gc, bc);
      const whiteness = (1 - hsv.s) * hsv.v;
      const blackness = 1 - hsv.v;
      const hr = Math.round(hsv.h);
      const wr = Math.round(whiteness * 100);
      const br = Math.round(blackness * 100);
      const hex = `#${toHexByte(rc)}${toHexByte(gc)}${toHexByte(bc)}`;
      return {
        swatch: `rgb(${rc}, ${gc}, ${bc})`,
        note: 'W + B = ' + (wr + br) + '%',
        rows: [
          { label: 'HWB', value: `hwb(${hr} ${wr}% ${br}%)` },
          { label: 'H', value: `${hr}` },
          { label: 'W', value: `${wr}%` },
          { label: 'B', value: `${br}%` },
          { label: 'HEX', value: hex },
        ],
      };
    }

    const hv = parseNum(h);
    let wv = parseNum(w);
    let bv2 = parseNum(bl);
    if (hv === null || wv === null || bv2 === null) {
      return { error: 'Enter valid H (0-360), Whiteness and Blackness (0-100%).' };
    }
    if (wv > 1) wv /= 100;
    if (bv2 > 1) bv2 /= 100;
    wv = Math.max(0, Math.min(1, wv));
    bv2 = Math.max(0, Math.min(1, bv2));

    let note: string;
    let rgb: [number, number, number];
    const sum = wv + bv2;
    if (sum >= 1) {
      const gray = wv / sum;
      rgb = [gray, gray, gray];
      note = sum > 1 ? `W + B normalized (sum ${Math.round(sum * 100)}% -> gray)` : 'W + B = 100% -> gray';
    } else {
      const pure = hueToRgb(hv);
      rgb = [
        pure[0] * (1 - wv - bv2) + wv,
        pure[1] * (1 - wv - bv2) + wv,
        pure[2] * (1 - wv - bv2) + wv,
      ];
      note = `W + B = ${Math.round(sum * 100)}%`;
    }
    const rc = clampByte(rgb[0] * 255);
    const gc = clampByte(rgb[1] * 255);
    const bc = clampByte(rgb[2] * 255);
    const hex = `#${toHexByte(rc)}${toHexByte(gc)}${toHexByte(bc)}`;
    return {
      swatch: `rgb(${rc}, ${gc}, ${bc})`,
      note,
      rows: [
        { label: 'RGB', value: `rgb(${rc}, ${gc}, ${bc})` },
        { label: 'R', value: rc.toString() },
        { label: 'G', value: gc.toString() },
        { label: 'B', value: bc.toString() },
        { label: 'HEX', value: hex },
      ],
    };
  }, [dir, r, g, b, h, w, bl]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Direction">
            <Tabs value={dir} onValueChange={(v) => setDir(v as Dir)}>
              <TabsList>
                <TabsTrigger value="rgb-to-hwb">RGB to HWB</TabsTrigger>
                <TabsTrigger value="hwb-to-rgb">HWB to RGB</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {dir === 'rgb-to-hwb' ? (
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
              <Field label="W (0-100%)" className="w-24">
                <Input value={w} onChange={(e) => setW(e.target.value)} inputMode="decimal" />
              </Field>
              <Field label="B (0-100%)" className="w-24">
                <Input value={bl} onChange={(e) => setBl(e.target.value)} inputMode="decimal" />
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
