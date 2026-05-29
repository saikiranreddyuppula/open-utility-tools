'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'encode' | 'decode';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function encodeBase64Url(text: string, padding: boolean): string {
  const bytes = new TextEncoder().encode(text);
  let b64 = bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_');
  if (!padding) b64 = b64.replace(/=+$/, '');
  return b64;
}

function decodeBase64Url(input: string): string {
  let s = input.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  // Restore padding so atob accepts it.
  const remainder = s.length % 4;
  if (remainder === 2) s += '==';
  else if (remainder === 3) s += '=';
  else if (remainder === 1) throw new Error('Invalid Base64URL length.');

  let binary: string;
  try {
    binary = atob(s);
  } catch {
    throw new Error('Invalid Base64URL input.');
  }
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export default function Base64UrlTool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [padding, setPadding] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      return mode === 'encode'
        ? encodeBase64Url(input, padding)
        : decodeBase64Url(input);
    },
    [mode, padding],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, padding]}
      inputLabel={mode === 'encode' ? 'Plain text' : 'Base64URL'}
      outputLabel={mode === 'encode' ? 'Base64URL' : 'Plain text'}
      sample={
        mode === 'encode' ? 'Hello, world! >>> subjects?' : 'SGVsbG8sIHdvcmxkISA-Pj4gc3ViamVjdHM_'
      }
      downloadName="base64url.txt"
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="encode">Encode</TabsTrigger>
                <TabsTrigger value="decode">Decode</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === 'encode' && (
            <Field label="Padding">
              <div className="flex items-center gap-2">
                <Switch
                  id="b64url-padding"
                  checked={padding}
                  onCheckedChange={setPadding}
                />
                <Label htmlFor="b64url-padding" className="text-sm">
                  Keep trailing &ldquo;=&rdquo;
                </Label>
              </div>
            </Field>
          )}
        </>
      }
    />
  );
}
