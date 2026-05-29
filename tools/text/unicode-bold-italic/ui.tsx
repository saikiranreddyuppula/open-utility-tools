'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TextToolLayout } from '@/components/tools/text-tool';

type Style =
  | 'bold'
  | 'italic'
  | 'boldItalic'
  | 'script'
  | 'boldScript'
  | 'fraktur'
  | 'monospace'
  | 'doubleStruck'
  | 'sansBold'
  | 'sansItalic';

const STYLE_LABELS: Array<{ value: Style; label: string }> = [
  { value: 'bold', label: 'Bold' },
  { value: 'italic', label: 'Italic' },
  { value: 'boldItalic', label: 'Bold Italic' },
  { value: 'sansBold', label: 'Sans-serif Bold' },
  { value: 'sansItalic', label: 'Sans-serif Italic' },
  { value: 'script', label: 'Script' },
  { value: 'boldScript', label: 'Bold Script' },
  { value: 'fraktur', label: 'Fraktur' },
  { value: 'doubleStruck', label: 'Double-struck' },
  { value: 'monospace', label: 'Monospace' },
];

interface StyleDef {
  // Base code points for 'A', 'a', and '0'. Use null when a range is unsupported
  // (those characters are left unchanged).
  upper: number | null;
  lower: number | null;
  digit: number | null;
  // Per-character overrides for code points that live outside the contiguous
  // block (reserved holes filled from the Letterlike Symbols block).
  overrides?: Record<string, string>;
}

const STYLES: Record<Style, StyleDef> = {
  bold: { upper: 0x1d400, lower: 0x1d41a, digit: 0x1d7ce },
  italic: {
    upper: 0x1d434,
    lower: 0x1d44e,
    digit: null,
    overrides: { h: 'ℎ' }, // Planck constant fills the italic 'h' hole
  },
  boldItalic: { upper: 0x1d468, lower: 0x1d482, digit: null },
  sansBold: { upper: 0x1d5d4, lower: 0x1d5ee, digit: 0x1d7ec },
  sansItalic: { upper: 0x1d63c, lower: 0x1d656, digit: null },
  script: {
    upper: 0x1d49c,
    lower: 0x1d4b6,
    digit: null,
    overrides: {
      B: 'ℬ',
      E: 'ℰ',
      F: 'ℱ',
      H: 'ℋ',
      I: 'ℐ',
      L: 'ℒ',
      M: 'ℳ',
      R: 'ℛ',
      e: 'ℯ',
      g: 'ℊ',
      o: 'ℴ',
    },
  },
  boldScript: { upper: 0x1d4d0, lower: 0x1d4ea, digit: null },
  fraktur: {
    upper: 0x1d504,
    lower: 0x1d51e,
    digit: null,
    overrides: {
      C: 'ℭ',
      H: 'ℌ',
      I: 'ℑ',
      R: 'ℜ',
      Z: 'ℨ',
    },
  },
  doubleStruck: {
    upper: 0x1d538,
    lower: 0x1d552,
    digit: 0x1d7d8,
    overrides: {
      C: 'ℂ',
      H: 'ℍ',
      N: 'ℕ',
      P: 'ℙ',
      Q: 'ℚ',
      R: 'ℝ',
      Z: 'ℤ',
    },
  },
  monospace: { upper: 0x1d670, lower: 0x1d68a, digit: 0x1d7f6 },
};

function styleText(input: string, style: Style): string {
  const def = STYLES[style];
  let out = '';
  for (const ch of input) {
    const override = def.overrides?.[ch];
    if (override !== undefined) {
      out += override;
      continue;
    }
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 0x41 && code <= 0x5a && def.upper !== null) {
      out += String.fromCodePoint(def.upper + (code - 0x41));
    } else if (code >= 0x61 && code <= 0x7a && def.lower !== null) {
      out += String.fromCodePoint(def.lower + (code - 0x61));
    } else if (code >= 0x30 && code <= 0x39 && def.digit !== null) {
      out += String.fromCodePoint(def.digit + (code - 0x30));
    } else {
      out += ch;
    }
  }
  return out;
}

export default function UnicodeBoldItalicTool() {
  const [style, setStyle] = useState<Style>('bold');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      return styleText(input, style);
    },
    [style],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[style]}
      inputLabel="Text"
      outputLabel="Styled"
      inputPlaceholder="Type something fancy"
      sample="Fancy Text 123"
      downloadName="unicode-text.txt"
      options={
        <Field label="Style">
          <Select value={style} onValueChange={(v) => setStyle(v as Style)}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STYLE_LABELS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      }
    />
  );
}
