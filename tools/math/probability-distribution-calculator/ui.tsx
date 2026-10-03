'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Panel, PanelHeader, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  DIST_SPECS,
  fmtNum,
  getSpec,
  niceTicks,
  parseParams,
  plotWindow,
  probBetween,
  probGreaterEq,
  probLess,
  pValue,
  type Dist,
  type DistId,
  type DistSpec,
  type PTail,
} from './logic';

type Mode = 'le' | 'ge' | 'between' | 'pdf' | 'quantile' | 'pvalue';
type QTail = 'lower' | 'upper' | 'two';
type TestId = 'normal' | 't' | 'chisq' | 'f';

interface Row {
  label: string;
  value: string;
}

interface Computed {
  dist: Dist;
  spec: DistSpec;
  headLabel: string;
  headValue: string;
  headPercent: string | null;
  rows: Row[];
  notes: string[];
  regions: [number, number][];
  marker: number | null;
  markerLabel: string;
  include: number[];
  summary: string;
}

const MODE_LABEL: Record<Mode, string> = {
  le: 'P(X ≤ x)',
  ge: 'P(X ≥ x)',
  between: 'P(a ≤ X ≤ b)',
  pdf: 'Density / PMF',
  quantile: 'Quantile',
  pvalue: 'p-value',
};

const TESTS: { id: TestId; label: string }[] = [
  { id: 'normal', label: 'z (standard normal)' },
  { id: 't', label: 't (Student)' },
  { id: 'chisq', label: 'χ² (chi-square)' },
  { id: 'f', label: 'F' },
];

function round4(v: number, discrete: boolean): number {
  if (!Number.isFinite(v)) return 0;
  return discrete ? Math.round(v) : Number(v.toPrecision(4));
}

function defaultsFor(id: DistId): { x: string; a: string; b: string } {
  const spec = getSpec(id);
  const raw: Record<string, string> = {};
  for (const p of spec.params) raw[p.key] = String(p.def);
  const r = parseParams(spec, raw);
  if (!r.ok) return { x: '1', a: '0', b: '1' };
  const d = spec.create(r.values);
  const disc = d.kind === 'discrete';
  return {
    x: String(round4(d.quantile(0.9), disc)),
    a: String(round4(d.quantile(0.25), disc)),
    b: String(round4(d.quantile(0.75), disc)),
  };
}

