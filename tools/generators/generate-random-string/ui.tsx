'use client';

import { useState } from 'react';
import { GeneratorList } from '@/components/tools/generator-list';
import { Field, OptionsBar } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

const webcrypto = (
  globalThis as unknown as {
    crypto: {
      getRandomValues<T extends ArrayBufferView>(a: T): T;
      randomUUID(): string;
    };
  }
).crypto;

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.<>?';

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

export default function RandomStringTool() {
  const [length, setLength] = useState(24);
  const [lower, setLower] = useState(true);
  const [upper, setUpper] = useState(true);
  const [digits, setDigits] = useState(true);
  const [symbols, setSymbols] = useState(false);

  const buildAlphabet = (): string => {
    let alphabet = '';
    if (lower) alphabet += LOWER;
    if (upper) alphabet += UPPER;
    if (digits) alphabet += DIGITS;
    if (symbols) alphabet += SYMBOLS;
    return alphabet;
  };

  const gen = (): string => {
    const alphabet = buildAlphabet();
    if (alphabet.length === 0) return '';
    const safeLength = Number.isFinite(length) ? Math.max(1, Math.floor(length)) : 1;
    let out = '';
    for (let i = 0; i < safeLength; i += 1) {
      out += alphabet[unbiasedIndex(alphabet.length)] ?? '';
    }
    return out;
  };

  const lengthValue = Number.isFinite(length) ? length : 1;

  return (
    <GeneratorList
      generate={gen}
      deps={[length, lower, upper, digits, symbols]}
      downloadName="random-strings.txt"
      label="Random strings"
      options={
        <OptionsBar>
          <Field label="Length">
            <Input
              type="number"
              min={1}
              max={4096}
              value={lengthValue}
              onChange={(e) => {
                const n = Number(e.target.value);
                setLength(Number.isFinite(n) ? Math.min(4096, Math.max(1, Math.floor(n))) : 1);
              }}
              className="w-28"
            />
          </Field>
          <Field label="Character sets">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={lower} onCheckedChange={(v) => setLower(v === true)} />
                <span>a-z</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={upper} onCheckedChange={(v) => setUpper(v === true)} />
                <span>A-Z</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={digits} onCheckedChange={(v) => setDigits(v === true)} />
                <span>0-9</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={symbols} onCheckedChange={(v) => setSymbols(v === true)} />
                <span>Symbols</span>
              </label>
            </div>
          </Field>
          {!lower && !upper && !digits && !symbols ? (
            <Label className="text-destructive text-sm">Select at least one character set.</Label>
          ) : null}
        </OptionsBar>
      }
    />
  );
}
