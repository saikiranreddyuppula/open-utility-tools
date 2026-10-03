'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, EyeOff, FileText, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  PRESET_TEXTS,
  buildSamplePdf,
  buildStamps,
  clampNum,
  diagonalAngle,
  normalizeHex,
  parseHexColor,
  parsePageRange,
  planWatermark,
  stripExtension,
  unsupportedChars,
  type Layout,
  type RotationMode,
  type WatermarkSettings,
} from './logic';

const SVG_FONT: Record<PdfStandardFont, { family: string; weight: number }> = {
  Helvetica: { family: 'Helvetica, Arial, sans-serif', weight: 400 },
  'Helvetica-Bold': { family: 'Helvetica, Arial, sans-serif', weight: 700 },
  'Times-Roman': { family: '"Times New Roman", Times, serif', weight: 400 },
  'Times-Bold': { family: '"Times New Roman", Times, serif', weight: 700 },
  Courier: { family: '"Courier New", Courier, monospace', weight: 400 },
  'Courier-Bold': { family: '"Courier New", Courier, monospace', weight: 700 },
};

const COLOR_SWATCHES = ['#dc2626', '#6b7280', '#000000', '#2563eb', '#16a34a'];
const MAX_STAMPS = 20000;

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

/** Faint placeholder text lines so the mock reads as a page. */
function MockContent({ w, h }: { w: number; h: number }) {
  const left = w * 0.12;
  const width = w * 0.76;
  const rows: number[] = [];
  for (let y = h * 0.16; y < h * 0.88; y += h * 0.03) rows.push(y);
  return (
    <g>
      <rect x={left} y={h * 0.07} width={width * 0.45} height={h * 0.025} rx={2} fill="#64748b" opacity={0.7} />
      <rect x={left} y={h * 0.11} width={width} height={h * 0.003} fill="#3b5aa8" opacity={0.8} />
      <g fill="#94a3b8" opacity={0.6}>
        {rows.map((y, i) => (
          <rect
            key={i}
            x={left}
            y={y}
            width={width * (i % 6 === 5 ? 0.5 : 1)}
            height={h * 0.011}
            rx={1}
          />
        ))}
      </g>
    </g>
  );
}

function WatermarkPreview({
  width,
  height,
  s,
}: {
  width: number;
  height: number;
  s: WatermarkSettings;
}) {
  const placements = planWatermark(width, height, s);
  const scale = Math.min(330 / height, 420 / width);
  const f = SVG_FONT[s.font];
  const fill = `rgb(${Math.round(s.color[0] * 255)},${Math.round(s.color[1] * 255)},${Math.round(s.color[2] * 255)})`;
  const marks = placements.map((p, i) => (
    <text
      key={i}
      x={p.x}
      y={height - p.y}
      fontSize={p.size}
      fontFamily={f.family}
      fontWeight={f.weight}
      textAnchor="middle"
      fill={fill}
      fillOpacity={s.opacity}
      transform={`rotate(${-p.rotation} ${p.x} ${height - p.y})`}
      style={{ whiteSpace: 'pre' }}
    >
      {s.text}
    </text>
  ));
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width * scale}
      height={height * scale}
      role="img"
      aria-label="Watermark preview"
      className="rounded-sm shadow-sm"
    >
      <rect width={width} height={height} fill="#ffffff" />
      {s.layer === 'under' && marks}
      <MockContent w={width} h={height} />
      {s.layer === 'over' && marks}
      <rect width={width} height={height} fill="none" stroke="#94a3b8" strokeWidth={1} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

interface Result {
  bytes: Uint8Array;
  key: string;
  stampCount: number;
  pageCount: number;
}

