'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Plus, X, ZoomIn, ZoomOut, Maximize2, RotateCcw, Sparkles } from 'lucide-react';
import { Panel, PanelHeader, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  analyzeRow,
  clipSegment,
  compileRow,
  decodeHashState,
  describeError,
  encodeHashState,
  findExtrema,
  findIntersections,
  findRoots,
  fmtNum,
  integrate,
  niceTicks,
  robustRange,
  sampleFunction,
  samplePolar,
  sampleParametric,
  tableCsv,
  tickLabel,
  valueTable,
  type Bounds,
  type CompiledRow,
  type Fn1,
  type HashRow,
  type HashState,
  type RowError,
  type RowInput,
  type RowMode,
} from './logic';

/* ------------------------------------------------------------------ */
/* Types & constants                                                   */
/* ------------------------------------------------------------------ */

interface Row extends RowInput {
  id: number;
  visible: boolean;
  color: string;
}

interface ParamState {
  value: number;
  lo: number;
  hi: number;
  step: number;
}

interface ViewState {
  cx: number;
  cy: number;
  /** x units per CSS pixel */
  ux: number;
  /** y units per CSS pixel */
  uy: number;
}

interface ThemeColors {
  bg: string;
  fg: string;
  muted: string;
  grid: string;
  axis: string;
}

interface CurveData {
  id: number;
  index: number;
  color: string;
  mode: RowMode;
  poly: number[];
  c?: number;
  f?: Fn1;
}

interface ShadeData {
  color: string;
  pieces: number[][];
}

interface Scene {
  w: number;
  h: number;
  view: ViewState;
  colors: ThemeColors;
  curves: CurveData[];
  shade: ShadeData | null;
}

const MAX_ROWS = 8;
const PALETTE_LIGHT = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#db2777', '#65a30d'];
const PALETTE_DARK = ['#60a5fa', '#f87171', '#4ade80', '#fbbf24', '#c084fc', '#22d3ee', '#f472b6', '#a3e635'];

function colorOf(c: string, dark: boolean): string {
  const m = /^p([0-7])$/.exec(c);
  if (m) return (dark ? PALETTE_DARK : PALETTE_LIGHT)[Number(m[1])] ?? '#2563eb';
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#2563eb';
}

const MODE_LABEL: Record<RowMode, string> = {
  y: 'y = f(x)',
  polar: 'r = f(θ)',
  param: 'x(t), y(t)',
  vline: 'x = c',
};

const DEFAULT_PARAM: ParamState = { value: 1, lo: -5, hi: 5, step: 0.1 };

function mkRow(id: number, mode: RowMode, expr: string, color: string, extra: Partial<Row> = {}): Row {
  return { id, mode, expr, expr2: '', tMin: '', tMax: '', visible: true, color, ...extra };
}

interface Example {
  label: string;
  rows: Omit<Row, 'id'>[];
  params?: Record<string, ParamState>;
  bounds?: Bounds;
}

const ex = (mode: RowMode, expr: string, color: string, extra: Partial<Row> = {}): Omit<Row, 'id'> => ({
  mode,
  expr,
  expr2: '',
  tMin: '',
  tMax: '',
  visible: true,
  color,
  ...extra,
});

const EXAMPLES: Example[] = [
  {
    label: 'Sine and a parabola with a slider',
    rows: [ex('y', 'sin(x)', 'p0'), ex('y', 'a*x^2 - 2', 'p1')],
    params: { a: { value: 0.2, lo: -1, hi: 1, step: 0.05 } },
  },
  {
    label: 'Amplitude / frequency sliders',
    rows: [ex('y', 'a*sin(b*x)', 'p0'), ex('y', 'a*cos(b*x)', 'p2')],
    params: { a: { value: 2, lo: 0, hi: 5, step: 0.1 }, b: { value: 1.5, lo: 0, hi: 5, step: 0.1 } },
  },
  {
    label: 'Cubic: roots and extrema',
    rows: [ex('y', 'x^3 - 3x + 1', 'p0'), ex('y', 'x', 'p3')],
    bounds: { xmin: -4, xmax: 4, ymin: -4, ymax: 4 },
  },
  {
    label: 'Poles and asymptotes: tan(x), 1/x',
    rows: [ex('y', 'tan(x)', 'p0'), ex('y', '1/x', 'p1'), ex('vline', 'x = 2', 'p4')],
    bounds: { xmin: -7, xmax: 7, ymin: -5, ymax: 5 },
  },
  {
    label: 'Polar rose r = cos(kθ)',
    rows: [ex('polar', 'cos(k*θ)', 'p1', { tMin: '0', tMax: '2pi' })],
    params: { k: { value: 4, lo: 1, hi: 9, step: 1 } },
    bounds: { xmin: -2, xmax: 2, ymin: -1.5, ymax: 1.5 },
  },
  {
    label: 'Cardioid and circle (polar)',
    rows: [ex('polar', '1 + cos(θ)', 'p0', { tMin: '0', tMax: '2pi' }), ex('polar', '1.5', 'p2', { tMin: '0', tMax: '2pi' })],
    bounds: { xmin: -3, xmax: 3, ymin: -2.2, ymax: 2.2 },
  },
  {
    label: 'Lissajous curve (parametric)',
    rows: [ex('param', 'sin(a*t)', 'p4', { expr2: 'sin(b*t)', tMin: '0', tMax: '2pi' })],
    params: { a: { value: 3, lo: 1, hi: 9, step: 1 }, b: { value: 2, lo: 1, hi: 9, step: 1 } },
    bounds: { xmin: -1.6, xmax: 1.6, ymin: -1.2, ymax: 1.2 },
  },
  {
    label: 'Gaussian bell and sinc',
    rows: [ex('y', 'e^(-x^2)', 'p0'), ex('y', 'sin(pi x)/(pi x)', 'p5')],
    bounds: { xmin: -5, xmax: 5, ymin: -0.5, ymax: 1.3 },
  },
];

const DEFAULT_ROWS: Row[] = EXAMPLES[0]!.rows.map((r, i) => ({ ...r, id: i + 1 }));
const DEFAULT_PARAMS: Record<string, ParamState> = { ...(EXAMPLES[0]!.params ?? {}) };

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */

function boundsOf(view: ViewState, w: number, h: number): Bounds {
  return {
    xmin: view.cx - (w * view.ux) / 2,
    xmax: view.cx + (w * view.ux) / 2,
    ymin: view.cy - (h * view.uy) / 2,
    ymax: view.cy + (h * view.uy) / 2,
  };
}

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

function readTheme(): ThemeColors {
  const fg = resolveColor('var(--foreground)');
  const muted = resolveColor('var(--muted-foreground)');
  const border = resolveColor('var(--border)');
  return { bg: resolveColor('var(--card)'), fg, muted, grid: border, axis: muted };
}

