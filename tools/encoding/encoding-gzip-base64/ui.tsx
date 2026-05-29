'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'compress' | 'decompress';

interface StreamCtor {
  new (format: string): {
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;
  };
}

function getStreams(): { Compression: StreamCtor; Decompression: StreamCtor } {
  const g = globalThis as unknown as {
    CompressionStream?: StreamCtor;
    DecompressionStream?: StreamCtor;
  };
  if (!g.CompressionStream || !g.DecompressionStream) {
    throw new Error('Your browser does not support the Compression Streams API.');
  }
  return { Compression: g.CompressionStream, Decompression: g.DecompressionStream };
}

async function pump(
  input: Uint8Array,
  stream: { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> },
): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  void writer.write(input);
  void writer.close();

  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64.trim().replace(/\s+/g, ''));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function compress(text: string): Promise<string> {
  const { Compression } = getStreams();
  const bytes = new TextEncoder().encode(text);
  const out = await pump(bytes, new Compression('gzip'));
  return bytesToBase64(out);
}

async function decompress(b64: string): Promise<string> {
  const { Decompression } = getStreams();
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(b64);
  } catch {
    throw new Error('Input is not valid Base64.');
  }
  let out: Uint8Array;
  try {
    out = await pump(bytes, new Decompression('gzip'));
  } catch {
    throw new Error('Input is not valid gzip data.');
  }
  return new TextDecoder().decode(out);
}

export default function GzipBase64Tool() {
  const [mode, setMode] = useState<Mode>('compress');

  const transform = useCallback(
    async (input: string) => {
      if (!input) return '';
      return mode === 'compress' ? compress(input) : decompress(input);
    },
    [mode],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode]}
      inputLabel={mode === 'compress' ? 'Plain text' : 'Base64 gzip'}
      outputLabel={mode === 'compress' ? 'Base64 gzip' : 'Plain text'}
      sample={
        mode === 'compress'
          ? 'Compress me! '.repeat(8).trim()
          : 'H4sIAAAAAAAAE/NIzcnJ11FIr8osUAQAPj0PEAwAAAA='
      }
      downloadName={mode === 'compress' ? 'compressed.txt' : 'decompressed.txt'}
      options={
        <Field label="Mode" hint="gzip via the Compression Streams API">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="compress">Compress</TabsTrigger>
              <TabsTrigger value="decompress">Decompress</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
