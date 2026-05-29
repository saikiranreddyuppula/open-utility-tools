'use client';

import { useCallback, useState } from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Dir = 'b64ToHex' | 'hexToB64';

/** Decode a base64 (standard or url-safe) string to bytes. */
function base64ToBytes(input: string): Uint8Array {
  let b64 = input.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  if (pad === 1) throw new Error('Invalid Base64: bad length');
  if (pad) b64 += '='.repeat(4 - pad);
  let bin: string;
  try {
    bin = atob(b64);
  } catch {
    throw new Error('Invalid Base64 input');
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
  return btoa(bin);
}

function bytesToHex(bytes: Uint8Array, upper: boolean, spaced: boolean): string {
  const out: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    out.push((bytes[i] ?? 0).toString(16).padStart(2, '0'));
  }
  const joined = out.join(spaced ? ' ' : '');
  return upper ? joined.toUpperCase() : joined;
}

function hexToBytes(input: string): Uint8Array {
  const cleaned = input.trim().replace(/0x/gi, '').replace(/[\s:,-]+/g, '');
  if (cleaned.length === 0) return new Uint8Array(0);
  if (cleaned.length % 2 !== 0) throw new Error('Hex must have an even number of digits');
  if (!/^[0-9a-fA-F]+$/.test(cleaned)) throw new Error('Hex contains non-hexadecimal characters');
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export default function Base64ToHexTool() {
  const [dir, setDir] = useState<Dir>('b64ToHex');
  const [upper, setUpper] = useState(false);
  const [spaced, setSpaced] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      if (dir === 'b64ToHex') {
        return bytesToHex(base64ToBytes(input), upper, spaced);
      }
      return bytesToBase64(hexToBytes(input));
    },
    [dir, upper, spaced]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[dir, upper, spaced]}
      inputLabel={dir === 'b64ToHex' ? 'Base64' : 'Hex'}
      outputLabel={dir === 'b64ToHex' ? 'Hex' : 'Base64'}
      sample={dir === 'b64ToHex' ? 'SGVsbG8sIHdvcmxkIQ==' : '48 65 6c 6c 6f 2c 20 77 6f 72 6c 64 21'}
      downloadName={dir === 'b64ToHex' ? 'output.hex.txt' : 'output.b64.txt'}
      options={
        <>
          <Field label="Direction">
            <Tabs value={dir} onValueChange={(v) => setDir(v as Dir)}>
              <TabsList>
                <TabsTrigger value="b64ToHex">Base64 → Hex</TabsTrigger>
                <TabsTrigger value="hexToB64">Hex → Base64</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {dir === 'b64ToHex' && (
            <>
              <Field label="Uppercase">
                <div className="flex h-8 items-center gap-2">
                  <Switch id="upper" checked={upper} onCheckedChange={setUpper} />
                  <Label htmlFor="upper" className="text-xs text-muted-foreground">
                    A–F
                  </Label>
                </div>
              </Field>
              <Field label="Spacing">
                <div className="flex h-8 items-center gap-2">
                  <Switch id="spaced" checked={spaced} onCheckedChange={setSpaced} />
                  <Label htmlFor="spaced" className="text-xs text-muted-foreground">
                    space bytes
                  </Label>
                </div>
              </Field>
            </>
          )}
        </>
      }
    />
  );
}
