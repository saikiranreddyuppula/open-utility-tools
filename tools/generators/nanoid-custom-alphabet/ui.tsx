'use client';

import { useCallback, useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Field } from '@/components/tools/panel';
import { GeneratorList } from '@/components/tools/generator-list';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

const PRESETS: Record<string, string> = {
  urlsafe: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-',
  numbers: '0123456789',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  nolookalike: '346789ABCDEFGHJKLMNPQRTUVWXYabcdefghijkmnpqrtwxyz',
  hex: '0123456789abcdef',
};

/**
 * Standard nanoid unbiased custom-alphabet generator.
 * mask = (2 << log2(len-1)) - 1; reject bytes whose masked value is out of range.
 */
function makeNanoId(alphabet: string, size: number): string {
  const len = alphabet.length;
  if (len < 1) return '';
  if (len === 1) return (alphabet[0] ?? '').repeat(size);

  const mask = (2 << Math.floor(Math.log2(len - 1))) - 1;
  const step = Math.ceil((1.6 * mask * size) / len);
  let id = '';
  while (id.length < size) {
    const bytes = new Uint8Array(step);
    wc.getRandomValues(bytes);
    for (let i = 0; i < step && id.length < size; i++) {
      const idx = (bytes[i] ?? 0) & mask;
      if (idx < len) {
        const ch = alphabet[idx];
        if (ch !== undefined) id += ch;
      }
    }
  }
  return id;
}

/** Rough ID space in bits and a human-readable collision note. */
function collisionNote(alphabetLen: number, size: number): string {
  if (alphabetLen < 1 || size < 1) return '';
  const bits = size * Math.log2(alphabetLen);
  // ~50% collision after ~2^(bits/2) IDs (birthday bound).
  const halfBits = bits / 2;
  let count: string;
  if (halfBits > 60) {
    count = `2^${Math.round(halfBits)}`;
  } else {
    const n = Math.pow(2, halfBits);
    count = n >= 1e9
      ? `${(n / 1e9).toPrecision(3)} billion`
      : n >= 1e6
        ? `${(n / 1e6).toPrecision(3)} million`
        : Math.round(n).toLocaleString();
  }
  return `~${Math.round(bits)} bits — 1% collision risk after ~${count} IDs`;
}

export default function NanoIdCustomAlphabetTool() {
  const [alphabet, setAlphabet] = useState(PRESETS.urlsafe ?? '');
  const [size, setSize] = useState(21);
  const [presetKey, setPresetKey] = useState('urlsafe');

  // Deduplicate alphabet for a correct/unbiased space; keep order.
  const cleanAlphabet = useMemo(() => {
    const seen = new Set<string>();
    let out = '';
    for (const ch of alphabet) {
      if (!seen.has(ch)) {
        seen.add(ch);
        out += ch;
      }
    }
    return out;
  }, [alphabet]);

  const generate = useCallback(() => {
    if (cleanAlphabet.length < 1) throw new Error('Alphabet must have at least 1 character.');
    if (size < 1) throw new Error('Size must be at least 1.');
    return makeNanoId(cleanAlphabet, size);
  }, [cleanAlphabet, size]);

  const note = collisionNote(cleanAlphabet.length, size);

  return (
    <GeneratorList
      generate={generate}
      deps={[cleanAlphabet, size]}
      defaultCount={10}
      maxCount={1000}
      downloadName="nanoids.txt"
      label={note ? `NanoIDs — ${note}` : 'NanoIDs'}
      options={
        <>
          <Field label="Preset">
            <Select
              value={presetKey}
              onValueChange={(v) => {
                setPresetKey(v);
                const next = PRESETS[v];
                if (next !== undefined) setAlphabet(next);
              }}
            >
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="urlsafe">URL-safe (64)</SelectItem>
                <SelectItem value="lowercase">Lowercase (26)</SelectItem>
                <SelectItem value="numbers">Numbers (10)</SelectItem>
                <SelectItem value="hex">Hex (16)</SelectItem>
                <SelectItem value="nolookalike">No look-alikes</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Alphabet" className="min-w-[260px] flex-1">
            <Input
              value={alphabet}
              onChange={(e) => setAlphabet(e.target.value)}
              className="font-mono"
              spellCheck={false}
            />
          </Field>
          <Field label="Size">
            <Input
              type="number" min={1} max={256}
              value={size}
              onChange={(e) => setSize(Math.max(1, Math.min(Number(e.target.value) || 1, 256)))}
              className="w-20 font-mono"
            />
          </Field>
        </>
      }
    />
  );
}
