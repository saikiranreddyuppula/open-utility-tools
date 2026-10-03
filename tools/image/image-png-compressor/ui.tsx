'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Trash2, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileDropzone } from '@/components/tools/file-dropzone';
import { ErrorBanner } from '@/components/tools/error-banner';
import { DownloadButton } from '@/components/tools/download-button';
import { formatBytes } from '@/lib/download';
import { zipFiles } from '@/lib/zip';
import { cn } from '@/lib/utils';
import {
  CancelledError,
  MAX_PIXELS,
  compressPngBytes,
  compressRgba,
  describeFormat,
  isPng,
  type CompressOptions,
  type CompressOutput,
} from './logic';

type Mode = 'lossy' | 'lossless';
type View = 'side' | 'slider';
type Status = 'queued' | 'working' | 'done' | 'error';

interface Settings {
  mode: Mode;
  colors: number;
  dither: number; // 0..100
  keepColorInfo: boolean;
  clearTransparent: boolean;
}

interface ItemResult {
  url: string;
  size: number;
  kept: boolean;
  converted: boolean;
  label: string;
  width: number;
  height: number;
}

interface Item {
  id: string;
  name: string;
  size: number;
  origUrl: string;
  status: Status;
  progress: number;
  doneKey: string;
  error?: string;
  result?: ItemResult;
}

const MAX_FILES = 100;
const MAX_FILE_BYTES = 120 * 1024 * 1024;

const CHECKER: React.CSSProperties = {
  backgroundImage:
    'conic-gradient(rgba(128,128,128,.22) 25%, transparent 0 50%, rgba(128,128,128,.22) 0 75%, transparent 0)',
  backgroundSize: '16px 16px',
};

const keyOf = (s: Settings): string =>
  s.mode === 'lossy'
    ? `lossy|${s.colors}|${s.dither}|${s.keepColorInfo}`
    : `lossless|${s.clearTransparent}|${s.keepColorInfo}`;

const toOptions = (s: Settings): CompressOptions => ({
  mode: s.mode,
  colors: s.colors,
  dither: s.dither / 100,
  keepColorInfo: s.keepColorInfo,
  clearTransparent: s.clearTransparent,
});

