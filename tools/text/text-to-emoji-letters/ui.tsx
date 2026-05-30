'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TextToolLayout } from '@/components/tools/text-tool';

type Style = 'regional' | 'squared' | 'keycap' | 'circled' | 'fullwidth';

const REGIONAL_BASE = 0x1f1e6; // 🇦
const SQUARED_BASE = 0x1f130; // 🅰 (negative squared Latin capital A)
const CIRCLED_UPPER = 0x24b6; // Ⓐ
const CIRCLED_LOWER = 0x24d0; // ⓐ
const CIRCLED_DIGIT_1 = 0x2460; // ①
const FULLWIDTH_BASE = 0xff21; // Ａ
const FULLWIDTH_DIGIT = 0xff10; // ０

// Regional indicator: A-Z only.
function toRegional(ch: string): string | null {
  const code = ch.toUpperCase().codePointAt(0);
  if (code === undefined || code < 0x41 || code > 0x5a) return null;
  return String.fromCodePoint(REGIONAL_BASE + (code - 0x41));
}

// Negative squared Latin capital letters: A-Z.
function toSquared(ch: string): string | null {
  const code = ch.toUpperCase().codePointAt(0);
  if (code === undefined || code < 0x41 || code > 0x5a) return null;
  return String.fromCodePoint(SQUARED_BASE + (code - 0x41));
}

// Keycap sequences for digits 0-9 (digit + variation selector + combining keycap).
function toKeycap(ch: string): string | null {
  const code = ch.codePointAt(0);
  if (code === undefined || code < 0x30 || code > 0x39) return null;
  return ch + '️⃣';
}

function toCircled(ch: string): string | null {
  const code = ch.codePointAt(0);
  if (code === undefined) return null;
  if (code >= 0x41 && code <= 0x5a) return String.fromCodePoint(CIRCLED_UPPER + (code - 0x41));
  if (code >= 0x61 && code <= 0x7a) return String.fromCodePoint(CIRCLED_LOWER + (code - 0x61));
  if (code >= 0x31 && code <= 0x39) return String.fromCodePoint(CIRCLED_DIGIT_1 + (code - 0x31));
  return null;
}

function toFullwidth(ch: string): string | null {
  const code = ch.codePointAt(0);
  if (code === undefined) return null;
  if (code >= 0x41 && code <= 0x5a) return String.fromCodePoint(FULLWIDTH_BASE + (code - 0x41));
  if (code >= 0x61 && code <= 0x7a) return String.fromCodePoint(FULLWIDTH_BASE + 0x20 + (code - 0x61));
  if (code >= 0x30 && code <= 0x39) return String.fromCodePoint(FULLWIDTH_DIGIT + (code - 0x30));
  return null;
}

export default function EmojiLettersTool() {
  const [style, setStyle] = useState<Style>('regional');
  const [spacing, setSpacing] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      const mapper: (ch: string) => string | null =
        style === 'regional'
          ? toRegional
          : style === 'squared'
            ? toSquared
            : style === 'keycap'
              ? toKeycap
              : style === 'circled'
                ? toCircled
                : toFullwidth;

      const out: string[] = [];
      for (const ch of input) {
        if (ch === '\n') {
          out.push('\n');
          continue;
        }
        const mapped = mapper(ch);
        if (mapped === null) {
          out.push(ch);
          continue;
        }
        // For regional indicators, optionally separate so they don't merge into flags.
        if (style === 'regional' && spacing) {
          out.push(mapped + '​'); // zero-width space keeps squares distinct
        } else {
          out.push(mapped);
        }
      }
      return out.join('');
    },
    [style, spacing]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[style, spacing]}
      inputLabel="Text"
      outputLabel="Emoji letters"
      sample={'Hello 2026'}
      downloadName="emoji-letters.txt"
      options={
        <>
          <Field label="Style">
            <Select value={style} onValueChange={(v) => setStyle(v as Style)}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="regional">Regional indicator 🇦🇧🇨</SelectItem>
                <SelectItem value="squared">Negative squared 🅰🅱</SelectItem>
                <SelectItem value="keycap">Keycap digits 1️⃣2️⃣</SelectItem>
                <SelectItem value="circled">Circled letters Ⓐⓑ①</SelectItem>
                <SelectItem value="fullwidth">Fullwidth ＡＢＣ</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {style === 'regional' && (
            <Field label="Separate squares">
              <div className="flex h-9 items-center gap-2">
                <Switch checked={spacing} onCheckedChange={setSpacing} id="el-spacing" />
                <Label htmlFor="el-spacing" className="text-xs text-muted-foreground">
                  Prevent flag merging
                </Label>
              </div>
            </Field>
          )}
        </>
      }
    />
  );
}
