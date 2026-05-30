'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

const SAMPLE =
  'data:text/plain;base64,SGVsbG8sIHV0aWxpdHktdG9vbHMhIFRoaXMgaXMgYSBkZWNvZGVkIGZpbGUu';

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/gzip': 'gz',
  'application/json': 'json',
  'application/xml': 'xml',
  'application/octet-stream': 'bin',
  'application/wasm': 'wasm',
  'text/plain': 'txt',
  'text/html': 'html',
  'text/csv': 'csv',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'video/mp4': 'mp4',
  'font/woff2': 'woff2',
};

interface ParsedInput {
  mime: string | null;
  base64: string;
}

/** Pull mime + base64 payload out of a data URI, or treat whole input as base64. */
function parseInput(raw: string, strip: boolean): ParsedInput {
  let s = raw.trim();
  const dataUri = /^data:([^;,]*)(;[^,]*)?,(.*)$/s.exec(s);
  if (dataUri) {
    const mime = (dataUri[1] ?? '').trim() || null;
    const meta = dataUri[2] ?? '';
    const payload = dataUri[3] ?? '';
    if (!meta.includes('base64')) {
      // URL-encoded data URI: decode percent-encoding into raw, then base64 it.
      const decoded = decodeURIComponent(payload);
      return { mime, base64: btoa(unescape(encodeURIComponent(decoded))) };
    }
    s = payload;
  }
  if (strip) s = s.replace(/\s+/g, '');
  return { mime: null, base64: s };
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i) & 0xff;
  }
  return bytes;
}

/** Sniff a mime from leading magic bytes when no data-URI mime was given. */
function sniffMime(bytes: Uint8Array): string | null {
  const b = (i: number) => bytes[i] ?? -1;
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return 'image/png';
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return 'image/jpeg';
  if (b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46) return 'image/gif';
  if (b(0) === 0x25 && b(1) === 0x50 && b(2) === 0x44 && b(3) === 0x46) return 'application/pdf';
  if (b(0) === 0x50 && b(1) === 0x4b && b(2) === 0x03 && b(3) === 0x04) return 'application/zip';
  if (b(0) === 0x1f && b(1) === 0x8b) return 'application/gzip';
  if (b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46) return 'audio/wav';
  if (b(0) === 0x00 && b(1) === 0x61 && b(2) === 0x73 && b(3) === 0x6d) return 'application/wasm';
  return null;
}

function hexPreview(bytes: Uint8Array, limit: number): string {
  const n = Math.min(limit, bytes.length);
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    parts.push((bytes[i] ?? 0).toString(16).padStart(2, '0'));
  }
  return parts.join(' ') + (bytes.length > n ? ' …' : '');
}

function extFor(mime: string | null): string {
  if (!mime) return 'bin';
  return MIME_EXT[mime] ?? 'bin';
}

export default function Base64ToFile() {
  const [input, setInput] = useState(SAMPLE);
  const [filename, setFilename] = useState('');
  const [mimeOverride, setMimeOverride] = useState('');
  const [stripWs, setStripWs] = useState(true);

  const result = useMemo(() => {
    if (!input.trim()) return { kind: 'empty' as const };
    try {
      const parsed = parseInput(input, stripWs);
      const bytes = base64ToBytes(parsed.base64);
      const sniffed = sniffMime(bytes);
      const mime = mimeOverride.trim() || parsed.mime || sniffed || 'application/octet-stream';
      return {
        kind: 'ok' as const,
        bytes,
        detectedMime: parsed.mime,
        sniffed,
        mime,
        hex: hexPreview(bytes, 16),
      };
    } catch {
      return { kind: 'error' as const, message: 'Invalid base64 — check for non-base64 characters.' };
    }
  }, [input, mimeOverride, stripWs]);

  const suggestedName = useMemo(() => {
    if (result.kind !== 'ok') return 'file.bin';
    return `decoded.${extFor(result.mime)}`;
  }, [result]);

  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (result.kind !== 'ok') {
      setUrl(null);
      return;
    }
    const buf = result.bytes.buffer.slice(
      result.bytes.byteOffset,
      result.bytes.byteOffset + result.bytes.byteLength
    ) as ArrayBuffer;
    const blob = new Blob([buf], { type: result.mime });
    const objUrl = URL.createObjectURL(blob);
    setUrl(objUrl);
    return () => URL.revokeObjectURL(objUrl);
  }, [result]);

  const finalName = filename.trim() || suggestedName;

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Base64 / Data URI input" />
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste base64 or a full data: URI…"
          spellCheck={false}
          className="min-h-[140px] resize-y rounded-none border-0 bg-transparent font-mono shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <OptionsBar className="rounded-none border-0 border-t">
          <Field label="Filename" className="min-w-[200px]">
            <Input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder={suggestedName}
              spellCheck={false}
              className="font-mono"
            />
          </Field>
          <Field label="Override MIME" className="min-w-[200px]">
            <Input
              value={mimeOverride}
              onChange={(e) => setMimeOverride(e.target.value)}
              placeholder="auto-detected"
              spellCheck={false}
              className="font-mono"
            />
          </Field>
          <Field label="Whitespace">
            <label className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={stripWs} onCheckedChange={(c) => setStripWs(c === true)} />
              Strip whitespace / newlines
            </label>
          </Field>
        </OptionsBar>
      </Panel>

      {result.kind === 'error' && <ErrorBanner error={result.message} />}

      {result.kind === 'ok' && (
        <Panel>
          <PanelHeader title="Decoded file" />
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            <Row label="Detected MIME (data URI)" value={result.detectedMime ?? '—'} />
            <Row label="Sniffed MIME (magic bytes)" value={result.sniffed ?? '—'} />
            <Row label="Effective MIME" value={result.mime} />
            <Row label="Decoded size" value={`${result.bytes.length.toLocaleString()} bytes`} />
          </div>
          <div className="px-3 pb-2">
            <Field label="First bytes (hex)">
              <code className="block break-all rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs">
                {result.hex || '(empty)'}
              </code>
            </Field>
          </div>
          <div className="flex items-center gap-2 border-t bg-muted/30 px-3 py-2">
            {url && (
              <a href={url} download={finalName}>
                <Button size="sm">
                  <Download className="size-3.5" />
                  Download {finalName}
                </Button>
              </a>
            )}
          </div>
          <StatBar
            items={[
              `${result.bytes.length.toLocaleString()} bytes`,
              result.mime,
              `→ ${finalName}`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="truncate font-mono text-sm">{value}</span>
    </div>
  );
}