async function decodeWithCanvas(file: File): Promise<{ rgba: Uint8Array; w: number; h: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new globalThis.Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('Could not decode this image — is it a valid JPEG, WebP or PNG?'));
      im.src = url;
    });
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (w < 1 || h < 1) throw new Error('Image has no pixels.');
    if (w * h > MAX_PIXELS) {
      throw new Error(`Image is ${((w * h) / 1e6).toFixed(1)} megapixels — the limit is ${MAX_PIXELS / 1e6} MP.`);
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas is not available in this browser.');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, w, h).data;
    const rgba = new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
    canvas.width = 0;
    return { rgba, w, h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function pct(before: number, after: number): string {
  if (before <= 0) return '0%';
  const d = (1 - after / before) * 100;
  return d >= 0 ? `−${d.toFixed(d >= 10 ? 0 : 1)}%` : `+${(-d).toFixed(1)}%`;
}

function CompareSlider({ before, after, w, h }: { before: string; after: string; w: number; h: number }) {
  const [pos, setPos] = useState(50);
  return (
    <div
      className="relative mx-auto w-full overflow-hidden rounded border"
      style={{ ...CHECKER, aspectRatio: `${w} / ${h}`, maxWidth: `${Math.max(120, Math.round((420 * w) / h))}px` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after} alt="compressed" className="absolute inset-0 h-full w-full object-contain" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={before}
        alt="original"
        className="absolute inset-0 h-full w-full object-contain"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-primary shadow" style={{ left: `${pos}%` }} />
      <span className="pointer-events-none absolute left-1.5 top-1.5 rounded bg-background/80 px-1.5 py-0.5 text-2xs font-medium">
        Original
      </span>
      <span className="pointer-events-none absolute right-1.5 top-1.5 rounded bg-background/80 px-1.5 py-0.5 text-2xs font-medium">
        Compressed
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={0.1}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Compare original and compressed"
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}

function ItemCard({
  item,
  view,
  onRemove,
}: {
  item: Item;
  view: View;
  onRemove: (id: string) => void;
}) {
  const r = item.result;
  return (
    <Panel>
      <PanelHeader title={<span className="block max-w-[46vw] truncate normal-case sm:max-w-[420px]">{item.name}</span>}>
        {item.status === 'working' && <Loader2 className="mr-1 size-3.5 animate-spin text-muted-foreground" />}
        {item.status === 'done' && r && !r.kept && <CheckCircle2 className="mr-1 size-3.5 text-emerald-500" />}
        {r && (
          <a href={r.url} download={r.kept ? item.name : item.name.replace(/\.[^.]+$/, '') + '.png'} aria-label={`Download ${item.name}`}>
            <Button type="button" variant="ghost" size="sm">
              <Download className="size-3.5" /> Download
            </Button>
          </a>
        )}
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${item.name}`} onClick={() => onRemove(item.id)}>
          <Trash2 className="size-3.5" />
        </Button>
      </PanelHeader>

      {item.status === 'error' && (
        <div className="flex items-start gap-2 p-3 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span className="break-words">{item.error}</span>
        </div>
      )}

      {(item.status === 'queued' || item.status === 'working') && !r && (
        <div className="space-y-2 p-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-150"
              style={{ width: `${Math.round(item.progress * 100)}%` }}
            />
          </div>
          <p className="text-2xs text-muted-foreground">
            {item.status === 'queued' ? 'Waiting…' : `Compressing… ${Math.round(item.progress * 100)}%`}
          </p>
        </div>
      )}

      {r && (
        <div className={cn('relative p-3', item.status === 'working' && 'opacity-60')}>
          {view === 'slider' ? (
            <CompareSlider before={item.origUrl} after={r.url} w={r.width} h={r.height} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <figure className="space-y-1">
                <figcaption className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Original · {formatBytes(item.size)}
                </figcaption>
                <div className="flex justify-center rounded border p-1" style={CHECKER}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.origUrl} alt="original" className="max-h-[300px] max-w-full object-contain" />
                </div>
              </figure>
              <figure className="space-y-1">
                <figcaption className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {r.kept ? 'Kept original' : 'Compressed'} · {formatBytes(r.size)}
                </figcaption>
                <div className="flex justify-center rounded border p-1" style={CHECKER}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.url} alt="compressed" className="max-h-[300px] max-w-full object-contain" />
                </div>
              </figure>
            </div>
          )}
          {item.status === 'working' && (
            <div className="absolute inset-x-3 bottom-1.5 h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${Math.round(item.progress * 100)}%` }} />
            </div>
          )}
        </div>
      )}

      {r && (
        <StatBar
          items={[
            `${formatBytes(item.size)} → ${formatBytes(r.size)}`,
            r.kept ? 'already optimal — original kept' : pct(item.size, r.size),
            r.label,
            `${r.width}×${r.height}`,
          ]}
        />
      )}
    </Panel>
  );
}

