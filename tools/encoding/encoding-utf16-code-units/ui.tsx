'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

function toHex(n: number, pad: number, prefix: boolean): string {
  const h = n.toString(16).toUpperCase().padStart(pad, '0');
  return prefix ? `0x${h}` : h;
}

function encode(input: string, format: 'hex' | 'prefixed' | 'decimal'): string {
  const units: string[] = [];
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    if (format === 'decimal') {
      units.push(String(code));
    } else {
      units.push(toHex(code, 4, format === 'prefixed'));
    }
  }
  return units.join(' ');
}

function decode(input: string): string {
  const tokens = input.trim().split(/[\s,]+/).filter(Boolean);
  if (tokens.length === 0) return '';
  const codeUnits: number[] = [];
  for (const token of tokens) {
    let value: number;
    if (/^(0x|U\+|\\u)/i.test(token)) {
      const cleaned = token.replace(/^(0x|U\+|\\u)/i, '');
      value = Number.parseInt(cleaned, 16);
    } else if (/^[0-9a-fA-F]+$/.test(token) && /[a-fA-F]/.test(token)) {
      value = Number.parseInt(token, 16);
    } else if (/^[0-9]+$/.test(token)) {
      // Ambiguous pure-digit token: interpret as hex (matches the encoder's
      // default hex output) so round-tripping works.
      value = Number.parseInt(token, 16);
    } else {
      throw new Error(`Invalid code unit: "${token}"`);
    }
    if (!Number.isFinite(value) || value < 0 || value > 0xffff) {
      throw new Error(`Code unit out of UTF-16 range (0x0000-0xFFFF): "${token}"`);
    }
    codeUnits.push(value);
  }
  // String.fromCharCode reassembles surrogate pairs into their code points.
  return String.fromCharCode(...codeUnits);
}

export default function Utf16CodeUnitsTool() {
  const [direction, setDirection] = useState<'encode' | 'decode'>('encode');
  const [format, setFormat] = useState<'hex' | 'prefixed' | 'decimal'>('hex');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      return direction === 'encode' ? encode(input, format) : decode(input);
    },
    [direction, format],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[direction, format]}
      inputLabel={direction === 'encode' ? 'Text' : 'UTF-16 code units'}
      outputLabel={direction === 'encode' ? 'UTF-16 code units' : 'Text'}
      inputPlaceholder={direction === 'encode' ? 'Hi 😀' : '0048 0069 0020 D83D DE00'}
      sample={direction === 'encode' ? 'Hi 😀 €' : '0048 0069 0020 D83D DE00 0020 20AC'}
      downloadName="utf16-code-units.txt"
      options={
        <>
          <Field label="Direction">
            <Tabs value={direction} onValueChange={(v) => setDirection(v as 'encode' | 'decode')}>
              <TabsList>
                <TabsTrigger value="encode">Text to units</TabsTrigger>
                <TabsTrigger value="decode">Units to text</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {direction === 'encode' && (
            <Field label="Format">
              <Tabs
                value={format}
                onValueChange={(v) => setFormat(v as 'hex' | 'prefixed' | 'decimal')}
              >
                <TabsList>
                  <TabsTrigger value="hex">Hex</TabsTrigger>
                  <TabsTrigger value="prefixed">0x Hex</TabsTrigger>
                  <TabsTrigger value="decimal">Decimal</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
          )}
        </>
      }
    />
  );
}
