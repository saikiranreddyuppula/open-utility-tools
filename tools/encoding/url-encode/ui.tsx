'use client';

import { useCallback, useState } from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

export default function UrlEncodeTool() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [whole, setWhole] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      if (mode === 'encode') {
        return whole ? encodeURI(input) : encodeURIComponent(input);
      }
      try {
        return whole ? decodeURI(input) : decodeURIComponent(input);
      } catch {
        throw new Error('Malformed percent-encoding in input.');
      }
    },
    [mode, whole]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, whole]}
      inputLabel={mode === 'encode' ? 'Text' : 'Encoded'}
      outputLabel={mode === 'encode' ? 'Encoded' : 'Text'}
      sample={mode === 'encode' ? 'hello world & co?x=1/2' : 'hello%20world%20%26%20co%3Fx%3D1%2F2'}
      downloadName="url.txt"
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'encode' | 'decode')}>
              <TabsList>
                <TabsTrigger value="encode">Encode</TabsTrigger>
                <TabsTrigger value="decode">Decode</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Scope" hint={whole ? 'whole URL (keeps :/?&=)' : 'component'}>
            <Tabs value={whole ? 'uri' : 'comp'} onValueChange={(v) => setWhole(v === 'uri')}>
              <TabsList>
                <TabsTrigger value="comp">Component</TabsTrigger>
                <TabsTrigger value="uri">Full URL</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        </>
      }
    />
  );
}
