'use client';

import { useCallback, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

export default function FindReplaceTool() {
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [ci, setCi] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!find) return input;
      if (useRegex) {
        let re: RegExp;
        try {
          re = new RegExp(find, `g${ci ? 'i' : ''}`);
        } catch (e) {
          throw new Error(e instanceof Error ? e.message : 'Invalid regex');
        }
        return input.replace(re, replace);
      }
      if (ci) {
        const re = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        return input.replace(re, replace);
      }
      return input.split(find).join(replace);
    },
    [find, replace, useRegex, ci]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[find, replace, useRegex, ci]}
      sample={'the cat sat on the mat'}
      downloadName="replaced.txt"
      options={
        <>
          <Field label="Find">
            <Input value={find} onChange={(e) => setFind(e.target.value)} className="w-40 font-mono" placeholder="search" />
          </Field>
          <Field label="Replace">
            <Input value={replace} onChange={(e) => setReplace(e.target.value)} className="w-40 font-mono" placeholder="replacement" />
          </Field>
          <Field label="Options">
            <div className="flex h-8 items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={useRegex} onCheckedChange={setUseRegex} /> regex
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={ci} onCheckedChange={setCi} /> ignore case
              </label>
            </div>
          </Field>
        </>
      }
    />
  );
}
