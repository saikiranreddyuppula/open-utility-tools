'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X, Sparkles } from 'lucide-react';
import { Panel, PanelHeader, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  betaMean,
  betaPdf,
  betaSd,
  compare,
  computeSampleSize,
  fmtP,
  fmtPct,
  fmtSigned,
  niceTicks,
  parseCount,
  wilson,
  zTwoSided,
  type Comparison,
  type SampleSizeResult,
} from './logic';

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

const VARIANT_COLORS = ['var(--muted-foreground)', 'var(--primary)', 'var(--cat-image)', 'var(--cat-text)'];

interface VariantInput {
  name: string;
  visitors: string;
  conversions: string;
}

const SAMPLE: VariantInput[] = [
  { name: 'A', visitors: '4820', conversions: '391' },
  { name: 'B', visitors: '4790', conversions: '452' },
];

function fmtInt(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString('en-US') : '—';
}

function useContainerWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(560);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setW(Math.max(260, Math.floor(el.getBoundingClientRect().width)));
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function Metric({
  label,
  children,
  sub,
}: {
  label: string;
  children: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2">
      <div className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-sm tabular-nums">{children}</div>
      {sub && <div className="mt-0.5 font-mono text-2xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Charts                                                              */
/* ------------------------------------------------------------------ */

interface ChartVariant {
  name: string;
  x: number;
  n: number;
}

function CIChart({ variants, confidence }: { variants: ChartVariant[]; confidence: number }) {
  const [ref, width] = useContainerWidth();
  const z = zTwoSided(confidence);
  const rows = variants.map((v) => ({ ...v, p: v.x / v.n, ci: wilson(v.x, v.n, z) }));
  const lo = Math.max(0, Math.min(...rows.map((r) => r.ci.lo)) - 0.002);
  const hi = Math.min(1, Math.max(...rows.map((r) => r.ci.hi)) + 0.002);
  const rowH = 46;
  const m = { l: 56, r: 130, t: 8, b: 28 };
  const height = m.t + m.b + rows.length * rowH;
  const iw = Math.max(80, width - m.l - m.r);
  const sx = (v: number) => m.l + ((v - lo) / (hi - lo || 1)) * iw;
  const ticks = niceTicks(lo, hi, Math.max(3, Math.floor(iw / 90)));
  return (
    <div ref={ref} className="w-full">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Conversion rates with Wilson confidence intervals"
        style={{ color: 'var(--muted-foreground)' }}
        className="block select-none"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={sx(t)} x2={sx(t)} y1={m.t} y2={height - m.b} stroke="currentColor" strokeOpacity={0.15} />
            <text x={sx(t)} y={height - m.b + 14} textAnchor="middle" fontSize={10} fill="currentColor">
              {fmtPct(t, t < 0.1 ? 1 : 0)}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const y = m.t + i * rowH + rowH / 2;
          const color = VARIANT_COLORS[i % VARIANT_COLORS.length] ?? 'currentColor';
          return (
            <g key={r.name + i}>
              <text x={m.l - 8} y={y + 4} textAnchor="end" fontSize={12} fontWeight={600} style={{ fill: 'var(--foreground)' }}>
                {r.name.length > 7 ? `${r.name.slice(0, 6)}…` : r.name}
              </text>
              <line x1={sx(r.ci.lo)} x2={sx(r.ci.hi)} y1={y} y2={y} strokeWidth={3} strokeLinecap="round" style={{ stroke: color }} strokeOpacity={0.55} />
              <line x1={sx(r.ci.lo)} x2={sx(r.ci.lo)} y1={y - 6} y2={y + 6} strokeWidth={1.5} style={{ stroke: color }} />
              <line x1={sx(r.ci.hi)} x2={sx(r.ci.hi)} y1={y - 6} y2={y + 6} strokeWidth={1.5} style={{ stroke: color }} />
              <circle cx={sx(r.p)} cy={y} r={4.5} style={{ fill: color, stroke: 'var(--card)' }} strokeWidth={1.5} />
              <text x={Math.min(sx(r.ci.hi) + 8, width - m.r + 4)} y={y + 4} fontSize={11} fill="currentColor" fontFamily="var(--font-mono), monospace">
                {fmtPct(r.p)}
              </text>
            </g>
          );
        })}
        <line x1={m.l} x2={m.l + iw} y1={height - m.b} y2={height - m.b} stroke="currentColor" strokeOpacity={0.5} />
      </svg>
    </div>
  );
}

