'use client';

import { useCallback, useState } from 'react';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { textToMorse, morseToText } from '@/lib/text/morse';

export default function MorseCodeTool() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');

  const transform = useCallback(
    (input: string) => (mode === 'encode' ? textToMorse(input) : morseToText(input)),
    [mode]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode]}
      inputLabel={mode === 'encode' ? 'Text' : 'Morse'}
      outputLabel={mode === 'encode' ? 'Morse' : 'Text'}
      sample={mode === 'encode' ? 'SOS HELLO' : '... --- ... / .... . .-.. .-.. ---'}
      downloadName="morse.txt"
      options={
        <Field label="Mode">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'encode' | 'decode')}>
            <TabsList>
              <TabsTrigger value="encode">Text → Morse</TabsTrigger>
              <TabsTrigger value="decode">Morse → Text</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
