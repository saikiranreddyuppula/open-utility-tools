'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const MOD_ADLER = 65521;
const NMAX = 5552; // largest n such that 255*n*(n+1)/2 + (n+1)*(MOD-1) <= 2^32-1

/** Adler-32 per RFC 1950, with 5552-byte chunking to defer the modulo. */
function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  let i = 0;
  const len = bytes.length;
  while (i < len) {
    let n = Math.min(NMAX, len - i);
    while (n-- > 0) {
      a += bytes[i++] ?? 0;
      b += a;
    }
    a %= MOD_ADLER;
    b %= MOD_ADLER;
  }
  // (b << 16) | a — use multiplication to stay in safe-integer range (>>> 0 would be fine too)
  return ((b * 0x10000 + a) >>> 0);
}

type Source = 'text' | 'file';

const SAMPLE = 'The quick brown fox jumps over the lazy dog';

export default function Adler32Checksum() {
  const [source, setSource] = useState<Source>('text');
  const [text, setText] = useState('');
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const bytes = useMemo<Uint8Array | null>(() => {
    if (source === 'text') return new TextEncoder().encode(text);
    return fileBytes;
  }, [source, text, fileBytes]);

  const result = useMemo(() => {
    if (!bytes || bytes.length === 0) return null;
    const checksum = adler32(bytes);
    const low = checksum & 0xffff; // component a
    const high = (checksum >>> 16) & 0xffff; // component b
    return {
      hex: checksum.toString(16).padStart(8, '0'),
      dec: checksum.toString(10),
      a: low,
      b: high,
      bytes: bytes.length,
    };
  }, [bytes]);

  const onFile = useCallback((file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const buf = reader.result;
      if (!(buf instanceof ArrayBuffer)) {
        setError('Could not read file.');
        return;
      }
      setFileBytes(new Uint8Array(buf));
      setFileName(file.name);
    };
    reader.onerror = () => setError('Could not read file.');
    reader.readAsArrayBuffer(file);
  }, []);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Source">
            <Tabs value={source} onValueChange={(v) => setSource(v as Source)}>
              <TabsList>
                <TabsTrigger value="text">Text</TabsTrigger>
                <TabsTrigger value="file">File</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {source === 'file' && (
            <Field label="File">
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="size-3.5" /> Choose file
                </Button>
                {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFile(f);
                    e.target.value = '';
                  }}
                />
              </div>
            </Field>
          )}
        </OptionsBar>
      </Panel>

      <ErrorBanner error={error} />

      {source === 'text' && (
        <Panel>
          <PanelHeader title="Input text (UTF-8)">
            <Button variant="ghost" size="sm" onClick={() => setText(SAMPLE)}>
              Sample
            </Button>
          </PanelHeader>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste text to checksum…"
            spellCheck={false}
            className="min-h-32 rounded-none border-0 font-mono text-sm"
          />
        </Panel>
      )}

      {result ? (
        <Panel>
          <PanelHeader title="Adler-32">
            <CopyButton value={() => result.hex} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {[
              { label: 'Checksum (hex)', value: `0x${result.hex}`, copy: result.hex },
              { label: 'Checksum (decimal)', value: result.dec, copy: result.dec },
              { label: 'Low 16 bits (a)', value: `0x${result.a.toString(16).padStart(4, '0')} (${result.a})`, copy: String(result.a) },
              { label: 'High 16 bits (b)', value: `0x${result.b.toString(16).padStart(4, '0')} (${result.b})`, copy: String(result.b) },
            ].map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="text-sm text-muted-foreground">{r.label}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span className="break-all">{r.value}</span>
                  <CopyButton value={r.copy} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar items={[`${result.bytes.toLocaleString()} bytes`, 'RFC 1950 / zlib']} />
        </Panel>
      ) : (
        <Panel>
          <div className="p-4 text-sm text-muted-foreground">
            {source === 'text' ? 'Enter text to compute its Adler-32 checksum.' : 'Choose a file to compute its Adler-32 checksum.'}
          </div>
        </Panel>
      )}
    </div>
  );
}
