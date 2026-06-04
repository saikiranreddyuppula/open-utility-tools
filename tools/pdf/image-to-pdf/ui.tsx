'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Loader2, X } from 'lucide-react';
import { zlibSync } from 'fflate';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { FileDropzone } from '@/components/tools/file-dropzone';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { formatBytes } from '@/lib/download';

// ---------------------------------------------------------------------------
// Tool state types
// ---------------------------------------------------------------------------

interface Item {
  file: File;
  id: string;
  url: string;
}

type PageSize = 'fit' | 'a4' | 'a3' | 'a5' | 'letter' | 'legal';
type Orientation = 'auto' | 'portrait' | 'landscape';
type Format = 'jpeg' | 'png';

/** Standard page sizes in PDF points (1pt = 1/72in), portrait [width, height]. */
const PAGE_SIZES_PT: Record<Exclude<PageSize, 'fit'>, [number, number]> = {
  a4: [595.28, 841.89],
  a3: [841.89, 1190.55],
  a5: [419.53, 595.28],
  letter: [612, 792],
  legal: [612, 1008],
};

const MM_TO_PT = 72 / 25.4;

const PAGE_SIZE_LABELS: Record<PageSize, string> = {
  fit: 'Fit to image',
  a4: 'A4',
  a3: 'A3',
  a5: 'A5',
  letter: 'US Letter',
  legal: 'US Legal',
};

// ---------------------------------------------------------------------------
// Image decoding + encoding
// ---------------------------------------------------------------------------

function decodeImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new globalThis.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image'));
    img.src = url;
  });
}

interface Embed {
  bytes: Uint8Array;
  width: number;
  height: number;
  filter: 'DCTDecode' | 'FlateDecode';
  /** Deflated 8-bit grayscale alpha channel (FlateDecode), present only when the image has transparency. */
  smask?: Uint8Array;
}

/**
 * Rasterize an image to an embeddable stream. JPEG re-encodes through canvas and
 * is embedded verbatim via DCTDecode (small, photographic). PNG/lossless embeds
 * raw RGB via FlateDecode plus a soft-mask for any alpha (pixel-perfect).
 */
async function encodeImage(
  img: HTMLImageElement,
  format: Format,
  quality: number,
  bg: [number, number, number]
): Promise<Embed> {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error('Image has no intrinsic size');

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get a 2D canvas context (the image may be too large)');

  // JPEG has no alpha: flatten transparency onto the background first.
  if (format === 'jpeg') {
    ctx.fillStyle = `rgb(${Math.round(bg[0] * 255)}, ${Math.round(bg[1] * 255)}, ${Math.round(bg[2] * 255)})`;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);

  if (format === 'jpeg') {
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob) throw new Error('JPEG encoding failed');
    return { bytes: new Uint8Array(await blob.arrayBuffer()), width: w, height: h, filter: 'DCTDecode' };
  }

  // Lossless: split RGBA into a deflated RGB plane and (if needed) an alpha mask.
  const { data } = ctx.getImageData(0, 0, w, h);
  const px = w * h;
  const rgb = new Uint8Array(px * 3);
  const alpha = new Uint8Array(px);
  let hasAlpha = false;
  for (let i = 0; i < px; i++) {
    rgb[i * 3] = data[i * 4]!;
    rgb[i * 3 + 1] = data[i * 4 + 1]!;
    rgb[i * 3 + 2] = data[i * 4 + 2]!;
    const a = data[i * 4 + 3]!;
    alpha[i] = a;
    if (a !== 255) hasAlpha = true;
  }
  const embed: Embed = { bytes: zlibSync(rgb, { level: 9 }), width: w, height: h, filter: 'FlateDecode' };
  if (hasAlpha) embed.smask = zlibSync(alpha, { level: 9 });
  return embed;
}

// ---------------------------------------------------------------------------
// Page geometry
// ---------------------------------------------------------------------------

interface Geometry {
  pageW: number;
  pageH: number;
  drawW: number;
  drawH: number;
  drawX: number;
  drawY: number;
}

interface LayoutOpts {
  pageSize: PageSize;
  orientation: Orientation;
  marginMm: number;
}

