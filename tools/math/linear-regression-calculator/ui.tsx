'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Sparkles } from 'lucide-react';
import { Panel, PanelHeader, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { parseCsv } from '@/lib/data/csv';
import {
  MODEL_KINDS,
  MODEL_LABEL,
  buildChartSvg,
  detectDelimiter,
  fitAll,
  fmt,
  fmtP,
  kendall,
  linearStats,
  pairsFromColumns,
  parseLists,
  parseNumberToken,
  parsePairs,
  pearson,
  rankFits,
  residualsCsv,
  spearman,
  type ChartOptions,
  type FitResult,
  type LinearStats,
  type ModelFit,
  type ModelKind,
  type ParsedData,
  type Palette,
  type RankBy,
} from './logic';

/* ------------------------------------------------------------------ */
/* Samples                                                             */
/* ------------------------------------------------------------------ */

interface Sample {
  id: string;
  label: string;
  x: string;
  y: string;
  xs: number[];
  ys: number[];
  model: ModelKind;
}

function mk(id: string, label: string, x: string, y: string, xs: number[], ys: number[], model: ModelKind): Sample {
  return { id, label, x, y, xs, ys, model };
}

const AN_X = [10, 8, 13, 9, 11, 14, 6, 4, 12, 7, 5];
const SAMPLES: Sample[] = [
  mk(
    'ads',
    'Advertising spend vs sales (linear)',
    'Ad spend (k$)',
    'Sales (units)',
    [1.2, 1.8, 2.1, 2.7, 3.0, 3.6, 4.1, 4.4, 5.0, 5.3, 5.9, 6.4, 6.8, 7.3, 7.9, 8.2, 8.8, 9.3, 9.9, 10.5],
    [112, 131, 128, 156, 149, 171, 188, 179, 203, 214, 226, 221, 247, 252, 261, 283, 279, 301, 312, 318],
    'linear'
  ),
  mk('an1', "Anscombe's quartet I", 'x', 'y', AN_X, [8.04, 6.95, 7.58, 8.81, 8.33, 9.96, 7.24, 4.26, 10.84, 4.82, 5.68], 'linear'),
  mk('an2', "Anscombe's quartet II (curved)", 'x', 'y', AN_X, [9.14, 8.14, 8.74, 8.77, 9.26, 8.1, 6.13, 3.1, 9.13, 7.26, 4.74], 'poly2'),
  mk('an3', "Anscombe's quartet III (outlier)", 'x', 'y', AN_X, [7.46, 6.77, 12.74, 7.11, 7.81, 8.84, 6.08, 5.39, 8.15, 6.42, 5.73], 'linear'),
  mk(
    'an4',
    "Anscombe's quartet IV (leverage point)",
    'x',
    'y',
    [8, 8, 8, 8, 8, 8, 8, 19, 8, 8, 8],
    [6.58, 5.76, 7.71, 8.84, 8.47, 7.04, 5.25, 12.5, 5.56, 7.91, 6.89],
    'linear'
  ),
  mk(
    'bact',
    'Bacteria growth (exponential)',
    'Hours',
    'Colonies',
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    [102, 148, 215, 310, 460, 655, 960, 1390, 2010, 2880, 4170],
    'exponential'
  ),
  mk(
    'stop',
    'Stopping distance vs speed (quadratic, illustrative)',
    'Speed (mph)',
    'Distance (ft)',
    [4, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24, 25],
    [2, 4, 16, 10, 18, 17, 14, 24, 28, 26, 34, 40, 42, 46, 48, 66, 70, 85],
    'poly2'
  ),
  mk(
    'kepler',
    "Planets: orbital period vs distance (power law)",
    'Semi-major axis (AU)',
    'Period (years)',
    [0.387, 0.723, 1.0, 1.524, 5.203, 9.537, 19.19, 30.07],
    [0.241, 0.615, 1.0, 1.881, 11.862, 29.457, 84.01, 164.8],
    'power'
  ),
];

function samplePairsText(s: Sample): string {
  return [`${s.x}\t${s.y}`, ...s.xs.map((x, i) => `${x}\t${s.ys[i]}`)].join('\n');
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

type InputMode = 'pairs' | 'lists' | 'csv';
type ChartTab = 'fit' | 'residuals';

function useContainerWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setW(Math.max(280, Math.floor(el.getBoundingClientRect().width)));
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Resolve any CSS color expression (incl. var() and oklch()) to rgb() via a 1x1 canvas. */
function resolveColor(cssValue: string): string {
  try {
    const probe = document.createElement('span');
    probe.style.color = cssValue;
    probe.style.display = 'none';
    document.body.appendChild(probe);
    const computed = getComputedStyle(probe).color;
    probe.remove();
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    const ctx = c.getContext('2d');
    if (!ctx) return computed;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = computed;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return `rgb(${d[0] ?? 0}, ${d[1] ?? 0}, ${d[2] ?? 0})`;
  } catch {
    return '#888888';
  }
}

const SCREEN_PALETTE: Palette = {
  fg: 'var(--foreground)',
  muted: 'var(--muted-foreground)',
  grid: 'var(--border)',
  point: 'var(--primary)',
  curve: 'var(--cat-image)',
  band: 'var(--primary)',
  accent: 'var(--cat-text)',
  font: 'var(--font-geist-sans), system-ui, sans-serif',
};

function exportPalette(): Palette {
  return {
    fg: resolveColor('var(--foreground)'),
    muted: resolveColor('var(--muted-foreground)'),
    grid: resolveColor('var(--border)'),
    point: resolveColor('var(--primary)'),
    curve: resolveColor('var(--cat-image)'),
    band: resolveColor('var(--primary)'),
    accent: resolveColor('var(--cat-text)'),
    bg: resolveColor('var(--card)'),
    font: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  };
}

async function svgToPng(svg: string, width: number, height: number, scale = 2): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not render the chart to an image.'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed.'))), 'image/png')
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

