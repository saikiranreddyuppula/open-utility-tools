'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'toZ' | 'toValue';

// Abramowitz & Stegun 7.1.26 approximation of erf(x).
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

// Standard normal CDF: probability a standard-normal value is below z.
function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export default function ZScoreTool() {
  const [mode, setMode] = useState<Mode>('toZ');
  const [x, setX] = useState('130');
  const [mean, setMean] = useState('100');
  const [sd, setSd] = useState('15');
  const [z, setZ] = useState('2');

  const result = useMemo(() => {
    const mu = Number(mean.trim());
    const sigma = Number(sd.trim());
    if (!Number.isFinite(mu)) return { error: 'Enter a valid mean (μ).' as string };
    if (!Number.isFinite(sigma)) return { error: 'Enter a valid standard deviation (σ).' };
    if (sigma <= 0) return { error: 'Standard deviation must be greater than zero.' };

    let zVal: number;
    let rawVal: number;
    if (mode === 'toZ') {
      const raw = Number(x.trim());
      if (!Number.isFinite(raw)) return { error: 'Enter a valid raw value x.' };
      rawVal = raw;
      zVal = (raw - mu) / sigma;
    } else {
      const zz = Number(z.trim());
      if (!Number.isFinite(zz)) return { error: 'Enter a valid z-score.' };
      zVal = zz;
      rawVal = mu + zz * sigma;
    }

    const below = normalCdf(zVal);
    const above = 1 - below;
    return { zVal, rawVal, below, above, mode };
  }, [mode, x, mean, sd, z]);

  const f4 = (n: number) => (Math.round(n * 1e4) / 1e4).toString();
  const pct = (p: number) => `${(p * 100).toFixed(2)}%`;

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Mode" className="min-w-[240px]">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="toZ">Value → z</TabsTrigger>
                <TabsTrigger value="toValue">z → Value</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Mean (μ)">
            <Input value={mean} onChange={(e) => setMean(e.target.value)} inputMode="decimal" className="w-24 font-mono" />
          </Field>
          <Field label="Std dev (σ)">
            <Input value={sd} onChange={(e) => setSd(e.target.value)} inputMode="decimal" className="w-24 font-mono" />
          </Field>
          {mode === 'toZ' ? (
            <Field label="Raw value (x)">
              <Input value={x} onChange={(e) => setX(e.target.value)} inputMode="decimal" className="w-24 font-mono" />
            </Field>
          ) : (
            <Field label="Z-score (z)">
              <Input value={z} onChange={(e) => setZ(e.target.value)} inputMode="decimal" className="w-24 font-mono" />
            </Field>
          )}
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton
              value={() =>
                [
                  `z = ${f4(result.zVal)}`,
                  `x = ${f4(result.rawVal)}`,
                  `Percentile (below) = ${pct(result.below)}`,
                  `Probability above = ${pct(result.above)}`,
                ].join('\n')
              }
            />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {[
              { label: result.mode === 'toZ' ? 'Z-score' : 'Z-score (input)', value: f4(result.zVal) },
              { label: result.mode === 'toValue' ? 'Raw value x' : 'Raw value (input)', value: f4(result.rawVal) },
              { label: 'Percentile (P below)', value: pct(result.below) },
              { label: 'Probability above', value: pct(result.above) },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span>{row.value}</span>
                  <CopyButton value={row.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar
            items={[
              `z = ${f4(result.zVal)}`,
              `P(X < x) = ${pct(result.below)}`,
              `P(X > x) = ${pct(result.above)}`,
              'CDF via Abramowitz-Stegun erf',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
