'use client';

import { useState } from 'react';

import { GeneratorList } from '@/components/tools/generator-list';
import { Field, OptionsBar } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const webcrypto = (
  globalThis as unknown as {
    crypto: { getRandomValues<T extends ArrayBufferView>(a: T): T; randomUUID(): string };
  }
).crypto;

// Default NanoID alphabet: URL-safe (A-Za-z0-9_-).
const URL_SAFE = '_-0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ALPHANUMERIC = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const HEX = '0123456789abcdef';

type Preset = 'urlsafe' | 'alphanumeric' | 'hex' | 'custom';

function nanoid(alphabet: string, size: number): string {
  const len = alphabet.length;
  if (len < 2) return '';
  // Unbiased rejection sampling: mask = smallest 2^n-1 >= len-1.
  const mask = (2 << (31 - Math.clz32((len - 1) | 1))) - 1;
  // Heuristic buffer step from the reference implementation.
  const step = Math.ceil((1.6 * mask * size) / len);
  let id = '';
  const bytes = new Uint8Array(step);
  while (true) {
    webcrypto.getRandomValues(bytes);
    for (let i = 0; i < step; i++) {
      const idx = (bytes[i] ?? 0) & mask;
      const ch = alphabet[idx];
      if (ch !== undefined) {
        id += ch;
        if (id.length === size) return id;
      }
    }
  }
}

export default function NanoIdGeneratorTool() {
  const [size, setSize] = useState(21);
  const [preset, setPreset] = useState<Preset>('urlsafe');
  const [custom, setCustom] = useState('');

  const presetAlphabet =
    preset === 'urlsafe'
      ? URL_SAFE
      : preset === 'alphanumeric'
        ? ALPHANUMERIC
        : preset === 'hex'
          ? HEX
          : custom;

  // De-duplicate custom characters; fall back to URL-safe if too small.
  const alphabet =
    preset === 'custom' ? Array.from(new Set(Array.from(custom))).join('') : presetAlphabet;
  const effectiveAlphabet = alphabet.length >= 2 ? alphabet : URL_SAFE;

  const gen = () => nanoid(effectiveAlphabet, size);

  return (
    <GeneratorList
      generate={gen}
      deps={[size, preset, custom]}
      downloadName="nanoids.txt"
      label="NanoIDs"
      options={
        <OptionsBar>
          <Field label={`Length: ${size}`} className="min-w-[220px] flex-1">
            <Slider
              value={[size]}
              min={2}
              max={64}
              step={1}
              onValueChange={(v) => setSize(v[0] ?? 21)}
            />
          </Field>
          <Field label="Alphabet">
            <Tabs value={preset} onValueChange={(v) => setPreset(v as Preset)}>
              <TabsList>
                <TabsTrigger value="urlsafe">URL-safe</TabsTrigger>
                <TabsTrigger value="alphanumeric">Alphanumeric</TabsTrigger>
                <TabsTrigger value="hex">Hex</TabsTrigger>
                <TabsTrigger value="custom">Custom</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {preset === 'custom' && (
            <Field
              label="Custom characters"
              hint={
                Array.from(new Set(Array.from(custom))).length < 2
                  ? 'Need at least 2 unique characters (using URL-safe meanwhile).'
                  : `${Array.from(new Set(Array.from(custom))).length} unique characters`
              }
              className="min-w-[220px] flex-1"
            >
              <Input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="e.g. abcdef0123456789"
                className="font-mono"
              />
            </Field>
          )}
        </OptionsBar>
      }
    />
  );
}
