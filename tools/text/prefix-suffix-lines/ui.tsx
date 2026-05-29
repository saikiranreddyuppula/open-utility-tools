'use client';

import { useCallback, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

const SAMPLE = `apple
banana
cherry`;

export default function PrefixSuffixLinesTool() {
  const [prefix, setPrefix] = useState('"');
  const [suffix, setSuffix] = useState('",');
  const [skipBlank, setSkipBlank] = useState(true);
  const [trimFirst, setTrimFirst] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      return input
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((line) => {
          const base = trimFirst ? line.trim() : line;
          if (skipBlank && base.trim().length === 0) return base;
          return `${prefix}${base}${suffix}`;
        })
        .join('\n');
    },
    [prefix, suffix, skipBlank, trimFirst]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[prefix, suffix, skipBlank, trimFirst]}
      inputLabel="Lines"
      outputLabel="Result"
      inputPlaceholder="One item per line…"
      sample={SAMPLE}
      downloadName="wrapped-lines.txt"
      options={
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Prefix" hint="Added to the start of each line">
              <Input
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder='e.g. "'
              />
            </Field>
            <Field label="Suffix" hint="Added to the end of each line">
              <Input
                value={suffix}
                onChange={(e) => setSuffix(e.target.value)}
                placeholder='e.g. ",'
              />
            </Field>
          </div>
          <Field label="Skip blank lines">
            <div className="flex items-center gap-2">
              <Switch
                id="psl-skip"
                checked={skipBlank}
                onCheckedChange={setSkipBlank}
              />
              <Label htmlFor="psl-skip">Leave empty lines untouched</Label>
            </div>
          </Field>
          <Field label="Trim each line first">
            <div className="flex items-center gap-2">
              <Switch
                id="psl-trim"
                checked={trimFirst}
                onCheckedChange={setTrimFirst}
              />
              <Label htmlFor="psl-trim">
                Remove surrounding spaces before wrapping
              </Label>
            </div>
          </Field>
        </div>
      }
    />
  );
}