function PosteriorChart({ variants }: { variants: ChartVariant[] }) {
  const [ref, width] = useContainerWidth();
  const height = Math.min(280, Math.max(200, Math.round(width * 0.42)));
  const m = { l: 12, r: 12, t: 12, b: 28 };
  const iw = width - m.l - m.r;
  const ih = height - m.t - m.b;
  const posts = variants.map((v) => ({ a: 1 + v.x, b: 1 + v.n - v.x }));
  let lo = 1;
  let hi = 0;
  for (const p of posts) {
    const mu = betaMean(p);
    const s = betaSd(p);
    lo = Math.min(lo, Math.max(0, mu - 5 * s));
    hi = Math.max(hi, Math.min(1, mu + 5 * s));
  }
  if (!(hi > lo)) {
    lo = 0;
    hi = 1;
  }
  const N = 240;
  const curves = posts.map((p) => {
    const ys: number[] = [];
    for (let i = 0; i <= N; i++) ys.push(betaPdf(p.a, p.b, lo + ((hi - lo) * i) / N));
    return ys;
  });
  const ymax = Math.max(1e-12, ...curves.map((c) => Math.max(...c))) * 1.06;
  const sx = (v: number) => m.l + ((v - lo) / (hi - lo)) * iw;
  const sy = (y: number) => m.t + ih - (y / ymax) * ih;
  const ticks = niceTicks(lo, hi, Math.max(3, Math.floor(iw / 80)));
  return (
    <div ref={ref} className="w-full">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Posterior distributions of the conversion rates"
        style={{ color: 'var(--muted-foreground)' }}
        className="block select-none"
      >
        {curves.map((ys, i) => {
          const color = VARIANT_COLORS[i % VARIANT_COLORS.length] ?? 'currentColor';
          const pts = ys.map((y, k) => `${sx(lo + ((hi - lo) * k) / N).toFixed(2)},${sy(y).toFixed(2)}`);
          return (
            <g key={i}>
              <path d={`M${sx(lo)},${sy(0)}L${pts.join('L')}L${sx(hi)},${sy(0)}Z`} style={{ fill: color }} fillOpacity={0.16} />
              <path d={`M${pts.join('L')}`} fill="none" strokeWidth={1.75} strokeLinejoin="round" style={{ stroke: color }} />
            </g>
          );
        })}
        <line x1={m.l} x2={m.l + iw} y1={sy(0)} y2={sy(0)} stroke="currentColor" strokeOpacity={0.6} />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={sx(t)} x2={sx(t)} y1={sy(0)} y2={sy(0) + 4} stroke="currentColor" strokeOpacity={0.6} />
            <text x={sx(t)} y={sy(0) + 16} textAnchor="middle" fontSize={10} fill="currentColor">
              {fmtPct(t, t < 0.1 ? 1 : 0)}
            </text>
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-2 pb-1 text-xs">
        {variants.map((v, i) => (
          <span key={i} className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: VARIANT_COLORS[i % VARIANT_COLORS.length] }} />
            {v.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Significance tab                                                    */
/* ------------------------------------------------------------------ */

interface ParsedVariant {
  name: string;
  n: number;
  x: number;
}

function buildReport(
  names: [string, string],
  vA: ParsedVariant,
  vB: ParsedVariant,
  c: Comparison,
  confidence: number,
  sides: 1 | 2,
  verdictText: string
): string {
  const ci = (lo: number, hi: number) => `${fmtPct(lo)} to ${fmtPct(hi)}`;
  const lines = [
    `${names[1]} vs ${names[0]} (${Math.round(confidence * 100)}% confidence, ${sides === 2 ? 'two' : 'one'}-sided)`,
    verdictText,
    `${names[0]}: ${fmtInt(vA.x)} / ${fmtInt(vA.n)} = ${fmtPct(c.pA, 3)} (Wilson CI ${ci(c.wilsonA.lo, c.wilsonA.hi)})`,
    `${names[1]}: ${fmtInt(vB.x)} / ${fmtInt(vB.n)} = ${fmtPct(c.pB, 3)} (Wilson CI ${ci(c.wilsonB.lo, c.wilsonB.hi)})`,
    `Absolute uplift: ${fmtSigned(c.diff, 3, ' pp')} (${Math.round(c.ciLevelDiff * 1000) / 10}% CI ${fmtSigned(c.diffCI.lo, 3, ' pp')} to ${fmtSigned(c.diffCI.hi, 3, ' pp')})`,
    `Relative uplift: ${fmtSigned(c.relUplift, 2)}${c.relCI ? ` (CI ${fmtSigned(c.relCI.lo, 2)} to ${fmtSigned(c.relCI.hi, 2)})` : ''}`,
    `z-test (pooled): z = ${c.z.defined ? c.z.z.toFixed(4) : 'n/a'}, p = ${fmtP(c.pZ)}`,
    `Chi-square: ${c.chi.defined ? `chi2 = ${c.chi.chi2.toFixed(4)}, p = ${fmtP(c.chi.p)} (Yates p = ${fmtP(c.chi.pYates)})` : 'n/a'}`,
    `Fisher exact: ${c.fisher ? `p = ${fmtP(sides === 2 ? c.fisher.pTwo : c.fisher.pGreater)}` : 'skipped (counts too large)'}`,
    `Observed power: ${fmtPct(c.power, 1)}`,
    `Bayesian P(${names[1]} > ${names[0]}) = ${fmtPct(c.bayes.probBBeatsA, 2)}; expected loss choosing ${names[1]} = ${fmtSigned(c.bayes.lossChooseB, 4, ' pp')}, keeping ${names[0]} = ${fmtSigned(c.bayes.lossChooseA, 4, ' pp')}`,
  ];
  return lines.join('\n');
}

function makeVerdict(
  nameA: string,
  nameB: string,
  c: Comparison,
  confidence: number,
  sides: 1 | 2,
  bonferroni: boolean,
  comparisons: number
): { text: string; tone: 'good' | 'bad' | 'neutral' } {
  const confPct = Math.round(confidence * 1000) / 10;
  const adj = bonferroni && comparisons > 1;
  const levelText = adj
    ? `${Math.round((1 - c.alphaUsed) * 10000) / 100}% confidence (Bonferroni-adjusted for ${comparisons} comparisons)`
    : `${confPct}% confidence`;
  const pUsed = c.pPrimary;
  const testName = c.primary === 'fisher' ? "Fisher's exact test" : 'two-proportion z-test';
  let verdict: string;
  let tone: 'good' | 'bad' | 'neutral';
  if (c.significant) {
    if (sides === 1) {
      verdict = `${nameB} is significantly better than ${nameA} at ${levelText} (${testName}, one-sided p = ${fmtP(pUsed)}). Relative uplift ${fmtSigned(c.relUplift, 1)}.`;
      tone = 'good';
    } else if (c.direction === 'better') {
      verdict = `${nameB} is significantly better than ${nameA} at ${levelText} (${testName}, p = ${fmtP(pUsed)}). Relative uplift ${fmtSigned(c.relUplift, 1)}.`;
      tone = 'good';
    } else {
      verdict = `${nameB} is significantly worse than ${nameA} at ${levelText} (${testName}, p = ${fmtP(pUsed)}). Relative change ${fmtSigned(c.relUplift, 1)}.`;
      tone = 'bad';
    }
  } else {
    const mde = c.mdeDelta;
    const mdeText = Number.isFinite(mde)
      ? ` With these sample sizes the test could reliably (80% power) detect a difference of about ${(mde * 100).toFixed(2)} pp${c.pA > 0 ? ` (${((mde / c.pA) * 100).toFixed(1)}% relative)` : ''} or more.`
      : '';
    if (sides === 1 && c.direction !== 'better') {
      verdict = `There is no evidence that ${nameB} is better than ${nameA} (${testName}, one-sided p = ${fmtP(pUsed)}).`;
    } else {
      verdict = `No statistically significant difference between ${nameB} and ${nameA} at ${levelText} (${testName}, ${sides === 1 ? 'one-sided ' : ''}p = ${fmtP(pUsed)}).`;
    }
    verdict += mdeText;
    tone = 'neutral';
  }
  return { text: verdict, tone };
}

function ComparisonCard({
  nameA,
  nameB,
  vA,
  vB,
  c,
  confidence,
  sides,
  bonferroni,
  comparisons,
  color,
}: {
  nameA: string;
  nameB: string;
  vA: ParsedVariant;
  vB: ParsedVariant;
  c: Comparison;
  confidence: number;
  sides: 1 | 2;
  bonferroni: boolean;
  comparisons: number;
  color: string;
}) {
  const confPct = Math.round(confidence * 1000) / 10;
  const { text: verdict, tone } = makeVerdict(nameA, nameB, c, confidence, sides, bonferroni, comparisons);
  const report = buildReport([nameA, nameB], vA, vB, c, confidence, sides, verdict);
  const fisherP = c.fisher ? (sides === 2 ? c.fisher.pTwo : c.fisher.pGreater) : NaN;
  const sidesLabel = sides === 2 ? 'two-sided' : 'one-sided (B > A)';

  return (
    <Panel>
      <PanelHeader title={`${nameB} vs ${nameA}`}>
        <CopyButton value={report} label="Copy report" />
      </PanelHeader>
      <div className="space-y-3 p-3">
        <div
          className={cn(
            'rounded-md border border-l-4 px-3 py-2 text-sm',
            tone === 'good' && 'border-success/40 bg-success/10',
            tone === 'bad' && 'border-destructive/30 bg-destructive/10',
            tone === 'neutral' && 'bg-muted/30'
          )}
          style={{ borderLeftColor: tone === 'neutral' ? color : undefined }}
          data-testid="verdict"
        >
          {verdict}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Metric
            label={`${nameA} conversion`}
            sub={`${confPct}% Wilson CI ${fmtPct(c.wilsonA.lo)} – ${fmtPct(c.wilsonA.hi)}`}
          >
            {fmtPct(c.pA, 3)} <span className="text-muted-foreground">({fmtInt(vA.x)}/{fmtInt(vA.n)})</span>
          </Metric>
          <Metric
            label={`${nameB} conversion`}
            sub={`${confPct}% Wilson CI ${fmtPct(c.wilsonB.lo)} – ${fmtPct(c.wilsonB.hi)}`}
          >
            {fmtPct(c.pB, 3)} <span className="text-muted-foreground">({fmtInt(vB.x)}/{fmtInt(vB.n)})</span>
          </Metric>
          <Metric
            label="Absolute uplift"
            sub={`${Math.round(c.ciLevelDiff * 1000) / 10}% CI ${fmtSigned(c.diffCI.lo, 2, ' pp')} to ${fmtSigned(c.diffCI.hi, 2, ' pp')} (Newcombe)`}
          >
            {fmtSigned(c.diff, 3, ' pp')}
          </Metric>
          <Metric
            label="Relative uplift"
            sub={c.relCI ? `CI ${fmtSigned(c.relCI.lo, 1)} to ${fmtSigned(c.relCI.hi, 1)} (log method)` : 'CI needs conversions in both variants'}
          >
            {fmtSigned(c.relUplift, 2)}
          </Metric>
          <Metric
            label={`z-test (pooled, ${sidesLabel})`}
            sub={c.primary === 'z' ? 'used for the verdict' : undefined}
          >
            {c.z.defined ? `z = ${c.z.z.toFixed(3)}` : 'z undefined'} · p = {fmtP(c.pZ)}
          </Metric>
          <Metric
            label="Chi-square (df 1)"
            sub={c.chi.defined ? `Yates-corrected: χ² = ${c.chi.chi2Yates.toFixed(3)}, p = ${fmtP(c.chi.pYates)}` : undefined}
          >
            {c.chi.defined ? `χ² = ${c.chi.chi2.toFixed(3)} · p = ${fmtP(c.chi.p)}` : 'undefined'}
          </Metric>
          <Metric
            label={`Fisher's exact (${sidesLabel})`}
            sub={
              c.primary === 'fisher'
                ? 'recommended and used: an expected cell count is below 5'
                : c.fisherSkipped
                  ? 'skipped: counts too large (use the z-test)'
                  : 'not needed: all expected counts are at least 5'
            }
          >
            p = {c.fisher ? fmtP(fisherP) : '—'}
          </Metric>
          <Metric
            label="Power achieved (post-hoc)"
            sub="at the observed rates; for reference only"
          >
            {fmtPct(c.power, 1)}
          </Metric>
          <Metric label="Smallest detectable lift (80% power)" sub="absolute, given these sample sizes">
            {Number.isFinite(c.mdeDelta) ? `${(c.mdeDelta * 100).toFixed(2)} pp` : '—'}
          </Metric>
        </div>

        <div className="rounded-md border p-3">
          <div className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
            Bayesian view (uniform Beta(1,1) priors)
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Metric label={`P(${nameB} > ${nameA})`}>
              <span className="text-base font-semibold">{fmtPct(c.bayes.probBBeatsA, 2)}</span>
            </Metric>
            <Metric label={`Expected loss: ship ${nameB}`} sub="avg. conversion given up if A is better">
              {(c.bayes.lossChooseB * 100).toFixed(4)} pp
            </Metric>
            <Metric label={`Expected loss: keep ${nameA}`} sub="avg. conversion given up if B is better">
              {(c.bayes.lossChooseA * 100).toFixed(4)} pp
            </Metric>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function SignificanceTab() {
  const [variants, setVariants] = useState<VariantInput[]>(SAMPLE);
  const [confidence, setConfidence] = useState('0.95');
  const [sides, setSides] = useState<'2' | '1'>('2');
  const [bonf, setBonf] = useState(true);

  const snapshot = useMemo(() => ({ variants, confidence, sides, bonf }), [variants, confidence, sides, bonf]);
  const deferred = useDeferredValue(snapshot);

  const analysis = useMemo(() => {
    const { variants: vs, confidence: cf, sides: sd, bonf: bo } = deferred;
    const parsed: ParsedVariant[] = [];
    try {
      for (const v of vs) {
        const name = v.name.trim() || 'variant';
        const n = parseCount(v.visitors, `${name}: visitors`);
        const x = parseCount(v.conversions, `${name}: conversions`);
        if (n < 1) throw new Error(`${name}: visitors must be at least 1.`);
        if (x > n) throw new Error(`${name}: conversions (${fmtInt(x)}) cannot exceed visitors (${fmtInt(n)}).`);
        parsed.push({ name, n, x });
      }
    } catch (e) {
      return { kind: 'err' as const, error: e instanceof Error ? e.message : String(e) };
    }
    const a = parsed[0];
    if (!a || parsed.length < 2) return { kind: 'err' as const, error: 'Add at least two variants.' };
    const conf = Number(cf);
    const comps = parsed.slice(1).map((b) => ({
      b,
      c: compare({
        xA: a.x,
        nA: a.n,
        xB: b.x,
        nB: b.n,
        confidence: conf,
        sides: sd === '2' ? 2 : 1,
        comparisons: parsed.length - 1,
        bonferroni: bo,
      }),
    }));
    return { kind: 'ok' as const, a, parsed, comps, conf, sides: (sd === '2' ? 2 : 1) as 1 | 2, bonferroni: bo };
  }, [deferred]);

  const update = (i: number, patch: Partial<VariantInput>) =>
    setVariants((prev) => prev.map((v, k) => (k === i ? { ...v, ...patch } : v)));
  const addVariant = () =>
    setVariants((prev) => {
      if (prev.length >= 4) return prev;
      const name = 'ABCD'[prev.length] ?? `V${prev.length + 1}`;
      const base = prev[0];
      return [...prev, { name, visitors: base?.visitors ?? '1000', conversions: base?.conversions ?? '50' }];
    });
  const removeVariant = (i: number) => setVariants((prev) => prev.filter((_, k) => k !== i));

  const err = analysis.kind === 'err' ? analysis.error : null;
  const ok = analysis.kind === 'ok' ? analysis : null;
  const fullReport = ok
    ? ok.comps
        .map(({ b, c }) =>
          buildReport(
            [ok.a.name, b.name],
            ok.a,
            b,
            c,
            ok.conf,
            ok.sides,
            makeVerdict(ok.a.name, b.name, c, ok.conf, ok.sides, ok.bonferroni, ok.comps.length).text
          )
        )
        .join('\n\n')
    : '';

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Variants">
          <Button variant="ghost" size="sm" onClick={() => setVariants(SAMPLE)}>
            <Sparkles className="size-3.5" /> Load sample
          </Button>
          {variants.length < 4 && (
            <Button variant="ghost" size="sm" onClick={addVariant}>
              <Plus className="size-3.5" /> Add variant {'ABCD'[variants.length]}
            </Button>
          )}
        </PanelHeader>
        <div className="space-y-2 p-3">
          <div className="hidden grid-cols-[88px_1fr_1fr_90px_32px] gap-2 px-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">
            <span>Name</span>
            <span>Visitors</span>
            <span>Conversions</span>
            <span className="text-right">Rate</span>
            <span />
          </div>
          {variants.map((v, i) => {
            const n = Number(v.visitors.replace(/[,\s]/g, ''));
            const x = Number(v.conversions.replace(/[,\s]/g, ''));
            const rate = n > 0 && x >= 0 && x <= n ? fmtPct(x / n, 2) : '—';
            return (
              <div key={i} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[88px_1fr_1fr_90px_32px]">
                <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
                  <span className="inline-block size-2.5 shrink-0 rounded-sm" style={{ background: VARIANT_COLORS[i % VARIANT_COLORS.length] }} />
                  <Input
                    value={v.name}
                    onChange={(e) => update(i, { name: e.target.value })}
                    aria-label={`Variant ${i + 1} name`}
                    maxLength={14}
                    className="h-8"
                  />
                </div>
                <Input
                  value={v.visitors}
                  onChange={(e) => update(i, { visitors: e.target.value })}
                  inputMode="numeric"
                  aria-label={`${v.name} visitors`}
                  placeholder="Visitors"
                  className="font-mono"
                />
                <Input
                  value={v.conversions}
                  onChange={(e) => update(i, { conversions: e.target.value })}
                  inputMode="numeric"
                  aria-label={`${v.name} conversions`}
                  placeholder="Conversions"
                  className="font-mono"
                />
                <span className="hidden text-right font-mono text-sm tabular-nums sm:block">{rate}</span>
                {i >= 2 ? (
                  <Button variant="ghost" size="icon-sm" onClick={() => removeVariant(i)} aria-label={`Remove ${v.name}`}>
                    <X className="size-3.5" />
                  </Button>
                ) : (
                  <span className="hidden sm:block" />
                )}
              </div>
            );
          })}
          <p className="px-1 pt-1 text-2xs text-muted-foreground">
            The first variant is the control. Every other variant is compared against it.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3 border-t bg-muted/30 p-3">
          <Field label="Confidence level" className="w-[120px]">
            <Select value={confidence} onValueChange={setConfidence}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.9">90%</SelectItem>
                <SelectItem value="0.95">95%</SelectItem>
                <SelectItem value="0.99">99%</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Hypothesis" className="min-w-[200px]">
            <Select value={sides} onValueChange={(v) => setSides(v as '1' | '2')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">Two-sided (B ≠ A)</SelectItem>
                <SelectItem value="1">One-sided (B &gt; A)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {variants.length > 2 && (
            <div className="flex items-center gap-2 pb-1.5">
              <Checkbox id="ab-bonf" checked={bonf} onCheckedChange={(c) => setBonf(c === true)} />
              <Label htmlFor="ab-bonf" className="text-xs">
                Bonferroni correction ({variants.length - 1} comparisons)
              </Label>
            </div>
          )}
        </div>
      </Panel>

      <ErrorBanner error={err} />

      {ok && (
        <>
          <Panel>
            <PanelHeader title="Conversion rates & posterior distributions">
              <CopyButton value={fullReport} label="Copy all" />
              <DownloadButton data={() => fullReport} filename="ab-test-report.txt" label="Download" />
            </PanelHeader>
            <div className="grid grid-cols-1 gap-px bg-border lg:grid-cols-2">
              <div className="bg-card p-3">
                <div className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Conversion rate with {Math.round(ok.conf * 100)}% Wilson interval
                </div>
                <CIChart variants={ok.parsed.map((p) => ({ name: p.name, x: p.x, n: p.n }))} confidence={ok.conf} />
                <p className="mt-2 text-2xs text-muted-foreground">
                  Dot = observed rate, bar = Wilson interval. Overlapping bars do not by themselves rule out a real
                  difference; use the tests below.
                </p>
              </div>
              <div className="bg-card p-3">
                <div className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Posterior distribution of each conversion rate
                </div>
                <PosteriorChart variants={ok.parsed.map((p) => ({ name: p.name, x: p.x, n: p.n }))} />
              </div>
            </div>
            <StatBar
              items={[
                `${ok.parsed.length} variants`,
                `${fmtInt(ok.parsed.reduce((s, p) => s + p.n, 0))} visitors`,
                `${fmtInt(ok.parsed.reduce((s, p) => s + p.x, 0))} conversions`,
              ]}
            />
          </Panel>

          {ok.comps.map(({ b, c }, i) => (
            <ComparisonCard
              key={i}
              nameA={ok.a.name}
              nameB={b.name}
              vA={ok.a}
              vB={b}
              c={c}
              confidence={ok.conf}
              sides={ok.sides}
              bonferroni={ok.bonferroni}
              comparisons={ok.comps.length}
              color={VARIANT_COLORS[(i + 1) % VARIANT_COLORS.length] ?? 'currentColor'}
            />
          ))}
        </>
      )}

      <p className="text-xs text-muted-foreground">
        The z-test and chi-square tests are large-sample approximations; Fisher&apos;s exact test is computed exactly and is
        used for the verdict automatically when any expected cell count is below 5. Post-hoc (observed) power is
        determined by the p-value and is shown for reference only. Always fix the sample size or stopping rule in
        advance: repeatedly checking a running test inflates false positives.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sample size tab                                                     */
/* ------------------------------------------------------------------ */

function SampleSizeTab() {
  const [baseline, setBaseline] = useState('10');
  const [mde, setMde] = useState('20');
  const [mdeType, setMdeType] = useState<'relative' | 'absolute'>('relative');
  const [alpha, setAlpha] = useState('0.05');
  const [power, setPower] = useState('0.8');
  const [sides, setSides] = useState<'2' | '1'>('2');
  const [variants, setVariants] = useState('2');
  const [traffic, setTraffic] = useState('1000');
  const [bonf, setBonf] = useState(true);

  const res = useMemo(() => {
    try {
      const b = Number(baseline.trim());
      const m = Number(mde.trim());
      const v = Number(variants.trim());
      const tr = traffic.trim() === '' ? 0 : Number(traffic.replace(/[,\s]/g, ''));
      if (!Number.isFinite(b)) throw new Error('Baseline conversion rate must be a number.');
      if (!Number.isFinite(m)) throw new Error('Minimum detectable effect must be a number.');
      if (!Number.isFinite(tr) || tr < 0) throw new Error('Daily traffic must be a non-negative number.');
      const make = (mdeFrac: number) =>
        computeSampleSize({
          baseline: b / 100,
          mde: mdeFrac,
          mdeType,
          alpha: Number(alpha),
          power: Number(power),
          sides: sides === '2' ? 2 : 1,
          variants: v,
          bonferroni: bonf,
          dailyTraffic: tr,
        });
      const main = make(m / 100);
      if ('error' in main) return { kind: 'err' as const, error: main.error };
      const table: { mde: number; r: SampleSizeResult | null }[] = (mdeType === 'relative'
        ? [5, 10, 15, 20, 30, 50]
        : [0.25, 0.5, 1, 2, 3, 5]
      ).map((x) => {
        const r = make(x / 100);
        return { mde: x, r: 'error' in r ? null : r };
      });
      return { kind: 'ok' as const, main, table, tr, v };
    } catch (e) {
      return { kind: 'err' as const, error: e instanceof Error ? e.message : String(e) };
    }
  }, [baseline, mde, mdeType, alpha, power, sides, variants, traffic, bonf]);

  const err = res.kind === 'err' ? res.error : null;
  const ok = res.kind === 'ok' ? res : null;
  const comparisons = Math.max(1, Number(variants) - 1);

  const summary = ok
    ? [
        `Baseline ${baseline}% -> ${(ok.main.p2 * 100).toFixed(2)}% (${mdeType === 'relative' ? `+${mde}% relative` : `+${mde} pp absolute`})`,
        `alpha ${ok.main.alphaUsed.toPrecision(3)} (${sides === '2' ? 'two' : 'one'}-sided), power ${Number(power) * 100}%`,
        `Sample size per variant: ${fmtInt(ok.main.perVariant)}`,
        `Total (${ok.v} variants): ${fmtInt(ok.main.total)}`,
        ok.main.days !== null ? `Estimated duration: ${ok.main.days} days at ${fmtInt(ok.tr)} visitors/day` : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Test design" />
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Baseline conversion rate (%)" hint="Your current (control) conversion rate">
            <Input value={baseline} onChange={(e) => setBaseline(e.target.value)} inputMode="decimal" className="font-mono" aria-label="Baseline conversion rate percent" />
          </Field>
          <Field label="Minimum detectable effect" hint="Smallest lift worth detecting">
            <div className="flex gap-2">
              <Input value={mde} onChange={(e) => setMde(e.target.value)} inputMode="decimal" className="min-w-0 font-mono" aria-label="Minimum detectable effect" />
              <Select value={mdeType} onValueChange={(v) => setMdeType(v as 'relative' | 'absolute')}>
                <SelectTrigger className="w-[110px] shrink-0" aria-label="Effect type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relative">% relative</SelectItem>
                  <SelectItem value="absolute">pp absolute</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Field>
          <Field label="Significance level (alpha)" hint="Chance of a false positive">
            <Select value={alpha} onValueChange={setAlpha}>
              <SelectTrigger className="w-full" aria-label="Significance level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.1">0.10 (90% confidence)</SelectItem>
                <SelectItem value="0.05">0.05 (95% confidence)</SelectItem>
                <SelectItem value="0.01">0.01 (99% confidence)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Statistical power" hint="Chance of detecting a real lift of the MDE">
            <Select value={power} onValueChange={setPower}>
              <SelectTrigger className="w-full" aria-label="Statistical power">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.7">70%</SelectItem>
                <SelectItem value="0.8">80%</SelectItem>
                <SelectItem value="0.9">90%</SelectItem>
                <SelectItem value="0.95">95%</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Hypothesis" hint="Two-sided also detects a drop">
            <Select value={sides} onValueChange={(v) => setSides(v as '1' | '2')}>
              <SelectTrigger className="w-full" aria-label="Hypothesis">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">Two-sided</SelectItem>
                <SelectItem value="1">One-sided (lift only)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Number of variants" hint="Including the control (min 2)">
            <Input value={variants} onChange={(e) => setVariants(e.target.value)} inputMode="numeric" className="font-mono" aria-label="Number of variants" />
          </Field>
          <Field label="Daily traffic" hint="Visitors per day entering the test (all variants)">
            <Input value={traffic} onChange={(e) => setTraffic(e.target.value)} inputMode="numeric" className="font-mono" aria-label="Daily traffic" />
          </Field>
          <div className="flex items-start gap-2 pt-5">
            <Checkbox id="ss-bonf" checked={bonf} onCheckedChange={(c) => setBonf(c === true)} className="mt-0.5" />
            <Label htmlFor="ss-bonf" className="text-xs leading-snug">
              Bonferroni correction for {comparisons} comparison{comparisons === 1 ? '' : 's'} vs control
            </Label>
          </div>
        </div>
      </Panel>

      <ErrorBanner error={err} />

      {ok && (
        <>
          <Panel>
            <PanelHeader title="Required sample size">
              <CopyButton value={summary} label="Copy" />
            </PanelHeader>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">Per variant</div>
                <div className="font-mono text-2xl font-semibold tabular-nums" data-testid="per-variant">
                  {fmtInt(ok.main.perVariant)}
                </div>
                <div className="text-2xs text-muted-foreground">visitors</div>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">Total ({ok.v} variants)</div>
                <div className="font-mono text-2xl font-semibold tabular-nums" data-testid="total">
                  {fmtInt(ok.main.total)}
                </div>
                <div className="text-2xs text-muted-foreground">visitors</div>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">Estimated duration</div>
                <div className="font-mono text-2xl font-semibold tabular-nums" data-testid="days">
                  {ok.main.days !== null ? `${fmtInt(ok.main.days)} d` : '—'}
                </div>
                <div className="text-2xs text-muted-foreground">
                  {ok.main.days !== null
                    ? `≈ ${(ok.main.days / 7).toFixed(1)} weeks at ${fmtInt(ok.tr)} visitors/day`
                    : 'enter daily traffic to estimate'}
                </div>
              </div>
            </div>
            <div className="border-t px-3 py-2 text-xs text-muted-foreground">
              Detecting {fmtPct(ok.main.p1, 2)} → {fmtPct(ok.main.p2, 2)} (
              {fmtSigned(ok.main.p2 - ok.main.p1, 2, ' pp')}, {fmtSigned(ok.main.p2 / ok.main.p1 - 1, 1)} relative) with α ={' '}
              {ok.main.alphaUsed < 0.001 ? ok.main.alphaUsed.toExponential(2) : ok.main.alphaUsed.toFixed(4)}, power{' '}
              {Math.round(Number(power) * 100)}%, z<sub>α</sub> = {ok.main.zAlpha.toFixed(3)}, z<sub>β</sub> ={' '}
              {ok.main.zBeta.toFixed(3)}.
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Sensitivity: smaller effects need far more traffic">
              <CopyButton
                value={() =>
                  ['MDE,per variant,total,days', ...ok.table.map((t) => `${t.mde}${mdeType === 'relative' ? '%' : 'pp'},${t.r?.perVariant ?? ''},${t.r?.total ?? ''},${t.r?.days ?? ''}`)].join('\n')
                }
                label="Copy CSV"
              />
            </PanelHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-2xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-1.5 font-medium">MDE ({mdeType === 'relative' ? 'relative' : 'absolute'})</th>
                    <th className="px-3 py-1.5 text-right font-medium">Target rate</th>
                    <th className="px-3 py-1.5 text-right font-medium">Per variant</th>
                    <th className="px-3 py-1.5 text-right font-medium">Total</th>
                    <th className="px-3 py-1.5 text-right font-medium">Days</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-xs tabular-nums">
                  {ok.table.map((t) => (
                    <tr key={t.mde} className="border-b last:border-0">
                      <td className="px-3 py-1.5">
                        {mdeType === 'relative' ? `+${t.mde}%` : `+${t.mde} pp`}
                      </td>
                      <td className="px-3 py-1.5 text-right">{t.r ? fmtPct(t.r.p2, 2) : '—'}</td>
                      <td className="px-3 py-1.5 text-right">{t.r ? fmtInt(t.r.perVariant) : '—'}</td>
                      <td className="px-3 py-1.5 text-right">{t.r ? fmtInt(t.r.total) : '—'}</td>
                      <td className="px-3 py-1.5 text-right">{t.r?.days != null ? fmtInt(t.r.days) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      <Panel>
        <PanelHeader title="What the inputs mean" />
        <ul className="space-y-1.5 p-3 text-xs text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Baseline conversion rate</span>: how often visitors convert today (use at
            least a few weeks of data).
          </li>
          <li>
            <span className="font-medium text-foreground">Minimum detectable effect (MDE)</span>: the smallest improvement you care
            about. A relative MDE of 20% on a 10% baseline means detecting 10% → 12%. Halving the MDE roughly quadruples the sample.
          </li>
          <li>
            <span className="font-medium text-foreground">Significance α</span>: the accepted probability of declaring a winner when
            there is no real difference (false positive). 0.05 is the usual default.
          </li>
          <li>
            <span className="font-medium text-foreground">Power</span>: the probability of detecting a real lift of at least the MDE
            (avoiding a false negative). 80% is common, 90% for important tests.
          </li>
          <li>
            <span className="font-medium text-foreground">Two-sided vs one-sided</span>: two-sided also flags significant drops and
            needs roughly 25% more traffic than one-sided.
          </li>
          <li>
            <span className="font-medium text-foreground">Variants &amp; Bonferroni</span>: with more than one challenger, each is
            compared with the control; the correction divides α by the number of comparisons to keep the overall false-positive rate.
          </li>
          <li>
            Formula: n = (z<sub>α</sub>·√(2p̄q̄) + z<sub>β</sub>·√(p₁q₁ + p₂q₂))² / (p₂ − p₁)² per variant, rounded up.
          </li>
        </ul>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function AbTestCalculator() {
  const [tab, setTab] = useState<'significance' | 'sample'>('significance');
  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as 'significance' | 'sample')} className="gap-4">
      <TabsList>
        <TabsTrigger value="significance">Significance</TabsTrigger>
        <TabsTrigger value="sample">Sample size</TabsTrigger>
      </TabsList>
      <TabsContent value="significance">
        <SignificanceTab />
      </TabsContent>
      <TabsContent value="sample">
        <SampleSizeTab />
      </TabsContent>
    </Tabs>
  );
}