export default function PdfWatermarkTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PdfPageInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewIdx, setPreviewIdx] = useState(0);
  const srcRef = useRef<Uint8Array | null>(null);
  const loadId = useRef(0);
  const runId = useRef(0);

  const [text, setText] = useState('CONFIDENTIAL');
  const [font, setFont] = useState<PdfStandardFont>('Helvetica-Bold');
  const [autoSize, setAutoSize] = useState(true);
  const [sizeText, setSizeText] = useState('72');
  const [colorText, setColorText] = useState('#dc2626');
  const [opacityPct, setOpacityPct] = useState(20);
  const [rotationMode, setRotationMode] = useState<RotationMode>('diagonal');
  const [rotationText, setRotationText] = useState('45');
  const [layer, setLayer] = useState<'over' | 'under'>('over');
  const [layout, setLayout] = useState<Layout>('single');
  const [rowsText, setRowsText] = useState('4');
  const [colsText, setColsText] = useState('3');
  const [stagger, setStagger] = useState(true);
  const [rangeText, setRangeText] = useState('');

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
    setPreviewIdx(0);
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
          throw new Error('This PDF is password-protected or encrypted. Remove the protection first, then add the watermark.');
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
    const bytes = buildSamplePdf(
      [
        { w: 595, h: 842 },
        { w: 595, h: 842 },
        { w: 842, h: 595 },
      ],
      'Project Proposal',
    );
    const sample = new File([bytes as unknown as BlobPart], 'sample-proposal.pdf', { type: 'application/pdf' });
    void loadFile(sample);
  }, [loadFile]);

  const totalPages = pages?.length ?? 0;
  const fileBase = file ? stripExtension(file.name) : 'document';

  const derived = useMemo(() => {
    const problems: string[] = [];
    const rangeRes = parsePageRange(rangeText, Math.max(totalPages, 1));
    if (!rangeRes.ok) problems.push(rangeRes.error);
    const color = parseHexColor(colorText);
    if (!color) problems.push('Colour must be a hex value such as #dc2626.');
    if (text.trim() === '') problems.push('Enter the watermark text.');
    const settings: WatermarkSettings = {
      text,
      font,
      autoSize,
      size: clampNum(sizeText, 72, 4, 1000),
      color: color ?? [0.86, 0.15, 0.15],
      opacity: opacityPct / 100,
      rotationMode,
      rotation: clampNum(rotationText, 45, -360, 360),
      layer,
      layout,
      rows: Math.floor(clampNum(rowsText, 4, 1, 20)),
      cols: Math.floor(clampNum(colsText, 3, 1, 20)),
      stagger,
    };
    return { settings, selected: rangeRes.ok ? rangeRes.pages : null, problems };
  }, [
    rangeText, totalPages, colorText, text, font, autoSize, sizeText, opacityPct, rotationMode, rotationText,
    layer, layout, rowsText, colsText, stagger,
  ]);

  const { settings, selected } = derived;

  const selectedPages = useMemo(() => {
    if (!pages) return [] as PdfPageInfo[];
    return selected ? pages.filter((p) => selected.has(p.page)) : pages;
  }, [pages, selected]);

  const stampEstimate = useMemo(() => {
    if (settings.text.trim() === '') return 0;
    const perPage = settings.layout === 'single' ? 1 : settings.rows * settings.cols;
    return perPage * selectedPages.length;
  }, [settings, selectedPages.length]);

  const problems = useMemo(() => {
    const out = [...derived.problems];
    if (stampEstimate > MAX_STAMPS) {
      out.push(`That would draw ${stampEstimate.toLocaleString()} stamps. Reduce the tiling or the page range (limit ${MAX_STAMPS.toLocaleString()}).`);
    }
    return out;
  }, [derived.problems, stampEstimate]);

  const warnChars = useMemo(() => unsupportedChars(text), [text]);

  const previewPage = selectedPages[Math.min(previewIdx, Math.max(selectedPages.length - 1, 0))] ?? null;

  const currentKey = useMemo(
    () => JSON.stringify({ f: file?.name, s: file?.size, o: settings, r: selected ? [...selected] : null }),
    [file, settings, selected],
  );
  const resultFresh = result !== null && result.key === currentKey;

  const apply = useCallback(async () => {
    const src = srcRef.current;
    if (!src || !pages || problems.length > 0) return;
    const myRun = ++runId.current;
    setBusy(true);
    setError(null);
    setResult(null);
    setPreviewUrl(null);
    try {
      const stamps = buildStamps(
        pages.map((p) => ({ page: p.page, width: p.width, height: p.height })),
        selected,
        settings,
      );
      if (stamps.length === 0) throw new Error('Nothing to watermark with these settings.');
      const out = await stampText(src.slice(), stamps);
      if (myRun !== runId.current) return;
      setResult({ bytes: out, key: currentKey, stampCount: stamps.length, pageCount: selectedPages.length });
    } catch (e) {
      if (myRun === runId.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (myRun === runId.current) setBusy(false);
    }
  }, [pages, problems.length, selected, settings, currentKey, selectedPages.length]);

  const togglePreview = useCallback(() => {
    if (previewUrl) {
      setPreviewUrl(null);
      return;
    }
    if (!result) return;
    setPreviewUrl(URL.createObjectURL(new Blob([result.bytes as unknown as BlobPart], { type: 'application/pdf' })));
  }, [previewUrl, result]);

  const diag = previewPage ? diagonalAngle(previewPage.width, previewPage.height) : 0;
  const outName = `${fileBase}-watermarked.pdf`;

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
            Add a CONFIDENTIAL or DRAFT text watermark, diagonal or tiled. Files never leave your browser.
          </p>
        </div>
      )}

      {loading && (
        <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Reading PDF…
        </p>
      )}

      {pages && (
        <>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* ---------------------------------------------------------- left */}
            <div className="flex flex-col gap-3">
              <Panel>
                <PanelHeader title="Watermark text" />
                <div className="flex flex-col gap-3 p-3">
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_TEXTS.map((t) => (
                      <Button
                        key={t}
                        type="button"
                        size="sm"
                        variant={text === t ? 'default' : 'outline'}
                        onClick={() => setText(t)}
                        className="font-mono"
                      >
                        {t}
                      </Button>
                    ))}
                  </div>
                  <Field label="Text" hint="Standard PDF fonts: Latin characters only">
                    <Input
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      maxLength={120}
                      placeholder="Your watermark"
                      aria-label="Watermark text"
                    />
                  </Field>
                  {warnChars.length > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      The standard PDF fonts cannot draw {warnChars.slice(0, 6).map((c) => `"${c}"`).join(' ')}
                      {warnChars.length > 6 ? ' …' : ''}; they will appear as “?”.
                    </p>
                  )}
                </div>
              </Panel>

              <Panel>
                <PanelHeader title="Appearance" />
                <div className="flex flex-col gap-3 p-3">
                  <div className="flex flex-wrap gap-x-4 gap-y-3">
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
                        <div className="flex gap-1">
                          {COLOR_SWATCHES.map((c) => (
                            <button
                              key={c}
                              type="button"
                              aria-label={`Use ${c}`}
                              title={c}
                              onClick={() => setColorText(c)}
                              className="size-5 rounded-full border shadow-xs"
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>
                    </Field>
                  </div>
                  <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                    <Field label={`Opacity: ${opacityPct}%`} className="min-w-[160px] flex-1">
                      <Slider
                        value={[opacityPct]}
                        min={5}
                        max={100}
                        step={5}
                        onValueChange={(v) => setOpacityPct(v[0] ?? 20)}
                      />
                    </Field>
                    <div className="flex flex-wrap items-end gap-3">
                      <ToggleRow
                        checked={autoSize}
                        onChange={setAutoSize}
                        label={layout === 'single' ? 'Fit to page diagonal' : 'Fit to each tile'}
                      />
                      {!autoSize && (
                        <Field label="Size" hint="pt">
                          <Input
                            type="number"
                            min={4}
                            max={1000}
                            value={sizeText}
                            onChange={(e) => setSizeText(e.target.value)}
                            className="w-24 font-mono"
                          />
                        </Field>
                      )}
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel>
                <PanelHeader title="Orientation & layer" />
                <div className="flex flex-wrap items-start gap-x-6 gap-y-3 p-3">
                  <Field
                    label="Rotation"
                    hint={rotationMode === 'diagonal' ? `corner to corner, ${diag.toFixed(1)}° on this page` : undefined}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Tabs value={rotationMode} onValueChange={(v) => setRotationMode(v as RotationMode)}>
                        <TabsList>
                          <TabsTrigger value="diagonal">Diagonal</TabsTrigger>
                          <TabsTrigger value="custom">Custom</TabsTrigger>
                        </TabsList>
                      </Tabs>
                      {rotationMode === 'custom' && (
                        <>
                          <Input
                            type="number"
                            min={-360}
                            max={360}
                            value={rotationText}
                            onChange={(e) => setRotationText(e.target.value)}
                            className="w-20 font-mono"
                            aria-label="Rotation in degrees"
                          />
                          <span className="text-xs text-muted-foreground">°</span>
                          {[0, 30, 45, 90].map((a) => (
                            <Button
                              key={a}
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setRotationText(String(a))}
                              className="font-mono"
                            >
                              {a}°
                            </Button>
                          ))}
                        </>
                      )}
                    </div>
                  </Field>
                  <Field
                    label="Layer"
                    hint={layer === 'under' ? 'Hidden behind pages that have a solid background (e.g. scans).' : undefined}
                  >
                    <Tabs value={layer} onValueChange={(v) => setLayer(v as 'over' | 'under')}>
                      <TabsList>
                        <TabsTrigger value="over">Over content</TabsTrigger>
                        <TabsTrigger value="under">Under content</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </Field>
                </div>
              </Panel>

              <Panel>
                <PanelHeader title="Layout & pages" />
                <div className="flex flex-col gap-3 p-3">
                  <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
                    <Field label="Layout">
                      <Tabs value={layout} onValueChange={(v) => setLayout(v as Layout)}>
                        <TabsList>
                          <TabsTrigger value="single">Single, centered</TabsTrigger>
                          <TabsTrigger value="tile">Tiled grid</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </Field>
                    {layout === 'tile' && (
                      <>
                        <Field label="Rows">
                          <Input
                            type="number"
                            min={1}
                            max={20}
                            value={rowsText}
                            onChange={(e) => setRowsText(e.target.value)}
                            className="w-20 font-mono"
                          />
                        </Field>
                        <Field label="Columns">
                          <Input
                            type="number"
                            min={1}
                            max={20}
                            value={colsText}
                            onChange={(e) => setColsText(e.target.value)}
                            className="w-20 font-mono"
                          />
                        </Field>
                        <div className="self-end pb-1.5">
                          <ToggleRow checked={stagger} onChange={setStagger} label="Stagger rows" />
                        </div>
                      </>
                    )}
                  </div>
                  <Field label="Pages to watermark" hint={`blank = all ${pages.length}, e.g. 2-10 or 1,3,5-8`}>
                    <Input
                      value={rangeText}
                      onChange={(e) => {
                        setRangeText(e.target.value);
                        setPreviewIdx(0);
                      }}
                      className="w-56 font-mono"
                      placeholder="all pages"
                      spellCheck={false}
                      aria-label="Pages to watermark"
                    />
                  </Field>
                </div>
              </Panel>
            </div>

            {/* --------------------------------------------------------- right */}
            <div className="flex flex-col gap-3 lg:sticky lg:top-3 lg:self-start">
              <Panel>
                <PanelHeader title="Preview">
                  {selectedPages.length > 1 && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Previous page"
                        disabled={previewIdx <= 0}
                        onClick={() => setPreviewIdx((i) => Math.max(0, i - 1))}
                      >
                        <ChevronLeft className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Next page"
                        disabled={previewIdx >= selectedPages.length - 1}
                        onClick={() => setPreviewIdx((i) => Math.min(selectedPages.length - 1, i + 1))}
                      >
                        <ChevronRight className="size-3.5" />
                      </Button>
                    </>
                  )}
                </PanelHeader>
                <div className="flex justify-center p-4">
                  {previewPage ? (
                    <WatermarkPreview width={previewPage.width} height={previewPage.height} s={settings} />
                  ) : (
                    <p className="p-6 text-center text-xs text-muted-foreground">No pages selected.</p>
                  )}
                </div>
                <StatBar
                  items={[
                    previewPage && `page ${previewPage.page} of ${pages.length}`,
                    previewPage && `${Math.round(previewPage.width)} × ${Math.round(previewPage.height)} pt`,
                    `${selectedPages.length} to watermark`,
                  ]}
                />
              </Panel>

              {problems.map((p) => (
                <ErrorBanner key={p} error={p} />
              ))}

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={apply} disabled={busy || loading || problems.length > 0}>
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Add watermark
                </Button>
              </div>

              {result && !resultFresh && !busy && (
                <p className="text-xs text-muted-foreground">Settings changed since the last run. Add the watermark again to refresh the download.</p>
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
                      filename={outName}
                      mime="application/pdf"
                      label="Download PDF"
                      variant="secondary"
                    />
                  </PanelHeader>
                  {previewUrl && (
                    <iframe src={previewUrl} title="Watermarked PDF preview" className="h-[420px] w-full bg-muted/30" />
                  )}
                  <StatBar
                    items={[
                      `${result.pageCount} page${result.pageCount === 1 ? '' : 's'} watermarked`,
                      `${result.stampCount} stamp${result.stampCount === 1 ? '' : 's'}`,
                      `output: ${formatBytes(result.bytes.length)}`,
                      outName,
                    ]}
                  />
                </Panel>
              )}
            </div>
          </div>
          <p className="px-1 text-2xs text-muted-foreground">
            The watermark is real PDF text drawn with a standard font (Latin characters only), with transparency. It is added
            to the page, so it is not tamper-proof: anyone can edit or remove it with a PDF editor.
          </p>
        </>
      )}
    </div>
  );
}
