'use client';

import { useCallback, useState } from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { base64Encode, base64Decode } from '@/lib/wasm/core';

const dec = new TextDecoder('utf-8', { fatal: false });

export default function Base64TextTool() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [urlSafe, setUrlSafe] = useState(false);
  const [pad, setPad] = useState(true);

  const transform = useCallback(
    async (input: string) => {
      if (!input) return '';
      if (mode === 'encode') return base64Encode(input, urlSafe, pad);
      const bytes = await base64Decode(input);
      return dec.decode(bytes);
    },
    [mode, urlSafe, pad]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, urlSafe, pad]}
      inputLabel={mode === 'encode' ? 'Text' : 'Base64'}
      outputLabel={mode === 'encode' ? 'Base64' : 'Text'}
      sample={mode === 'encode' ? 'Hello, world! 🌍' : 'SGVsbG8sIHdvcmxkISA='}
      downloadName="base64.txt"
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
            <>
              <Field label="URL-safe">
                <div className="flex h-8 items-center gap-2">
                  <Switch id="urlsafe" checked={urlSafe} onCheckedChange={setUrlSafe} />
                  <Label htmlFor="urlsafe" className="text-xs text-muted-foreground">
                    -_ alphabet
                  </Label>
                </div>
              </Field>
              <Field label="Padding">
                <div className="flex h-8 items-center gap-2">
                  <Switch id="pad" checked={pad} onCheckedChange={setPad} />
                  <Label htmlFor="pad" className="text-xs text-muted-foreground">
                    = padding
                  </Label>
                </div>
              </Field>
            </>
          )}
        </>
      }
    />
  );
}
