'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TextToolLayout } from '@/components/tools/text-tool';

type Direction = 'encode' | 'decode';
type Format = 'u+' | 'hex' | 'decimal' | 'js' | 'html';

const FORMATS: { id: Format; label: string }[] = [
  { id: 'u+', label: 'U+ notation' },
  { id: 'hex', label: 'Hex (0x)' },
  { id: 'decimal', label: 'Decimal' },
  { id: 'js', label: 'JS escape (\\u{})' },
  { id: 'html', label: 'HTML entity (&#x;)' },
];

function formatCodePoint(cp: number, format: Format): string {
  const hex = cp.toString(16).toUpperCase();
  switch (format) {
    case 'u+':
      return `U+${hex.padStart(4, '0')}`;
    case 'hex':
      return `0x${hex}`;
    case 'decimal':
      return String(cp);
    case 'js':
      return cp <= 0xffff
        ? `\\u${hex.padStart(4, '0')}`
        : `\\u{${hex}}`;
    case 'html':
      return `&#x${hex};`;
  }
}

function encode(input: string, format: Format): string {
  if (input === '') return '';
  const points: string[] = [];
  // The string iterator yields whole code points (surrogate-pair safe).
  for (const ch of input) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    points.push(formatCodePoint(cp, format));
  }
  return points.join(' ');
}

// Extract every code point token from arbitrary input and decode to characters.
function decode(input: string): string {
  if (input.trim() === '') return '';
  // Match: U+XXXX, \u{XXXX}, \uXXXX, \xXX, 0xXXXX, &#xXXXX;, &#NNNN;, or bare numbers.
  const tokenRegex =
    /U\+([0-9a-fA-F]+)|\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})|\\x([0-9a-fA-F]{2})|0x([0-9a-fA-F]+)|&#x([0-9a-fA-F]+);|&#(\d+);|(\d+)/g;

  const result: string[] = [];
  let match: RegExpExecArray | null;
  let found = false;
  while ((match = tokenRegex.exec(input)) !== null) {
    found = true;
    let cp: number;
    const hexGroup =
      match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5] ?? match[6];
    const decGroup = match[7] ?? match[8];
    if (hexGroup !== undefined) {
      cp = parseInt(hexGroup, 16);
    } else if (decGroup !== undefined) {
      cp = parseInt(decGroup, 10);
    } else {
      continue;
    }
    if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) {
      throw new Error(`Code point out of range (0 to 0x10FFFF): ${match[0]}`);
    }
    if (cp >= 0xd800 && cp <= 0xdfff) {
      throw new Error(
        `Lone surrogate code point is not allowed: ${match[0]}`,
      );
    }
    result.push(String.fromCodePoint(cp));
  }

  if (!found) {
    throw new Error(
      'No code points found. Use formats like U+1F600, 0x1F600, 128512, \\u{1F600}, or &#x1F600;.',
    );
  }
  return result.join('');
}

export default function UnicodeCodePointConverterTool() {
  const [direction, setDirection] = useState<Direction>('encode');
  const [format, setFormat] = useState<Format>('u+');

  const transform = useCallback(
    (input: string) => {
      if (direction === 'encode') {
        return encode(input, format);
      }
      return decode(input);
    },
    [direction, format],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[direction, format]}
      inputLabel={direction === 'encode' ? 'Text' : 'Code points'}
      outputLabel={direction === 'encode' ? 'Code points' : 'Text'}
      inputPlaceholder={
        direction === 'encode' ? 'Type text…' : 'e.g. U+1F600 0x41 66'
      }
      sample={direction === 'encode' ? 'Hi 👋🌍' : 'U+0048 U+0069 U+1F44B'}
      downloadName="unicode-output.txt"
      options={
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Direction">
            <Tabs
              value={direction}
              onValueChange={(v) => setDirection(v as Direction)}
            >
              <TabsList>
                <TabsTrigger value="encode">Text → Code points</TabsTrigger>
                <TabsTrigger value="decode">Code points → Text</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {direction === 'encode' ? (
            <Field label="Output format" className="min-w-[12rem]">
              <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
        </div>
      }
    />
  );
}
