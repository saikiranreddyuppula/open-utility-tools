'use client';

import { useCallback, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

export default function SlugifyTool() {
  const [sep, setSep] = useState('-');
  const [lower, setLower] = useState(true);

  const transform = useCallback(
    (input: string) => {
      let s = input
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '') // strip diacritics
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, sep || '-');
      if (lower) s = s.toLowerCase();
      return s;
    },
    [sep, lower]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[sep, lower]}
      inputLabel="Text"
      outputLabel="Slug"
      sample="Héllo, World! — This is a Tëst (v2)"
      downloadName="slug.txt"
      options={
        <>
          <Field label="Separator">
            <Input
              value={sep}
              onChange={(e) => setSep(e.target.value.slice(0, 1))}
              className="w-16 text-center font-mono"
              maxLength={1}
            />
          </Field>
          <Field label="Case">
            <Tabs value={lower ? 'lower' : 'keep'} onValueChange={(v) => setLower(v === 'lower')}>
              <TabsList>
                <TabsTrigger value="lower">lower</TabsTrigger>
                <TabsTrigger value="keep">Keep</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </>
      }
    />
  );
}
