'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, FileText, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Panel, PanelHeader, Field, StatBar } from '@/components/tools/panel';
import { FileDropzone } from '@/components/tools/file-dropzone';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { formatBytes } from '@/lib/download';
import { isEncrypted, pageInfo, stampText, type PdfPageInfo, type PdfStandardFont } from '@/lib/wasm/pdf';
import {
  FONTS,
  FORMAT_PRESETS,
  buildSamplePdf,
  clampNum,
  localIsoDate,
  parseHexColor,
  parsePageRange,
  planPageNumbers,
  resolveTemplate,
  stripExtension,
  toStamps,
  unsupportedChars,
  type FormatId,
  type HPos,
  type NumberingOptions,
  type PlanItem,
  type VPos,
} from './logic';

const SVG_FONT: Record<PdfStandardFont, { family: string; weight: number }> = {
  Helvetica: { family: 'Helvetica, Arial, sans-serif', weight: 400 },
  'Helvetica-Bold': { family: 'Helvetica, Arial, sans-serif', weight: 700 },
  'Times-Roman': { family: '"Times New Roman", Times, serif', weight: 400 },
  'Times-Bold': { family: '"Times New Roman", Times, serif', weight: 700 },
  Courier: { family: '"Courier New", Courier, monospace', weight: 400 },
  'Courier-Bold': { family: '"Courier New", Courier, monospace', weight: 700 },
};

const A4 = { w: 595, h: 842 };

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

function ToggleRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2">
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5" />
      <span className="flex flex-col">
        <span className="text-xs">{label}</span>
        {hint && <span className="text-2xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

function PositionPicker({
  vpos,
  hpos,
  onPick,
}: {
  vpos: VPos;
  hpos: HPos;
  onPick: (v: VPos, h: HPos) => void;
}) {
  const cell = (v: VPos, h: HPos, label: string) => {
    const active = vpos === v && hpos === h;
    return (
      <button
        key={`${v}-${h}`}
        type="button"
        aria-label={label}
        aria-pressed={active}
        title={label}
        onClick={() => onPick(v, h)}
        className={cn(
          'flex h-7 items-center justify-center rounded-sm border transition-colors',
          active
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-transparent text-muted-foreground hover:border-border hover:bg-accent/60',
        )}
      >
        <span className={cn('block h-1 rounded-full bg-current', h === 'center' ? 'w-3' : 'w-4')} />
      </button>
    );
  };
  return (
    <div
      className="grid h-28 w-24 grid-cols-3 grid-rows-[auto_1fr_auto] gap-0.5 rounded border bg-background p-1 shadow-xs"
      role="group"
      aria-label="Number position"
    >
      {cell('top', 'left', 'Top left')}
      {cell('top', 'center', 'Top center')}
      {cell('top', 'right', 'Top right')}
      <div className="col-span-3 rounded-sm bg-muted/50" />
      {cell('bottom', 'left', 'Bottom left')}
      {cell('bottom', 'center', 'Bottom center')}
      {cell('bottom', 'right', 'Bottom right')}
    </div>
  );
}

/** Faint placeholder text lines so the mock reads as a page. */
function MockContent({ w, h }: { w: number; h: number }) {
  const left = w * 0.14;
  const width = w * 0.72;
  const rows: number[] = [];
  for (let y = h * 0.14; y < h * 0.86; y += h * 0.032) rows.push(y);
  return (
    <g fill="#cbd5e1" opacity={0.55}>
      <rect x={left} y={h * 0.07} width={width * 0.5} height={h * 0.02} rx={2} />
      {rows.map((y, i) => (
        <rect
          key={i}
          x={left}
          y={y}
          width={width * (i % 5 === 4 ? 0.55 : 1)}
          height={h * 0.011}
          rx={1}
        />
      ))}
    </g>
  );
}

const ZOOM_W = 200;
const ZOOM_H = 64;

/** One mock page. `view` crops the SVG to a window (in points, y down) for the zoom strip. */
function PageSvg({
  it,
  o,
  view,
  label,
}: {
  it: PlanItem;
  o: NumberingOptions;
  view?: { x: number; y: number; w: number; h: number };
  label: string;
}) {
  const font = SVG_FONT[o.font];
  const vb = view ? `${view.x} ${view.y} ${view.w} ${view.h}` : `0 0 ${it.width} ${it.height}`;
  return (
    <svg
      viewBox={vb}
      role="img"
      aria-label={label}
      className="block h-auto w-full rounded-sm"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect width={it.width} height={it.height} fill="#ffffff" />
      <MockContent w={it.width} h={it.height} />
      <text
        x={it.x}
        y={it.height - it.y}
        fontSize={o.size}
        fontFamily={font.family}
        fontWeight={font.weight}
        textAnchor={it.anchor === 'left' ? 'start' : it.anchor === 'right' ? 'end' : 'middle'}
        fill={`rgb(${Math.round(o.color[0] * 255)},${Math.round(o.color[1] * 255)},${Math.round(o.color[2] * 255)})`}
        fillOpacity={o.opacity}
        style={{ whiteSpace: 'pre' }}
      >
        {it.text}
      </text>
      <rect
        width={it.width}
        height={it.height}
        fill="none"
        stroke="#94a3b8"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function zoomWindow(it: PlanItem) {
  const baseline = it.height - it.y;
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
  const x =
    it.anchor === 'left' ? it.x - 14 : it.anchor === 'right' ? it.x - ZOOM_W + 14 : it.x - ZOOM_W / 2;
  return {
    x: clamp(x, 0, it.width - ZOOM_W),
    y: clamp(baseline - ZOOM_H * 0.6, 0, it.height - ZOOM_H),
    w: Math.min(ZOOM_W, it.width),
    h: Math.min(ZOOM_H, it.height),
  };
}

function PagePreview({ items, o }: { items: PlanItem[]; o: NumberingOptions }) {
  const n = Math.max(items.length, 1);
  return (
    <div
      className="mx-auto grid items-start gap-3 p-3"
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, maxWidth: n * 230 }}
    >
      {items.map((it) => (
        <figure key={it.page} className="flex min-w-0 flex-col gap-1.5">
          <div className="overflow-hidden rounded-sm shadow-sm">
            <PageSvg it={it} o={o} label={`Page ${it.page} preview`} />
          </div>
          <div className="overflow-hidden rounded-sm border bg-white">
            <PageSvg it={it} o={o} view={zoomWindow(it)} label={`Zoom on the number of page ${it.page}: ${it.text}`} />
          </div>
          <figcaption className="truncate text-center font-mono text-2xs text-muted-foreground tabular">
            p.{it.page} · <span className="text-foreground">{it.text}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tool
// ---------------------------------------------------------------------------

interface Result {
  bytes: Uint8Array;
  key: string;
  stamped: number;
}

export default function PdfPageNumbersTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PdfPageInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [today, setToday] = useState('');
  const srcRef = useRef<Uint8Array | null>(null);
  const loadId = useRef(0);
  const runId = useRef(0);

  // Format
  const [formatId, setFormatId] = useState<FormatId>('page-n-of-N');
  const [template, setTemplate] = useState('Page {n} of {N}');
  const [batesPrefix, setBatesPrefix] = useState('ACME-');
  const [batesDigits, setBatesDigits] = useState('6');
  const [batesSuffix, setBatesSuffix] = useState('');
  // Position
  const [vpos, setVpos] = useState<VPos>('bottom');
  const [hpos, setHpos] = useState<HPos>('center');
  const [mirrorEven, setMirrorEven] = useState(false);
  const [marginX, setMarginX] = useState('15');
  const [marginY, setMarginY] = useState('10');
  // Numbering
  const [start, setStart] = useState('1');
  const [rangeText, setRangeText] = useState('');
  const [skipFirst, setSkipFirst] = useState('0');
  const [countSkipped, setCountSkipped] = useState(false);
  // Style
  const [font, setFont] = useState<PdfStandardFont>('Helvetica');
  const [size, setSize] = useState('10');
  const [colorText, setColorText] = useState('#000000');
  const [opacityPct, setOpacityPct] = useState(100);

  useEffect(() => {
    setToday(localIsoDate(new Date()));
  }, []);

  // Revoke the preview URL when it is replaced and on unmount.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const loadFile = useCallback(async (f: File) => {
    const myLoad = ++loadId.current;
    runId.current++;
    setFile(f);
    setPages(null);
    setResult(null);
    setPreviewUrl(null);
    setError(null);
    setBusy(false);
    setLoading(true);
    srcRef.current = null;
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      let info: PdfPageInfo[];
      try {
        info = await pageInfo(bytes.slice());
      } catch (e) {
        let encrypted = false;
        try {
          encrypted = await isEncrypted(bytes.slice());
        } catch {
          encrypted = false;
        }
        if (encrypted) {
          throw new Error('This PDF is password-protected or encrypted. Remove the protection first, then add page numbers.');
        }
        throw new Error(`Could not read this PDF (${e instanceof Error ? e.message : String(e)}).`);
      }
      if (myLoad !== loadId.current) return;
      if (info.length === 0) throw new Error('This PDF has no pages.');
      srcRef.current = bytes;
      setPages(info);
    } catch (e) {
      if (myLoad === loadId.current) {
        setFile(null);
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (myLoad === loadId.current) setLoading(false);
    }
  }, []);

  const loadSample = useCallback(() => {
    const bytes = buildSamplePdf(Array.from({ length: 6 }, () => A4), 'Quarterly Report');
    const sample = new File([bytes as unknown as BlobPart], 'sample-report.pdf', { type: 'application/pdf' });
    void loadFile(sample);
  }, [loadFile]);

  const totalPages = pages?.length ?? 0;
  const fileBase = file ? stripExtension(file.name) : 'document';

  // --- derived options ------------------------------------------------------
  const derived = useMemo(() => {
    const problems: string[] = [];
    const rangeRes = parsePageRange(rangeText, Math.max(totalPages, 1));
    if (!rangeRes.ok) problems.push(rangeRes.error);
    const color = parseHexColor(colorText);
    if (!color) problems.push('Colour must be a hex value such as #cc0000.');
    if (formatId === 'custom' && template.trim() === '') problems.push('Enter a number template, e.g. Page {n} of {N}.');
    const opts: NumberingOptions = {
      formatId,
      template,
      batesPrefix,
      batesDigits: clampNum(batesDigits, 6, 1, 12),
      batesSuffix,
      vpos,
      hpos,
      mirrorEven,
      marginXmm: clampNum(marginX, 15, 0, 200),
      marginYmm: clampNum(marginY, 10, 0, 200),
      start: Math.floor(clampNum(start, 1, 0, 999999)),
      range: rangeRes.ok ? rangeRes.pages : null,
      skipFirst: Math.floor(clampNum(skipFirst, 0, 0, 100000)),
      countSkipped,
      font,
      size: clampNum(size, 10, 4, 200),
      color: color ?? [0, 0, 0],
      opacity: opacityPct / 100,
    };
    return { opts, problems };
  }, [
    rangeText, totalPages, colorText, formatId, template, batesPrefix, batesDigits, batesSuffix, vpos, hpos,
    mirrorEven, marginX, marginY, start, skipFirst, countSkipped, font, size, opacityPct,
  ]);

  const plan = useMemo(() => {
    if (!pages) return null;
    return planPageNumbers(pages.map((p) => ({ page: p.page, width: p.width, height: p.height })), derived.opts, {
      file: fileBase,
      date: today,
    });
  }, [pages, derived.opts, fileBase, today]);

  const problems = derived.problems;
  const noPages = plan !== null && plan.items.length === 0;
  const warnChars = useMemo(() => {
    if (!plan) return [];
    const sample = plan.items.slice(0, 50).map((i) => i.text).join('');
    return unsupportedChars(sample);
  }, [plan]);

  // A result is only valid for the exact settings it was made with.
  const currentKey = useMemo(
    () => JSON.stringify({ f: file?.name, s: file?.size, o: { ...derived.opts, range: derived.opts.range ? [...derived.opts.range] : null }, d: today }),
    [file, derived.opts, today],
  );
  const resultFresh = result !== null && result.key === currentKey;

  const apply = useCallback(async () => {
    const src = srcRef.current;
    if (!src || !plan || plan.items.length === 0 || problems.length > 0) return;
    const myRun = ++runId.current;
    setBusy(true);
    setError(null);
    setResult(null);
    setPreviewUrl(null);
    try {
      const stamps = toStamps(plan.items, derived.opts);
      const out = await stampText(src.slice(), stamps);
      if (myRun !== runId.current) return;
      setResult({ bytes: out, key: currentKey, stamped: stamps.length });
    } catch (e) {
      if (myRun === runId.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (myRun === runId.current) setBusy(false);
    }
  }, [plan, problems.length, derived.opts, currentKey]);

  const togglePreview = useCallback(() => {
    if (previewUrl) {
      setPreviewUrl(null);
      return;
    }
    if (!result) return;
    setPreviewUrl(URL.createObjectURL(new Blob([result.bytes as unknown as BlobPart], { type: 'application/pdf' })));
  }, [previewUrl, result]);

  const exampleText = plan?.items[0]?.text ?? '';
  const previewItems = plan ? plan.items.slice(0, 3) : [];

  return (
    <div className="flex flex-col gap-3">
      <FileDropzone
        onFiles={(f) => {
          const first = f[0];
          if (first) void loadFile(first);
        }}
        accept="application/pdf,.pdf"
        label={file ? file.name : 'Drop a PDF'}
        hint={
          pages
            ? `${pages.length} page${pages.length === 1 ? '' : 's'} · ${formatBytes(file?.size ?? 0)} · click to replace`
            : loading
              ? 'reading…'
              : 'or click to browse'
        }
        compact={!!file}
        disabled={loading}
      />

      <ErrorBanner error={error} />

      {!file && !loading && (
        <div className="flex flex-wrap items-center gap-3 px-1">
          <Button variant="secondary" size="sm" onClick={loadSample}>
            <FileText className="size-3.5" /> Try a sample PDF
          </Button>
          <p className="text-xs text-muted-foreground">
            Stamp page numbers, Bates labels or custom text on every page. Files never leave your browser.
          </p>
        </div>
      )}

      {loading && (
        <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Reading PDF…
        </p>
      )}

      {pages && plan && (
        <>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* ---------------------------------------------------------- left */}
            <div className="flex flex-col gap-3">
              <Panel>
                <PanelHeader title="Number format" />
                <div className="flex flex-col gap-3 p-3">
                  <div className="flex flex-wrap gap-x-4 gap-y-3">
                    <Field label="Format">
                      <Select value={formatId} onValueChange={(v) => setFormatId(v as FormatId)}>
                        <SelectTrigger className="w-48" aria-label="Format">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FORMAT_PRESETS.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.label}
                            </SelectItem>
                          ))}
                          <SelectItem value="custom">Custom template…</SelectItem>
                          <SelectItem value="bates">Bates number…</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    {formatId !== 'custom' && formatId !== 'bates' && (
                      <Field label="Template">
                        <code className="flex h-8 items-center rounded-md border bg-muted/30 px-2 font-mono text-xs">
                          {resolveTemplate({ formatId, template })}
                        </code>
                      </Field>
                    )}
                  </div>

                  {formatId === 'custom' && (
                    <Field
                      label="Template"
                      hint="{n} number · {N} last number · {file} file name · {date} today's date"
                    >
                      <Input
                        value={template}
                        onChange={(e) => setTemplate(e.target.value)}
                        className="font-mono"
                        placeholder="Page {n} of {N}"
                        spellCheck={false}
                      />
                    </Field>
                  )}

                  {formatId === 'bates' && (
                    <div className="flex flex-wrap gap-x-4 gap-y-3">
                      <Field label="Prefix">
                        <Input
                          value={batesPrefix}
                          onChange={(e) => setBatesPrefix(e.target.value)}
                          className="w-32 font-mono"
                          spellCheck={false}
                        />
                      </Field>
                      <Field label="Digits">
                        <Input
                          type="number"
                          min={1}
                          max={12}
                          value={batesDigits}
                          onChange={(e) => setBatesDigits(e.target.value)}
                          className="w-20 font-mono"
                        />
                      </Field>
                      <Field label="Suffix">
                        <Input
                          value={batesSuffix}
                          onChange={(e) => setBatesSuffix(e.target.value)}
                          className="w-28 font-mono"
                          spellCheck={false}
                        />
                      </Field>
                    </div>
                  )}

                  {exampleText && (
                    <p className="text-xs text-muted-foreground">
                      First stamp: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">{exampleText}</code>
                    </p>
                  )}
                  {warnChars.length > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      The standard PDF fonts cannot draw {warnChars.slice(0, 6).map((c) => `"${c}"`).join(' ')}
                      {warnChars.length > 6 ? ' …' : ''}; they will appear as “?”.
                    </p>
                  )}
                </div>
              </Panel>

              <Panel>
                <PanelHeader title="Position" />
                <div className="flex flex-wrap items-start gap-x-6 gap-y-3 p-3">
                  <Field label="Place on page">
                    <PositionPicker
                      vpos={vpos}
                      hpos={hpos}
                      onPick={(v, h) => {
                        setVpos(v);
                        setHpos(h);
                      }}
                    />
                  </Field>
                  <div className="flex min-w-[200px] flex-1 flex-col gap-3">
                    <div className="flex flex-wrap gap-x-4 gap-y-3">
                      <Field label="Side margin" hint="mm">
                        <Input
                          type="number"
                          min={0}
                          value={marginX}
                          onChange={(e) => setMarginX(e.target.value)}
                          className="w-24 font-mono"
                        />
                      </Field>
                      <Field label={vpos === 'top' ? 'Top margin' : 'Bottom margin'} hint="mm">
                        <Input
                          type="number"
                          min={0}
                          value={marginY}
                          onChange={(e) => setMarginY(e.target.value)}
                          className="w-24 font-mono"
                        />
                      </Field>
                    </div>
                    <ToggleRow
                      checked={mirrorEven}
                      onChange={setMirrorEven}
                      label="Mirror on even pages"
                      hint="Swaps left and right on even pages, for double-sided printing."
                    />
                  </div>
                </div>
              </Panel>

              <Panel>
                <PanelHeader title="Numbering" />
                <div className="flex flex-col gap-3 p-3">
                  <div className="flex flex-wrap gap-x-4 gap-y-3">
                    <Field label="Start at">
                      <Input
                        type="number"
                        min={0}
                        value={start}
                        onChange={(e) => setStart(e.target.value)}
                        className="w-24 font-mono"
                      />
                    </Field>
                    <Field label="Pages to number" hint={`blank = all ${pages.length}`}>
                      <Input
                        value={rangeText}
                        onChange={(e) => setRangeText(e.target.value)}
                        className="w-40 font-mono"
                        placeholder="e.g. 2-10"
                        spellCheck={false}
                      />
                    </Field>
                    <Field label="Skip first" hint="pages">
                      <Input
                        type="number"
                        min={0}
                        value={skipFirst}
                        onChange={(e) => setSkipFirst(e.target.value)}
                        className="w-24 font-mono"
                      />
                    </Field>
                  </div>
                  <ToggleRow
                    checked={countSkipped}
                    onChange={setCountSkipped}
                    label="Count skipped pages"
                    hint="On: numbers follow the physical page (page 3 shows 3). Off: the first numbered page gets the start number."
                  />
                </div>
              </Panel>

              <Panel>
                <PanelHeader title="Style" />
                <div className="flex flex-wrap gap-x-4 gap-y-3 p-3">
                  <Field label="Font">
                    <Select value={font} onValueChange={(v) => setFont(v as PdfStandardFont)}>
                      <SelectTrigger className="w-40" aria-label="Font">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FONTS.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Size" hint="pt">
                    <Input
                      type="number"
                      min={4}
                      max={200}
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                      className="w-20 font-mono"
                    />
                  </Field>
                  <Field label="Colour">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="Colour swatch"
                        value={parseHexColor(colorText) ? `#${normalizeHex(colorText)}` : '#000000'}
                        onChange={(e) => setColorText(e.target.value)}
                        className="h-8 w-10 cursor-pointer rounded-md border bg-transparent p-0.5"
                      />
                      <Input
                        value={colorText}
                        onChange={(e) => setColorText(e.target.value)}
                        className={cn('w-24 font-mono', !parseHexColor(colorText) && 'border-destructive')}
                        spellCheck={false}
                        aria-label="Colour hex"
                      />
                    </div>
                  </Field>
                  <Field label={`Opacity: ${opacityPct}%`} className="min-w-[140px] flex-1">
                    <Slider
                      value={[opacityPct]}
                      min={10}
                      max={100}
                      step={5}
                      onValueChange={(v) => setOpacityPct(v[0] ?? 100)}
                    />
                  </Field>
                </div>
              </Panel>
            </div>

            {/* --------------------------------------------------------- right */}
            <div className="flex flex-col gap-3 lg:sticky lg:top-3 lg:self-start">
              <Panel>
                <PanelHeader title="Preview" />
                {previewItems.length > 0 ? (
                  <PagePreview items={previewItems} o={derived.opts} />
                ) : (
                  <p className="p-6 text-center text-xs text-muted-foreground">
                    No pages will be numbered with these settings.
                  </p>
                )}
                <StatBar
                  items={[
                    `${pages.length} page${pages.length === 1 ? '' : 's'}`,
                    `${plan.items.length} to number`,
                    plan.items.length > 0 && `first: ${plan.items[0]?.n}`,
                  ]}
                />
              </Panel>

              {problems.map((p) => (
                <ErrorBanner key={p} error={p} />
              ))}

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={apply} disabled={busy || loading || noPages || problems.length > 0}>
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Add page numbers
                </Button>
                {noPages && problems.length === 0 && (
                  <span className="text-xs text-muted-foreground">Nothing to number: check “Skip first” and the page range.</span>
                )}
              </div>

              {result && !resultFresh && !busy && (
                <p className="text-xs text-muted-foreground">Settings changed since the last run. Add page numbers again to refresh the download.</p>
              )}

              {result && resultFresh && (
                <Panel>
                  <PanelHeader title="Result">
                    <Button variant="ghost" size="sm" onClick={togglePreview}>
                      {previewUrl ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      {previewUrl ? 'Hide preview' : 'Preview'}
                    </Button>
                    <DownloadButton
                      data={() => result.bytes}
                      filename={`${fileBase}-numbered.pdf`}
                      mime="application/pdf"
                      label="Download PDF"
                      variant="secondary"
                    />
                  </PanelHeader>
                  {previewUrl && (
                    <iframe src={previewUrl} title="Numbered PDF preview" className="h-[420px] w-full bg-muted/30" />
                  )}
                  <StatBar
                    items={[
                      `${result.stamped} page${result.stamped === 1 ? '' : 's'} numbered`,
                      `output: ${formatBytes(result.bytes.length)}`,
                      `${fileBase}-numbered.pdf`,
                    ]}
                  />
                </Panel>
              )}
            </div>
          </div>
          <p className="px-1 text-2xs text-muted-foreground">
            Numbers are drawn with the standard PDF fonts (Latin characters only), on top of the existing page content.
            Rotated pages are handled automatically. Existing content is left unchanged.
          </p>
        </>
      )}
    </div>
  );
}

function normalizeHex(s: string): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s.trim());
  const h = m?.[1] ?? '000000';
  return (h.length === 3 ? h.split('').map((c) => c + c).join('') : h).toLowerCase();
}
