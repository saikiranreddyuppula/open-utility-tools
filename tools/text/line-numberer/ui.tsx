'use client';

import { useCallback, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

export default function LineOperationsTool() {
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [number, setNumber] = useState(false);
  const [start, setStart] = useState(1);
  const [skipEmpty, setSkipEmpty] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      let n = start;
      return input
        .split('\n')
        .map((line) => {
          if (skipEmpty && line.trim() === '') return line;
          const num = number ? `${n++}. ` : '';
          return `${num}${prefix}${line}${suffix}`;
        })
        .join('\n');
    },
    [prefix, suffix, number, start, skipEmpty]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[prefix, suffix, number, start, skipEmpty]}
      sample={'apple\nbanana\ncherry'}
      downloadName="lines.txt"
      options={
        <>
          <Field label="Prefix">
            <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} className="w-28 font-mono" placeholder="> " />
          </Field>
          <Field label="Suffix">
            <Input value={suffix} onChange={(e) => setSuffix(e.target.value)} className="w-28 font-mono" placeholder="," />
          </Field>
          <Field label="Number">
            <div className="flex h-8 items-center gap-2">
              <Switch checked={number} onCheckedChange={setNumber} />
              {number && (
                <Input
                  type="number"
                  value={start}
                  onChange={(e) => setStart(Number(e.target.value) || 1)}
                  className="w-16 font-mono"
                />
              )}
            </div>
          </Field>
          <Field label="Skip empty">
            <div className="flex h-8 items-center">
              <Switch checked={skipEmpty} onCheckedChange={setSkipEmpty} />
            </div>
          </Field>
        </>
      }
    />
  );
}
