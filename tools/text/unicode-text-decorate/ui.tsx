'use client';

import { useCallback, useState } from 'react';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Style = 'strikethrough' | 'strike-short' | 'underline' | 'double-underline' | 'slash';

// Each style maps to a combining mark code point inserted after every character.
const MARKS: Record<Style, number> = {
  strikethrough: 0x0336, // combining long stroke overlay
  'strike-short': 0x0335, // combining short stroke overlay
  underline: 0x0332, // combining low line
  'double-underline': 0x0333, // combining double low line
  slash: 0x0338, // combining long solidus overlay (slashed)
};

const LABELS: Record<Style, string> = {
  strikethrough: 'Strikethrough',
  'strike-short': 'Short strikethrough',
  underline: 'Underline',
  'double-underline': 'Double underline',
  slash: 'Slashed',
};

const STYLE_ORDER: Style[] = [
  'strikethrough',
  'strike-short',
  'underline',
  'double-underline',
  'slash',
];

export default function UnicodeTextDecorateTool() {
  const [style, setStyle] = useState<Style>('strikethrough');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      const mark = String.fromCharCode(MARKS[style]);
      let out = '';
      for (const ch of Array.from(input)) {
        out += ch;
        // Don't decorate newlines; they would break visually.
        if (ch === '\n' || ch === '\r') continue;
        out += mark;
      }
      return out;
    },
    [style],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[style]}
      inputLabel="Text"
      outputLabel="Decorated"
      inputPlaceholder="Type text to decorate..."
      sample="Strike me through"
      downloadName="decorated.txt"
      options={
        <Field label="Style" hint="Combining marks paste anywhere as styled text.">
          <Select value={style} onValueChange={(v) => setStyle(v as Style)}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STYLE_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      }
    />
  );
}
