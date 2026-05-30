'use client';

import { useCallback, useRef, useState } from 'react';
import { GeneratorList } from '@/components/tools/generator-list';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

function bytesToUuid(b: Uint8Array): string {
  const hex = Array.from(b.slice(0, 16), (x) => x.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex
    .slice(8, 10)
    .join('')}-${hex.slice(10, 16).join('')}`;
}

function applyFormat(uuid: string, upper: boolean, hyphens: boolean): string {
  let out = uuid;
  if (!hyphens) out = out.replace(/-/g, '');
  return upper ? out.toUpperCase() : out;
}

export default function UuidV7Generator() {
  const [upper, setUpper] = useState(false);
  const [hyphens, setHyphens] = useState(true);
  const [monotonic, setMonotonic] = useState(true);

  // Monotonic state: remembers last timestamp + the 74-bit random tail so that
  // IDs minted within the same millisecond increment instead of going backwards.
  const lastMs = useRef(-1);
  const tail = useRef(new Uint8Array(10)); // bytes 6..15 (random + version/variant carriers)

  const gen = useCallback(() => {
    const ms = Date.now();
    const b = new Uint8Array(16);

    // 48-bit big-endian millisecond timestamp into bytes 0..5.
    let t = ms;
    for (let i = 5; i >= 0; i -= 1) {
      b[i] = t & 0xff;
      t = Math.floor(t / 256);
    }

    if (monotonic && ms === lastMs.current) {
      // Increment the stored 10-byte tail (big-endian) to stay sortable.
      const prev = tail.current;
      const next = new Uint8Array(prev);
      for (let i = next.length - 1; i >= 0; i -= 1) {
        const inc = ((next[i] ?? 0) + 1) & 0xff;
        next[i] = inc;
        if (inc !== 0) break; // no carry
      }
      tail.current = next;
    } else {
      const rand = new Uint8Array(10);
      wc.getRandomValues(rand);
      tail.current = rand;
      lastMs.current = ms;
    }

    b.set(tail.current, 6);

    // Version 7 in high nibble of byte 6.
    b[6] = ((b[6] ?? 0) & 0x0f) | 0x70;
    // RFC 4122 variant (0b10) in top 2 bits of byte 8.
    b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;

    return applyFormat(bytesToUuid(b), upper, hyphens);
  }, [upper, hyphens, monotonic]);

  return (
    <GeneratorList
      generate={gen}
      deps={[upper, hyphens, monotonic]}
      downloadName="uuid-v7.txt"
      label="UUID v7"
      defaultCount={5}
      maxCount={1000}
      options={
        <>
          <Field label="Uppercase">
            <Switch checked={upper} onCheckedChange={setUpper} />
          </Field>
          <Field label="Hyphens">
            <Switch checked={hyphens} onCheckedChange={setHyphens} />
          </Field>
          <Field label="Monotonic">
            <Switch checked={monotonic} onCheckedChange={setMonotonic} />
          </Field>
        </>
      }
    />
  );
}
