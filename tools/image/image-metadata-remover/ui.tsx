'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Trash2, Download, CheckCircle2, AlertTriangle, Loader2, ShieldCheck, Camera } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { FileDropzone } from '@/components/tools/file-dropzone';
import { ErrorBanner } from '@/components/tools/error-banner';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { formatBytes } from '@/lib/download';
import { zipFiles } from '@/lib/zip';
import { cn } from '@/lib/utils';
import {
  buildSampleJpeg,
  detectFormat,
  stripMetadata,
  type Finding,
  type ImageFormat,
  type Risk,
  type StripOptions,
  type StripResult,
} from './logic';

interface ItemResult {
  url: string;
  size: number;
  name: string;
  findings: Finding[];
  notes: string[];
  clean: boolean;
  format: ImageFormat;
}

interface Item {
  id: string;
  name: string;
  size: number;
  thumb: string;
  status: 'working' | 'done' | 'error';
  optionsKey: string;
  error?: string;
  result?: ItemResult;
}

const MAX_FILES = 200;
const MAX_FILE_BYTES = 300 * 1024 * 1024;

const RISK_STYLE: Record<Risk, { dot: string; label: string }> = {
  high: { dot: 'bg-red-500', label: 'Identifies you or your location' },
  medium: { dot: 'bg-amber-500', label: 'Personal or revealing' },
  low: { dot: 'bg-sky-500', label: 'Minor' },
  info: { dot: 'bg-muted-foreground/50', label: 'Technical' },
};

const FORMAT_LABEL: Record<ImageFormat, string> = { jpeg: 'JPEG', png: 'PNG', webp: 'WebP' };

const optionsKeyOf = (o: StripOptions, suffix: boolean): string =>
  `${o.keepIcc ? 1 : 0}${o.keepOrientation ? 1 : 0}${o.keepCopyright ? 1 : 0}${suffix ? 1 : 0}`;

function outName(name: string, suffix: boolean): string {
  if (!suffix) return name;
  const dot = name.lastIndexOf('.');
  return dot > 0 ? `${name.slice(0, dot)}-clean${name.slice(dot)}` : `${name}-clean`;
}

function mimeOf(f: ImageFormat): string {
  return f === 'jpeg' ? 'image/jpeg' : f === 'png' ? 'image/png' : 'image/webp';
}

function FindingRow({ f }: { f: Finding }) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-1.5">
      <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', RISK_STYLE[f.risk].dot)} title={RISK_STYLE[f.risk].label} />
      <span className="w-40 shrink-0 text-xs font-medium sm:w-48">{f.label}</span>
      <span className="min-w-0 flex-1 break-words font-mono text-xs text-muted-foreground">{f.detail}</span>
      <span
        className={cn(
          'shrink-0 rounded px-1.5 py-0.5 text-2xs font-medium',
          f.kept ? 'bg-muted text-muted-foreground' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
        )}
      >
        {f.kept ? 'Kept' : 'Removed'}
      </span>
    </div>
  );
}

