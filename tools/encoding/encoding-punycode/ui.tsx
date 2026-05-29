'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

// RFC 3492 Punycode bootstring parameters.
const BASE = 36;
const TMIN = 1;
const TMAX = 26;
const SKEW = 38;
const DAMP = 700;
const INITIAL_BIAS = 72;
const INITIAL_N = 128;
const DELIMITER = '-';

function adapt(delta: number, numPoints: number, firstTime: boolean): number {
  let d = firstTime ? Math.floor(delta / DAMP) : Math.floor(delta / 2);
  d += Math.floor(d / numPoints);
  let k = 0;
  while (d > Math.floor(((BASE - TMIN) * TMAX) / 2)) {
    d = Math.floor(d / (BASE - TMIN));
    k += BASE;
  }
  return k + Math.floor(((BASE - TMIN + 1) * d) / (d + SKEW));
}

// Map a digit (0..35) to its basic code point. 0..25 => a..z, 26..35 => 0..9.
function digitToBasic(digit: number): string {
  if (digit < 26) return String.fromCharCode(digit + 97);
  return String.fromCharCode(digit - 26 + 48);
}

// Map a basic code point to its digit value, or throw for invalid input.
function basicToDigit(codePoint: number): number {
  if (codePoint >= 48 && codePoint <= 57) return codePoint - 48 + 26; // 0-9
  if (codePoint >= 65 && codePoint <= 90) return codePoint - 65; // A-Z
  if (codePoint >= 97 && codePoint <= 122) return codePoint - 97; // a-z
  throw new Error('Invalid Punycode digit in input.');
}

function encodeLabel(input: string): string {
  const codePoints = Array.from(input, (c) => c.codePointAt(0) ?? 0);

  // If everything is ASCII, the label is unchanged (no xn-- prefix needed).
  const isAscii = codePoints.every((cp) => cp < 0x80);
  if (isAscii) return input;

  const output: string[] = [];
  for (const cp of codePoints) {
    if (cp < 0x80) output.push(String.fromCodePoint(cp));
  }

  const basicLength = output.length;
  let handled = basicLength;
  if (basicLength > 0) output.push(DELIMITER);

  let n = INITIAL_N;
  let delta = 0;
  let bias = INITIAL_BIAS;
  const total = codePoints.length;

  while (handled < total) {
    let m = Number.MAX_SAFE_INTEGER;
    for (const cp of codePoints) {
      if (cp >= n && cp < m) m = cp;
    }

    delta += (m - n) * (handled + 1);
    n = m;

    for (const cp of codePoints) {
      if (cp < n) delta += 1;
      if (cp === n) {
        let q = delta;
        for (let k = BASE; ; k += BASE) {
          const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
          if (q < t) break;
          output.push(digitToBasic(t + ((q - t) % (BASE - t))));
          q = Math.floor((q - t) / (BASE - t));
        }
        output.push(digitToBasic(q));
        bias = adapt(delta, handled + 1, handled === basicLength);
        delta = 0;
        handled += 1;
      }
    }
    delta += 1;
    n += 1;
  }

  return `xn--${output.join('')}`;
}

function decodeLabel(input: string): string {
  if (!input.toLowerCase().startsWith('xn--')) return input;
  const encoded = input.slice(4);

  let n = INITIAL_N;
  let i = 0;
  let bias = INITIAL_BIAS;
  const output: number[] = [];

  const lastDelimiter = encoded.lastIndexOf(DELIMITER);
  let pos = 0;
  if (lastDelimiter >= 0) {
    for (let j = 0; j < lastDelimiter; j += 1) {
      const ch = encoded.charCodeAt(j);
      if (ch >= 0x80) throw new Error('Invalid basic code point in Punycode label.');
      output.push(ch);
    }
    pos = lastDelimiter + 1;
  }

  const len = encoded.length;
  while (pos < len) {
    const oldI = i;
    let w = 1;
    for (let k = BASE; ; k += BASE) {
      if (pos >= len) throw new Error('Truncated Punycode label.');
      const digit = basicToDigit(encoded.charCodeAt(pos));
      pos += 1;
      i += digit * w;
      const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
      if (digit < t) break;
      w *= BASE - t;
    }

    const outLen = output.length + 1;
    bias = adapt(i - oldI, outLen, oldI === 0);
    n += Math.floor(i / outLen);
    i %= outLen;
    output.splice(i, 0, n);
    i += 1;
  }

  return String.fromCodePoint(...output);
}

function processDomain(input: string, direction: 'encode' | 'decode'): string {
  return input
    .split('\n')
    .map((line) => {
      if (!line) return '';
      return line
        .split('.')
        .map((label) => (direction === 'encode' ? encodeLabel(label) : decodeLabel(label)))
        .join('.');
    })
    .join('\n');
}

export default function PunycodeTool() {
  const [direction, setDirection] = useState<'encode' | 'decode'>('encode');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      return processDomain(input, direction);
    },
    [direction],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[direction]}
      inputLabel={direction === 'encode' ? 'Unicode domain' : 'Punycode (xn--) domain'}
      outputLabel={direction === 'encode' ? 'Punycode' : 'Unicode'}
      inputPlaceholder={direction === 'encode' ? 'münchen.de' : 'xn--mnchen-3ya.de'}
      sample={direction === 'encode' ? 'münchen.de\n日本語.jp' : 'xn--mnchen-3ya.de\nxn--wgv71a119e.jp'}
      downloadName="punycode.txt"
      options={
        <Field label="Direction">
          <Tabs value={direction} onValueChange={(v) => setDirection(v as 'encode' | 'decode')}>
            <TabsList>
              <TabsTrigger value="encode">Encode</TabsTrigger>
              <TabsTrigger value="decode">Decode</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
