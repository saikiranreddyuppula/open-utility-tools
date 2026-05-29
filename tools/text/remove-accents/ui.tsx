'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

// Characters NFD normalization does not decompose; map them explicitly.
const EXTRA: Record<string, string> = {
  'ß': 'ss', // ß
  'æ': 'ae',
  'Æ': 'AE',
  'œ': 'oe',
  'Œ': 'OE',
  'ð': 'd', // ð
  'Ð': 'D',
  'þ': 'th', // þ
  'Þ': 'Th',
  'ø': 'o', // ø
  'Ø': 'O',
  'ł': 'l', // ł
  'Ł': 'L',
  'đ': 'd', // đ
  'Đ': 'D',
  'ı': 'i', // ı (dotless i)
};

export default function RemoveAccentsTool() {
  const [extraMap, setExtraMap] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      let out = input;
      if (extraMap) {
        out = out.replace(/[\s\S]/g, (ch) => EXTRA[ch] ?? ch);
      }
      // NFD splits accented chars into base + combining marks; strip the marks.
      return out.normalize('NFD').replace(/[̀-ͯ]/g, '');
    },
    [extraMap]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[extraMap]}
      inputLabel="Text"
      outputLabel="ASCII text"
      sample={'Café — naïve résumé, über jalapeño, straße.'}
      downloadName="ascii.txt"
      options={
        <Field label="Ligatures & special letters">
          <div className="flex h-9 items-center gap-2">
            <Checkbox
              id="extra"
              checked={extraMap}
              onCheckedChange={(v) => setExtraMap(v === true)}
            />
            <Label htmlFor="extra" className="text-xs font-normal">
              {'Expand ß→ss, æ→ae, ø→o, etc.'}
            </Label>
          </div>
        </Field>
      }
    />
  );
}