function withAlpha(rgb: string, a: number): string {
  const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(rgb);
  if (m) return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${a})`;
  const h = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(rgb);
  if (h) return `rgba(${parseInt(h[1] ?? '0', 16)}, ${parseInt(h[2] ?? '0', 16)}, ${parseInt(h[3] ?? '0', 16)}, ${a})`;
  return rgb;
}

const FONT = '11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

function drawScene(ctx: CanvasRenderingContext2D, sc: Scene): void {
  const { w, h, view, colors } = sc;
  const b = boundsOf(view, w, h);
  const sx = (x: number) => (x - b.xmin) / view.ux;
  const sy = (y: number) => (b.ymax - y) / view.uy;

  ctx.save();
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, w, h);

  // ---- grid ----
  const xt = niceTicks(b.xmin, b.xmax, Math.max(2, Math.floor(w / 95)));
  const yt = niceTicks(b.ymin, b.ymax, Math.max(2, Math.floor(h / 70)));
  const minorDiv = (step: number) => {
    const m = step / Math.pow(10, Math.floor(Math.log10(step)));
    return Math.round(m) === 2 ? 4 : 5;
  };
  ctx.lineWidth = 1;
  const minorLines = (ticks: { ticks: number[]; step: number }, lo: number, hi: number, vertical: boolean) => {
    if (ticks.step <= 0 || !Number.isFinite(ticks.step)) return;
    const n = minorDiv(ticks.step);
    const sub = ticks.step / n;
    const start = Math.floor(lo / sub) * sub;
    ctx.strokeStyle = withAlpha(colors.grid, 0.45);
    ctx.beginPath();
    for (let i = 0, v = start; v <= hi && i < 4000; i++, v = start + (i * sub)) {
      const p = vertical ? Math.round(sx(v)) + 0.5 : Math.round(sy(v)) + 0.5;
      if (vertical) {
        ctx.moveTo(p, 0);
        ctx.lineTo(p, h);
      } else {
        ctx.moveTo(0, p);
        ctx.lineTo(w, p);
      }
    }
    ctx.stroke();
  };
  minorLines(xt, b.xmin, b.xmax, true);
  minorLines(yt, b.ymin, b.ymax, false);
  ctx.strokeStyle = colors.grid;
  ctx.beginPath();
  for (const t of xt.ticks) {
    const p = Math.round(sx(t)) + 0.5;
    ctx.moveTo(p, 0);
    ctx.lineTo(p, h);
  }
  for (const t of yt.ticks) {
    const p = Math.round(sy(t)) + 0.5;
    ctx.moveTo(0, p);
    ctx.lineTo(w, p);
  }
  ctx.stroke();

  // ---- axes + labels ----
  const x0 = sx(0);
  const y0 = sy(0);
  const axisX = Math.min(Math.max(y0, 0), h);
  const axisY = Math.min(Math.max(x0, 0), w);
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, Math.round(axisX) + 0.5);
  ctx.lineTo(w, Math.round(axisX) + 0.5);
  ctx.moveTo(Math.round(axisY) + 0.5, 0);
  ctx.lineTo(Math.round(axisY) + 0.5, h);
  ctx.stroke();

  ctx.font = FONT;
  ctx.fillStyle = colors.muted;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  const labelBelow = axisX < h - 18;
  for (const t of xt.ticks) {
    if (t === 0 && x0 >= 0 && x0 <= w && y0 >= 0 && y0 <= h) continue;
    const px = sx(t);
    if (px < 14 || px > w - 14) continue;
    ctx.fillText(tickLabel(t, xt.step), px, labelBelow ? axisX + 4 : axisX - 16);
  }
  ctx.textAlign = axisY > 44 ? 'right' : 'left';
  ctx.textBaseline = 'middle';
  for (const t of yt.ticks) {
    if (t === 0 && x0 >= 0 && x0 <= w && y0 >= 0 && y0 <= h) continue;
    const py = sy(t);
    if (py < 10 || py > h - 10) continue;
    ctx.fillText(tickLabel(t, yt.step), axisY > 44 ? axisY - 5 : axisY + 5, py);
  }
  if (x0 >= 0 && x0 <= w && y0 >= 0 && y0 <= h) {
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('0', x0 - 4, y0 + 4);
  }

  // ---- integral shading ----
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  if (sc.shade) {
    ctx.fillStyle = withAlpha(sc.shade.color, 0.28);
    const base = sy(0);
    for (const piece of sc.shade.pieces) {
      if (piece.length < 4) continue;
      ctx.beginPath();
      ctx.moveTo(sx(piece[0] as number), base);
      for (let i = 0; i < piece.length; i += 2) {
        ctx.lineTo(sx(piece[i] as number), Math.max(-1e5, Math.min(1e5, sy(piece[i + 1] as number))));
      }
      ctx.lineTo(sx(piece[piece.length - 2] as number), base);
      ctx.closePath();
      ctx.fill();
    }
  }

  // ---- curves ----
  ctx.lineWidth = 2.25;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const M = 200;
  for (const c of sc.curves) {
    ctx.strokeStyle = c.color;
    ctx.beginPath();
    if (c.mode === 'vline') {
      const p = Math.round(sx(c.c ?? 0)) + 0.5;
      ctx.moveTo(p, 0);
      ctx.lineTo(p, h);
      ctx.stroke();
      continue;
    }
    const pts = c.poly;
    let penDown = false;
    let lastX = NaN;
    let lastY = NaN;
    let px0 = NaN;
    let py0 = NaN;
    for (let i = 0; i < pts.length; i += 2) {
      const wx = pts[i] as number;
      const wy = pts[i + 1] as number;
      if (Number.isNaN(wx) || Number.isNaN(wy)) {
        penDown = false;
        px0 = NaN;
        continue;
      }
      const px = sx(wx);
      const py = sy(wy);
      if (!Number.isNaN(px0)) {
        const seg = clipSegment(px0, py0, px, py, -M, -M, w + M, h + M);
        if (seg) {
          if (!penDown || Math.abs(seg[0] - lastX) > 1e-6 || Math.abs(seg[1] - lastY) > 1e-6) ctx.moveTo(seg[0], seg[1]);
          ctx.lineTo(seg[2], seg[3]);
          lastX = seg[2];
          lastY = seg[3];
          penDown = true;
        } else penDown = false;
      }
      px0 = px;
      py0 = py;
    }
    ctx.stroke();
  }
  ctx.restore();

  // frame
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Hash helpers                                                        */
/* ------------------------------------------------------------------ */

function rowsFromHash(hs: HashState): Row[] {
  return hs.r.map((r, i) => ({
    id: i + 1,
    mode: r.m,
    expr: r.e,
    expr2: r.e2 ?? '',
    tMin: r.a ?? '',
    tMax: r.b ?? '',
    visible: r.v !== 0,
    color: r.c ?? `p${i % 8}`,
  }));
}

function paramsFromHash(hs: HashState): Record<string, ParamState> {
  const out: Record<string, ParamState> = {};
  for (const [k, v] of Object.entries(hs.p)) out[k] = { value: v.v, lo: v.lo, hi: v.hi, step: v.s };
  return out;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

function viewFromBounds(b: Bounds, w: number, h: number): ViewState {
  return { cx: (b.xmin + b.xmax) / 2, cy: (b.ymin + b.ymax) / 2, ux: (b.xmax - b.xmin) / w, uy: (b.ymax - b.ymin) / h };
}

function parseNum(s: string): number | null {
  const t = s.trim().replace(/−/g, '-');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function FunctionGrapher() {
  const [rows, setRows] = useState<Row[]>(DEFAULT_ROWS);
  const [params, setParams] = useState<Record<string, ParamState>>(DEFAULT_PARAMS);
  const [equal, setEqual] = useState(true);
  const [dark, setDark] = useState(false);
  const [colors, setColors] = useState<ThemeColors | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState<ViewState | null>(null);
  const [colorOpen, setColorOpen] = useState<number | null>(null);
  const nextId = useRef(100);

  // analysis state
  const [anaId, setAnaId] = useState<number | null>(null);
  const [secondId, setSecondId] = useState<number | null>(null);
  const [intA, setIntA] = useState('0');
  const [intB, setIntB] = useState('3.14159');
  const [shadeOn, setShadeOn] = useState(true);
  const [tStart, setTStart] = useState('-5');
  const [tEnd, setTEnd] = useState('5');
  const [tStep, setTStep] = useState('1');
  const [anaBounds, setAnaBounds] = useState<Bounds | null>(null);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const readoutRef = useRef<HTMLDivElement | null>(null);
  const pendingBounds = useRef<Bounds | null>(null);
  const hashReady = useRef(false);

  /* ---------- theme ---------- */
  useEffect(() => {
    const el = document.documentElement;
    const update = () => {
      setDark(el.classList.contains('dark'));
      setColors(readTheme());
    };
    update();
    const mo = new MutationObserver(update);
    mo.observe(el, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    return () => mo.disconnect();
  }, []);

  /* ---------- size ---------- */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const w = Math.max(280, Math.floor(el.getBoundingClientRect().width));
      const h = Math.round(Math.min(Math.max(w * 0.62, 340), 620));
      setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---------- initial view / resize ---------- */
  const initView = useCallback((w: number, h: number, bounds?: Bounds): ViewState => {
    if (bounds) return viewFromBounds(bounds, w, h);
    const ux = 20 / w;
    return { cx: 0, cy: 0, ux, uy: ux };
  }, []);

  useEffect(() => {
    if (!size) return;
    setView((prev) => {
      if (prev) return prev;
      const pb = pendingBounds.current;
      pendingBounds.current = null;
      return initView(size.w, size.h, pb ?? undefined);
    });
  }, [size, initView]);

  /* ---------- read URL hash on mount ---------- */
  useEffect(() => {
    try {
      const m = /[#&]g=([^&]+)/.exec(window.location.hash);
      if (m && m[1]) {
        const hs = decodeHashState(m[1]);
        if (hs) {
          const r = rowsFromHash(hs);
          setRows(r);
          nextId.current = 100 + r.length;
          setParams(paramsFromHash(hs));
          if (hs.q !== undefined) setEqual(hs.q === 1);
          if (hs.w) pendingBounds.current = { xmin: hs.w[0], xmax: hs.w[1], ymin: hs.w[2], ymax: hs.w[3] };
          setView((prev) => {
            if (prev && pendingBounds.current && size) return viewFromBounds(pendingBounds.current, size.w, size.h);
            return prev;
          });
        }
      }
    } catch {
      /* ignore malformed hash */
    }
    hashReady.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- compile rows ---------- */
  const analyses = useMemo(() => rows.map((r) => analyzeRow(r)), [rows]);
  const usedParams = useMemo(() => {
    const names: string[] = [];
    for (const a of analyses) for (const n of a.names) if (!names.includes(n)) names.push(n);
    return names.sort();
  }, [analyses]);

  useEffect(() => {
    setParams((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const n of usedParams) {
        if (!next[n]) {
          next[n] = { ...DEFAULT_PARAM };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [usedParams]);

  const paramValues = useMemo(() => {
    const v: Record<string, number> = {};
    for (const n of usedParams) v[n] = params[n]?.value ?? 1;
    return v;
  }, [usedParams, params]);

  const compiled = useMemo(
    () => rows.map((r) => compileRow(r, paramValues)),
    [rows, paramValues]
  );

  /* ---------- curves ---------- */
  const curves = useMemo<CurveData[]>(() => {
    if (!size || !view) return [];
    const b = boundsOf(view, size.w, size.h);
    const opt = { width: size.w, height: size.h };
    const out: CurveData[] = [];
    rows.forEach((r, i) => {
      const c = compiled[i];
      if (!r.visible || !c || !c.ok) return;
      const color = colorOf(r.color, dark);
      const cr: CompiledRow = c.row;
      if (cr.mode === 'y' && cr.f) out.push({ id: r.id, index: i, color, mode: 'y', poly: sampleFunction(cr.f, b, opt), f: cr.f });
      else if (cr.mode === 'vline') out.push({ id: r.id, index: i, color, mode: 'vline', poly: [], c: cr.c });
      else if (cr.mode === 'polar' && cr.f) out.push({ id: r.id, index: i, color, mode: 'polar', poly: samplePolar(cr.f, cr.t0, cr.t1, b, opt) });
      else if (cr.mode === 'param' && cr.fx && cr.fy) {
        out.push({ id: r.id, index: i, color, mode: 'param', poly: sampleParametric(cr.fx, cr.fy, cr.t0, cr.t1, b, opt) });
      }
    });
    return out;
  }, [rows, compiled, size, view, dark]);

  /* ---------- analysis target rows ---------- */
  const yRows = useMemo(() => {
    const out: { id: number; index: number; f: Fn1; label: string }[] = [];
    rows.forEach((r, i) => {
      const c = compiled[i];
      if (c && c.ok && c.row.mode === 'y' && c.row.f) out.push({ id: r.id, index: i, f: c.row.f, label: `f${i + 1}: ${r.expr.trim() || '(empty)'}` });
    });
    return out;
  }, [rows, compiled]);

  const anaRow = yRows.find((r) => r.id === anaId) ?? yRows[0] ?? null;
  const secondRow = yRows.find((r) => r.id === secondId && r.id !== anaRow?.id) ?? yRows.find((r) => r.id !== anaRow?.id) ?? null;

  /* debounce analysis bounds to the view */
  useEffect(() => {
    if (!size || !view) return;
    const t = setTimeout(() => setAnaBounds(boundsOf(view, size.w, size.h)), 180);
    return () => clearTimeout(t);
  }, [view, size]);

  const analysis = useMemo(() => {
    if (!anaRow || !anaBounds) return null;
    const { xmin, xmax } = anaBounds;
    const f = anaRow.f;
    const roots = findRoots(f, xmin, xmax);
    const extrema = findExtrema(f, xmin, xmax);
    const y0 = f(0);
    const inter = secondRow ? findIntersections(f, secondRow.f, xmin, xmax) : [];
    return { roots, extrema, y0, inter, xmin, xmax };
  }, [anaRow, secondRow, anaBounds]);

  const integral = useMemo(() => {
    if (!anaRow) return null;
    const a = parseNum(intA);
    const b = parseNum(intB);
    if (a === null || b === null) return { error: 'Enter numeric bounds a and b.' } as const;
    return { a, b, res: integrate(anaRow.f, a, b) } as const;
  }, [anaRow, intA, intB]);

  const table = useMemo(() => {
    if (!anaRow) return null;
    const s = parseNum(tStart);
    const e = parseNum(tEnd);
    const st = parseNum(tStep);
    if (s === null || e === null || st === null) return { kind: 'err', error: 'Enter numeric start, end and step.' } as const;
    if (!(st > 0)) return { kind: 'err', error: 'Step must be greater than 0.' } as const;
    if (e < s) return { kind: 'err', error: 'End must be at least the start.' } as const;
    const rowsT = valueTable(anaRow.f, s, e, st, 5000);
    return { kind: 'ok', rows: rowsT, truncated: (e - s) / st > 5000 } as const;
  }, [anaRow, tStart, tEnd, tStep]);

  /* ---------- shading ---------- */
  const shade = useMemo<ShadeData | null>(() => {
    if (!shadeOn || !anaRow || !integral || 'error' in integral || !size || !view) return null;
    const lo = Math.min(integral.a, integral.b);
    const hi = Math.max(integral.a, integral.b);
    if (!(hi > lo)) return null;
    const b = boundsOf(view, size.w, size.h);
    const wpx = Math.max(60, Math.min(4000, Math.round((hi - lo) / view.ux)));
    const poly = sampleFunction(anaRow.f, { xmin: lo, xmax: hi, ymin: b.ymin, ymax: b.ymax }, { width: wpx, height: size.h });
    const pieces: number[][] = [];
    let cur: number[] = [];
    for (let i = 0; i < poly.length; i += 2) {
      const x = poly[i] as number;
      const y = poly[i + 1] as number;
      if (Number.isNaN(x)) {
        if (cur.length) pieces.push(cur);
        cur = [];
        continue;
      }
      if (x < lo - 1e-12 || x > hi + 1e-12) continue;
      cur.push(x, y);
    }
    if (cur.length) pieces.push(cur);
    const row = rows[anaRow.index];
    return { color: colorOf(row?.color ?? 'p0', dark), pieces };
  }, [shadeOn, anaRow, integral, size, view, rows, dark]);

  /* ---------- scene + draw ---------- */
  const scene = useMemo<Scene | null>(() => {
    if (!size || !view || !colors) return null;
    return { w: size.w, h: size.h, view, colors, curves, shade };
  }, [size, view, colors, curves, shade]);

  const sceneRef = useRef<Scene | null>(null);

  useEffect(() => {
    sceneRef.current = scene;
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay || !scene) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    for (const c of [canvas, overlay]) {
      c.width = Math.round(scene.w * dpr);
      c.height = Math.round(scene.h * dpr);
      c.style.width = `${scene.w}px`;
      c.style.height = `${scene.h}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawScene(ctx, scene);
    const octx = overlay.getContext('2d');
    if (octx) octx.clearRect(0, 0, overlay.width, overlay.height);
  }, [scene]);

  /* ---------- hash write (debounced) ---------- */
  useEffect(() => {
    if (!hashReady.current) return;
    const t = setTimeout(() => {
      try {
        const hs: HashState = {
          v: 1,
          r: rows.map((r): HashRow => {
            const o: HashRow = { m: r.mode, e: r.expr };
            if (r.mode === 'param') o.e2 = r.expr2;
            if (r.mode === 'param' || r.mode === 'polar') {
              o.a = r.tMin;
              o.b = r.tMax;
            }
            if (!r.visible) o.v = 0;
            o.c = r.color;
            return o;
          }),
          p: Object.fromEntries(
            usedParams.map((n) => {
              const p = params[n] ?? DEFAULT_PARAM;
              return [n, { v: p.value, lo: p.lo, hi: p.hi, s: p.step }];
            })
          ),
          q: equal ? 1 : 0,
        };
        if (size && view) {
          const b = boundsOf(view, size.w, size.h);
          hs.w = [b.xmin, b.xmax, b.ymin, b.ymax];
        }
        const enc = encodeHashState(hs);
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#g=${enc}`);
      } catch {
        /* history may be unavailable (sandboxed iframes) */
      }
    }, 500);
    return () => clearTimeout(t);
  }, [rows, params, usedParams, equal, view, size]);

  /* ---------- interaction ---------- */
  const equalRef = useRef(equal);
  useEffect(() => {
    equalRef.current = equal;
  }, [equal]);

  const zoomAt = useCallback((f: number, px: number, py: number, mode: 'both' | 'x' | 'y' = 'both') => {
    setView((v) => {
      const sz = sceneRef.current;
      if (!v || !sz) return v;
      const eq = equalRef.current;
      const fx = mode === 'y' && !eq ? 1 : f;
      const fy = mode === 'x' && !eq ? 1 : f;
      const wx = v.cx + (px - sz.w / 2) * v.ux;
      const wy = v.cy - (py - sz.h / 2) * v.uy;
      const ux = Math.min(1e9 / sz.w, Math.max(1e-10, v.ux * fx));
      const uy = Math.min(1e9 / sz.h, Math.max(1e-10, v.uy * fy));
      return { ux, uy, cx: wx - (px - sz.w / 2) * ux, cy: wy + (py - sz.h / 2) * uy };
    });
  }, []);

  const panBy = useCallback((dx: number, dy: number) => {
    setView((v) => (v ? { ...v, cx: v.cx - dx * v.ux, cy: v.cy + dy * v.uy } : v));
  }, []);

  const resetView = useCallback(() => {
    if (!size) return;
    const ux = 20 / size.w;
    setView({ cx: 0, cy: 0, ux, uy: equal ? ux : 12 / size.h });
  }, [size, equal]);

  const autoFit = useCallback(() => {
    if (!size || !view) return;
    const b = boundsOf(view, size.w, size.h);
    const opt = { width: size.w, height: size.h };
    const yRanges: [number, number][] = [];
    let bx0 = Infinity;
    let bx1 = -Infinity;
    let by0 = Infinity;
    let by1 = -Infinity;
    let hasXY = false;
    let hasY = false;
    const vlines: number[] = [];
    rows.forEach((r, i) => {
      const c = compiled[i];
      if (!r.visible || !c || !c.ok) return;
      const cr = c.row;
      if (cr.mode === 'y' && cr.f) {
        hasY = true;
        const N = 900;
        const vals: number[] = [];
        for (let k = 0; k <= N; k++) vals.push(cr.f(b.xmin + ((b.xmax - b.xmin) * k) / N));
        const rr = robustRange(vals);
        if (rr) yRanges.push(rr);
      } else if (cr.mode === 'vline') vlines.push(cr.c ?? 0);
      else {
        const poly =
          cr.mode === 'polar' && cr.f
            ? samplePolar(cr.f, cr.t0, cr.t1, { xmin: -1e6, xmax: 1e6, ymin: -1e6, ymax: 1e6 }, opt)
            : cr.fx && cr.fy
              ? sampleParametric(cr.fx, cr.fy, cr.t0, cr.t1, { xmin: -1e6, xmax: 1e6, ymin: -1e6, ymax: 1e6 }, opt)
              : [];
        for (let k = 0; k < poly.length; k += 2) {
          const x = poly[k] as number;
          const y = poly[k + 1] as number;
          if (Number.isNaN(x) || Math.abs(x) > 1e6 || Math.abs(y) > 1e6) continue;
          hasXY = true;
          bx0 = Math.min(bx0, x);
          bx1 = Math.max(bx1, x);
          by0 = Math.min(by0, y);
          by1 = Math.max(by1, y);
        }
      }
    });
    let xmin = b.xmin;
    let xmax = b.xmax;
    let ymin = Infinity;
    let ymax = -Infinity;
    if (hasXY) {
      xmin = bx0;
      xmax = bx1;
      ymin = by0;
      ymax = by1;
      if (hasY) {
        xmin = Math.min(xmin, b.xmin);
        xmax = Math.max(xmax, b.xmax);
      }
    }
    for (const r of yRanges) {
      ymin = Math.min(ymin, r[0]);
      ymax = Math.max(ymax, r[1]);
    }
    for (const c of vlines) {
      if (!hasXY && !hasY) {
        xmin = Math.min(xmin === b.xmin ? c : xmin, c);
        xmax = Math.max(xmax === b.xmax ? c : xmax, c);
      }
    }
    if (!Number.isFinite(ymin) || !Number.isFinite(ymax)) {
      ymin = b.ymin;
      ymax = b.ymax;
    }
    if (!(xmax > xmin)) {
      xmin -= 1;
      xmax += 1;
    }
    if (!(ymax > ymin)) {
      ymin -= 1;
      ymax += 1;
    }
    const padX = (xmax - xmin) * 0.08;
    const padY = (ymax - ymin) * 0.1;
    xmin -= padX;
    xmax += padX;
    ymin -= padY;
    ymax += padY;
    const cx = (xmin + xmax) / 2;
    const cy = (ymin + ymax) / 2;
    if (equal) {
      const u = Math.max((xmax - xmin) / size.w, (ymax - ymin) / size.h);
      setView({ cx, cy, ux: u, uy: u });
    } else {
      setView({ cx, cy, ux: (xmax - xmin) / size.w, uy: (ymax - ymin) / size.h });
    }
  }, [size, view, rows, compiled, equal]);

  const toggleEqual = (on: boolean) => {
    setEqual(on);
    if (on) setView((v) => (v ? { ...v, uy: v.ux } : v));
  };

  // pointer handling
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const lastPinch = useRef<{ d: number; cx: number; cy: number } | null>(null);
  const dragged = useRef(false);

  const localPos = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };

  const drawHover = useCallback((mx: number | null, my: number | null) => {
    const sc = sceneRef.current;
    const overlay = overlayRef.current;
    if (!sc || !overlay) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;
    const dpr = overlay.width / sc.w || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, sc.w, sc.h);
    const readout = readoutRef.current;
    if (mx === null || my === null) {
      if (readout) readout.textContent = 'Hover the plot to read values. Drag to pan, scroll or pinch to zoom.';
      return;
    }
    const b = boundsOf(sc.view, sc.w, sc.h);
    const wx = b.xmin + mx * sc.view.ux;
    const wy = b.ymax - my * sc.view.uy;
    if (readout) readout.textContent = `x = ${fmtNum(wx, 6)}   y = ${fmtNum(wy, 6)}`;
    const sxp = (x: number) => (x - b.xmin) / sc.view.ux;
    const syp = (y: number) => (b.ymax - y) / sc.view.uy;

    // candidate points per curve
    interface Cand { color: string; label: string; px: number; py: number; d: number; wxv: number; wyv: number; mode: RowMode; idx: number }
    const cands: Cand[] = [];
    for (const c of sc.curves) {
      const label = `f${c.index + 1}`;
      if (c.mode === 'y' && c.f) {
        const y = c.f(wx);
        if (Number.isFinite(y)) {
          const py = syp(y);
          cands.push({ color: c.color, label, px: mx, py, d: Math.abs(py - my), wxv: wx, wyv: y, mode: 'y', idx: c.index });
        } else cands.push({ color: c.color, label, px: mx, py: NaN, d: Infinity, wxv: wx, wyv: NaN, mode: 'y', idx: c.index });
      } else if (c.mode === 'vline') {
        const px = sxp(c.c ?? 0);
        cands.push({ color: c.color, label: `x = ${fmtNum(c.c ?? 0)}`, px, py: my, d: Math.abs(px - mx), wxv: c.c ?? 0, wyv: wy, mode: 'vline', idx: c.index });
      } else {
        let best = Infinity;
        let bx = NaN;
        let by = NaN;
        for (let i = 0; i < c.poly.length; i += 2) {
          const x = c.poly[i] as number;
          const y = c.poly[i + 1] as number;
          if (Number.isNaN(x)) continue;
          const dx = sxp(x) - mx;
          const dy = syp(y) - my;
          const d2 = dx * dx + dy * dy;
          if (d2 < best) {
            best = d2;
            bx = x;
            by = y;
          }
        }
        if (Number.isFinite(best)) cands.push({ color: c.color, label, px: sxp(bx), py: syp(by), d: Math.sqrt(best), wxv: bx, wyv: by, mode: c.mode, idx: c.index });
      }
    }
    let snap: Cand | null = null;
    for (const c of cands) if (c.d < 26 && (!snap || c.d < snap.d)) snap = c;

    // crosshair
    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = withAlpha(sc.colors.fg, 0.45);
    const cxp = snap ? snap.px : mx;
    ctx.beginPath();
    ctx.moveTo(Math.round(cxp) + 0.5, 0);
    ctx.lineTo(Math.round(cxp) + 0.5, sc.h);
    if (snap && Number.isFinite(snap.py)) {
      ctx.moveTo(0, Math.round(snap.py) + 0.5);
      ctx.lineTo(sc.w, Math.round(snap.py) + 0.5);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // dots on all y-mode curves
    for (const c of cands) {
      if (c.mode !== 'y' || !Number.isFinite(c.py) || c.py < -20 || c.py > sc.h + 20) continue;
      ctx.beginPath();
      ctx.arc(c.px, c.py, snap === c ? 5.5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = c.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = sc.colors.bg;
      ctx.stroke();
    }
    if (snap && snap.mode !== 'y') {
      ctx.beginPath();
      ctx.arc(snap.px, snap.py, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = snap.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = sc.colors.bg;
      ctx.stroke();
    }
    ctx.restore();

    // tooltip
    const lines: { text: string; color: string }[] = [];
    const xr = snap ? snap.wxv : wx;
    lines.push({ text: snap && snap.mode !== 'y' && snap.mode !== 'vline' ? `(${fmtNum(snap.wxv, 5)}, ${fmtNum(snap.wyv, 5)})` : `x = ${fmtNum(xr, 6)}`, color: sc.colors.fg });
    for (const c of cands) {
      if (c.mode === 'y') lines.push({ text: `${c.label}(x) = ${Number.isNaN(c.wyv) ? 'undefined' : fmtNum(c.wyv, 6)}`, color: c.color });
      else if (c.mode !== 'vline' && snap === c) lines.push({ text: `${c.label}: (${fmtNum(c.wxv, 5)}, ${fmtNum(c.wyv, 5)})`, color: c.color });
    }
    if (lines.length > 1 || (snap && snap.mode !== 'y')) {
      ctx.font = FONT;
      const lh = 15;
      const tw = Math.max(...lines.map((l) => ctx.measureText(l.text).width)) + 22;
      const th = lines.length * lh + 10;
      let tx = mx + 14;
      let ty = my + 14;
      if (tx + tw > sc.w - 4) tx = mx - tw - 14;
      if (ty + th > sc.h - 4) ty = my - th - 14;
      tx = Math.max(4, tx);
      ty = Math.max(4, ty);
      ctx.fillStyle = withAlpha(sc.colors.bg, 0.94);
      ctx.strokeStyle = sc.colors.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(tx, ty, tw, th, 6);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      lines.forEach((l, i) => {
        const yy = ty + 5 + lh * i + lh / 2;
        if (i > 0) {
          ctx.fillStyle = l.color;
          ctx.fillRect(tx + 7, yy - 4, 8, 8);
        }
        ctx.fillStyle = i === 0 ? sc.colors.fg : sc.colors.fg;
        ctx.fillText(l.text, tx + (i > 0 ? 20 : 8), yy);
      });
    }
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    } catch {
      /* the pointer may already be gone */
    }
    const p = localPos(e);
    pointers.current.set(e.pointerId, p);
    dragged.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      lastPinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = localPos(e);
    const prev = pointers.current.get(e.pointerId);
    if (prev) {
      pointers.current.set(e.pointerId, p);
      if (pointers.current.size === 1) {
        const dx = p.x - prev.x;
        const dy = p.y - prev.y;
        if (Math.abs(dx) + Math.abs(dy) > 0) {
          dragged.current = true;
          panBy(dx, dy);
          drawHover(null, null);
        }
        return;
      }
      if (pointers.current.size === 2 && lastPinch.current) {
        const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        const lp = lastPinch.current;
        if (d > 5 && lp.d > 5) {
          panBy(cx - lp.cx, cy - lp.cy);
          zoomAt(lp.d / d, cx, cy);
        }
        lastPinch.current = { d, cx, cy };
        return;
      }
    }
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') drawHover(p.x, p.y);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) lastPinch.current = null;
    if (e.pointerType === 'touch' && !dragged.current) {
      const p = localPos(e);
      drawHover(p.x, p.y);
    }
  };

  // wheel needs a non-passive listener to preventDefault
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = canvasRef.current?.getBoundingClientRect();
      const px = e.clientX - (r?.left ?? 0);
      const py = e.clientY - (r?.top ?? 0);
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const f = Math.exp(Math.max(-300, Math.min(300, e.deltaY * unit)) * 0.0016);
      zoomAt(f, px, py, e.shiftKey ? 'x' : e.altKey ? 'y' : 'both');
      drawHover(null, null);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt, drawHover]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = 40;
    if (e.key === 'ArrowLeft') panBy(step, 0);
    else if (e.key === 'ArrowRight') panBy(-step, 0);
    else if (e.key === 'ArrowUp') panBy(0, step);
    else if (e.key === 'ArrowDown') panBy(0, -step);
    else if (e.key === '+' || e.key === '=') zoomAt(0.8, (size?.w ?? 0) / 2, (size?.h ?? 0) / 2);
    else if (e.key === '-' || e.key === '_') zoomAt(1.25, (size?.w ?? 0) / 2, (size?.h ?? 0) / 2);
    else if (e.key === '0') resetView();
    else return;
    e.preventDefault();
  };

  const onDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const p = localPos(e);
    zoomAt(0.5, p.x, p.y);
  };

  /* ---------- export ---------- */
  const exportPng = async (): Promise<Blob> => {
    const sc = sceneRef.current;
    if (!sc) throw new Error('Nothing to export yet.');
    const scale = 2;
    const c = document.createElement('canvas');
    c.width = sc.w * scale;
    c.height = sc.h * scale;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available.');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawScene(ctx, sc);
    return await new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed.'))), 'image/png'));
  };

  const copyLink = async (): Promise<string> => `${window.location.href}`;

  /* ---------- row editing ---------- */
  const updateRow = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeRow = (id: number) => setRows((rs) => rs.filter((r) => r.id !== id));
  const addRow = () =>
    setRows((rs) => {
      if (rs.length >= MAX_ROWS) return rs;
      const used = new Set(rs.map((r) => r.color));
      let ci = 0;
      while (ci < 8 && used.has(`p${ci}`)) ci++;
      nextId.current += 1;
      return [...rs, mkRow(nextId.current, 'y', '', `p${ci % 8}`)];
    });

  const loadExample = (label: string) => {
    const e = EXAMPLES.find((q) => q.label === label);
    if (!e) return;
    setRows(
      e.rows.map((r) => {
        nextId.current += 1;
        return { ...r, id: nextId.current };
      })
    );
    setParams(e.params ? { ...e.params } : {});
    setAnaId(null);
    setSecondId(null);
    if (size) {
      if (e.bounds) {
        setView(viewFromBounds(e.bounds, size.w, size.h));
      } else {
        const ux = 20 / size.w;
        setView({ cx: 0, cy: 0, ux, uy: ux });
      }
      if (e.bounds && equal) {
        const u = Math.max((e.bounds.xmax - e.bounds.xmin) / size.w, (e.bounds.ymax - e.bounds.ymin) / size.h);
        setView({ cx: (e.bounds.xmin + e.bounds.xmax) / 2, cy: (e.bounds.ymin + e.bounds.ymax) / 2, ux: u, uy: u });
      }
    }
  };

  const setParam = (name: string, patch: Partial<ParamState>) =>
    setParams((p) => ({ ...p, [name]: { ...(p[name] ?? DEFAULT_PARAM), ...patch } }));

  const isDark = dark;
  const rowEl = (r: Row, i: number) => {
    const comp = compiled[i];
    const err: RowError | null = comp && !comp.ok ? comp.error : null;
    const chip = colorOf(r.color, isDark);
    const desc = err ? describeError(err.src, err.error) : null;
    return (
      <div key={r.id} className={cn('rounded-md border bg-card p-2', !r.visible && 'opacity-60')} data-testid={`row-${i}`}>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label={`Colour of function ${i + 1}`}
            title="Change colour"
            onClick={() => setColorOpen((c) => (c === r.id ? null : r.id))}
            className="size-6 shrink-0 rounded-full border-2 border-background shadow ring-1 ring-border"
            style={{ background: chip }}
          />
          <Select value={r.mode} onValueChange={(v) => updateRow(r.id, { mode: v as RowMode })}>
            <SelectTrigger size="sm" className="w-[104px] shrink-0 px-2 text-xs" aria-label={`Type of function ${i + 1}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(MODE_LABEL) as RowMode[]).map((m) => (
                <SelectItem key={m} value={m}>
                  {MODE_LABEL[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={r.expr}
            onChange={(e) => updateRow(r.id, { expr: e.target.value })}
            placeholder={r.mode === 'y' ? 'e.g. sin(x)/x' : r.mode === 'polar' ? 'e.g. 1 + cos(θ)' : r.mode === 'param' ? 'x(t) e.g. cos(t)' : 'e.g. 2.5'}
            spellCheck={false}
            autoComplete="off"
            aria-label={`Expression ${i + 1}`}
            aria-invalid={err?.field === 'expr'}
            className="h-7 min-w-0 flex-1 px-2 font-mono text-xs"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => updateRow(r.id, { visible: !r.visible })}
            aria-label={r.visible ? `Hide function ${i + 1}` : `Show function ${i + 1}`}
            title={r.visible ? 'Hide' : 'Show'}
            className="size-7"
          >
            {r.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => removeRow(r.id)} aria-label={`Remove function ${i + 1}`} title="Remove" className="size-7">
            <X className="size-3.5" />
          </Button>
        </div>
        {r.mode === 'param' && (
          <div className="mt-1.5 flex items-center gap-1.5 pl-[7.5rem]">
            <Input
              value={r.expr2}
              onChange={(e) => updateRow(r.id, { expr2: e.target.value })}
              placeholder="y(t) e.g. sin(t)"
              spellCheck={false}
              autoComplete="off"
              aria-label={`y(t) of function ${i + 1}`}
              aria-invalid={err?.field === 'expr2'}
              className="h-7 min-w-0 flex-1 px-2 font-mono text-xs"
            />
          </div>
        )}
        {(r.mode === 'param' || r.mode === 'polar') && (
          <div className="mt-1.5 flex items-center gap-1.5 pl-[7.5rem] text-2xs text-muted-foreground">
            <span>{r.mode === 'polar' ? 'θ' : 't'} from</span>
            <Input
              value={r.tMin}
              onChange={(e) => updateRow(r.id, { tMin: e.target.value })}
              placeholder="0"
              aria-label={`Range start of function ${i + 1}`}
              aria-invalid={err?.field === 'range'}
              className="h-6 w-16 px-1.5 font-mono text-xs"
            />
            <span>to</span>
            <Input
              value={r.tMax}
              onChange={(e) => updateRow(r.id, { tMax: e.target.value })}
              placeholder="2pi"
              aria-label={`Range end of function ${i + 1}`}
              aria-invalid={err?.field === 'range'}
              className="h-6 w-16 px-1.5 font-mono text-xs"
            />
          </div>
        )}
        {colorOpen === r.id && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-1">
            {PALETTE_LIGHT.map((_, k) => (
              <button
                key={k}
                type="button"
                aria-label={`Palette colour ${k + 1}`}
                onClick={() => updateRow(r.id, { color: `p${k}` })}
                className={cn('size-5 rounded-full ring-1 ring-border', r.color === `p${k}` && 'ring-2 ring-foreground')}
                style={{ background: colorOf(`p${k}`, isDark) }}
              />
            ))}
            <label className="ml-1 flex items-center gap-1 text-2xs text-muted-foreground">
              custom
              <input
                type="color"
                aria-label="Custom colour"
                value={/^#[0-9a-fA-F]{6}$/.test(r.color) ? r.color : colorOf(r.color, isDark)}
                onChange={(e) => updateRow(r.id, { color: e.target.value })}
                className="h-5 w-7 cursor-pointer rounded border bg-transparent p-0"
              />
            </label>
          </div>
        )}
        {desc && err && (
          <div className="mt-1.5 rounded border border-destructive/30 bg-destructive/10 px-2 py-1 text-2xs text-destructive" role="alert" data-testid={`row-error-${i}`}>
            <div>
              {err.field === 'expr2' ? 'y(t): ' : err.field === 'range' ? 'Range: ' : ''}
              {desc.text}
            </div>
            <pre className="mt-0.5 overflow-x-auto font-mono leading-tight">{desc.caret}</pre>
          </div>
        )}
      </div>
    );
  };

  const hasRows = rows.length > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
        {/* ---------------- sidebar ---------------- */}
        <div className="space-y-4">
          <Panel>
            <PanelHeader title={`Functions (${rows.length}/${MAX_ROWS})`}>
              <Select value="" onValueChange={loadExample}>
                <SelectTrigger size="sm" className="h-7 border-0 bg-transparent px-2 text-xs shadow-none" aria-label="Load an example">
                  <Sparkles className="size-3.5" />
                  <SelectValue placeholder="Examples" />
                </SelectTrigger>
                <SelectContent>
                  {EXAMPLES.map((e) => (
                    <SelectItem key={e.label} value={e.label}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={addRow} disabled={rows.length >= MAX_ROWS}>
                <Plus className="size-3.5" /> Add
              </Button>
            </PanelHeader>
            <div className="space-y-2 p-2">
              {rows.map(rowEl)}
              {!hasRows && <p className="px-1 py-3 text-center text-sm text-muted-foreground">No functions. Click Add to plot one.</p>}
              <p className="px-1 text-2xs leading-snug text-muted-foreground">
                Use <code className="font-mono">x</code>, numbers, <code className="font-mono">+ - * / ^ !</code>, implicit products
                (<code className="font-mono">2x</code>, <code className="font-mono">(x+1)(x-1)</code>) and functions such as sin, cos, tan, asin,
                sqrt, abs, exp, ln, log, floor, min, max, mod. Constants: pi, e, tau. Any other single letter (a, b, c, …)
                becomes a slider. Angles are in radians.
              </p>
            </div>
          </Panel>

          {usedParams.length > 0 && (
            <Panel>
              <PanelHeader title="Parameters" />
              <div className="space-y-3 p-3">
                {usedParams.map((n) => {
                  const p = params[n] ?? DEFAULT_PARAM;
                  return (
                    <div key={n} className="space-y-1.5" data-testid={`param-${n}`}>
                      <div className="flex items-center gap-2">
                        <span className="w-4 font-mono text-sm font-semibold">{n}</span>
                        <span className="text-muted-foreground">=</span>
                        <Input
                          value={String(Number(p.value.toPrecision(10)))}
                          onChange={(e) => {
                            const v = parseNum(e.target.value);
                            if (v !== null) setParam(n, { value: v, lo: Math.min(p.lo, v), hi: Math.max(p.hi, v) });
                          }}
                          inputMode="decimal"
                          aria-label={`Value of ${n}`}
                          className="h-7 w-20 px-2 font-mono text-xs"
                        />
                        <div className="ml-auto flex items-center gap-1 text-2xs text-muted-foreground">
                          <Input
                            defaultValue={String(p.lo)}
                            key={`lo-${n}-${p.lo}`}
                            onBlur={(e) => {
                              const v = parseNum(e.target.value);
                              if (v !== null && v < p.hi) setParam(n, { lo: v, value: Math.max(v, p.value) });
                            }}
                            aria-label={`Minimum of ${n}`}
                            className="h-6 w-14 px-1.5 font-mono text-2xs"
                          />
                          …
                          <Input
                            defaultValue={String(p.hi)}
                            key={`hi-${n}-${p.hi}`}
                            onBlur={(e) => {
                              const v = parseNum(e.target.value);
                              if (v !== null && v > p.lo) setParam(n, { hi: v, value: Math.min(v, p.value) });
                            }}
                            aria-label={`Maximum of ${n}`}
                            className="h-6 w-14 px-1.5 font-mono text-2xs"
                          />
                          <span>step</span>
                          <Input
                            defaultValue={String(p.step)}
                            key={`st-${n}-${p.step}`}
                            onBlur={(e) => {
                              const v = parseNum(e.target.value);
                              if (v !== null && v > 0) setParam(n, { step: v });
                            }}
                            aria-label={`Step of ${n}`}
                            className="h-6 w-12 px-1.5 font-mono text-2xs"
                          />
                        </div>
                      </div>
                      <Slider
                        value={[Math.min(p.hi, Math.max(p.lo, p.value))]}
                        min={p.lo}
                        max={p.hi}
                        step={p.step}
                        onValueChange={(v) => setParam(n, { value: Number((v[0] ?? p.value).toPrecision(12)) })}
                        aria-label={`Slider for ${n}`}
                      />
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}
        </div>

        {/* ---------------- plot ---------------- */}
        <Panel>
          <PanelHeader title="Plot">
            <Button variant="ghost" size="icon-sm" aria-label="Zoom in" title="Zoom in" onClick={() => zoomAt(0.8, (size?.w ?? 0) / 2, (size?.h ?? 0) / 2)}>
              <ZoomIn className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Zoom out" title="Zoom out" onClick={() => zoomAt(1.25, (size?.w ?? 0) / 2, (size?.h ?? 0) / 2)}>
              <ZoomOut className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Auto-fit" title="Auto-fit to the curves" onClick={autoFit}>
              <Maximize2 className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Reset view" title="Reset view" onClick={resetView}>
              <RotateCcw className="size-3.5" />
            </Button>
            <div className="mx-1 flex items-center gap-1.5">
              <Switch id="gr-equal" checked={equal} onCheckedChange={toggleEqual} />
              <Label htmlFor="gr-equal" className="text-2xs">
                1:1
              </Label>
            </div>
            <DownloadButton data={exportPng} filename="graph.png" mime="image/png" label="PNG" />
            <CopyButton value={copyLink} label="Link" />
          </PanelHeader>
          <div
            ref={wrapRef}
            className="relative w-full touch-none select-none overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            style={{ height: size?.h ?? 400, cursor: 'crosshair', touchAction: 'none' }}
            tabIndex={0}
            role="application"
            aria-label="Function graph. Arrow keys pan, plus and minus zoom, 0 resets the view."
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={(e) => {
              if (e.pointerType === 'mouse') drawHover(null, null);
            }}
            onDoubleClick={onDoubleClick}
            onKeyDown={onKeyDown}
            data-testid="plot"
          >
            <canvas ref={canvasRef} className="absolute left-0 top-0 block" data-testid="plot-canvas" />
            <canvas ref={overlayRef} className="pointer-events-none absolute left-0 top-0 block" />
          </div>
          <div ref={readoutRef} className="border-t px-3 py-1.5 font-mono text-2xs text-muted-foreground" aria-live="off">
            Hover the plot to read values. Drag to pan, scroll or pinch to zoom.
          </div>
          <StatBar
            items={[
              view && size ? `x: ${fmtNum(boundsOf(view, size.w, size.h).xmin, 4)} … ${fmtNum(boundsOf(view, size.w, size.h).xmax, 4)}` : null,
              view && size ? `y: ${fmtNum(boundsOf(view, size.w, size.h).ymin, 4)} … ${fmtNum(boundsOf(view, size.w, size.h).ymax, 4)}` : null,
              equal ? 'equal aspect' : 'free aspect',
              'shift+scroll: x only · alt+scroll: y only · double-click: zoom in',
            ]}
            className="h-auto min-h-7 py-1"
          />
        </Panel>
      </div>

      {/* ---------------- analysis ---------------- */}
      <Panel>
        <PanelHeader title="Analysis (explicit functions y = f(x))" />
        {!anaRow ? (
          <p className="p-4 text-sm text-muted-foreground">Add a valid y = f(x) function to find roots, extrema, intersections, integrals and tables of values.</p>
        ) : (
          <div className="space-y-4 p-3">
            <div className="flex flex-wrap items-end gap-4">
              <Field label="Function" className="min-w-[220px] max-w-full flex-1">
                <Select value={String(anaRow.id)} onValueChange={(v) => setAnaId(Number(v))}>
                  <SelectTrigger className="w-full" aria-label="Function to analyse">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yRows.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Intersect with" className="min-w-[220px] max-w-full flex-1">
                <Select value={secondRow ? String(secondRow.id) : ''} onValueChange={(v) => setSecondId(Number(v))} disabled={!secondRow}>
                  <SelectTrigger className="w-full" aria-label="Second function for intersections">
                    <SelectValue placeholder="(add a second y = f(x))" />
                  </SelectTrigger>
                  <SelectContent>
                    {yRows
                      .filter((r) => r.id !== anaRow.id)
                      .map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {r.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {analysis && (
              <p className="text-2xs text-muted-foreground">
                Searching the visible range x ∈ [{fmtNum(analysis.xmin, 5)}, {fmtNum(analysis.xmax, 5)}]. Pan or zoom the plot to search elsewhere.
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <ResultList
                title="Roots (f(x) = 0)"
                testId="roots"
                items={analysis?.roots.map((x) => `x = ${fmtNum(x, 10)}`) ?? []}
                empty={analysis ? 'No roots in view' : 'Calculating…'}
              />
              <ResultList
                title="Local extrema"
                testId="extrema"
                items={analysis?.extrema.map((e) => `${e.kind === 'max' ? 'max' : 'min'}  (${fmtNum(e.x, 8)}, ${fmtNum(e.y, 8)})`) ?? []}
                empty={analysis ? 'No local extrema in view' : 'Calculating…'}
              />
              <ResultList
                title="Intersections"
                testId="intersections"
                items={analysis?.inter.map((p) => `(${fmtNum(p.x, 9)}, ${fmtNum(p.y, 9)})`) ?? []}
                empty={!secondRow ? 'Needs a second function' : analysis ? 'No intersections in view' : 'Calculating…'}
              />
              <div className="rounded-md border" data-testid="intercept">
                <div className="border-b bg-muted/40 px-2 py-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">y-intercept</div>
                <div className="p-2 font-mono text-xs">
                  {analysis ? (Number.isFinite(analysis.y0) ? `(0, ${fmtNum(analysis.y0, 10)})` : 'undefined at x = 0') : '…'}
                </div>
              </div>
            </div>

            {/* integral */}
            <div className="rounded-md border">
              <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-2 py-1">
                <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Definite integral</span>
                <label className="ml-auto flex items-center gap-1.5 text-2xs">
                  <Checkbox checked={shadeOn} onCheckedChange={(c) => setShadeOn(c === true)} /> shade area on plot
                </label>
                {anaBounds && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-2xs"
                    onClick={() => {
                      setIntA(String(Number(anaBounds.xmin.toPrecision(5))));
                      setIntB(String(Number(anaBounds.xmax.toPrecision(5))));
                    }}
                  >
                    Use view range
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap items-end gap-3 p-3">
                <Field label="From a" className="w-28">
                  <Input value={intA} onChange={(e) => setIntA(e.target.value)} inputMode="decimal" className="h-8 font-mono" aria-label="Integral lower bound" />
                </Field>
                <Field label="To b" className="w-28">
                  <Input value={intB} onChange={(e) => setIntB(e.target.value)} inputMode="decimal" className="h-8 font-mono" aria-label="Integral upper bound" />
                </Field>
                <div className="min-w-[200px] flex-1" data-testid="integral">
                  {integral && 'error' in integral ? (
                    <ErrorBanner error={integral.error} />
                  ) : integral ? (
                    <div>
                      <div className="flex items-center gap-2 font-mono text-lg font-semibold tabular-nums">
                        ∫ = {fmtNum(integral.res.value, 12)}
                        <CopyButton value={String(Number(integral.res.value.toPrecision(15)))} size="icon-sm" />
                      </div>
                      <div className="font-mono text-2xs text-muted-foreground">
                        adaptive Simpson · est. error ≈ {integral.res.error.toExponential(1)}
                        {!integral.res.converged && ' · did not fully converge'}
                      </div>
                      {integral.res.problem && <div className="mt-1 text-2xs text-destructive">{integral.res.problem}</div>}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* table */}
            <div className="rounded-md border">
              <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-2 py-1">
                <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Table of values</span>
                <span className="ml-auto" />
                {table && table.kind === 'ok' && <CopyButton value={() => tableCsv(table.rows)} label="Copy CSV" />}
                {table && table.kind === 'ok' && <DownloadButton data={() => tableCsv(table.rows)} filename="values.csv" mime="text/csv" label="CSV" />}
              </div>
              <div className="flex flex-wrap items-end gap-3 p-3">
                <Field label="x from" className="w-24">
                  <Input value={tStart} onChange={(e) => setTStart(e.target.value)} inputMode="decimal" className="h-8 font-mono" aria-label="Table start" />
                </Field>
                <Field label="to" className="w-24">
                  <Input value={tEnd} onChange={(e) => setTEnd(e.target.value)} inputMode="decimal" className="h-8 font-mono" aria-label="Table end" />
                </Field>
                <Field label="step" className="w-24">
                  <Input value={tStep} onChange={(e) => setTStep(e.target.value)} inputMode="decimal" className="h-8 font-mono" aria-label="Table step" />
                </Field>
              </div>
              {table && table.kind === 'err' && <div className="px-3 pb-3"><ErrorBanner error={table.error} /></div>}
              {table && table.kind === 'ok' && (
                <>
                  <div className="max-h-72 overflow-auto border-t">
                    <table className="w-full text-sm" data-testid="table">
                      <thead className="sticky top-0 bg-card">
                        <tr className="border-b text-left text-2xs uppercase tracking-wide text-muted-foreground">
                          <th className="px-3 py-1.5 font-medium">x</th>
                          <th className="px-3 py-1.5 font-medium">f(x)</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono text-xs tabular-nums">
                        {table.rows.slice(0, 600).map((r, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="px-3 py-1">{fmtNum(r.x, 10)}</td>
                            <td className="px-3 py-1">{fmtNum(r.y, 10)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <StatBar
                    items={[
                      `${table.rows.length} rows`,
                      table.rows.length > 600 ? 'showing the first 600 (CSV has all)' : null,
                      table.truncated ? 'limited to 5000 rows' : null,
                    ]}
                  />
                </>
              )}
            </div>
          </div>
        )}
      </Panel>

      <p className="text-xs text-muted-foreground">
        Expressions are parsed and evaluated by a built-in math parser (no eval). Roots use sign changes refined with Brent&apos;s
        method (tangent roots included), extrema come from sign changes of a numeric derivative, and integrals use adaptive
        Simpson. Results cover the visible x-range and can miss features narrower than a pixel. The page address is updated as
        you edit, so you can share the link.
      </p>
    </div>
  );
}

function ResultList({ title, items, empty, testId }: { title: string; items: string[]; empty: string; testId: string }) {
  return (
    <div className="rounded-md border" data-testid={testId}>
      <div className="flex items-center border-b bg-muted/40 px-2 py-1">
        <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
        {items.length > 0 && <CopyButton value={items.join('\n')} size="icon-sm" className="ml-auto size-5" />}
      </div>
      <ul className="max-h-40 overflow-auto p-2 font-mono text-xs">
        {items.length === 0 ? <li className="text-muted-foreground">{empty}</li> : items.slice(0, 60).map((t, i) => <li key={i}>{t}</li>)}
        {items.length > 60 && <li className="text-muted-foreground">… {items.length - 60} more</li>}
      </ul>
    </div>
  );
}