function computeGeometry(imgW: number, imgH: number, opts: LayoutOpts): Geometry {
  // "Fit to image": the page is exactly the image (1px = 1pt), no margins.
  if (opts.pageSize === 'fit') {
    return { pageW: imgW, pageH: imgH, drawW: imgW, drawH: imgH, drawX: 0, drawY: 0 };
  }

  let [pw, ph] = PAGE_SIZES_PT[opts.pageSize];
  const landscape =
    opts.orientation === 'landscape' || (opts.orientation === 'auto' && imgW > imgH);
  if (landscape) [pw, ph] = [ph, pw];

  const m = Math.max(0, opts.marginMm) * MM_TO_PT;
  const availW = Math.max(1, pw - 2 * m);
  const availH = Math.max(1, ph - 2 * m);
  const scale = Math.min(availW / imgW, availH / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  return { pageW: pw, pageH: ph, drawW, drawH, drawX: (pw - drawW) / 2, drawY: (ph - drawH) / 2 };
}

// ---------------------------------------------------------------------------
// Minimal PDF writer
// ---------------------------------------------------------------------------

interface PagePlan extends Geometry {
  embed: Embed;
  bg: [number, number, number];
}

/** Format a number for the PDF content stream — integers stay bare, else fixed precision. */
function fmt(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return Number.isInteger(n) ? String(n) : n.toFixed(3);
}

function buildPdf(pages: PagePlan[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let length = 0;
  const offsets: number[] = [];

  const push = (b: Uint8Array | string) => {
    const u = typeof b === 'string' ? enc.encode(b) : b;
    chunks.push(u);
    length += u.length;
  };

  // Allocate object numbers: 1 = Catalog, 2 = Pages, then 3..n per page.
  let next = 3;
  const plan = pages.map((p) => {
    const pageNum = next++;
    const contentNum = next++;
    const imageNum = next++;
    const smaskNum = p.embed.smask ? next++ : 0;
    return { p, pageNum, contentNum, imageNum, smaskNum };
  });
  const objCount = next - 1;

  push('%PDF-1.7\n');
  // Binary marker comment so tools treat the file as binary.
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const writeObj = (num: number, body: string) => {
    offsets[num] = length;
    push(`${num} 0 obj\n${body}\nendobj\n`);
  };
  const writeStreamObj = (num: number, dict: string, data: Uint8Array) => {
    offsets[num] = length;
    push(`${num} 0 obj\n${dict}\nstream\n`);
    push(data);
    push('\nendstream\nendobj\n');
  };

  writeObj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  const kids = plan.map((x) => `${x.pageNum} 0 R`).join(' ');
  writeObj(2, `<< /Type /Pages /Kids [ ${kids} ] /Count ${plan.length} >>`);

  for (const x of plan) {
    const { p } = x;
    const e = p.embed;
    const [r, g, b] = p.bg;

    // Content: paint the background, then map the image's unit square onto the page.
    const content =
      `q ${fmt(r)} ${fmt(g)} ${fmt(b)} rg 0 0 ${fmt(p.pageW)} ${fmt(p.pageH)} re f Q\n` +
      `q ${fmt(p.drawW)} 0 0 ${fmt(p.drawH)} ${fmt(p.drawX)} ${fmt(p.drawY)} cm /Im0 Do Q\n`;
    const contentBytes = enc.encode(content);

    writeObj(
      x.pageNum,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fmt(p.pageW)} ${fmt(p.pageH)}] ` +
        `/Resources << /XObject << /Im0 ${x.imageNum} 0 R >> >> /Contents ${x.contentNum} 0 R >>`
    );
    writeStreamObj(x.contentNum, `<< /Length ${contentBytes.length} >>`, contentBytes);

    let imgDict =
      `<< /Type /XObject /Subtype /Image /Width ${e.width} /Height ${e.height} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /${e.filter} /Length ${e.bytes.length}`;
    if (x.smaskNum) imgDict += ` /SMask ${x.smaskNum} 0 R`;
    imgDict += ' >>';
    writeStreamObj(x.imageNum, imgDict, e.bytes);

    if (x.smaskNum && e.smask) {
      writeStreamObj(
        x.smaskNum,
        `<< /Type /XObject /Subtype /Image /Width ${e.width} /Height ${e.height} ` +
          `/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${e.smask.length} >>`,
        e.smask
      );
    }
  }

  // Cross-reference table — every entry is exactly 20 bytes.
  const xrefStart = length;
  push(`xref\n0 ${objCount + 1}\n`);
  push('0000000000 65535 f\r\n');
  for (let n = 1; n <= objCount; n++) {
    push(`${(offsets[n] ?? 0).toString().padStart(10, '0')} 00000 n\r\n`);
  }
  push(`trailer\n<< /Size ${objCount + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return [1, 1, 1];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ImageToPdfTool() {
  const [items, setItems] = useState<Item[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>('a4');
  const [orientation, setOrientation] = useState<Orientation>('auto');
  const [marginMm, setMarginMm] = useState(10);
  const [format, setFormat] = useState<Format>('jpeg');
  const [quality, setQuality] = useState(0.92);
  const [bg, setBg] = useState('#ffffff');

  const [result, setResult] = useState<Uint8Array | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastPreview = useRef<string | null>(null);
  const objectUrls = useRef<Set<string>>(new Set());
  const idCounter = useRef(0);
  // Monotonic token: a generate() run only commits its result while it is still
  // the latest run, so changing inputs mid-flight discards stale output.
  const runId = useRef(0);

  // Revoke every object URL we created on unmount.
  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      for (const u of urls) URL.revokeObjectURL(u);
      urls.clear();
      if (lastPreview.current) URL.revokeObjectURL(lastPreview.current);
    };
  }, []);

  // Drop any cached output so the preview never lingers out of sync with the
  // current images/options, and invalidate any in-flight generate().
  const clearOutput = useCallback(() => {
    runId.current++;
    setBusy(false);
    setResult(null);
    setError(null);
    if (lastPreview.current) {
      URL.revokeObjectURL(lastPreview.current);
      lastPreview.current = null;
    }
    setPreviewUrl(null);
  }, []);

  const addFiles = useCallback(
    (files: File[]) => {
      const imgs = files.filter((f) => f.type.startsWith('image/'));
      const skipped = files.length - imgs.length;
      if (imgs.length > 0) {
        // Create object URLs outside the state updater so StrictMode's
        // double-invoke can't leak duplicates.
        const added = imgs.map((file) => {
          const url = URL.createObjectURL(file);
          objectUrls.current.add(url);
          return { file, id: `img-${idCounter.current++}`, url };
        });
        setItems((prev) => [...prev, ...added]);
      }
      clearOutput();
      if (skipped > 0) setError(`Skipped ${skipped} non-image file${skipped === 1 ? '' : 's'}.`);
    },
    [clearOutput]
  );

  const move = (i: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
    clearOutput();
  };

  // Drag-to-reorder the page list.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    setItems((prev) => {
      if (from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      return next;
    });
    clearOutput();
  };

  const remove = (id: string) => {
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target) {
        URL.revokeObjectURL(target.url);
        objectUrls.current.delete(target.url);
      }
      return prev.filter((it) => it.id !== id);
    });
    clearOutput();
  };

  const generate = useCallback(async () => {
    if (items.length === 0) return;
    const myRun = ++runId.current;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const bgRgb = hexToRgb(bg);
      const plans: PagePlan[] = [];
      for (const it of items) {
        const img = await decodeImage(it.url);
        const embed = await encodeImage(img, format, quality, bgRgb);
        const geo = computeGeometry(embed.width, embed.height, { pageSize, orientation, marginMm });
        plans.push({ embed, bg: bgRgb, ...geo });
      }
      const pdf = buildPdf(plans);
      if (myRun !== runId.current) return; // superseded by newer input/run

      setResult(pdf);
      if (lastPreview.current) URL.revokeObjectURL(lastPreview.current);
      const url = URL.createObjectURL(new Blob([pdf as BlobPart], { type: 'application/pdf' }));
      lastPreview.current = url;
      setPreviewUrl(url);
    } catch (e) {
      if (myRun === runId.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (myRun === runId.current) setBusy(false);
    }
  }, [items, pageSize, orientation, marginMm, format, quality, bg]);

  const fixedSize = pageSize !== 'fit';

  return (
    <div className="flex flex-col gap-3">
      <FileDropzone
        onFiles={addFiles}
        accept="image/*"
        multiple
        label="Drop images"
        hint="JPG, PNG, WebP, GIF, BMP, SVG · one image per page"
        compact={items.length > 0}
      />

      {error && <ErrorBanner error={error} />}

      {items.length === 0 && (
        <p className="px-1 text-xs text-muted-foreground">
          Combine images into a single PDF — one image per page. Everything is processed locally in
          your browser; nothing is uploaded.
        </p>
      )}

      {items.length > 0 && (
        <>
          <OptionsBar>
            <Field label="Page size">
              <Select value={pageSize} onValueChange={(v) => { setPageSize(v as PageSize); clearOutput(); }}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PAGE_SIZE_LABELS) as PageSize[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {PAGE_SIZE_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {fixedSize && (
              <Field label="Orientation">
                <Select value={orientation} onValueChange={(v) => { setOrientation(v as Orientation); clearOutput(); }}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="portrait">Portrait</SelectItem>
                    <SelectItem value="landscape">Landscape</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}

            {fixedSize && (
              <Field label="Margin" hint="mm">
                <Input
                  type="number"
                  min={0}
                  value={marginMm}
                  onChange={(e) => { setMarginMm(Math.max(0, Number(e.target.value) || 0)); clearOutput(); }}
                  className="w-20 font-mono"
                />
              </Field>
            )}

            <Field label="Format">
              <Select value={format} onValueChange={(v) => { setFormat(v as Format); clearOutput(); }}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jpeg">JPEG (smaller)</SelectItem>
                  <SelectItem value="png">PNG (lossless)</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {format === 'jpeg' && (
              <Field label={`Quality: ${Math.round(quality * 100)}%`} className="min-w-[140px]">
                <Slider
                  value={[quality]}
                  min={0.3}
                  max={1}
                  step={0.01}
                  onValueChange={(v) => { setQuality(v[0] ?? 0.92); clearOutput(); }}
                />
              </Field>
            )}

            <Field label="Background">
              <Input
                type="color"
                value={bg}
                onChange={(e) => { setBg(e.target.value); clearOutput(); }}
                className="h-8 w-14 p-1"
              />
            </Field>

            <div className="flex items-end">
              <Button size="sm" onClick={generate} disabled={busy}>
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                Create PDF
              </Button>
            </div>
          </OptionsBar>

          <Panel>
            <PanelHeader title={`${items.length} image${items.length === 1 ? '' : 's'}`}>
              {items.length > 1 && (
                <span className="text-2xs text-muted-foreground">drag to reorder</span>
              )}
            </PanelHeader>
            <div className="divide-y">
              {items.map((it, i) => (
                <div
                  key={it.id}
                  draggable
                  onDragStart={(e) => {
                    setDragIndex(i);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (overIndex !== i) setOverIndex(i);
                  }}
                  onDragLeave={() => setOverIndex((o) => (o === i ? null : o))}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex !== null) reorder(dragIndex, i);
                    setDragIndex(null);
                    setOverIndex(null);
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setOverIndex(null);
                  }}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 transition-colors',
                    dragIndex === i && 'opacity-50',
                    overIndex === i && dragIndex !== null && dragIndex !== i && 'bg-accent/60'
                  )}
                >
                  <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing" />
                  <span className="w-5 text-right font-mono text-2xs text-muted-foreground tabular">
                    {i + 1}
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={it.url}
                    alt=""
                    draggable={false}
                    className="size-9 shrink-0 rounded border object-cover"
                  />
                  <span className="min-w-0 flex-1 truncate text-xs">{it.file.name}</span>
                  <span className="font-mono text-2xs text-muted-foreground">
                    {formatBytes(it.file.size)}
                  </span>
                  <Button size="icon-sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => move(i, 1)}
                    disabled={i === items.length - 1}
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <Button size="icon-sm" variant="ghost" onClick={() => remove(it.id)}>
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </Panel>

          {result && previewUrl && (
            <Panel>
              <PanelHeader title="PDF">
                <DownloadButton
                  data={() => result}
                  filename="images.pdf"
                  mime="application/pdf"
                  label="Download PDF"
                  variant="secondary"
                />
              </PanelHeader>
              <iframe src={previewUrl} title="PDF preview" className="h-[480px] w-full bg-muted/30" />
              <StatBar
                items={[
                  `${items.length} page${items.length === 1 ? '' : 's'}`,
                  `output: ${formatBytes(result.length)}`,
                ]}
              />
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
