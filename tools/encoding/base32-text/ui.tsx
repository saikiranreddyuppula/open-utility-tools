'use client';

import { useCallback, useState } from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { base32Encode, base32Decode } from '@/lib/wasm/core';

const dec = new TextDecoder('utf-8', { fatal: false });

export default function Base32TextTool() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [pad, setPad] = useState(true);

  const transform = useCallback(
    async (input: string) => {
      if (!input) return '';
      if (mode === 'encode') return base32Encode(input, pad);
      return dec.decode(await base32Decode(input));
    },
    [mode, pad]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, pad]}
      inputLabel={mode === 'encode' ? 'Text' : 'Base32'}
      outputLabel={mode === 'encode' ? 'Base32' : 'Text'}
      sample={mode === 'encode' ? 'Hello, world!' : 'JBSWY3DPFQQHO33SNRSCC==='}
      downloadName="base32.txt"
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
          {mode === 'encode' && (
            <Field label="Padding">
              <div className="flex h-8 items-center gap-2">
                <Switch id="pad" checked={pad} onCheckedChange={setPad} />
                <Label htmlFor="pad" className="text-xs text-muted-foreground">
                  = padding
                </Label>
              </div>
            </Field>
          )}
        </>
      }
    />
  );
}
