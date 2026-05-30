'use client';

import { useCallback, useState } from 'react';

import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Field, OptionsBar, Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Report {
  declaredMime: string | null;
  sniffedMime: string;
  sniffedExt: string;
  width: number | null;
  height: number | null;
  byteSize: number;
  base64Chars: number;
  overheadPct: number;
  mismatch: boolean;
  previewUrl: string;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/** Detect the true format from magic bytes (and SVG text sniff). */
function sniff(bytes: Uint8Array): { mime: string; ext: string } {
  const b = (i: number) => bytes[i] ?? -1;
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  if (b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x38) {
    return { mime: 'image/gif', ext: 'gif' };
  }
  if (
    b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 &&
    b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  if (b(0) === 0x42 && b(1) === 0x4d) {
    return { mime: 'image/bmp', ext: 'bmp' };
  }
  if (b(0) === 0x00 && b(1) === 0x00 && b(2) === 0x01 && b(3) === 0x00) {
    return { mime: 'image/x-icon', ext: 'ico' };
  }
  // AVIF / HEIC: ftyp box at offset 4
  if (b(4) === 0x66 && b(5) === 0x74 && b(6) === 0x79 && b(7) === 0x70) {
    return { mime: 'image/avif-or-heic', ext: 'avif' };
  }
  // SVG (text): look for "<svg" within the first ~256 chars.
  const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 256)).toLowerCase();
  if (head.includes('<svg') || (head.includes('<?xml') && head.includes('svg'))) {
    return { mime: 'image/svg+xml', ext: 'svg' };
  }
  return { mime: 'unknown', ext: 'bin' };
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, '');
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    out[i] = bin.charCodeAt(i) & 0xff;
  }
  return out;
}

const SAMPLE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==';

export default function Base64ImageInspector() {
  const [input, setInput] = useState(SAMPLE);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inspect = useCallback((raw: string) => {
    setError(null);
    setReport(null);
    const text = raw.trim();
    if (!text) {
      setError('Paste a data: URI or raw Base64 image payload.');
      return;
    }

    let declaredMime: string | null = null;
    let payload = text;
    const m = text.match(/^data:([^;,]+)?(;base64)?,(.*)$/is);
    if (m) {
      declaredMime = (m[1] ?? '').trim() || null;
      payload = m[3] ?? '';
      if (!m[2]) {
        setError('This data URI is not Base64-encoded (no ";base64"). Only Base64 payloads are supported.');
        return;
      }
    }

    let bytes: Uint8Array;
    try {
      bytes = base64ToBytes(payload);
    } catch {
      setError('Invalid Base64 — could not decode. Check for stray characters.');
      return;
    }
    if (bytes.length === 0) {
      setError('Decoded payload is empty.');
      return;
    }

    const { mime: sniffedMime, ext: sniffedExt } = sniff(bytes);
    const base64Chars = payload.replace(/\s+/g, '').length;
    const overheadPct = bytes.length > 0 ? ((base64Chars - bytes.length) / bytes.length) * 100 : 0;
    const mismatch =
      declaredMime !== null &&
      sniffedMime !== 'unknown' &&
      sniffedMime !== 'image/avif-or-heic' &&
      declaredMime.toLowerCase() !== sniffedMime.toLowerCase();

    // Build a preview object URL from a Blob using the sniffed (or declared) type.
    const blobType =
      sniffedMime !== 'unknown' && sniffedMime !== 'image/avif-or-heic'
        ? sniffedMime
        : declaredMime ?? 'application/octet-stream';
    const blob = new Blob([bytes as unknown as BlobPart], { type: blobType });
    const previewUrl = URL.createObjectURL(blob);

    const base: Report = {
      declaredMime,
      sniffedMime,
      sniffedExt,
      width: null,
      height: null,
      byteSize: bytes.length,
      base64Chars,
      overheadPct,
      mismatch,
      previewUrl,
    };
    setReport(base);

    // Read intrinsic dimensions by loading into an Image.
    const img = new globalThis.Image();
    img.onload = () => {
      setReport((prev) =>
        prev && prev.previewUrl === previewUrl
          ? { ...prev, width: img.naturalWidth, height: img.naturalHeight }
          : prev,
      );
    };
    img.onerror = () => {
      // Leave dimensions null; format may be unsupported by the browser.
    };
    img.src = previewUrl;
  }, []);

  const rows = report
    ? [
        { label: 'Declared MIME (data URI)', value: report.declaredMime ?? '(none — raw Base64)' },
        { label: 'Sniffed format', value: `${report.sniffedMime} (.${report.sniffedExt})` },
        {
          label: 'Dimensions',
          value:
            report.width !== null && report.height !== null
              ? `${report.width} × ${report.height} px`
              : '(could not read — unsupported by browser?)',
        },
        { label: 'Decoded size', value: `${formatBytes(report.byteSize)} (${report.byteSize.toLocaleString()} bytes)` },
        { label: 'Base64 length', value: `${report.base64Chars.toLocaleString()} chars` },
        { label: 'Base64 overhead', value: `${report.overheadPct.toFixed(1)}%` },
      ]
    : [];

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Base64 / data: URI input">
          <Button variant="secondary" size="sm" onClick={() => inspect(input)}>
            Inspect
          </Button>
        </PanelHeader>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          className="min-h-[120px] rounded-none border-0 font-mono text-xs"
          placeholder="data:image/png;base64,iVBORw0KGgo…  — or a raw Base64 image payload"
        />
      </Panel>

      <OptionsBar>
        <Field label="Actions">
          <div className="flex gap-2">
            <Button size="sm" onClick={() => inspect(input)}>
              Inspect image
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInput(SAMPLE);
                inspect(SAMPLE);
              }}
            >
              Load sample
            </Button>
          </div>
        </Field>
      </OptionsBar>

      <ErrorBanner error={error} />

      {report && (
        <>
          {report.mismatch && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
              MIME mismatch: the data URI declares{' '}
              <code className="font-mono">{report.declaredMime}</code> but the bytes look like{' '}
              <code className="font-mono">{report.sniffedMime}</code>.
            </div>
          )}
          <Panel>
            <PanelHeader title="Report">
              <CopyButton value={() => rows.map((r) => `${r.label}: ${r.value}`).join('\n')} label="Copy" />
            </PanelHeader>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
              {rows.map((r) => (
                <div
                  key={r.label}
                  className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
                >
                  <span className="text-xs text-muted-foreground">{r.label}</span>
                  <span className="font-mono text-xs">{r.value}</span>
                </div>
              ))}
            </div>
            <StatBar
              items={[
                `${report.sniffedMime}`,
                report.width !== null ? `${report.width}×${report.height}` : null,
                formatBytes(report.byteSize),
              ]}
            />
          </Panel>

          <Panel>
            <PanelHeader title="Preview" />
            <div className="flex justify-center bg-[repeating-conic-gradient(#0000000d_0_25%,transparent_0_50%)] bg-[length:16px_16px] p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={report.previewUrl}
                alt="decoded preview"
                className="max-h-[360px] rounded border bg-white"
              />
            </div>
          </Panel>
        </>
      )}

      <p className="px-1 text-2xs text-muted-foreground">
        Everything is decoded in your browser — no upload or network request is made.
      </p>
    </div>
  );
}
