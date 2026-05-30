'use client';

import { useCallback, useRef, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Field } from '@/components/tools/panel';
import { GeneratorList } from '@/components/tools/generator-list';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

function randomLetter(): string {
  const i = wc.getRandomValues(new Uint32Array(1))[0] ?? 0;
  return LETTERS[i % 26] ?? 'a';
}

function randomHex(len: number): string {
  const bytes = new Uint8Array(Math.ceil(len / 2));
  wc.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out.slice(0, len);
}

// Per-session fingerprint: stable for the tab, mixed into every id.
const FINGERPRINT = randomHex(16);

// Synchronous 128-bit avalanche hash (four FNV-1a lanes) rendered base36.
// Stands in for CUID2's SHA-256 digest while staying non-async for the
// GeneratorList synchronous generate() contract; entropy is browser-only.
function hashBase36(input: string): string {
  let h0 = 0x811c9dc5;
  let h1 = 0x01000193;
  let h2 = 0xdeadbeef;
  let h3 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h0 = Math.imul(h0 ^ c, 0x01000193) >>> 0;
    h1 = Math.imul(h1 ^ ((c << 3) | (c >>> 5)), 0x85ebca6b) >>> 0;
    h2 = Math.imul(h2 ^ (c + i), 0xc2b2ae35) >>> 0;
    h3 = Math.imul(h3 ^ (c * 131), 0x27d4eb2f) >>> 0;
  }
  // Final mix so each lane influences the others.
  h0 = (h0 ^ h2) >>> 0;
  h1 = (h1 ^ h3) >>> 0;
  h2 = (h2 ^ h0) >>> 0;
  h3 = (h3 ^ h1) >>> 0;
  const part = (n: number) => n.toString(36).padStart(7, '0');
  return part(h0) + part(h1) + part(h2) + part(h3);
}

export default function Cuid2GeneratorTool() {
  const [length, setLength] = useState(24);
  const counter = useRef(Math.floor(Math.random() * 2057));

  const generate = useCallback(() => {
    const len = Math.max(8, Math.min(length, 32));
    counter.current += 1;
    const salt = randomHex(32);
    const time = Date.now().toString(36);
    const block = `${time}${counter.current.toString(36)}${salt}${FINGERPRINT}`;
    let body = hashBase36(block);
    // Ensure enough hash characters to fill the requested length.
    while (body.length < len) body += hashBase36(body + salt);
    return randomLetter() + body.slice(0, len - 1);
  }, [length]);

  return (
    <GeneratorList
      generate={generate}
      deps={[length]}
      defaultCount={5}
      maxCount={500}
      downloadName="cuid2.txt"
      label="CUID2 identifiers"
      options={
        <Field label={`Length · ${length}`}>
          <Input
            type="number"
            min={8}
            max={32}
            value={length}
            onChange={(e) => setLength(Math.max(8, Math.min(Number(e.target.value) || 24, 32)))}
            className="w-24 font-mono"
          />
        </Field>
      }
    />
  );
}