function StatCell({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="bg-card px-3 py-2">
      <div className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 break-words font-mono text-sm tabular-nums">{value}</div>
      {sub && <div className="font-mono text-2xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

const DEFAULT_SAMPLE = SAMPLES[0] as Sample;

export default function LinearRegressionCalculator() {
  const [mode, setMode] = useState<InputMode>('pairs');
  const [pairsText, setPairsText] = useState(samplePairsText(DEFAULT_SAMPLE));
  const [xText, setXText] = useState('');
  const [yText, setYText] = useState('');
  const [csvText, setCsvText] = useState('');
  const [xCol, setXCol] = useState('0');
  const [yCol, setYCol] = useState('1');
  const [sampleId, setSampleId] = useState(DEFAULT_SAMPLE.id);

  const [model, setModel] = useState<ModelKind>('linear');
  const [rankBy, setRankBy] = useState<RankBy>('adjR2');
  const [confidence, setConfidence] = useState('0.95');
  const [predictX, setPredictX] = useState('');
  const [chartTab, setChartTab] = useState<ChartTab>('fit');
  const [showCI, setShowCI] = useState(true);
  const [showPI, setShowPI] = useState(false);
  const [residualAxis, setResidualAxis] = useState<'x' | 'fitted'>('x');
  const [showRejected, setShowRejected] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const dPairs = useDeferredValue(pairsText);
  const dX = useDeferredValue(xText);
  const dY = useDeferredValue(yText);
  const dCsv = useDeferredValue(csvText);

  // CSV structure
  const csv = useMemo(() => {
    if (!dCsv.trim()) return null;
    const delim = detectDelimiter(dCsv);
    const rows = parseCsv(dCsv, delim).filter((r) => r.some((c) => c.trim() !== ''));
    if (rows.length === 0) return null;
    const first = rows[0] ?? [];
    const hasHeader = first.some((c) => c.trim() !== '' && parseNumberToken(c) === null);
    const headers = hasHeader ? first.map((c, i) => c.trim() || `Column ${i + 1}`) : first.map((_, i) => `Column ${i + 1}`);
    const body = hasHeader ? rows.slice(1) : rows;
    const width = Math.max(...rows.map((r) => r.length));
    while (headers.length < width) headers.push(`Column ${headers.length + 1}`);
    return { headers, body, hasHeader };
  }, [dCsv]);

  const parsed = useMemo<ParsedData | { error: string }>(() => {
    if (mode === 'pairs') return parsePairs(dPairs);
    if (mode === 'lists') return parseLists(dX, dY);
    if (!csv) return { xs: [], ys: [], rejected: [] };
    const xi = Math.min(Number(xCol) || 0, csv.headers.length - 1);
    const yi = Math.min(Number(yCol) || 0, csv.headers.length - 1);
    const out = pairsFromColumns(
      csv.body.map((r) => r[xi] ?? ''),
      csv.body.map((r) => r[yi] ?? ''),
      csv.hasHeader ? 2 : 1
    );
    out.xLabel = csv.headers[xi];
    out.yLabel = csv.headers[yi];
    return out;
  }, [mode, dPairs, dX, dY, csv, xCol, yCol]);

  const data = 'error' in parsed ? null : parsed;
  const dataError = 'error' in parsed ? parsed.error : null;
  const n = data?.xs.length ?? 0;

  const xLabel = data?.xLabel || 'x';
  const yLabel = data?.yLabel || 'y';

  const conf = Number(confidence);

  const analysis = useMemo(() => {
    if (!data || n < 2) return null;
    const fits = fitAll(data.xs, data.ys);
    const lin = linearStats(data.xs, data.ys, conf);
    const pe = pearson(data.xs, data.ys, conf);
    const sp = n >= 3 ? spearman(data.xs, data.ys) : null;
    const ke = n >= 3 ? kendall(data.xs, data.ys) : null;
    return { fits, lin, pe, sp, ke };
  }, [data, n, conf]);

  const okFits = useMemo(() => (analysis ? analysis.fits.filter((f): f is ModelFit => f.ok) : []), [analysis]);
  const ranked = useMemo(() => rankFits(okFits, rankBy), [okFits, rankBy]);
  const best = ranked[0] ?? null;
  const selected: FitResult | null = analysis ? (analysis.fits.find((f) => f.kind === model) ?? null) : null;
  const sel = selected && selected.ok ? selected : null;

  const loadSample = (id: string) => {
    const s = SAMPLES.find((q) => q.id === id);
    if (!s) return;
    setSampleId(id);
    setMode('pairs');
    setPairsText(samplePairsText(s));
    setModel(s.model);
    setPredictX('');
  };

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setCsvText(text.slice(0, 5_000_000));
      setMode('csv');
      setXCol('0');
      setYCol('1');
    };
    reader.readAsText(file);
  };

  // prediction
  const pred = useMemo(() => {
    if (!sel || predictX.trim() === '') return null;
    const x0 = Number(predictX.trim().replace(/−/g, '-'));
    if (!Number.isFinite(x0)) return { error: 'Enter a numeric x value.' } as const;
    if (sel.xDomainMin !== -Infinity && x0 <= sel.xDomainMin) return { error: `This model needs x > ${sel.xDomainMin}.` } as const;
    const mean = sel.interval(x0, conf, 'mean');
    const obs = sel.interval(x0, conf, 'pred');
    let xmin = Infinity;
    let xmax = -Infinity;
    for (const x of data?.xs ?? []) {
      if (x < xmin) xmin = x;
      if (x > xmax) xmax = x;
    }
    return { x0, mean, obs, extrapolating: x0 < xmin || x0 > xmax } as const;
  }, [sel, predictX, conf, data]);

  const [chartRef, chartWidth] = useContainerWidth();
  const chartHeight = Math.min(480, Math.max(300, Math.round(chartWidth * 0.62)));

  const chartOptions = (palette: Palette, w: number, h: number, title?: string): ChartOptions | null => {
    if (!sel || !data) return null;
    return {
      width: w,
      height: h,
      xs: data.xs,
      ys: data.ys,
      model: sel,
      kind: chartTab,
      showCI,
      showPI,
      confidence: conf,
      residualAxis,
      xLabel,
      yLabel,
      palette,
      predictPoint: pred && !('error' in pred) ? { x: pred.x0, y: pred.mean.yhat } : null,
      title,
    };
  };

  const screenSvg = useMemo(() => {
    const o = chartOptions(SCREEN_PALETTE, chartWidth, chartHeight);
    return o ? buildChartSvg(o) : '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, data, chartTab, showCI, showPI, conf, residualAxis, xLabel, yLabel, pred, chartWidth, chartHeight]);

  const exportSvgString = (): string => {
    const o = chartOptions(exportPalette(), 900, 560, `${sel?.label ?? ''}: ${yLabel} vs ${xLabel}`);
    return o ? buildChartSvg(o) : '';
  };
  const exportPng = async (): Promise<Blob> => {
    setExportError(null);
    try {
      return await svgToPng(exportSvgString(), 900, 560, 2);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e));
      throw e;
    }
  };

  const lin: LinearStats | null = analysis && !('error' in analysis.lin) ? analysis.lin : null;
  const linError = analysis && 'error' in analysis.lin ? analysis.lin.error : null;

  const summaryText = useMemo(() => {
    if (!sel || !data) return '';
    const lines = [`Model: ${sel.label}`, `Equation: ${sel.equation}`, `n = ${sel.n}`, `R² = ${fmt(sel.r2)}`, `Adjusted R² = ${fmt(sel.adjR2)}`, `RMSE = ${fmt(sel.rmse)}`];
    if (sel.kind === 'linear' && lin) {
      const ci = (a: [number, number]) => `[${fmt(a[0])}, ${fmt(a[1])}]`;
      lines.push(
        `Slope = ${fmt(lin.slope)} (SE ${fmt(lin.seSlope)}, t = ${fmt(lin.tSlope)}, p = ${fmtP(lin.pSlope)}, ${Math.round(conf * 100)}% CI ${ci(lin.ciSlope)})`,
        `Intercept = ${fmt(lin.intercept)} (SE ${fmt(lin.seIntercept)}, t = ${fmt(lin.tIntercept)}, p = ${fmtP(lin.pIntercept)}, ${Math.round(conf * 100)}% CI ${ci(lin.ciIntercept)})`,
        `Std error of estimate = ${fmt(lin.s)}`,
        `F(1, ${lin.df}) = ${fmt(lin.F)}, p = ${fmtP(lin.pF)}`
      );
    }
    if (analysis) {
      lines.push(`Pearson r = ${fmt(analysis.pe.r)} (p = ${fmtP(analysis.pe.p)})`);
      if (analysis.sp) lines.push(`Spearman rho = ${fmt(analysis.sp.rho)} (p = ${fmtP(analysis.sp.p)})`);
      if (analysis.ke) lines.push(`Kendall tau-b = ${fmt(analysis.ke.tau)} (p = ${fmtP(analysis.ke.p)}, ${analysis.ke.method})`);
    }
    return lines.join('\n');
  }, [sel, data, lin, analysis, conf]);

  const resCsv = useMemo(() => (sel && data ? residualsCsv(data.xs, data.ys, sel) : ''), [sel, data]);
  const maxRows = 300;
  const confPct = Math.round(conf * 1000) / 10;

  const columnOptions = csv ? csv.headers : [];

  return (
    <div className="space-y-4">
      {/* ---------------- data input ---------------- */}
      <Panel>
        <PanelHeader title="Data">
          <Select value={sampleId} onValueChange={loadSample}>
            <SelectTrigger size="sm" className="h-7 max-w-[260px] border-0 bg-transparent text-xs shadow-none" aria-label="Load sample dataset">
              <Sparkles className="size-3.5" />
              <SelectValue placeholder="Load sample…" />
            </SelectTrigger>
            <SelectContent>
              {SAMPLES.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="size-3.5" /> Upload CSV
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = '';
            }}
          />
        </PanelHeader>
        <div className="space-y-3 p-3">
          <Tabs value={mode} onValueChange={(v) => setMode(v as InputMode)}>
            <TabsList>
              <TabsTrigger value="pairs">Paste x y pairs</TabsTrigger>
              <TabsTrigger value="lists">X list + Y list</TabsTrigger>
              <TabsTrigger value="csv">CSV with header</TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === 'pairs' && (
            <Textarea
              value={pairsText}
              onChange={(e) => setPairsText(e.target.value)}
              spellCheck={false}
              rows={8}
              className="max-h-72 font-mono text-xs"
              placeholder={'One pair per line, separated by a tab, comma, semicolon or space:\n1.5  2.1\n2.0  3.9\n3.2  5.8'}
              aria-label="x y pairs"
            />
          )}
          {mode === 'lists' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="X values">
                <Textarea
                  value={xText}
                  onChange={(e) => setXText(e.target.value)}
                  spellCheck={false}
                  rows={6}
                  className="font-mono text-xs"
                  placeholder="1, 2, 3, 4, 5"
                  aria-label="x list"
                />
              </Field>
              <Field label="Y values">
                <Textarea
                  value={yText}
                  onChange={(e) => setYText(e.target.value)}
                  spellCheck={false}
                  rows={6}
                  className="font-mono text-xs"
                  placeholder="2.1, 3.9, 6.2, 7.8, 10.1"
                  aria-label="y list"
                />
              </Field>
            </div>
          )}
          {mode === 'csv' && (
            <div className="space-y-3">
              <Textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                spellCheck={false}
                rows={7}
                className="max-h-72 font-mono text-xs"
                placeholder={'Paste CSV / TSV text (first row = header) or use Upload CSV:\nmonth,visits,revenue\n1,1200,340\n2,1500,410'}
                aria-label="CSV data"
              />
              {csv && (
                <div className="flex flex-wrap items-end gap-4">
                  <Field label="X column" className="min-w-[180px]">
                    <Select value={String(Math.min(Number(xCol) || 0, columnOptions.length - 1))} onValueChange={setXCol}>
                      <SelectTrigger className="w-full" aria-label="X column">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {columnOptions.map((h, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Y column" className="min-w-[180px]">
                    <Select value={String(Math.min(Number(yCol) || 0, columnOptions.length - 1))} onValueChange={setYCol}>
                      <SelectTrigger className="w-full" aria-label="Y column">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {columnOptions.map((h, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <span className="pb-2 text-2xs text-muted-foreground">
                    {csv.hasHeader ? 'Header row detected.' : 'No header row detected.'}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-mono text-muted-foreground" data-testid="parse-status">
              {n} point{n === 1 ? '' : 's'} parsed
              {data && data.rejected.length > 0 && (
                <>
                  {' · '}
                  <button
                    type="button"
                    className="text-destructive underline-offset-2 hover:underline"
                    onClick={() => setShowRejected((v) => !v)}
                  >
                    {data.rejected.length} line{data.rejected.length === 1 ? '' : 's'} rejected
                  </button>
                </>
              )}
            </span>
            {data?.xLabel && (
              <span className="text-muted-foreground">
                columns: <span className="font-mono">{data.xLabel}</span> (x), <span className="font-mono">{data.yLabel}</span> (y)
              </span>
            )}
          </div>
          {showRejected && data && data.rejected.length > 0 && (
            <ul className="max-h-40 overflow-auto rounded-md border bg-muted/30 p-2 font-mono text-2xs text-muted-foreground">
              {data.rejected.slice(0, 50).map((r, i) => (
                <li key={i}>
                  line {r.line}: {r.reason} <span className="opacity-70">({r.text})</span>
                </li>
              ))}
              {data.rejected.length > 50 && <li>… and {data.rejected.length - 50} more</li>}
            </ul>
          )}
        </div>
      </Panel>

      <ErrorBanner error={dataError} />
      {!dataError && n < 2 && (
        <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          Enter at least two (x, y) pairs to see results.
        </p>
      )}

      {analysis && data && n >= 2 && (
        <>
          {/* ---------------- model selection + comparison ---------------- */}
          <Panel>
            <PanelHeader title="Model & settings" />
            <div className="flex flex-wrap items-end gap-x-4 gap-y-3 p-3">
              <Field label="Model" className="min-w-[220px]">
                <Select value={model} onValueChange={(v) => setModel(v as ModelKind)}>
                  <SelectTrigger className="w-full" aria-label="Model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_KINDS.map((k) => {
                      const f = analysis.fits.find((q) => q.kind === k);
                      return (
                        <SelectItem key={k} value={k} disabled={!!f && !f.ok}>
                          {MODEL_LABEL[k]}
                          {f && !f.ok ? ' (n/a)' : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Confidence level" className="w-[110px]">
                <Select value={confidence} onValueChange={setConfidence}>
                  <SelectTrigger className="w-full" aria-label="Confidence level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.9">90%</SelectItem>
                    <SelectItem value="0.95">95%</SelectItem>
                    <SelectItem value="0.99">99%</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {best && (
                <Button variant="secondary" size="sm" onClick={() => setModel(best.kind)} className="mb-0.5">
                  Use best fit: {best.label}
                </Button>
              )}
            </div>
            {selected && !selected.ok && (
              <div className="px-3 pb-3">
                <ErrorBanner error={`${selected.label}: ${selected.reason}`} />
              </div>
            )}
          </Panel>

          {sel && (
            <>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
                {/* ---------------- chart ---------------- */}
                <Panel className="xl:col-span-3">
                  <PanelHeader title="Chart">
                    <Tabs value={chartTab} onValueChange={(v) => setChartTab(v as ChartTab)} className="mr-1">
                      <TabsList className="h-7">
                        <TabsTrigger value="fit" className="h-6">
                          Fit
                        </TabsTrigger>
                        <TabsTrigger value="residuals" className="h-6">
                          Residuals
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <DownloadButton data={() => exportSvgString()} filename="regression-chart.svg" mime="image/svg+xml" label="SVG" />
                    <DownloadButton data={exportPng} filename="regression-chart.png" mime="image/png" label="PNG" />
                  </PanelHeader>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b px-3 py-2 text-xs">
                    {chartTab === 'fit' ? (
                      <>
                        <label className="flex items-center gap-1.5">
                          <Checkbox checked={showCI} onCheckedChange={(c) => setShowCI(c === true)} />
                          {confPct}% confidence band (mean)
                        </label>
                        <label className="flex items-center gap-1.5">
                          <Checkbox checked={showPI} onCheckedChange={(c) => setShowPI(c === true)} />
                          {confPct}% prediction band
                        </label>
                      </>
                    ) : (
                      <label className="flex items-center gap-2">
                        Residuals vs
                        <Select value={residualAxis} onValueChange={(v) => setResidualAxis(v as 'x' | 'fitted')}>
                          <SelectTrigger size="sm" className="w-[110px]" aria-label="Residual x axis">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="x">{xLabel.length > 14 ? 'x' : xLabel}</SelectItem>
                            <SelectItem value="fitted">fitted ŷ</SelectItem>
                          </SelectContent>
                        </Select>
                      </label>
                    )}
                  </div>
                  <div ref={chartRef} className="w-full p-2" data-testid="chart" dangerouslySetInnerHTML={{ __html: screenSvg }} />
                  {exportError && <ErrorBanner error={exportError} className="m-2" />}
                  <StatBar
                    items={[
                      sel.equation,
                      chartTab === 'fit' && n > 3000 ? `plotting every ${Math.ceil(n / 3000)}th of ${n} points` : null,
                    ]}
                    className="h-auto min-h-7 py-1"
                  />
                </Panel>

                {/* ---------------- results ---------------- */}
                <div className="space-y-4 xl:col-span-2">
                  <Panel>
                    <PanelHeader title={`${sel.label} fit`}>
                      <CopyButton value={summaryText} label="Copy summary" />
                    </PanelHeader>
                    <div className="space-y-3 p-3">
                      <div className="rounded-md border bg-muted/30 p-3">
                        <div className="text-2xs uppercase tracking-wide text-muted-foreground">Equation</div>
                        <div className="mt-1 flex items-start justify-between gap-2">
                          <code className="break-all font-mono text-sm" data-testid="equation">
                            {sel.equation}
                          </code>
                          <CopyButton value={sel.equation} size="icon-sm" />
                        </div>
                        {sel.center && sel.kind !== 'linear' && (
                          <p className="mt-1 text-2xs text-muted-foreground">
                            Fitted internally on u = (x − {fmt(sel.center.mu)}) / {fmt(sel.center.scale)} for numerical stability;
                            coefficients above are converted back to powers of x.
                          </p>
                        )}
                        {sel.logResponse && (
                          <p className="mt-1 text-2xs text-muted-foreground">
                            Fitted by least squares on ln(y) (log-linear). R² and RMSE are computed on the original y scale.
                          </p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-3">
                        <StatCell label="R²" value={fmt(sel.r2)} />
                        <StatCell label="Adjusted R²" value={fmt(sel.adjR2)} />
                        <StatCell label="RMSE" value={fmt(sel.rmse)} />
                        <StatCell label="n" value={String(sel.n)} />
                        <StatCell label="Parameters" value={String(sel.k)} />
                        <StatCell label="AIC" value={fmt(sel.aic)} />
                      </div>
                    </div>
                  </Panel>

                  {/* prediction */}
                  <Panel>
                    <PanelHeader title="Predict" />
                    <div className="space-y-3 p-3">
                      <Field label={`Enter ${xLabel} to predict ${yLabel}`}>
                        <Input
                          value={predictX}
                          onChange={(e) => setPredictX(e.target.value)}
                          inputMode="decimal"
                          className="font-mono"
                          placeholder="e.g. 12"
                          aria-label="x to predict"
                        />
                      </Field>
                      {pred && 'error' in pred && <ErrorBanner error={pred.error} />}
                      {pred && !('error' in pred) && (
                        <div className="space-y-2" data-testid="prediction">
                          <div className="rounded-md border bg-muted/30 p-3">
                            <div className="text-2xs uppercase tracking-wide text-muted-foreground">Predicted ŷ</div>
                            <div className="flex items-center justify-between font-mono text-xl font-semibold tabular-nums">
                              {fmt(pred.mean.yhat, 8)}
                              <CopyButton value={fmt(pred.mean.yhat, 10)} size="icon-sm" />
                            </div>
                          </div>
                          <dl className="divide-y rounded-md border text-xs">
                            <div className="flex justify-between gap-2 px-3 py-1.5">
                              <dt className="text-muted-foreground">{confPct}% CI for the mean response</dt>
                              <dd className="font-mono tabular-nums">
                                [{fmt(pred.mean.lo, 6)}, {fmt(pred.mean.hi, 6)}]
                              </dd>
                            </div>
                            <div className="flex justify-between gap-2 px-3 py-1.5">
                              <dt className="text-muted-foreground">{confPct}% prediction interval (new obs.)</dt>
                              <dd className="font-mono tabular-nums">
                                [{fmt(pred.obs.lo, 6)}, {fmt(pred.obs.hi, 6)}]
                              </dd>
                            </div>
                          </dl>
                          {pred.extrapolating && (
                            <p className="text-2xs text-destructive">
                              This x is outside the range of your data: extrapolated predictions are unreliable.
                            </p>
                          )}
                          {sel.logResponse && (
                            <p className="text-2xs text-muted-foreground">
                              Intervals are computed on the log scale and back-transformed.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </Panel>
                </div>
              </div>

              {/* ---------------- linear inference ---------------- */}
              {sel.kind === 'linear' && lin && (
                <Panel>
                  <PanelHeader title="Linear regression statistics">
                    <CopyButton value={summaryText} label="Copy" />
                  </PanelHeader>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-2xs uppercase tracking-wide text-muted-foreground">
                          <th className="px-3 py-1.5 font-medium">Coefficient</th>
                          <th className="px-3 py-1.5 text-right font-medium">Estimate</th>
                          <th className="px-3 py-1.5 text-right font-medium">Std. error</th>
                          <th className="px-3 py-1.5 text-right font-medium">t</th>
                          <th className="px-3 py-1.5 text-right font-medium">p-value</th>
                          <th className="px-3 py-1.5 text-right font-medium">{confPct}% CI lower</th>
                          <th className="px-3 py-1.5 text-right font-medium">{confPct}% CI upper</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono text-xs tabular-nums">
                        <tr className="border-b">
                          <td className="px-3 py-1.5 font-sans text-sm">Slope</td>
                          <td className="px-3 py-1.5 text-right" data-testid="slope">{fmt(lin.slope)}</td>
                          <td className="px-3 py-1.5 text-right">{fmt(lin.seSlope)}</td>
                          <td className="px-3 py-1.5 text-right">{fmt(lin.tSlope)}</td>
                          <td className="px-3 py-1.5 text-right">{fmtP(lin.pSlope)}</td>
                          <td className="px-3 py-1.5 text-right">{fmt(lin.ciSlope[0])}</td>
                          <td className="px-3 py-1.5 text-right">{fmt(lin.ciSlope[1])}</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-1.5 font-sans text-sm">Intercept</td>
                          <td className="px-3 py-1.5 text-right" data-testid="intercept">{fmt(lin.intercept)}</td>
                          <td className="px-3 py-1.5 text-right">{fmt(lin.seIntercept)}</td>
                          <td className="px-3 py-1.5 text-right">{fmt(lin.tIntercept)}</td>
                          <td className="px-3 py-1.5 text-right">{fmtP(lin.pIntercept)}</td>
                          <td className="px-3 py-1.5 text-right">{fmt(lin.ciIntercept[0])}</td>
                          <td className="px-3 py-1.5 text-right">{fmt(lin.ciIntercept[1])}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="grid grid-cols-2 gap-px border-t bg-border sm:grid-cols-4 lg:grid-cols-7">
                    <StatCell label="R (Pearson)" value={fmt(lin.r)} />
                    <StatCell label="R²" value={fmt(lin.r2)} />
                    <StatCell label="Adjusted R²" value={fmt(lin.adjR2)} />
                    <StatCell label="Std error of estimate" value={fmt(lin.s)} />
                    <StatCell label={`F (1, ${lin.df})`} value={fmt(lin.F)} />
                    <StatCell label="p (F-test)" value={fmtP(lin.pF)} />
                    <StatCell label="n" value={String(lin.n)} />
                  </div>
                  {lin.df < 1 && (
                    <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                      With only 2 points the line fits exactly; standard errors and p-values need at least 3 points.
                    </p>
                  )}
                </Panel>
              )}
              {sel.kind === 'linear' && linError && <ErrorBanner error={linError} />}
            </>
          )}

          {/* ---------------- correlation ---------------- */}
          <Panel>
            <PanelHeader title="Correlation">
              <CopyButton
                value={() =>
                  [
                    `Pearson r = ${fmt(analysis.pe.r)} (p = ${fmtP(analysis.pe.p)})`,
                    analysis.sp ? `Spearman rho = ${fmt(analysis.sp.rho)} (p = ${fmtP(analysis.sp.p)})` : '',
                    analysis.ke ? `Kendall tau-b = ${fmt(analysis.ke.tau)} (p = ${fmtP(analysis.ke.p)})` : '',
                  ]
                    .filter(Boolean)
                    .join('\n')
                }
              />
            </PanelHeader>
            <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-3">
              <StatCell
                label="Pearson r (linear)"
                value={fmt(analysis.pe.r)}
                sub={
                  <>
                    p = {fmtP(analysis.pe.p)}
                    {analysis.pe.ci && (
                      <>
                        <br />
                        {confPct}% CI [{fmt(analysis.pe.ci[0], 4)}, {fmt(analysis.pe.ci[1], 4)}]
                      </>
                    )}
                  </>
                }
              />
              <StatCell
                label="Spearman rho (rank)"
                value={analysis.sp ? fmt(analysis.sp.rho) : '—'}
                sub={analysis.sp ? `p = ${fmtP(analysis.sp.p)} · ties use average ranks` : 'needs n ≥ 3'}
              />
              <StatCell
                label="Kendall tau-b"
                value={analysis.ke ? fmt(analysis.ke.tau) : '—'}
                sub={analysis.ke ? `p = ${fmtP(analysis.ke.p)} · ${analysis.ke.method}` : 'needs n ≥ 3'}
              />
            </div>
            <StatBar items={[`n = ${n}`, 'p-values are two-sided']} />
          </Panel>

          {/* ---------------- model comparison ---------------- */}
          <Panel>
            <PanelHeader title="Best fit comparison">
              <label className="flex items-center gap-2 pr-1 text-xs text-muted-foreground">
                Rank by
                <Select value={rankBy} onValueChange={(v) => setRankBy(v as RankBy)}>
                  <SelectTrigger size="sm" className="w-[130px]" aria-label="Rank models by">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adjR2">Adjusted R²</SelectItem>
                    <SelectItem value="r2">R²</SelectItem>
                    <SelectItem value="rmse">RMSE</SelectItem>
                    <SelectItem value="aic">AIC</SelectItem>
                    <SelectItem value="aicc">AICc</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <CopyButton
                value={() =>
                  [
                    'model,params,R2,adjR2,RMSE,AIC,AICc',
                    ...ranked.map((f) => [f.label, f.k, f.r2, f.adjR2, f.rmse, f.aic, f.aicc].join(',')),
                  ].join('\n')
                }
                label="Copy CSV"
              />
            </PanelHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="compare-table">
                <thead>
                  <tr className="border-b text-left text-2xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-1.5 font-medium">#</th>
                    <th className="px-3 py-1.5 font-medium">Model</th>
                    <th className="px-3 py-1.5 text-right font-medium">Params</th>
                    <th className="px-3 py-1.5 text-right font-medium">R²</th>
                    <th className="px-3 py-1.5 text-right font-medium">Adj. R²</th>
                    <th className="px-3 py-1.5 text-right font-medium">RMSE</th>
                    <th className="px-3 py-1.5 text-right font-medium">AIC</th>
                    <th className="px-3 py-1.5 text-right font-medium">AICc</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-xs tabular-nums">
                  {ranked.map((f, i) => (
                    <tr
                      key={f.kind}
                      onClick={() => setModel(f.kind)}
                      className={cn('cursor-pointer border-b hover:bg-accent/50', f.kind === model && 'bg-accent/60')}
                    >
                      <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-1.5 font-sans text-sm">
                        {f.label}
                        {i === 0 && <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 font-sans text-2xs text-primary">best</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right">{f.k}</td>
                      <td className="px-3 py-1.5 text-right">{fmt(f.r2, 5)}</td>
                      <td className="px-3 py-1.5 text-right">{fmt(f.adjR2, 5)}</td>
                      <td className="px-3 py-1.5 text-right">{fmt(f.rmse, 5)}</td>
                      <td className="px-3 py-1.5 text-right">{fmt(f.aic, 5)}</td>
                      <td className="px-3 py-1.5 text-right">{fmt(f.aicc, 5)}</td>
                    </tr>
                  ))}
                  {analysis.fits
                    .filter((f) => !f.ok)
                    .map((f) => (
                      <tr key={f.kind} className="border-b text-muted-foreground last:border-0">
                        <td className="px-3 py-1.5">–</td>
                        <td className="px-3 py-1.5 font-sans text-sm">{f.label}</td>
                        <td className="px-3 py-1.5 font-sans text-xs" colSpan={6}>
                          {f.ok ? '' : f.reason}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p className="border-t px-3 py-2 text-2xs text-muted-foreground">
              All metrics use the original y scale so models are comparable. Higher-degree polynomials always raise R²; adjusted
              R² and AIC/AICc penalise extra parameters. Click a row to inspect that model. AIC = n·ln(SSE/n) + 2k.
            </p>
          </Panel>

          {/* ---------------- residuals table ---------------- */}
          {sel && (
            <Panel>
              <PanelHeader title={`Residuals (${sel.label})`}>
                <CopyButton value={resCsv} label="Copy CSV" />
                <DownloadButton data={() => resCsv} filename="residuals.csv" mime="text/csv" label="CSV" />
              </PanelHeader>
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b text-left text-2xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-1.5 font-medium">#</th>
                      <th className="px-3 py-1.5 text-right font-medium">x</th>
                      <th className="px-3 py-1.5 text-right font-medium">y</th>
                      <th className="px-3 py-1.5 text-right font-medium">Fitted ŷ</th>
                      <th className="px-3 py-1.5 text-right font-medium">Residual</th>
                      <th className="px-3 py-1.5 text-right font-medium">Std. residual</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-xs tabular-nums">
                    {data.xs.slice(0, maxRows).map((x, i) => {
                      const sr = sel.stdResiduals[i] ?? NaN;
                      return (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-3 py-1 text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-1 text-right">{fmt(x, 8)}</td>
                          <td className="px-3 py-1 text-right">{fmt(data.ys[i] ?? NaN, 8)}</td>
                          <td className="px-3 py-1 text-right">{fmt(sel.fitted[i] ?? NaN, 8)}</td>
                          <td className="px-3 py-1 text-right">{fmt(sel.residuals[i] ?? NaN, 6)}</td>
                          <td className={cn('px-3 py-1 text-right', Math.abs(sr) > 2 && 'font-semibold text-destructive')}>
                            {fmt(sr, 4)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <StatBar
                items={[
                  n > maxRows ? `showing first ${maxRows} of ${n} rows (CSV has all)` : `${n} rows`,
                  `SSE = ${fmt(sel.sse)}`,
                  '|std. residual| > 2 highlighted',
                ]}
              />
            </Panel>
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Ordinary least squares computed in your browser (Householder QR; polynomial x is centred and scaled). Inference assumes
        independent, roughly normal errors with constant variance: check the residual plot. Kendall&apos;s p is exact for n ≤ 33
        without ties and asymptotic otherwise. Exponential and power models are fitted in log space; no data leaves your device.
      </p>
    </div>
  );
}
