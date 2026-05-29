'use client';

import { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

// Convert a UTF-8 string to base64 safely (handles non-Latin1 characters).
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

// Convert base64 back to a UTF-8 string.
function base64ToUtf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i) & 0xff;
  return new TextDecoder().decode(bytes);
}

const COMMON_MIMES = [
  'text/plain',
  'text/html',
  'text/css',
  'application/json',
  'image/png',
  'image/jpeg',
  'image/svg+xml',
  'application/octet-stream',
];

interface BuildResult {
  output: string;
  error: string | null;
  bytes: number;
}

function build(
  mime: string,
  content: string,
  contentIsBase64: boolean,
  asBase64: boolean,
): BuildResult {
  if (!content) return { output: '', error: null, bytes: 0 };

  let payload = '';
  let byteCount = 0;
  try {
    if (asBase64) {
      const b64 = contentIsBase64 ? content.replace(/\s+/g, '') : utf8ToBase64(content);
      // Validate that base64 input actually decodes.
      const decoded = atob(b64);
      byteCount = decoded.length;
      payload = `;base64,${b64}`;
    } else {
      // Plain text data URI: percent-encode reserved characters.
      const text = contentIsBase64 ? base64ToUtf8(content.replace(/\s+/g, '')) : content;
      byteCount = new TextEncoder().encode(text).length;
      payload = `,${encodeURIComponent(text)}`;
    }
  } catch {
    return { output: '', error: 'Content is not valid Base64.', bytes: 0 };
  }

  const mimePart = mime.trim() || 'text/plain';
  return { output: `data:${mimePart}${payload}`, error: null, bytes: byteCount };
}

interface ParseResult {
  mime: string;
  isBase64: boolean;
  decoded: string;
  rawPayload: string;
  error: string | null;
  bytes: number;
}

function parse(uri: string): ParseResult {
  const empty: ParseResult = {
    mime: '',
    isBase64: false,
    decoded: '',
    rawPayload: '',
    error: null,
    bytes: 0,
  };
  const trimmed = uri.trim();
  if (!trimmed) return empty;

  if (!trimmed.startsWith('data:')) {
    return { ...empty, error: 'Not a data URI. It must start with "data:".' };
  }

  const commaIndex = trimmed.indexOf(',');
  if (commaIndex === -1) {
    return { ...empty, error: 'Malformed data URI: missing comma separator.' };
  }

  const meta = trimmed.slice(5, commaIndex);
  const data = trimmed.slice(commaIndex + 1);
  const isBase64 = /;base64$/i.test(meta);
  const mime = (isBase64 ? meta.replace(/;base64$/i, '') : meta).split(';')[0] || 'text/plain';

  try {
    if (isBase64) {
      const decoded = base64ToUtf8(data.replace(/\s+/g, ''));
      const bytes = atob(data.replace(/\s+/g, '')).length;
      return { mime, isBase64, decoded, rawPayload: data, error: null, bytes };
    }
    const decoded = decodeURIComponent(data);
    return {
      mime,
      isBase64,
      decoded,
      rawPayload: data,
      error: null,
      bytes: new TextEncoder().encode(decoded).length,
    };
  } catch {
    return { ...empty, mime, isBase64, error: 'Could not decode the data URI payload.' };
  }
}

export default function DataUriBuilderTool() {
  const [mode, setMode] = useState<'build' | 'parse'>('build');

  // Build state
  const [mime, setMime] = useState('image/png');
  const [content, setContent] = useState('');
  const [contentIsBase64, setContentIsBase64] = useState(true);
  const [asBase64, setAsBase64] = useState(true);

  // Parse state
  const [uri, setUri] = useState('');

  const built = useMemo(
    () => build(mime, content, contentIsBase64, asBase64),
    [mime, content, contentIsBase64, asBase64],
  );
  const parsed = useMemo(() => parse(uri), [uri]);

  return (
    <div className="flex flex-col gap-4">
      <OptionsBar>
        <Field label="Mode">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'build' | 'parse')}>
            <TabsList>
              <TabsTrigger value="build">Build URI</TabsTrigger>
              <TabsTrigger value="parse">Parse URI</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      </OptionsBar>

      {mode === 'build' ? (
        <>
          <OptionsBar>
            <Field label="MIME type">
              <Input
                value={mime}
                onChange={(e) => setMime(e.target.value)}
                placeholder="image/png"
                list="data-uri-mimes"
              />
              <datalist id="data-uri-mimes">
                {COMMON_MIMES.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
            <Field label="Input is Base64" hint="Off = treat input as raw text to encode">
              <Switch checked={contentIsBase64} onCheckedChange={setContentIsBase64} />
            </Field>
            <Field label="Base64 payload" hint="Off = percent-encoded text URI">
              <Switch checked={asBase64} onCheckedChange={setAsBase64} />
            </Field>
          </OptionsBar>

          <Panel>
            <PanelHeader title="Content" />
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                contentIsBase64 ? 'iVBORw0KGgoAAAANSUhEUg...' : 'Hello, world!'
              }
              rows={6}
              className="font-mono"
            />
          </Panel>

          <ErrorBanner error={built.error} />

          <Panel>
            <PanelHeader title="Data URI">
              <CopyButton value={built.output} />
            </PanelHeader>
            <Textarea readOnly value={built.output} rows={6} className="font-mono" />
            <StatBar
              items={[
                `${built.output.length} chars`,
                built.bytes > 0 && `${built.bytes} payload bytes`,
              ]}
            />
          </Panel>
        </>
      ) : (
        <>
          <Panel>
            <PanelHeader title="Data URI" />
            <Textarea
              value={uri}
              onChange={(e) => setUri(e.target.value)}
              placeholder="data:text/plain;base64,SGVsbG8="
              rows={6}
              className="font-mono"
            />
          </Panel>

          <ErrorBanner error={parsed.error} />

          <OptionsBar>
            <Field label="MIME type">
              <Input readOnly value={parsed.mime} />
            </Field>
            <Field label="Encoding">
              <div className="flex h-9 items-center">
                <Label>{parsed.isBase64 ? 'Base64' : 'Percent-encoded text'}</Label>
              </div>
            </Field>
          </OptionsBar>

          <Panel>
            <PanelHeader title="Decoded content">
              <CopyButton value={parsed.decoded} />
            </PanelHeader>
            <Textarea readOnly value={parsed.decoded} rows={6} className="font-mono" />
            <StatBar items={[parsed.bytes > 0 && `${parsed.bytes} bytes`]} />
          </Panel>
        </>
      )}
    </div>
  );
}
