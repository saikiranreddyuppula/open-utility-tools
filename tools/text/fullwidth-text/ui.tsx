'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'fullwidth' | 'plain';

// Full-width forms occupy the Unicode block U+FF01..U+FF5E, which mirrors
// printable ASCII U+0021..U+007E with a constant offset of 0xFEE0.
// The ASCII space (U+0020) maps to the ideographic space (U+3000).
const ASCII_START = 0x21;
const ASCII_END = 0x7e;
const FULLWIDTH_OFFSET = 0xfee0;
const ASCII_SPACE = 0x20;
const IDEOGRAPHIC_SPACE = 0x3000;

const FULLWIDTH_BLOCK_START = 0xff01;
const FULLWIDTH_BLOCK_END = 0xff5e;

function toFullwidth(input: string, extraSpacing: boolean): string {
  const chars: string[] = [];
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === ASCII_SPACE) {
      chars.push(String.fromCodePoint(IDEOGRAPHIC_SPACE));
    } else if (code >= ASCII_START && code <= ASCII_END) {
      chars.push(String.fromCodePoint(code + FULLWIDTH_OFFSET));
    } else {
      chars.push(ch);
    }
  }
  if (extraSpacing) {
    return chars.join(String.fromCodePoint(IDEOGRAPHIC_SPACE));
  }
  return chars.join('');
}

function toPlain(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === IDEOGRAPHIC_SPACE) {
      out += ' ';
    } else if (code >= FULLWIDTH_BLOCK_START && code <= FULLWIDTH_BLOCK_END) {
      out += String.fromCodePoint(code - FULLWIDTH_OFFSET);
    } else {
      out += ch;
    }
  }
  return out;
}

export default function FullwidthTextTool() {
  const [mode, setMode] = useState<Mode>('fullwidth');
  const [extraSpacing, setExtraSpacing] = useState<boolean>(false);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      return mode === 'fullwidth' ? toFullwidth(input, extraSpacing) : toPlain(input);
    },
    [mode, extraSpacing],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, extraSpacing]}
      inputLabel="Text"
      outputLabel="Aesthetic"
      inputPlaceholder="aesthetic vibes only"
      sample="aesthetic vibes only"
      downloadName="vaporwave.txt"
      options={
        <>
          <Field label="Direction">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="fullwidth">To full-width</TabsTrigger>
                <TabsTrigger value="plain">To plain</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === 'fullwidth' ? (
            <Field label="Spacing" hint="Insert an ideographic space between every character">
              <Tabs
                value={extraSpacing ? 'extra' : 'normal'}
                onValueChange={(v) => setExtraSpacing(v === 'extra')}
              >
                <TabsList>
                  <TabsTrigger value="normal">Normal</TabsTrigger>
                  <TabsTrigger value="extra">Extra wide</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
          ) : null}
        </>
      }
    />
  );
}
