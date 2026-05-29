'use client';

import { useCallback, useState } from 'react';

import { Slider } from '@/components/ui/slider';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

function caesar(text: string, shift: number): string {
  const s = ((shift % 26) + 26) % 26;
  return text.replace(/[a-z]/gi, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + s) % 26) + base);
  });
}

export default function Rot13Tool() {
  const [shift, setShift] = useState(13);

  const transform = useCallback((input: string) => caesar(input, shift), [shift]);

  return (
    <TextToolLayout
      transform={transform}
      deps={[shift]}
      inputLabel="Text"
      outputLabel="Shifted"
      sample="The quick brown fox jumps over the lazy dog"
      downloadName="rot.txt"
      options={
        <Field label={`Shift · ${shift}${shift === 13 ? ' (ROT13)' : ''}`} className="min-w-56">
          <Slider
            value={[shift]}
            onValueChange={([v]) => setShift(v ?? 13)}
            min={0}
            max={25}
            step={1}
            className="mt-2.5"
          />
        </Field>
      }
    />
  );
}