function ItemCard({ item, onRemove }: { item: Item; onRemove: (id: string) => void }) {
  const r = item.result;
  const removed = r ? r.findings.filter((f) => !f.kept) : [];
  const high = r ? r.findings.filter((f) => f.risk === 'high') : [];
  const saved = r ? item.size - r.size : 0;
  const hasAnything = r ? r.findings.some((f) => f.risk !== 'info' || !f.kept) : false;
  return (
    <Panel>
      <PanelHeader
        title={
          <span className="flex items-center gap-2 normal-case">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.thumb} alt="" className="size-6 rounded object-cover" />
            <span className="block max-w-[44vw] truncate sm:max-w-[420px]">{item.name}</span>
            {r && <span className="rounded bg-muted px-1.5 py-0.5 text-2xs font-semibold text-muted-foreground">{FORMAT_LABEL[r.format]}</span>}
          </span>
        }
      >
        {item.status === 'working' && <Loader2 className="mr-1 size-3.5 animate-spin text-muted-foreground" />}
        {r && (
          <a href={r.url} download={r.name} aria-label={`Download ${r.name}`}>
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

      {r && (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2 text-xs">
            {hasAnything ? (
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                {removed.length} item{removed.length === 1 ? '' : 's'} removed
                {high.length > 0 && <span className="text-red-600 dark:text-red-400">· including {high.map((h) => h.label.toLowerCase()).join(', ')}</span>}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="size-3.5 text-emerald-500" /> No personal metadata found — file is already clean
              </span>
            )}
          </div>
          {r.findings.length > 0 && (
            <div className="max-h-[480px] divide-y overflow-auto">
              {r.findings.map((f) => (
                <FindingRow key={f.id} f={f} />
              ))}
            </div>
          )}
          {r.notes.length > 0 && (
            <ul className="space-y-0.5 border-t px-3 py-2 text-2xs text-muted-foreground">
              {r.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          <StatBar
            items={[
              `${formatBytes(item.size)} → ${formatBytes(r.size)}`,
              saved > 0 ? `−${formatBytes(saved)}` : saved < 0 ? `+${formatBytes(-saved)}` : 'same size',
              r.clean ? 'verified: nothing left except what you chose to keep' : 'check: some metadata remains',
              'pixels untouched',
            ]}
          />
        </>
      )}
    </Panel>
  );
}

export default function ImageMetadataRemoverTool() {
  const [opts, setOpts] = useState<StripOptions>({ keepIcc: true, keepOrientation: true, keepCopyright: false });
  const [suffix, setSuffix] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);

  const itemsRef = useRef<Item[]>([]);
  const filesRef = useRef<Map<string, File>>(new Map());
  const outputsRef = useRef<Map<string, Uint8Array>>(new Map());
  const appliedRef = useRef<{ opts: StripOptions; suffix: boolean }>({ opts, suffix });
  const [ctl] = useState(() => ({ epoch: 0, running: false, id: 0, mounted: true }));

  const commit = useCallback(
    (next: Item[]) => {
      itemsRef.current = next;
      if (ctl.mounted) setItems(next);
    },
    [ctl]
  );
  const patch = useCallback(
    (id: string, p: Partial<Item>) => commit(itemsRef.current.map((it) => (it.id === id ? { ...it, ...p } : it))),
    [commit]
  );

  const processItem = useCallback(
    async (item: Item) => {
      const { opts: o, suffix: sfx } = appliedRef.current;
      const key = optionsKeyOf(o, sfx);
      const file = filesRef.current.get(item.id);
      if (!file) return;
      patch(item.id, { status: 'working' });
      try {
        if (file.size > MAX_FILE_BYTES) throw new Error(`File is larger than ${formatBytes(MAX_FILE_BYTES)}.`);
        const bytes = new Uint8Array(await file.arrayBuffer());
        const fmt = detectFormat(bytes);
        if (!fmt) throw new Error('Unsupported file type — only JPEG, PNG and WebP images are supported (checked by file content, not extension).');
        const res: StripResult = stripMetadata(bytes, o);
        const prev = itemsRef.current.find((i) => i.id === item.id);
        if (!prev) return;
        if (prev.result) URL.revokeObjectURL(prev.result.url);
        outputsRef.current.set(item.id, res.data);
        const url = URL.createObjectURL(new Blob([res.data as unknown as BlobPart], { type: mimeOf(fmt) }));
        patch(item.id, {
          status: 'done',
          optionsKey: key,
          error: undefined,
          result: {
            url,
            size: res.data.length,
            name: outName(item.name, sfx),
            findings: res.findings,
            notes: res.notes,
            clean: res.clean,
            format: fmt,
          },
        });
      } catch (e) {
        patch(item.id, { status: 'error', optionsKey: key, error: e instanceof Error ? e.message : 'Could not process this file.' });
      }
    },
    [patch]
  );

  const runQueue = useCallback(async () => {
    if (ctl.running) return;
    ctl.running = true;
    try {
      for (;;) {
        if (!ctl.mounted) break;
        const key = optionsKeyOf(appliedRef.current.opts, appliedRef.current.suffix);
        const next = itemsRef.current.find((i) => i.optionsKey !== key);
        if (!next) break;
        await processItem(next);
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    } finally {
      ctl.running = false;
    }
  }, [processItem, ctl]);

  useEffect(() => {
    appliedRef.current = { opts, suffix };
    void runQueue();
  }, [opts, suffix, runQueue]);

  useEffect(() => {
    ctl.mounted = true;
    const files = filesRef.current;
    return () => {
      ctl.mounted = false;
      for (const it of itemsRef.current) {
        URL.revokeObjectURL(it.thumb);
        if (it.result) URL.revokeObjectURL(it.result.url);
      }
      files.clear();
    };
  }, [ctl]);

  const addFiles = useCallback(
    (files: File[]) => {
      setError(null);
      const room = MAX_FILES - itemsRef.current.length;
      if (room <= 0) {
        setError(`You can process up to ${MAX_FILES} files at a time.`);
        return;
      }
      if (files.length > room) setError(`Only the first ${room} files were added (limit ${MAX_FILES}).`);
      const added: Item[] = files.slice(0, room).map((f) => {
        const id = `m${++ctl.id}`;
        filesRef.current.set(id, f);
        return { id, name: f.name, size: f.size, thumb: URL.createObjectURL(f), status: 'working', optionsKey: '' };
      });
      commit([...itemsRef.current, ...added]);
      void runQueue();
    },
    [commit, runQueue, ctl]
  );

  const loadSample = useCallback(async () => {
    setError(null);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 640;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is not available.');
      const sky = ctx.createLinearGradient(0, 0, 0, 640);
      sky.addColorStop(0, '#2b3a8c');
      sky.addColorStop(0.55, '#f08a4b');
      sky.addColorStop(1, '#ffd89b');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, 960, 640);
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.arc(700, 360, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#243b3a';
      ctx.beginPath();
      ctx.moveTo(0, 640);
      ctx.lineTo(0, 470);
      ctx.quadraticCurveTo(220, 360, 430, 470);
      ctx.quadraticCurveTo(650, 560, 960, 430);
      ctx.lineTo(960, 640);
      ctx.fill();
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
      if (!blob) throw new Error('Could not create the sample image.');
      const bytes = buildSampleJpeg(new Uint8Array(await blob.arrayBuffer()));
      addFiles([new File([bytes as unknown as BlobPart], 'sample-photo.jpg', { type: 'image/jpeg' })]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the sample.');
    }
  }, [addFiles]);

  const removeItem = useCallback(
    (id: string) => {
      const it = itemsRef.current.find((i) => i.id === id);
      if (!it) return;
      URL.revokeObjectURL(it.thumb);
      if (it.result) URL.revokeObjectURL(it.result.url);
      filesRef.current.delete(id);
      outputsRef.current.delete(id);
      commit(itemsRef.current.filter((i) => i.id !== id));
    },
    [commit]
  );

  const clearAll = useCallback(() => {
    for (const it of itemsRef.current) {
      URL.revokeObjectURL(it.thumb);
      if (it.result) URL.revokeObjectURL(it.result.url);
    }
    filesRef.current.clear();
    outputsRef.current.clear();
    commit([]);
    setError(null);
  }, [commit]);

  const buildZip = useCallback(async () => {
    const entries = itemsRef.current
      .filter((i) => i.status === 'done' && i.result)
      .map((i) => {
        const data = outputsRef.current.get(i.id);
        return data && i.result ? { name: i.result.name, data } : null;
      })
      .filter((e): e is { name: string; data: Uint8Array } => e !== null);
    return zipFiles(entries, 0);
  }, []);

  const done = items.filter((i) => i.status === 'done' && i.result);
  const removedTotal = done.reduce((n, i) => n + (i.result?.findings.filter((f) => !f.kept).length ?? 0), 0);
  const gpsFiles = done.filter((i) => i.result?.findings.some((f) => f.id === 'gps' || f.id === 'gps-xmp')).length;
  const before = done.reduce((n, i) => n + i.size, 0);
  const after = done.reduce((n, i) => n + (i.result?.size ?? 0), 0);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Colour profile">
            <div className="flex h-8 items-center gap-2">
              <Switch id="keep-icc" checked={opts.keepIcc} onCheckedChange={(c) => setOpts((o) => ({ ...o, keepIcc: c }))} />
              <Label htmlFor="keep-icc" className="text-xs text-muted-foreground">
                keep ICC profile
              </Label>
            </div>
          </Field>
          <Field label="Orientation">
            <div className="flex h-8 items-center gap-2">
              <Switch id="keep-orient" checked={opts.keepOrientation} onCheckedChange={(c) => setOpts((o) => ({ ...o, keepOrientation: c }))} />
              <Label htmlFor="keep-orient" className="text-xs text-muted-foreground">
                keep rotation tag
              </Label>
            </div>
          </Field>
          <Field label="Copyright">
            <div className="flex h-8 items-center gap-2">
              <Switch id="keep-copy" checked={opts.keepCopyright} onCheckedChange={(c) => setOpts((o) => ({ ...o, keepCopyright: c }))} />
              <Label htmlFor="keep-copy" className="text-xs text-muted-foreground">
                keep notice
              </Label>
            </div>
          </Field>
          <Field label="File names">
            <div className="flex h-8 items-center gap-2">
              <Switch id="suffix" checked={suffix} onCheckedChange={setSuffix} />
              <Label htmlFor="suffix" className="text-xs text-muted-foreground">
                add “-clean” suffix
              </Label>
            </div>
          </Field>
        </OptionsBar>
      </Panel>

      <FileDropzone
        onFiles={addFiles}
        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        multiple
        compact={items.length > 0}
        label={items.length > 0 ? 'Add more photos' : 'Drop photos here'}
        hint="JPEG, PNG or WebP · works offline · nothing is uploaded"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => void loadSample()}>
          <Camera className="size-3.5" /> Try a sample photo with GPS &amp; camera data
        </Button>
      </div>

      <ErrorBanner error={error} />

      {items.length === 0 && (
        <p className="px-1 text-xs text-muted-foreground">
          Photos carry hidden data: where they were taken (GPS), the camera and its serial number, edit software, dates, an
          embedded thumbnail and more. This tool lists what it finds and then removes it by copying the file without those
          blocks — the image itself is never decoded or re-compressed, so quality stays byte-for-byte identical.
        </p>
      )}

      {items.length > 0 && (
        <Panel>
          <PanelHeader title={`${items.length} file${items.length === 1 ? '' : 's'}`}>
            <DownloadButton
              data={buildZip}
              filename="clean-images.zip"
              mime="application/zip"
              label="Download all (ZIP)"
              variant="secondary"
              disabled={done.length === 0}
            />
            <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
              <Trash2 className="size-3.5" /> Clear
            </Button>
          </PanelHeader>
          <StatBar
            items={[
              `${done.length}/${items.length} cleaned`,
              done.length > 0 && `${removedTotal} metadata item${removedTotal === 1 ? '' : 's'} removed`,
              gpsFiles > 0 && `${gpsFiles} file${gpsFiles === 1 ? '' : 's'} had GPS location`,
              done.length > 0 && `${formatBytes(before)} → ${formatBytes(after)}`,
            ]}
          />
        </Panel>
      )}

      <div className="space-y-3">
        {items.map((it) => (
          <ItemCard key={it.id} item={it} onRemove={removeItem} />
        ))}
      </div>

      {done.length > 0 && done[0]?.result && (
        <div className="flex items-center gap-2 px-1 text-2xs text-muted-foreground">
          <CopyButton
            value={() =>
              done
                .map((i) => `${i.name}\n${(i.result?.findings ?? []).map((f) => `  ${f.kept ? '[kept]   ' : '[removed]'} ${f.label}: ${f.detail}`).join('\n')}`)
                .join('\n\n')
            }
            size="sm"
            label="Copy report"
          />
          <span>Copies the list of everything that was found, as text.</span>
        </div>
      )}

      <p className="px-1 text-2xs text-muted-foreground">
        Handles JPEG (incl. progressive &amp; CMYK), PNG (incl. APNG, 16-bit) and WebP (incl. animated). Content
        Credentials (C2PA) are removed too, which invalidates their signature, and extra data appended after the image
        (phone HDR gain maps, motion-photo video, MPF extra pictures) is dropped. Vendor MakerNotes are removed but not
        decoded, and anything hidden inside the pixels themselves (steganography, invisible watermarks) cannot be
        detected. HEIC, GIF, TIFF and AVIF are not supported.
      </p>
    </div>
  );
}