function parseNum(s: string, name: string): number {
  const t = s.trim().replace(/−/g, '-');
  if (t === '') throw new Error(`${name} is required.`);
  const n = Number(t);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number.`);
  return n;
}

function pct(p: number): string {
  if (!Number.isFinite(p)) return '';
  const v = p * 100;
  return `${fmtNum(v, 6)} %`;
}

function useContainerWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(640);
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

/* ------------------------------------------------------------------ */
/* Chart                                                               */
/* ------------------------------------------------------------------ */

function inRegions(regions: [number, number][], x: number): boolean {
  return regions.some(([a, b]) => x >= a && x <= b);
}

function DistChart({
  dist,
  regions,
  marker,
  markerLabel,
  include,
}: {
  dist: Dist;
  regions: [number, number][];
  marker: number | null;
  markerLabel: string;
  include: number[];
}) {
  const [ref, width] = useContainerWidth();
  const height = Math.min(320, Math.max(210, Math.round(width * 0.48)));
  const m = { l: 44, r: 14, t: 16, b: 30 };
  const iw = width - m.l - m.r;
  const ih = height - m.t - m.b;

  const model = useMemo(() => {
    const win = plotWindow(dist, include);
    const disc = dist.kind === 'discrete';
    let xmin = win.xmin;
    let xmax = win.xmax;
    if (disc) {
      xmin -= 0.5;
      xmax += 0.5;
    }
    const sx = (x: number) => m.l + ((x - xmin) / (xmax - xmin)) * iw;
    if (disc) {
      const ks: number[] = [];
      const n = Math.round(xmax - xmin);
      const stride = Math.max(1, Math.ceil(n / 400));
      for (let k = Math.ceil(xmin); k <= xmax; k += stride) ks.push(k);
      let ymax = 0;
      const ps = ks.map((k) => {
        const p = dist.pdf(k);
        if (p > ymax) ymax = p;
        return p;
      });
      return { disc, xmin, xmax, sx, ks, ps, ymax: ymax * 1.08 || 1, stride };
    }
    const N = 260;
    const xs: number[] = [];
    const ys: number[] = [];
    let ymax = 0;
    const vals: number[] = [];
    for (let i = 0; i <= N; i++) {
      let x = xmin + ((xmax - xmin) * i) / N;
      if (i === 0 && x <= dist.lo) x = dist.lo + (xmax - xmin) * 1e-6;
      if (i === N && x >= dist.hi) x = dist.hi - (xmax - xmin) * 1e-6;
      const y = dist.pdf(x);
      xs.push(x);
      ys.push(y);
      if (Number.isFinite(y)) vals.push(y);
    }
    const sorted = [...vals].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)] ?? 1;
    const top = sorted[sorted.length - 1] ?? 1;
    // densities with a pole at the boundary: cap the axis so the body stays readable
    const cap = top > 40 * Math.max(med, 1e-300) ? (sorted[Math.floor(sorted.length * 0.97)] ?? top) * 1.6 : top;
    ymax = Math.min(top, cap) * 1.08 || 1;
    return { disc, xmin, xmax, sx, xs, ys, ymax, ks: [] as number[], ps: [] as number[], stride: 1 };
  }, [dist, include, iw, m.l]);

  const sy = (y: number) => m.t + ih - (Math.min(y, model.ymax * 1.5) / model.ymax) * ih;
  const baseY = m.t + ih;

  const xt = niceTicks(model.xmin + (model.disc ? 0.5 : 0), model.xmax - (model.disc ? 0.5 : 0), Math.max(3, Math.floor(iw / 80)));
  const yt = niceTicks(0, model.ymax, 4);

  let body: React.ReactNode;
  if (model.disc) {
    const bw = Math.max(1, (iw / (model.xmax - model.xmin)) * model.stride);
    const gap = bw > 6 ? 1.5 : bw > 3 ? 0.6 : 0;
    body = (
      <g>
        {model.ks.map((k, i) => {
          const p = model.ps[i] ?? 0;
          const x = model.sx(k) - bw / 2;
          const on = inRegions(regions, k);
          const y = sy(p);
          return (
            <rect
              key={k}
              x={x + gap / 2}
              y={y}
              width={Math.max(0.5, bw - gap)}
              height={Math.max(0, baseY - y)}
              style={{ fill: on ? 'var(--primary)' : 'var(--muted-foreground)' }}
              fillOpacity={on ? 0.85 : 0.28}
            >
              <title>{`k = ${k}, P(X = k) = ${fmtNum(p, 6)}`}</title>
            </rect>
          );
        })}
      </g>
    );
  } else {
    const pts = model.xs.map((x, i) => `${model.sx(x).toFixed(2)},${sy(model.ys[i] ?? 0).toFixed(2)}`);
    const line = `M${pts.join('L')}`;
    const fills = regions.map(([a, b], idx) => {
      const lo = Math.max(a, model.xmin);
      const hi = Math.min(b, model.xmax);
      if (!(hi > lo)) return null;
      const seg: string[] = [];
      seg.push(`${model.sx(lo).toFixed(2)},${baseY}`);
      const n = 120;
      for (let i = 0; i <= n; i++) {
        let x = lo + ((hi - lo) * i) / n;
        if (i === 0 && x <= dist.lo) x = dist.lo + (hi - lo) * 1e-6;
        if (i === n && x >= dist.hi) x = dist.hi - (hi - lo) * 1e-6;
        seg.push(`${model.sx(x).toFixed(2)},${sy(dist.pdf(x)).toFixed(2)}`);
      }
      seg.push(`${model.sx(hi).toFixed(2)},${baseY}`);
      return (
        <polygon
          key={idx}
          points={seg.join(' ')}
          style={{ fill: 'var(--primary)' }}
          fillOpacity={0.4}
        />
      );
    });
    body = (
      <g>
        <path
          d={`${line}L${model.sx(model.xs[model.xs.length - 1] ?? 0).toFixed(2)},${baseY}L${model.sx(model.xs[0] ?? 0).toFixed(2)},${baseY}Z`}
          style={{ fill: 'var(--muted-foreground)' }}
          fillOpacity={0.1}
        />
        {fills}
        <path d={line} fill="none" strokeWidth={1.75} strokeLinejoin="round" style={{ stroke: 'var(--foreground)' }} />
      </g>
    );
  }

  const markerX = marker !== null && Number.isFinite(marker) ? model.sx(marker) : null;

  return (
    <div ref={ref} className="w-full">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Chart of the distribution with the requested area shaded`}
        className="block select-none"
        style={{ color: 'var(--muted-foreground)' }}
      >
        {yt.map((v) => (
          <g key={`y${v}`}>
            <line x1={m.l} x2={m.l + iw} y1={sy(v)} y2={sy(v)} stroke="currentColor" strokeOpacity={0.14} />
            <text x={m.l - 6} y={sy(v) + 3.5} textAnchor="end" fontSize={10} fill="currentColor">
              {fmtNum(v, 3)}
            </text>
          </g>
        ))}
        {body}
        <line x1={m.l} x2={m.l + iw} y1={baseY} y2={baseY} stroke="currentColor" strokeOpacity={0.6} />
        {xt.map((v) => {
          const x = model.sx(v);
          if (x < m.l - 1 || x > m.l + iw + 1) return null;
          return (
            <g key={`x${v}`}>
              <line x1={x} x2={x} y1={baseY} y2={baseY + 4} stroke="currentColor" strokeOpacity={0.6} />
              <text x={x} y={baseY + 16} textAnchor="middle" fontSize={10} fill="currentColor">
                {fmtNum(v, 4)}
              </text>
            </g>
          );
        })}
        {markerX !== null && markerX >= m.l && markerX <= m.l + iw && (
          <g>
            <line
              x1={markerX}
              x2={markerX}
              y1={m.t - 4}
              y2={baseY}
              strokeDasharray="4 3"
              strokeWidth={1.25}
              style={{ stroke: 'var(--destructive)' }}
            />
            <text
              x={Math.min(Math.max(markerX, m.l + 30), m.l + iw - 30)}
              y={m.t - 5}
              textAnchor="middle"
              fontSize={10}
              style={{ fill: 'var(--destructive)' }}
            >
              {markerLabel}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

const DEFAULT_X = defaultsFor('normal');

export default function ProbabilityDistributionCalculator() {
  const [distId, setDistId] = useState<DistId>('normal');
  const [params, setParams] = useState<Record<string, Record<string, string>>>({});
  const [mode, setMode] = useState<Mode>('le');
  const [xs, setXs] = useState(DEFAULT_X.x);
  const [aS, setAS] = useState(DEFAULT_X.a);
  const [bS, setBS] = useState(DEFAULT_X.b);
  const [pS, setPS] = useState('0.975');
  const [qTail, setQTail] = useState<QTail>('lower');
  const [testId, setTestId] = useState<TestId>('t');
  const [stat, setStat] = useState('2.3');
  const [pTail, setPTail] = useState<PTail>('two');
  const [sig, setSig] = useState('6');

  const activeId: DistId = mode === 'pvalue' ? testId : distId;
  const spec = getSpec(activeId);
  const rawFor = (id: DistId): Record<string, string> => params[id] ?? {};
  const setParam = (id: DistId, key: string, value: string) =>
    setParams((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), [key]: value } }));

  const onPickDist = (id: DistId) => {
    setDistId(id);
    const d = defaultsFor(id);
    setXs(d.x);
    setAS(d.a);
    setBS(d.b);
    if (getSpec(id).kind === 'discrete' && qTail === 'two') setQTail('lower');
  };

  const sigN = Number(sig) || 6;

  const result = useMemo<Computed | { error: string }>(() => {
    try {
      const sp = getSpec(activeId);
      const raw = rawFor(activeId);
      const full: Record<string, string> = {};
      for (const p of sp.params) full[p.key] = raw[p.key] ?? String(p.def);
      const parsed =
        mode === 'pvalue' && activeId === 'normal'
          ? ({ ok: true, values: { mu: 0, sigma: 1 } } as const)
          : parseParams(sp, full);
      if (!parsed.ok) return { error: parsed.error };
      const values: Record<string, number> = parsed.values;
      const dist = sp.create(values);
      const disc = dist.kind === 'discrete';
      const f = (v: number) => fmtNum(v, sigN);
      const rows: Row[] = [];
      const notes: string[] = [];
      let regions: [number, number][] = [];
      let marker: number | null = null;
      let markerLabel = '';
      const include: number[] = [];
      let headLabel = '';
      let headValue = '';
      let headPercent: string | null = null;
      const xName = disc ? 'k' : 'x';

      if (mode === 'le') {
        const x = parseNum(xs, xName);
        const p = dist.cdf(x);
        headLabel = `P(X ≤ ${f(x)})`;
        headValue = f(p);
        headPercent = pct(p);
        rows.push({ label: `P(X > ${f(x)})`, value: f(dist.sf(x)) });
        if (disc) {
          rows.push({ label: `P(X < ${f(x)})`, value: f(probLess(dist, x)) });
          rows.push({ label: `P(X = ${f(x)})`, value: f(dist.pdf(x)) });
        } else {
          rows.push({ label: `Density f(${f(x)})`, value: f(dist.pdf(x)) });
        }
        regions = [[dist.lo, disc ? Math.floor(x) : x]];
        marker = x;
        markerLabel = f(x);
        include.push(x);
      } else if (mode === 'ge') {
        const x = parseNum(xs, xName);
        const p = probGreaterEq(dist, x);
        headLabel = `P(X ≥ ${f(x)})`;
        headValue = f(p);
        headPercent = pct(p);
        rows.push({ label: `P(X < ${f(x)})`, value: f(probLess(dist, x)) });
        if (disc) {
          rows.push({ label: `P(X > ${f(x)})`, value: f(dist.sf(x)) });
          rows.push({ label: `P(X = ${f(x)})`, value: f(dist.pdf(x)) });
        } else {
          rows.push({ label: `Density f(${f(x)})`, value: f(dist.pdf(x)) });
        }
        regions = [[disc ? Math.ceil(x) : x, dist.hi]];
        marker = x;
        markerLabel = f(x);
        include.push(x);
      } else if (mode === 'between') {
        const a = parseNum(aS, 'a');
        const b = parseNum(bS, 'b');
        if (a > b) throw new Error('a must be less than or equal to b.');
        const p = probBetween(dist, a, b);
        headLabel = `P(${f(a)} ≤ X ≤ ${f(b)})`;
        headValue = f(p);
        headPercent = pct(p);
        rows.push({ label: `P(X < ${f(a)})`, value: f(probLess(dist, a)) });
        rows.push({ label: `P(X > ${f(b)})`, value: f(dist.sf(b)) });
        rows.push({ label: 'Outside the interval', value: f(Math.max(0, 1 - p)) });
        regions = [[disc ? Math.ceil(a) : a, disc ? Math.floor(b) : b]];
        include.push(a, b);
      } else if (mode === 'pdf') {
        const x = parseNum(xs, xName);
        if (disc) {
          const isInt = Number.isInteger(x);
          const p = isInt ? dist.pdf(x) : 0;
          headLabel = `P(X = ${f(x)})`;
          headValue = f(p);
          headPercent = pct(p);
          if (!isInt) notes.push('k is not an integer, so the probability mass there is 0.');
          rows.push({ label: `P(X ≤ ${f(x)})`, value: f(dist.cdf(x)) });
          rows.push({ label: `P(X ≥ ${f(x)})`, value: f(probGreaterEq(dist, x)) });
          regions = isInt ? [[x, x]] : [];
        } else {
          const p = dist.pdf(x);
          headLabel = `Density f(${f(x)})`;
          headValue = f(p);
          rows.push({ label: `P(X ≤ ${f(x)})`, value: f(dist.cdf(x)) });
          rows.push({ label: `P(X ≥ ${f(x)})`, value: f(dist.sf(x)) });
          notes.push('A density is not a probability: the shaded area under the curve is.');
        }
        marker = x;
        markerLabel = f(x);
        include.push(x);
      } else if (mode === 'quantile') {
        const p = parseNum(pS, qTail === 'two' ? 'α' : 'p');
        if (p < 0 || p > 1) throw new Error(`${qTail === 'two' ? 'α' : 'p'} must be between 0 and 1.`);
        if (qTail === 'lower' || disc) {
          const q = dist.quantile(p);
          headLabel = disc ? `Smallest k with P(X ≤ k) ≥ ${f(p)}` : `x with P(X ≤ x) = ${f(p)}`;
          headValue = f(q);
          if (Number.isFinite(q)) {
            rows.push({ label: `P(X ≤ ${f(q)})`, value: f(dist.cdf(q)) });
            if (disc) rows.push({ label: `P(X < ${f(q)})`, value: f(probLess(dist, q)) });
            rows.push({ label: `P(X > ${f(q)})`, value: f(dist.sf(q)) });
            regions = [[dist.lo, q]];
            marker = q;
            markerLabel = f(q);
            include.push(q);
          }
          if (disc) notes.push('Discrete distributions: the quantile is the smallest integer whose CDF reaches p.');
        } else if (qTail === 'upper') {
          const q = dist.quantile(1 - p);
          headLabel = `x with P(X > x) = ${f(p)}`;
          headValue = f(q);
          if (Number.isFinite(q)) {
            rows.push({ label: `P(X > ${f(q)})`, value: f(dist.sf(q)) });
            rows.push({ label: `P(X ≤ ${f(q)})`, value: f(dist.cdf(q)) });
            regions = [[q, dist.hi]];
            marker = q;
            markerLabel = f(q);
            include.push(q);
          }
        } else {
          const lo = dist.quantile(p / 2);
          const hi = dist.quantile(1 - p / 2);
          headLabel = `Two-tailed critical values (α = ${f(p)})`;
          headValue = `${f(lo)}  and  ${f(hi)}`;
          rows.push({ label: 'Lower critical value (α/2 in the left tail)', value: f(lo) });
          rows.push({ label: 'Upper critical value (α/2 in the right tail)', value: f(hi) });
          rows.push({ label: `Central probability (1 − α)`, value: f(1 - p) });
          const one = dist.quantile(1 - p);
          rows.push({ label: 'One-tailed upper critical value (α in the right tail)', value: f(one) });
          regions = [
            [dist.lo, lo],
            [hi, dist.hi],
          ];
          include.push(lo, hi);
        }
        if (qTail !== 'two') headPercent = null;
      } else {
        const s = parseNum(stat, 'Test statistic');
        const p = pValue(dist, s, pTail);
        const left = dist.cdf(s);
        const right = dist.sf(s);
        headLabel =
          pTail === 'two' ? 'Two-sided p-value' : pTail === 'right' ? 'Right-tailed p-value' : 'Left-tailed p-value';
        headValue = f(p);
        headPercent = pct(p);
        rows.push({ label: `P(X ≤ ${f(s)})`, value: f(left) });
        rows.push({ label: `P(X ≥ ${f(s)})`, value: f(right) });
        const alphas = [0.05, 0.01];
        for (const a of alphas) {
          rows.push({
            label: `Significant at α = ${a}?`,
            value: p < a ? 'yes (p < α)' : 'no (p ≥ α)',
          });
        }
        if (pTail === 'two') {
          const m = Math.min(left, right);
          const median = dist.quantile(0.5);
          if (s >= median) regions = [[s, dist.hi], [dist.lo, dist.quantile(m)]];
          else regions = [[dist.lo, s], [dist.quantile(1 - m), dist.hi]];
          if (testId === 'chisq' || testId === 'f') {
            notes.push('Two-sided p for an asymmetric distribution is taken as 2 × min(P(X ≤ s), P(X ≥ s)).');
          }
        } else if (pTail === 'right') regions = [[s, dist.hi]];
        else regions = [[dist.lo, s]];
        marker = s;
        markerLabel = f(s);
        include.push(s);
      }

      const summary = [
        `${sp.name} distribution (${sp.params
          .map((p) => `${p.label} = ${p.options ? (values[p.key] === 1 ? 'trials' : 'failures') : f(values[p.key] ?? NaN)}`)
          .join(', ')})`,
        `${headLabel} = ${headValue}`,
        ...rows.map((r) => `${r.label} = ${r.value}`),
      ].join('\n');

      return {
        dist,
        spec: sp,
        headLabel,
        headValue,
        headPercent,
        rows,
        notes,
        regions,
        marker,
        markerLabel,
        include,
        summary,
      };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, params, mode, xs, aS, bS, pS, qTail, stat, pTail, sigN, testId]);

  const err = 'error' in result ? result.error : null;
  const ok = 'dist' in result ? result : null;

  const stats = useMemo(() => {
    if (!ok) return null;
    const d = ok.dist;
    const f = (v: number) => fmtNum(v, sigN);
    const sd = Math.sqrt(d.stats.variance);
    let modeText: string;
    if (d.stats.modeNote) modeText = d.stats.modeNote;
    else if (d.stats.mode.length === 0) modeText = 'undefined';
    else modeText = d.stats.mode.map(f).join(', ');
    const median = d.quantile(0.5);
    return [
      { label: 'Mean', value: f(d.stats.mean) },
      { label: 'Median', value: f(median) },
      { label: 'Mode', value: modeText },
      { label: 'Variance', value: f(d.stats.variance) },
      { label: 'Std deviation', value: Number.isNaN(sd) && d.stats.variance !== Infinity ? 'undefined' : f(sd) },
      { label: 'Skewness', value: f(d.stats.skewness) },
      { label: 'Excess kurtosis', value: f(d.stats.exKurtosis) },
    ];
  }, [ok, sigN]);

  const raw = rawFor(activeId);
  const showParams = !(mode === 'pvalue' && activeId === 'normal');
  const discrete = spec.kind === 'discrete';

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Distribution & question" />
        <div className="space-y-4 p-3">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="h-auto flex-wrap justify-start">
              {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
                <TabsTrigger key={m} value={m} className="flex-none">
                  {m === 'pdf' ? (discrete ? 'P(X = k)' : 'Density f(x)') : MODE_LABEL[m]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
            {mode === 'pvalue' ? (
              <Field label="Test statistic distribution" className="min-w-[200px]">
                <Select value={testId} onValueChange={(v) => setTestId(v as TestId)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TESTS.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : (
              <Field label="Distribution" className="min-w-[200px]">
                <Select value={distId} onValueChange={(v) => onPickDist(v as DistId)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Continuous
                    </div>
                    {DIST_SPECS.filter((d) => d.kind === 'continuous').map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                    <div className="px-2 py-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Discrete
                    </div>
                    {DIST_SPECS.filter((d) => d.kind === 'discrete').map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            {showParams &&
              spec.params.map((p) =>
                p.options ? (
                  <Field key={p.key} label={p.label} className="min-w-[220px]">
                    <Select
                      value={raw[p.key] ?? String(p.def)}
                      onValueChange={(v) => setParam(activeId, p.key, v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {p.options.map((o) => (
                          <SelectItem key={o.value} value={String(o.value)}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                ) : (
                  <Field key={p.key} label={p.label} className="w-[130px]">
                    <Input
                      inputMode="decimal"
                      value={raw[p.key] ?? String(p.def)}
                      onChange={(e) => setParam(activeId, p.key, e.target.value)}
                      className="font-mono"
                      aria-label={p.label}
                    />
                  </Field>
                )
              )}
          </div>
          <p className="text-xs text-muted-foreground">
            {mode === 'pvalue' && activeId === 'normal' ? 'Standard normal: mean 0, standard deviation 1.' : spec.blurb}
          </p>

          <div className="flex flex-wrap items-end gap-x-4 gap-y-3 border-t pt-3">
            {(mode === 'le' || mode === 'ge' || mode === 'pdf') && (
              <Field label={discrete ? 'k (number of events)' : 'x'} className="w-[150px]">
                <Input
                  inputMode="decimal"
                  value={xs}
                  onChange={(e) => setXs(e.target.value)}
                  className="font-mono"
                  aria-label="x value"
                />
              </Field>
            )}
            {mode === 'between' && (
              <>
                <Field label={discrete ? 'a (lower, inclusive)' : 'a (lower)'} className="w-[150px]">
                  <Input
                    inputMode="decimal"
                    value={aS}
                    onChange={(e) => setAS(e.target.value)}
                    className="font-mono"
                    aria-label="lower bound a"
                  />
                </Field>
                <Field label={discrete ? 'b (upper, inclusive)' : 'b (upper)'} className="w-[150px]">
                  <Input
                    inputMode="decimal"
                    value={bS}
                    onChange={(e) => setBS(e.target.value)}
                    className="font-mono"
                    aria-label="upper bound b"
                  />
                </Field>
              </>
            )}
            {mode === 'quantile' && (
              <>
                {!discrete && (
                  <Field label="Tail">
                    <Tabs value={qTail} onValueChange={(v) => setQTail(v as QTail)}>
                      <TabsList>
                        <TabsTrigger value="lower">Lower P(X ≤ x)</TabsTrigger>
                        <TabsTrigger value="upper">Upper P(X &gt; x)</TabsTrigger>
                        <TabsTrigger value="two">Two-tailed α</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </Field>
                )}
                <Field label={qTail === 'two' && !discrete ? 'Significance level α' : 'Probability p'} className="w-[150px]">
                  <Input
                    inputMode="decimal"
                    value={pS}
                    onChange={(e) => setPS(e.target.value)}
                    className="font-mono"
                    aria-label="probability"
                  />
                </Field>
                <div className="flex flex-wrap gap-1 pb-0.5">
                  {['0.9', '0.95', '0.975', '0.99', '0.995'].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPS(qTail === 'two' && !discrete ? String(Number((1 - Number(v)).toFixed(4))) : v)}
                      className="rounded border bg-muted/40 px-1.5 py-0.5 font-mono text-2xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                      {qTail === 'two' && !discrete ? String(Number((1 - Number(v)).toFixed(4))) : v}
                    </button>
                  ))}
                </div>
              </>
            )}
            {mode === 'pvalue' && (
              <>
                <Field label="Test statistic" className="w-[150px]">
                  <Input
                    inputMode="decimal"
                    value={stat}
                    onChange={(e) => setStat(e.target.value)}
                    className="font-mono"
                    aria-label="test statistic"
                  />
                </Field>
                <Field label="Alternative / tail">
                  <Tabs value={pTail} onValueChange={(v) => setPTail(v as PTail)}>
                    <TabsList>
                      <TabsTrigger value="two">Two-sided</TabsTrigger>
                      <TabsTrigger value="right">Right-tailed</TabsTrigger>
                      <TabsTrigger value="left">Left-tailed</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </Field>
              </>
            )}
            <Field label="Sig. digits" className="ml-auto w-[100px]">
              <Select value={sig} onValueChange={setSig}>
                <SelectTrigger className="w-full" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['4', '6', '8', '10', '12'].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>
      </Panel>

      <ErrorBanner error={err} />

      {ok && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-2">
          <Panel>
            <PanelHeader title="Result">
              <CopyButton value={ok.summary} label="Copy result" />
            </PanelHeader>
            <div className="space-y-3 p-3">
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">{ok.headLabel}</div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="break-all font-mono text-2xl font-semibold tabular-nums" data-testid="headline">
                    {ok.headValue}
                  </span>
                  <CopyButton value={ok.headValue.split(/\s+and\s+/)[0] ?? ok.headValue} size="icon-sm" />
                </div>
                {ok.headPercent && (
                  <div className="mt-0.5 font-mono text-xs text-muted-foreground">{ok.headPercent}</div>
                )}
              </div>
              <dl className="divide-y rounded-md border text-sm">
                {ok.rows.map((r) => (
                  <div key={r.label} className="flex items-center justify-between gap-3 px-3 py-1.5">
                    <dt className="min-w-0 text-xs text-muted-foreground">{r.label}</dt>
                    <dd className="shrink-0 font-mono text-xs tabular-nums">{r.value}</dd>
                  </div>
                ))}
              </dl>
              {ok.notes.map((n) => (
                <p key={n} className="text-xs text-muted-foreground">
                  {n}
                </p>
              ))}
            </div>
          </Panel>

          {stats && (
            <Panel>
              <PanelHeader title="Summary statistics">
                <CopyButton value={stats.map((s) => `${s.label}: ${s.value}`).join('\n')} />
              </PanelHeader>
              <dl className="grid grid-cols-2 gap-px bg-border">
                {stats.map((s) => (
                  <div key={s.label} className={cn('bg-card px-3 py-2')}>
                    <dt className="text-2xs uppercase tracking-wide text-muted-foreground">{s.label}</dt>
                    <dd className="mt-0.5 break-words font-mono text-sm tabular-nums">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          )}
          </div>

          <div className="space-y-4 lg:col-span-3">
            <Panel>
              <PanelHeader title={discrete ? 'Probability mass function' : 'Probability density function'} />
              <div className="p-2">
                <DistChart
                  dist={ok.dist}
                  regions={ok.regions}
                  marker={ok.marker}
                  markerLabel={ok.markerLabel}
                  include={ok.include}
                />
              </div>
              <StatBar
                items={[
                  `${ok.spec.name} · ${discrete ? 'discrete' : 'continuous'}`,
                  ok.regions.length > 0 ? 'shaded: requested region' : null,
                ]}
              />
            </Panel>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Computed in your browser with series / continued-fraction incomplete gamma &amp; beta functions (about 10-12 digits
        in normal ranges). Negative binomial counts failures before the r-th success unless you switch to trials;
        geometric counts trials unless you switch to failures.
      </p>
    </div>
  );
}
