'use client';

import { useCallback, useState } from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { hexEncode, hexDecode } from '@/lib/wasm/core';

const dec = new TextDecoder('utf-8', { fatal: false });

export default function HexTextTool() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [upper, setUpper] = useState(false);

  const transform = useCallback(
    async (input: string) => {
      if (!input) return '';
      if (mode === 'encode') return hexEncode(input, upper);
      return dec.decode(await hexDecode(input));
    },
    [mode, upper]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, upper]}
      inputLabel={mode === 'encode' ? 'Text' : 'Hex'}
      outputLabel={mode === 'encode' ? 'Hex' : 'Text'}
      sample={mode === 'encode' ? 'Hello, world!' : '48656c6c6f2c20776f726c6421'}
      downloadName="hex.txt"
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
            <Field label="Case">
              <div className="flex h-8 items-center gap-2">
                <Switch id="upper" checked={upper} onCheckedChange={setUpper} />
                <Label htmlFor="upper" className="text-xs text-muted-foreground">
                  uppercase
                </Label>
              </div>
            </Field>
          )}
        </>
      }
    />
  );
}
