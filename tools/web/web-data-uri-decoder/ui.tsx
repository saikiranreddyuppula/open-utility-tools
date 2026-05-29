'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TextToolLayout } from '@/components/tools/text-tool';

interface ParsedDataUri {
  mime: string;
  charset: string;
  isBase64: boolean;
  rawPayload: string;
  bytes: Uint8Array;
}

function base64ToBytes(b64: string): Uint8Array {
  // Normalize URL-safe base64 and remove whitespace
  const clean = b64.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  let bin: string;
  try {
    bin = atob(clean);
  } catch {
    throw new Error('Payload is not valid base64.');
  }
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i) & 0xff;
  }
  return out;
}

function utf8Encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function parseDataUri(input: string): ParsedDataUri {
  const trimmed = input.trim();
  if (!trimmed.toLowerCase().startsWith('data:')) {
    throw new Error('Not a data URI. It must start with "data:".');
  }
  const comma = trimmed.indexOf(',');
  if (comma === -1) {
    throw new Error('Malformed data URI: missing comma separating header and payload.');
  }
  const header = trimmed.slice(5, comma); // after "data:"
  const payload = trimmed.slice(comma + 1);

  const parts = header.split(';').filter((p) => p !== '');
  let isBase64 = false;
  let mime = '';
  let charset = '';

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'base64') {
      isBase64 = true;
    } else if (lower.startsWith('charset=')) {
      charset = part.slice('charset='.length);
    } else if (mime === '' && part.includes('/')) {
      mime = part;
    }
  }
  if (mime === '') mime = 'text/plain';
  if (charset === '') charset = 'US-ASCII';

  let bytes: Uint8Array;
  let rawPayload = payload;
  if (isBase64) {
    bytes = base64ToBytes(payload);
  } else {
    let decoded: string;
    try {
      decoded = decodeURIComponent(payload);
    } catch {
      // Some data URIs contain raw text without percent encoding
      decoded = payload;
    }
    rawPayload = decoded;
    bytes = utf8Encode(decoded);
  }

  return { mime, charset, isBase64, rawPayload, bytes };
}

function bytesToText(bytes: Uint8Array, charset: string): string {
  try {
    const label = charset.toLowerCase() === 'us-ascii' ? 'ascii' : charset;
    return new TextDecoder(label, { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
}

function isProbablyBinary(mime: string): boolean {
  const m = mime.toLowerCase();
  if (m.startsWith('text/')) return false;
  if (m === 'application/json' || m === 'application/xml' || m === 'image/svg+xml') return false;
  if (m.startsWith('application/') && (m.includes('javascript') || m.includes('xml'))) return false;
  return m.startsWith('image/') || m.startsWith('audio/') || m.startsWith('video/') || m.startsWith('application/');
}

export default function DataUriDecoderTool() {
  const [showHeader, setShowHeader] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const parsed = parseDataUri(input);
      const text = bytesToText(parsed.bytes, parsed.charset);

      const body = isProbablyBinary(parsed.mime)
        ? `[Binary content: ${parsed.bytes.length} bytes of ${parsed.mime}. Decoded text shown below may be garbled.]\n\n${text}`
        : text;

      if (!showHeader) return body;

      const head = [
        'MIME type:  ' + parsed.mime,
        'Charset:    ' + parsed.charset,
        'Encoding:   ' + (parsed.isBase64 ? 'base64' : 'percent / plain'),
        'Byte size:  ' + parsed.bytes.length,
        '',
        '--- content ---',
        '',
      ].join('\n');

      return head + body;
    },
    [showHeader],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[showHeader]}
      inputLabel="Data URI"
      outputLabel="Decoded"
      inputPlaceholder="data:text/plain;base64,SGVsbG8sIHdvcmxkIQ=="
      sample="data:text/plain;charset=utf-8;base64,SGVsbG8sIHdvcmxkIQ=="
      downloadName="decoded.txt"
      downloadMime="text/plain"
      options={
        <Field label="Output">
          <div className="flex items-center gap-2">
            <Switch id="show-header" checked={showHeader} onCheckedChange={setShowHeader} />
            <Label htmlFor="show-header">Show MIME / encoding header</Label>
          </div>
        </Field>
      }
    />
  );
}
