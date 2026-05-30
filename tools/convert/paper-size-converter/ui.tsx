'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface PaperSize {
  name: string;
  series: string;
  // Portrait dimensions in millimeters: width (short side) x height (long side).
  wMm: number;
  hMm: number;
}

// ISO 216 base widths (mm, portrait) at index 0; each higher index halves the
// longer side. We derive sizes 0..10 by repeated halving with rounding-down
// per the ISO 216 rule (round down to whole millimeters).
function buildSeries(series: string, w0: number, h0: number): PaperSize[] {
  const out: PaperSize[] = [];
  let w = w0;
  let h = h0;
  for (let i = 0; i <= 10; i++) {
    out.push({ name: `${series}${i}`, series, wMm: w, hMm: h });
    // Next size: long side becomes (current short side), short side halves the long side.
    const nextW = Math.floor(h / 2);
    const nextH = w;
    w = nextW;
    h = nextH;
  }
  return out;
}

const ISO: PaperSize[] = [
  ...buildSeries('A', 841, 1189),
  ...buildSeries('B', 1000, 1414),
  ...buildSeries('C', 917, 1297),
];

// North American sizes in inches (portrait), converted to mm.
const NA_IN: { name: string; series: string; wIn: number; hIn: number }[] = [
  { name: 'Letter', series: 'US', wIn: 8.5, hIn: 11 },
  { name: 'Legal', series: 'US', wIn: 8.5, hIn: 14 },
  { name: 'Executive', series: 'US', wIn: 7.25, hIn: 10.5 },
  { name: 'Tabloid', series: 'US', wIn: 11, hIn: 17 },
  { name: 'Ledger', series: 'US', wIn: 11, hIn: 17 },
];

const NA: PaperSize[] = NA_IN.map((p) => ({
  name: p.name,
  series: p.series,
  wMm: Math.round(p.wIn * 25.4 * 100) / 100,
  hMm: Math.round(p.hIn * 25.4 * 100) / 100,
}));

const ALL: PaperSize[] = [...ISO, ...NA];

function round(n: number, dp: number): string {
  const f = 10 ** dp;
  const r = Math.round(n * f) / f;
  return dp === 0 ? r.toFixed(0) : r.toFixed(dp).replace(/\.?0+$/, '');
}

export default function PaperSizeConverterTool() {
  const [q, setQ] = useState('');
  const [dpiRaw, setDpiRaw] = useState('300');
  const [orient, setOrient] = useState<'portrait' | 'landscape'>('portrait');

  const dpi = useMemo(() => {
    const v = Number(dpiRaw.trim());
    if (!Number.isFinite(v) || v <= 0) return 300;
    return v;
  }, [dpiRaw]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const filtered = s
      ? ALL.filter((p) => `${p.name} ${p.series}`.toLowerCase().includes(s))
      : ALL;
    return filtered.map((p) => {
      const w = orient === 'portrait' ? p.wMm : p.hMm;
      const h = orient === 'portrait' ? p.hMm : p.wMm;
      const wIn = w / 25.4;
      const hIn = h / 25.4;
      return {
        name: p.name,
        mm: `${round(w, 0)} × ${round(h, 0)}`,
        cm: `${round(w / 10, 2)} × ${round(h / 10, 2)}`,
        inch: `${round(wIn, 2)} × ${round(hIn, 2)}`,
        pt: `${round((w * 72) / 25.4, 1)} × ${round((h * 72) / 25.4, 1)}`,
        px: `${Math.round(wIn * dpi)} × ${Math.round(hIn * dpi)}`,
      };
    });
  }, [q, dpi, orient]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Filter" className="min-w-[12rem] flex-1">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="A4, B5, Letter, US…"
            />
          </Field>
          <Field label="DPI" hint="For pixel column" className="min-w-[7rem]">
            <Input
              type="text"
              inputMode="numeric"
              value={dpiRaw}
              onChange={(e) => setDpiRaw(e.target.value)}
              placeholder="300"
            />
          </Field>
          <Field label="Orientation" className="min-w-[12rem]">
            <Tabs value={orient} onValueChange={(v) => setOrient(v as 'portrait' | 'landscape')}>
              <TabsList>
                <TabsTrigger value="portrait">Portrait</TabsTrigger>
                <TabsTrigger value="landscape">Landscape</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Paper sizes">
          <CopyButton
            value={() =>
              rows
                .map((r) => `${r.name}: ${r.mm} mm | ${r.inch} in | ${r.px} px @ ${dpi}dpi`)
                .join('\n')
            }
          />
        </PanelHeader>
        <div className="overflow-x-auto">
          <div className="grid min-w-[46rem] grid-cols-[5rem_1.2fr_1.2fr_1.2fr_1.2fr_1.3fr] gap-x-3 border-b bg-muted/40 px-3 py-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Size</span>
            <span>mm</span>
            <span>cm</span>
            <span>inches</span>
            <span>points</span>
            <span>px @ {dpi}dpi</span>
          </div>
          <div className="max-h-[480px] divide-y overflow-auto">
            {rows.map((r) => (
              <div
                key={r.name}
                className="grid min-w-[46rem] grid-cols-[5rem_1.2fr_1.2fr_1.2fr_1.2fr_1.3fr] items-center gap-x-3 px-3 py-2 text-sm"
              >
                <code className="font-mono text-xs font-semibold">{r.name}</code>
                <span className="font-mono text-xs">{r.mm}</span>
                <span className="font-mono text-xs">{r.cm}</span>
                <span className="font-mono text-xs">{r.inch}</span>
                <span className="font-mono text-xs">{r.pt}</span>
                <span className="font-mono text-xs">{r.px}</span>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No paper sizes match your filter.
              </div>
            )}
          </div>
        </div>
        <StatBar
          items={[
            `${rows.length} of ${ALL.length}`,
            `${orient} · ${dpi} DPI`,
            'ISO 216 derived · computed offline',
          ]}
        />
      </Panel>
    </div>
  );
}
