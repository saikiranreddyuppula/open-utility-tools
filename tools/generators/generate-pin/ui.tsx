'use client';

import { useState } from 'react';
import { GeneratorList } from '@/components/tools/generator-list';
import { Field, OptionsBar } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

const webcrypto = (
  globalThis as unknown as {
    crypto: {
      getRandomValues<T extends ArrayBufferView>(a: T): T;
      randomUUID(): string;
    };
  }
).crypto;

/** Draws an unbiased index in [0, max) via rejection sampling. */
function unbiasedIndex(max: number): number {
  if (max <= 0) return 0;
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  let value = 0;
  do {
    webcrypto.getRandomValues(buf);
    value = buf[0] ?? 0;
  } while (value >= limit);
  return value % max;
}

/** All digits identical, e.g. 0000 / 7777. */
function isAllSame(pin: string): boolean {
  if (pin.length < 2) return false;
  const first = pin[0];
  for (let i = 1; i < pin.length; i += 1) {
    if (pin[i] !== first) return false;
  }
  return true;
}

/** Strictly ascending or descending run of length 1, e.g. 1234 or 4321 (with wrap). */
function isSequential(pin: string): boolean {
  if (pin.length < 2) return false;
  let asc = true;
  let desc = true;
  for (let i = 1; i < pin.length; i += 1) {
    const prev = Number(pin[i - 1] ?? '');
    const cur = Number(pin[i] ?? '');
    const upStep = (prev + 1) % 10;
    const downStep = (prev + 9) % 10;
    if (cur !== upStep) asc = false;
    if (cur !== downStep) desc = false;
  }
  return asc || desc;
}

function drawPin(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += String(unbiasedIndex(10));
  }
  return out;
}

export default function PinCodeTool() {
  const [length, setLength] = useState(4);
  const [avoidTrivial, setAvoidTrivial] = useState(true);

  const safeLength = Number.isFinite(length) ? Math.min(32, Math.max(3, Math.floor(length))) : 4;

  const gen = (): string => {
    if (!avoidTrivial) return drawPin(safeLength);
    // Reject trivial PINs; cap attempts so we never loop forever for tiny lengths.
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const pin = drawPin(safeLength);
      if (!isAllSame(pin) && !isSequential(pin)) return pin;
    }
    return drawPin(safeLength);
  };

  const lengthValue = Number.isFinite(length) ? length : 4;

  return (
    <GeneratorList
      generate={gen}
      deps={[safeLength, avoidTrivial]}
      downloadName="pins.txt"
      label="PIN codes"
      options={
        <OptionsBar>
          <Field label="Length" hint="3-32 digits">
            <Input
              type="number"
              min={3}
              max={32}
              value={lengthValue}
              onChange={(e) => {
                const n = Number(e.target.value);
                setLength(Number.isFinite(n) ? Math.min(32, Math.max(3, Math.floor(n))) : 4);
              }}
              className="w-24 font-mono"
            />
          </Field>
          <Field label="Options">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={avoidTrivial}
                onCheckedChange={(v) => setAvoidTrivial(v === true)}
              />
              <span>Avoid sequences &amp; repeats (e.g. 1234, 0000)</span>
            </label>
          </Field>
        </OptionsBar>
      }
    />
  );
}
