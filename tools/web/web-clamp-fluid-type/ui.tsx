'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

function round(n: number, d = 4): number {
  return Number.parseFloat(n.toFixed(d));
}

export default function ClampFluidTypeTool() {
  const [minSize, setMinSize] = useState('16');
  const [maxSize, setMaxSize] = useState('24');
  const [minVw, setMinVw] = useState('320');
  const [maxVw, setMaxVw] = useState('1280');
  const [base, setBase] = useState('16');

  const result = useMemo(() => {
    const minS = Number(minSize);
    const maxS = Number(maxSize);
    const minW = Number(minVw);
    const maxW = Number(maxVw);
    const root = Number(base);

    for (const [v, name] of [
      [minS, 'min size'], [maxS, 'max size'], [minW, 'min viewport'], [maxW, 'max viewport'], [root, 'base rem'],
    ] as const) {
      if (!Number.isFinite(v)) return { error: `Enter a valid number for ${name}.` };
    }
    if (root <= 0) return { error: 'Base rem must be greater than zero.' };
    if (maxW === minW) return { error: 'Min and max viewport widths must differ.' };
    if (maxW < minW) return { error: 'Max viewport width must be greater than min.' };

    // slope in px-per-px; vw coefficient = slope * 100
    const slope = (maxS - minS) / (maxW - minW);
    const interceptPx = minS - slope * minW;
    const vwCoeff = slope * 100;

    const minRem = round(minS / root);
    const maxRem = round(maxS / root);
    const interceptRem = round(interceptPx / root);
    const vwRounded = round(vwCoeff, 4);

    // clamp expects lower <= upper; swap if min size > max size
    const lower = minS <= maxS ? `${minRem}rem` : `${maxRem}rem`;
    const upper = minS <= maxS ? `${maxRem}rem` : `${minRem}rem`;

    const remClamp = `font-size: clamp(${lower}, ${interceptRem}rem + ${vwRounded}vw, ${upper});`;

    const interceptPxR = round(interceptPx, 2);
    const lowerPx = minS <= maxS ? `${round(minS, 2)}px` : `${round(maxS, 2)}px`;
    const upperPx = minS <= maxS ? `${round(maxS, 2)}px` : `${round(minS, 2)}px`;
    const pxClamp = `font-size: clamp(${lowerPx}, ${interceptPxR}px + ${vwRounded}vw, ${upperPx});`;

    // Sample table at several viewport widths.
    const samples: Array<{ vw: number; px: number }> = [];
    const widths = [minW, Math.round((minW + maxW) / 2), maxW, Math.round(maxW * 1.5)];
    const seen = new Set<number>();
    for (const ww of widths) {
      if (seen.has(ww)) continue;
      seen.add(ww);
      let px = interceptPx + slope * ww;
      const clampedLow = Math.min(minS, maxS);
      const clampedHigh = Math.max(minS, maxS);
      px = Math.max(clampedLow, Math.min(clampedHigh, px));
      samples.push({ vw: ww, px: round(px, 2) });
    }

    return { remClamp, pxClamp, slope: round(slope, 6), vwCoeff: vwRounded, interceptRem, samples };
  }, [minSize, maxSize, minVw, maxVw, base]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Min size (px)">
            <Input value={minSize} onChange={(e) => setMinSize(e.target.value)} inputMode="decimal" className="w-24 font-mono" />
          </Field>
          <Field label="Max size (px)">
            <Input value={maxSize} onChange={(e) => setMaxSize(e.target.value)} inputMode="decimal" className="w-24 font-mono" />
          </Field>
          <Field label="Min viewport (px)">
            <Input value={minVw} onChange={(e) => setMinVw(e.target.value)} inputMode="decimal" className="w-28 font-mono" />
          </Field>
          <Field label="Max viewport (px)">
            <Input value={maxVw} onChange={(e) => setMaxVw(e.target.value)} inputMode="decimal" className="w-28 font-mono" />
          </Field>
          <Field label="Base rem (px)">
            <Input value={base} onChange={(e) => setBase(e.target.value)} inputMode="decimal" className="w-24 font-mono" />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error || null} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="clamp() — rem (recommended)">
              <CopyButton value={result.remClamp} />
            </PanelHeader>
            <div className="p-3">
              <code className="block break-all font-mono text-sm">{result.remClamp}</code>
            </div>
            <StatBar items={[`slope: ${result.slope}`, `vw: ${result.vwCoeff}`, `intercept: ${result.interceptRem}rem`]} />
          </Panel>

          <Panel>
            <PanelHeader title="clamp() — px variant">
              <CopyButton value={result.pxClamp} />
            </PanelHeader>
            <div className="p-3">
              <code className="block break-all font-mono text-sm">{result.pxClamp}</code>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Computed sizes by viewport" />
            <div className="divide-y">
              {result.samples.map((s) => (
                <div key={s.vw} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-40 shrink-0 text-sm text-muted-foreground">{s.vw}px viewport</span>
                  <code className="min-w-0 flex-1 font-mono text-sm">{s.px}px</code>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
