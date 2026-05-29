'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'curl' | 'straight';

const LDQUO = '“'; // “
const RDQUO = '”'; // ”
const LSQUO = '‘'; // ‘
const RSQUO = '’'; // ’

function curlify(input: string): string {
  let s = input;
  // Opening double quote: at start, or after whitespace / opening bracket.
  s = s.replace(/(^|[\s([{<‘“])"/g, `$1${LDQUO}`);
  // Any remaining double quotes become closing.
  s = s.replace(/"/g, RDQUO);
  // Opening single quote: at start, or after whitespace / opening bracket.
  s = s.replace(/(^|[\s([{<“])'/g, `$1${LSQUO}`);
  // Any remaining single quotes (apostrophes, closings) become right-single.
  s = s.replace(/'/g, RSQUO);
  return s;
}

function straighten(input: string): string {
  return input
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[″]/g, '"');
}

export default function SmartQuotesTool() {
  const [mode, setMode] = useState<Mode>('curl');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      return mode === 'curl' ? curlify(input) : straighten(input);
    },
    [mode]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode]}
      inputLabel="Text"
      outputLabel={mode === 'curl' ? 'Curly quotes' : 'Straight quotes'}
      sample={`"It's a test," she said. 'Hello' said the 90s kid.`}
      downloadName="quotes.txt"
      options={
        <Field label="Direction">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="curl">Straight &rarr; Curly</TabsTrigger>
              <TabsTrigger value="straight">Curly &rarr; Straight</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
