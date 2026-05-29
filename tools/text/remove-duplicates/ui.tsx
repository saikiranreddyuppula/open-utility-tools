'use client';

import { useCallback, useState } from 'react';

import { Switch } from '@/components/ui/switch';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { splitLines, dedupeLines } from '@/lib/text/lines';

export default function RemoveDuplicatesTool() {
  const [ci, setCi] = useState(false);
  const [trim, setTrim] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      let lines = splitLines(input);
      if (trim) lines = lines.map((l) => l.trim());
      return dedupeLines(lines, ci).join('\n');
    },
    [ci, trim]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[ci, trim]}
      sample={'apple\nbanana\nApple\napple\nbanana\ncherry'}
      downloadName="deduped.txt"
      options={
        <Field label="Options">
          <div className="flex h-8 items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs">
              <Switch checked={ci} onCheckedChange={setCi} /> ignore case
            </label>
            <label className="flex items-center gap-1.5 text-xs">
              <Switch checked={trim} onCheckedChange={setTrim} /> trim before compare
            </label>
          </div>
        </Field>
      }
    />
  );
}