export default function PngCompressorTool() {
  const [settings, setSettings] = useState<Settings>({
    mode: 'lossy',
    colors: 256,
    dither: 75,
    keepColorInfo: true,
    clearTransparent: false,
  });
  const [view, setView] = useState<View>('side');
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);

  const itemsRef = useRef<Item[]>([]);
  const filesRef = useRef<Map<string, File>>(new Map());
  const outputsRef = useRef<Map<string, Uint8Array>>(new Map());
  const appliedRef = useRef<Settings>(settings);
  const [ctl] = useState(() => ({ epoch: 0, running: false, id: 0, mounted: true }));

  const commit = useCallback((next: Item[]) => {
    itemsRef.current = next;
    if (ctl.mounted) setItems(next);
  }, [ctl]);

  const patch = useCallback(
    (id: string, p: Partial<Item>) => {
      commit(itemsRef.current.map((it) => (it.id === id ? { ...it, ...p } : it)));
    },
    [commit]
  );

  const revokeResult = (it: Item) => {
    if (it.result && it.result.url !== it.origUrl) URL.revokeObjectURL(it.result.url);
  };

  const processItem = useCallback(
    async (item: Item, settingsNow: Settings) => {
      const myEpoch = ctl.epoch;
      const key = keyOf(settingsNow);
      const file = filesRef.current.get(item.id);
      if (!file) return;
      const cancelled = () => ctl.epoch !== myEpoch || !filesRef.current.has(item.id);
      let lastPaint = 0;
      const hooks = {
        shouldCancel: cancelled,
        onProgress: (f: number) => {
          const t = performance.now();
          if (t - lastPaint > 90) {
            lastPaint = t;
            patch(item.id, { progress: f });
          }
        },
      };
      patch(item.id, { status: 'working', progress: 0 });
      try {
        if (file.size > MAX_FILE_BYTES) throw new Error(`File is larger than ${formatBytes(MAX_FILE_BYTES)}.`);
        const bytes = new Uint8Array(await file.arrayBuffer());
        const opts = toOptions(settingsNow);
        const pngInput = isPng(bytes);
        let out: CompressOutput;
        if (pngInput) {
          out = await compressPngBytes(bytes, opts, hooks);
        } else {
          const looksOk =
            (bytes[0] === 0xff && bytes[1] === 0xd8) ||
            (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45);
          if (!looksOk) throw new Error('Unsupported file — please add PNG, JPEG or WebP images.');
          const dec = await decodeWithCanvas(file);
          if (cancelled()) throw new CancelledError();
          out = await compressRgba(dec.rgba, dec.w, dec.h, opts, [], hooks);
        }
        if (cancelled()) throw new CancelledError();
        const prev = itemsRef.current.find((i) => i.id === item.id);
        if (!prev) return;
        revokeResult(prev);
        const keep = pngInput && out.png.length >= bytes.length;
        let result: ItemResult;
        if (keep) {
          outputsRef.current.set(item.id, bytes);
          result = {
            url: item.origUrl,
            size: bytes.length,
            kept: true,
            converted: false,
            label: `best attempt was ${formatBytes(out.png.length)}`,
            width: out.width,
            height: out.height,
          };
        } else {
          outputsRef.current.set(item.id, out.png);
          const blob = new Blob([out.png as unknown as BlobPart], { type: 'image/png' });
          const lossyApprox = settingsNow.mode === 'lossy' && !out.lossless;
          result = {
            url: URL.createObjectURL(blob),
            size: out.png.length,
            kept: false,
            converted: !pngInput,
            label:
              (lossyApprox ? `${out.paletteSize} colours · ` : '') +
              (out.colorType === 3
                ? `PNG-${out.bitDepth} indexed${lossyApprox ? '' : ` (${out.paletteSize} colours)`}`
                : describeFormat(out.colorType, out.bitDepth)) +
              (!pngInput ? ' · converted to PNG' : out.lossless && settingsNow.mode === 'lossy' ? ' · no loss' : ''),
            width: out.width,
            height: out.height,
          };
        }
        patch(item.id, { status: 'done', progress: 1, doneKey: key, result, error: undefined });
      } catch (e) {
        if (e instanceof CancelledError) {
          patch(item.id, { status: 'queued', progress: 0 });
          return;
        }
        const msg = e instanceof Error ? e.message : 'Compression failed.';
        patch(item.id, { status: 'error', progress: 0, doneKey: key, error: msg });
      }
    },
    [patch, ctl]
  );

  const runQueue = useCallback(async () => {
    if (ctl.running) return;
    ctl.running = true;
    try {
      for (;;) {
        if (!ctl.mounted) break;
        const s = appliedRef.current;
        const key = keyOf(s);
        const next = itemsRef.current.find((i) => i.doneKey !== key);
        if (!next) break;
        await processItem(next, s);
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    } finally {
      ctl.running = false;
    }
  }, [processItem, ctl]);

  // apply option changes after a short pause (sliders fire continuously)
  const settingsKey = keyOf(settings);
  useEffect(() => {
    const t = setTimeout(() => {
      if (keyOf(appliedRef.current) === settingsKey) return;
      appliedRef.current = settings;
      ctl.epoch++;
      void runQueue();
    }, 350);
    return () => clearTimeout(t);
  }, [settings, settingsKey, runQueue, ctl]);

  useEffect(() => {
    ctl.mounted = true;
    const files = filesRef.current;
    return () => {
      ctl.mounted = false;
      ctl.epoch++;
      for (const it of itemsRef.current) {
        URL.revokeObjectURL(it.origUrl);
        if (it.result && it.result.url !== it.origUrl) URL.revokeObjectURL(it.result.url);
      }
      files.clear();
    };
  }, [ctl]);

  const addFiles = useCallback(
    (files: File[]) => {
      setError(null);
      const room = MAX_FILES - itemsRef.current.length;
      if (room <= 0) {
        setError(`You can process up to ${MAX_FILES} images at a time.`);
        return;
      }
      const accepted = files.slice(0, room);
      if (files.length > room) setError(`Only the first ${room} files were added (limit ${MAX_FILES}).`);
      const added: Item[] = accepted.map((f) => {
        const id = `f${++ctl.id}`;
        filesRef.current.set(id, f);
        return {
          id,
          name: f.name,
          size: f.size,
          origUrl: URL.createObjectURL(f),
          status: 'queued',
          progress: 0,
          doneKey: '',
        };
      });
      commit([...itemsRef.current, ...added]);
      void runQueue();
    },
    [commit, runQueue, ctl]
  );

  const removeItem = useCallback(
    (id: string) => {
      const it = itemsRef.current.find((i) => i.id === id);
      if (!it) return;
      URL.revokeObjectURL(it.origUrl);
      revokeResult(it);
      filesRef.current.delete(id);
      outputsRef.current.delete(id);
      commit(itemsRef.current.filter((i) => i.id !== id));
    },
    [commit]
  );

  const clearAll = useCallback(() => {
    for (const it of itemsRef.current) {
      URL.revokeObjectURL(it.origUrl);
      revokeResult(it);
    }
    filesRef.current.clear();
    outputsRef.current.clear();
    commit([]);
    setError(null);
  }, [commit]);

  const done = items.filter((i) => i.status === 'done' && i.result);
  const totalBefore = done.reduce((n, i) => n + i.size, 0);
  const totalAfter = done.reduce((n, i) => n + (i.result?.size ?? 0), 0);
  const busy = items.some((i) => i.status === 'working' || i.status === 'queued');
  const overall =
    items.length === 0 ? 0 : items.reduce((n, i) => n + (i.status === 'done' || i.status === 'error' ? 1 : i.progress), 0) / items.length;

  const buildZip = useCallback(async () => {
    const entries = itemsRef.current
      .filter((i) => i.status === 'done' && i.result)
      .map((i) => {
        const data = outputsRef.current.get(i.id);
        const kept = i.result?.kept ?? false;
        return data ? { name: kept ? i.name : i.name.replace(/\.[^.]+$/, '') + '.png', data } : null;
      })
      .filter((e): e is { name: string; data: Uint8Array } => e !== null);
    return zipFiles(entries, 0);
  }, []);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings((s) => ({ ...s, [k]: v }));

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Mode">
            <Tabs value={settings.mode} onValueChange={(v) => set('mode', v as Mode)}>
              <TabsList>
                <TabsTrigger value="lossy">Lossy · smallest</TabsTrigger>
                <TabsTrigger value="lossless">Lossless</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {settings.mode === 'lossy' ? (
            <>
              <Field label={`Colours: ${settings.colors}`} className="min-w-[180px] flex-1">
                <Slider
                  value={[settings.colors]}
                  min={2}
                  max={256}
                  step={1}
                  onValueChange={(v) => set('colors', v[0] ?? 256)}
                  aria-label="Number of colours"
                />
              </Field>
              <Field label={`Dithering: ${settings.dither}%`} className="min-w-[160px] flex-1">
                <Slider
                  value={[settings.dither]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={(v) => set('dither', v[0] ?? 0)}
                  aria-label="Dithering strength"
                />
              </Field>
            </>
          ) : (
            <Field label="Hidden pixels">
              <div className="flex h-8 items-center gap-2">
                <Switch
                  id="clear-transparent"
                  checked={settings.clearTransparent}
                  onCheckedChange={(c) => set('clearTransparent', c)}
                />
                <Label htmlFor="clear-transparent" className="text-xs text-muted-foreground">
                  clear colours under transparency
                </Label>
              </div>
            </Field>
          )}
          <Field label="Colour profile">
            <div className="flex h-8 items-center gap-2">
              <Switch id="keep-color" checked={settings.keepColorInfo} onCheckedChange={(c) => set('keepColorInfo', c)} />
              <Label htmlFor="keep-color" className="text-xs text-muted-foreground">
                keep ICC / gamma
              </Label>
            </div>
          </Field>
          <Field label="Preview">
            <Tabs value={view} onValueChange={(v) => setView(v as View)}>
              <TabsList>
                <TabsTrigger value="side">Side by side</TabsTrigger>
                <TabsTrigger value="slider">Slider</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </OptionsBar>
      </Panel>

      <FileDropzone
        onFiles={addFiles}
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        multiple
        compact={items.length > 0}
        label={items.length > 0 ? 'Add more images' : 'Drop PNG images here'}
        hint="PNG, JPEG or WebP · output is always PNG · up to 100 files, 40 megapixels each"
      />

      <ErrorBanner error={error} />

      {items.length === 0 && (
        <p className="px-1 text-xs text-muted-foreground">
          Lossy mode reduces the image to a palette of up to 256 colours (like TinyPNG / pngquant) with optional
          Floyd–Steinberg dithering — typically 50–80% smaller. Lossless mode keeps every pixel exactly and only
          re-encodes the file more efficiently. Nothing is uploaded; everything runs in your browser.
        </p>
      )}

      {items.length > 0 && (
        <Panel>
          <PanelHeader title={`${items.length} image${items.length === 1 ? '' : 's'}`}>
            <DownloadButton
              data={buildZip}
              filename="compressed-png.zip"
              mime="application/zip"
              label="Download all (ZIP)"
              variant="secondary"
              disabled={done.length === 0}
            />
            <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
              <Trash2 className="size-3.5" /> Clear
            </Button>
          </PanelHeader>
          {busy && (
            <div className="h-1 w-full bg-muted">
              <div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${Math.round(overall * 100)}%` }} />
            </div>
          )}
          <StatBar
            items={[
              `${done.length}/${items.length} done`,
              done.length > 0 && `${formatBytes(totalBefore)} → ${formatBytes(totalAfter)}`,
              done.length > 0 &&
                (totalAfter <= totalBefore
                  ? `saved ${formatBytes(totalBefore - totalAfter)} (${pct(totalBefore, totalAfter)})`
                  : `${formatBytes(totalAfter - totalBefore)} larger (${pct(totalBefore, totalAfter)}) — JPEG/WebP converted to PNG`),
            ]}
          />
        </Panel>
      )}

      <div className="space-y-3">
        {items.map((it) => (
          <ItemCard key={it.id} item={it} view={view} onRemove={removeItem} />
        ))}
      </div>

      <p className="px-1 text-2xs text-muted-foreground">
        Animated PNGs are skipped to preserve the animation. Metadata (text, EXIF, timestamps, DPI) is removed; if an
        output would not be smaller, your original file is kept untouched. JPEG/WebP inputs are converted to PNG.
      </p>
    </div>
  );
}
