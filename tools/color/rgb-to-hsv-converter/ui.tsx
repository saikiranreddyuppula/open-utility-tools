'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Dir = 'rgb-to-hsv' | 'hsv-to-rgb';

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

/** sRGB 0-255 -> HSV (h deg, s/v in 0-1). */
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
  return { h: normHue(h), s, v };
}

/** HSV (h deg, s/v in 0-1) -> sRGB 0-255. */
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const hp = normHue(h) / 60;
  const c = v * s;
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
  const m = v - c;
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

export default function RgbToHsvConverter() {
  const [dir, setDir] = useState<Dir>('rgb-to-hsv');
  const [useHsb, setUseHsb] = useState(false);
  const [r, setR] = useState('255');
  const [g, setG] = useState('99');
  const [b, setB] = useState('71');
  const [h, setH] = useState('9');
  const [s, setS] = useState('100');
  const [v, setV] = useState('100');

  const term = useHsb ? 'HSB' : 'HSV';
  const lastLabel = useHsb ? 'B' : 'V';

  const result = useMemo((): { error: string } | { rows: Row[]; swatch: string } => {
    if (dir === 'rgb-to-hsv') {
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
      const hr = Math.round(hsv.h);
      const sr = Math.round(hsv.s * 100);
      const vr = Math.round(hsv.v * 100);
      const hex = `#${toHexByte(rc)}${toHexByte(gc)}${toHexByte(bc)}`;
      return {
        swatch: `rgb(${rc}, ${gc}, ${bc})`,
        rows: [
          { label: term, value: `${term.toLowerCase()}(${hr}, ${sr}%, ${vr}%)` },
          { label: 'H', value: `${hr}` },
          { label: 'S', value: `${sr}%` },
          { label: lastLabel, value: `${vr}%` },
          { label: 'HEX', value: hex },
        ],
      };
    }

    const hv = parseNum(h);
    let sv = parseNum(s);
    let vv = parseNum(v);
    if (hv === null || sv === null || vv === null) {
      return { error: `Enter valid H (0-360), S and ${lastLabel} values.` };
    }
    if (sv > 1) sv /= 100;
    if (vv > 1) vv /= 100;
    sv = Math.max(0, Math.min(1, sv));
    vv = Math.max(0, Math.min(1, vv));
    const [rr, gg, bb] = hsvToRgb(hv, sv, vv);
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
  }, [dir, term, lastLabel, r, g, b, h, s, v]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Direction">
            <Tabs value={dir} onValueChange={(x) => setDir(x as Dir)}>
              <TabsList>
                <TabsTrigger value="rgb-to-hsv">RGB to {term}</TabsTrigger>
                <TabsTrigger value="hsv-to-rgb">{term} to RGB</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {dir === 'rgb-to-hsv' ? (
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
              <Field label={`${lastLabel} (0-100%)`} className="w-24">
                <Input value={v} onChange={(e) => setV(e.target.value)} inputMode="decimal" />
              </Field>
            </>
          )}
          <Field label="Use HSB term">
            <Switch checked={useHsb} onCheckedChange={setUseHsb} />
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
          <StatBar items={[`HSV and HSB use identical math; only the label differs`]} />
        </Panel>
      )}
    </div>
  );
}
