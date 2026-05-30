'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Dir = 'rgb-to-cmyk' | 'cmyk-to-rgb';

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}
function toHexByte(n: number): string {
  return clampByte(n).toString(16).padStart(2, '0');
}
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function parseNum(raw: string): number | null {
  const v = Number(raw.trim());
  return Number.isFinite(v) ? v : null;
}

interface Row {
  label: string;
  value: string;
}

export default function RgbToCmykConverter() {
  const [dir, setDir] = useState<Dir>('rgb-to-cmyk');
  const [r, setR] = useState('255');
  const [g, setG] = useState('99');
  const [b, setB] = useState('71');
  const [c, setC] = useState('0');
  const [m, setM] = useState('61');
  const [y, setY] = useState('72');
  const [k, setK] = useState('0');

  const result = useMemo((): { error: string } | { rows: Row[]; swatch: string } => {
    if (dir === 'rgb-to-cmyk') {
      const rv = parseNum(r);
      const gv = parseNum(g);
      const bv = parseNum(b);
      if (rv === null || gv === null || bv === null) {
        return { error: 'Enter valid R, G, B numbers (0-255).' };
      }
      const rc = clampByte(rv);
      const gc = clampByte(gv);
      const bc = clampByte(bv);
      const rp = rc / 255;
      const gp = gc / 255;
      const bp = bc / 255;
      const kk = 1 - Math.max(rp, gp, bp);
      let cc = 0;
      let mm = 0;
      let yy = 0;
      if (kk < 1) {
        cc = (1 - rp - kk) / (1 - kk);
        mm = (1 - gp - kk) / (1 - kk);
        yy = (1 - bp - kk) / (1 - kk);
      }
      const cPct = Math.round(clamp01(cc) * 100);
      const mPct = Math.round(clamp01(mm) * 100);
      const yPct = Math.round(clamp01(yy) * 100);
      const kPct = Math.round(clamp01(kk) * 100);
      const hex = `#${toHexByte(rc)}${toHexByte(gc)}${toHexByte(bc)}`;
      return {
        swatch: `rgb(${rc}, ${gc}, ${bc})`,
        rows: [
          { label: 'CMYK', value: `cmyk(${cPct}%, ${mPct}%, ${yPct}%, ${kPct}%)` },
          { label: 'C', value: `${cPct}%` },
          { label: 'M', value: `${mPct}%` },
          { label: 'Y', value: `${yPct}%` },
          { label: 'K', value: `${kPct}%` },
          { label: 'HEX', value: hex },
        ],
      };
    }

    const cv = parseNum(c);
    const mv = parseNum(m);
    const yv = parseNum(y);
    const kv = parseNum(k);
    if (cv === null || mv === null || yv === null || kv === null) {
      return { error: 'Enter valid C, M, Y, K percentages (0-100).' };
    }
    const cc = clamp01(cv / 100);
    const mm = clamp01(mv / 100);
    const yy = clamp01(yv / 100);
    const kk = clamp01(kv / 100);
    const rc = clampByte(255 * (1 - cc) * (1 - kk));
    const gc = clampByte(255 * (1 - mm) * (1 - kk));
    const bc = clampByte(255 * (1 - yy) * (1 - kk));
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
  }, [dir, r, g, b, c, m, y, k]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Direction">
            <Tabs value={dir} onValueChange={(v) => setDir(v as Dir)}>
              <TabsList>
                <TabsTrigger value="rgb-to-cmyk">RGB to CMYK</TabsTrigger>
                <TabsTrigger value="cmyk-to-rgb">CMYK to RGB</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {dir === 'rgb-to-cmyk' ? (
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
              <Field label="C (%)" className="w-20">
                <Input value={c} onChange={(e) => setC(e.target.value)} inputMode="decimal" />
              </Field>
              <Field label="M (%)" className="w-20">
                <Input value={m} onChange={(e) => setM(e.target.value)} inputMode="decimal" />
              </Field>
              <Field label="Y (%)" className="w-20">
                <Input value={y} onChange={(e) => setY(e.target.value)} inputMode="decimal" />
              </Field>
              <Field label="K (%)" className="w-20">
                <Input value={k} onChange={(e) => setK(e.target.value)} inputMode="decimal" />
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
          <StatBar items={['Uncalibrated naive conversion — no ICC profile; not press-accurate']} />
        </Panel>
      )}
    </div>
  );
}
